import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import type { BurstEntry, RankingChart } from '../jobs/ranking-compute.ts';
import { qualifyTagMedia } from '../jobs/tag-qualification.ts';
import { discoverySignals, firstCollection, loadDiscoveryEvidence, selectDiscoveryEntries, summarizeDrafts } from './ranking-discovery.ts';

const basis = { id: 'fixed-test', media: ['a', 'b', 'c'], coverageFrom: '2026-01-01T00:00:00Z', validFrom: '2026-01-02T00:00:00Z' };
const entry = (tag: string, media: Record<string, number>, normalized = 10, burst: number | null = 20): BurstEntry => ({
  tag,
  media,
  normalized,
  burst,
  rank: 1,
  score: normalized,
  count: Object.values(media).reduce((a, b) => a + b, 0),
  history: {},
});
const chart = (entries: BurstEntry[], overrides: Partial<RankingChart> = {}): RankingChart => ({
  basis,
  entries,
  available: true,
  truncated: false,
  weight: 3,
  mediaCount: 3,
  articleCount: 10,
  hours: 24,
  ...overrides,
});

describe('cross-media discovery', () => {
  it('requires two repeatedly reporting outlets even when one outlet publishes hundreds of articles', () => {
    expect(qualifyTagMedia({ a: 200, b: 1 })).toEqual({ early: false, broad: false });
    expect(qualifyTagMedia({ a: 2, b: 2 })).toEqual({ early: true, broad: false });
    expect(qualifyTagMedia({ a: 2, b: 2, c: 1 })).toEqual({ early: true, broad: false });
    expect(qualifyTagMedia({ a: 3, b: 2, c: 1 })).toEqual({ early: true, broad: true });
  });
  it('separates growth from existing popularity and sorts only eligible growing terms', () => {
    const previous = chart([]);
    const candidates = [
      entry('熱門', { a: 3, b: 2 }, 100, 101),
      entry('發酵', { a: 3, b: 2 }, 5, 15),
      entry('單站', { a: 100 }, 1, 200),
      entry('退燒', { a: 3, b: 2 }, 20, 10),
      entry('持平', { a: 2, b: 2 }, 5, 5),
      entry('未知', { a: 3, b: 2 }, 10, null),
    ].map((e) => ({ ...e, signals: discoverySignals(e, previous, basis.id) }));
    expect(selectDiscoveryEntries(candidates, 'growth', 'early').map((e) => e.tag)).toEqual(['發酵', '熱門']);
    expect(selectDiscoveryEntries(candidates, 'score', 'early')[0].tag).toBe('熱門');
    expect(selectDiscoveryEntries(candidates, 'growth', 'all')[0].tag).toBe('單站');
    expect(candidates).toHaveLength(6);
  });
  it('detects each threshold independently instead of using rank changes', () => {
    const current = entry('議題', { a: 3, b: 2, c: 1 });
    const previous = chart([entry('議題', { a: 2, b: 2 })]);
    expect(discoverySignals(current, previous, basis.id)).toMatchObject({ earlyJump: false, broadJump: true, growth: 10 });
    expect(discoverySignals(current, chart([entry('議題', { a: 50, b: 1 })]), basis.id)).toMatchObject({
      earlyJump: true,
      broadJump: true,
    });
  });
  it('does not interpret missing, truncated or incompatible history as zero', () => {
    const current = entry('議題', { a: 3, b: 2, c: 1 });
    for (const old of [
      null,
      chart([], { truncated: true }),
      chart([], { available: false }),
      chart([], { basis: { ...basis, id: 'other' } }),
    ]) {
      expect(discoverySignals(current, old, basis.id)).toMatchObject({ earlyJump: null, broadJump: null });
    }
    expect(discoverySignals(current, chart([]), basis.id)).toMatchObject({ earlyJump: true, broadJump: true });
    expect(discoverySignals(current, chart([entry('議題', { a: 3, b: 2, c: 1 })], { truncated: true }), basis.id)).toMatchObject({
      earlyJump: false,
      broadJump: false,
    });
    expect(discoverySignals(entry('單站', { a: 99 }), null, basis.id).earlyJump).toBe(false);
  });
});

describe('first collection', () => {
  const now = new Date('2026-10-08T15:00:00Z');
  it('requires recent collection AND recent publication, so archive imports are not new topics', () => {
    expect(firstCollection(new Date('2026-10-08T14:00:00Z'), new Date('2026-10-08T13:00:00Z'), now).recent).toBe(true);
    expect(firstCollection(new Date('2026-10-08T14:00:00Z'), new Date('2015-01-01T00:00:00Z'), now).recent).toBe(false);
    expect(firstCollection(new Date('2026-10-01T14:00:00Z'), new Date('2026-10-08T13:00:00Z'), now).recent).toBe(false);
    expect(firstCollection(new Date('2026-10-08T16:00:00Z'), new Date('2026-10-08T13:00:00Z'), now).recent).toBe(false);
  });
  it('never counts the preceding 24-hour boundary as a new observation', () => {
    expect(firstCollection(new Date('2026-10-07T15:00:00Z'), new Date('2026-10-08T13:00:00Z'), now).recent).toBe(false);
  });
});

