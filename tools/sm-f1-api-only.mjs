import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
// Separate API-only scope: never launches Next/frontdoor/browser/build/DB services.
import * as fs from 'node:fs';
import { getPriority } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guardedBuild } from './guard-next-build.js';
import { collectHomepageTrials, requireHomepageMedian } from './homepage-median-probe.mjs';
import { readOnlyFileSha256 } from './read-only-file-sha256.mjs';
import baseline from './shared-host-baseline.cjs';
import { localResources } from './sm-f1/probe.mjs';
import { startFixture } from './sm-local-candidate/api.mjs';
import {
  assertListener,
  assertLock,
  dbPath,
  lockPath,
  pins,
  readChildIdentity,
  runtime,
  ticks,
  validateHealthCache,
  verifyRuntime,
} from './sm-local-candidate/core.mjs';
import { acquireCandidateLock, readReadiness } from './sm-local-candidate/runner.mjs';
export const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  ROOT = '/home/deck/tag-analysis-private/f1-release',
  NODE = '/home/deck/.local/bin/node';
const digest = (x) => createHash('sha256').update(x).digest('hex'),
  hex = (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x),
  sha = (x) => typeof x === 'string' && /^[a-f0-9]{40}$/.test(x),
  GiB = 1024 ** 3;
export const apiSourceNames = Object.freeze([
  'tools/read-only-file-sha256.mjs',
  'tools/sm-f1-api-only.mjs',
  'tools/sm-local-candidate/api.mjs',
  'tools/sm-local-candidate/runner.mjs',
  'tools/sm-local-candidate/core.mjs',
  'tools/guard-next-build.js',
  'tools/homepage-median-probe.mjs',
  'tools/shared-host-baseline.cjs',
  'tools/sm-f1/probe.mjs',
  'tools/mint-f1-artifact.js',
  'tools/native-elf-proof.js',
  'tools/mint-f1-candidate-plan.js',
  'package.json',
]);
export function validateApiInput(q, now = Date.now(), { starting = true } = {}) {
  const keys = [
    'schema',
    'reviewed',
    'executionPermission',
    'globalBuildSlotAcknowledged',
    'authorizationReference',
    'authorizedAtMs',
    'expiresAtMs',
    'newWebAppSha',
    'appTreeSha',
    'controlOpsSha',
    'nodePath',
    'nodeSha256',
    'dbConfigSha256',
    'sessionId',
    'sourceHashes',
  ];
  if (
    !q ||
    Object.keys(q).length !== keys.length ||
    Object.keys(q).some((k) => !keys.includes(k)) ||
    q.schema !== 'sm-f1-api-only-input-v1' ||
    [q.reviewed, q.executionPermission, q.globalBuildSlotAcknowledged].some((x) => x !== true) ||
    !hex(q.authorizationReference) ||
    !Number.isFinite(q.authorizedAtMs) ||
    q.authorizedAtMs > now ||
    now - q.authorizedAtMs > 900000 ||
    !Number.isFinite(q.expiresAtMs) ||
    q.expiresAtMs - now < (starting ? 180000 : 1) ||
    q.expiresAtMs - now > 900000 ||
    ![q.newWebAppSha, q.appTreeSha, q.controlOpsSha].every(sha) ||
    q.newWebAppSha === pins.app ||
    q.nodePath !== NODE ||
    ![q.nodeSha256, q.dbConfigSha256].every(hex) ||
    q.sessionId !== `api-only-aa-${q.newWebAppSha.slice(0, 8)}-005` ||
    !q.sourceHashes ||
    Object.keys(q.sourceHashes).length !== apiSourceNames.length ||
    apiSourceNames.some((n) => !hex(q.sourceHashes[n]))
  )
    throw Error('New separately admitted sole fixture API scope required');
  return q;
}
function liveInput(q) {
  validateApiInput(q, Date.now(), { starting: false });
}
export function job(q) {
  return ROOT + '/' + q.sessionId;
}
export function privateBytes(p, max = 1024 ** 2) {
  const s = fs.lstatSync(p);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.uid !== process.getuid() ||
    (s.mode & 0o777) !== 0o600 ||
    s.size > max ||
    fs.realpathSync(p) !== p
  )
    throw Error('Private canonical bounded sole API input/evidence required');
  return fs.readFileSync(p);
}
function git(args) {
  return execFileSync('/usr/bin/git', args, { cwd: repo, env: { PATH: '/usr/bin:/bin', LANG: 'C' }, timeout: 15000, maxBuffer: 1024 ** 2 });
}
export function verifyApiSource(q) {
  liveInput(q);
  if (
    repo !== '/home/deck/Projects/tag-sm-f1-release' ||
    process.cwd() !== repo ||
    fs.realpathSync(repo) !== repo ||
    fs.realpathSync(process.execPath) !== fs.realpathSync(NODE) ||
    readOnlyFileSha256(NODE) !== q.nodeSha256 ||
    fs.readFileSync('/etc/machine-id', 'utf8').trim() !== '302c2528bd464ad0953cf5fa743b6171' ||
    String(git(['rev-parse', 'HEAD'])).trim() !== q.controlOpsSha ||
    String(git(['status', '--porcelain', '--untracked-files=all'])).trim()
  )
    throw Error('API-only source/node/host binding failed');
  for (const n of apiSourceNames)
    if (
      fs.realpathSync(join(repo, n)) !== join(repo, n) ||
      digest(fs.readFileSync(join(repo, n))) !== q.sourceHashes[n] ||
      digest(git(['show', q.controlOpsSha + ':' + n])) !== q.sourceHashes[n]
    )
      throw Error('API-only source blob changed');
  if (
    String(git(['rev-parse', q.newWebAppSha + ':app'])).trim() !== q.appTreeSha ||
    String(git(['rev-parse', pins.app + ':app'])).trim() !== q.appTreeSha
  )
    throw Error('Loaded API/new web app tree mapping differs');
}
export function resourceReasons(r, { starting = false, estimatedDiskGiB = 0.25, ownRssBytes = 0, now = Date.now() } = {}) {
  const reasons = [];
  if (
    ['load1', 'availableBytes', 'memoryAvailableBytes', 'resourceObservedAtMs'].some((k) => !Number.isFinite(r?.[k]) || r[k] < 0) ||
    !Number.isFinite(ownRssBytes) ||
    ownRssBytes < 0 ||
    !Number.isInteger(r?.localBuildRoots) ||
    r.localBuildRoots < 0 ||
    !Number.isInteger(r?.localBrowserRoots) ||
    r.localBrowserRoots < 0
  )
    reasons.push('invalid-resource');
  if (now - r.resourceObservedAtMs < 0 || now - r.resourceObservedAtMs > 5000) reasons.push('resource-stale');
  if (r.load1 > 12) reasons.push('load');
  if (r.availableBytes < (starting ? 40 : 30) * GiB) reasons.push('disk');
  if (starting && r.availableBytes - estimatedDiskGiB * GiB < 30 * GiB) reasons.push('disk-estimate');
  if (r.memoryAvailableBytes < (starting ? 3 : 1.5) * GiB) reasons.push('memory');
  if (r.localBuildRoots > (starting ? 0 : 1)) reasons.push('build-count');
  if (r.localBrowserRoots > 2) reasons.push('browser-count');
  if (ownRssBytes > 2 * GiB) reasons.push('own-rss');
  return reasons;
}
export function boundedRecorder(write, { maxBytes = 32 * 1024 ** 2, now = Date.now } = {}) {
  let count = 0,
    bytes = 0;
  return (row) => {
    const raw = JSON.stringify({ observedAtMs: now(), ...row }) + '\n';
    bytes += Buffer.byteLength(raw);
    if (bytes > maxBytes) throw Error('Private API/resource telemetry cap');
    const value = write(++count, raw);
    if (value === false || value?.then) {
      if (value instanceof Promise) value.catch(() => {});
      throw Error('Synchronous private telemetry sink required');
    }
  };
}
export function requireApiReceipt(
  r,
  { controlOpsSha, inputSha256, sessionId, newWebAppSha, appTreeSha, now = Date.now(), buildExpiresAtMs } = {},
) {
  if (
    r?.schema !== 'sm-f1-api-only-started-v1' ||
    r.sessionId !== sessionId ||
    r.controlOpsSha !== controlOpsSha ||
    r.inputSha256 !== inputSha256 ||
    r.newWebAppSha !== newWebAppSha ||
    r.appTreeSha !== appTreeSha ||
    r.appSha !== pins.app ||
    r.buildId !== pins.build ||
    r.inventorySha256 !== pins.inventory ||
    r.manifestSha256 !== pins.manifest ||
    r.actor !== 'anonymous' ||
    r.productionDatabase !== false ||
    r.origin !== 'http://127.0.0.1:18197' ||
    r.database?.host !== '127.0.0.1' ||
    r.database?.port !== 18306 ||
    r.database?.name !== 'tag_f1_semantic_test' ||
    !Number.isFinite(r.expiresAtMs) ||
    r.plannedStopAtMs !== r.expiresAtMs - 120000 ||
    now >= r.plannedStopAtMs ||
    buildExpiresAtMs + 60000 > r.plannedStopAtMs ||
    !r.owner ||
    !r.api ||
    [r.owner, r.api].some(
      (x) =>
        !Number.isInteger(x.pid) ||
        x.pid < 1 ||
        typeof x.startTicks !== 'string' ||
        !/^\d+$/.test(x.startTicks) ||
        !Number.isInteger(x.uid) ||
        x.uid !== process.getuid(),
    ) ||
    r.owner.pid === r.api.pid ||
    r.api.name !== 'api' ||
    r.api.host !== '127.0.0.1' ||
    r.api.port !== 18197 ||
    !hex(r.api.argvSha256) ||
    Object.hasOwn(r, 'children') ||
    r.deployEligible !== false
  )
    throw Error('Exact new sole API receipt required; three-listener receipt rejected');
  return r;
}
export function validateOwnerLease(h, { inputSha256, parentPid, parentStartTicks, now = Date.now() } = {}) {
  if (
    h?.schema !== 'sm-f1-health-cache-v1' ||
    h.inputSha256 !== inputSha256 ||
    h.parentPid !== parentPid ||
    h.parentStartTicks !== parentStartTicks ||
    !['run', 'pause'].includes(h.decision) ||
    !Number.isFinite(h.startedAtMs) ||
    !Number.isFinite(h.finishedAtMs) ||
    h.startedAtMs > h.finishedAtMs ||
    h.finishedAtMs > now ||
    now - h.startedAtMs > 30000 ||
    !Array.isArray(h.sites) ||
    h.sites.length !== 3
  )
    throw Error('Sole API lease binding/freshness failed');
  if (h.decision === 'run') validateHealthCache(h, { inputSha256, parentPid, parentStartTicks, now });
  return h;
}
export function validateApiMapping(a, q, r, now = Date.now()) {
  validateApiInput(a, now, { starting: false });
  if (
    a.newWebAppSha !== q.appSha ||
    a.appTreeSha !== q.appTreeSha ||
    a.controlOpsSha !== q.controlOpsSha ||
    a.nodeSha256 !== q.nodeSha256 ||
    a.sessionId !== q.apiOwner.sessionId ||
    a.expiresAtMs !== r.expiresAtMs ||
    a.authorizationReference !== q.authorizationReference ||
    apiSourceNames.some((n) => a.sourceHashes[n] !== q.sourceHashes[n])
  )
    throw Error('True API input/new build source mapping differs');
  return a;
}
function bindProcess(owner, parentPid, { allowStopped = false } = {}) {
  const a = readChildIdentity(owner.pid);
  if (
    a.startTicks !== String(owner.startTicks) ||
    !a.uids.every((x) => x === process.getuid()) ||
    a.exe !== fs.realpathSync(NODE) ||
    a.cwd !== repo ||
    (parentPid && a.parentPid !== parentPid)
  )
    throw Error('API-only exact Node identity differs');
  const s = fs.readFileSync('/proc/' + owner.pid + '/stat', 'utf8'),
    state = s
      .slice(s.lastIndexOf(')') + 1)
      .trim()
      .split(/\s+/)[0];
  if (['Z', 'X'].includes(state) || (!allowStopped && ['T', 't'].includes(state))) throw Error('API-only owner absent/paused');
  return { ...a, state };
}
export function requireApiOwner(q, { record = () => {} } = {}) {
  const c = q.apiOwner,
    path = c.startedReceiptPath,
    raw = privateBytes(path);
  record({ event: 'api-only-started-raw', rawBase64: raw.toString('base64'), sha256: digest(raw) });
  if (digest(raw) !== c.startedReceiptSha256) throw Error('Sole API receipt changed');
  const r = requireApiReceipt(JSON.parse(raw), {
    controlOpsSha: c.controlOpsSha,
    inputSha256: c.inputSha256,
    sessionId: c.sessionId,
    buildExpiresAtMs: q.expiresAtMs,
    newWebAppSha: q.appSha,
    appTreeSha: q.appTreeSha,
  });
  if (!/^\/tmp\/babysit\/mint-queue\/tag-sm-api-only-admission-\d{8}T\d{6}Z\/api-input\.json$/.test(r.sourceInputPath || ''))
    throw Error('Exact sole API input path required');
  const inputRaw = privateBytes(r.sourceInputPath);
  record({ event: 'api-only-source-input-raw', sha256: digest(inputRaw), rawBase64: inputRaw.toString('base64') });
  if (digest(inputRaw) !== c.inputSha256) throw Error('True sole API input SHA differs');
  validateApiMapping(JSON.parse(inputRaw), q, r);
  const parent = bindProcess(r.owner),
    api = bindProcess(r.api, parent.pid, { allowStopped: true });
  if (
    digest(fs.readFileSync('/proc/' + api.pid + '/cmdline')) !== r.api.argvSha256 ||
    api.argv[1] !== join(repo, 'tools/sm-f1-api-only.mjs') ||
    api.argv[2] !== '--worker' ||
    api.argv.length !== 6 ||
    api.argv[3] !== r.sourceInputPath ||
    api.argv[4] !== c.inputSha256 ||
    api.argv[5] !== String(c.lockPid)
  )
    throw Error('Exact sole API worker argv differs');
  if (
    parent.pid !== c.parentPid ||
    parent.startTicks !== c.parentStartTicks ||
    digest(fs.readFileSync('/proc/' + parent.pid + '/cmdline')) !== c.parentCmdlineSha256
  )
    throw Error('Sole API parent binding differs');
  assertListener(
    { ...r.api, uid: process.getuid(), parentPid: parent.pid, processGroup: r.api.pid, exe: api.exe, cwd: repo, expectedArgs: api.argv },
    { host: '127.0.0.1', port: 18197 },
  );
  const launchRaw = privateBytes(join(dirname(path), 'owner-launch.json')),
    leaseRaw = privateBytes(join(dirname(path), 'health-cache.json'));
  record({
    event: 'api-only-owner-lease-raw',
    launchBase64: launchRaw.toString('base64'),
    leaseBase64: leaseRaw.toString('base64'),
    launchSha256: digest(launchRaw),
    leaseSha256: digest(leaseRaw),
  });
  const launch = JSON.parse(launchRaw),
    lease = JSON.parse(leaseRaw),
    lock = fs.lstatSync(lockPath);
  if (
    launch.inputSha256 !== c.inputSha256 ||
    launch.controlOpsSha !== c.controlOpsSha ||
    launch.parentPid !== c.parentPid ||
    String(launch.parentStartTicks) !== c.parentStartTicks ||
    launch.parentCmdlineSha256 !== c.parentCmdlineSha256 ||
    launch.lockPid !== c.lockPid ||
    String(launch.lockStartTicks) !== c.lockStartTicks ||
    String(lock.dev) !== c.lockDev ||
    String(lock.ino) !== c.lockIno ||
    lock.uid !== process.getuid() ||
    ticks(c.lockPid) !== c.lockStartTicks ||
    !['run', 'pause'].includes(lease.decision)
  )
    throw Error('Specific sole API kernel/lease mismatch');
  bindProcess({ pid: c.lockPid, startTicks: c.lockStartTicks }, parent.pid);
  assertLock(c.lockPid);
  validateOwnerLease(lease, { inputSha256: c.inputSha256, parentPid: c.parentPid, parentStartTicks: c.parentStartTicks });
  return { receipt: r, lease, paused: lease.decision === 'pause' || ['T', 't'].includes(api.state) };
}
export function ownRss(group, { io = fs, identity = (pid) => readChildIdentity(pid, io), uid = process.getuid() } = {}) {
  if (!Number.isSafeInteger(group) || group < 1) throw Error('Own group required');
  let bytes = 0;
  const parse = (raw) => {
    const end = raw.lastIndexOf(')'),
      f = raw
        .slice(end + 1)
        .trim()
        .split(/\s+/),
      pid = Number(raw.slice(0, raw.indexOf('(')).trim());
    if (end < 0 || !Number.isSafeInteger(pid) || !Number.isSafeInteger(Number(f[2])) || !/^\d+$/.test(f[19] || ''))
      throw Error('Own stat metadata invalid');
    if (!['R', 'S', 'D', 'T', 't', 'I', 'W', 'P', 'Z', 'X', 'x'].includes(f[0])) throw Error('Own state metadata invalid');
    return { pid, state: f[0], group: Number(f[2]), ticks: f[19], liveness: ['Z', 'X', 'x'].includes(f[0]) ? 'terminal' : 'live' };
  };
  for (const name of io.readdirSync('/proc').filter((p) => /^\d+$/.test(p))) {
    const pid = Number(name);
    let first;
    try {
      first = parse(io.readFileSync('/proc/' + pid + '/stat', 'utf8'));
    } catch (e) {
      if (['ENOENT', 'ESRCH'].includes(e.code)) continue;
      throw e;
    }
    if (first.group !== group) continue;
    try {
      if (first.pid !== pid) throw Error('Own PID changed');
      const status = io.readFileSync('/proc/' + pid + '/status', 'utf8'),
        uids = status.match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/m);
      if (!uids || uids.slice(1).some((x) => Number(x) !== uid)) throw Error('Own UID changed');
      if (first.liveness === 'live') {
        const a = identity(pid);
        if (a.pid !== pid || a.processGroup !== group || a.startTicks !== first.ticks || !a.uids.every((x) => x === uid))
          throw Error('Own identity changed');
        const rss = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
        if (!rss || !Number.isSafeInteger(Number(rss[1]) * 1024)) throw Error('Own RSS metadata invalid');
        bytes += Number(rss[1]) * 1024;
        if (!Number.isSafeInteger(bytes)) throw Error('Own RSS sum invalid');
      }
      const last = parse(io.readFileSync('/proc/' + pid + '/stat', 'utf8'));
      if (last.pid !== first.pid || last.group !== first.group || last.ticks !== first.ticks || last.liveness !== first.liveness)
        throw Error('Own process changed during RSS scan');
    } catch (e) {
      e.procClass = 'own-member';
      throw e;
    }
  }
  return bytes;
}
export function failureDiagnostic(error, phase = 'unknown') {
  return {
    phase: ['startup', 'serving', 'closing', 'guard-probe', 'finalizing'].includes(phase) ? phase : 'unknown',
    errno: ['EACCES', 'EPERM', 'ENOENT', 'ESRCH', 'EIO', 'EINVAL'].includes(error?.code) ? error.code : 'unknown',
    procClass:
      error?.procClass === 'own-member' ? 'own-member' : typeof error?.path === 'string' && /^\/proc\//.test(error.path) ? 'proc' : 'none',
    cause: failureCause(error),
  };
}

