const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { estimateCaptureBytes, checkServiceSample, checkCaptureBudget } = require('./ui-capture-budget.cjs');
const GiB = 1024 ** 3;
const MiB = 1024 ** 2;
const {homepageSiteFixture}=require('./test-fixtures/homepage-probe.mjs');

test('small batches explicitly budget both screenshots and browser/network artifacts', () => {
  assert.equal(estimateCaptureBytes(8), 64 * MiB);
  assert.equal(estimateCaptureBytes(16), 96 * MiB);
  for (const value of [undefined, 0, 1.5, 17]) assert.throws(() => estimateCaptureBytes(value));
});

const nowMs = Date.parse('2026-10-13T00:00:00Z');
function healthySample(at=nowMs) {
 return {finishedAt:new Date(at).toISOString(),sites:['tag','blog','youtube'].map(name=>homepageSiteFixture(`https://${name}.observe.tw/`,[2,2,2],{startedAtMs:at}))};
}

test('capture guard applies conservative disk boundaries and finite resource budgets', () => {
  const sample = { freeBytes: 40 * GiB, load1: 12, plannedBytes: estimateCaptureBytes(8), beforeLaunch: true, serviceSample: healthySample(), nowMs };
  assert.doesNotThrow(() => checkCaptureBudget(sample));
  for (const change of [{ load1: 12.01 }, { load1: NaN }, { freeBytes: 40 * GiB - 1 },
    { beforeLaunch: false, freeBytes: 30 * GiB + 8 * MiB - 1 },
    { batchBytes: 92 * MiB + 1 }, { batchBytes: NaN }, { plannedBytes: NaN }, { plannedBytes: 101 * MiB }, { freeBytes: NaN }]) {
    assert.throws(() => checkCaptureBudget({ ...sample, ...change }), { code: 'CAPTURE_BUDGET_STOP' });
  }
  assert.doesNotThrow(() => checkCaptureBudget({ ...sample, beforeLaunch: false, freeBytes: 30 * GiB + 8 * MiB, batchBytes: 92 * MiB }));
  assert.doesNotThrow(() => checkCaptureBudget({ ...sample, plannedBytes: 100 * MiB }));
  assert.throws(() => checkCaptureBudget({ ...sample, freeBytes: 30 * GiB + sample.plannedBytes - 1 }));
});

test('all three recorded services must have fresh successful probes and per-site total time limits', () => {
  assert.doesNotThrow(() => checkServiceSample(healthySample(), nowMs));
  const malformedFirstByte=healthySample();malformedFirstByte.sites[0].ttfb=99;assert.throws(()=>checkServiceSample(malformedFirstByte,nowMs));
  const atBoundary = healthySample(nowMs-30000);
  assert.doesNotThrow(() => checkServiceSample(atBoundary, nowMs));
  for (const name of ['tag', 'blog', 'youtube']) {
    for (const change of [{ total: name === 'blog' ? 6.171 : 2.001 }, { total: NaN }, { total: undefined }, { status: 103 }, { status: 404 }, { status: 500 }, { status: 0 }, { status: NaN }, { exitCode: 1 }, { exitCode: undefined }, { probeError: 'timeout' }]) {
      const sample = healthySample();
      Object.assign(sample.sites.find((site) => site.url.includes(`//${name}.`)), change);
      assert.throws(() => checkServiceSample(sample, nowMs), { code: 'CAPTURE_BUDGET_STOP' });
    }
    const missing = healthySample();
    missing.sites = missing.sites.filter((site) => !site.url.includes(`//${name}.`));
    assert.throws(() => checkServiceSample(missing, nowMs));
  }
  for (const sample of [undefined, {}, { ...healthySample(), probeError: 'failure' },
    { ...healthySample(), finishedAt: new Date(nowMs - 30_001).toISOString() },
    { ...healthySample(), finishedAt: new Date(nowMs + 1).toISOString() },
    { ...healthySample(), finishedAt: 'invalid' }, { ...healthySample(), sites: [] }]) {
    assert.throws(() => checkServiceSample(sample, nowMs), { code: 'CAPTURE_BUDGET_STOP' });
  }
  const duplicate = healthySample();
  duplicate.sites.push(duplicate.sites[0]);
  assert.throws(() => checkServiceSample(duplicate, nowMs));
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
  const create = context.module.exports.createCaptureBudget;
  assert.throws(() => create('/mock', 1), { code: 'CAPTURE_BUDGET_STOP' });
  state.serviceSample = healthySample(Date.now());
  const budget = create('/mock', 1, () => state.serviceSample);
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

test('recorded health is rechecked before every capture without issuing probes', async () => {
  const { state, budget, page } = mockBudget();
  state.serviceSample.sites[2].total = 3;
  await assert.rejects(budget.screenshot(page, { path: '/mock/image.png' }), { code: 'CAPTURE_BUDGET_STOP' });
  assert.equal(state.captures, 0);
  state.serviceSample = Promise.resolve(healthySample());
  assert.throws(() => budget.check(), { code: 'CAPTURE_BUDGET_STOP' });
});

test('explicit relative gates allow blog total up to 6.17s while tag and youtube remain at 2s', () => {
  const sample = healthySample();
  sample.sites[1]=homepageSiteFixture(sample.sites[1].url,[1,6.17,8],{startedAtMs:nowMs});
  assert.doesNotThrow(() => checkServiceSample(sample, nowMs));
  for (const index of [0, 2]) {
    const slow = healthySample();
    slow.sites[index].total = 2.001;
    assert.throws(() => checkServiceSample(slow, nowMs), { code: 'CAPTURE_BUDGET_STOP' });
  }
  sample.sites[1]=homepageSiteFixture(sample.sites[1].url,[1,6.171,8],{startedAtMs:nowMs});
  assert.throws(() => checkServiceSample(sample, nowMs), { code: 'CAPTURE_BUDGET_STOP' });
});

test('generic capture policy also admits a spike but rejects any failed trial',()=>{
 const s=healthySample();s.sites[1]=homepageSiteFixture(s.sites[1].url,[3,8,3],{startedAtMs:nowMs});assert.doesNotThrow(()=>checkServiceSample(s,nowMs));
 for(const patch of [{status:500},{status:301},{exitCode:28}]){s.sites[1]=homepageSiteFixture(s.sites[1].url,[3,3,3],{startedAtMs:nowMs,patches:[{},patch]});assert.throws(()=>checkServiceSample(s,nowMs));}
});
