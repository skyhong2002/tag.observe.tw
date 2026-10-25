// Candidate/capture orchestration. CLI defaults to planning, never self-authorizes.
import { execFile, spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { guardedBuild } from '../guard-next-build.js';
import {
  acquireGlobalLock,
  assertGlobalLock,
  combineGates,
  mintSample,
  validateExecutionInput,
  verifyIsolatedApi,
  verifySource,
} from '../mint-f1-execution.js';
import { verifyHost } from '../mint-f1-host-adapter.js';
import { probeSM, transportArgs } from '../mint-f1-sm-adapter.js';
import { runCapture } from './capture-driver.mjs';
import { hash, origin, pins, validatedAttemptSuffix } from './capture-policy.mjs';
import { verifyControl } from './control-source.mjs';
import { errorRecord } from './diagnostic.mjs';
import { candidateResources, createGateCache } from './gate-cache.mjs';
import { observeGlobalCountsAsync } from './global-counts.mjs';
import { selectBatch } from './ledger-plan.mjs';
import { verifyPreviousMint, verifyPreviousNative } from './previous-native.mjs';
import {
  finishRemoteBeforeRelease,
  holdUnconfirmed,
  monotonicMs,
  remoteObservationScript,
  remoteStopScript,
  UnconfirmedAfterStartedBound,
  validateRemoteOwner,
} from './remote-cleanup.mjs';
import { actualSmProbe } from './sm-probe.mjs';

const executeFile = promisify(execFile);
const root = '/var/lib/observe-worker/tag',
  source = dirname(fileURLToPath(import.meta.url));
export function batchPaths(id, attemptSuffix = '') {
  attemptSuffix = validatedAttemptSuffix(attemptSuffix);
  if (!/^batch-(?!000)[0-9]{3}$/.test(id)) throw Error('Exact batch session');
  return {
    job: root + '/candidate-sm-c70425b0-' + id + attemptSuffix,
    admission: root + '/private/sm-candidate-c70425b0-' + id + attemptSuffix + '.json',
    smJob: '/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/candidate-' + id + attemptSuffix,
    smAdmission:
      '/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/candidate-admission-' + id + attemptSuffix + '.json',
  };
}
export function privateBytes(p, max = 1048576) {
  const s = fs.lstatSync(p);
  if (!s.isFile() || s.isSymbolicLink() || s.uid !== process.getuid() || s.mode & 0o077 || s.size > max)
    throw Error('Private current regular file');
  return fs.readFileSync(p);
}
export function validatePlan(p, now = Date.now()) {
  validatedAttemptSuffix(p.attemptSuffix);
  if (
    p.schema !== 'mint-capture-batch-plan-v1' ||
    p.reviewed !== true ||
    p.executionPermission !== true ||
    p.globalSlotAcknowledged !== true ||
    !/^batch-(?!000)[0-9]{3}$/.test(p.sessionId) ||
    !Number.isFinite(p.sessionExpiresAtMs) ||
    p.sessionExpiresAtMs - now <= 180000 ||
    p.sessionExpiresAtMs - now > 900000 ||
    !Number.isFinite(p.captureExpiresAtMs) ||
    p.captureExpiresAtMs - now > 540000 ||
    p.captureExpiresAtMs <= now ||
    p.captureExpiresAtMs + 60000 > p.sessionExpiresAtMs - 120000 ||
    p.actor !== 'anonymous' ||
    p.allowMutations !== false ||
    !p.sourceHashes ||
    !p.smDriverPins ||
    !p.smSourcePins ||
    !Array.isArray(p.routes) ||
    p.routes.length < 1 ||
    p.routes.length > 4
  )
    throw Error('Current separately admitted batch plan required');
  for (const v of Object.values(p.sourceHashes)) if (!/^[a-f0-9]{64}$/.test(v)) throw Error('Exact source byte pins');
  return p;
}
export function validateSMPaths(plan, controlOpsSha) {
  const prefix = '/home/deck/tag-analysis-private/f1-release/capture-control-' + controlOpsSha + '/tools/mint-sm-candidate';
  const names = ['candidate-parent.mjs', 'candidate-worker.mjs', 'candidate-contract.mjs', 'candidate-core.mjs'];
  if (
    Object.keys(plan.smDriverPins).length !== 4 ||
    names.some((n) => !plan.smDriverPins[prefix + '/' + n]) ||
    plan.smFrontdoorConfigPath !== prefix + '/frontdoor-config-' + plan.sessionId + validatedAttemptSuffix(plan.attemptSuffix) + '.json'
  )
    throw Error('Exact detached SM source/config namespace');
  return prefix;
}
export function deadlineCheck(deadline, fatal, now = Date.now()) {
  if (fatal || !Number.isFinite(deadline) || now >= deadline) throw Error('Fatal/deadline prevents acceptance');
}

const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
export async function runBatch(inputPath, planPath, expectedPlanSha) {
  const input = JSON.parse(privateBytes(inputPath)),
    planBytes = privateBytes(planPath),
    plan = validatePlan(JSON.parse(planBytes));
  if (hash(planBytes) !== expectedPlanSha) throw Error('Exact admitted plan hash');
  validateExecutionInput(input);
  if (input.estimateGiB < 0.25) throw Error('Whole capture batch estimate requires at least0.25GiB');
  if (plan.controlOpsSha !== input.opsSha) throw Error('Separate exact control OPS binding');
  validateSMPaths(plan, input.opsSha);
  if (input.repo !== '/home/sky/observe-worker/sources/tag-capture-' + input.opsSha || fs.realpathSync(input.repo) !== input.repo)
    throw Error('Exact detached Mint control source');
  verifySource(input);
  verifyControl(input.repo, input.opsSha, plan.sourceHashes);
  const ledgerPath = join(input.repo, 'docs/ui-review/mint-anonymous-capture-plan.json'),
    ledgerBytes = fs.readFileSync(ledgerPath);
  if (hash(ledgerBytes) !== plan.ledgerSha256) throw Error('Actual fixed ledger hash');
  const selected = selectBatch(JSON.parse(ledgerBytes), plan.sessionId);
  if (JSON.stringify(selected.routes) !== JSON.stringify(plan.routes)) throw Error('Batch route substitution');
  const paths = batchPaths(plan.sessionId, plan.attemptSuffix),
    host = await verifyHost({ receipt: input.hostReceipt, candidateParent: root, estimateGiB: 0.25 });
  const startDisk = fs.statfsSync(root);
  if (Number(startDisk.bavail) * Number(startDisk.bsize) < 40 * 1024 ** 3) throw Error('Candidate startup needs actual Mint40GiB');
  verifyPreviousMint(
    privateBytes(root + '/native-mint-loader-job-c70425b0/acceptance.json'),
    privateBytes(root + '/native-mint-loader-job-c70425b0/result.json'),
  );
  verifyPreviousNative(
    privateBytes(root + '/private/sm-native-r2-acceptance.json'),
    privateBytes(root + '/private/sm-native-r2-result.json'),
    privateBytes(root + '/private/sm-native-r2-independent-review.json'),
  );
  let lock,
    fatal,
    active = false,
    group = 0,
    seq = 0,
    cache,
    remoteCleaned = false,
    cleanupProbe,
    jobCreated = false;
  const deadline = Math.min(Date.parse(input.hostReceipt.expiresAt), Date.now() + 1200000);
  let timer;
  const parentCleanup = async () => {
    const path = join(paths.job, 'remote-owner.json');
    let bytes;
    try {
      bytes = privateBytes(path);
    } catch (e) {
      if (e.code === 'ENOENT') return true;
      throw e;
    }
    const record = JSON.parse(bytes);
    validateRemoteOwner(record, {
      inputSha256: hash(privateBytes(inputPath)),
      planSha256: expectedPlanSha,
      sessionId: plan.sessionId,
      attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
      controlOpsSha: input.opsSha,
      smJob: paths.smJob,
      smAdmission: paths.smAdmission,
      driverPins: plan.smDriverPins,
    });
    if (
      record.smInput.expiresAtMs !== plan.sessionExpiresAtMs ||
      record.smInput.mintAdmissionPath !== paths.admission ||
      record.smInput.mintControlLeasePath !== join(paths.job, 'lease.json') ||
      record.smInput.mintLockPid !== lock.pid ||
      record.smInput.frontdoorConfigPath !== plan.smFrontdoorConfigPath ||
      record.smInput.frontdoorConfigSha256 !== plan.smFrontdoorConfigSha256
    )
      throw Error('Remote expiry/kernel/config binding');
    let cleanupRawBytes = 0;
    const rpc = async (script) => {
      if (cleanupRawBytes > 30 * 1024 ** 2) throw Error('Parent cleanup raw budget exhausted; holder retained');
      if (cleanupProbe) await cleanupProbe();
      const st = fs.lstatSync(input.smReceipt.knownHostsPath);
      if (
        !st.isFile() ||
        st.isSymbolicLink() ||
        st.uid !== process.getuid() ||
        st.mode & 0o077 ||
        hash(fs.readFileSync(input.smReceipt.knownHostsPath)) !== input.smReceipt.knownHostsSha256
      )
        throw Error('Parent cleanup transport changed');
      let r;
      try {
        const v = await executeFile('/usr/bin/ssh', [...transportArgs(input.smReceipt).slice(0, -1), 'python3 -c ' + quote(script)], {
          encoding: null,
          timeout: 15000,
          maxBuffer: 1048576,
          env: { PATH: '/usr/bin:/bin', LANG: 'C' },
        });
        r = { status: 0, ...v };
      } catch (e) {
        r = { status: typeof e.code === 'number' ? e.code : null, stdout: e.stdout, stderr: e.stderr, error: e.message, signal: e.signal };
      }
      cleanupRawBytes += Buffer.byteLength(r.stdout || '') + Buffer.byteLength(r.stderr || '') + 4096;
      fs.writeFileSync(
        join(paths.job, 'parent-cleanup-' + ++seq + '.raw.json'),
        JSON.stringify({
          ...r,
          stdout: undefined,
          stderr: undefined,
          stdoutBase64: Buffer.from(r.stdout || '').toString('base64'),
          stderrBase64: Buffer.from(r.stderr || '').toString('base64'),
        }) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
      if (r.status !== 0) throw Error('Parent cleanup RPC failed; raw retained');
      return Buffer.from(r.stdout).toString();
    };
    return finishRemoteBeforeRelease({
      record,
      driverSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
      quiesce: async () => {
        if (cache) {
          await cache.stop();
          cache = null;
        }
      },
      requestStop: () => rpc(remoteStopScript(record)),
      observe: async () => JSON.parse(await rpc(remoteObservationScript(record))),
      audit: (entry) =>
        fs.appendFileSync(
          join(paths.job, 'parent-remote-cleanup.jsonl'),
          JSON.stringify({ utc: new Date().toISOString(), ...entry }) + '\n',
          { mode: 0o600 },
        ),
    });
  };
  try {
    lock = await acquireGlobalLock(input);
    assertGlobalLock(lock.pid);
    fs.mkdirSync(paths.job, { mode: 0o700 });
    jobCreated = true;
    cache = createGateCache({
      sampleSm: (signal) =>
        actualSmProbe({ receipt: input.smReceipt, signal, rawPath: join(paths.job, 'formal-sm-probe-' + ++seq + '.raw.json') }),
      sampleCounts: (signal) =>
        observeGlobalCountsAsync(input.smReceipt, {
          sessionId: plan.sessionId,
          attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
          controlOpsSha: input.opsSha,
          signal,
          rawPath: join(paths.job, 'global-counts-' + ++seq + '.raw.json'),
        }),
      onError: (key, error) =>
        fs.writeFileSync(join(paths.job, 'sampler-error-' + ++seq + '.json'), JSON.stringify(errorRecord(error, { phase: key })) + '\n', {
          flag: 'wx',
          mode: 0o600,
        }),
    });
    await cache.start();
    const probe = async () => {
      try {
        deadlineCheck(deadline, fatal);
        assertGlobalLock(lock.pid);
        await verifyIsolatedApi(input, { ...host, receipt: input.hostReceipt });
        const { sm, counts } = cache.snapshot();
        const mint = mintSample(root, group);
        candidateResources(mint, counts, { starting: group === 0 });
        fs.writeFileSync(join(paths.job, 'global-observation.pending.json'), JSON.stringify(counts), { mode: 0o600 });
        fs.renameSync(join(paths.job, 'global-observation.pending.json'), join(paths.job, 'global-observation.json'));
        const decision = combineGates(sm, mint, input, { starting: group === 0, paused: false, estimatedUsageGiB: 0.25 });
        const countAllowed =
          counts.hosts.reduce((n, h) => n + h.buildCount, 0) === 0 && counts.hosts.reduce((n, h) => n + h.browserRoots, 0) <= 2;
        const lease = {
          schema: 'tag-isolated-candidate-lease-v1',
          sessionId: plan.sessionId,
          attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
          controlOpsSha: input.opsSha,
          driverSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
          inputSha256: hash(privateBytes(inputPath)),
          planSha256: expectedPlanSha,
          opsSha: pins.ops,
          lockPid: lock.pid,
          taskDeadlineMs: deadline,
          observedAtMs: Date.now(),
          apiReady: true,
          sm,
          mint,
          decision: decision === 'run' && countAllowed ? 'run' : 'pause',
        };
        fs.writeFileSync(join(paths.job, 'lease.pending.json'), JSON.stringify(lease), { mode: 0o600 });
        fs.renameSync(join(paths.job, 'lease.pending.json'), join(paths.job, 'lease.json'));
        return { ...sm, mint, ...(lease.decision === 'run' ? {} : { probeError: 'Actual global candidate/capture gate paused' }) };
      } catch (e) {
        fs.writeFileSync(
          join(paths.job, 'gate-error-' + ++seq + '.json'),
          JSON.stringify(
            errorRecord(e, {
              inputSha256: hash(privateBytes(inputPath)),
              planSha256: expectedPlanSha,
              phase: 'actual-api-sm-mint-global-probe',
            }),
          ) + '\n',
          { flag: 'wx', mode: 0o600 },
        );
        const lease = {
          schema: 'tag-isolated-candidate-lease-v1',
          sessionId: plan.sessionId,
          attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
          controlOpsSha: input.opsSha,
          driverSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
          inputSha256: hash(privateBytes(inputPath)),
          planSha256: expectedPlanSha,
          opsSha: pins.ops,
          lockPid: lock.pid,
          observedAtMs: Date.now(),
          taskDeadlineMs: deadline,
          apiReady: false,
          decision: 'pause',
        };
        fs.writeFileSync(join(paths.job, 'lease.pending.json'), JSON.stringify(lease), { mode: 0o600 });
        fs.renameSync(join(paths.job, 'lease.pending.json'), join(paths.job, 'lease.json'));
        try {
          assertGlobalLock(lock.pid);
          deadlineCheck(deadline, fatal);
        } catch (err) {
          fatal = err;
          if (active) process.emit('SIGTERM');
        }
        return { sites: [], probeError: 'Actual gate unavailable' };
      }
    };
    cleanupProbe = probe;
    timer = setTimeout(
      () => {
        fatal = Error('Candidate task deadline');
        if (active) process.emit('SIGTERM');
      },
      Math.max(1, deadline - Date.now()),
    );
    active = true;
    const fd = fs.openSync(join(paths.job, 'stage.log'), 'wx', 0o600);
    let code;
    try {
      code = await guardedBuild({
        command: input.hostReceipt.mint.nodePath,
        args: [
          join(source, 'entry.mjs'),
          '--worker',
          inputPath,
          planPath,
          expectedPlanSha,
          String(lock.pid),
          String(deadline),
          join(paths.job, 'worker-error.json'),
        ],
        cwd: input.repo,
        estimatedUsageGiB: 0.25,
        intervalMs: 1000,
        record: (e) => {
          if (e.event === 'started') group = e.processGroup;
          fs.appendFileSync(join(paths.job, 'guard.jsonl'), JSON.stringify({ utc: new Date().toISOString(), ...e }) + '\n', {
            mode: 0o600,
          });
        },
        probe,
        spawnBuild: (bin, args, opts) =>
          spawn(bin, args, {
            ...opts,
            env: { PATH: input.hostReceipt.noninteractivePath, HOME: '/nonexistent', LANG: 'C', NEXT_TELEMETRY_DISABLED: '1' },
            stdio: ['ignore', fd, fd],
          }),
      });
    } finally {
      fs.closeSync(fd);
      active = false;
    }
    deadlineCheck(deadline, fatal);
    if (code !== 0) throw Error('Batch failed; all private outputs retained');
    const ended = JSON.parse(privateBytes(join(paths.job, 'worker-ended.json')));
    if (
      validatedAttemptSuffix(ended.attemptSuffix) !== validatedAttemptSuffix(plan.attemptSuffix) ||
      ended.inputSha256 !== hash(privateBytes(inputPath)) ||
      ended.planSha256 !== expectedPlanSha ||
      ended.sessionId !== plan.sessionId ||
      ended.controlOpsSha !== input.opsSha ||
      ended.status !== 'owner-session-ended' ||
      ended.deployEligible !== false
    )
      throw Error('Actual worker-ended binding');
    await parentCleanup();
    remoteCleaned = true;
    verifyControl(input.repo, input.opsSha, plan.sourceHashes);
    const final = await probe();
    if (final.probeError) throw Error('Final fresh batch gate');
    deadlineCheck(deadline, fatal);
    assertGlobalLock(lock.pid);
    fs.writeFileSync(
      join(paths.job, 'acceptance.json'),
      JSON.stringify({
        schema: 'mint-capture-owner-session-ended-v1',
        utc: new Date().toISOString(),
        sessionId: plan.sessionId,
        attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
        controlOpsSha: input.opsSha,
        artifactOpsSha: pins.ops,
        appSha: pins.app,
        buildId: pins.build,
        inventorySha256: pins.inventory,
        status: 'owner-session-ended',
        uiReview: 'pending independent image/network review',
        deployEligible: false,
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
  } finally {
    if (timer) clearTimeout(timer);
    try {
      if (lock && jobCreated && !remoteCleaned)
        try {
          await parentCleanup();
        } catch (error) {
          if (error instanceof UnconfirmedAfterStartedBound) throw error;
          await holdUnconfirmed({
            quiesce: async () => {
              if (cache) {
                await cache.stop();
                cache = null;
              }
            },
            audit: (entry) =>
              fs.appendFileSync(
                join(paths.job, 'parent-remote-cleanup.jsonl'),
                JSON.stringify({ utc: new Date().toISOString(), error: error.message, ...entry }) + '\n',
                { mode: 0o600 },
              ),
          });
          throw error;
        }
    } finally {
      try {
        if (cache) await cache.stop();
      } finally {
        if (lock) await lock.release();
      }
    }
  }
}
export async function superviseConcurrent({
  startCandidate,
  waitStarted,
  capture,
  waitEnded,
  stopCandidate,
  verifyUnchanged,
  finalGate,
  writeAcceptance,
}) {
  let owner, primary;
  try {
    owner = await startCandidate();
    const started = await waitStarted(owner);
    await capture(started);
    const ended = await waitEnded(owner);
    await verifyUnchanged();
    await finalGate();
    await writeAcceptance(ended);
    return ended;
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    if (owner)
      try {
        await stopCandidate(owner);
      } catch (cleanup) {
        if (primary) primary.cleanupError = String(cleanup.message).slice(0, 512);
        else throw cleanup;
      }
  }
}
export async function worker(inputPath, planPath, expectedPlanSha, lockPid, deadline) {
  const input = JSON.parse(privateBytes(inputPath)),
    plan = validatePlan(JSON.parse(privateBytes(planPath)));
  if (hash(privateBytes(planPath)) !== expectedPlanSha) throw Error('Worker plan hash');
  validateExecutionInput(input);
  if (input.estimateGiB < 0.25) throw Error('Whole capture batch estimate requires at least0.25GiB');
  if (plan.controlOpsSha !== input.opsSha) throw Error('Separate exact control OPS binding');
  validateSMPaths(plan, input.opsSha);
  if (input.repo !== '/home/sky/observe-worker/sources/tag-capture-' + input.opsSha || fs.realpathSync(input.repo) !== input.repo)
    throw Error('Exact detached Mint control source');
  verifySource(input);
  verifyControl(input.repo, input.opsSha, plan.sourceHashes);
  const catalogueBytes = fs.readFileSync(join(input.repo, 'docs/ui-review/mint-anonymous-capture-plan.json'));
  if (hash(catalogueBytes) !== plan.ledgerSha256) throw Error('Worker ledger digest');
  const selected = selectBatch(JSON.parse(catalogueBytes), plan.sessionId);
  if (JSON.stringify(selected.routes) !== JSON.stringify(plan.routes)) throw Error('Exact anonymous batch route set');
  const paths = batchPaths(plan.sessionId, plan.attemptSuffix);
  const gate = () => {
    deadlineCheck(deadline);
    assertGlobalLock(lockPid);
    const lease = JSON.parse(privateBytes(join(paths.job, 'lease.json')));
    if (
      lease.sessionId !== plan.sessionId ||
      lease.controlOpsSha !== input.opsSha ||
      lease.inputSha256 !== hash(privateBytes(inputPath)) ||
      lease.planSha256 !== expectedPlanSha ||
      lease.apiReady !== true ||
      lease.decision !== 'run' ||
      Date.now() - lease.observedAtMs < 0 ||
      Date.now() - lease.observedAtMs > 15000
    )
      throw Error('Fresh bound actual worker gate');
  };
  const runtime = root + '/candidate-677a0c79-home-fix.native-runtime-r2.target-runtime';
  const { inventory } = await import('../mint-f1-artifact.js');
  const immutable = () => {
    gate();
    if (
      hash(JSON.stringify(inventory(runtime))) !== pins.inventory ||
      hash(fs.readFileSync(join(runtime, 'mint-artifact.json'))) !== pins.manifest
    )
      throw Error('Immutable same artifact changed');
    gate();
  };
  immutable();
  verifyPreviousMint(
    privateBytes(root + '/native-mint-loader-job-c70425b0/acceptance.json'),
    privateBytes(root + '/native-mint-loader-job-c70425b0/result.json'),
  );
  verifyPreviousNative(
    privateBytes(root + '/private/sm-native-r2-acceptance.json'),
    privateBytes(root + '/private/sm-native-r2-result.json'),
    privateBytes(root + '/private/sm-native-r2-independent-review.json'),
  );
  const candidateStartDisk = fs.statfsSync(root);
  if (Number(candidateStartDisk.bavail) * Number(candidateStartDisk.bsize) < 40 * 1024 ** 3)
    throw Error('Actual candidate pre-admission40GiB gate');
  const kernel = fs.lstatSync('/run/lock/mint-global-build.lock'),
    stat = fs.readFileSync('/proc/' + lockPid + '/stat', 'utf8'),
    startTicks = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/)[19];
  const admission = {
    schema: 'mint-specific-sm-candidate-admission-v1',
    reviewed: true,
    sessionId: plan.sessionId,
    attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
    controlOpsSha: input.opsSha,
    appSha: pins.app,
    opsSha: pins.ops,
    scope: 'sm-isolated-candidate',
    mintControlLeasePath: join(paths.job, 'lease.json'),
    buildId: pins.build,
    artifactInventorySha256: pins.inventory,
    driverSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
    inputSha256: hash(privateBytes(inputPath)),
    planSha256: expectedPlanSha,
    mintLockPid: lockPid,
    expiresAtMs: plan.sessionExpiresAtMs,
  };
  const smInput = {
    schema: 'sm-isolated-candidate-v1',
    reviewed: true,
    sessionId: plan.sessionId,
    attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
    controlOpsSha: input.opsSha,
    appSha: pins.app,
    opsSha: pins.ops,
    expiresAtMs: plan.sessionExpiresAtMs,
    mintLockPid: lockPid,
    mintLockDev: String(kernel.dev),
    mintLockInode: String(kernel.ino),
    mintPidStartTicks: startTicks,
    mintLockCmdlineSha256: hash(fs.readFileSync('/proc/' + lockPid + '/cmdline')),
    mintAdmissionPath: paths.admission,
    mintAdmissionSha256: hash(JSON.stringify(admission) + '\n'),
    mintControlLeasePath: join(paths.job, 'lease.json'),
    sshConfigSha256: plan.smSshConfigSha256,
    sshKnownHostsSha256: plan.smSshKnownHostsSha256,
    driverPins: plan.smDriverPins,
    sourcePins: plan.smSourcePins,
    frontdoorConfigPath: plan.smFrontdoorConfigPath,
    frontdoorConfigSha256: plan.smFrontdoorConfigSha256,
    nativeReceiptPath:
      '/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/native-smoke-job-r2/native-evidence/worker-result.json',
    nativeReceiptSha256: '09fee64d014c65c47c7ffd8548d1c2b4aa0aaa3e63ae337f1eaa393c45b68a75',
    sshEffectiveHostName: plan.sshEffectiveHostName,
    sshEffectiveUser: 'sky',
    isolationReceiptId: input.hostReceipt.api.isolationReceiptId,
  };
  const smInputBytes = Buffer.from(JSON.stringify(smInput) + '\n');
  const checkTransport = () => {
    const s = fs.lstatSync(input.smReceipt.knownHostsPath);
    if (
      !s.isFile() ||
      s.isSymbolicLink() ||
      s.uid !== process.getuid() ||
      s.mode & 0o077 ||
      hash(fs.readFileSync(input.smReceipt.knownHostsPath)) !== input.smReceipt.knownHostsSha256
    )
      throw Error('Strict current SM transport changed');
  };
  let rpc = 0;
  const remote = (script, payload) => {
    gate();
    checkTransport();
    const r = spawnSync('/usr/bin/ssh', [...transportArgs(input.smReceipt).slice(0, -1), 'python3 -c ' + quote(script)], {
      input: payload,
      encoding: null,
      timeout: 15000,
      maxBuffer: 1048576,
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
    fs.writeFileSync(
      join(paths.job, 'candidate-rpc-' + ++rpc + '.raw.json'),
      JSON.stringify({
        status: r.status,
        signal: r.signal,
        error: r.error?.code || null,
        stdoutBase64: Buffer.from(r.stdout || '').toString('base64'),
        stderrBase64: Buffer.from(r.stderr || '').toString('base64'),
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    if (r.status !== 0 || r.error) throw Error('Candidate operation failed; raw retained');
    gate();
    return Buffer.from(r.stdout || '').toString();
  };
  const preflight = `import json,sys,os,stat,hashlib\nfrom pathlib import Path\nq=json.load(sys.stdin)\nassert Path('/etc/machine-id').read_text().strip()=='302c2528bd464ad0953cf5fa743b6171'\nfor path,sha in list(q['driverPins'].items())+list(q['sourcePins'].items()):\n p=Path(path);s=p.lstat();assert stat.S_ISREG(s.st_mode) and not p.is_symlink() and s.st_uid==os.getuid() and s.st_mode&0o022==0 and s.st_size<=1048576 and hashlib.sha256(p.read_bytes()).hexdigest()==sha\np=Path(q['frontdoorConfigPath']);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_mode&0o077==0 and s.st_size<=65536 and hashlib.sha256(p.read_bytes()).hexdigest()==q['frontdoorConfigSha256']\nc=json.loads(p.read_bytes());assert c==dict(bindIp='100.85.214.25',port=18196,nextOrigin='http://127.0.0.1:18195',apiOrigin='http://127.0.0.1:18131',actor='anonymous',allowMutations=False,expiresAt=q['expiresAtMs'])\nprint('PREFLIGHT')`;
  remote(preflight, smInputBytes);
  gate();
  fs.writeFileSync(
    join(paths.job, 'remote-owner.json'),
    JSON.stringify({
      schema: 'mint-capture-remote-owner-v1',
      inputSha256: hash(privateBytes(inputPath)),
      planSha256: expectedPlanSha,
      smJob: paths.smJob,
      smAdmission: paths.smAdmission,
      smInput,
      smInputSha256: hash(smInputBytes),
    }) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  fs.writeFileSync(paths.admission, JSON.stringify(admission) + '\n', { flag: 'wx', mode: 0o600 });
  const put = `import os,sys\nb=sys.stdin.buffer.read(65537);assert len(b)<=65536\np=${JSON.stringify(paths.smAdmission)}\nf=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)\nwith os.fdopen(f,'wb') as o:o.write(b)\nprint('WRITTEN')`;
  remote(put, smInputBytes);
  const smSourceRoot = '/home/deck/tag-analysis-private/f1-release/capture-control-' + input.opsSha + '/tools/mint-sm-candidate';
  const expectedDrivers = ['candidate-parent.mjs', 'candidate-worker.mjs', 'candidate-contract.mjs', 'candidate-core.mjs'].map(
    (n) => smSourceRoot + '/' + n,
  );
  if (Object.keys(plan.smDriverPins).length !== 4 || expectedDrivers.some((p) => !plan.smDriverPins[p]))
    throw Error('Exact detached SM control paths');
  const smParent = smSourceRoot + '/candidate-parent.mjs';
  if (!smParent) throw Error('Pinned SM parent');
  const command =
    'env -i PATH=/home/deck/.local/bin:/usr/bin:/bin HOME=/nonexistent LANG=C NEXT_TELEMETRY_DISABLED=1 nice -n 19 ionice -c3 /home/deck/.local/bin/node ' +
    quote(smParent) +
    ' ' +
    quote(paths.smAdmission) +
    ' ' +
    quote(paths.smJob) +
    ' ' +
    quote(hash(smInputBytes));
  let candidate,
    error,
    ownerStopRequested = false;
  const requestOwnerStop = () => {
    if (ownerStopRequested) return;
    assertGlobalLock(lockPid);
    checkTransport();
    const script = `import os,time,json,hashlib,stat\nfrom pathlib import Path\np=Path(${JSON.stringify(paths.smJob)})\ns=p.lstat();assert stat.S_ISDIR(s.st_mode) and not p.is_symlink() and s.st_uid==os.getuid() and s.st_mode&0o077==0\nq=dict(schema='sm-isolated-owner-stop-v1',inputSha256=${JSON.stringify(hash(smInputBytes))},sessionId=${JSON.stringify(plan.sessionId)},controlOpsSha=${JSON.stringify(input.opsSha)},requestedAtMs=int(time.time()*1000))\nb=(json.dumps(q,separators=(',',':'))+'\\n').encode()\nf=os.open(str(p/'owner-stop-request.json'),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)\nwith os.fdopen(f,'wb') as out:out.write(b)\nprint(json.dumps(dict(sha256=hashlib.sha256(b).hexdigest(),request=q)))`;
    const r = spawnSync('/usr/bin/ssh', [...transportArgs(input.smReceipt).slice(0, -1), 'python3 -c ' + quote(script)], {
      encoding: null,
      timeout: 15000,
      maxBuffer: 65536,
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
    fs.writeFileSync(
      join(paths.job, 'owner-stop.raw.json'),
      JSON.stringify({
        status: r.status,
        signal: r.signal,
        error: r.error?.code || null,
        stdoutBase64: Buffer.from(r.stdout || '').toString('base64'),
        stderrBase64: Buffer.from(r.stderr || '').toString('base64'),
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    if (r.status !== 0 || r.error) throw Error('Own SM stop request failed; original raw retained');
    const reply = JSON.parse(r.stdout);
    if (
      reply.request?.inputSha256 !== hash(smInputBytes) ||
      reply.request?.sessionId !== plan.sessionId ||
      reply.request?.controlOpsSha !== input.opsSha
    )
      throw Error('SM local early stop binding');
    ownerStopRequested = true;
  };
  const startedPath = join(paths.job, 'candidate-started.json');
  const fetchFile = (name) => {
    if (!['candidate-started.json', 'candidate-stopped.json', 'owner-session-ended.json'].includes(name)) throw Error('Exact receipt');
    const raw = remote(
      `import os,stat,base64,json,hashlib\nfrom pathlib import Path\np=Path(${JSON.stringify(paths.smJob + '/' + name)})\nif not p.exists():print(json.dumps(dict(pending=True)))\nelse:\n s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_mode&0o077==0 and s.st_size<=1048576\n b=p.read_bytes();print(json.dumps(dict(bytesBase64=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest())))`,
    );
    const r = JSON.parse(raw);
    if (r.pending) return null;
    const bytes = Buffer.from(r.bytesBase64, 'base64');
    if (bytes.toString('base64') !== r.bytesBase64 || hash(bytes) !== r.sha256) throw Error('Receipt transport bytes');
    return { bytes, value: JSON.parse(bytes) };
  };
  await superviseConcurrent({
    startCandidate: async () => {
      gate();
      checkTransport();
      const fd = fs.openSync(join(paths.job, 'sm-parent.raw.log'), 'wx', 0o600);
      candidate = spawn('/usr/bin/ssh', [...transportArgs(input.smReceipt).slice(0, -1), command], {
        env: { PATH: '/usr/bin:/bin', LANG: 'C' },
        timeout: 960000,
        killSignal: 'SIGTERM',
        stdio: ['ignore', fd, fd],
      });
      candidate.on('error', (e) => {
        error = e;
      });
      candidate.once('close', () => fs.closeSync(fd));
      return candidate;
    },
    waitStarted: async (child) => {
      const end = Math.min(plan.captureExpiresAtMs, Date.now() + 120000);
      while (Date.now() < end) {
        gate();
        if (error || child.exitCode !== null) throw Error('SM candidate exited before ready');
        const r = fetchFile('candidate-started.json');
        if (r) {
          const s = r.value;
          if (
            validatedAttemptSuffix(s.attemptSuffix) !== validatedAttemptSuffix(plan.attemptSuffix) ||
            s.inputSha256 !== hash(smInputBytes) ||
            s.sessionId !== plan.sessionId ||
            s.controlOpsSha !== input.opsSha ||
            s.actor !== 'anonymous' ||
            s.artifactInventorySha256 !== pins.inventory ||
            s.manifestSha256 !== pins.manifest
          )
            throw Error('Actual started source/session binding');
          fs.writeFileSync(startedPath, r.bytes, { flag: 'wx', mode: 0o600 });
          return s;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      throw Error('Candidate startup deadline');
    },
    capture: async () => {
      gate();
      const captureInput = {
        ...plan.capture,
        adapterPath: join(source, 'runtime-adapter.mjs'),
        adapterSha256: plan.sourceHashes['tools/mint-capture/runtime-adapter.mjs'],
        driverSha256: plan.sourceHashes['tools/mint-capture/capture-driver.mjs'],
        policySha256: plan.sourceHashes['tools/mint-capture/capture-policy.mjs'],
        proxySha256: plan.sourceHashes['tools/mint-capture/candidate-capture-proxy.cjs'],
        watchdogSha256: plan.sourceHashes['tools/mint-capture/watchdog.mjs'],
        browserOwnerSha256: plan.sourceHashes['tools/mint-capture/browser-owner.mjs'],
        schema: 'mint-anonymous-batch-capture-v1',
        reviewed: true,
        executionPermission: true,
        globalSlotAcknowledged: true,
        actor: 'anonymous',
        origin,
        pins,
        paths: selected.routes,
        ledgerPaths: selected.ledgerPaths,
        ledgerIds: selected.ledgerIds,
        routeScopes: selected.routeScopes,
        ledgerSha256: plan.ledgerSha256,
        controlOpsSha: input.opsSha,
        controlSourceHashes: plan.sourceHashes,
        newCandidateSessionId: plan.sessionId,
        attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
        expiresAtMs: plan.captureExpiresAtMs,
        candidatePlannedStopAtMs: plan.sessionExpiresAtMs - 120000,
        mintLockPid: lockPid,
        mintLockDev: String(kernel.dev),
        mintLockInode: String(kernel.ino),
        mintLockStartTicks: startTicks,
        mintLockCmdlineSha256: smInput.mintLockCmdlineSha256,
        controllerLeasePath: join(paths.job, 'lease.json'),
        controllerInputSha256: hash(privateBytes(inputPath)),
        controllerPlanSha256: expectedPlanSha,
        controllerDriverSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
        startedReceiptPath: startedPath,
        candidateInputSha256: hash(smInputBytes),
        globalObservationPath: join(paths.job, 'global-observation.json'),
        runtimeRoot: runtime,
      };
      const bytes = Buffer.from(JSON.stringify(captureInput) + '\n'),
        p = join(paths.job, 'capture-input.json');
      fs.writeFileSync(p, bytes, { flag: 'wx', mode: 0o600 });
      await runCapture(p, hash(bytes), join(paths.job, 'capture'));
      requestOwnerStop();
    },
    waitEnded: async (child) => {
      while (child.exitCode === null) {
        gate();
        if (error || Date.now() >= plan.sessionExpiresAtMs + 60000) throw Error('Candidate session failed/deadline');
        await new Promise((r) => setTimeout(r, 500));
      }
      if (child.exitCode !== 0) throw Error('Candidate failed; raw retained');
      const e = fetchFile('owner-session-ended.json'),
        stopped = fetchFile('candidate-stopped.json');
      if (
        !e ||
        !stopped ||
        validatedAttemptSuffix(e.value.attemptSuffix) !== validatedAttemptSuffix(plan.attemptSuffix) ||
        validatedAttemptSuffix(stopped.value.attemptSuffix) !== validatedAttemptSuffix(plan.attemptSuffix) ||
        e.value.inputSha256 !== hash(smInputBytes) ||
        e.value.sessionId !== plan.sessionId ||
        e.value.controlOpsSha !== input.opsSha ||
        e.value.status !== 'owner-session-ended' ||
        e.value.deployEligible !== false ||
        e.value.manifestPublished !== false ||
        e.value.uiReview !== 'not reviewed' ||
        e.value.originalRuntimeUnchanged !== true ||
        e.value.scope !== 'SM isolated candidate supervision ended; no Mint capture or UI review' ||
        e.value.pins?.app !== pins.app ||
        e.value.pins?.ops !== pins.ops ||
        e.value.pins?.build !== pins.build ||
        e.value.pins?.inventory !== pins.inventory ||
        e.value.pins?.manifest !== pins.manifest ||
        Object.keys(e.value.driverPins || {}).length !== 4 ||
        Object.keys(plan.smDriverPins).some((k) => e.value.driverPins[k] !== plan.smDriverPins[k]) ||
        e.value.timing?.hardDeadlineMs !== plan.sessionExpiresAtMs ||
        e.value.timing?.plannedStopAtMs !== plan.sessionExpiresAtMs - 120000 ||
        stopped.value.sessionId !== plan.sessionId ||
        stopped.value.controlOpsSha !== input.opsSha ||
        stopped.value.deployEligible !== false ||
        stopped.value.uiReview !== 'not reviewed' ||
        stopped.value.inputSha256 !== hash(smInputBytes) ||
        stopped.value.originalRuntimeUnchanged !== true
      )
        throw Error('Bound ended/stop receipts');
      fs.writeFileSync(join(paths.job, 'sm-ended.json'), e.bytes, { flag: 'wx', mode: 0o600 });
      return e.value;
    },
    stopCandidate: async (child) => {
      if (child.exitCode === null) {
        let cleanupError;
        try {
          requestOwnerStop();
        } catch (e) {
          cleanupError = e;
        }
        const stopDeadline = Math.min(deadline, Date.now() + 120000);
        while (child.exitCode === null && Date.now() < stopDeadline) await new Promise((r) => setTimeout(r, 250));
        if (child.exitCode === null) {
          child.kill('SIGTERM');
          await new Promise((r) => {
            const t = setTimeout(() => {
              if (child.exitCode === null) child.kill('SIGKILL');
              r();
            }, 2000);
            child.once('close', () => {
              clearTimeout(t);
              r();
            });
          });
          throw cleanupError || Error('Own SM shutdown unconfirmed; own SSH stopped, remote guard/expiry remains authoritative');
        }
        if (cleanupError) throw cleanupError;
        if (child.exitCode !== 0) throw Error('Own SM shutdown returned failure; raw retained');
      }
    },
    verifyUnchanged: async () => immutable(),
    finalGate: async () => gate(),
    writeAcceptance: async () => {
      gate();
      fs.writeFileSync(
        join(paths.job, 'worker-ended.json'),
        JSON.stringify({
          sessionId: plan.sessionId,
          attemptSuffix: validatedAttemptSuffix(plan.attemptSuffix),
          controlOpsSha: input.opsSha,
          inventorySha256: pins.inventory,
          status: 'owner-session-ended',
          inputSha256: hash(privateBytes(inputPath)),
          planSha256: expectedPlanSha,
          deployEligible: false,
        }),
        { flag: 'wx', mode: 0o600 },
      );
    },
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(
    JSON.stringify({
      mode: 'plan-only',
      reviewed: false,
      executionPermission: false,
      globalSlotAcknowledged: false,
      deployEligible: false,
      entry: 'entry.mjs',
    }),
  );
