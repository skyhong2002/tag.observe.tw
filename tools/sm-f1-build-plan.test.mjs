import assert from 'node:assert/strict';
import test from 'node:test';
import { NODE, NPM_CLI, plannedBuild, template, validateBuildPlan, validateFixtureBuildReadiness } from './sm-f1-build-plan.mjs';

const plan = () => ({
  ...template(),
  appSha: 'a'.repeat(40),
  controlOpsSha: 'b'.repeat(40),
  originMainSha: 'c'.repeat(40),
  nodeSha256: 'd'.repeat(64),
  npmCliSha256: 'e'.repeat(64),
  sessionId: 'aa-aaaaaaaa-001',
  sourceRoot: '/home/deck/tag-analysis-private/f1-release/build-control-' + 'b'.repeat(40),
  estimatedDiskGiB: 6,
});
test('source proposal cannot self-authorize, select production API, arbitrary directory or missing pins', () => {
  const q = plan();
  validateBuildPlan(q);
  for (const p of [
    { executionPermission: true },
    { reviewed: true },
    { appSha: null },
    { apiOrigin: 'https://tag.observe.tw' },
    { sourceRoot: '/home/deck/Projects/tag.analysis.tw' },
    { sessionId: '../../old' },
    { estimatedDiskGiB: 0 },
    { memoryBudgetGiB: 4 },
    { nodeSha256: 'unknown' },
  ])
    assert.throws(() => validateBuildPlan({ ...q, ...p }));
});
test('reused sequential plan covers archive/npm/Next within same future guard and sibling HOME/logs', () => {
  const p = plannedBuild(plan());
  assert.equal(p.executionPermission, false);
  assert.equal(p.status, 'adapter-required-not-executable');
  assert.ok(!p.env.HOME.startsWith(p.paths.artifact + '/'));
  assert.equal(p.env.HOME, p.paths.job + '/home');
  assert.equal(p.commands.length, 5);
  assert.equal(p.commands[0][1][3], plan().appSha);
  for (const n of [2, 3]) {
    assert.equal(p.commands[n][0], NODE);
    assert.equal(p.commands[n][1][0], NPM_CLI);
    assert.ok(p.commands[n][1].includes('--ignore-scripts'));
  }
  assert.ok(p.commands[2][1].includes('--omit=dev'));
  assert.equal(p.commands[4][1].at(-1), 'build');
  assert.equal(p.guard.entireStage, true);
  assert.equal(p.manifest.deployEligible, false);
  assert.ok(p.requiredAdapterGaps.includes('raw-first-real-readonly-API-and-loaded-source-proof'));
});
test('legacy/current APP677 readiness or stale/missing fixture proof cannot attest a newly built APP', () => {
  const q = { appSha: 'a'.repeat(40), appSourceSha256: 'b'.repeat(64), observedAtMs: 1000, now: 2000 },
    body = {
      scope: 'sm-real-isolated-fixture-anonymous',
      productionFallback: false,
      queueEnabled: false,
      apiOrigin: 'http://127.0.0.1:18197',
      databaseName: 'tag_f1_semantic_test',
      serverVersion: '11.4.5-MariaDB',
      appSha: q.appSha,
      appSourceSha256: q.appSourceSha256,
    };
  validateFixtureBuildReadiness(body, q);
  for (const p of [
    { appSha: '677a0c793eeda0c4d850c81ac574c95508d08e0a' },
    { appSourceSha256: null },
    { apiOrigin: 'https://tag.observe.tw' },
    { databaseName: 'tag-db' },
    { queueEnabled: true },
  ])
    assert.throws(() => validateFixtureBuildReadiness({ ...body, ...p }, q));
  assert.throws(() => validateFixtureBuildReadiness(body, { ...q, now: 16001 }));
});
