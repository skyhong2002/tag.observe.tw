import { deriveRuntimePackage } from './mint-f1-runtime-package.js';
import { probeSmRelay, relayGate } from './mint-f1-sm-relay.js';
import { collectElfProof } from './native-elf-proof.js';
// Mint-only candidate preparation. Default CLI is plan-only; never deploys.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, lstatSync, mkdirSync, appendFileSync, writeFileSync, statfsSync, openSync, closeSync } from 'node:fs';
import { loadavg } from 'node:os';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyHost, validateReceipt } from './mint-f1-host-adapter.js';
import { probeSM, smGate } from './mint-f1-sm-adapter.js';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import { runStage, competingBuilds } from './prepare-f1-candidate.js';
import { guardedBuild } from './guard-next-build.js';
import { sourceReceiptFromGit, createArtifactManifest } from './mint-f1-artifact.js';
export const globalLockPath = '/run/lock/mint-global-build.lock';
const modulePaths = ['mint-f1-runtime-package.js', 'mint-f1-sm-relay.js', 'native-elf-proof.js', 'mint-f1-execution.js', 'mint-f1-artifact.js', 'mint-f1-host-adapter.js', 'mint-f1-sm-adapter.js', 'mint-f1-candidate-plan.js', 'prepare-f1-candidate.js', 'guard-next-build.js', 'shared-host-baseline.cjs'].map(p => `tools/${p}`);
function command(bin, args, cwd, env = { PATH: '/usr/bin:/bin', LANG: 'C' }) {
  const result = spawnSync(bin, args, { cwd, env, encoding: 'utf8', maxBuffer: 512 * 1024 ** 2 });
  if (result.error || result.status !== 0) throw new Error(`${bin} failed (${result.error?.message || result.status})`);
  return result.stdout;
}
// Stream both child outputs to the private audit log before checking exit status.
// Do not interpolate compiler output or environment values into error messages.
export function loggedStageCommand(bin, args, cwd, env, log, run = spawnSync,
  io = { openSync, closeSync }) {
  if (!isAbsolute(log || '')) throw new Error('Absolute private stage log required');
  const fd = io.openSync(log, 'a', 0o600);
  try {
    const result = run(bin, args, { cwd, env, stdio: ['ignore', fd, fd] });
    if (result.error || result.status !== 0) throw new Error(`Stage command failed (${result.error ? 'spawn error' : result.status}); see private stage log`);
    return '';
  } finally { io.closeSync(fd); }
}
export function readPrivateInput(path, io = { lstatSync, readFileSync }, uid = process.getuid()) {
  const stat = io.lstatSync(path);
  if (!stat.isFile() || stat.uid !== uid || (stat.mode & 0o077)) throw new Error('Current-owner private regular execution input required');
  return JSON.parse(io.readFileSync(path, 'utf8'));
}
export function validateExecutionInput(input) {
  const only = (object, names) => {
    if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(key => !names.includes(key))) throw new Error('Unexpected execution input fields; credentials are forbidden');
  };
  only(input, ['appSha', 'opsSha', 'repo', 'candidate', 'estimateGiB', 'hostReceipt', 'smReceipt']);
  only(input.hostReceipt, ['schema', 'reviewed', 'mintReady', 'globalBuildSlot', 'reviewReceiptId', 'slotReceiptId', 'executionReviewed', 'executionReviewReceiptId', 'globalLockPath', 'expiresAt', 'smMachineId', 'mint', 'noninteractivePath', 'api', 'smAbi', 'nativePolicy']);
  only(input.hostReceipt.nativePolicy, ['schema', 'reviewed', 'buildAllowed', 'strategy', 'reviewReceiptId', 'maxGlibcRequired']);
  only(input.hostReceipt.mint, ['machineId', 'hostname', 'platform', 'arch', 'cpuCount', 'nodeVersion', 'nodeModulesAbi', 'libc', 'nodePath', 'npmPath', 'npmVersion']);
  only(input.hostReceipt.api, ['origin', 'isolatedDatabase', 'productionDatabase', 'machineId', 'isolationReceiptId']);
  only(input.hostReceipt.smAbi, ['platform', 'arch', 'nodeModulesAbi', 'libc']);
  only(input.smReceipt, ['schema', 'reviewed', 'reviewReceiptId', 'slotReceiptId', 'globalBuildSlot', 'expiresAt', 'host', 'user', 'port', 'smMachineId', 'mintMachineId', 'knownHostsPath', 'knownHostsSha256', 'transportMode', 'authorization', 'channel', 'channelReceiptId', 'relayPath']);
  if (![undefined, 'ssh', 'sm-origin-relay'].includes(input.smReceipt.transportMode)) throw new Error('Unsupported reviewed SM transport mode');
  if (!Number.isFinite(input.estimateGiB) || input.estimateGiB <= 0 || !isAbsolute(input.repo || '') || !isAbsolute(input.candidate || '')) throw new Error('Absolute isolated paths and positive estimate required');
  return input;
}
export function safeEnvironment(verified, candidate) {
  // Next excludes a workspace root containing HOME. Use an exclusive sibling
  // instead, so the root lockfile and app/ imports remain within its boundary.
  return { PATH: verified.receipt.noninteractivePath, HOME: `${resolve(candidate)}.home`, LANG: 'C', NODE_ENV: 'production',
    TAG_API_ORIGIN: verified.apiOrigin, NEXT_TELEMETRY_DISABLED: '1', NPM_CONFIG_UPDATE_NOTIFIER: 'false', NPM_CONFIG_CACHE: join(candidate, '.npm-cache') };
}
export function verifySource(input, run = command, read = readFileSync) {
  if (resolve(input.repo, 'tools/mint-f1-execution.js') !== new URL(import.meta.url).pathname) throw new Error('OPS checkout must contain the executing module');
  if (input.appSha !== initialAppSha || !/^[a-f0-9]{40}$/.test(input.opsSha || '')) throw new Error('Exact APP/OPS SHA required');
  run('git', ['fetch', 'origin'], input.repo);
  if (run('git', ['status', '--porcelain', '--untracked-files=all'], input.repo).trim()) throw new Error('Fully clean source required');
  if (run('git', ['rev-parse', 'HEAD'], input.repo).trim() !== input.opsSha) throw new Error('Checkout must exactly match OPS_SHA');
  run('git', ['merge-base', '--is-ancestor', 'origin/main', input.appSha], input.repo);
  for (const path of modulePaths) if (run('git', ['show', `${input.opsSha}:${path}`], input.repo) !== read(join(input.repo, path), 'utf8')) throw new Error(`OPS module blob mismatch: ${path}`);
  const config = run('git', ['show', `${input.appSha}:web/next.config.ts`], input.repo);
  if (!/cpus:\s*2\s*,/.test(config) || !/staticGenerationMaxConcurrency:\s*1\s*,/.test(config)) throw new Error('Bounded Next concurrency required');
  return true;
}
export async function verifyIsolatedApi(input, verified, fetchApi = fetch) {
  const origin = verified.apiOrigin;
  if (origin !== input.hostReceipt.api.origin) throw new Error('API origin receipt mismatch');
  const response = await fetchApi(new URL('/internal/mint-f1-readiness', origin), { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Isolated API readiness unavailable');
  if (!response.body || typeof response.body.getReader !== 'function') throw new Error('Bounded readiness body stream required');
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8192) { await reader.cancel(); throw new Error('Oversized readiness response'); }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally { reader.releaseLock(); }
  const data = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
  if (data.machineId !== verified.snapshot.machineId || data.appSha !== initialAppSha || data.scope !== 'mint-f1-isolated'
    || data.databaseScope !== 'isolated' || data.productionDatabase !== false || data.isolationReceiptId !== input.hostReceipt.api.isolationReceiptId) throw new Error('Isolated API/database readiness identity mismatch');
  return true;
}
export function assertGlobalLock(pid, io = { lstatSync, readFileSync }) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Held global lock process required');
  const stat = io.lstatSync(globalLockPath);
  if (!stat.isFile() || stat.isSymbolicLink?.()) throw new Error('Common lock must be an existing regular non-symlink file');
  const dev = BigInt(stat.dev); const major = Number(((dev >> 8n) & 0xfffn) | ((dev >> 32n) & 0xfffff000n));
  const minor = Number((dev & 0xffn) | ((dev >> 12n) & 0xffffff00n));
  const found = io.readFileSync('/proc/locks', 'utf8').split('\n').some(line => {
    const fields = line.trim().split(/\s+/); const device = (fields[5] || '').split(':');
    return fields[1] === 'FLOCK' && fields[3] === 'WRITE' && Number(fields[4]) === pid
      && parseInt(device[0], 16) === major && parseInt(device[1], 16) === minor && device[2] === String(stat.ino);
  });
  if (!found) throw new Error('No kernel-confirmed common lock held by candidate holder');
  return true;
}
export async function acquireGlobalLock(input, spawnLock = spawn, io = { lstatSync, readFileSync }, timers = { setTimeout, clearTimeout }) {
  if (input.hostReceipt.globalLockPath !== globalLockPath) throw new Error('Reviewed common Mint host-wide lock required');
  const metadata = io.lstatSync(globalLockPath);
  if (!metadata.isFile() || metadata.isSymbolicLink?.()) throw new Error('Common lock must be a provisioned regular file');
  const child = spawnLock('/usr/bin/flock', ['-n', '-F', '--', globalLockPath, input.hostReceipt.mint.nodePath, '-e', "process.stdout.write('LOCKED\\n');process.stdin.resume();"], { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', LANG: 'C' } });
  let alive = true;
  child.stdin.on?.('error', () => {}); // EOF/closed-pipe races are handled by bounded release.
  child.once('close', () => { alive = false; });
  const handle = { pid: child.pid, alive: () => alive, release: () => new Promise((done, reject) => {
    if (!alive) return done();
    const pending = [];
    const finish = error => { pending.forEach(timer => timers.clearTimeout(timer)); if (error) reject(error); else done(); };
    child.once('close', () => finish());
    pending.push(timers.setTimeout(() => {
      if (!alive) return;
      child.kill('SIGTERM'); // Only the holder spawned by this adapter.
      pending.push(timers.setTimeout(() => {
        if (!alive) return;
        child.kill('SIGKILL');
        pending.push(timers.setTimeout(() => { if (alive) finish(new Error('Own lock holder was not reaped')); }, 1000));
      }, 1000));
    }, 5000));
    child.stdin.end();
  }) };
  try {
  await new Promise((done, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Global lock timeout')); }, 5000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', () => { clearTimeout(timer); reject(new Error('Global lock unavailable')); });
    child.stdout.once('data', bytes => { clearTimeout(timer); if (bytes.toString() === 'LOCKED\n') done(); else { child.kill(); reject(new Error('Invalid lock acknowledgement')); } });
  });
  assertGlobalLock(child.pid, io);
  } catch (error) { await handle.release(); throw error; }
  return handle;
}
export function mintSample(candidateParent, ownGroup = 0, io = { statfsSync, readFileSync }, scan = competingBuilds, load = loadavg) {
  const disk = io.statfsSync(candidateParent);
  const foreign = scan().filter(entry => {
    const stat = io.readFileSync(`/proc/${entry.pid}/stat`, 'utf8');
    const group = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[2]);
    return group !== ownGroup;
  });
  return { mintLoad1: load()[0], mintAvailableBytes: Number(disk.bavail) * Number(disk.bsize), localMintBuildCount: foreign.length };
}
export function combineGates(sm, mint, input, options) {
  const smResult = input.smReceipt.transportMode === 'sm-origin-relay' ? relayGate(sm, input.smReceipt, options) : smGate(sm, input.smReceipt, options);
  if (smResult !== 'run') return smResult;
  if (!mint || !Number.isFinite(mint.mintLoad1) || mint.mintLoad1 < 0 || mint.mintLoad1 > 12
    || mint.localMintBuildCount !== 0 || !Number.isFinite(mint.mintAvailableBytes)
    || mint.mintAvailableBytes < 30 * 1024 ** 3
    || (options.starting && mint.mintAvailableBytes - input.estimateGiB * 1024 ** 3 < 30 * 1024 ** 3)) return 'pause';
  if (options.paused && (mint.mintLoad1 >= 10 || mint.mintAvailableBytes < 40 * 1024 ** 3)) return 'wait';
  return 'run';
}
export async function stage(input, dependencies = {}, lockPid = 0, privateInputPath = '') {
  validateExecutionInput(input);
  if (!isAbsolute(privateInputPath)) throw new Error('Stage private receipt path required');
  const privateInput = (dependencies.readPrivateInput || readPrivateInput)(privateInputPath);
  if (JSON.stringify(privateInput) !== JSON.stringify(input)) throw new Error('Stage private receipt/input mismatch');
  validateReceipt(input.hostReceipt);
  if (input.hostReceipt.executionReviewed !== true || typeof input.hostReceipt.executionReviewReceiptId !== 'string' || !input.hostReceipt.executionReviewReceiptId.trim()) throw new Error('Current execution review receipt required');
  (dependencies.assertLock || assertGlobalLock)(lockPid);
  const host = await (dependencies.verifyHost || verifyHost)({ receipt: input.hostReceipt, candidateParent: dirname(input.candidate), estimateGiB: input.estimateGiB });
  const verified = { ...host, receipt: input.hostReceipt };
  await (dependencies.verifyApi || verifyIsolatedApi)(input, verified);
  (dependencies.verifySource || verifySource)(input);
  const env = safeEnvironment(verified, input.candidate);
  const run = dependencies.runCommand || ((bin, args, cwd, _env, log) => {
    if (bin === 'npm') {
      const npmArgs = cwd === join(input.candidate, 'web') ? [...args, '--include=dev'] : args;
      return loggedStageCommand(verified.snapshot.nodePath, [verified.snapshot.npmPath, ...npmArgs], cwd, env, log);
    }
    return loggedStageCommand(bin, args, cwd, env, log);
  });
  // Ignore runStage's inherited process.env argument: only verified safe env above.
  (dependencies.runStage || runStage)({ repo: input.repo, candidate: input.candidate, api: verified.apiOrigin }, initialAppSha, (bin, args, cwd, log, _inherited) => {
    (dependencies.stageRecord || ((entry) => appendFileSync(join(input.candidate, 'mint-stage.jsonl'), JSON.stringify(entry) + '\n', { mode: 0o600 })))({ event: 'stage', bin, args, appSha: initialAppSha, opsSha: input.opsSha });
    (dependencies.assertLock || assertGlobalLock)(lockPid);
    const output = run(bin, args, cwd, env, log);
    (dependencies.appendLog || ((path, value) => appendFileSync(path, value, { mode: 0o600 })))(log, `${output || ''}\n`);
    return output;
  });
  (dependencies.assertLock || assertGlobalLock)(lockPid);
  run(verified.snapshot.nodePath, ['-e', "require('sharp');require('onnxruntime-node');"], input.candidate, env, join(input.candidate, 'stage.log'));
  return (dependencies.deriveRuntime || deriveRuntimePackage)(input.candidate, `${input.candidate}.runtime`, { apiOrigin: verified.apiOrigin, assertLock: () => (dependencies.assertLock || assertGlobalLock)(lockPid) });
}
export async function executeCandidate(input, dependencies = {}) {
  validateExecutionInput(input);
  validateReceipt(input.hostReceipt);
  if (input.hostReceipt.executionReviewed !== true || typeof input.hostReceipt.executionReviewReceiptId !== 'string' || !input.hostReceipt.executionReviewReceiptId.trim()) throw new Error('Execution wiring independent review receipt required');
  if (input.smReceipt.smMachineId !== input.hostReceipt.smMachineId || input.smReceipt.mintMachineId !== input.hostReceipt.mint.machineId
    || input.smReceipt.slotReceiptId !== input.hostReceipt.slotReceiptId) throw new Error('Cross-host identity/slot receipt mismatch');
  const candidate = resolve(input.candidate); const repo = resolve(input.repo);
  const rel = relative(repo, candidate);
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('New candidate must be outside source checkout');
  const host = await (dependencies.verifyHost || verifyHost)({ receipt: input.hostReceipt, candidateParent: dirname(candidate), estimateGiB: input.estimateGiB });
  const verified = { ...host, receipt: input.hostReceipt };
  await (dependencies.verifyApi || verifyIsolatedApi)(input, verified);
  (dependencies.verifySource || verifySource)(input);
  const source = (dependencies.sourceReceipt || sourceReceiptFromGit)(repo);
  const lock = await (dependencies.acquireLock || acquireGlobalLock)(input);
  const io = dependencies.io || { mkdirSync, appendFileSync, writeFileSync };
  try {
    if (!Number.isInteger(lock.pid) || lock.pid <= 0) throw new Error('Kernel lock holder identity required');
    io.mkdirSync(candidate, { mode: 0o700 }); // Exclusive; never delete or overwrite artifacts.
    io.mkdirSync(`${candidate}.home`, { mode: 0o700 });
    const stageInput = { ...input, candidate };
    const privateStagePath = join(candidate, 'mint-execution-input.json');
    io.writeFileSync(privateStagePath, JSON.stringify(stageInput) + '\n', { flag: 'wx', mode: 0o600 });
    let group = 0; let paused = false; let fatalError;
    const record = entry => { if (entry.event === 'started') group = entry.processGroup; if (entry.event === 'probe') paused = entry.decision !== 'run'; io.appendFileSync(join(candidate, 'mint-guard.jsonl'), JSON.stringify(entry) + '\n', { mode: 0o600 }); };
    const env = safeEnvironment(verified, candidate);
    const code = await (dependencies.guard || guardedBuild)({ command: verified.snapshot.nodePath,
      args: ['--input-type=module', '-e', `import {stage} from ${JSON.stringify(import.meta.url)}; await stage(JSON.parse(process.argv[1]), {}, ${lock.pid}, ${JSON.stringify(privateStagePath)});`, JSON.stringify({ ...input, candidate })], cwd: repo, estimatedUsageGiB: input.estimateGiB, record,
      spawnBuild: (bin, args, options) => (dependencies.spawnBuild || spawn)(bin, args, { ...options, env }),
      probe: async () => {
        try {
          if (!lock.alive()) throw new Error('Global lock holder lost');
          (dependencies.assertLock || assertGlobalLock)(lock.pid);
        } catch (error) {
          fatalError = error;
          record({ event: 'fatal-lock-loss', message: error.message });
          // The existing guard owns SIGTERM and ends only its dedicated child
          // group, including its pre-start state. No other host job is signalled.
          (dependencies.abortGuard || (() => process.emit('SIGTERM')))();
          return { sites: [], probeError: 'Fatal global lock loss' };
        }
        await (dependencies.verifyApi || verifyIsolatedApi)(input, verified);
        const sm = await (dependencies.probeSM || (input.smReceipt.transportMode === 'sm-origin-relay' ? probeSmRelay : probeSM))({ receipt: input.smReceipt });
        const mint = (dependencies.mintSample || mintSample)(dirname(candidate), group);
        const decision = lock.alive() ? combineGates(sm, mint, input, { starting: group === 0, paused, estimatedUsageGiB: input.estimateGiB }) : 'pause';
        // Existing guard can pause/wait while keeping SM load/disk untouched.
        return { ...sm, mint, ...(decision !== 'run' ? { probeError: `Mint/SM gate: ${decision}` } : {}) };
      } });
    if (fatalError) throw new Error(`Fatal global lock loss: ${fatalError.message}; candidate retained`);
    if (code !== 0) throw new Error(`Candidate failed (${code}); retained for inspection`);
    if (!lock.alive()) throw new Error('Global lock lost');
    (dependencies.assertLock || assertGlobalLock)(lock.pid);
    const runtimeRoot = `${candidate}.runtime`;
    const artifact = (dependencies.artifactFactory || createArtifactManifest)(runtimeRoot, { ...source, opsSha: input.opsSha, platform: host.snapshot.platform, arch: host.snapshot.arch,
      nodeVersion: host.snapshot.nodeVersion, nodeModulesAbi: host.snapshot.nodeModulesAbi, libc: host.snapshot.libc, smAbi: input.hostReceipt.smAbi,
      nativePolicy: input.hostReceipt.nativePolicy, nativeTargetRuntime: { machineId: input.hostReceipt.smMachineId, ...input.hostReceipt.smAbi }, sourceVerified: true, sourceReceiptId: input.hostReceipt.executionReviewReceiptId });
    artifact.nativeElfProof = (dependencies.elfProof || collectElfProof)(runtimeRoot, artifact);
    try {
      if (!lock.alive()) throw new Error('Global lock holder lost during artifact hashing');
      (dependencies.assertLock || assertGlobalLock)(lock.pid);
    } catch (error) {
      record({ event: 'fatal-post-artifact-lock-loss', message: error.message });
      throw new Error('Global lock lost during artifact hashing; candidate retained without final artifact');
    }
    await (dependencies.verifyApi || verifyIsolatedApi)(input, verified);
    const finalSm = await (dependencies.probeSM || (input.smReceipt.transportMode === 'sm-origin-relay' ? probeSmRelay : probeSM))({ receipt: input.smReceipt });
    const finalMint = (dependencies.mintSample || mintSample)(dirname(candidate), 0);
    if (combineGates(finalSm, finalMint, input, { starting: false, paused: false, estimatedUsageGiB: input.estimateGiB }) !== 'run') throw new Error('Fresh final Mint/SM gate failed; no final artifact');
    (dependencies.assertLock || assertGlobalLock)(lock.pid);
    if (!lock.alive()) throw new Error('Global lock lost before final artifact publication');
    io.writeFileSync(join(runtimeRoot, 'mint-artifact.json'), JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return artifact;
  } finally { await lock.release(); }
}
export async function main(argv = process.argv.slice(2)) {
  if (!argv.length || argv[0] === '--plan') { console.log(JSON.stringify({ status: 'plan-only', execution: 'Requires reviewed private current Mint-ready/slot/identity/API/OPS source receipts; no deployment', validationScope: 'Native smoke only loads sharp/onnx modules; no model inference, image transformation or independent candidate UI approval', pendingInfrastructure: ['Mint host readiness', 'common host-wide lock', 'isolated API /internal/mint-f1-readiness endpoint'] })); return; }
  if (argv.length !== 2 || argv[0] !== '--execute') throw new Error('Usage: node tools/mint-f1-execution.js [--plan | --execute PRIVATE_INPUT_JSON]');
  const input = readPrivateInput(resolve(argv[1]));
  const artifact = await executeCandidate(input);
  console.log(JSON.stringify({ appSha: artifact.appSha, opsSha: artifact.opsSha, buildId: artifact.buildId, artifactInventorySha256: artifact.inventorySha256, runtimeRoot: `${resolve(input.candidate)}.runtime`, nativeStatus: artifact.nativeStatus, deployEligible: false }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