describe('similar draft groups', () => {
  it('joins chains, deduplicates pairs and ignores articles outside the tag window', () => {
    const data = summarizeDrafts(new Set([1, 2, 3, 4, 5, 6]), new Set([1, 2, 3, 4, 5]), [
      { aId: 1, bId: 2 },
      { aId: 2, bId: 3 },
      { aId: 1, bId: 2 },
      { aId: 4, bId: 5 },
      { aId: 6, bId: 999 },
    ]);
    expect(data).toEqual({ articles: 6, analyzed: 5, similarArticles: 5, groups: 2, threshold: 0.85 });
  });
  it('keeps pending articles visible even when there are no matches', () => {
    expect(summarizeDrafts(new Set([1, 2]), new Set(), [])).toMatchObject({ articles: 2, analyzed: 0, similarArticles: 0, groups: 0 });
  });
});

describe('bounded evidence lookup', () => {
  it('uses an indexed oldest-report seek and skips historical aggregation for an old tag', async () => {
    const make = (result: unknown) => {
      const query = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
        // biome-ignore lint/suspicious/noThenProperty: Drizzle query mocks must be awaitable.
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    };
    const oldest = make([{ published: new Date('2015-01-01T00:00:00Z') }]);
    const current = make([
      { tag: 'AI', id: 1, analyzed: new Date('2026-10-08T12:00:00Z') },
      { tag: 'AI', id: 2, analyzed: new Date('2026-10-08T12:00:00Z') },
      { tag: 'AI', id: 3, analyzed: null },
    ]);
    const pairs = make([{ aId: 1, bId: 2 }]);
    const db = {
      select: vi
        .fn()
        .mockImplementation((fields: Record<string, unknown>) => ('published' in fields ? oldest : 'analyzed' in fields ? current : pairs)),
    } as unknown as Db;
    const from = new Date('2026-10-07T15:00:00Z'),
      to = new Date('2026-10-08T15:00:00Z');
    const data = await loadDiscoveryEvidence(db, ['AI'], ['a', 'b'], from, to);
    expect(data.get('AI')).toEqual({
      firstCollection: null,
      drafts: { articles: 3, analyzed: 2, similarArticles: 2, groups: 1, threshold: 0.85 },
    });
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(oldest.limit).toHaveBeenCalledWith(1);
    const dialect = new MySqlDialect();
    const temporal = dialect.sqlToQuery(pairs.where.mock.calls[0][0]);
    expect(temporal.sql).toContain('`computed_at` <=');
    expect(temporal.params).toContain('2026-10-08 15:00:00.000');
    await loadDiscoveryEvidence(db, ['AI'], ['a', 'b'], from, to);
    expect(db.select).toHaveBeenCalledTimes(3);
  });
  it('does no database work for an empty result', async () => {
    const db = { select: vi.fn() } as unknown as Db;
    expect(await loadDiscoveryEvidence(db, [], ['a'], new Date(), new Date())).toEqual(new Map());
    expect(db.select).not.toHaveBeenCalled();
  });
  it('confirms a recent first collection from all outlets without using future records', async () => {
    const from = new Date('2026-10-07T15:00:00Z'),
      to = new Date('2026-10-08T15:00:00Z');
    const published = new Date('2026-10-08T12:00:00Z'),
      collected = new Date('2026-10-08T13:00:00Z');
    const queries: Array<{ fields: Record<string, unknown>; where: ReturnType<typeof vi.fn> }> = [];
    const db = {
      select: vi.fn((fields: Record<string, unknown>) => {
        const rows = 'published' in fields ? [{ published }] : 'collected' in fields ? [{ collected }] : [];
        const where = vi.fn().mockReturnThis();
        queries.push({ fields, where });
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where,
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(rows),
          // biome-ignore lint/suspicious/noThenProperty: Drizzle query mocks must be awaitable.
          then: (resolve: (r: unknown) => unknown) => Promise.resolve(rows).then(resolve),
        };
      }),
    } as unknown as Db;
    const data = await loadDiscoveryEvidence(db, ['新題'], ['a', 'b'], from, to);
    expect(data.get('新題')?.firstCollection).toEqual({
      at: collected.toISOString(),
      firstPublishedAt: published.toISOString(),
      recent: true,
    });
    const query = queries.find((q) => 'collected' in q.fields)!;
    const temporal = new MySqlDialect().sqlToQuery(query.where.mock.calls[0][0]);
    expect(temporal.sql).not.toContain('`media`');
    expect(temporal.params).toContain('2026-10-07 15:00:00.000');
    expect(temporal.params.filter((p) => p === '2026-10-08 15:00:00.000')).toHaveLength(2);
  });
});
