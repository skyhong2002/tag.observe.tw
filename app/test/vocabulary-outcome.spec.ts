import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { vocabularyOutcome, writeVocabularyOutcome } from '../src/vocabulary/outcome.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
const now = new Date('2026-11-07T20:01:30.000Z');

it('distinguishes a paused run from a published one even though both exit 0', () => {
  const paused = vocabularyOutcome(
    'reconcile',
    { status: 'paused', reason: 'home-probe-failed', elapsedMs: 75477, lastFullReconcileAt: '2026-10-21T20:01:36.177Z', queries: 243 },
    now,
  );
  expect(paused).toEqual({
    schema: 'tag-vocabulary-outcome-v1',
    mode: 'reconcile',
    status: 'paused',
    reason: 'home-probe-failed',
    finishedAt: '2026-11-07T20:01:30.000Z',
    elapsedMs: 75477,
    pendingTags: null,
    lastFullReconcileAt: '2026-10-21T20:01:36.177Z',
  });
  const published = vocabularyOutcome(
    'reconcile',
    { status: 'published', elapsedMs: 29477, pendingTags: 0, lastFullReconcileAt: '2026-11-06T20:01:29.900Z', manifest: { id: 'x' } },
    now,
  );
  expect(published).toMatchObject({ status: 'published', reason: null, pendingTags: 0, lastFullReconcileAt: '2026-11-06T20:01:29.900Z' });
  expect(published).not.toHaveProperty('manifest');
});

it('records busy and failed runs without carrying error details', () => {
  expect(vocabularyOutcome('daily', { status: 'busy' }, now)).toMatchObject({ status: 'busy', reason: null, elapsedMs: null });
  expect(vocabularyOutcome('fast', 'failed', now)).toMatchObject({ status: 'failed', reason: null, lastFullReconcileAt: null });
  expect(vocabularyOutcome('fast', { status: 'surprise', reason: 'x' }, now)).toMatchObject({ status: 'failed', reason: null });
});

it('atomically replaces a private per-mode outcome file', async () => {
  const d = await mkdtemp(join(tmpdir(), 'vocab-outcome-'));
  dirs.push(d);
  await writeVocabularyOutcome(d, vocabularyOutcome('reconcile', { status: 'paused', reason: 'runtime-budget' }, now));
  await writeVocabularyOutcome(d, vocabularyOutcome('reconcile', { status: 'published', pendingTags: 0 }, now));
  await writeVocabularyOutcome(d, vocabularyOutcome('fast', { status: 'busy' }, now));
  expect((await readdir(d)).sort()).toEqual(['outcome-fast.json', 'outcome-reconcile.json']);
  expect(JSON.parse(await readFile(join(d, 'outcome-reconcile.json'), 'utf8'))).toMatchObject({ status: 'published', pendingTags: 0 });
  expect((await stat(join(d, 'outcome-reconcile.json'))).mode & 0o777).toBe(0o600);
});