function portFree() {
  const port = (18197).toString(16).toUpperCase();
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6'])
    for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
      const f = l.trim().split(/\s+/);
      if (
        f[3] === '0A' &&
        f[1]?.endsWith(':' + port) &&
        ['0100007F', '00000000', '00000000000000000000000000000000'].includes(f[1].split(':')[0])
      )
        throw Error('Sole API port collision; existing listener preserved');
    }
}
const nap = (ms) => new Promise((done) => setTimeout(done, ms));
export function deferredApiCloser(getApi, onStop) {
  let closing;
  return () => {
    onStop();
    const api = getApi();
    if (!api) return Promise.resolve();
    return (closing ??= Promise.resolve().then(() => api.close()));
  };
}
export async function apiWorker(inputPath, inputSha, lockPid) {
  const raw = privateBytes(inputPath),
    q = validateApiInput(JSON.parse(raw), Date.now(), { starting: false }),
    dir = job(q);
  if (digest(raw) !== inputSha) throw Error('API-only input changed');
  verifyApiSource(q);
  assertLock(lockPid);
  const launch = JSON.parse(privateBytes(join(dir, 'owner-launch.json'))),
    identity = readChildIdentity(process.pid);
  if (
    identity.processGroup !== process.pid ||
    launch.parentPid !== process.ppid ||
    launch.lockPid !== lockPid ||
    ticks(launch.parentPid) !== launch.parentStartTicks ||
    ticks(lockPid) !== launch.lockStartTicks ||
    launch.inputSha256 !== inputSha ||
    digest(fs.readFileSync('/proc/' + process.ppid + '/cmdline')) !== launch.parentCmdlineSha256
  )
    throw Error('Specific API-only guarded parent required');
  const record = boundedRecorder((n, s) =>
    fs.writeFileSync(join(dir, 'worker-' + process.pid + '-' + n + '.json'), s, { flag: 'wx', mode: 0o600 }),
  );
  let api,
    stopRequested = false,
    failure;
  let phase = 'startup';
  const close = deferredApiCloser(
    () => api,
    () => {
      stopRequested = true;
    },
  );
  const onStop = () =>
    close().catch((e) => {
      failure ??= e;
    });
  process.once('SIGTERM', onStop);
  process.once('SIGINT', onStop);
  const planned = q.expiresAtMs - 120000,
    timer = setTimeout(onStop, Math.max(1, planned - Date.now()));
  try {
    portFree();
    api = await startFixture({ expiresAtMs: q.expiresAtMs, dbConfigSha256: q.dbConfigSha256 }, dir);
    if (stopRequested) throw Error('API-only stopped during startup');
    const own = {
      name: 'api',
      pid: process.pid,
      startTicks: ticks(process.pid),
      uid: process.getuid(),
      parentPid: process.ppid,
      processGroup: process.pid,
      exe: fs.realpathSync(NODE),
      cwd: repo,
      expectedArgs: [NODE, join(repo, 'tools/sm-f1-api-only.mjs'), '--worker', inputPath, inputSha, String(lockPid)],
    };
    assertListener(own, { host: '127.0.0.1', port: 18197 });
    const body = await readReadiness({ writeRaw: (r) => record({ event: 'api-readiness-raw', ...r }) });
    if (
      body.appSha !== pins.app ||
      body.inventorySha256 !== pins.inventory ||
      body.productionFallback !== false ||
      body.queueEnabled !== false ||
      body.apiOrigin !== 'http://127.0.0.1:18197'
    )
      throw Error('Real sole API readiness failed');
    verifyApiSource(q);
    assertLock(lockPid);
    const receipt = {
      schema: 'sm-f1-api-only-started-v1',
      sessionId: q.sessionId,
      appSha: pins.app,
      buildId: pins.build,
      inventorySha256: pins.inventory,
      manifestSha256: pins.manifest,
      controlOpsSha: q.controlOpsSha,
      inputSha256: inputSha,
      actor: 'anonymous',
      productionDatabase: false,
      database: { host: '127.0.0.1', port: 18306, name: 'tag_f1_semantic_test' },
      origin: 'http://127.0.0.1:18197',
      owner: { pid: process.ppid, startTicks: launch.parentStartTicks, uid: process.getuid() },
      api: {
        name: 'api',
        pid: process.pid,
        startTicks: own.startTicks,
        argvSha256: digest(fs.readFileSync('/proc/self/cmdline')),
        uid: process.getuid(),
        host: '127.0.0.1',
        port: 18197,
      },
      expiresAtMs: q.expiresAtMs,
      plannedStopAtMs: planned,
      newWebAppSha: q.newWebAppSha,
      appTreeSha: q.appTreeSha,
      sourceInputPath: inputPath,
      deployEligible: false,
    };
    fs.writeFileSync(join(dir, 'api-started.json'), JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o600 });
    while (!stopRequested && Date.now() < planned) {
      verifyApiSource(q);
      assertLock(lockPid);
      if (ticks(process.ppid) !== launch.parentStartTicks) throw Error('API parent changed');
      phase = 'serving';
      const lease = JSON.parse(privateBytes(join(dir, 'health-cache.json')));
      validateOwnerLease(lease, { inputSha256: inputSha, parentPid: process.ppid, parentStartTicks: launch.parentStartTicks });
      const resources = localResources(),
        reasons = resourceReasons(resources, { ownRssBytes: ownRss(process.pid) });
      record({ event: 'api-only-worker-resource-raw', resources, reasons }); // Parent alone decides STOP/CONT from its bound resource/health sample; worker never turns a transient sample into cleanup.
      assertListener(own, { host: '127.0.0.1', port: 18197 });
      await nap(1000);
    }
  } catch (e) {
    failure = e;
    try {
      record({ event: 'api-only-worker-primary', phase, cause: failureCause(e), diagnostic: failureDiagnostic(e, phase) });
    } catch (auditError) {
      failure = new AggregateError([e, auditError], 'API worker primary and evidence failure', { cause: e });
    }
  } finally {
    clearTimeout(timer);
    phase = 'closing';
    try {
      await close();
    } catch (e) {
      try {
        record({ event: 'api-only-worker-cleanup', phase, cause: failureCause(e), diagnostic: failureDiagnostic(e, phase) });
      } catch (auditError) {
        e = new AggregateError([e, auditError], 'API cleanup evidence failure', { cause: e });
      }
      failure = failure ? new AggregateError([failure, e], 'API worker primary and cleanup failure', { cause: failure }) : e;
    }
    process.off('SIGTERM', onStop);
    process.off('SIGINT', onStop);
  }
  if (failure) throw failure;
  record({ event: 'api-only-worker-stopped', inputSha256: inputSha, deployEligible: false });
}
export async function finishOwned(primary, steps) {
  const errors = primary ? [primary] : [];
  for (const step of steps)
    try {
      await step();
    } catch (e) {
      errors.push(e);
    }
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, 'Primary and owned finalization failure', { cause: errors[0] });
}
export async function executeApi(inputPath, inputSha) {
  if (!/^\/tmp\/babysit\/mint-queue\/tag-sm-api-only-admission-\d{8}T\d{6}Z\/api-input\.json$/.test(inputPath))
    throw Error('New sole API admission namespace required');
  const raw = privateBytes(inputPath),
    q = validateApiInput(JSON.parse(raw));
  if (digest(raw) !== inputSha) throw Error('API-only admission hash differs');
  verifyApiSource(q);
  if (
    getPriority(0) !== 19 ||
    !/^idle(?:\s|$)/.test(
      execFileSync('/usr/bin/ionice', ['-p', String(process.pid)], {
        timeout: 3000,
        maxBuffer: 128,
        env: { PATH: '/usr/bin:/bin', LANG: 'C' },
      })
        .toString()
        .trim(),
    )
  )
    throw Error('API-only parent requires nice19/ionice3');
  const dir = job(q);
  if (fs.existsSync(dir)) throw Error('Existing API-only proof preserved; no reuse');
  const pre = verifyRuntime();
  let lock,
    fatal,
    primary,
    active = false,
    group = 0,
    timer,
    fd,
    closed = false,
    logBytes = 0,
    health;
  try {
    lock = await acquireCandidateLock({ nodePath: NODE });
    fs.mkdirSync(dir, { mode: 0o700 });
    const record = boundedRecorder((n, s) => fs.writeFileSync(join(dir, 'parent-' + n + '.json'), s, { flag: 'wx', mode: 0o600 }));
    const parentTicks = ticks(process.pid);
    fs.writeFileSync(
      join(dir, 'owner-launch.json'),
      JSON.stringify({
        inputSha256: inputSha,
        controlOpsSha: q.controlOpsSha,
        parentPid: process.pid,
        parentStartTicks: parentTicks,
        parentCmdlineSha256: digest(fs.readFileSync('/proc/self/cmdline')),
        lockPid: lock.pid,
        lockStartTicks: ticks(lock.pid),
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    const terminate = (e) => {
      fatal ??= e;
      if (active) process.emit('SIGTERM');
    };
    timer = setTimeout(() => terminate(Error('API-only original admitted deadline')), Math.max(1, q.expiresAtMs - Date.now()));
    const probe = async () => {
      try {
        if (digest(privateBytes(inputPath)) !== inputSha) throw Error('API-only input changed');
        verifyApiSource(q);
        assertLock(lock.pid);
        if (!health || Date.now() - health.startedAtMs > 15000) {
          const start = Date.now(),
            sites = await collectHomepageTrials({
              urls: Object.keys(baseline.siteBudgetsSeconds),
              record: (row) => record({ event: 'homepage-raw-before-validation', row }),
            });
          health = { startedAtMs: start, finishedAtMs: Date.now(), sites };
        }
        const resources = localResources(),
          rss = group ? ownRss(group) : 0,
          reasons = resourceReasons(resources, { starting: !group, ownRssBytes: rss });
        record({ event: 'api-only-parent-resource-raw', resources, ownRssBytes: rss, reasons, health });
        let badMedian = false;
        for (const [url, cap] of Object.entries(baseline.siteBudgetsSeconds))
          try {
            requireHomepageMedian(
              health.sites.find((x) => x.url === url),
              cap,
              { startedAtMs: health.startedAtMs, endedAtMs: health.finishedAtMs },
            );
          } catch {
            badMedian = true;
          }
        const lease = {
          schema: 'sm-f1-health-cache-v1',
          inputSha256: inputSha,
          parentPid: process.pid,
          parentStartTicks: parentTicks,
          ...health,
          decision: reasons.length || badMedian ? 'pause' : 'run',
          observedAtMs: Date.now(),
        };
        const pending = join(dir, 'health-cache.pending.json');
        fs.writeFileSync(pending, JSON.stringify(lease) + '\n', { flag: 'wx', mode: 0o600 });
        fs.renameSync(pending, join(dir, 'health-cache.json'));
        return {
          sites: health.sites,
          load1: resources.load1,
          homeAvailableBytes: resources.availableBytes,
          probeError: reasons.length || badMedian ? 'API-only guard resources/median failed' : undefined,
        };
      } catch (e) {
        try {
          record({ event: 'api-only-fatal', cause: failureCause(e), diagnostic: failureDiagnostic(e, 'guard-probe') });
        } finally {
          terminate(e);
        }
        return { sites: [], probeError: 'API-only binding/telemetry failed' };
      }
    };
    fd = fs.openSync(join(dir, 'api-worker.log'), 'wx', 0o600);
    active = true;
    const code = await guardedBuild({
      command: NODE,
      args: [join(repo, 'tools/sm-f1-api-only.mjs'), '--worker', inputPath, inputSha, String(lock.pid)],
      cwd: repo,
      estimatedUsageGiB: 0.25,
      intervalMs: 5000,
      probe,
      record: (r) => {
        if (r.event === 'started') group = r.processGroup;
        record(r);
      },
      spawnBuild: (bin, args, options) => {
        const c = spawn(bin, args, {
          ...options,
          env: {
            PATH: '/usr/bin:/bin',
            HOME: '/nonexistent',
            LANG: 'C',
            DNT: '1',
            NEXT_TELEMETRY_DISABLED: '1',
            UV_THREADPOOL_SIZE: '2',
            VIPS_CONCURRENCY: '1',
            NODE_OPTIONS: '--max-old-space-size=256',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        for (const stream of [c.stdout, c.stderr]) {
          stream.on('data', (b) => {
            try {
              logBytes += b.length;
              if (logBytes > 1024 ** 2) throw Error('API-only stream cap');
              fs.writeSync(fd, b);
            } catch (e) {
              terminate(e);
            }
          });
          stream.on('error', terminate);
        }
        c.on('exit', (code, signal) => {
          if (code !== 0 || signal) terminate(Error('API-only worker failed before close'));
        });
        return c;
      },
    });
    active = false;
    fs.closeSync(fd);
    closed = true;
    if (fatal || code !== 0) throw fatal || Error('API-only guard failed');
    verifyApiSource(q);
    const post = verifyRuntime();
    assertLock(lock.pid);
    await probe();
    if (fatal) throw fatal;
    fs.writeFileSync(
      join(dir, 'api-owner-ended.json'),
      JSON.stringify({
        schema: 'sm-f1-api-only-ended-v1',
        inputSha256: inputSha,
        controlOpsSha: q.controlOpsSha,
        sessionId: q.sessionId,
        before: pre,
        after: post,
        wholeRuntimeUnchanged: true,
        deployEligible: false,
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
  } catch (e) {
    primary = fatal || e;
  } finally {
    active = false;
    clearTimeout(timer);
    await finishOwned(primary, [
      () => {
        if (fd !== undefined && !closed) fs.closeSync(fd);
      },
      async () => {
        if (lock) await lock.release();
      },
    ]);
  }
}
export function failureCause(error) {
  const m = String(error?.message || '');
  return /deadline|expired/i.test(m)
    ? 'deadline'
    : /\b(?:source|blob|node|input|mapping)\b/i.test(m)
      ? 'source-input'
      : /lock|kernel|owner|parent|listener|receipt/i.test(m)
        ? 'owner-binding'
        : /readiness|HTTP|API.*failed/i.test(m)
          ? 'api-readiness'
          : /resource|RSS|memory|load|disk|count/i.test(m)
            ? 'resource'
            : /cap|telemetry|log|sink/i.test(m)
              ? 'telemetry'
              : 'operation';
}
export function apiTemplate() {
  return {
    schema: 'sm-f1-api-only-input-v1',
    reviewed: false,
    executionPermission: false,
    globalBuildSlotAcknowledged: false,
    authorizationReference: null,
    authorizedAtMs: null,
    expiresAtMs: null,
    newWebAppSha: null,
    appTreeSha: null,
    controlOpsSha: null,
    nodePath: NODE,
    nodeSha256: null,
    dbConfigSha256: null,
    sessionId: null,
    sourceHashes: Object.fromEntries(apiSourceNames.map((n) => [n, null])),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, path, hash, lock, ...rest] = process.argv.slice(2);
  if (mode === '--template' && !path) process.stdout.write(JSON.stringify(apiTemplate(), null, 2) + '\n');
  else if (mode === '--execute' && path && hash && !lock)
    executeApi(resolve(path), hash).catch(() => {
      process.stderr.write('API-only scope failed; private evidence retained.\n');
      process.exitCode = 1;
    });
  else if (mode === '--worker' && path && hash && lock && !rest.length)
    apiWorker(resolve(path), hash, Number(lock)).catch(() => {
      process.stderr.write('API-only worker failed; no other service adopted.\n');
      process.exit(1);
    });
  else process.exitCode = 1;
}
