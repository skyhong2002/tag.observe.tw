// Embed only in a Mint loopback fixture bridge. This module registers no route,
// starts no service, reads no .env, and creates no accounts or roles.

import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { hostname, platform } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appLockfilePins } from './mint-f1-artifact.js';
import { initialAppSha } from './mint-f1-candidate-plan.js';
export const readinessPath = '/internal/mint-f1-readiness';
export const databaseIdentitySql = 'SELECT DATABASE() AS databaseName, @@port AS serverPort';
const loopback = (address) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const sha = (data) => createHash('sha256').update(data).digest('hex');
const receiptBytesIdentity = Symbol('checked-private-receipt-bytes');
const diagnosticReasons = new Set([
  'identity-quarantined',
  'identity-inflight-mismatch',
  'identity-waiter-limit',
  'identity-query-failed',
  'identity-timeout',
  'identity-result-mismatch',
  'verification-failed',
]);
const unavailable = (reason) => Object.assign(new Error('Readiness unavailable'), { readinessReason: reason });
const defaultIo = { readFileSync, lstatSync, realpathSync, readdirSync };
function receiptFromFile(path, io, uid, now) {
  if (!isAbsolute(path || '')) throw new Error('Private receipt path required');
  const metadata = io.lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink?.() || metadata.uid !== uid || metadata.mode & 0o077 || metadata.size > 1024 ** 2)
    throw new Error('Private receipt required');
  const bytes = io.readFileSync(path, 'utf8');
  const receipt = JSON.parse(bytes);
  Object.defineProperty(receipt, receiptBytesIdentity, { value: sha(bytes) });
  if (
    receipt.schema !== 'mint-f1-readiness-v1' ||
    receipt.reviewed !== true ||
    !nonempty(receipt.isolationReceiptId) ||
    !nonempty(receipt.mintMachineId) ||
    !nonempty(receipt.smMachineId) ||
    receipt.mintMachineId === receipt.smMachineId ||
    receipt.appSha !== initialAppSha ||
    !Number.isFinite(Date.parse(receipt.expiresAt)) ||
    Date.parse(receipt.expiresAt) <= now ||
    !isAbsolute(receipt.sourceRoot || '') ||
    !nonempty(receipt.sourceReceiptId) ||
    !/^app\/src\/[a-zA-Z0-9_./-]+\.(?:js|ts)$/.test(receipt.appModulePath || '') ||
    !isAbsolute(receipt.bridgeSourcePath || '') ||
    !/^[a-f0-9]{64}$/.test(receipt.bridgeSourceSha256 || '') ||
    receipt.productionRelayDisabled !== true ||
    !['isolated-database', 'mock-fixture'].includes(receipt.mode)
  )
    throw new Error('Reviewed current source/isolation evidence required');
  const origin = new URL(receipt.apiOrigin);
  if (
    origin.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(origin.hostname) ||
    !origin.port ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('Loopback bridge origin required');
  if (
    !Array.isArray(receipt.fixtureActors) ||
    receipt.fixtureActors.length !== 3 ||
    !receipt.fixtureActors.every(Number.isInteger) ||
    [...receipt.fixtureActors].sort().join(',') !== '701,702,703'
  )
    throw new Error('Only existing fixture actors allowed');
  return receipt;
}
function verifySource(receipt, runtime, io) {
  const root = io.realpathSync(receipt.sourceRoot);
  if (!io.lstatSync(root).isDirectory() || !runtime.loadedSourceModuleUrl) throw new Error('Actual loaded source module required');
  const loaded = io.realpathSync(fileURLToPath(runtime.loadedSourceModuleUrl));
  if (loaded !== join(root, receipt.appModulePath)) throw new Error('Bridge must use exact fixed APP server module');
  const expected = receipt.expectedSourceFiles;
  if (
    !expected ||
    typeof expected !== 'object' ||
    Array.isArray(expected) ||
    !Object.keys(expected).length ||
    Object.keys(expected).length > 2000
  )
    throw new Error('Pinned source tree receipt required');
  for (const required of ['app/src/server.js', 'app/src/worker.ts', 'package.json', 'package-lock.json', 'web/package-lock.json'])
    if (!Object.hasOwn(expected, required)) throw new Error('Incomplete source receipt');
  if (!Object.hasOwn(expected, receipt.appModulePath)) throw new Error('Loaded module missing from fixed source receipt');
  for (const [path, hash] of Object.entries(expected)) {
    if (
      !/^[a-f0-9]{64}$/.test(hash) ||
      isAbsolute(path) ||
      path.split('/').some((p) => !p || p === '..' || p === '.' || /^\.env(?:\.|$)/.test(p))
    )
      throw new Error('Unsafe source receipt entry');
    const absolute = join(root, path);
    const rel = relative(root, io.realpathSync(absolute));
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Source escapes root');
    const stat = io.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink?.() || stat.size > 8 * 1024 ** 2 || sha(io.readFileSync(absolute)) !== hash)
      throw new Error('Source hash mismatch');
  }
  for (const [path, hash] of Object.entries(appLockfilePins)) if (expected[path] !== hash) throw new Error('Fixed APP lockfile mismatch');
  const walk = (prefix) => {
    const stat = io.lstatSync(join(root, prefix));
    if (!stat.isDirectory() || stat.isSymbolicLink?.()) throw new Error('Source directory must be regular');
    for (const name of io.readdirSync(join(root, prefix))) {
      if (!name || name.includes('/') || name.includes('\\') || name === '..' || name === '.') throw new Error('Unsafe source tree');
      const path = `${prefix}/${name}`;
      const entry = io.lstatSync(join(root, path));
      if (entry.isSymbolicLink?.()) throw new Error('Source symlink forbidden');
      if (entry.isDirectory()) walk(path);
      else if (!entry.isFile() || !Object.hasOwn(expected, path)) throw new Error('Unexpected source tree entry');
    }
  };
  walk('app/src');
  walk('app/data');
}
function verifyContext(receipt, runtime, request, io, system) {
  if (
    system.platform() !== 'linux' ||
    !/^24\./.test(system.nodeVersion?.() || '') ||
    system.hostname() === 'skyhong-SM' ||
    io.readFileSync('/etc/machine-id', 'utf8').trim() !== receipt.mintMachineId
  )
    throw new Error('Actual Mint Linux identity mismatch');
  const address = runtime.serverAddress;
  const origin = new URL(receipt.apiOrigin);
  if (
    !address ||
    !loopback(address.address) ||
    address.port !== Number(origin.port) ||
    !loopback(request.socket?.localAddress) ||
    !loopback(request.socket?.remoteAddress) ||
    request.socket?.localPort !== address.port ||
    request.headers?.host !== origin.host ||
    runtime.productionRelayDisabled !== true ||
    runtime.isolationReceiptId !== receipt.isolationReceiptId
  )
    throw new Error('Live loopback bridge isolation mismatch');
  const bridge = io.realpathSync(fileURLToPath(runtime.loadedBridgeModuleUrl));
  const bridgeStat = io.lstatSync(receipt.bridgeSourcePath);
  if (
    bridge !== io.realpathSync(receipt.bridgeSourcePath) ||
    !bridgeStat.isFile() ||
    bridgeStat.isSymbolicLink?.() ||
    bridgeStat.size > 1024 ** 2 ||
    sha(io.readFileSync(bridge)) !== receipt.bridgeSourceSha256 ||
    runtime.publicDataSource !== 'in-process-fixture' ||
    !Array.isArray(runtime.upstreamOrigins) ||
    runtime.upstreamOrigins.length !== 0
  )
    throw new Error('Reviewed fixture-only bridge source/config required');
  verifySource(receipt, runtime, io);
  return JSON.stringify([system.platform(), system.nodeVersion(), system.hostname(), receipt.mintMachineId]);
}
function databaseBinding(receipt, runtime, runtimeProof) {
  const db = receipt.database;
  if (
    runtime.mode !== 'isolated-database' ||
    runtime.databaseConnectionPresent !== true ||
    !db ||
    !['127.0.0.1', '::1'].includes(db.host) ||
    db.database !== 'tag_f1_semantic_test' ||
    !Number.isInteger(db.port) ||
    db.port < 1 ||
    db.port > 65535 ||
    !Number.isInteger(db.serverPort) ||
    db.serverPort < 1 ||
    db.serverPort > 65535 ||
    runtime.identityConnectionScope !== 'dedicated-readonly' ||
    typeof runtime.getConnectionMetadata !== 'function' ||
    typeof runtime.queryDatabaseIdentity !== 'function' ||
    typeof runtime.cancelReadonlyIdentity !== 'function'
  )
    throw new Error('Live isolated database adapter required');
  const actual = runtime.getConnectionMetadata();
  if (!actual || actual.host !== db.host || actual.port !== db.port || actual.database !== db.database || actual.socketPath)
    throw new Error('Database connection isolation mismatch');
  return {
    key: JSON.stringify([
      receipt[receiptBytesIdentity],
      actual.host,
      actual.port,
      actual.database,
      runtimeProof,
      runtime.mode,
      [runtime.serverAddress.address, runtime.serverAddress.port, runtime.serverAddress.family],
      runtime.loadedSourceModuleUrl,
      runtime.loadedBridgeModuleUrl,
      runtime.isolationReceiptId,
    ]),
    metadata: runtime.getConnectionMetadata,
    query: runtime.queryDatabaseIdentity,
    cancel: runtime.cancelReadonlyIdentity,
  };
}
const sameBinding = (a, b) => a.key === b.key && a.metadata === b.metadata && a.query === b.query && a.cancel === b.cancel;
async function databaseProof(receipt, runtime, timeoutMs, state, runtimeProof) {
  const binding = databaseBinding(receipt, runtime, runtimeProof);
  let flight = state.flight;
  if (flight) {
    if (flight.resultSettled || flight.timedOut) throw unavailable('identity-quarantined');
    if (!sameBinding(flight.binding, binding)) throw unavailable('identity-inflight-mismatch');
    if (flight.waiters >= 8) throw unavailable('identity-waiter-limit');
  } else {
    flight = { binding, waiters: 0, querySettled: false, cancelSettled: true, resultSettled: false, timedOut: false };
    state.flight = flight;
    const controller = new AbortController();
    const clearIfSafe = () => {
      if (flight.querySettled && flight.cancelSettled && flight.resultSettled && state.flight === flight) state.flight = null;
    };
    const query = Promise.resolve()
      .then(() => binding.query.call(runtime, databaseIdentitySql, { signal: controller.signal }))
      .catch(() => {
        throw unavailable('identity-query-failed');
      });
    query.then(
      () => {
        flight.querySettled = true;
        clearIfSafe();
      },
      () => {
        flight.querySettled = true;
        clearIfSafe();
      },
    );
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        flight.timedOut = true;
        flight.cancelSettled = false;
        controller.abort();
        // Cancel only the reserved readonly connection; no business pool is touched.
        Promise.resolve()
          .then(() => binding.cancel.call(runtime, { signal: controller.signal }))
          .then(
            (confirmed) => {
              if (confirmed === true) {
                flight.cancelSettled = true;
                clearIfSafe();
              }
            },
            () => {},
          );
        reject(unavailable('identity-timeout'));
      }, timeoutMs);
    });
    flight.promise = Promise.race([query, timeout])
      .then((rows) => {
        if (
          !Array.isArray(rows) ||
          rows.length !== 1 ||
          rows[0].databaseName !== receipt.database.database ||
          Number(rows[0].serverPort) !== receipt.database.serverPort
        )
          throw unavailable('identity-result-mismatch');
      })
      .finally(() => {
        clearTimeout(timer);
        flight.resultSettled = true;
        clearIfSafe();
      });
  }
  flight.waiters++;
  try {
    await flight.promise;
  } finally {
    flight.waiters--;
  }
  // Each waiter rechecks its own actual connection; the fulfilled result is never a cache.
  if (!sameBinding(binding, databaseBinding(receipt, runtime, runtimeProof)))
    throw new Error('Database identity changed during verification');
  return binding;
}
export function createMintReadinessHandler(
  { receiptPath, getRuntime, databaseTimeoutMs = 2000, onDiagnostic } = {},
  {
    io = defaultIo,
    system = { platform, hostname, nodeVersion: () => process.versions.node },
    uid = process.getuid(),
    now = Date.now,
  } = {},
) {
  const identityState = { flight: null }; // At most eight same-identity waiters, one live readonly query; no result cache.
  return async function readiness(request, response) {
    if (request.url !== readinessPath) return false; // Caller chooses whether to register this local route.
    const send = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(data));
      return true;
    };
    if (request.method !== 'GET') return send(405, { ready: false });
    let phase = 'receipt';
    try {
      if (onDiagnostic !== undefined && typeof onDiagnostic !== 'function') throw new Error('Owner diagnostic callback required');
      const receipt = receiptFromFile(receiptPath, io, uid, now());
      if (typeof getRuntime !== 'function') throw new Error('Live bridge runtime required');
      phase = 'runtime-source-isolation';
      const runtime = getRuntime();
      const runtimeProof = verifyContext(receipt, runtime, request, io, system);
      if (!Number.isFinite(databaseTimeoutMs) || databaseTimeoutMs <= 0 || databaseTimeoutMs > 5000)
        throw new Error('Bounded database timeout required');
      phase = 'database-identity';
      let checkedDatabase;
      if (receipt.mode === 'isolated-database')
        checkedDatabase = await databaseProof(receipt, runtime, databaseTimeoutMs, identityState, runtimeProof);
      else if (
        runtime.mode !== 'mock-fixture' ||
        runtime.databaseConnectionPresent !== false ||
        runtime.mockFixtureVerified !== true ||
        runtime.productionRelayDisabled !== true ||
        !nonempty(receipt.mockFixtureReceiptId) ||
        runtime.mockFixtureReceiptId !== receipt.mockFixtureReceiptId
      )
        throw new Error('Explicit reviewed mock-only fixture required');
      phase = 'post-await-verification';
      const currentReceipt = receiptFromFile(receiptPath, io, uid, now());
      if (currentReceipt[receiptBytesIdentity] !== receipt[receiptBytesIdentity]) throw new Error('Receipt changed during verification');
      const currentRuntime = getRuntime();
      const currentRuntimeProof = verifyContext(currentReceipt, currentRuntime, request, io, system);
      if (currentRuntimeProof !== runtimeProof) throw new Error('Runtime identity changed during verification');
      if (checkedDatabase && !sameBinding(checkedDatabase, databaseBinding(currentReceipt, currentRuntime, currentRuntimeProof)))
        throw new Error('Runtime identity changed during verification');
      if (Date.parse(receipt.expiresAt) <= now()) throw new Error('Readiness receipt expired during verification');
      return send(200, {
        machineId: receipt.mintMachineId,
        appSha: initialAppSha,
        scope: receipt.mode === 'isolated-database' ? 'mint-f1-isolated' : 'mint-f1-isolated-mock',
        databaseScope: receipt.mode === 'isolated-database' ? 'isolated' : 'mock-fixture',
        productionDatabase: false,
        isolationReceiptId: receipt.isolationReceiptId,
      });
    } catch (error) {
      // Optional owner-private enum sink only; never relay error messages, SQL, metadata or secrets.
      if (typeof onDiagnostic === 'function')
        try {
          const diagnostic = onDiagnostic({
            schema: 'mint-f1-readiness-diagnostic-v1',
            phase,
            reason: diagnosticReasons.has(error?.readinessReason) ? error.readinessReason : 'verification-failed',
          });
          if (diagnostic?.then) Promise.resolve(diagnostic).catch(() => {});
        } catch {}
      return send(503, { ready: false, error: 'readiness-unavailable' });
    }
  };
}
