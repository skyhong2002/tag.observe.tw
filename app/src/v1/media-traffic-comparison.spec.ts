import { MySqlDialect } from 'drizzle-orm/mysql-core';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import {
  assembleTrafficComparison,
  loadMediaTrafficComparison,
  monthlyArticleFilter,
  publicationMonthSql,
  registerMediaTrafficComparison,
  taipeiMonthStart,
  taipeiPublicationMonth,
  trafficComparisonCache,
  trafficComparisonMonths,
} from './media-traffic-comparison.ts';

const now = new Date('2026-10-03T16:30:00Z');
const started = new Date('2026-09-27T02:00:00Z');
function fakeDb(results: unknown[][]) {
  const chains = results.map((rows) => ({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockResolvedValue(rows),
  }));
  const select = vi.fn();
  for (const chain of chains) select.mockReturnValueOnce(chain);
  return { db: { select } as unknown as Db, select, chains };
}
describe('monthly crawler and traffic comparison', () => {
  it('uses Taipei month boundaries across UTC dates and December/January', () => {
    expect(taipeiPublicationMonth(new Date('2026-09-30T15:59:59Z'))).toBe('202609');
    expect(taipeiPublicationMonth(new Date('2026-09-30T16:00:00Z'))).toBe('202610');
    expect(taipeiPublicationMonth(new Date('2026-12-31T16:00:00Z'))).toBe('202701');
    expect(taipeiMonthStart('202601').toISOString()).toBe('2025-12-31T16:00:00.000Z');
    expect(taipeiMonthStart('202610').toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(() => taipeiMonthStart('202613')).toThrow();
    const query = new MySqlDialect().sqlToQuery(publicationMonthSql());
    expect(query.sql).toContain("DATE_FORMAT(DATE_ADD(`articles`.`published_at`, INTERVAL 8 HOUR), '%Y%m')");
  });
  it('offers all reference months through the current month, preserving old snapshots beyond the rolling limit', () => {
    expect(trafficComparisonMonths(now, ['202608', '202601', '202602'])).toEqual([
      '202601',
      '202602',
      '202603',
      '202604',
      '202605',
      '202606',
      '202607',
      '202608',
      '202609',
      '202610',
    ]);
    const future = trafficComparisonMonths(new Date('2030-01-02T00:00:00Z'), ['202601', '202608', '203101', 'bad', '202613']);
    expect(future).toHaveLength(26);
    expect(future.slice(0, 3)).toEqual(['202601', '202608', '202802']);
    expect(future.at(-1)).toBe('203001');
    expect(trafficComparisonMonths(now, [])).toEqual(['202610']);
  });
  it('excludes imported, unknown-date and future articles without imposing a recent or full-body condition', () => {
    const query = new MySqlDialect().sqlToQuery(monthlyArticleFilter(taipeiMonthStart('202601'), now)!);
    expect(query.params).toEqual(['own', '2025-12-31 16:00:00.000', '2026-10-03 16:30:00.000']);
    expect(query.sql).toContain('NOT (`articles`.`fetched_at` IS NULL AND `articles`.`published_at` = `articles`.`crawled_at`)');
    expect(query.sql).toContain('`articles`.`published_at` <= ?');
    expect(query.sql).not.toMatch(/body|content_fetched|INTERVAL 14/);
  });
  it('keeps archive counts while distinguishing never acquired, zero counts and discovery ownership', () => {
    const response = assembleTrafficComparison(
      now,
      ['202601', '202609', '202610'],
      [{ media: 'udn' }, { media: 'empty' }, { media: 'google_news' }, { media: 'udn' }],
      [
        { media: 'udn', month: '202601', count: '8' },
        { media: 'udn', month: '202610', count: 3 },
        { media: 'google_news', month: '202610', count: 99 },
      ],
      [
        { media: 'udn', first: '2026-09-27 02:00:00' },
        { media: 'google_news', first: started },
      ],
      [{ media: 'google_news', month: '202610', count: '2' }],
      [{ media: 'google_news', first: '2026-10-03 14:01:25' }],
    );
    expect(response.collectionStartedAt).toBe(started.toISOString());
    expect(response.media).toHaveLength(3);
    expect(response.media[0]).toEqual({
      media: 'udn',
      sourceKind: 'publisher',
      firstAcquiredAt: started.toISOString(),
      monthly: [
        { month: '202601', articles: 8 },
        { month: '202609', articles: 0 },
        { month: '202610', articles: 3 },
      ],
    });
    expect(response.media[1]).toMatchObject({
      firstAcquiredAt: null,
      monthly: [
        { month: '202601', articles: 0 },
        { month: '202609', articles: 0 },
        { month: '202610', articles: 0 },
      ],
    });
    expect(response.media[2]).toMatchObject({
      sourceKind: 'discovery',
      firstAcquiredAt: '2026-10-03T14:01:25.000Z',
      monthly: [
        { month: '202601', articles: 0 },
        { month: '202609', articles: 0 },
        { month: '202610', articles: 2 },
      ],
    });
    expect(response).not.toHaveProperty('totals');
  });
  it('loads bounded aggregate data for all catalog sources without per-media queries', async () => {
    const { db, select, chains } = fakeDb([
      [{ media: 'udn', month: '202610', count: 3 }],
      [{ media: 'udn', first: started }],
      [{ media: 'google_news', month: '202610', count: 2 }],
      [{ media: 'google_news', first: now }],
    ]);
    const result = await loadMediaTrafficComparison(db, now);
    expect(select).toHaveBeenCalledTimes(4);
    for (const source of catalog.sources) expect(result.media.some((r) => r.media === source.media)).toBe(true);
    expect(result.media.find((r) => r.media === 'google_news')?.monthly.at(-1)?.articles).toBe(2);
    expect(chains[2].innerJoin).toHaveBeenCalledOnce();
    const firstQuery = new MySqlDialect().sqlToQuery(chains[1].where.mock.calls[0][0]);
    expect(firstQuery.sql).not.toContain('published_at');
    expect(firstQuery.params).toEqual(['own', '2026-10-03 16:30:00.000']);
    for (const [selection] of select.mock.calls) expect(selection).not.toHaveProperty('body');
  });
  it('caches successful aggregates for five minutes, coalesces concurrent loads and retries failures', async () => {
    let clock = 0;
    const loader = vi.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('db unavailable')).mockResolvedValueOnce('fresh');
    const load = trafficComparisonCache(loader, () => clock);
    expect(await Promise.all([load(), load(), load()])).toEqual(['first', 'first', 'first']);
    expect(loader).toHaveBeenCalledTimes(1);
    clock = 299999;
    expect(await load()).toBe('first');
    clock = 300000;
    await expect(load()).rejects.toThrow('db unavailable');
    expect(await load()).toBe('fresh');
    expect(loader).toHaveBeenCalledTimes(3);
  });
  it('serves the endpoint without source requests and retains null first acquisition', async () => {
    const { db, select } = fakeDb([[], [], [], []]);
    const app = Fastify();
    registerMediaTrafficComparison(app, db);
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No upstream requests'));
    try {
      const response = await app.inject('/api/v1/media-traffic-comparison');
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=300');
      expect(response.json().collectionStartedAt).toBeNull();
      expect(response.json().media.every((r: { firstAcquiredAt: unknown }) => r.firstAcquiredAt === null)).toBe(true);
      await app.inject('/api/v1/media-traffic-comparison');
      expect(select).toHaveBeenCalledTimes(4);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
      await app.close();
    }
  });
});
