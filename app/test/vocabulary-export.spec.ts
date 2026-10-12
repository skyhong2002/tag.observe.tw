import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerVocabulary } from '../src/v1/vocabulary.ts';
import { type SourceTerm, VocabularySnapshots } from '../src/vocabulary/snapshots.ts';

const folders: string[] = [];
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'tag-vocabulary-test-'));
  folders.push(directory);
  return { directory, store: new VocabularySnapshots(directory) };
}
const row = (tag: string): SourceTerm => ({
  tag,
  articleCount: 3,
  recentArticleCount: 3,
  recentArticleCounts: { '30': 3, '90': 3, '180': 3 },
  recentCountsAsOf: '2026-10-12T00:00:00.000Z',
  firstPublishedAt: '2026-09-01T00:00:00.000Z',
  lastPublishedAt: '2026-10-01T00:00:00.000Z',
});
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});
describe('immutable full indexed vocabulary export', () => {
  it('paginates all indexed terms and preserves exact identity and provenance', async () => {
    const { store } = await setup();
    const manifest = await store.publish(async () => Array.from({ length: 501 }, (_, i) => row(`新聞${i}`)));
    const first = await store.page(manifest.id);
    const second = await store.page(manifest.id, first.nextCursor!);
    expect(first.entries).toHaveLength(500);
    expect(second.entries).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(manifest).toMatchObject({ total: 501, coverage: 'all-current-indexed-article-tags' });
    const text = [...first.entries, ...second.entries].map((entry) => `${JSON.stringify(entry)}\n`).join('');
    expect(createHash('sha256').update(text).digest('hex')).toBe(manifest.sha256);
    expect(first.entries[0]).toMatchObject({ journalistAssigned: null, origin: 'article-tags-mixed' });
  });
  it('pins pages across publications and emits explicit index-absence without claiming editorial deletion', async () => {
    const { store } = await setup();
    const first = await store.publish(async () => [row('AI'), row('ai'), row('旧詞')]);
    const previousRows = (await store.page(first.id)).entries;
    const second = await store.publish(async () => [row('AI'), row('新詞')]);
    expect((await store.current()).id).toBe(second.id);
    expect((await store.page(first.id)).entries).toEqual(previousRows);
    const changes = await store.changes(first.id, second.id);
    expect(changes.entries.filter((entry) => 'action' in entry && entry.action === 'absent-from-index')).toHaveLength(2);
    expect(changes.entries.filter((entry) => 'action' in entry && entry.action === 'upsert')).toHaveLength(1);
    expect((await store.changes(second.id)).entries).toEqual([]);
    const third = await store.publish(async () => [row('AI')]);
    expect((await store.changes(first.id, third.id)).nextCursor).toBe('1');
    expect((await store.changes(first.id, second.id)).entries).toEqual(changes.entries);
  });
  it('never replaces current on source failure, duplicate rows or invalid metadata', async () => {
    const { store } = await setup();
    const first = await store.publish(async () => [row('颱風')]);
    await expect(
      store.publish(async () => {
        throw new Error('source unavailable');
      }),
    ).rejects.toThrow('source unavailable');
    await expect(store.publish(async () => [row('颱風'), row('颱風')])).rejects.toMatchObject({ code: 'invalid' });
    await expect(store.publish(async () => [{ ...row('x'), articleCount: -1 }])).rejects.toMatchObject({ code: 'invalid' });
    expect((await store.current()).id).toBe(first.id);
  });
  it('serializes publishers and can resume normal operation after a failed publisher', async () => {
    const { store } = await setup();
    let release!: () => void;
    let entered!: () => void;
    const active = new Promise<void>((r) => {
      entered = r;
    });
    const wait = new Promise<void>((r) => {
      release = r;
    });
    const publishing = store.publish(async () => {
      entered();
      await wait;
      return [row('A')];
    });
    await active;
    await expect(store.publish(async () => [row('B')])).rejects.toMatchObject({ code: 'busy' });
    release();
    await publishing;
    expect((await store.current()).total).toBe(1);
  });
  it('detects corrupted immutable pages and rejects unknown cursors', async () => {
    const { store, directory } = await setup();
    const manifest = await store.publish(async () => [row('A')]);
    for (const cursor of ['1', '-1', '1.2', '1e2', '../x'])
      await expect(store.page(manifest.id, cursor)).rejects.toMatchObject({ code: 'invalid' });
    const path = join(directory, manifest.id, 'terms-0.json');
    const rows = JSON.parse(gunzipSync(await readFile(path + '.gz')).toString('utf8'));
    rows[0].label = 'B';
    await writeFile(path, `${JSON.stringify(rows)}\n`);
    await expect(store.page(manifest.id)).rejects.toMatchObject({ code: 'unavailable' });
  });
  it('serves bounded public pages, no-store failures and 409 for an expired change base', async () => {
    const { store, directory } = await setup();
    const app = Fastify();
    registerVocabulary(app, directory);
    expect((await app.inject('/api/v1/vocabulary/snapshots/current')).statusCode).toBe(404);
    const first = await store.publish(async () => []);
    const r = await app.inject(`/api/v1/vocabulary/snapshots/${first.id}`);
    expect(r.statusCode).toBe(200);
    expect(r.json().entries).toEqual([]);
    expect(r.headers['cache-control']).toContain('immutable');
    const compact = await app.inject(`/api/v1/vocabulary/snapshots/${first.id}?compact=1`);
    expect(compact.statusCode).toBe(200);
    expect(compact.json().snapshot).toEqual({
      id: first.id,
      generatedAt: first.generatedAt,
      total: first.total,
      pageSize: first.pageSize,
      sha256: first.sha256,
    });
    await store.publish(async () => [row('A')]);
    await store.publish(async () => [row('B')]);
    const changes = await app.inject(`/api/v1/vocabulary/changes?after=${randomUUID()}`);
    expect(changes.statusCode).toBe(409);
    expect(changes.json().resnapshotRequired).toBe(true);
    expect(changes.headers['cache-control']).toBe('no-store');
    expect((await app.inject('/api/v1/vocabulary/snapshots/not-a-snapshot')).statusCode).toBe(400);
    await app.close();
  });
});

