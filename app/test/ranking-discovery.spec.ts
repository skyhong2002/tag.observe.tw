import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { rankingHref, rankingQuery } from '../../web/src/lib/ranking-query.mts';
import type { Db } from '../src/db/client.ts';
import { rankingBasis } from '../src/jobs/ranking-basis.ts';
import { computeRanking, type RankingChart } from '../src/jobs/ranking-compute.ts';
import { registerV1Routes } from '../src/v1/routes.ts';

describe('discovery ranking API', () => {
  it('filters the full ranking before limiting and makes the selected gate explicit', async () => {
    const basis = rankingBasis('news');
    const media = basis.media.slice(0, 3);
    const now = new Date('2026-10-08T15:00:00Z');
    const current = computeRanking(
      [
        ...Array.from({ length: 100 }, () => ({ media: media[0], tags: '[單站]' })),
        ...media.flatMap((m) => Array.from({ length: 2 }, () => ({ media: m, tags: '[新題]' }))),
      ],
      { hours: 24, basis },
    );
    const previous: RankingChart = { ...current, entries: [], truncated: false };
    const olderRows = [3, 6, 12, 24, 48].map((h) => ({
      hourStart: new Date(now.getTime() - h * 3600e3),
      computedAt: new Date(now.getTime() - h * 3600e3),
      chart: JSON.stringify(previous),
    }));
    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue([
            { id: 1, hourStart: now, computedAt: now, chart: JSON.stringify(current), articleCount: 106, mediaCount: 3 },
          ]),
        // biome-ignore lint/suspicious/noThenProperty: Drizzle query mocks must be awaitable.
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(olderRows).then(resolve),
      })),
    } as unknown as Db;
    const app = Fastify();
    await registerV1Routes(app, db);
    try {
      const response = await app.inject('/api/v1/ranking?category=news&order=growth&limit=1');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        order: 'growth',
        gate: 'early',
        matchedCount: 1,
        unknownGrowthCount: 0,
        entries: [{ tag: '新題', position: 1, signals: { early: true, broad: false, earlyJump: true } }],
      });
      expect((await app.inject('/api/v1/ranking?category=news&order=growth&gate=broad')).json().entries).toEqual([]);
      expect((await app.inject('/api/v1/ranking?category=news&gate=bogus')).statusCode).toBe(400);
      expect((await app.inject('/api/v1/ranking?category=news&order=bogus')).statusCode).toBe(400);
      expect((await app.inject('/api/v1/ranking?category=bogus')).statusCode).toBe(404);
      expect((await app.inject('/api/v1/ranking?at=bogus')).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe('ranking views', () => {
  it('starts both page modes unrestricted and preserves explicit filters', () => {
    expect(rankingQuery({})).toMatchObject({ order: 'burst', gate: 'all', limit: 50 });
    expect(rankingQuery({ order: 'growth' })).toMatchObject({ order: 'growth', gate: 'all' });
    expect(rankingQuery({ order: 'growth', gate: 'all' })).toMatchObject({ gate: 'all' });
    expect(rankingQuery({ order: 'growth', gate: 'broad', limit: '999.9' })).toMatchObject({ gate: 'broad', limit: 200 });
    expect(rankingQuery({ order: 'bogus', gate: 'bogus' })).toMatchObject({ order: 'burst', gate: 'all' });
  });

  it('clears the media gate when moving from news to a smaller category or switching modes', () => {
    const current = rankingQuery({ category: 'news', order: 'burst', gate: 'early' });
    const params = (patch: Parameters<typeof rankingHref>[1]) =>
      new URL(rankingHref(current, patch), 'https://tag.observe.tw').searchParams;
    expect(params({ category: 'style' }).get('gate')).toBe('all');
    expect(params({ order: 'growth' }).get('gate')).toBe('all');
    expect(params({ category: 'style', gate: 'broad' }).get('gate')).toBe('broad');
  });

  it('keeps a chosen gate for sorting, more rows and clicking the active view', () => {
    const current = rankingQuery({ category: 'style', order: 'burst', gate: 'early' });
    for (const patch of [{ order: 'score' }, { category: 'style' }, { limit: '100' }, { sort: 'count', dir: 'asc' }]) {
      expect(new URL(rankingHref(current, patch), 'https://tag.observe.tw').searchParams.get('gate')).toBe('early');
    }
  });
});
