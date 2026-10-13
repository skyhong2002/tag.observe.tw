import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { privateJson, validateConfig, validateDatabase, existingActors, allowedPath, body,
  readonlyIdentityAdapter, sourceBeforeImport, startApi } from './mint-f1-api-bootstrap.js';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import { verifyIsolatedApi } from './mint-f1-execution.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bridge = fileURLToPath(new URL('./mint-f1-api-bootstrap.js', import.meta.url));
const config = () => ({ schema: 'mint-f1-api-bootstrap-v1', reviewed: true, sourceRoot: '/source',
  databaseConfigPath: '/private/db.json', readinessReceiptPath: '/private/readiness.json',
  apiOrigin: 'http://127.0.0.1:18131', publicOrigin: 'http://100.108.108.109:18196' });
const database = () => ({ host: '127.0.0.1', port: 18306, database: 'tag_f1_semantic_test', user: 'fixture', password: 'mock-only' });
function fixture() {
  const files = new Map([[bridge, readFileSync(bridge)], ['/etc/machine-id', 'mint-id\n']]);
  for (const p of ['app/src/app.js', 'app/src/server.js', 'app/src/worker.ts', 'app/src/db/client.ts', 'app/src/auth/google-login.ts', 'package.json']) files.set('/source/' + p, Buffer.from('fixture-source-' + p));
  files.set('/source/app/data/fixture.json', Buffer.from('{}'));
  for (const p of ['package-lock.json', 'web/package-lock.json']) files.set('/source/' + p, readFileSync(new URL('../' + p, import.meta.url)));
  const receipt = { schema: 'mint-f1-readiness-v1', reviewed: true, expiresAt: new Date(Date.now() + 60000).toISOString(),
    appSha: initialAppSha, mintMachineId: 'mint-id', smMachineId: 'sm-id', mode: 'isolated-database',
    productionRelayDisabled: true, sourceRoot: '/source', appModulePath: 'app/src/app.js', apiOrigin: config().apiOrigin,
    fixtureActors: [701, 702, 703], database: { host: '127.0.0.1', port: 18306, serverPort: 18306, serverVersion: '10.11.14-MariaDB-fixture', database: 'tag_f1_semantic_test' }, sourceReceiptId: 'mock-source-review', isolationReceiptId: 'mock-isolation-review', bridgeSourcePath: bridge,
    bridgeSourceSha256: sha(files.get(bridge)), expectedSourceFiles: Object.fromEntries([...files].filter(([p]) => p.startsWith('/source/')).map(([p, bytes]) => [p.slice(8), sha(bytes)])) };
  const dirs = new Set(['/source', '/source/app/src', '/source/app/src/db', '/source/app/src/auth', '/source/app/data']);
  const io = { readFileSync: (p, encoding) => {
    const bytes = p === '/private/readiness.json' ? JSON.stringify(receipt) : p === '/private/db.json' ? JSON.stringify(database()) : files.get(p);
    if (bytes === undefined) throw Error('missing'); return encoding ? Buffer.from(bytes).toString() : Buffer.from(bytes);
  }, lstatSync: p => ({ uid: process.getuid(), mode: 0o100600, size: dirs.has(p) ? 0 : io.readFileSync(p).length,
    isFile: () => !dirs.has(p), isDirectory: () => dirs.has(p), isSymbolicLink: () => false }), realpathSync: p => p,
    readdirSync: p => [...new Set([...files.keys(), ...dirs].filter(f => f.startsWith(p + '/')).map(f => f.slice(p.length + 1).split('/')[0]))] };
  const users = [701, 702, 703].map(id => ({ id, google_sub: 'fixture-' + id, email: id + '@fixture.test', name: 'Fixture ' + id }));
  const counts = { businessQueries: [], imports: [], identityConnect: 0, appClose: 0, poolClose: 0, identityClose: 0, injected: [] };
  const app = { ready: async () => {}, close: async () => { counts.appClose++; }, inject: async request => {
    counts.injected.push(request); return { statusCode: 200, headers: { 'cache-control': 'public, max-age=60', 'set-cookie': 'secret-cookie' }, rawPayload: Buffer.from('{}') };
  } };
  const pool = { query: async sql => { counts.businessQueries.push(sql); return sql.includes('FROM users') ? [users] : [[{ databaseName: 'tag_f1_semantic_test', serverVersion: '10.11.14-MariaDB-fixture' }]]; } };
  const rawStream = new EventEmitter(); Object.assign(rawStream, { remoteAddress: '127.0.0.1', remotePort: 18306, closed: false });
  rawStream.destroy = () => { rawStream.closed = true; rawStream.emit('close'); };
  const connection = { connection: { stream: rawStream, config: { database: 'tag_f1_semantic_test' } }, query: async () => [[{ databaseName: 'tag_f1_semantic_test', serverPort: 18306 }]], end: async () => { counts.identityClose++; } };
  const server = new EventEmitter(); Object.assign(server, { listening: false, listen: (port, host, done) => { server.listening = true; assert.equal(host, '127.0.0.1'); done(); }, close: done => { server.listening = false; done(); }, closeAllConnections: () => {}, address: () => ({ address: '127.0.0.1', port: 18131 }) });
  const dependencies = { io, system: { platform: () => 'linux', hostname: () => 'Mint-MBP', nodeVersion: () => '24.15.0' },
    mysql: { createConnection: async options => { counts.identityConnect++; assert.deepEqual(options, { ...database(), connectTimeout: 5000 }); return connection; } },
    importModule: async url => { counts.imports.push(url); return url.endsWith('app.js') ? { buildApp: async (options, deps) => { counts.appOptions = options; counts.appDeps = deps; return app; } }
      : url.endsWith('client.ts') ? { createDb: (url, options) => { assert.match(url, /^mysql:\/\/fixture:mock-only@127\.0\.0\.1:18306\/tag_f1_semantic_test$/); assert.deepEqual(options, { poolSize: 2 }); return { pool, db: {}, close: async () => { counts.poolClose++; } }; } }
        : { hashToken: value => 'hashed-' + value }; },
    http: { createServer: handler => { server.handler = handler; return server; } },
  };
  return { files, io, receipt, users, counts, app, connection, server, dependencies };
}
test('private config accepts only owner regular restricted small files', () => {
  const f = fixture(); assert.equal(privateJson('/private/db.json', f.io).host, '127.0.0.1');
  for (const change of [{ mode: 0o100644 }, { uid: process.getuid() + 1 }, { size: 70000 }, { isSymbolicLink: () => true }]) {
    assert.throws(() => privateJson('/private/db.json', { ...f.io, lstatSync: p => ({ ...f.io.lstatSync(p), ...change }) }));
  }
  assert.throws(() => privateJson('relative', f.io));
});
test('only explicit Mint private preview and dedicated loopback SQL are admitted', () => {
  assert.equal(validateConfig(config()).reviewed, true); assert.equal(validateDatabase(database()).database, 'tag_f1_semantic_test');
  for (const publicOrigin of ['https://tag.observe.tw', 'http://100.1.2.3:18196', 'http://100.108.108.109:18196/?q=x']) assert.throws(() => validateConfig({ ...config(), publicOrigin }));
  for (const apiOrigin of ['http://0.0.0.0:18131', 'http://100.108.108.109:18131', 'http://127.0.0.1:18131?upstream=x']) assert.throws(() => validateConfig({ ...config(), apiOrigin }));
  for (const change of [{ host: 'production' }, { port: 3306 }, { database: 'tag_observe' }, { socketPath: '/db.sock' }]) assert.throws(() => validateDatabase({ ...database(), ...change }));
});
test('pre-import source validation rejects tampering, missing locks, stale proof and wrong bridge', () => {
  const f = fixture(); sourceBeforeImport(f.receipt, '/source', f.io);
  for (const mutate of [f => { f.files.set('/source/app/src/app.js', 'modified'); }, f => { delete f.receipt.expectedSourceFiles['web/package-lock.json']; },
    f => { f.receipt.expiresAt = new Date(0).toISOString(); }, f => { f.receipt.bridgeSourceSha256 = '0'.repeat(64); }, f => { f.receipt.mode = 'mock-fixture'; }]) {
    const bad = fixture(); mutate(bad); assert.throws(() => sourceBeforeImport(bad.receipt, '/source', bad.io));
  }
});
test('existing fixture actors cannot be replaced by real users or additional roles/accounts', () => {
  const f = fixture(); assert.equal(existingActors(f.users).admin.id, 703);
  assert.throws(() => existingActors([...f.users, { id: 704, email: 'extra@fixture.test' }]));
  assert.throws(() => existingActors(f.users.map(u => ({ ...u, email: 'real@example.org' }))));
});
test('only F1 fixture routes admitted; OAuth, account grants, crawler and arbitrary proxy routes forbidden', () => {
  for (const path of ['/api/v1/tags/test/relations', '/auth/me', '/auth/tags/test/submissions', '/auth/admin/tag-submissions', '/auth/pictures/test']) assert.equal(allowedPath(path, 'GET'), true);
  for (const path of ['/auth/google/callback', '/auth/users', '/auth/admin/user-grants', '/auth/admin/users', '/auth/admin/crawl', '/auth/admin/db', '/auth/admin/jobs', '/arbitrary-proxy']) assert.equal(allowedPath(path, 'GET'), false);
  assert.equal(allowedPath('/api/v1/tags', 'POST'), false);
});
test('payload size is bounded without writing multipart contents to disk', async () => {
  assert.equal((await body(Readable.from([Buffer.from('abc')]), 3)).toString(), 'abc');
  await assert.rejects(body(Readable.from([Buffer.from('ab'), Buffer.from('cd')]), 3), /limit/);
});
test('Mint startup validates identity/source before imports and closes only its isolated resources', async () => {
  const f = fixture(); const runtime = await startApi(config(), f.dependencies);
  assert.equal(f.counts.imports.length, 3); assert.equal(f.counts.identityConnect, 1);
  assert.equal(f.counts.appOptions.login.admins.has('703@fixture.test'), true);
  assert.equal((await f.counts.appDeps.loginStore.sessionUser('hashed-f1-fixture-reader')).id, 701);
  await assert.rejects(f.counts.appDeps.loginStore.createSession(), /forbidden/);
  await assert.rejects(f.counts.appDeps.jobQueue().add(), /not an image workflow pass/);
  await runtime.close(); assert.equal(f.counts.appClose, 1); assert.equal(f.counts.poolClose, 1); assert.equal(f.counts.identityClose, 1);
  const bad = fixture(); bad.files.set('/etc/machine-id', 'sm-id'); await assert.rejects(startApi(config(), bad.dependencies), /Mint identity/); assert.equal(bad.counts.imports.length, 0);
  const stale = fixture(); stale.receipt.expiresAt = new Date(0).toISOString(); await assert.rejects(startApi(config(), stale.dependencies)); assert.equal(stale.counts.imports.length, 0);
});
test('fixture HTTP drops credentials/cookies, adds only existing fixture identity and always no-store', async () => {
  const f = fixture(); const runtime = await startApi(config(), f.dependencies);
  const invoke = async (url, actor = 'reader', remoteAddress = '127.0.0.1') => {
    const request = Readable.from([]); Object.assign(request, { url, method: 'GET', socket: { remoteAddress }, headers: { host: '127.0.0.1:18131', cookie: 'real-cookie', authorization: 'real-auth', 'x-api-key': 'real-key', 'x-service-token': 'real-token', 'x-f1-fixture-actor': actor } });
    const response = { writeHead: (status, headers) => { response.status = status; response.headers = headers; }, end: bytes => { response.bytes = bytes; } };
    await f.server.handler(request, response); return response;
  };
  const result = await invoke('/auth/me'); assert.equal(result.status, 200); assert.equal(result.headers['cache-control'], 'private, no-store'); assert.equal(result.headers['set-cookie'], undefined);
  assert.equal(f.counts.injected[0].headers.cookie, 'tag_session=f1-fixture-reader');
  for (const header of ['authorization', 'x-api-key', 'x-service-token', 'x-f1-fixture-actor']) assert.equal(f.counts.injected[0].headers[header], undefined);
  assert.equal((await invoke('/auth/google/callback')).status, 403); assert.equal((await invoke('/auth/me', 'reader', '100.64.1.2')).status, 403);
  assert.equal((await invoke('http://tag.observe.tw/auth/me')).status, 400); assert.equal((await invoke('//tag.observe.tw/auth/me')).status, 400);
  assert.equal((await invoke('/auth/me', 'unknown')).status, 400); assert.equal(f.counts.injected.length, 1);
  await runtime.close();
});
test('late startup failure closes application and SQL pool, without service registration', async () => {
  const f = fixture(); f.dependencies.mysql.createConnection = async () => { throw Error('mock connect failure'); };
  await assert.rejects(startApi(config(), f.dependencies), /mock connect failure/); assert.equal(f.counts.appClose, 1); assert.equal(f.counts.poolClose, 1);
});
test('startup refuses an unmeasured or substituted MariaDB version before app or listener creation', async () => {
  for (const version of [undefined, '11.4.99-MariaDB-invented']) {
    const f = fixture(); f.receipt.database.serverVersion = version;
    await assert.rejects(startApi(config(), f.dependencies), /actual server version/);
    assert.equal(f.counts.poolClose, 1); assert.equal(f.counts.appOptions, undefined);
    assert.equal(f.server.listening, false); assert.equal(f.counts.identityConnect, 0);
  }
});
test('readonly identity cancellation destroys only reserved transport and confirms closed before reuse', async () => {
  const f = fixture(); const adapter = readonlyIdentityAdapter(f.connection);
  assert.deepEqual(adapter.getConnectionMetadata(), { host: '127.0.0.1', port: 18306, database: 'tag_f1_semantic_test', socketPath: undefined });
  const controller = new AbortController(); await adapter.queryDatabaseIdentity('SELECT identity', { signal: controller.signal });
  assert.equal(await adapter.cancelReadonlyIdentity(), true); assert.equal(f.connection.connection.stream.closed, true);
  assert.equal(f.counts.poolClose, 0); await assert.rejects(adapter.queryDatabaseIdentity('SELECT identity', { signal: controller.signal }), /unavailable/);
});
test('complete large source receipt starts and actual readiness handler matches executor through mocked transports', async () => {
  const f = fixture();
  // Real fixed APP has 1231 receipt entries. Regression for the old 64 KiB
  // reader limit, using virtual source bytes only, without copying any files.
  for (let n = Object.keys(f.receipt.expectedSourceFiles).length; n < 1231; n++) {
    const path = 'app/src/long-reviewed-module-name-' + String(n).padStart(5, '0') + '.js';
    f.files.set('/source/' + path, Buffer.from('fixture-' + n)); f.receipt.expectedSourceFiles[path] = sha(f.files.get('/source/' + path));
  }
  assert.ok(JSON.stringify(f.receipt).length > 128000);
  assert.throws(() => privateJson('/private/readiness.json', f.io));
  assert.equal(privateJson('/private/readiness.json', f.io, process.getuid(), 1024 ** 2).appSha, initialAppSha);
  const runtime = await startApi(config(), f.dependencies);
  const request = { url: '/internal/mint-f1-readiness', method: 'GET', headers: { host: '127.0.0.1:18131' },
    socket: { localAddress: '127.0.0.1', remoteAddress: '127.0.0.1', localPort: 18131 } };
  const response = { writeHead: (status, headers) => { response.status = status; response.headers = headers; }, end: bytes => { response.bytes = bytes; } };
  await f.server.handler(request, response);
  assert.equal(response.status, 200); assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(JSON.parse(response.bytes), { machineId: 'mint-id', appSha: initialAppSha, scope: 'mint-f1-isolated',
    databaseScope: 'isolated', productionDatabase: false, isolationReceiptId: 'mock-isolation-review' });
  assert.equal(await verifyIsolatedApi({ hostReceipt: { api: { origin: config().apiOrigin, isolationReceiptId: 'mock-isolation-review' } } },
    { apiOrigin: config().apiOrigin, snapshot: { machineId: 'mint-id' } }, async () => new Response(response.bytes)), true);
  assert.equal(f.counts.injected.length, 0); await runtime.close();
});