describe('shared noise policy and safe public projection', () => {
  it('retains noisy labels, separates no-equal, and excludes unexpected source data', async () => {
    const { store } = await setup();
    const manifest = await store.publish(async () => [
      row('新聞'),
      row('台灣'),
      row('AI'),
      row('The'),
      row('2026'),
      { ...row('假新聞'), body: 'private article body', email: 'private@example.invalid' },
    ]);
    const entries = (await store.page(manifest.id)).entries;
    expect(entries).toHaveLength(6);
    expect(entries.find((t) => 'label' in t && t.label === '新聞')).toMatchObject({ noise: true, noiseReasons: ['category'] });
    expect(entries.find((t) => 'label' in t && t.label === '台灣')).toMatchObject({ noise: false, noEqual: true });
    expect(entries.find((t) => 'label' in t && t.label === 'The')).toMatchObject({ noise: true, noiseReasons: ['english-function-word'] });
    expect(entries.find((t) => 'label' in t && t.label === '2026')).toMatchObject({ noise: true, noiseReasons: ['bare-year'] });
    expect(entries.find((t) => 'label' in t && t.label === '假新聞')).toMatchObject({ noise: false });
    expect(JSON.stringify(entries)).not.toContain('private');
    expect(manifest.noisePolicyVersion).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects malformed manifest counts and invalid cursors even for unchanged versions', async () => {
    const { store, directory } = await setup();
    const manifest = await store.publish(async () => [row('AI')]);
    await expect(store.changes(manifest.id, manifest.id, '../x')).rejects.toMatchObject({ code: 'invalid' });
    await expect(store.changes(manifest.id, manifest.id, '1')).rejects.toMatchObject({ code: 'invalid' });
    await writeFile(join(directory, manifest.id, 'manifest.json'), JSON.stringify({ ...manifest, total: 501 }));
    await expect(store.current()).rejects.toMatchObject({ code: 'invalid' });
  });
});

