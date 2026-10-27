import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import test from 'node:test';
import { parseHomepageTrial, summarizeHomepageTrials } from '../homepage-median-probe.mjs';
import { publicPath, validateActors, validateDatabase } from './api.mjs';
import {
  budgets,
  checkPorts,
  cleanupAll,
  jobFor,
  pins,
  repo,
  runtime,
  sha,
  sourceNames,
  validateGate,
  validateInput,
  validateRuntimeManifest,
  verifyControl,
} from './core.mjs';
import { candidateCsp, createHandler, requestPlan } from './frontdoor.mjs';
import { template, validateStop, workerHealthSample } from './runner.mjs';

const now = 100000,
  q = () => ({
    ...template(),
    reviewed: true,
    executionPermission: true,
    globalSlotAcknowledged: true,
    controlOpsSha: 'a'.repeat(40),
    expiresAtMs: now + 900000,
    sourceHashes: Object.fromEntries(sourceNames.map((n) => [n, sha(fs.readFileSync(repo + '/' + n))])),
    dbConfigSha256: 'b'.repeat(64),
    nodeSha256: 'c'.repeat(64),
  });
const config = () => ({
  bindIp: '127.0.0.1',
  port: 18199,
  nextOrigin: 'http://127.0.0.1:18198',
  apiOrigin: 'http://127.0.0.1:18197',
  actor: 'anonymous',
  allowMutations: false,
  expiresAt: now + 900000,
});
const homepage = (url, totals = [1, 1, 1], start = 0) => {
  let clock = start;
  const trials = totals.map((total, i) => {
    const startedAtMs = clock;
    clock += total * 1000;
    const stdout = Buffer.from(
        'HTTP/2 200\r\ncf-cache-status: HIT\r\n\r\n\n__TAG_GATE_METRICS__' +
          JSON.stringify({ http_code: 200, time_starttransfer: Math.min(0.1, total), time_total: total, size_download: 1234 }) +
          '\n',
      ),
      stderr = Buffer.alloc(0);
    return parseHomepageTrial({
      type: 'homepage-trial-raw',
      url,
      index: i + 1,
      startedAtMs,
      endedAtMs: clock,
      exitCode: 0,
      transportError: null,
      stdoutBase64: stdout.toString('base64'),
      stderrBase64: '',
      stdoutBytes: stdout.length,
      stderrBytes: 0,
      stdoutSha256: sha(stdout),
      stderrSha256: sha(stderr),
    });
  });
  return summarizeHomepageTrials(url, trials);
};
const gate = () => ({
  load1: 1,
  homeAvailableBytes: 40 * 1024 ** 3,
  memAvailableBytes: 3 * 1024 ** 3,
  counts: { builds: 1, browsers: 2, rss: 500 * 1024 ** 2 },
  healthStartedAtMs: 0,
  healthFinishedAtMs: 3000,
  sites: Object.keys(budgets).map((url) => homepage(url)),
});
test('false template and strict exclusive names cannot authorize or change immutable runtime', () => {
  assert.throws(() => validateInput(template(), now));
  validateInput(q(), now);
  for (const patch of [
    { executionPermission: false },
    { globalSlotAcknowledged: false },
    { expiresAtMs: now + 900001 },
    { diskEstimateGiB: 1 },
    { memoryBudgetBytes: 2 * 1024 ** 3 },
    { runtimePins: { ...pins, app: '0'.repeat(40) } },
  ])
    assert.throws(() => validateInput({ ...q(), ...patch }, now));
  for (const id of ['sm-batch-000', '../sm-batch-001', 'sm-batch-1000']) assert.throws(() => jobFor(id));
});
test('control Git HEAD/clean/blobs binding refuses forged SHA and source bytes', () => {
  const input = q();
  const run = (args) =>
    args[0] === 'rev-parse'
      ? Buffer.from(input.controlOpsSha)
      : args[0] === 'status'
        ? Buffer.alloc(0)
        : fs.readFileSync(repo + '/' + args[1].split(':')[1]);
  verifyControl(input, run);
  assert.throws(() => verifyControl(input, (args) => (args[0] === 'rev-parse' ? Buffer.from('d'.repeat(40)) : run(args))));
  assert.throws(() => verifyControl(input, (args) => (args[0] === 'status' ? Buffer.from(' M tools/example') : run(args))));
  assert.throws(() => verifyControl(input, (args) => (args[0] === 'show' ? Buffer.from('tampered') : run(args))));
});
test('memory/disk/build/browser and exact blog6.17 gates failclosed', () => {
  validateGate(gate(), { starting: true });
  for (const patch of [
    { memAvailableBytes: 1024 ** 3 },
    { homeAvailableBytes: 39 * 1024 ** 3 },
    { load1: 12.1 },
    { counts: { builds: 2, browsers: 0, rss: 0 } },
    { counts: { builds: 0, browsers: 3, rss: 0 } },
    { counts: { builds: 0, browsers: 0, rss: 1024 ** 3 + 1 } },
  ])
    assert.throws(() => validateGate({ ...gate(), ...patch }, { starting: true }));
  const s = gate();
  s.sites[1] = homepage(Object.keys(budgets)[1], [6.17001, 6.17001, 6.17001]);
  s.healthFinishedAtMs = 19000;
  assert.throws(() => validateGate(s));
  s.sites[1] = homepage(Object.keys(budgets)[1], [6.17, 6.17, 6.17]);
  validateGate(s);
});
test('fixture DB and actors cannot select production/create users; public methods only', () => {
  validateDatabase({ host: '127.0.0.1', port: 18306, database: 'tag_f1_semantic_test', user: 'fixture', password: 'private' });
  for (const patch of [{ host: 'tag-db' }, { database: 'tag' }, { port: 3306 }, { extra: 'credential' }])
    assert.throws(() =>
      validateDatabase({
        host: '127.0.0.1',
        port: 18306,
        database: 'tag_f1_semantic_test',
        user: 'fixture',
        password: 'private',
        ...patch,
      }),
    );
  validateActors([{ id: 701 }, { id: 702 }, { id: 703 }]);
  assert.throws(() => validateActors([{ id: 701 }, { id: 702 }, { id: 704 }]));
  assert.ok(publicPath('/api/v1/tags/example', 'GET'));
  for (const [path, method] of [
    ['/auth/admin/tag-submissions', 'GET'],
    ['/auth/me', 'POST'],
    ['/api/v1/tags', 'POST'],
    ['/auth/google', 'GET'],
  ])
    assert.equal(publicPath(path, method), false);
});
test('frontdoor fixed localhost endpoints strips credentials and blocks auth/foreign optimizer/CONNECT', () => {
  const request = {
    method: 'GET',
    url: '/api/v1/tags/test',
    headers: {
      host: '127.0.0.1:18199',
      cookie: 'real',
      authorization: 'secret',
      'x-f1-fixture-actor': 'admin',
      'x-forwarded-for': '1.1.1.1',
    },
  };
  const plan = requestPlan(config(), request, now);
  assert.equal(plan.origin, 'http://127.0.0.1:18197');
  for (const field of ['cookie', 'authorization', 'x-f1-fixture-actor', 'x-forwarded-for']) assert.equal(plan.headers[field], undefined);
  for (const patch of [
    { method: 'POST' },
    { method: 'CONNECT' },
    { url: '/auth/admin/tag-submissions' },
    { url: 'http://foreign/' },
    { url: '/_next/image?url=https%3A%2F%2Fgoogletagmanager.com%2Fa&w=390&q=75' },
  ])
    assert.throws(() => requestPlan(config(), { ...request, ...patch }, now));
  assert.equal(requestPlan(config(), { ...request, url: '/api/status/' }, now).origin, 'http://127.0.0.1:18198');
});
test('all children receive cleanup attempts after first identity failure; stop completion stays failed', async () => {
  const children = [1, 2, 3].map((pid) => ({ pid, exitCode: null, signalCode: null })),
    signals = [];
  await assert.rejects(
    cleanupAll(children, {
      signal: (c, s) => {
        if (c.pid === 1) throw Error('identity changed');
        signals.push([c.pid, s]);
      },
      wait: async () => {
        children[1].signalCode = 'SIGTERM';
        children[2].signalCode = 'SIGTERM';
      },
      record: () => {},
    }),
    AggregateError,
  );
  assert.deepEqual(signals, [
    [2, 'SIGTERM'],
    [3, 'SIGTERM'],
  ]);
});
test('port collisions are rejected without listeners or alternate port adoption', async () => {
  let created = 0;
  const fake = () => {
    created++;
    const s = new EventEmitter();
    s.listen = () => queueMicrotask(() => s.emit('error', Error('EADDRINUSE')));
    s.close = () => assert.fail('collision cannot be adopted');
    return s;
  };
  await assert.rejects(checkPorts(fake), /EADDRINUSE/);
  assert.equal(created, 1);
});
test('stop request bound to exact own session/input/owner and freshness; no arbitrary PID', () => {
  const input = q(),
    bind = { q: input, inputSha: 'a'.repeat(64), ownerPid: 123, ownerStartTicks: '456', now };
  const request = {
    schema: 'sm-f1-candidate-stop-v1',
    inputSha256: bind.inputSha,
    sessionId: input.sessionId,
    ownerPid: 123,
    ownerStartTicks: '456',
    requestedAtMs: now,
  };
  validateStop(request, bind);
  for (const patch of [{ ownerPid: 1 }, { inputSha256: 'b'.repeat(64) }, { requestedAtMs: now - 15001 }, { sessionId: 'sm-batch-002' }])
    assert.throws(() => validateStop({ ...request, ...patch }, bind));
});
test('source keeps actual whole hash before/after, exact priorities and clean runtime environment', () => {
  const runner = fs.readFileSync(new URL('./runner.mjs', import.meta.url), 'utf8'),
    api = fs.readFileSync(new URL('./api.mjs', import.meta.url), 'utf8');
  assert.ok(runner.includes('const after=verifyRuntime()'));
  assert.ok(runner.includes("['-c','3','nice','-n','19']"));
  assert.ok(runner.includes("TAG_API_ORIGIN:'http://127.0.0.1:18197'"));
  assert.ok(runner.indexOf('await stop();') < runner.indexOf('const after=verifyRuntime()'));
  assert.ok(!api.includes('process.env'));
  assert.ok(api.includes('sessionUser:async()=>null'));
  assert.ok(api.includes('new Set()'));
  assert.ok(api.includes('queueEnabled:false'));
  assert.ok(candidateCsp.includes("connect-src 'self'"));
});
test('API readiness failure raw/status/partial bytes stored before parse and source gate', async () => {
  const { readReadiness } = await import('./runner.mjs');
  for (const fixture of [
    { status: 503, text: 'upstream unavailable' },
    { status: 200, text: 'malformed JSON' },
  ]) {
    let saved;
    await assert.rejects(
      readReadiness({
        fetcher: async () => ({
          status: fixture.status,
          body: (async function* () {
            yield Buffer.from(fixture.text);
          })(),
        }),
        writeRaw: (r) => {
          saved = r;
        },
        now: () => 1,
      }),
    );
    assert.equal(saved.status, fixture.status);
    assert.equal(Buffer.from(saved.stdoutBase64, 'base64').toString(), fixture.text);
  }
  let saved;
  await assert.rejects(
    readReadiness({
      fetcher: async () => {
        throw Error('timeout');
      },
      writeRaw: (r) => {
        saved = r;
      },
      now: () => 1,
    }),
  );
  assert.equal(saved.error, 'transport-or-body-failed');
  assert.equal(saved.status, null);
});
test('one parent health cache keeps original timing and binding; stale/replayed/malformed rows rejected', async () => {
  const { validateHealthCache } = await import('./core.mjs');
  const bind = { inputSha256: 'a'.repeat(64), parentPid: 123, parentStartTicks: '456', now: 190000 };
  const h = {
    schema: 'sm-f1-health-cache-v1',
    ...bind,
    startedAtMs: 10000,
    finishedAtMs: 22000,
    sites: Object.keys(budgets).map((url) => homepage(url, [1, 1, 1], 10001)),
  };
  delete h.now;
  validateHealthCache(h, bind);
  assert.throws(() => validateHealthCache(h, { ...bind, now: 190001 }));
  for (const patch of [{ inputSha256: 'b'.repeat(64) }, { parentPid: 1 }, { parentStartTicks: '9' }, { finishedAtMs: 190001 }])
    assert.throws(() => validateHealthCache({ ...h, ...patch }, bind));
  assert.throws(() => validateHealthCache({ ...h, sites: h.sites.map((r, i) => (i ? r : { ...r, status: 503 })) }, bind));
  assert.equal(h.startedAtMs, 10000);
  const source = fs.readFileSync(new URL('./runner.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('sessionId:q.sessionId,appSha:pins.app'));
  assert.ok(source.includes('return workerHealthSample({starting,job,group:process.pid,readHealth:()=>validateHealthCache('));
  assert.ok(source.includes('healthCache=createHealthCache'));
  assert.ok(source.includes('await parentSample(true)'));
});

test('health cache mock producer never curls on reuse, refreshes once, and rejects failed publication', async () => {
  const { createHealthCache } = await import('./core.mjs');
  let clock = 10000,
    curls = 0,
    resources = 0,
    publications = 0;
  const identity = { inputSha256: 'a'.repeat(64), parentPid: 123, parentStartTicks: '456' };
  const fresh = async () => {
    curls++;
    const start = clock;
    clock += 3000;
    return {
      ...gate(),
      healthStartedAtMs: start,
      healthFinishedAtMs: clock,
      sites: Object.keys(budgets).map((url) => homepage(url, [1, 1, 1], start)),
    };
  };
  const cache = createHealthCache({
    identity,
    now: () => clock,
    sampleFresh: fresh,
    sampleResources: async (h) => {
      resources++;
      return { ...gate(), sites: h.sites };
    },
    publish: () => {
      publications++;
    },
  });
  await cache.get();
  clock = 24000;
  await cache.get();
  assert.equal(curls, 1);
  assert.equal(resources, 1);
  clock = 25000;
  await Promise.all([cache.get(), cache.get()]);
  assert.equal(curls, 2);
  assert.equal(publications, 2);
  const failed = createHealthCache({
    identity,
    now: () => clock,
    sampleFresh: fresh,
    sampleResources: async () => assert.fail('no fallback'),
    publish: () => false,
  });
  await assert.rejects(failed.get(), /publication/);
});
test('readonly SQL refuses writes/multistatements/side effects; Drizzle-style SELECT delegates unchanged', async () => {
  const { assertSelect, guardReadOnlyPool } = await import('./api.mjs');
  for (const sql of [
    'INSERT INTO media_category_defs VALUES (?)',
    'UPDATE tags SET name=?',
    'DELETE FROM tags',
    'SELECT 1; INSERT INTO tags VALUES (1)',
    'SELECT x INTO OUTFILE ?',
    'SELECT SLEEP(1)',
    'SELECT 1 FOR UPDATE',
    'SELECT /*hidden*/ 1',
    'SELECT @x:=1',
  ])
    assert.throws(() => assertSelect(sql));
  const calls = [];
  const pool = {
    query(...args) {
      calls.push(['query', ...args]);
      return Promise.resolve([[{ n: 1 }], []]);
    },
    execute(...args) {
      calls.push(['execute', ...args]);
      return Promise.resolve([[{ id: 1 }], []]);
    },
  };
  const drizzle = { select: () => pool.execute({ sql: 'select `id` from `tags` where `name` = ?', rowsAsArray: true }, ['fixture']) };
  guardReadOnlyPool(pool);
  const value = await drizzle.select();
  assert.equal(value[0][0].id, 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][2], ['fixture']);
  assert.throws(() => pool.query('DELETE FROM tags'));
  assert.equal(calls.length, 1);
});
test('getConnection and underlying callback/promise mysql2 surfaces cannot bypass SELECT-only guard', async () => {
  const { guardReadOnlyPool } = await import('./api.mjs');
  let delegated = 0;
  const rawConnection = {
    query() {
      delegated++;
    },
    execute() {
      delegated++;
    },
    beginTransaction() {
      assert.fail('transaction reached underlying');
    },
  };
  const connection = {
    connection: rawConnection,
    query() {
      delegated++;
    },
    execute() {
      delegated++;
    },
  };
  const rawPool = {
    query() {
      delegated++;
    },
    execute() {
      delegated++;
    },
    getConnection(callback) {
      callback(null, rawConnection);
    },
  };
  const pool = {
    pool: rawPool,
    query() {
      delegated++;
    },
    execute() {
      delegated++;
    },
    getConnection: async () => connection,
  };
  guardReadOnlyPool(pool);
  const got = await pool.getConnection();
  got.query('SELECT 1');
  got.connection.execute('SELECT 1');
  assert.equal(delegated, 2);
  for (const surface of [pool, pool.pool, got, got.connection])
    for (const method of ['query', 'execute']) assert.throws(() => surface[method]('UPDATE tags SET name=?', ['no']));
  assert.throws(() => got.connection.beginTransaction());
  await new Promise((done, fail) =>
    rawPool.getConnection((error, c) => {
      if (error) return fail(error);
      assert.throws(() => c.query('INSERT INTO tags VALUES (?)', [1]));
      done();
    }),
  );
  assert.equal(delegated, 2);
});
test('startup prechecks category table and installs race-proof guard before APP build; site method matches baseline', () => {
  const api = fs.readFileSync(new URL('./api.mjs', import.meta.url), 'utf8'),
    core = fs.readFileSync(new URL('./core.mjs', import.meta.url), 'utf8');
  assert.ok(
    api.indexOf('guardReadOnlyPool(db.pool,') >= 0 && api.indexOf('guardReadOnlyPool(db.pool,') < api.indexOf('app=await buildApp'),
  );
  assert.ok(api.indexOf('SELECT COUNT(*) AS categoryCount FROM media_category_defs') < api.indexOf('app=await buildApp'));
  assert.ok(core.includes('collectHomepageTrials'));
  assert.ok(fs.readFileSync(new URL('../homepage-median-probe.mjs', import.meta.url), 'utf8').includes('Accept: text/html'));
});

test('SQL denial or delegated SELECT failure marks fixture unavailable instead of permitting APP fallback', async () => {
  const { guardReadOnlyPool } = await import('./api.mjs');
  let failed = 0;
  const pool = {
    query: async () => {
      throw Error('mock readonly transport failed');
    },
    execute: async () => [],
  };
  guardReadOnlyPool(pool, {
    onFailure: () => {
      failed++;
    },
  });
  await assert.rejects(pool.query('SELECT 1'));
  assert.equal(failed, 1);
  assert.throws(() => pool.execute('INSERT INTO media_category_defs VALUES (?)', [1]));
  assert.equal(failed, 2);
  const api = fs.readFileSync(new URL('./api.mjs', import.meta.url), 'utf8');
  assert.ok(api.includes("if(sqlFailed)throw Error('Readonly fixture SQL startup failed; no fallback admitted')"));
  assert.ok(api.includes('if(sqlFailed)return send(503'));
});

test('same request cannot publish caught SQL error as a successful APP fallback', async () => {
  const { deliverReadonly } = await import('./api.mjs');
  let sqlFailed = false,
    status,
    body,
    headers;
  const app = {
    inject: async () => {
      sqlFailed = true;
      return { statusCode: 200, headers: { 'set-cookie': 'never' }, rawPayload: Buffer.from('fallback') };
    },
  };
  const result = await app.inject();
  deliverReadonly(result, {
    failed: () => sqlFailed,
    response: {
      writeHead: (s, h) => {
        status = s;
        headers = h;
      },
      end: (b) => {
        body = b;
      },
    },
  });
  assert.equal(status, 503);
  assert.equal(headers['cache-control'], 'private, no-store');
  assert.deepEqual(JSON.parse(body), { error: 'readonly-fixture-unavailable' });
  assert.ok(!body.includes('fallback'));
  sqlFailed = false;
  deliverReadonly(
    { statusCode: 200, headers: { 'set-cookie': 'no' }, rawPayload: Buffer.from('data') },
    {
      failed: () => sqlFailed,
      head: true,
      response: {
        writeHead: (s, h) => {
          status = s;
          headers = h;
        },
        end: (b) => {
          body = b;
        },
      },
    },
  );
  assert.equal(status, 200);
  assert.equal(headers['set-cookie'], undefined);
  assert.equal(body, undefined);
});

test('median3 permits one slow200 but rejects slow median and any non200/curl error or legacy scalar', () => {
  const url = 'https://weblog.tw/';
  const good = gate();
  good.sites[1] = homepage(url, [3, 8, 3]);
  good.healthFinishedAtMs = 20000;
  validateGate(good);
  const slow = { ...good, sites: [...good.sites] };
  slow.sites[1] = homepage(url, [3, 8, 9]);
  assert.throws(() => validateGate(slow));
  for (const patch of [{ status: 500 }, { status: 301 }, { exitCode: 28 }, { parseError: 'malformed' }]) {
    const bad = { ...good, sites: [...good.sites] };
    bad.sites[1] = { ...good.sites[1], trials: good.sites[1].trials.map((t, i) => (i === 1 ? { ...t, ...patch } : t)) };
    assert.throws(() => validateGate(bad));
  }
  const old = { ...good, sites: [...good.sites] };
  old.sites[1] = { url, status: 200, exitCode: 0, total: 1, ttfb: 0.1 };
  assert.throws(() => validateGate(old));
  const forged = { ...good, sites: [...good.sites] };
  forged.sites[1] = { ...good.sites[1], total: 2 };
  assert.throws(() => validateGate(forged));
});
test('shared median collector pure mock records all9 attempts raw-first with at most3 simultaneous curls', async () => {
  const { collectHomepageTrials, requireHomepageMedian } = await import('../homepage-median-probe.mjs');
  let active = 0,
    peak = 0,
    clock = 0;
  const commands = [],
    events = [];
  const rows = await collectHomepageTrials({
    urls: Object.keys(budgets),
    now: () => clock++,
    record: (r) => {
      events.push(r);
    },
    executeCommand: async (bin, args) => {
      active++;
      peak = Math.max(peak, active);
      commands.push({ bin, args });
      await Promise.resolve();
      active--;
      return { stdout: Buffer.from(homepage(args.at(-1)).trials[0].raw.stdoutBase64, 'base64'), stderr: Buffer.alloc(0) };
    },
  });
  assert.equal(commands.length, 9);
  assert.ok(peak <= 3);
  for (const command of commands) {
    assert.equal(command.bin, '/usr/bin/curl');
    assert.ok(command.args.includes('DNT: 1'));
    assert.ok(command.args.includes('Accept: text/html'));
    assert.ok(!command.args.includes('-L'));
  }
  for (const row of rows) {
    requireHomepageMedian(row, budgets[row.url]);
    for (let index = 1; index <= 3; index++) {
      const raw = events.findIndex((e) => e.type === 'homepage-trial-raw' && e.url === row.url && e.index === index),
        decoded = events.findIndex((e) => e.type === 'homepage-trial' && e.url === row.url && e.index === index);
      assert.ok(raw >= 0 && raw < decoded);
      assert.equal(row.trials[index - 1].cfCacheStatus, 'HIT');
      assert.equal(row.trials[index - 1].bytes, 1234);
    }
  }
  assert.equal(events.length, 18);
});

test('mysql2 callback Query then/catch traps are not treated as promises', async () => {
  const { guardReadOnlyPool } = await import('./api.mjs');
  let trapCalls = 0,
    failures = 0,
    callbackCalls = 0;
  const command = {
    then() {
      trapCalls++;
      throw Error('mysql2 callback Query is not a promise');
    },
    catch() {
      trapCalls++;
      throw Error('mysql2 callback Query is not a promise');
    },
  };
  const raw = {
    query(sql, callback) {
      callback(null, [[{ n: 1 }], []]);
      return command;
    },
    execute(sql, params, callback) {
      callback(null, [[{ n: 1 }], []]);
      return command;
    },
  };
  const pool = {
    pool: raw,
    query(sql) {
      return new Promise((ok, fail) => raw.query(sql, (error, value) => (error ? fail(error) : ok(value))));
    },
  };
  guardReadOnlyPool(pool, { onFailure: () => failures++ });
  assert.equal(
    raw.query('SELECT 1', () => callbackCalls++),
    command,
  );
  assert.equal(
    raw.execute('SELECT ?', [1], () => callbackCalls++),
    command,
  );
  assert.equal(callbackCalls, 2);
  const value = await pool.query('SELECT 1');
  assert.equal(value[0][0].n, 1);
  assert.equal(trapCalls, 0);
  assert.equal(failures, 0);
  assert.throws(() => raw.query('INSERT INTO tags VALUES (1)', () => {}));
  assert.equal(failures, 1);
});

test('installed mysql2 Query and PromisePool work through guards without connecting SQL', async () => {
  const { createRequire } = await import('node:module'),
    { runtime } = await import('./core.mjs'),
    { guardReadOnlyPool } = await import('./api.mjs');
  const require = createRequire(runtime + '/package.json'),
    Query = require(runtime + '/node_modules/mysql2/lib/commands/query.js'),
    PromisePool = require(runtime + '/node_modules/mysql2/lib/promise/pool.js');
  const raw = new EventEmitter();
  raw.config = { connectionConfig: { trace: false } };
  let calls = 0,
    failed = 0;
  const command = new Query({ sql: 'SELECT 1', values: [] }, () => {});
  assert.equal(typeof command.then, 'function');
  assert.equal(typeof command.catch, 'function');
  raw.query = (sql, args, callback) => {
    calls++;
    const done = typeof args === 'function' ? args : callback;
    done(null, [{ n: 1 }], []);
    return command;
  };
  const pool = new PromisePool(raw);
  guardReadOnlyPool(pool, { onFailure: () => failed++ });
  const result = await pool.query('SELECT 1');
  assert.deepEqual(result, [[{ n: 1 }], []]);
  assert.equal(calls, 1);
  assert.equal(failed, 0);
  assert.equal(
    raw.query('SELECT 1', () => {}),
    command,
  );
  assert.equal(calls, 2);
  assert.throws(() => pool.query('UPDATE tags SET name=?', ['no']));
  assert.equal(calls, 2);
  assert.equal(failed, 1);
});
test('Next exact argv may become only pinned title; stable identity never accepts PID reuse or foreign ownership', async () => {
  const { runtime, nextTitle, stableChildIdentity, ownIdentity } = await import('./core.mjs');
  const cwd = runtime + '/web/.next/standalone/web';
  const owner = {
    name: 'next',
    pid: 123,
    startTicks: '111',
    uid: 1000,
    parentPid: 77,
    processGroup: 77,
    exe: '/canonical/node',
    cwd,
    expectedArgs: ['/home/deck/.local/bin/node', cwd + '/server.js'],
  };
  const actual = {
    pid: 123,
    startTicks: '111',
    uids: [1000, 1000, 1000, 1000],
    parentPid: 77,
    processGroup: 77,
    exe: '/canonical/node',
    cwd,
    argv: [...owner.expectedArgs],
  };
  assert.equal(ownIdentity(owner, actual), true);
  assert.equal(ownIdentity(owner, { ...actual, argv: [nextTitle] }), true);
  for (const title of ['next-server', 'next-server (v16.3.7)', 'next-server (v16.3.6) extra', 'node'])
    assert.equal(ownIdentity(owner, { ...actual, argv: [title] }), false);
  assert.equal(ownIdentity({ ...owner, name: 'api' }, { ...actual, argv: [nextTitle] }), false);
  for (const patch of [
    { pid: 124 },
    { startTicks: '222' },
    { parentPid: 1 },
    { processGroup: 1 },
    { uids: [1000, 0, 1000, 1000] },
    { exe: '/foreign/node' },
    { cwd: '/foreign' },
  ]) {
    assert.equal(stableChildIdentity(owner, { ...actual, ...patch }), false);
    assert.equal(ownIdentity(owner, { ...actual, ...patch }), false);
  }
  // Cleanup uses proven spawn ownership, independently of a later malformed process.title.
  assert.equal(stableChildIdentity(owner, { ...actual, argv: ['wrong-title'] }), true);
});
test('proc identity reread catches PID reuse during observation without real proc access', async () => {
  const { readChildIdentity } = await import('./core.mjs');
  let reads = 0;
  const fields = Array(20).fill('0');
  fields[0] = 'S';
  fields[1] = '77';
  fields[2] = '77';
  fields[19] = '111';
  const io = {
    readFileSync: (p) => {
      if (p.endsWith('/stat')) {
        reads++;
        return '123 (node) ' + fields.map((v, i) => (i === 19 && reads > 1 ? '222' : v)).join(' ');
      }
      if (p.endsWith('/status')) return 'Uid: 1000 1000 1000 1000';
      if (p.endsWith('/cmdline')) return Buffer.from('next-server (v16.3.6)');
      assert.fail('unknown proc field');
    },
    realpathSync: (p) => (p.endsWith('/exe') ? '/canonical/node' : '/canonical/cwd'),
  };
  assert.throws(() => readChildIdentity(123, io), /changed/);
});
test('cleanup error still cleans other children then forces worker exit and promptly notifies parent before close', async () => {
  const { observeWorkerExit, finishWorkerFailure } = await import('./runner.mjs');
  const children = [1, 2, 3].map((pid) => ({ pid, exitCode: null, signalCode: null })),
    events = [];
  try {
    await cleanupAll(children, {
      signal: (c, kind) => {
        if (c.pid === 1) throw Error('wrong stable binding');
        events.push([c.pid, kind]);
      },
      wait: async () => {
        for (const child of children.slice(1)) child.signalCode = 'SIGTERM';
      },
      record: () => {},
    });
    assert.fail('must failclosed');
  } catch {
    finishWorkerFailure({ record: () => events.push('failure-evidence'), exit: (code) => events.push(['worker-exit', code]) });
  }
  assert.deepEqual(events.slice(0, 2), [
    [2, 'SIGTERM'],
    [3, 'SIGTERM'],
  ]);
  assert.ok(events.includes('failure-evidence'));
  assert.deepEqual(events.at(-1), ['worker-exit', 1]);
  const child = new EventEmitter();
  let parentInterrupted = 0;
  observeWorkerExit(child, () => {
    parentInterrupted++;
  });
  child.emit('exit', 1, null);
  assert.equal(parentInterrupted, 1); // No close event: descendants still hold pipes.
  let code;
  assert.throws(
    () =>
      finishWorkerFailure({
        record: () => {
          throw Error('private write failed');
        },
        exit: (n) => {
          code = n;
        },
      }),
    /private write/,
  );
  assert.equal(code, 1);
  const source = fs.readFileSync(new URL('./runner.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('observeWorkerExit(child,terminate)'));
  assert.ok(source.includes('if(!stableChildIdentity(child))'));
  assert.ok(!source.includes('child.cmdlineSha256=sha(cmd)'));
});

test('SQL failure evidence distinguishes admission from missing schema without SQL/values/secret', async () => {
  const { guardReadOnlyPool, boundedSqlFailureSink } = await import('./api.mjs');
  const lines = [],
    sink = boundedSqlFailureSink((raw) => lines.push(JSON.parse(raw)), { now: () => 123 });
  const dbError = Object.assign(Error('SECRET SQL password literal'), {
    code: 'ER_NO_SUCH_TABLE',
    sql: 'select SECRET',
    sqlMessage: 'SECRET',
  });
  const pool = {
    query: async () => {
      throw dbError;
    },
    execute: () => [],
  };
  guardReadOnlyPool(pool, { onFailure: sink });
  assert.throws(() => pool.execute('INSERT INTO secret VALUES (?)', ['SECRET']));
  await assert.rejects(pool.query('SELECT x FROM missing'));
  assert.equal(lines[0].phase, 'admission');
  assert.equal(lines[1].phase, 'driver');
  assert.equal(lines[1].driverCode, 'ER_NO_SUCH_TABLE');
  assert.ok(!JSON.stringify(lines).includes('SECRET'));
  assert.ok(!JSON.stringify(lines).includes('missing'));
});
test('SQL diagnostic sink caps or write failures remain failclosed', async () => {
  const { guardReadOnlyPool, boundedSqlFailureSink } = await import('./api.mjs');
  let poisoned = false;
  const sink = boundedSqlFailureSink(() => {
    throw Error('private diagnostic failed');
  });
  const pool = { query: () => assert.fail('denied query reached DB') };
  guardReadOnlyPool(pool, {
    onFailure: (e) => {
      poisoned = true;
      sink(e);
    },
  });
  assert.throws(() => pool.query('DELETE FROM tags'), /diagnostic failed/);
  assert.equal(poisoned, true);
  assert.throws(() => boundedSqlFailureSink(() => {}, { maxBytes: 1 })({ operation: 'query', phase: 'driver' }), /cap/);
});

test('API503 cause evidence separates latch/expiry/handler and never keeps URL query', async () => {
  const { boundedApiFailureSink } = await import('./api.mjs');
  const rows = [],
    sink = boundedApiFailureSink((x) => rows.push(JSON.parse(x)), { now: () => 123 });
  for (const [index, cause, path] of [
    [1, 'sql-latched', '/auth/me'],
    [2, 'expired', '/api/v1/reader-presence'],
    [3, 'handler-error', '/api/v1/tags/PRIVATE?secret=SECRET'],
  ])
    sink({ index, cause, path });
  assert.deepEqual(
    rows.map((x) => x.cause),
    ['sql-latched', 'expired', 'handler-error'],
  );
  assert.deepEqual(
    rows.map((x) => x.routeClass),
    ['anonymous-auth', 'reader-presence', 'public-api'],
  );
  assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
  assert.ok(!JSON.stringify(rows).includes('SECRET'));
});

test('installed mysql2 queue-limit mock returns undefined callback path and preserves duplicate error identity', async () => {
  const { createRequire } = await import('node:module'),
    { runtime } = await import('./core.mjs'),
    { guardReadOnlyPool, boundedSqlFailureSink } = await import('./api.mjs');
  const require = createRequire(runtime + '/package.json'),
    BasePool = require(runtime + '/node_modules/mysql2/lib/base/pool.js'),
    PromisePool = require(runtime + '/node_modules/mysql2/lib/promise/pool.js');
  const raw = new EventEmitter();
  Object.setPrototypeOf(raw, BasePool.prototype);
  raw.config = {
    connectionLimit: 2,
    waitForConnections: true,
    queueLimit: 64,
    connectionConfig: { trace: false, host: '127.0.0.1', port: 18306, database: 'tag_f1_semantic_test' },
  };
  raw._closed = false;
  raw._freeConnections = { length: 0 };
  raw._allConnections = { length: 2 };
  raw._connectionQueue = { length: 64 };
  let callbackError;
  assert.equal(
    raw.getConnection((error) => {
      callbackError = error;
    }),
    undefined,
  );
  assert.equal(callbackError.code, undefined);
  assert.equal(callbackError.message, 'Queue limit reached.');
  const rows = [],
    pool = new PromisePool(raw);
  guardReadOnlyPool(pool, { onFailure: boundedSqlFailureSink((x) => rows.push(JSON.parse(x))) });
  await assert.rejects(pool.query('SELECT 1'), /Queue limit/);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].errorId, rows[1].errorId);
  assert.ok(rows.every((x) => x.errorChain[0].clientClass === 'queue-limit'));
  assert.ok(!JSON.stringify(rows).includes('Queue limit reached.'));
  raw._closed = true;
  await assert.rejects(pool.query('SELECT 1'), /Pool is closed/);
  assert.equal(rows.at(-1).errorChain[0].clientClass, 'pool-closed');
});
test('driver error cause classification is bounded and never emits arbitrary names/messages/SQL', async () => {
  const { sqlFailureEvidence } = await import('./api.mjs');
  const cause = Object.assign(new TypeError('SECRET'), { code: 'ER_NO_SUCH_TABLE', sql: 'SECRET' }),
    outer = Object.assign(Error('SECRET'), { cause });
  cause.cause = outer;
  const row = sqlFailureEvidence({ operation: 'query', phase: 'driver', error: outer });
  assert.equal(row.errorChain.length, 2);
  assert.equal(row.errorChain[1].driverCode, 'ER_NO_SUCH_TABLE');
  assert.ok(!JSON.stringify(row).includes('SECRET'));
});

test('fixture scheduler drains a100-query Promise.all burst with only2 active and preserves callback core', async () => {
  const { scheduleFixtureSelects, guardReadOnlyPool } = await import('./api.mjs');
  let active = 0,
    peak = 0;
  const held = [],
    coreQuery = () => ({ then: () => assert.fail('callback Query then touched') });
  const pool = {
    pool: { query: coreQuery },
    query: () =>
      new Promise((resolve) => {
        active++;
        peak = Math.max(peak, active);
        held.push(() => {
          active--;
          resolve([[{ n: 1 }], []]);
        });
      }),
    execute: () => Promise.resolve([[], []]),
  };
  guardReadOnlyPool(pool);
  const guardedCore = pool.pool.query;
  const timers = [];
  const scheduler = scheduleFixtureSelects(pool, {
    expiresAtMs: 2000,
    now: () => 1000,
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: () => {},
  });
  assert.equal(pool.pool.query, guardedCore);
  const results = Array.from({ length: 100 }, () => pool.query('SELECT 1'));
  assert.equal(scheduler.stats().active, 2);
  assert.equal(scheduler.stats().queued, 98);
  for (let i = 0; i < 100; i++) {
    assert.ok(held.length);
    held.shift()();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }
  await Promise.all(results);
  assert.equal(peak, 2);
  await scheduler.close();
  assert.deepEqual(scheduler.stats(), { active: 0, queued: 0, stopped: true });
});
test('fixture scheduler refuses writes/callbacks, bounded overflow and expiry without freeing unsettled active slots', async () => {
  const { scheduleFixtureSelects } = await import('./api.mjs');
  const held = [],
    timers = [];
  let clock = 1000,
    calls = 0;
  const pool = {
    query: () => {
      calls++;
      return new Promise((resolve) => held.push(resolve));
    },
    execute: () => Promise.resolve([]),
  };
  const scheduler = scheduleFixtureSelects(pool, {
    expiresAtMs: 2000,
    now: () => clock,
    maxQueue: 1,
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: () => {},
  });
  assert.throws(() => pool.query('UPDATE tags SET name=?'));
  assert.throws(() => pool.query('SELECT 1', () => {}));
  const jobs = [pool.query('SELECT 1'), pool.query('SELECT 1'), pool.query('SELECT 1')],
    settled = Promise.allSettled(jobs);
  await assert.rejects(pool.query('SELECT 1'), /queue limit/);
  assert.equal(calls, 2);
  clock = 2000;
  timers[0]();
  assert.ok((await settled).every((x) => x.status === 'rejected'));
  assert.equal(scheduler.stats().active, 2);
  assert.equal(scheduler.stats().queued, 0);
  await assert.rejects(pool.query('SELECT 1'), /stopped/);
  held.forEach((resolve) => resolve([]));
  await Promise.resolve();
  await Promise.resolve();
  await scheduler.close();
  assert.equal(calls, 2);
});
test('fixture scheduler close timeout is unconfirmed failure and never delegates queued queries', async () => {
  const { scheduleFixtureSelects } = await import('./api.mjs');
  const timers = [];
  let calls = 0;
  const pool = {
    query: () => {
      calls++;
      return new Promise(() => {});
    },
    execute: () => Promise.resolve([]),
  };
  const scheduler = scheduleFixtureSelects(pool, {
    expiresAtMs: 2000,
    now: () => 1000,
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: () => {},
  });
  const settled = Promise.allSettled([pool.query('SELECT 1'), pool.query('SELECT 1'), pool.query('SELECT 1')]);
  const closing = scheduler.close(10);
  await settled;
  timers[1]();
  await assert.rejects(closing, /unconfirmed/);
  assert.equal(calls, 2);
  assert.equal(scheduler.stats().active, 2);
});

test('local scheduler capacity failure latches unavailable instead of permitting APP fallback200', async () => {
  const { scheduleFixtureSelects, deliverReadonly } = await import('./api.mjs');
  let failed = false;
  const pool = { query: () => new Promise(() => {}), execute: () => Promise.resolve([]) };
  const scheduler = scheduleFixtureSelects(pool, {
    expiresAtMs: 2000,
    now: () => 1000,
    maxQueue: 1,
    onFailure: () => {
      failed = true;
    },
    setTimer: () => 1,
    clearTimer: () => {},
  });
  const existing = Promise.allSettled([pool.query('SELECT 1'), pool.query('SELECT 1'), pool.query('SELECT 1')]);
  await assert.rejects(pool.query('SELECT 1'), /queue limit/);
  let status;
  deliverReadonly(
    { statusCode: 200, headers: {}, rawPayload: 'fallback' },
    { response: { writeHead: (s) => (status = s), end: () => {} }, failed: () => failed },
  );
  assert.equal(status, 503);
  scheduler.abort();
  await existing;
});

test('outer scheduler denied WRITE/callback or preexpiry abort cannot bypass sticky503 after APP catches', async () => {
  const { guardReadOnlyPool, scheduleFixtureSelects, deliverReadonly } = await import('./api.mjs');
  for (const kind of ['write', 'callback', 'abort']) {
    let failed = false,
      delegated = 0;
    const evidence = [],
      pool = {
        query: async () => {
          delegated++;
          return [];
        },
        execute: async () => [],
      };
    const report = (e) => {
      failed = true;
      evidence.push(e.phase);
    };
    guardReadOnlyPool(pool, { onFailure: report });
    const scheduler = scheduleFixtureSelects(pool, {
      expiresAtMs: 2000,
      now: () => 1000,
      onFailure: report,
      setTimer: () => 1,
      clearTimer: () => {},
    });
    try {
      if (kind === 'write') pool.query('INSERT INTO tags VALUES (?)', [1]);
      else if (kind === 'callback') pool.query('SELECT 1', () => {});
      else {
        scheduler.abort();
        await pool.query('SELECT 1');
      }
    } catch {}
    let status;
    deliverReadonly(
      { statusCode: 200, headers: {}, rawPayload: 'caught fallback' },
      { response: { writeHead: (s) => (status = s), end: () => {} }, failed: () => failed },
    );
    assert.equal(status, 503);
    assert.equal(delegated, 0);
    assert.ok(evidence.includes(kind === 'abort' ? 'driver' : 'admission'));
    scheduler.abort();
  }
});
test('scheduler abort audit failure rejects all queued/running callers and stays failed on close', async () => {
  const { scheduleFixtureSelects } = await import('./api.mjs');
  let failed = false;
  const held = [],
    pool = { query: () => new Promise((resolve) => held.push(resolve)), execute: async () => [] },
    scheduler = scheduleFixtureSelects(pool, {
      expiresAtMs: 2000,
      now: () => 1000,
      setTimer: () => 1,
      clearTimer: () => {},
      onFailure: () => {
        failed = true;
        throw Error('private abort audit failed');
      },
    });
  const settled = Promise.allSettled([pool.query('SELECT 1'), pool.query('SELECT 1'), pool.query('SELECT 1')]);
  scheduler.abort();
  assert.ok((await settled).every((x) => x.status === 'rejected'));
  assert.equal(failed, true);
  held.forEach((done) => done([]));
  await Promise.resolve();
  await Promise.resolve();
  await assert.rejects(scheduler.close(), /audit failed/);
});

test('new prepared manifest binds actual controlOps/canonical inventory schema rather than legacy mint identity', () => {
  const m = {
    schema: 'sm-direct-next-prepared-artifact-v1',
    appSha: pins.app,
    controlOpsSha: pins.artifactOps,
    buildId: pins.build,
    inventoryCanonicalSha256: pins.inventory,
    artifactRoot: runtime,
    standaloneWeb: runtime + '/web/.next/standalone/web',
    deployEligible: false,
  };
  validateRuntimeManifest(m);
  for (const patch of [
    { schema: 'mint-f1-artifact-v1' },
    { controlOpsSha: undefined, opsSha: pins.artifactOps },
    { inventoryCanonicalSha256: '0'.repeat(64) },
    { appSha: '677a0c793eeda0c4d850c81ac574c95508d08e0a' },
    { artifactRoot: '/old' },
    { buildId: 'PmjYScQDDoJKBr43SLkhd' },
  ])
    assert.throws(() => validateRuntimeManifest({ ...m, ...patch }));
});

test('worker startup samples fresh after proof rather than reading the stale pre-proof parent cache', async () => {
  let cacheReads = 0,
    freshCalls = 0;
  const stale = () => {
    cacheReads++;
    throw Error('Actual bound health cache stale/mismatched');
  };
  const sampleHealth = async (job, options) => {
    assert.equal(job, '/private');
    if (options.starting) {
      assert.equal(Object.hasOwn(options, 'health'), false);
      freshCalls++;
      return { actualFresh: true };
    }
    return options.health;
  };
  assert.deepEqual(await workerHealthSample({ starting: true, job: '/private', group: 10, readHealth: stale, sampleHealth }), {
    actualFresh: true,
  });
  assert.equal(cacheReads, 0);
  assert.equal(freshCalls, 1);
  await assert.rejects(workerHealthSample({ starting: false, job: '/private', group: 10, readHealth: stale, sampleHealth }), /stale/);
  assert.equal(cacheReads, 1);
  await assert.rejects(
    workerHealthSample({
      starting: true,
      job: '/private',
      group: 10,
      readHealth: stale,
      sampleHealth: async () => {
        throw Error('Actual new trial500 rejected');
      },
    }),
    /500/,
  );
});
