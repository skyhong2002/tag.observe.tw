import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, initialAppSha, main, smDecision } from './mint-f1-candidate-plan.js';
import { GiB, siteBudgetsSeconds } from './guard-next-build.js';
const input = () => ({
  nativePolicy: { schema: 'mint-f1-native-policy-v1', reviewed: true, buildAllowed: true, strategy: 'elf-requirements-and-sm-target-smoke', reviewReceiptId: 'mock-native-policy', maxGlibcRequired: '2.39' }, appSha: initialAppSha, opsSha: 'a'.repeat(40),
  mint: { role: 'Mint', hostname: 'mint', machineId: 'mint-id', platform: 'linux', arch: 'x64', cpus: 4, nodeVersion: '24.1.0', npmPathVerified: true, operatorVerified: true, nodeModulesAbi: '137', libc: 'glibc-2.39' },
  sm: { machineId: 'sm-id', platform: 'linux', arch: 'x64', nodeModulesAbi: '137', libc: 'glibc-2.39' },
  apiOrigin: 'http://127.0.0.1:18131', apiIsolationVerified: true, apiUsesProductionDatabase: false,
  mintGlobalSlotHandoff: true, freshOriginMainFetchVerified: true, originMainAncestorVerified: true, sourceCleanVerified: true, newCandidateDirectoryVerified: true,
});
const sample = () => ({ observedHost: 'SM', machineId: 'sm-id', measuredFromMachineId: 'sm-id', ageMs: 100,
  load1: 2, homeAvailableBytes: 45 * GiB,
  sites: Object.keys(siteBudgetsSeconds).map((url) => ({ url, exitCode: 0, status: 200, total: 0.2, ttfb: 0.1 })),
});
test('plan separates application and operations source and remains blocked', () => {
  const plan = createPlan(input());
  assert.equal(plan.status, 'plan-only'); assert.equal(plan.appSha, initialAppSha);
  assert.notEqual(plan.appSha, plan.opsSha); assert.match(plan.executionBlocked, /adapter/);
  assert.deepEqual(Object.values(plan.gates.siteBudgetsSeconds), [2, 6.17, 2]);
  assert.throws(() => main(['--execute']), /Execution disabled/);
});
test('reject SM, Mac, incompatible ABI, abbreviated SHA and missing handoff', () => {
  for (const alter of [i => { i.mint.hostname = 'skyhong-SM'; }, i => { i.mint.platform = 'darwin'; },
    i => { i.sm.nodeModulesAbi = '115'; }, i => { i.appSha = '677a0c7'; },
    i => { i.mintGlobalSlotHandoff = false; }, i => { i.sourceCleanVerified = false; }]) {
    const i = input(); alter(i); assert.throws(() => createPlan(i));
  }
});
test('API must be isolated loopback without production database', () => {
  for (const apiOrigin of ['https://tag.observe.tw', 'http://100.64.0.2:18131', 'http://user:secret@127.0.0.1:18131', 'http://127.0.0.1:18131/api']) assert.throws(() => createPlan({ ...input(), apiOrigin }));
  assert.throws(() => createPlan({ ...input(), apiUsesProductionDatabase: true }));
});
test('SM gates reject substituted Mint data, stale samples and service slowdown', () => {
  const i = input(); assert.equal(smDecision(sample(), i, { starting: true, estimatedUsageGiB: 5 }), 'run');
  for (const change of [{ observedHost: 'Mint' }, { machineId: 'mint-id' }, { measuredFromMachineId: 'mint-id' }, { ageMs: 30001 }, { homeAvailableBytes: 39 * GiB }, { load1: 13 }]) assert.equal(smDecision({ ...sample(), ...change }, i, { starting: true, estimatedUsageGiB: 5 }), 'pause');
  const slow = sample(); slow.sites[1].total = 6.18; assert.equal(smDecision(slow, i), 'pause');
  assert.equal(smDecision(undefined, i), 'pause');
});

test('missing identities, truthy attestations and different handoff SHA fail closed', () => {
  for (const change of [i => { delete i.sm.machineId; }, i => { i.sm.machineId = ' '; },
    i => { i.mint.machineId = 42; }, i => { i.mint.operatorVerified = 'yes'; },
    i => { i.mint.npmPathVerified = 1; }, i => { i.appSha = 'b'.repeat(40); }]) {
    const i = input(); change(i); assert.throws(() => createPlan(i));
  }
  assert.equal(smDecision(sample(), undefined), 'pause');
  const i = input(); delete i.sm.machineId;
  const missing = sample(); delete missing.machineId; delete missing.measuredFromMachineId;
  assert.equal(smDecision(missing, i), 'pause');
});
test('Mint2.39 to SM2.41 plans only under explicit pending native policy', () => {
 const i = input(); i.sm.libc = 'glibc-2.41'; assert.equal(createPlan(i).status, 'plan-only');
 delete i.nativePolicy; assert.throws(() => createPlan(i), /policy/);
});