it('serves verified 5000-term compact pages and negotiated gzip for full and active snapshots', async () => {
  const { store, directory } = await setup(),
    manifest = await store.publish(async () => Array.from({ length: 5001 }, (_, i) => row(`詞${i}`)));
  expect(manifest).toMatchObject({ totalPages: 11, active: { total: 5001, totalPages: 11 } });
  expect(manifest.largePages).toHaveLength(2);
  const first = await store.page(manifest.id, '0', 'terms', true, 5000),
    last = await store.page(manifest.id, '1', 'terms', true, 5000);
  expect(first.entries).toHaveLength(5000);
  expect(last.entries).toHaveLength(1);
  expect(last.nextCursor).toBeNull();
  expect(first.sha256).toBe(manifest.largePages![0]);
  expect((await store.page(manifest.id, '0', 'active', true, 5000)).sha256).toBe(manifest.active!.largePages![0]);
  const app = Fastify();
  registerVocabulary(app, directory);
  const r = await app.inject({
    url: `/api/v1/vocabulary/snapshots/${manifest.id}/active?limit=5000&compact=1`,
    headers: { 'accept-encoding': 'gzip' },
  });
  expect(r.statusCode).toBe(200);
  expect(r.headers['content-encoding']).toBe('gzip');
  expect(r.headers.vary).toBe('accept-encoding');
  expect(JSON.parse(gunzipSync(r.rawPayload).toString()).entries).toHaveLength(5000);
  expect((await app.inject(`/api/v1/vocabulary/snapshots/${manifest.id}?limit=5001`)).statusCode).toBe(400);
  await app.close();
});

it('counts actual recent articles, excludes noise and single-code-point terms in every tier', async () => {
  const { store } = await setup();
  const measured = (tag: string, total: number, r30: number, r90: number, r180: number): SourceTerm => ({
    ...row(tag),
    articleCount: total,
    recentArticleCount: r180,
    recentArticleCounts: { '30': r30, '90': r90, '180': r180 },
  });
  const manifest = await store.publish(async () => [
    measured('歷史常見詞', 100, 0, 0, 1),
    measured('近期單次詞', 1, 1, 1, 1),
    measured('穩定事件', 5, 2, 3, 5),
    measured('短期事件', 3, 3, 3, 3),
    measured('新聞', 20, 10, 10, 10),
    measured('甲', 20, 10, 10, 10),
  ]);
  expect(manifest.active).toMatchObject({ total: 1, days: 30, policy: 'recent-article-count', minRecentArticleCount: 3 });
  expect(manifest.tiers).toMatchObject({
    measuredTerms: 4,
    missingRecentCounts: 0,
    articleCountAtLeast: { '3': 3, '5': 2, '10': 1, '20': 1 },
    recentArticleCountAtLeast: { '30': { '2': 2, '3': 1, '5': 0 }, '90': { '2': 2, '3': 2, '5': 0 }, '180': { '2': 2, '3': 2, '5': 1 } },
  });
  expect(manifest.tiers!.intersections['180']['3']['5']).toBe(1);
  const next = await store.publishStream([measured('穩定事件', 5, 2, 3, 5)], new Date(), { changes: [], resetChain: true });
  expect(next.previousId).toBeNull();
  await expect(store.changes(manifest.id, next.id)).rejects.toMatchObject({ code: 'resnapshot-required' });
});

it('retains three full snapshots and seven active subsets with explicit expiry for old chains', async () => {
  const { store, directory } = await setup();
  const ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    ids.push((await store.publish(async () => [row(`留存詞${i}`)], new Date(Date.UTC(2026, 9, 1 + i)))).id);
    await store.prune();
  }
  await expect(store.page(ids[0], '0', 'active')).rejects.toMatchObject({ code: 'not-found' });
  expect((await store.page(ids[1], '0', 'active')).entries).toHaveLength(1);
  await expect(store.page(ids[1])).rejects.toMatchObject({ code: 'resnapshot-required' });
  await expect(store.changes(ids[1], ids[7])).rejects.toMatchObject({ code: 'resnapshot-required' });
  await expect(store.changes(ids[1], ids[1])).rejects.toMatchObject({ code: 'resnapshot-required' });
  for (const id of ids.slice(5)) expect((await store.page(id)).entries).toHaveLength(1);
  expect((await store.changes(ids[6], ids[7])).entries.length).toBeGreaterThan(0);
  const { readdir } = await import('node:fs/promises');
  expect((await readdir(join(directory, ids[1]))).some((file) => file.startsWith('terms-') || file.startsWith('changes-'))).toBe(false);
});
