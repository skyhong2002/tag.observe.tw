import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { rankingBasis } from '../src/jobs/ranking-basis.ts';
import { collectPool, entryLine, LIMITS, parseWindowQuery, type SourceRow, type WindowQuery } from '../src/ranking-pools/core.ts';
import { readPool } from '../src/ranking-pools/reader.ts';
import { PoolStore } from '../src/ranking-pools/store.ts';

const now = new Date('2026-10-14T12:00:00Z');
const query: WindowQuery = { category: 'news', since: '2026-10-13T16:00:00.000Z', until: now.toISOString(), gate: 'early', order: 'score' };
const basis = { id: 'test', media: ['ltn', 'cna'], coverageFrom: '2026-01-01T00:00:00.000Z', validFrom: '2026-01-02T00:00:00.000Z' };
async function* rows(r: SourceRow[]) {
  yield* r;
}
const source = (id: number, media: string, tags: string[], at = query.since): SourceRow => ({ id, media, tags, publishedAt: new Date(at) });
const collect = (r: SourceRow[], q = query) => collectPool(rows(r), q, basis);
describe('exact window and whole-term aggregation', () => {
  it('accepts today and exactly7days, rejects ignored duration/order/offset/invalid/future parameters', () => {
    expect(parseWindowQuery({ ...query }, now)).toEqual(query);
    expect(parseWindowQuery({ ...query, since: '2026-10-07T12:00:00Z' }, now).since).toBe('2026-10-07T12:00:00.000Z');
    for (const q of [
      { ...query, days: '7' },
      { ...query, order: 'burst' },
      { ...query, since: '2026-02-30T00:00:00Z' },
      { ...query, until: '2026-10-14T12:01:00Z' },
      { ...query, since: query.until },
      { ...query, since: '2026-10-01T00:00:00Z' },
      { ...query, since: '2026-10-14T00:00:00+08:00' },
    ])
      expect(() => parseWindowQuery(q, now)).toThrow();
  });
  it('deduplicates within article and repeated rows, filters before sorting, uses half-open boundaries/cohort', async () => {
    const r = [
      source(1, 'ltn', ['柯文哲', '柯文哲', '新聞']),
      source(2, 'ltn', ['柯文哲']),
      source(3, 'cna', ['柯文哲']),
      source(4, 'cna', ['柯文哲']),
      source(4, 'cna', ['柯文哲']),
      source(5, 'cna', ['柯文哲'], query.until),
      source(6, 'outside', ['柯文哲']),
      source(7, 'ltn', ['低頻']),
    ];
    const p = await collect(r);
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({ tag: '柯文哲', rank: 1, articleCount: 4, mediaCount: 2, media: { cna: 2, ltn: 2 }, score: 3 });
    expect(p.sourceArticleCount).toBe(5);
  });
  it('early rejects3+1 even though totals satisfy N4/M2', async () => {
    const p = await collect([
      source(1, 'ltn', ['低頻事件']),
      source(2, 'ltn', ['低頻事件']),
      source(3, 'ltn', ['低頻事件']),
      source(4, 'cna', ['低頻事件']),
    ]);
    expect(p.entries).toEqual([]);
  });
  it('keeps exact Unicode labels, excludes control noise and own-media names, sorts score ties deterministically', async () => {
    const tags = ['事件甲', '事件乙', 'éclair', 'e\u0301clair', '\u0003比基尼', '自由時報'];
    const p = await collect([source(1, 'ltn', tags), source(2, 'ltn', tags), source(3, 'cna', tags), source(4, 'cna', tags)]);
    expect(p.entries.map((e) => e.tag)).toContain('éclair');
    expect(p.entries.map((e) => e.tag)).toContain('e\u0301clair');
    expect(p.entries.map((e) => e.tag)).not.toContain('\u0003比基尼');
    expect(p.entries.find((e) => e.tag === '自由時報')).toBeUndefined();
    expect(p.entries.map((e) => e.tag)).toEqual(p.entries.map((e) => e.tag).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))));
  });
  it('broad exactly reuses the existing two twice-media/three-media/one triple rule', async () => {
    const p = await collectPool(
      rows([
        source(1, 'ltn', ['稀少事件']),
        source(2, 'ltn', ['稀少事件']),
        source(3, 'cna', ['稀少事件']),
        source(4, 'cna', ['稀少事件']),
        source(5, 'ltn', ['稀少事件']),
        source(6, 'third', ['稀少事件']),
      ]),
      { ...query, gate: 'broad' },
      { ...basis, media: [...basis.media, 'third'] },
    );
    expect(p.entries[0]).toMatchObject({ articleCount: 6, mediaCount: 3 });
  });
  it('caps are explicit failure, never a truncated published pool', async () => {
    await expect(
      collectPool(rows([source(1, 'ltn', ['事件甲']), source(2, 'cna', ['事件甲'])]), query, basis, { ...LIMITS, articles: 1 }),
    ).rejects.toThrow('source-row-cap');
    await expect(collectPool(rows([source(1, 'ltn', ['事件甲', '事件乙'])]), query, basis, { ...LIMITS, tags: 1 })).rejects.toThrow(
      'candidate-cap',
    );
  });
});
async function api(total = 1201) {
  const clock = { at: now.getTime() },
    dir = fs.mkdtempSync(path.join(tmpdir(), 'tag-ranking-pool-test-')),
    store = new PoolStore(dir, () => clock.at);
  const labels = Array.from({ length: total }, (_, i) => '事件詞' + i.toString().padStart(5, '0'));
  const roster = rankingBasis('news');
  const [a, b] = roster.media;
  const read = vi.fn(async () => ({
    ...(await collectPool(rows([source(1, a, labels), source(2, a, labels), source(3, b, labels), source(4, b, labels)]), query, roster)),
    asOf: now.toISOString(),
  }));
  const app = await buildApp(
    { uiOrigin: 'http://127.0.0.1:1' },
    { db: {} as never, rankingPools: { store, read, now: () => new Date(clock.at) } },
  );
  return { app, store, read, dir, clock };
}
const url = '/api/v1/ranking-pools?' + new URLSearchParams({ ...query });
describe('immutable complete API pagination and integrity', () => {
  it('returns all1201 terms, independent of500/5000 limit; verifies canonical full checksum and reuse', async () => {
    const { app, read } = await api();
    try {
      const m = (await app.inject(url)).json();
      expect(m).toMatchObject({ available: true, eligibleTotal: 1201, truncated: false, totalPages: 3 });
      expect((await app.inject(url)).json().snapshotId).toBe(m.snapshotId);
      expect(read).toHaveBeenCalledTimes(1);
      const all = [];
      let cursor = null;
      do {
        const r: { entries: import('../src/ranking-pools/core.ts').PoolEntry[]; nextCursor: string | null } = (
          await app.inject(`/api/v1/ranking-pools/${m.snapshotId}?limit=500${cursor ? '&cursor=' + cursor : ''}`)
        ).json();
        all.push(...r.entries);
        cursor = r.nextCursor;
      } while (cursor);
      expect(all).toHaveLength(1201);
      expect(all.map((e) => e.rank)).toEqual(Array.from({ length: 1201 }, (_, i) => i + 1));
      expect(createHash('sha256').update(all.map(entryLine).join('')).digest('hex')).toBe(m.checksum.value);
      const big = (await app.inject(`/api/v1/ranking-pools/${m.snapshotId}?limit=5000`)).json();
      expect(big.entries).toHaveLength(1201);
      expect(big.totalPages).toBe(1);
      expect(big.nextCursor).toBeNull();
    } finally {
      await app.close();
    }
  });
  it('distinguishes complete empty with empty checksum from missing/incomplete', async () => {
    const { app } = await api(0);
    try {
      const m = (await app.inject(url)).json();
      expect(m).toMatchObject({ available: true, eligibleTotal: 0, truncated: false, totalPages: 0 });
      expect(m.checksum.value).toBe(createHash('sha256').digest('hex'));
      expect((await app.inject('/api/v1/ranking-pools/' + 'f'.repeat(64))).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
  it('rejects cursor mismatch, bad limits, expiration and attempts to alter window', async () => {
    const { app, clock } = await api();
    try {
      const m = (await app.inject(url)).json();
      const c = Buffer.from(JSON.stringify({ snapshotId: 'f'.repeat(64), offset: 500 })).toString('base64url');
      expect((await app.inject(`/api/v1/ranking-pools/${m.snapshotId}?cursor=${c}`)).statusCode).toBe(409);
      for (const suffix of ['limit=5001', 'cursor=%', 'since=2026-01-01'])
        expect((await app.inject(`/api/v1/ranking-pools/${m.snapshotId}?${suffix}`)).statusCode).toBe(400);
      clock.at += 864e5 + 1;
      expect((await app.inject(`/api/v1/ranking-pools/${m.snapshotId}`)).statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });
  it('has gzip and retains all four credential no-store predicates', async () => {
    const { app } = await api(1);
    try {
      const m = (await app.inject(url)).json();
      const page = `/api/v1/ranking-pools/${m.snapshotId}`;
      const r = await app.inject({ url: page, headers: { 'accept-encoding': 'gzip' } });
      expect(r.headers['content-encoding']).toBe('gzip');
      expect(JSON.parse(gunzipSync(r.rawPayload).toString()).entries).toHaveLength(1);
      expect((await app.inject({ url: page, headers: { 'accept-encoding': 'gzip;q=0' } })).headers['content-encoding']).toBeUndefined();
      for (const h of ['cookie', 'authorization', 'x-service-token', 'x-api-key'])
        expect((await app.inject({ url: page, headers: { [h]: 'invalid' } })).headers['cache-control']).toBe('private, no-store');
      expect((await app.inject(page)).headers['cache-control']).toContain('public');
    } finally {
      await app.close();
    }
  });
  it('corrupt private snapshot page cannot be served as public data', async () => {
    const { app, store } = await api(1);
    try {
      const m = (await app.inject(url)).json();
      fs.writeFileSync(path.join(store.dir(m.snapshotId), 'page-0.json.gz'), 'not-valid-original-data');
      expect((await app.inject(`/api/v1/ranking-pools/${m.snapshotId}`)).statusCode).toBe(503);
    } finally {
      await app.close();
    }
  });
  it('source failure publishes no manifest and gives explicit unavailable', async () => {
    const { app, read, dir } = await api();
    try {
      read.mockRejectedValueOnce(Error('private-error-secret'));
      const r = await app.inject(url);
      expect(r.statusCode).toBe(503);
      expect(r.json()).toMatchObject({ available: false, eligibleTotal: null, checksum: null, truncated: true });
      expect(r.body).not.toContain('private-error-secret');
      expect(fs.readdirSync(dir)).toEqual([]);
    } finally {
      await app.close();
    }
  });
});

describe('bounded reader and private snapshot safety', () => {
  it('acquisition deadline releases a late connection instead of wedging the producer', async () => {
    let resolve!: (c: unknown) => void;
    const release = vi.fn();
    const db = {
      $client: {
        getConnection: () =>
          new Promise((r) => {
            resolve = r;
          }),
      },
    };
    await expect(readPool(db as never, query, basis, 20)).rejects.toThrow('compute-deadline');
    resolve({ release });
    await new Promise((r) => setImmediate(r));
    expect(release).toHaveBeenCalledOnce();
  });
  it('setup timeout destroys its own read-only connection without awaiting rollback', async () => {
    const destroy = vi.fn(),
      release = vi.fn(),
      rollback = vi.fn();
    const db = { $client: { getConnection: async () => ({ query: () => new Promise(() => {}), destroy, release, rollback }) } };
    await expect(readPool(db as never, query, basis, 20)).rejects.toThrow('compute-deadline');
    expect(destroy).toHaveBeenCalledOnce();
    expect(release).not.toHaveBeenCalled();
    expect(rollback).not.toHaveBeenCalled();
  });
  it('a valid snapshot for another window cannot satisfy a cached query', async () => {
    const { app, store, dir } = await api(1);
    try {
      const m = (await app.inject(url)).json();
      const index = fs.readdirSync(dir).find((x) => x.startsWith('query-'))!;
      const key = index.slice(6, -5);
      const foreign = { ...m, window: { ...m.window, since: '2026-10-07T16:00:00.000Z' } };
      const { snapshotId: _id, ...content } = foreign;
      const id = createHash('sha256').update(JSON.stringify(content)).digest('hex');
      fs.mkdirSync(store.dir(id));
      fs.writeFileSync(path.join(store.dir(id), 'manifest.json'), JSON.stringify({ snapshotId: id, ...content }));
      fs.writeFileSync(path.join(dir, index), JSON.stringify({ id, at: now.getTime() }));
      expect(store.cached(key)).toBeNull();
    } finally {
      await app.close();
    }
  });
  it('rejects root, manifest and page symlinks even with originally valid bytes', async () => {
    const { app, store, dir } = await api(1);
    try {
      const m = (await app.inject(url)).json();
      const manifest = path.join(store.dir(m.snapshotId), 'manifest.json');
      const outside = path.join(dir, 'outside-manifest');
      fs.renameSync(manifest, outside);
      fs.symlinkSync(outside, manifest);
      expect(() => store.get(m.snapshotId)).toThrow();
      const rootLink = dir + '-link';
      fs.symlinkSync(dir, rootLink);
      expect(() => new PoolStore(rootLink).get(m.snapshotId)).toThrow();
      const page = path.join(store.dir(m.snapshotId), 'page-0.json.gz');
      const other = path.join(dir, 'outside-page');
      fs.renameSync(page, other);
      fs.symlinkSync(other, page);
      expect(() => store.page(m, 0, 500)).toThrow();
    } finally {
      await app.close();
    }
  });
});

it('rejects a manifest growing after fstat instead of reading beyond its observed bound', async () => {
  const { app, store } = await api(1);
  try {
    const m = (await app.inject(url)).json();
    const file = path.join(store.dir(m.snapshotId), 'manifest.json');
    const original = fs.fstatSync;
    let first = true;
    const spy = vi.spyOn(fs, 'fstatSync').mockImplementation(((fd: number) => {
      const stat = original(fd);
      if (first) {
        first = false;
        fs.appendFileSync(file, ' '.repeat(1024 ** 2));
      }
      return stat;
    }) as typeof fs.fstatSync);
    try {
      expect(() => store.get(m.snapshotId)).toThrow();
    } finally {
      spy.mockRestore();
    }
  } finally {
    await app.close();
  }
});
