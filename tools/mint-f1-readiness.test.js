import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createMintReadinessHandler, readinessPath, databaseIdentitySql } from './mint-f1-readiness.js';
import { verifyIsolatedApi } from './mint-f1-execution.js';
import { initialAppSha } from './mint-f1-candidate-plan.js';
const digest = data => createHash('sha256').update(data).digest('hex');
const rootLock = readFileSync(new URL('../package-lock.json', import.meta.url));
const webLock = readFileSync(new URL('../web/package-lock.json', import.meta.url));
function fixture(mode = 'isolated-database') {
 const files = new Map([['/etc/machine-id', 'mint-id\n'], ['/bridge/fixture.js', 'reviewed fixture-only bridge'], ['/source/app/src/server.js', 'server'], ['/source/app/src/worker.ts', 'worker'], ['/source/app/data/vocab.json', '{}'], ['/source/package.json', '{}'], ['/source/package-lock.json', rootLock], ['/source/web/package-lock.json', webLock]]);
 const expectedSourceFiles = Object.fromEntries([...files].filter(([p]) => p.startsWith('/source/')).map(([p, bytes]) => [p.slice(8), digest(bytes)]));
 const receipt = { schema: 'mint-f1-readiness-v1', reviewed: true, expiresAt: new Date(Date.now() + 60000).toISOString(), appSha: initialAppSha, mintMachineId: 'mint-id', smMachineId: 'sm-id', isolationReceiptId: 'api-review', sourceReceiptId: 'source-review', sourceRoot: '/source', appModulePath: 'app/src/server.js', expectedSourceFiles, bridgeSourcePath: '/bridge/fixture.js', bridgeSourceSha256: digest(files.get('/bridge/fixture.js')), productionRelayDisabled: true, mode, apiOrigin: 'http://127.0.0.1:18131', fixtureActors: [701, 702, 703], database: { host: '127.0.0.1', port: 18306, database: 'tag_f1_semantic_test', serverPort: 3306 }, mockFixtureReceiptId: 'mock-review' };
 let queries = 0;
 const runtime = { serverAddress: { address: '127.0.0.1', port: 18131 }, loadedSourceModuleUrl: 'file:///source/app/src/server.js', loadedBridgeModuleUrl: 'file:///bridge/fixture.js', isolationReceiptId: 'api-review', productionRelayDisabled: true, publicDataSource: 'in-process-fixture', upstreamOrigins: [],
  identityConnectionScope: 'dedicated-readonly', cancelReadonlyIdentity: async () => true, getConnectionMetadata: () => ({ host: '127.0.0.1', port: 18306, database: 'tag_f1_semantic_test' }),
  queryDatabaseIdentity: async (statement, options) => { assert.ok(options.signal instanceof AbortSignal); queries++; assert.equal(statement, databaseIdentitySql); return [{ databaseName: 'tag_f1_semantic_test', serverPort: 3306 }]; },
  mode, databaseConnectionPresent: mode === 'isolated-database', mockFixtureVerified: true, mockFixtureReceiptId: 'mock-review' };
 const dirs = new Set(['/source', '/source/app/src', '/source/app/data']);
 const io = { lstatSync: p => { const value = p === '/private/receipt.json' ? JSON.stringify(receipt) : files.get(p); if (value === undefined && !dirs.has(p)) throw new Error('missing'); return { uid: 1000, mode: 0o100600, size: value?.length || 0, isFile: () => !dirs.has(p), isDirectory: () => dirs.has(p), isSymbolicLink: () => false }; }, realpathSync: p => p,
 readFileSync: (p, encoding) => { const value = p === '/private/receipt.json' ? JSON.stringify(receipt) : files.get(p); if (value === undefined) throw new Error('missing'); return encoding ? Buffer.from(value).toString() : Buffer.from(value); },
 readdirSync: p => [...files.keys()].filter(f => f.startsWith(p + '/')).map(f => f.slice(p.length + 1)) };
 const request = { url: readinessPath, method: 'GET', headers: { host: '127.0.0.1:18131' }, socket: { localAddress: '127.0.0.1', remoteAddress: '127.0.0.1', localPort: 18131 } };
 const invoke = async (changes = {}, deps = {}) => { let status; let body; const handler = createMintReadinessHandler({ receiptPath: '/private/receipt.json', getRuntime: () => runtime, ...changes }, { io, system: { platform: () => 'linux', hostname: () => 'mint', nodeVersion: () => '24.15.0' }, uid: 1000, ...deps }); const handled = await handler(request, { writeHead: code => { status = code; }, end: data => { body = JSON.parse(data); } }); return { handled, status, body }; };
 return { files, receipt, runtime, io, request, invoke, queries: () => queries };
}
test('truthful live isolated database readiness exposes only minimal identity metadata', async () => {
 const f = fixture(); const result = await f.invoke(); assert.equal(result.status, 200); assert.equal(f.queries(), 1);
 assert.deepEqual(result.body, { machineId: 'mint-id', appSha: initialAppSha, scope: 'mint-f1-isolated', databaseScope: 'isolated', productionDatabase: false, isolationReceiptId: 'api-review' });
});
test('explicit mock fixture never queries DB or claims database integration scope', async () => {
 const f = fixture('mock-fixture'); const result = await f.invoke(); assert.equal(result.status, 200); assert.equal(result.body.scope, 'mint-f1-isolated-mock'); assert.equal(result.body.databaseScope, 'mock-fixture'); assert.equal(f.queries(), 0);
 f.runtime.databaseConnectionPresent = true; assert.equal((await f.invoke()).status, 503);
});
test('missing runtime or actual Linux/Mint/source/bridge proof fails closed without DB queries', async () => {
 for (const change of [f => { f.receipt.reviewed = 'yes'; }, f => { f.receipt.expiresAt = new Date(0).toISOString(); }, f => { f.files.set('/etc/machine-id', 'sm-id'); }, f => { f.files.set('/source/app/src/server.js', 'changed'); }, f => { f.files.delete('/source/app/src/worker.ts'); }, f => { f.files.set('/source/app/data/extra.json', '{}'); }, f => { f.files.set('/bridge/fixture.js', 'old production relay'); }, f => { f.runtime.upstreamOrigins = ['https://tag.observe.tw']; }, f => { f.receipt.fixtureActors = [701, 702, 999]; }, f => { f.runtime.loadedSourceModuleUrl = 'file:///other/server.js'; }]) {
  const f = fixture(); change(f); assert.equal((await f.invoke()).status, 503); assert.equal(f.queries(), 0);
 }
 const f = fixture(); assert.equal((await f.invoke({ getRuntime: undefined })).status, 503);
 assert.equal((await f.invoke({}, { system: { platform: () => 'darwin', hostname: () => 'mint' } })).status, 503);
});
test('DB config and live readonly identity must both match; errors reveal no credentials', async () => {
 const f = fixture(); f.runtime.getConnectionMetadata = () => ({ host: '100.64.0.2', port: 18306, database: 'tag_f1_semantic_test' }); assert.equal((await f.invoke()).status, 503); assert.equal(f.queries(), 0);
 const wrong = fixture(); wrong.runtime.queryDatabaseIdentity = async () => [{ databaseName: 'production', serverPort: 3306 }]; assert.equal((await wrong.invoke()).status, 503);
 const secret = fixture(); secret.runtime.queryDatabaseIdentity = async () => { throw new Error('password=not-real'); }; assert.deepEqual((await secret.invoke()).body, { ready: false, error: 'readiness-unavailable' });
});
test('only exact route and loopback listener/client are admitted; no route auto-registration', async () => {
 for (const change of [f => { f.runtime.serverAddress.address = '0.0.0.0'; }, f => { f.request.socket.remoteAddress = '100.64.0.2'; }, f => { f.request.headers.host = 'tag.observe.tw'; }]) { const f = fixture(); change(f); assert.equal((await f.invoke()).status, 503); assert.equal(f.queries(), 0); }
 const f = fixture(); f.request.url += '?other'; assert.equal((await f.invoke()).handled, false); assert.equal(f.queries(), 0);
 const post = fixture(); post.request.method = 'POST'; assert.equal((await post.invoke()).status, 405);
});

