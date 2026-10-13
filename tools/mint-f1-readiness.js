// Embed only in a Mint loopback fixture bridge. This module registers no route,
// starts no service, reads no .env, and creates no accounts or roles.
import { readFileSync, lstatSync, realpathSync, readdirSync } from 'node:fs';
import { platform, hostname } from 'node:os';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import { appLockfilePins } from './mint-f1-artifact.js';
export const readinessPath = '/internal/mint-f1-readiness';
export const databaseIdentitySql = 'SELECT DATABASE() AS databaseName, @@port AS serverPort';
const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sha = data => createHash('sha256').update(data).digest('hex');
const defaultIo = { readFileSync, lstatSync, realpathSync, readdirSync };
function receiptFromFile(path, io, uid, now) {
  if (!isAbsolute(path || '')) throw new Error('Private receipt path required');
  const metadata = io.lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink?.() || metadata.uid !== uid || (metadata.mode & 0o077) || metadata.size > 1024 ** 2) throw new Error('Private receipt required');
  const receipt = JSON.parse(io.readFileSync(path, 'utf8'));
  if (receipt.schema !== 'mint-f1-readiness-v1' || receipt.reviewed !== true || !nonempty(receipt.isolationReceiptId)
    || !nonempty(receipt.mintMachineId) || !nonempty(receipt.smMachineId) || receipt.mintMachineId === receipt.smMachineId
    || receipt.appSha !== initialAppSha || !Number.isFinite(Date.parse(receipt.expiresAt)) || Date.parse(receipt.expiresAt) <= now
    || !isAbsolute(receipt.sourceRoot || '') || !nonempty(receipt.sourceReceiptId)
    || !/^app\/src\/[a-zA-Z0-9_./-]+\.(?:js|ts)$/.test(receipt.appModulePath || '')
    || !isAbsolute(receipt.bridgeSourcePath || '') || !/^[a-f0-9]{64}$/.test(receipt.bridgeSourceSha256 || '')
    || receipt.productionRelayDisabled !== true || !['isolated-database', 'mock-fixture'].includes(receipt.mode)) throw new Error('Reviewed current source/isolation evidence required');
  const origin = new URL(receipt.apiOrigin);
  if (origin.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(origin.hostname) || !origin.port
    || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Loopback bridge origin required');
  if (!Array.isArray(receipt.fixtureActors) || receipt.fixtureActors.length !== 3 || !receipt.fixtureActors.every(Number.isInteger) || [...receipt.fixtureActors].sort().join(',') !== '701,702,703') throw new Error('Only existing fixture actors allowed');
  return receipt;
}
function verifySource(receipt, runtime, io) {
  const root = io.realpathSync(receipt.sourceRoot);
  if (!io.lstatSync(root).isDirectory() || !runtime.loadedSourceModuleUrl) throw new Error('Actual loaded source module required');
  const loaded = io.realpathSync(fileURLToPath(runtime.loadedSourceModuleUrl));
  if (loaded !== join(root, receipt.appModulePath)) throw new Error('Bridge must use exact fixed APP server module');
  const expected = receipt.expectedSourceFiles;
  if (!expected || typeof expected !== 'object' || Array.isArray(expected) || !Object.keys(expected).length || Object.keys(expected).length > 2000) throw new Error('Pinned source tree receipt required');
  for (const required of ['app/src/server.js', 'app/src/worker.ts', 'package.json', 'package-lock.json', 'web/package-lock.json']) if (!Object.hasOwn(expected, required)) throw new Error('Incomplete source receipt');
  if (!Object.hasOwn(expected, receipt.appModulePath)) throw new Error('Loaded module missing from fixed source receipt');
  for (const [path, hash] of Object.entries(expected)) {
    if (!/^[a-f0-9]{64}$/.test(hash) || isAbsolute(path) || path.split('/').some(p => !p || p === '..' || p === '.' || /^\.env(?:\.|$)/.test(p))) throw new Error('Unsafe source receipt entry');
    const absolute = join(root, path); const rel = relative(root, io.realpathSync(absolute));
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Source escapes root');
    const stat = io.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink?.() || stat.size > 8 * 1024 ** 2 || sha(io.readFileSync(absolute)) !== hash) throw new Error('Source hash mismatch');
  }
  for (const [path, hash] of Object.entries(appLockfilePins)) if (expected[path] !== hash) throw new Error('Fixed APP lockfile mismatch');
  const walk = prefix => {
    const stat = io.lstatSync(join(root, prefix));
    if (!stat.isDirectory() || stat.isSymbolicLink?.()) throw new Error('Source directory must be regular');
    for (const name of io.readdirSync(join(root, prefix))) {
      if (!name || name.includes('/') || name.includes('\\') || name === '..' || name === '.') throw new Error('Unsafe source tree');
      const path = `${prefix}/${name}`; const entry = io.lstatSync(join(root, path));
      if (entry.isSymbolicLink?.()) throw new Error('Source symlink forbidden');
      if (entry.isDirectory()) walk(path); else if (!entry.isFile() || !Object.hasOwn(expected, path)) throw new Error('Unexpected source tree entry');
    }
  };
  walk('app/src'); walk('app/data');
}
async function databaseProof(receipt, runtime, timeoutMs, state) {
  const db = receipt.database;
  if (runtime.mode !== 'isolated-database' || runtime.databaseConnectionPresent !== true
    || !db || !['127.0.0.1', '::1'].includes(db.host) || db.database !== 'tag_f1_semantic_test'
    || !Number.isInteger(db.port) || db.port < 1 || db.port > 65535 || !Number.isInteger(db.serverPort) || db.serverPort < 1 || db.serverPort > 65535
    || runtime.identityConnectionScope !== 'dedicated-readonly'
    || typeof runtime.getConnectionMetadata !== 'function' || typeof runtime.queryDatabaseIdentity !== 'function'
    || typeof runtime.cancelReadonlyIdentity !== 'function') throw new Error('Live isolated database adapter required');
  if (state.busy) throw new Error('Readonly identity query already in flight');
  const actual = runtime.getConnectionMetadata();
  if (!actual || actual.host !== db.host || actual.port !== db.port || actual.database !== db.database || actual.socketPath) throw new Error('Database connection isolation mismatch');
  state.busy = true; state.querySettled = false; state.cancelSettled = true;
  const controller = new AbortController();
  const clearIfSafe = () => { if (state.querySettled && state.cancelSettled) state.busy = false; };
  const query = Promise.resolve().then(() => runtime.queryDatabaseIdentity(databaseIdentitySql, { signal: controller.signal }));
  query.then(() => { state.querySettled = true; clearIfSafe(); }, () => { state.querySettled = true; clearIfSafe(); });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      state.cancelSettled = false;
      controller.abort();
      // Only the reserved readonly identity connection may be cancelled.
      // Cleanup must explicitly confirm completion; otherwise keep fail-closed.
      Promise.resolve().then(() => runtime.cancelReadonlyIdentity({ signal: controller.signal })).then(confirmed => {
        if (confirmed === true) { state.cancelSettled = true; clearIfSafe(); }
      }, () => {});
      reject(new Error('Database identity timeout'));
    }, timeoutMs);
  });
  const rows = await Promise.race([query, timeout]).finally(() => clearTimeout(timer));
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].databaseName !== db.database || Number(rows[0].serverPort) !== db.serverPort) throw new Error('Database identity mismatch');
}
export function createMintReadinessHandler({ receiptPath, getRuntime, databaseTimeoutMs = 2000 } = {},
  { io = defaultIo, system = { platform, hostname, nodeVersion: () => process.versions.node }, uid = process.getuid(), now = Date.now } = {}) {
  const identityState = { busy: false }; // One in-flight identity query per bridge handler.
  return async function readiness(request, response) {
    if (request.url !== readinessPath) return false; // Caller chooses whether to register this local route.
    const send = (status, data) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); return true; };
    if (request.method !== 'GET') return send(405, { ready: false });
    try {
      const receipt = receiptFromFile(receiptPath, io, uid, now());
      if (system.platform() !== 'linux' || !/^24\./.test(system.nodeVersion?.() || '') || system.hostname() === 'skyhong-SM'
        || io.readFileSync('/etc/machine-id', 'utf8').trim() !== receipt.mintMachineId) throw new Error('Actual Mint Linux identity mismatch');
      if (typeof getRuntime !== 'function') throw new Error('Live bridge runtime required');
      const runtime = getRuntime(); const address = runtime.serverAddress;
      const origin = new URL(receipt.apiOrigin);
      if (!address || !loopback(address.address) || address.port !== Number(origin.port)
        || !loopback(request.socket?.localAddress) || !loopback(request.socket?.remoteAddress)
        || request.socket?.localPort !== address.port || request.headers?.host !== origin.host
        || runtime.productionRelayDisabled !== true || runtime.isolationReceiptId !== receipt.isolationReceiptId) throw new Error('Live loopback bridge isolation mismatch');
      const bridge = io.realpathSync(fileURLToPath(runtime.loadedBridgeModuleUrl));
      const bridgeStat = io.lstatSync(receipt.bridgeSourcePath);
      if (bridge !== io.realpathSync(receipt.bridgeSourcePath) || !bridgeStat.isFile() || bridgeStat.isSymbolicLink?.()
        || bridgeStat.size > 1024 ** 2 || sha(io.readFileSync(bridge)) !== receipt.bridgeSourceSha256
        || runtime.publicDataSource !== 'in-process-fixture' || !Array.isArray(runtime.upstreamOrigins) || runtime.upstreamOrigins.length !== 0) throw new Error('Reviewed fixture-only bridge source/config required');
      verifySource(receipt, runtime, io);
      if (!Number.isFinite(databaseTimeoutMs) || databaseTimeoutMs <= 0 || databaseTimeoutMs > 5000) throw new Error('Bounded database timeout required');
      if (receipt.mode === 'isolated-database') await databaseProof(receipt, runtime, databaseTimeoutMs, identityState);
      else if (runtime.mode !== 'mock-fixture' || runtime.databaseConnectionPresent !== false || runtime.mockFixtureVerified !== true
        || runtime.productionRelayDisabled !== true || !nonempty(receipt.mockFixtureReceiptId)
        || runtime.mockFixtureReceiptId !== receipt.mockFixtureReceiptId) throw new Error('Explicit reviewed mock-only fixture required');
      if (Date.parse(receipt.expiresAt) <= now()) throw new Error('Readiness receipt expired during verification');
      return send(200, { machineId: receipt.mintMachineId, appSha: initialAppSha,
        scope: receipt.mode === 'isolated-database' ? 'mint-f1-isolated' : 'mint-f1-isolated-mock',
        databaseScope: receipt.mode === 'isolated-database' ? 'isolated' : 'mock-fixture',
        productionDatabase: false, isolationReceiptId: receipt.isolationReceiptId });
    } catch { return send(503, { ready: false, error: 'readiness-unavailable' }); }
  };
}
