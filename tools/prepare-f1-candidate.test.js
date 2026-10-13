import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOptions, validateEvidence, stagePlan, competingBuilds } from './prepare-f1-candidate.js';
const evidence = { owner: 'tag', authorizedAt: '2026-10-13T05:10:00Z', sourceMessage: '2026-10-13 explicit relative gates; single global build slot confirmed for tag', globalBuildSlotConfirmed: true };
const metadata = { isFile: () => true, uid: 42, mode: 0o100600 };
test('private explicit global-slot handoff fails closed', () => {
  validateEvidence(evidence, metadata, 42);
  for (const bad of [{}, { ...evidence, owner: 'blog' }, { ...evidence, authorizedAt: 'today' }, { ...evidence, sourceMessage: 'generated' }, { ...evidence, globalBuildSlotConfirmed: false }, { ...evidence, sourceMessage: '2026-10-13 two-hour sprint; tag may build alongside blog' }]) assert.throws(() => validateEvidence(bad, metadata, 42));
  assert.throws(() => validateEvidence(evidence, { ...metadata, mode: 0o100644 }, 42));
  assert.throws(() => validateEvidence(evidence, metadata, 43));
});
test('estimate and explicit isolated HTTP API required', () => {
  const options = { evidence: '/private', candidate: '/new', estimate: 5, api: 'http://127.0.0.1:3999' };
  validateOptions(options);
  for (const api of ['https://tag.observe.tw', 'http://example.com', 'http://tag.observe.tw:3000', 'http://x:3000/path', 'http://user:pass@x:3000']) assert.throws(() => validateOptions({ ...options, api }));
  for (const estimate of [0, NaN, undefined, -1]) assert.throws(() => validateOptions({ ...options, estimate }));
});
test('entire sequential archive/install/build plan uses argument arrays and exact SHA', () => {
  const sha = 'a'.repeat(40);
  const plan = stagePlan('/repo', '/new;literal', sha);
  assert.deepEqual(plan.map(([bin]) => bin), ['git', 'tar', 'npm', 'npm', process.execPath]);
  assert.equal(plan[0][1][3], sha);
  assert.equal(plan[0][1][2], '--output=/new;literal/source.tar');
  assert.equal(plan[4][1].at(-1), 'build');
});
test('mock process scan counts Next/Docker; only disappeared processes ignored', () => {
  const commands = { 1: 'node\0/x/next\0build\0', 2: 'docker\0buildx\0build\0.', 3: 'node\0app.js\0' };
  assert.equal(competingBuilds('/fake', (path) => commands[path.split('/')[2]], () => Object.keys(commands)).length, 2);
  assert.throws(() => competingBuilds('/fake', () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); }, () => ['1']), /denied/);
  assert.deepEqual(competingBuilds('/fake', () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); }, () => ['1']), []);
});
test('mock stage covers every command then static copy and prepared manifest without real writes', async () => {
  const { runStage } = await import('./prepare-f1-candidate.js');
  const events = [];
  const io = Object.fromEntries(['mkdirSync', 'cpSync', 'writeFileSync', 'appendFileSync'].map((method) => [method, (...args) => events.push([method, ...args])]));
  io.existsSync = (path) => !path.endsWith('standalone/server.js');
  io.readFileSync = () => 'fake-build-id\n';
  runStage({ repo: '/repo', candidate: '/new', api: 'http://127.0.0.1:3999' }, 'a'.repeat(40), (...args) => events.push(['command', ...args]), io, () => []);
  assert.deepEqual(events.slice(0, 5).map((e) => e[1]), ['git', 'tar', 'npm', 'npm', process.execPath]);
  const manifest = events.find((e) => e[0] === 'writeFileSync' && e[1].endsWith('manifest.json'));
  assert.equal(JSON.parse(manifest[2]).status, 'prepared');
  assert.equal(JSON.parse(manifest[2]).ui, 'not reviewed');
  assert.throws(() => runStage({ candidate: '/new' }, 'a'.repeat(40), () => { throw new Error('fake failure'); }, io, () => []), /fake failure/);
  assert.ok(events.some((e) => e[0] === 'appendFileSync' && e[2].includes('fake failure')));
});
test('stage refuses Next when another external build appeared during npm installs', async () => {
  const { runStage } = await import('./prepare-f1-candidate.js');
  const calls = []; const errors = []; let scans = 0;
  assert.throws(() => runStage({ repo: '/repo', candidate: '/new', api: 'http://127.0.0.1:3999' }, 'a'.repeat(40), (bin) => calls.push(bin), { appendFileSync: (...args) => errors.push(args) }, () => ++scans === 1 ? [] : [{ pid: '1' }]), /No local build slot/);
  assert.deepEqual(calls, ['git', 'tar', 'npm', 'npm']);
  assert.equal(errors.length, 1);
});
