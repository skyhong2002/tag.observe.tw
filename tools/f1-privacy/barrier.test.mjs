import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CANDIDATE, runBarrier } from './barrier.mjs';

function mock(stale = false, cachedA = false) {
  const entered = Promise.withResolvers(),
    released = Promise.withResolvers();
  let committed = false;
  return {
    identity: async () => ({ ...CANDIDATE, isolatedFixtureVerified: true, apiAndNextSameArtifactVerified: true }),
    armSqlResultBarrier: async () => ({ entered: entered.promise, release: () => released.resolve() }),
    read: async (side) => {
      if (side === 'A') {
        if (cachedA) return {};
        entered.resolve({ side, oldVisibleValueCaptured: true, sqlQueryHash: 'fixture-query' });
        await released.promise;
        return {};
      }
      assert.equal(committed, true);
      return {
        status: 200,
        forbiddenPresent: stale,
        unaffectedPresent: true,
        freshSqlAfterCommit: !stale,
        correlation: 'B',
        sqlQueryHash: 'fixture-query',
        cacheControl: 'private, no-store',
      };
    },
    commitVisibilityChange: async () => {
      committed = true;
      return { transactionCommitted: true };
    },
    closeBarrier: async () => {},
  };
}
test('mock enforces capture → commit → fresh B → release A ordering', async () => {
  const result = await runBarrier(mock(), { credentialed: true });
  assert.deepEqual(
    result.events.map((e) => e.name),
    ['A.start', 'A.old-result-captured', 'mutation.commit-complete', 'B.start', 'B.complete', 'A.release'],
  );
});
test('stale B is a failure', async () => {
  await assert.rejects(runBarrier(mock(true), {}));
});
test('cached A without SQL capture is a failure', async () => {
  await assert.rejects(runBarrier(mock(false, true), {}), /without_SQL/);
});
test('deadlines reject singleflight B and always release A', async () => {
  const adapter = mock();
  const original = adapter.read;
  let a;
  adapter.read = (side) => (side === 'A' ? (a = original(side)) : a);
  await assert.rejects(runBarrier(adapter, {}, { phaseMs: 10, overallMs: 30 }), /barrier_deadline:B/);
});
test('entry never resolving rejects without unlimited cleanup', async () => {
  const adapter = mock();
  adapter.armSqlResultBarrier = async () => ({ entered: new Promise(() => {}), release() {} });
  adapter.read = () => new Promise(() => {});
  await assert.rejects(runBarrier(adapter, {}, { phaseMs: 10, overallMs: 20 }), /barrier_deadline:entry/);
});
test('B never resolving rejects', async () => {
  const adapter = mock();
  const original = adapter.read;
  adapter.read = (side) => (side === 'B' ? new Promise(() => {}) : original(side));
  await assert.rejects(runBarrier(adapter, {}, { phaseMs: 10, overallMs: 20 }), /barrier_deadline:B/);
});
test('A cleanup never resolving remains bounded', async () => {
  const adapter = mock();
  const original = adapter.read;
  adapter.read = async (side) => {
    if (side === 'A') {
      original(side);
      return new Promise(() => {});
    }
    return original(side);
  };
  adapter.closeBarrier = () => new Promise(() => {});
  await assert.rejects(runBarrier(adapter, {}, { phaseMs: 10, overallMs: 20 }), /barrier_deadline:A-complete/);
});
for (const phase of ['identity', 'arm'])
  test(`${phase} never resolving aborts and calls cleanup`, async () => {
    const adapter = mock();
    let signal,
      cancel = 0,
      close = 0;
    if (phase === 'identity')
      adapter.identity = async (options) => {
        signal = options.signal;
        return new Promise(() => {});
      };
    else
      adapter.armSqlResultBarrier = async (_scenario, options) => {
        signal = options.signal;
        return new Promise(() => {});
      };
    adapter.cancel = async () => {
      cancel++;
    };
    adapter.closeBarrier = async () => {
      close++;
    };
    await assert.rejects(runBarrier(adapter, {}, { phaseMs: 10, overallMs: 20 }), new RegExp(`barrier_deadline:${phase}`));
    assert.equal(signal.aborted, true);
    assert.equal(cancel, 1);
    assert.equal(close, 1);
  });
test('identity mismatch still cancels and closes without arming', async () => {
  const adapter = mock();
  let close = 0,
    cancel = 0;
  adapter.identity = async () => ({ app: 'wrong' });
  adapter.armSqlResultBarrier = () => {
    throw Error('must not arm');
  };
  adapter.cancel = async () => {
    cancel++;
  };
  adapter.closeBarrier = async () => {
    close++;
  };
  await assert.rejects(runBarrier(adapter, {}));
  assert.equal(close, 1);
  assert.equal(cancel, 1);
});
test('late arm handle is released and closed after setup timeout', async () => {
  const adapter = mock();
  const arm = Promise.withResolvers(),
    lateClosed = Promise.withResolvers();
  let released = 0;
  adapter.armSqlResultBarrier = () => arm.promise;
  adapter.closeBarrier = async (options) => {
    if (options.handle) lateClosed.resolve();
  };
  await assert.rejects(runBarrier(adapter, {}, { phaseMs: 10, overallMs: 100 }), /barrier_deadline:arm/);
  arm.resolve({
    release() {
      released++;
    },
  });
  await lateClosed.promise;
  assert.equal(released, 1);
});
