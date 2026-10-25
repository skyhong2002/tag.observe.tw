import assert from 'node:assert/strict';
import test from 'node:test';
import { createSqlResultHook, sqlFingerprints } from './sql-result-hook.mjs';

const SQL = 'SELECT canary FROM fixture WHERE id=?',
  PARAMS = [701],
  sig = sqlFingerprints(SQL, PARAMS);
function fixture(options = {}) {
  const rows = [],
    hook = createSqlResultHook({ record: (r) => rows.push(r), now: () => 100, deadlineMs: 1000, ...options }),
    pool = hook.wrap({ query: async () => [[{ canary: 'old' }], []] });
  return { hook, pool, rows, arm: () => hook.arm({ signature: sig, containsCanary: (r) => r[0]?.canary === 'old' }) };
}
test('A result held before delivery, B after adapter commit independent and A released', async () => {
  const f = fixture(),
    h = f.arm();
  let delivered = false;
  const a = f.hook.run('A', () => f.pool.query(SQL, PARAMS)).then(() => (delivered = true));
  await h.entered;
  assert.equal(delivered, false);
  f.hook.reportCommit();
  await f.hook.run('B', () => f.pool.query(SQL, PARAMS));
  assert.equal(delivered, false);
  h.release();
  await a;
  assert.equal(delivered, true);
  assert.ok(f.rows.every((r, i) => r.sequence === i + 1));
  assert.equal(f.rows.find((r) => r.event === 'commit').authority, 'adapter-reported');
  assert.equal(JSON.stringify(f.rows).includes('SELECT'), false);
});
test('callback Query return traps untouched while callback waits', async () => {
  const f = fixture(),
    h = f.arm(),
    query = {
      get then() {
        assert.fail('Query then trap');
      },
      get catch() {
        assert.fail('Query catch trap');
      },
    };
  let cb;
  const pool = f.hook.wrap({
    query: (s, p, c) => {
      cb = c;
      return query;
    },
  });
  let delivered = false;
  assert.equal(
    f.hook.run('A', () =>
      pool.query(SQL, PARAMS, () => {
        delivered = true;
      }),
    ),
    query,
  );
  cb(null, [{ canary: 'old' }]);
  await h.entered;
  assert.equal(delivered, false);
  h.release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(delivered, true);
});
test('B issued before commit cannot get fresh marker', async () => {
  const f = fixture(),
    h = f.arm();
  await assert.rejects(f.hook.run('B', () => f.pool.query(SQL, PARAMS)));
  assert.equal(
    f.rows.some((x) => x.event === 'B.fresh-marker'),
    false,
  );
  f.hook.close();
});
test('different SQL/params fail closed', async () => {
  for (const args of [
    [SQL + ' ', PARAMS],
    [SQL, [702]],
  ]) {
    const f = fixture();
    f.arm();
    await assert.rejects(f.hook.run('A', () => f.pool.query(...args)));
    assert.equal(f.hook.state().failed, true);
  }
});
test('early A and second arm rejected', () => {
  const f = fixture();
  assert.throws(() => f.hook.run('A', () => f.pool.query(SQL, PARAMS)));
  const g = fixture();
  g.arm();
  assert.throws(() => g.arm());
});
test('missing canary fails without capture', async () => {
  const f = fixture();
  f.hook.arm({ signature: sig, containsCanary: () => false });
  await assert.rejects(f.hook.run('A', () => f.pool.query(SQL, PARAMS)));
  assert.equal(f.hook.state().captured, false);
});
test('query rejection and synchronous driver throw latch failure', async () => {
  for (const query of [
    () => Promise.reject(Error('driver')),
    () => {
      throw Error('driver');
    },
  ]) {
    const f = fixture();
    f.arm();
    const p = f.hook.wrap({ query });
    await assert.rejects(async () => f.hook.run('A', () => p.query(SQL, PARAMS)));
    assert.equal(f.hook.state().failed, true);
  }
});
test('abort releases held A exactly once without fresh window', async () => {
  const f = fixture(),
    c = new AbortController(),
    h = f.hook.arm({ signature: sig, containsCanary: () => true, signal: c.signal }),
    a = f.hook.run('A', () => f.pool.query(SQL, PARAMS));
  await h.entered;
  c.abort();
  f.hook.close();
  f.hook.close();
  await assert.rejects(a);
});
test('late callback after close errors and never delivers rows', async () => {
  const f = fixture();
  f.arm();
  let cb, received;
  const p = f.hook.wrap({
    query: (s, p, c) => {
      cb = c;
      return {};
    },
  });
  f.hook.run('A', () =>
    p.query(SQL, PARAMS, (e, rows) => {
      received = { e, rows };
    }),
  );
  f.hook.close();
  cb(null, [{ canary: 'old' }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(received.e);
  assert.equal(received.rows, undefined);
});
test('row and result budgets reject', async () => {
  for (const opts of [{ maxRows: 1 }, { maxResultBytes: 1 }]) {
    const f = fixture(opts);
    f.arm();
    const p = f.hook.wrap({ query: async () => [[{ canary: 'old' }, { canary: 'old' }], []] });
    await assert.rejects(f.hook.run('A', () => p.query(SQL, PARAMS)));
  }
});
test('false/async evidence and record cap reject', () => {
  for (const opts of [
    { record: () => false },
    { record: async () => {} },
    { record: () => Promise.reject(Error('sink')) },
    { maxRecordBytes: 1 },
  ])
    assert.throws(() => fixture(opts).arm());
});
test('async canary predicate and unknown contexts/contracts rejected', async () => {
  const f = fixture();
  f.hook.arm({ signature: sig, containsCanary: async () => true });
  await assert.rejects(f.hook.run('A', () => f.pool.query(SQL, PARAMS)));
  const g = fixture();
  assert.throws(() => g.hook.run('C', () => {}));
  const z = fixture();
  z.arm();
  const p = z.hook.wrap({ query: () => ({}) });
  assert.throws(() => z.hook.run('A', () => p.query(SQL, PARAMS)));
});
test('expiry rejects without extending deadline, normal noncontext query delegates', async () => {
  let now = 100;
  const f = fixture({ now: () => now });
  assert.deepEqual(await f.pool.query(SQL, PARAMS), [[{ canary: 'old' }], []]);
  f.arm();
  now = 1000;
  assert.throws(() => f.hook.run('A', () => f.pool.query(SQL, PARAMS)));
});
test('options values participate in exact signature; scalar/ambiguous overloads never silently empty', async () => {
  const f = fixture();
  f.hook.arm({ signature: sqlFingerprints(SQL, []), containsCanary: () => true });
  await assert.rejects(f.hook.run('A', () => f.pool.query({ sql: SQL, values: [701] })));
  for (const args of [
    [SQL, '701'],
    [SQL, {}],
    [SQL, new Date()],
    [{ sql: SQL, values: [701] }, [701]],
    [{ sql: SQL, values: { id: 701 } }],
  ]) {
    const g = fixture();
    g.arm();
    assert.throws(() => g.hook.run('A', () => g.pool.query(...args)));
  }
  const z = fixture(),
    h = z.arm(),
    a = z.hook.run('A', () => z.pool.query({ sql: SQL, values: [701] }));
  await h.entered;
  h.release();
  await a;
});
test('no context delegates Buffer/Date/Query verbatim without touching traps', () => {
  const f = fixture(),
    query = {
      get then() {
        assert.fail('then');
      },
      get catch() {
        assert.fail('catch');
      },
    },
    buffer = Buffer.from('SELECT 1'),
    date = new Date(),
    receiver = {};
  let seen;
  const p = f.hook.wrap({
    query: function (...args) {
      seen = { self: this, args };
      return query;
    },
  });
  assert.equal(p.query.call(receiver, buffer, date), query);
  assert.equal(seen.self, receiver);
  assert.equal(seen.args[0], buffer);
  assert.equal(seen.args[1], date);
});
test('parameter budgets reject before arbitrarily large serialization; callback keeps this/fields/Query', async () => {
  assert.throws(() => sqlFingerprints(SQL, ['x'.repeat(65537)]));
  assert.throws(() => sqlFingerprints(SQL, Array(256).fill('x'.repeat(256))));
  const f = fixture(),
    h = f.arm(),
    query = {},
    fields = [{ name: 'canary' }],
    receiver = {};
  let cb, seen;
  const p = f.hook.wrap({
    query: (...args) => {
      cb = args.at(-1);
      return query;
    },
  });
  assert.equal(
    f.hook.run('A', () =>
      p.query({ sql: SQL }, [701], function (error, rows, actualFields) {
        seen = { self: this, error, rows, actualFields };
      }),
    ),
    query,
  );
  cb.call(receiver, null, [{ canary: 'old' }], fields);
  await h.entered;
  h.release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(seen.self, receiver);
  assert.equal(seen.actualFields, fields);
  assert.equal(seen.error, null);
});