test('receipt privacy, Node24 and DB mode cannot be substituted by assertions', async () => {
 const f = fixture();
 assert.equal((await f.invoke({}, { system: { platform: () => 'linux', hostname: () => 'mint', nodeVersion: () => '22.1.0' } })).status, 503);
 const original = f.io.lstatSync; f.io.lstatSync = p => p === '/private/receipt.json' ? { ...original(p), mode: 0o100644 } : original(p); assert.equal((await f.invoke()).status, 503); assert.equal(f.queries(), 0);
 const fake = fixture(); fake.runtime.mode = 'mock-fixture'; assert.equal((await fake.invoke()).status, 503); assert.equal(fake.queries(), 0);
});

test('real readiness matches executor contract while mock scope remains rejected', async () => {
 const consumerInput = { hostReceipt: { api: { origin: 'http://127.0.0.1:18131', isolationReceiptId: 'api-review' } } };
 const verified = { apiOrigin: consumerInput.hostReceipt.api.origin, snapshot: { machineId: 'mint-id' } };
 const real = await fixture().invoke(); assert.equal(await verifyIsolatedApi(consumerInput, verified, async () => new Response(JSON.stringify(real.body))), true);
 const mock = await fixture('mock-fixture').invoke(); await assert.rejects(verifyIsolatedApi(consumerInput, verified, async () => new Response(JSON.stringify(mock.body))), /mismatch/);
});
test('database identity timeout and receipt expiry stay unavailable', async () => {
 const f = fixture(); f.runtime.queryDatabaseIdentity = () => new Promise(() => {});
 assert.deepEqual((await f.invoke({ databaseTimeoutMs: 1 })).body, { ready: false, error: 'readiness-unavailable' });
 const expired = fixture(); let calls = 0; const cutoff = Date.parse(expired.receipt.expiresAt);
 assert.equal((await expired.invoke({}, { now: () => ++calls === 1 ? cutoff - 1000 : cutoff })).status, 503);
});

