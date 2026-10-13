// Mint-only fixture API. Existing fixture users, real isolated SQL handlers;
// no real OAuth, production upstream, worker, crawler, account or grant creation.
import http from 'node:http';
import { readFileSync, lstatSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { platform, hostname } from 'node:os';
import { createMintReadinessHandler } from './mint-f1-readiness.js';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import { appLockfilePins } from './mint-f1-artifact.js';

export function privateJson(path, io = { lstatSync, readFileSync }, uid = process.getuid(), maxBytes = 65536) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 ** 2) throw Error('Bounded configuration size required');
  if (!isAbsolute(path || '')) throw Error('Absolute private configuration required');
  const s = io.lstatSync(path);
  if (!s.isFile() || s.isSymbolicLink() || s.uid !== uid || (s.mode & 0o077) || s.size > maxBytes) throw Error('Private owner-only configuration required');
  return JSON.parse(io.readFileSync(path, 'utf8'));
}
export function validateConfig(c) {
  if (!c || c.schema !== 'mint-f1-api-bootstrap-v1' || c.reviewed !== true
    || !isAbsolute(c.sourceRoot || '') || !isAbsolute(c.databaseConfigPath || '') || !isAbsolute(c.readinessReceiptPath || '')) throw Error('Reviewed fixture bootstrap required');
  const api = new URL(c.apiOrigin); const publicOrigin = new URL(c.publicOrigin);
  const parts = publicOrigin.hostname.split('.').map(Number);
  const privatePreview = publicOrigin.hostname === '127.0.0.1' || parts.length === 4 && parts.every(Number.isInteger) && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127 && parts.slice(2).every(n => n >= 0 && n <= 255);
  if (api.protocol !== 'http:' || api.hostname !== '127.0.0.1' || !api.port || api.username || api.password
    || api.pathname !== '/' || api.search || api.hash || publicOrigin.protocol !== 'http:' || publicOrigin.username || publicOrigin.password
    || !privatePreview || !publicOrigin.port || publicOrigin.pathname !== '/' || publicOrigin.search || publicOrigin.hash) throw Error('Explicit isolated origins required');
  return c;
}
export function sourceBeforeImport(receipt, root, io = { readFileSync, lstatSync, realpathSync, readdirSync }, now = Date.now()) {
  if (receipt.schema !== 'mint-f1-readiness-v1' || receipt.reviewed !== true || receipt.appSha !== initialAppSha
    || receipt.mode !== 'isolated-database' || receipt.productionRelayDisabled !== true || !receipt.sourceReceiptId || !receipt.isolationReceiptId
    || !Number.isFinite(Date.parse(receipt.expiresAt)) || Date.parse(receipt.expiresAt) <= now
    || receipt.mintMachineId === receipt.smMachineId || !receipt.smMachineId || receipt.appModulePath !== 'app/src/app.js') throw Error('Current reviewed fixed source receipt required');
  const digest = value => createHash('sha256').update(value).digest('hex');
  const expected = receipt.expectedSourceFiles;
  if (!expected || typeof expected !== 'object' || Array.isArray(expected) || !Object.keys(expected).length || Object.keys(expected).length > 2000) throw Error('Source inventory required before import');
  for (const path of ['app/src/app.js', 'app/src/db/client.ts', 'app/src/auth/google-login.ts', 'app/src/server.js', 'app/src/worker.ts', 'package.json', ...Object.keys(appLockfilePins)]) if (!Object.hasOwn(expected, path)) throw Error('Incomplete source inventory');
  for (const [path, hash] of Object.entries(expected)) {
    if (!/^[a-f0-9]{64}$/.test(hash) || isAbsolute(path) || path.split('/').some(x => !x || x === '.' || x === '..' || x.startsWith('.env'))) throw Error('Unsafe source inventory');
    const file = join(root, path); const stat = io.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 ** 2 || !io.realpathSync(file).startsWith(root + '/') || digest(io.readFileSync(file)) !== hash) throw Error('Source differs before import');
  }
  for (const [path, hash] of Object.entries(appLockfilePins)) if (expected[path] !== hash) throw Error('APP lockfile identity mismatch');
  const bridge = io.realpathSync(fileURLToPath(import.meta.url));
  if (io.realpathSync(receipt.bridgeSourcePath) !== bridge || digest(io.readFileSync(bridge)) !== receipt.bridgeSourceSha256) throw Error('Bridge differs from reviewed source');
}
export function validateDatabase(c) {
  if (!c || c.host !== '127.0.0.1' || c.database !== 'tag_f1_semantic_test' || c.port !== 18306
    || typeof c.user !== 'string' || !c.user || typeof c.password !== 'string' || c.socketPath) throw Error('Only isolated loopback fixture database permitted');
  return { host: c.host, port: c.port, database: c.database, user: c.user, password: c.password };
}
export function existingActors(rows) {
  if (!Array.isArray(rows) || rows.length !== 3 || rows.map(r => r.id).join(',') !== '701,702,703'
    || rows.some(r => typeof r.email !== 'string' || !r.email.endsWith('@fixture.test'))) throw Error('Existing fixture users only; never create accounts');
  return Object.fromEntries(['reader', 'other', 'admin'].map((key, i) => [key, { id: rows[i].id, sub: rows[i].google_sub, email: rows[i].email, name: rows[i].name, picture: null }]));
}
export function allowedPath(path, method) {
  if (/^\/auth\/(?:google|users|logout)(?:\/|$)/.test(path) || /^\/auth\/admin\/(?:users|user-grants)(?:\/|$)/.test(path)) return false;
  if (/^\/auth\/admin\/(?:crawl|jobs|db)(?:\/|$)/.test(path)) return false;
  return /^\/api\/v1(?:\/|$)/.test(path) && method === 'GET'
    || path === '/api/status' && method === 'GET'
    || /^\/auth\/(?:me|tags|pictures|admin\/(?:tags|tag-submissions|tag-relations|tag-groups|tag-visuals))(?:\/|$)/.test(path);
}
export async function body(request, limit = 8 * 1024 ** 2) {
  const chunks = []; let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > limit) throw Error('Fixture request body limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}
// A separate identity connection is never used for business requests. Aborting
// it destroys only its own transport; mysql2 receives the fatal stream error.
export function readonlyIdentityAdapter(connection) {
  const raw = connection.connection;
  let cancelled = false;
  return {
    getConnectionMetadata: () => ({ host: raw.stream.remoteAddress, port: raw.stream.remotePort, database: raw.config.database, socketPath: raw.config.socketPath }),
    queryDatabaseIdentity: async (sql, { signal }) => {
      if (cancelled || signal.aborted) throw Error('Identity connection unavailable');
      const abort = () => { cancelled = true; raw.stream.destroy(Error('Readonly identity cancelled')); };
      signal.addEventListener('abort', abort, { once: true });
      try { const [rows] = await connection.query(sql); return rows; }
      finally { signal.removeEventListener('abort', abort); }
    },
    cancelReadonlyIdentity: async () => {
      cancelled = true;
      if (!raw.stream.closed) {
        await new Promise((done, fail) => {
          const timer = setTimeout(() => fail(Error('Identity transport cleanup unconfirmed')), 1000);
          raw.stream.once('close', () => { clearTimeout(timer); done(); });
          raw.stream.destroy(Error('Readonly identity cancelled'));
        });
      }
      return raw.stream.closed === true;
    },
  };
}
export async function startApi(config, dependencies = {}) {
  validateConfig(config);
  const io = dependencies.io || { lstatSync, readFileSync, realpathSync, readdirSync };
  const system = dependencies.system || { platform, hostname, nodeVersion: () => process.versions.node };
  const receipt = privateJson(config.readinessReceiptPath, io, process.getuid(), 1024 ** 2);
  if (system.platform() !== 'linux' || !/^24\./.test(system.nodeVersion?.() || '') || system.hostname() === 'skyhong-SM'
    || io.readFileSync('/etc/machine-id', 'utf8').trim() !== receipt.mintMachineId || config.apiOrigin !== receipt.apiOrigin) throw Error('Actual reviewed Mint identity required');
  const dbConfig = validateDatabase(privateJson(config.databaseConfigPath, io));
  const root = io.realpathSync(config.sourceRoot);
  if (root !== io.realpathSync(receipt.sourceRoot) || receipt.appModulePath !== 'app/src/app.js') throw Error('Exact reviewed APP source root required');
  sourceBeforeImport(receipt, root, io);
  const require = createRequire(join(root, 'package.json'));
  const mysql = dependencies.mysql || require('mysql2/promise');
  const appUrl = pathToFileURL(join(root, 'app/src/app.js')).href;
  const { buildApp } = await (dependencies.importModule || (url => import(url)))(appUrl);
  const { createDb } = await (dependencies.importModule || (url => import(url)))(pathToFileURL(join(root, 'app/src/db/client.ts')).href);
  const { hashToken } = await (dependencies.importModule || (url => import(url)))(pathToFileURL(join(root, 'app/src/auth/google-login.ts')).href);
  const url = `mysql://${encodeURIComponent(dbConfig.user)}:${encodeURIComponent(dbConfig.password)}@127.0.0.1:18306/tag_f1_semantic_test`;
  const own = createDb(url, { poolSize: 2 });
  let identity; let app; let server;
  const cleanup = async () => {
    if (server?.listening) { server.closeAllConnections?.(); await new Promise(done => server.close(done)); }
    await app?.close().catch(() => {});
    await identity?.end().catch(() => {});
    await own.close();
  };
  try {
    const [[database]] = await own.pool.query('SELECT DATABASE() AS databaseName, VERSION() AS serverVersion');
    if (database.databaseName !== 'tag_f1_semantic_test' || typeof receipt.database?.serverVersion !== 'string'
      || !receipt.database.serverVersion.includes('MariaDB') || database.serverVersion !== receipt.database.serverVersion) throw Error('Unexpected fixture schema or actual server version');
    const [users] = await own.pool.query('SELECT id,google_sub,email,name FROM users ORDER BY id');
    const actors = existingActors(users);
    const forbidden = async () => { throw Error('Fixture authentication mutation forbidden'); };
    const store = { upsertUser: forbidden, createSession: forbidden, deleteSession: forbidden, listUsers: forbidden, setAdmin: forbidden,
      sessionUser: async hash => Object.entries(actors).find(([key]) => hashToken('f1-fixture-' + key) === hash)?.[1] ?? null };
    const disabledQueue = () => ({ add: async () => { throw Error('Isolated worker unavailable; not an image workflow pass'); }, getJob: async () => null, getJobs: async () => [] });
    app = await buildApp({ uiOrigin: 'http://127.0.0.1:9', login: { clientId: 'isolated-fixture', clientSecret: 'isolated-fixture', origin: config.publicOrigin, admins: new Set([actors.admin.email]) } }, { db: own.db, loginStore: store, jobQueue: disabledQueue });
    await app.ready();
    identity = await mysql.createConnection({ ...dbConfig, connectTimeout: 5000 });
    const identityAdapter = readonlyIdentityAdapter(identity);
    const ready = createMintReadinessHandler({ receiptPath: config.readinessReceiptPath, getRuntime: () => ({
      serverAddress: server.address(), loadedSourceModuleUrl: appUrl, loadedBridgeModuleUrl: import.meta.url,
      productionRelayDisabled: true, publicDataSource: 'in-process-fixture', upstreamOrigins: [], isolationReceiptId: receipt.isolationReceiptId,
      mode: 'isolated-database', databaseConnectionPresent: true, identityConnectionScope: 'dedicated-readonly', ...identityAdapter,
    }) }, { io, system, uid: process.getuid() });
    server = (dependencies.http || http).createServer(async (request, response) => {
      const send = (status, data) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'private, no-store' }); response.end(JSON.stringify(data)); };
      try {
        if (await ready(request, response)) return;
        if (!['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) return send(403, { error: 'fixture-only' });
        if (!request.url.startsWith('/') || request.url.startsWith('//')) return send(400, { error: 'fixture-path-required' });
        const path = new URL(request.url, config.apiOrigin).pathname;
        if (!allowedPath(path, request.method)) return send(403, { error: 'fixture-path-not-enabled' });
        const actor = request.headers['x-f1-fixture-actor'] || 'anonymous';
        if (!['anonymous', 'reader', 'other', 'admin'].includes(actor)) return send(400, { error: 'unknown-fixture-actor' });
        const headers = { ...request.headers };
        for (const key of ['cookie', 'authorization', 'x-api-key', 'x-service-token', 'x-f1-fixture-actor', 'cf-connecting-ip', 'x-forwarded-for', 'x-forwarded-proto', 'connection', 'transfer-encoding', 'content-length']) delete headers[key];
        if (actor !== 'anonymous') headers.cookie = 'tag_session=f1-fixture-' + actor;
        const payload = await body(request);
        const result = await app.inject({ method: request.method, url: request.url, headers, ...(payload.length ? { payload } : {}) });
        const resultHeaders = { ...result.headers, 'cache-control': 'private, no-store', 'x-f1-data-scope': 'real-isolated-fixture-database' };
        for (const key of ['set-cookie', 'connection', 'transfer-encoding', 'content-length']) delete resultHeaders[key];
        response.writeHead(result.statusCode, resultHeaders); response.end(result.rawPayload);
      } catch { if (!response.headersSent) send(503, { error: 'fixture-unavailable' }); else response.destroy(); }
    });
    await new Promise((done, fail) => { server.once('error', fail); server.listen(Number(new URL(config.apiOrigin).port), '127.0.0.1', done); });
    return { server, app, close: cleanup };
  } catch (error) { await cleanup(); throw error; }
}
export async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== '--start') throw Error('Usage: node tools/mint-f1-api-bootstrap.js --start PRIVATE_BOOTSTRAP_JSON');
  const runtime = await startApi(privateJson(resolve(argv[1])));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => runtime.close().then(() => process.exit(0)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { process.stderr.write('Mint fixture API startup unavailable; private configuration retained.\n'); process.exitCode = 1; });
