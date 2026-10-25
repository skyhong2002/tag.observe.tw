// Source-only import. Actual launch requires reviewed external guard and adapter.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { inventory } from '../mint-f1-artifact.js';
import { nativeEligibility } from '../native-elf-proof.js';
import { digest, privateBytes, sourceRoot, validatedAttemptSuffix } from './candidate-contract.mjs';
export const runtimeRoot = '/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/runtime';
export const inventoryPin = 'f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7';
export const manifestPin = '76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0';
export const ports = Object.freeze([
  { host: '127.0.0.1', port: 18131 },
  { host: '127.0.0.1', port: 18195 },
  { host: '100.85.214.25', port: 18196 },
]);
export function forwardingArgs() {
  return [
    '-F',
    '/home/deck/.ssh/config',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=yes',
    '-o',
    'UserKnownHostsFile=/home/deck/.ssh/known_hosts',
    '-o',
    'GlobalKnownHostsFile=/dev/null',
    '-o',
    'ConnectTimeout=5',
    '-o',
    'ConnectionAttempts=1',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ClearAllForwardings=no',
    '-o',
    'ControlMaster=no',
    '-o',
    'ControlPath=none',
    '-o',
    'ControlPersist=no',
    '-o',
    'ForkAfterAuthentication=no',
    '-o',
    'SessionType=none',
    '-o',
    'PermitLocalCommand=no',
    '-o',
    'ForwardAgent=no',
    '-o',
    'ForwardX11=no',
    '-o',
    'ProxyCommand=none',
    '-o',
    'ProxyJump=none',
    '-o',
    'RemoteCommand=none',
    '-o',
    'ServerAliveInterval=5',
    '-o',
    'ServerAliveCountMax=1',
    '-N',
    '-T',
    '-L',
    '127.0.0.1:18131:127.0.0.1:18131',
    'Mint-MBP',
  ];
}
export function verifyEffectiveForwarding(text, input) {
  const rows = text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [key, ...values] = line.trim().split(/\s+/);
      return { key, value: values.join(' ') };
    });
  const values = (key) => rows.filter((r) => r.key === key).map((r) => r.value);
  const local = values('localforward');
  if (
    local.length !== 1 ||
    !/^\[?127\.0\.0\.1\]?:18131 \[?127\.0\.0\.1\]?:18131$/.test(local[0]) ||
    values('remoteforward').some((v) => v !== 'none') ||
    values('dynamicforward').some((v) => v !== 'none')
  )
    throw Error('Only exact single loopback forwarding permitted');
  for (const [key, allowed] of Object.entries({
    hostname: [input.sshEffectiveHostName],
    user: [input.sshEffectiveUser],
    batchmode: ['yes'],
    stricthostkeychecking: ['yes', 'true'],
    exitonforwardfailure: ['yes'],
    clearallforwardings: ['no'],
    controlmaster: ['false', 'no'],
    controlpersist: ['no', '0'],
    forwardagent: ['no'],
    forwardx11: ['no'],
    permitlocalcommand: ['no'],
    forkafterauthentication: ['no'],
    sessiontype: ['none'],
    requesttty: ['false', 'no'],
  }))
    if (values(key).length !== 1 || !allowed.includes(values(key)[0])) throw Error('Effective SSH policy differs: ' + key);
  for (const key of ['controlpath', 'proxycommand', 'proxyjump', 'remotecommand'])
    if (values(key).some((value) => value !== 'none')) throw Error('Unexpected effective SSH proxy/multiplex/command');
  return true;
}
export function candidatePlan(input, config) {
  if (
    config.bindIp !== '100.85.214.25' ||
    config.port !== 18196 ||
    config.apiOrigin !== 'http://127.0.0.1:18131' ||
    config.nextOrigin !== 'http://127.0.0.1:18195' ||
    config.actor !== 'anonymous' ||
    config.allowMutations !== false ||
    config.expiresAt !== input.expiresAtMs
  )
    throw Error('Fixed SM fixture frontdoor read-only batch required');
  if (config.actor !== 'anonymous' && (typeof config.batchSecret !== 'string' || !/^[a-f0-9]{64}$/.test(config.batchSecret)))
    throw Error('Private fixture batch secret required');
  return [
    {
      name: 'tunnel',
      bin: '/usr/bin/ssh',
      args: forwardingArgs(),
      cwd: sourceRoot,
      env: { PATH: '/usr/bin:/bin', HOME: '/home/deck', LANG: 'C' },
    },
    {
      name: 'next',
      bin: '/home/deck/.local/bin/node',
      args: [join(runtimeRoot, 'web/.next/standalone/web/server.js')],
      cwd: join(runtimeRoot, 'web/.next/standalone/web'),
      env: {
        PATH: '/usr/bin:/bin',
        HOME: '/nonexistent',
        LANG: 'C',
        NODE_ENV: 'production',
        TAG_API_ORIGIN: 'http://127.0.0.1:18131',
        HOSTNAME: '127.0.0.1',
        PORT: '18195',
        DNT: '1',
        UV_THREADPOOL_SIZE: '2',
        VIPS_CONCURRENCY: '1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
    {
      name: 'frontdoor',
      bin: '/home/deck/.local/bin/node',
      args: [join(sourceRoot, '../mint-fixture-frontdoor.js'), input.frontdoorConfigPath],
      cwd: sourceRoot,
      env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', LANG: 'C', NODE_ENV: 'production', DNT: '1' },
    },
  ];
}
export function verifyReadiness(status, body, input) {
  if (
    status !== 200 ||
    body.machineId !== 'f80413057e6d4a179e248e5f8c08cac6' ||
    body.appSha !== input.appSha ||
    body.scope !== 'mint-f1-isolated' ||
    body.databaseScope !== 'isolated' ||
    body.productionDatabase !== false ||
    body.isolationReceiptId !== input.isolationReceiptId
  )
    throw Error('Actual forwarded API isolation/source/readiness mismatch');
  return true;
}
export function verifyRuntime(input) {
  if (fs.realpathSync(runtimeRoot) !== runtimeRoot || !fs.lstatSync(runtimeRoot).isDirectory())
    throw Error('Canonical unchanged runtime required');
  const bytes = privateBytes(join(runtimeRoot, 'mint-artifact.json'), 16 * 1024 * 1024);
  if (digest(bytes) !== manifestPin) throw Error('Pinned original manifest differs');
  const manifest = JSON.parse(bytes);
  if (
    manifest.appSha !== input.appSha ||
    manifest.opsSha !== input.opsSha ||
    manifest.buildId !== 'PmjYScQDDoJKBr43SLkhd' ||
    manifest.inventorySha256 !== inventoryPin ||
    digest(JSON.stringify(inventory(runtimeRoot))) !== inventoryPin
  )
    throw Error('Whole original runtime bytes/modes/links differ');
  const receiptBytes = privateBytes(input.nativeReceiptPath);
  if (digest(receiptBytes) !== input.nativeReceiptSha256) throw Error('Reviewed actual native receipt differs');
  const result = JSON.parse(receiptBytes);
  if (
    result.preInventorySha256 !== inventoryPin ||
    result.postInventorySha256 !== inventoryPin ||
    result.manifestSha256 !== manifestPin ||
    result.wholeRuntimeUnchanged !== true
  )
    throw Error('Prior actual SM native receipt not immutable-bound');
  nativeEligibility(manifest, manifest.nativeElfProof, result.receipt);
  return true;
}
export async function checkExactPorts({ create = createServer } = {}) {
  for (const endpoint of ports)
    await new Promise((done, fail) => {
      const server = create();
      server.once('error', fail);
      server.listen(endpoint.port, endpoint.host, () => server.close((error) => (error ? fail(error) : done())));
    });
}
export function listenerOwned(tcpRows, fdTargets, { host, port, pid, uid }) {
  const hex =
    host
      .split('.')
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .reverse()
      .join('')
      .toUpperCase() +
    ':' +
    port.toString(16).padStart(4, '0').toUpperCase();
  return (
    Number.isInteger(pid) &&
    pid > 0 &&
    tcpRows.split('\n').some((line) => {
      const f = line.trim().split(/\s+/);
      return f[1] === hex && f[3] === '0A' && Number(f[7]) === uid && fdTargets.includes('socket:[' + f[9] + ']');
    })
  );
}
export function assertOwnedListener(child, endpoint) {
  if (!child.pid || child.exitCode !== null) throw Error('Own service exited');
  const folder = '/proc/' + child.pid + '/fd';
  const links = [];
  for (const name of fs.readdirSync(folder)) {
    try {
      links.push(fs.readlinkSync(join(folder, name)));
    } catch (e) {
      if (!['ENOENT', 'ESRCH'].includes(e.code)) throw e;
    }
  }
  if (!listenerOwned(fs.readFileSync('/proc/net/tcp', 'utf8'), links, { ...endpoint, pid: child.pid, uid: process.getuid() }))
    throw Error('Candidate listener not owned by own exact process/address');
}
export async function forwardedReadiness(input) {
  const response = await fetch('http://127.0.0.1:18131/internal/mint-f1-readiness', {
    headers: { DNT: '1', Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(3000),
  });
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 65536) throw Error('Readiness body too large');
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  verifyReadiness(response.status, JSON.parse(text), input);
  return { status: response.status, bodySha256: digest(text), isolationReceiptId: input.isolationReceiptId };
}
export function effectiveSsh(input) {
  const r = spawnSync('/usr/bin/ssh', ['-G', ...forwardingArgs()], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 65536,
    env: { PATH: '/usr/bin:/bin', HOME: '/home/deck', LANG: 'C' },
  });
  if (r.error || r.status !== 0) throw Error('Offline effective SSH config unavailable');
  verifyEffectiveForwarding(r.stdout, input);
  return { sha256: digest(r.stdout), raw: r.stdout };
}

export function validateRuntime(runtime, machine) {
  if (
    machine !== '302c2528bd464ad0953cf5fa743b6171' ||
    runtime.platform !== 'linux' ||
    runtime.arch !== 'x64' ||
    runtime.versions.node !== '24.15.0' ||
    runtime.versions.modules !== '137' ||
    runtime.report.getReport().header.glibcVersionRuntime !== '2.41'
  )
    throw Error('Actual SM runtime differs');
}
export function validateSample(sample, { starting = false, now = Date.now() } = {}) {
  const GiB = 1024 ** 3;
  if (
    sample.machineId !== '302c2528bd464ad0953cf5fa743b6171' ||
    sample.dnt !== '1' ||
    !Number.isFinite(sample.finishedAtMs) ||
    sample.finishedAtMs > now ||
    now - sample.finishedAtMs > 30000 ||
    sample.probeError ||
    !Number.isFinite(sample.load1) ||
    sample.load1 < 0 ||
    sample.load1 > 12 ||
    !Number.isFinite(sample.homeAvailableBytes) ||
    sample.homeAvailableBytes < (starting ? 40 : 30) * GiB ||
    (starting && sample.homeAvailableBytes - 0.05 * GiB < 30 * GiB)
  )
    throw Error('Fresh actual SM candidate resources required');
  for (const [url, cap] of [
    ['https://tag.observe.tw/', 2],
    ['https://blog.observe.tw/', 6.17],
    ['https://youtube.observe.tw/', 2],
  ]) {
    const rows = sample.sites?.filter((x) => x.url === url);
    if (
      rows?.length !== 1 ||
      rows[0].exitCode !== 0 ||
      rows[0].status !== 200 ||
      !Number.isFinite(rows[0].total) ||
      rows[0].total < 0 ||
      rows[0].total > cap
    )
      throw Error('Actual SM candidate service gate failed');
  }
}

export function candidateTiming(expiresAtMs, now = Date.now()) {
  const cleanupReserveMs = 120000,
    plannedStopAtMs = expiresAtMs - cleanupReserveMs;
  if (!Number.isFinite(expiresAtMs) || plannedStopAtMs - now < 60000) throw Error('Insufficient healthy candidate startup/cleanup window');
  return { plannedStopAtMs, hardDeadlineMs: expiresAtMs, cleanupReserveMs };
}
export function outerGuardedInvocation(workerArgs) {
  return { bin: '/usr/bin/ionice', args: ['-c', '3', '/usr/bin/nice', '-n', '19', '/home/deck/.local/bin/node', ...workerArgs] };
}

export const candidateReceiptPins = Object.freeze({
  app: '677a0c793eeda0c4d850c81ac574c95508d08e0a',
  ops: 'c70425b007bdac9fdbef62b935811ee0d7f30d18',
  build: 'PmjYScQDDoJKBr43SLkhd',
  inventory: inventoryPin,
  manifest: manifestPin,
});
export function candidateReceiptBinding(input, inputSha256) {
  if (!/^[a-f0-9]{64}$/.test(inputSha256 || '') || input.appSha !== candidateReceiptPins.app || input.opsSha !== candidateReceiptPins.ops)
    throw Error('Fixed input/artifact receipt identity required');
  return {
    sessionId: input.sessionId,
    attemptSuffix: validatedAttemptSuffix(input.attemptSuffix),
    controlOpsSha: input.controlOpsSha,
    inputSha256,
    driverPins: { ...input.driverPins },
    pins: { ...candidateReceiptPins },
  };
}
export function verifyOwnerSessionReceipt(receipt, input, inputSha256) {
  const expected = candidateReceiptBinding(input, inputSha256);
  const exactMap = (actual, map) =>
    actual && Object.keys(actual).length === Object.keys(map).length && Object.keys(map).every((key) => actual[key] === map[key]);
  if (
    (receipt.attemptSuffix ?? '') !== expected.attemptSuffix ||
    receipt.sessionId !== expected.sessionId ||
    receipt.controlOpsSha !== expected.controlOpsSha ||
    receipt.inputSha256 !== expected.inputSha256 ||
    !exactMap(receipt.driverPins, expected.driverPins) ||
    !exactMap(receipt.pins, expected.pins) ||
    receipt.status !== 'owner-session-ended' ||
    receipt.scope !== 'SM isolated candidate supervision ended; no Mint capture or UI review' ||
    receipt.deployEligible !== false ||
    receipt.manifestPublished !== false ||
    receipt.uiReview !== 'not reviewed' ||
    receipt.originalRuntimeUnchanged !== true ||
    receipt.timing?.cleanupReserveMs !== 120000
  )
    throw Error('Candidate ended receipt input/source/artifact/scope mismatch');
  return true;
}

export async function stopBeforeCheckpoint(stop, checkpoint) {
  await stop();
  return checkpoint('planned-stop');
}

export async function stopOwnChildren(children, { killOwn, wait, record }) {
  const errors = [];
  const alive = (c) => c.exitCode === null && c.signalCode === null;
  const audit = (entry) => {
    try {
      record(entry);
    } catch (error) {
      errors.push(error);
    }
  };
  const signal = (kind) => {
    for (const child of children) {
      if (!alive(child)) continue;
      try {
        const outcome = killOwn(child, kind);
        audit({
          event: kind === 'SIGTERM' ? 'own-term-requested' : 'own-kill-requested',
          outcome,
          pid: child.pid,
          startTicks: child.ownStartTicks,
        });
      } catch (error) {
        errors.push(error);
        audit({ event: 'own-signal-error', signal: kind, pid: child.pid, startTicks: child.ownStartTicks, message: error.message });
      }
    }
  };
  signal('SIGTERM');
  try {
    await wait(3000);
  } catch (error) {
    errors.push(error);
  }
  signal('SIGKILL');
  try {
    await wait(2000);
  } catch (error) {
    errors.push(error);
  }
  const confirmed = children.every((c) => !alive(c));
  audit({
    event: confirmed ? 'own-exits-confirmed' : 'own-exits-unconfirmed',
    children: children.map((c) => ({ pid: c.pid, startTicks: c.ownStartTicks, exitCode: c.exitCode, signalCode: c.signalCode })),
  });
  if (!confirmed) errors.push(Error('Own candidate shutdown not confirmed'));
  if (errors.length) throw new AggregateError(errors, 'Own child cleanup failed; all children attempted');
}

// The actual SM parent timer has an elapsed upper bound independent of wall-clock changes.
export const candidateMaximumElapsedMs = 900000;
export const candidateMonotonicMs = () => Number(process.hrtime.bigint() / 1000000n);
export function armCandidateTimer(
  expiresAtMs,
  onExpired,
  { wallNow = Date.now, monotonicNow = candidateMonotonicMs, setTimer = setTimeout } = {},
) {
  const wallObservedAtMs = wallNow(),
    armedMonoMs = monotonicNow();
  if (
    !Number.isFinite(expiresAtMs) ||
    !Number.isFinite(wallObservedAtMs) ||
    !Number.isFinite(armedMonoMs) ||
    armedMonoMs < 0 ||
    typeof onExpired !== 'function'
  )
    throw Error('Actual candidate elapsed deadline required');
  const delayMs = Math.max(1, Math.min(candidateMaximumElapsedMs, expiresAtMs - wallObservedAtMs));
  const timer = setTimer(onExpired, delayMs);
  return Object.freeze({
    timer,
    delayMs,
    wallObservedAtMs,
    armedMonoMs,
    deadlineMonoMs: armedMonoMs + delayMs,
    maximumMs: candidateMaximumElapsedMs,
  });
}
export function candidateTimerExpired(state, { monotonicNow = candidateMonotonicMs } = {}) {
  if (
    state?.maximumMs !== candidateMaximumElapsedMs ||
    !Number.isFinite(state.armedMonoMs) ||
    !Number.isFinite(state.deadlineMonoMs) ||
    state.deadlineMonoMs - state.armedMonoMs < 1 ||
    state.deadlineMonoMs - state.armedMonoMs > candidateMaximumElapsedMs
  )
    throw Error('Fixed900s elapsed timer state required');
  return monotonicNow() >= state.deadlineMonoMs;
}