test('timeout cancels reserved readonly query and blocks repeats until late query settles', async () => {
 const f = fixture(); let queryCount = 0; let cancelCount = 0; let resolveQuery; let signal;
 f.runtime.queryDatabaseIdentity = (sql, options) => { queryCount++; assert.equal(sql, databaseIdentitySql); signal = options.signal; return new Promise(resolve => { resolveQuery = resolve; }); };
 f.runtime.cancelReadonlyIdentity = async options => { cancelCount++; assert.equal(options.signal, signal); assert.equal(signal.aborted, true); return true; };
 const handler = createMintReadinessHandler({ receiptPath: '/private/receipt.json', getRuntime: () => f.runtime, databaseTimeoutMs: 1 }, { io: f.io, uid: 1000, system: { platform: () => 'linux', hostname: () => 'mint', nodeVersion: () => '24.15.0' } });
 const invoke = async () => { const result = {}; await handler(f.request, { writeHead: status => { result.status = status; }, end: body => { result.body = JSON.parse(body); } }); return result; };
 const first = await invoke(); assert.equal(first.status, 503); assert.equal(cancelCount, 1); assert.equal(queryCount, 1);
 assert.equal((await invoke()).status, 503); assert.equal(queryCount, 1);
 resolveQuery([{ databaseName: 'tag_f1_semantic_test', serverPort: 3306 }]); await Promise.resolve(); await Promise.resolve();
 assert.deepEqual(first.body, { ready: false, error: 'readiness-unavailable' });
});
test('missing or failed readonly cancellation proof never enables accumulating queries', async () => {
 const missing = fixture(); delete missing.runtime.cancelReadonlyIdentity; assert.equal((await missing.invoke()).status, 503); assert.equal(missing.queries(), 0);
 const f = fixture(); let calls = 0; let resolveQuery;
 f.runtime.queryDatabaseIdentity = () => { calls++; return new Promise(resolve => { resolveQuery = resolve; }); };
 f.runtime.cancelReadonlyIdentity = async () => { throw new Error('credential-not-real'); };
 const handler = createMintReadinessHandler({ receiptPath: '/private/receipt.json', getRuntime: () => f.runtime, databaseTimeoutMs: 1 }, { io: f.io, uid: 1000, system: { platform: () => 'linux', hostname: () => 'mint', nodeVersion: () => '24.15.0' } });
 const invoke = async () => { let status; let body; await handler(f.request, { writeHead: code => { status = code; }, end: data => { body = JSON.parse(data); } }); return { status, body }; };
 assert.deepEqual((await invoke()).body, { ready: false, error: 'readiness-unavailable' });
 resolveQuery([{ databaseName: 'tag_f1_semantic_test', serverPort: 3306 }]); await Promise.resolve(); await Promise.resolve();
 assert.equal((await invoke()).status, 503); assert.equal(calls, 1);
});

test('concurrent readiness requests cannot start a second identity query', async () => {
 const f = fixture(); let calls = 0; let resolveQuery;
 f.runtime.queryDatabaseIdentity = () => { calls++; return new Promise(resolve => { resolveQuery = resolve; }); };
 const handler = createMintReadinessHandler({ receiptPath: '/private/receipt.json', getRuntime: () => f.runtime }, { io: f.io, uid: 1000, system: { platform: () => 'linux', hostname: () => 'mint', nodeVersion: () => '24.15.0' } });
 const invoke = async () => { let status; await handler(f.request, { writeHead: code => { status = code; }, end: () => {} }); return status; };
 const first = invoke(); await Promise.resolve(); assert.equal(await invoke(), 503); assert.equal(calls, 1);
 resolveQuery([{ databaseName: 'tag_f1_semantic_test', serverPort: 3306 }]); assert.equal(await first, 200);
});
