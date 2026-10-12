const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { estimateCaptureBytes, checkCaptureBudget } = require('./ui-capture-budget.cjs');
const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

test('small batches explicitly budget both screenshots and browser/network artifacts', () => {
  assert.equal(estimateCaptureBytes(8), 64 * MiB);
  assert.equal(estimateCaptureBytes(16), 96 * MiB);
  for (const value of [undefined, 0, 1.5, 17]) assert.throws(() => estimateCaptureBytes(value));
});

test('freeze guard applies load and disk reserve before launch and during capture', () => {
  const sample = { freeBytes: 113.5 * GiB, load1: 12, plannedBytes: estimateCaptureBytes(8), beforeLaunch: true };
  assert.doesNotThrow(() => checkCaptureBudget(sample));
  assert.throws(() => checkCaptureBudget({ ...sample, load1: 12.01 }));
  assert.throws(() => checkCaptureBudget({ ...sample, load1: NaN }));
  assert.throws(() => checkCaptureBudget({ ...sample, freeBytes: 113.01 * GiB }));
  assert.throws(() => checkCaptureBudget({ ...sample, beforeLaunch: false, freeBytes: 113 * GiB }));
  assert.throws(() => checkCaptureBudget({ ...sample, batchBytes: 93 * MiB }));
  assert.throws(() => checkCaptureBudget({ ...sample, plannedBytes: 501 * MiB }));
});

function mockBudget() {
  const state = { writes: [], captures: 0, diskError: false, writeError: false, pixels: 1_000_000, bytes: 100 };
  const fakeFs = {
    statfsSync() {
      if (state.diskError) throw Object.assign(new Error('disk unavailable'), { code: 'EIO' });
      return { bavail: 120 * GiB, bsize: 1 };
    },
    readdirSync: () => [],
    appendFileSync: () => {},
    writeFileSync(file, buffer, options) {
      if (state.writeError) throw Object.assign(new Error('existing evidence'), { code: 'EEXIST' });
      state.writes.push({ file, bytes: buffer.length, flag: options.flag });
    },
  };
  const context = {
    module: { exports: {} },
    require: (name) => (name === 'node:fs' ? fakeFs : name === 'node:os' ? { loadavg: () => [1] } : require(name)),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'ui-capture-budget.cjs'), 'utf8'), context);
  const budget = context.module.exports.createCaptureBudget('/mock', 1);
  const page = {
    evaluate: async () => state.pixels,
    screenshot: async () => {
      state.captures++;
      return Buffer.alloc(state.bytes);
    },
  };
  return { state, budget, page };
}

test('resource and evidence write failures cannot be swallowed as ordinary interaction errors', async () => {
  const { state, budget, page } = mockBudget();
  state.diskError = true;
  assert.throws(
    () => budget.check(),
    (error) => error.code === 'CAPTURE_BUDGET_STOP' && error.cause?.code === 'EIO',
  );
  state.diskError = false;
  state.writeError = true;
  await assert.rejects(
    budget.screenshot(page, { path: '/mock/image.png' }),
    (error) => error.code === 'CAPTURE_BUDGET_STOP' && error.cause?.code === 'EEXIST',
  );
  assert.equal(state.writes.length, 0);
});

test('oversize PNG and excessive full-page dimensions stop before any evidence write', async () => {
  const { state, budget, page } = mockBudget();
  state.pixels = 8_000_001;
  await assert.rejects(budget.screenshot(page, { path: '/mock/image.png', fullPage: true }), { code: 'CAPTURE_BUDGET_STOP' });
  assert.equal(state.captures, 0);
  state.bytes = 4 * MiB + 1;
  await assert.rejects(budget.screenshot(page, { path: '/mock/image.png' }), { code: 'CAPTURE_BUDGET_STOP' });
  assert.equal(state.writes.length, 0);
});

test('a saved screenshot uses exclusive creation and the next capture cannot exceed its declared count', async () => {
  const { state, budget, page } = mockBudget();
  await budget.screenshot(page, { path: '/mock/image.png' });
  assert.equal(state.writes[0].flag, 'wx');
  await assert.rejects(budget.screenshot(page, { path: '/mock/next.png' }), { code: 'CAPTURE_BUDGET_STOP' });
  assert.equal(state.captures, 1);
});
