import assert from 'node:assert/strict';

export const CANDIDATE = Object.freeze({ app: '677a0c793eeda0c4d850c81ac574c95508d08e0a', buildId: 'PmjYScQDDoJKBr43SLkhd' });
/** Adapter owns DB guards, actual SQL-result instrumentation and HTTP correlation.
 * This driver opens no resources and supplies no implicit mutation or retry. */
export async function runBarrier(adapter, scenario, options = {}) {
  const overallMs = options.overallMs ?? 15000;
  const phaseMs = options.phaseMs ?? 5000;
  assert.ok(Number.isInteger(overallMs) && overallMs > 0 && overallMs <= 30000);
  assert.ok(Number.isInteger(phaseMs) && phaseMs > 0 && phaseMs <= overallMs);
  const deadline = Math.min(Date.now() + overallMs, options.deadlineEpochMs ?? Infinity);
  const controller = new AbortController();
  const bounded = async (task, phase) => {
    const remaining = Math.min(phaseMs, deadline - Date.now());
    if (remaining <= 0) throw Error(`barrier_deadline:${phase}`);
    let timer;
    try {
      return await Promise.race([
        Promise.resolve(task),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error(`barrier_deadline:${phase}`)), remaining);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const events = [];
  const record = (name) => events.push({ sequence: events.length + 1, name });
  let failure, barrier, a;
  let closing = false;
  const cleanupErrors = [];
  const releaseHandle = (handle) => {
    try {
      handle?.release();
    } catch (error) {
      cleanupErrors.push(String(error.message).slice(0, 200));
    }
  };
  try {
    const identity = await bounded(adapter.identity({ signal: controller.signal }), 'identity');
    assert.equal(identity.app, CANDIDATE.app);
    assert.equal(identity.buildId, CANDIDATE.buildId);
    assert.equal(identity.isolatedFixtureVerified, true);
    assert.equal(identity.apiAndNextSameArtifactVerified, true);
    const arm = Promise.resolve().then(() => adapter.armSqlResultBarrier(scenario, { signal: controller.signal }));
    // Detached completion observer holds no timer/session and emits nothing.
    // A late handle must release even after setup timed out.
    arm.then(
      (handle) => {
        if (!closing) return;
        releaseHandle(handle);
        const lateClose = Promise.resolve().then(() => adapter.closeBarrier({ signal: controller.signal, handle }));
        lateClose.catch(() => {});
        bounded(lateClose, 'late-arm-cleanup').catch((error) => {
          cleanupErrors.push(String(error.message).slice(0, 200));
        });
      },
      () => {},
    );
    barrier = await bounded(arm, 'arm');
    record('A.start');
    a = Promise.resolve().then(() => adapter.read('A', scenario, { signal: controller.signal }));
    const early = a.then(() => {
      throw Error('A_completed_without_SQL_result_barrier');
    });
    early.catch(() => {});
    const hit = await bounded(Promise.race([barrier.entered, early]), 'entry');
    assert.equal(hit.side, 'A');
    assert.equal(hit.oldVisibleValueCaptured, true);
    record('A.old-result-captured');
    const commit = await bounded(adapter.commitVisibilityChange(scenario, { signal: controller.signal }), 'commit');
    assert.equal(commit.transactionCommitted, true);
    record('mutation.commit-complete');
    record('B.start');
    const b = await bounded(adapter.read('B', scenario, { signal: controller.signal }), 'B');
    assert.equal(b.status, scenario.expectedStatus ?? 200);
    assert.equal(b.forbiddenPresent, false);
    assert.equal(b.unaffectedPresent, true);
    assert.equal(b.freshSqlAfterCommit, true);
    assert.equal(b.correlation, 'B');
    assert.equal(b.sqlQueryHash, hit.sqlQueryHash);
    if (scenario.credentialed) assert.match(b.cacheControl, /private.*no-store/);
    record('B.complete');
    barrier.release();
    record('A.release');
    await bounded(a, 'A-complete');
    return { scope: 'adapter-evidence', events, identity, passed: true, sleepUsed: false, retriesUsed: false, ttlGraceUsed: false };
  } catch (error) {
    failure = error;
    error.barrierEvents = events;
    error.cleanupErrors = cleanupErrors;
    controller.abort(error);
    throw error;
  } finally {
    closing = true;
    controller.abort();
    releaseHandle(barrier);
    // No fresh cleanup window: share the original overall deadline.
    // Cooperative adapter cancellation must abort its actual SQL/HTTP work.
    await bounded(
      Promise.allSettled([
        a,
        Promise.resolve().then(() => adapter.cancel?.({ signal: controller.signal })),
        Promise.resolve().then(() => adapter.closeBarrier({ signal: controller.signal })),
      ]),
      'cleanup',
    )
      .then((results) => {
        const rejected = results.find((result) => result.status === 'rejected');
        if (rejected) {
          cleanupErrors.push('barrier_cleanup_failed');
          if (!failure) throw Error('barrier_cleanup_failed');
        }
        if (cleanupErrors.length && !failure) throw Error('barrier_cleanup_failed');
      })
      .catch((error) => {
        cleanupErrors.push(String(error.message).slice(0, 200));
        if (failure) failure.cleanupFailure = error.message;
        else throw error;
      });
  }
}
