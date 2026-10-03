import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { completedHourWindow, hourlyMovingAverage, loadHourlyRanks, loadHourlyTrends } from './tag-series.ts';

const HOUR = 3600e3;
const start = new Date('2026-10-03T00:00:00Z');
describe('hourly moving average', () => {
  it('uses a full trailing day at the first point and includes empty hours in the divisor', () => {
    const counts = new Map([
      [+start - 23 * HOUR, 24],
      [+start, 48],
    ]);
    const points = hourlyMovingAverage(counts, start, new Date(+start + 25 * HOUR));
    expect(points).toHaveLength(25);
    expect(points[0]).toEqual({ t: start.toISOString(), hourlyCount: 48, average24h: 3 });
    expect(points[1]).toMatchObject({ hourlyCount: 0, average24h: 2 });
    expect(points[23].average24h).toBe(2);
    expect(points[24].average24h).toBe(0);
  });
  it('smooths daily cycles without including future reports or the unfinished hour', () => {
    const counts = new Map(Array.from({ length: 96 }, (_, i) => [+start + (i - 24) * HOUR, i % 24 === 12 ? 240 : 0]));
    const window = completedHourWindow(new Date(+start + 48.5 * HOUR), 48);
    const points = hourlyMovingAverage(counts, window.from, window.to);
    expect(points.every((p) => p.average24h === 10)).toBe(true);
    expect(points.at(-1)?.t).toBe(new Date(+start + 47 * HOUR).toISOString());
  });
  it('loads warmup counts from articles, respects category and end boundary, and fills zero hours', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { tag: '日本', media: 'cna', bucket: 0, count: '24' },
        { tag: '日本', media: 'cna', bucket: 23, count: '48' },
        { tag: 'Unrequested SQL collation variant', media: 'cna', bucket: 23, count: '99' },
      ]),
    };
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Db;
    const result = await loadHourlyTrends(db, ['日本', '0050'], ['cna'], start, new Date(+start + 2 * HOUR));
    expect(result.get('日本')?.map((p) => p.average24h)).toEqual([3, 2]);
    expect(result.get('0050')?.map((p) => p.hourlyCount)).toEqual([0, 0]);
    const query = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(query.params).toEqual(['日本', '0050', 'cna', '2026-10-02 01:00:00.000', '2026-10-03 02:00:00.000']);
    expect(query.sql).toContain(' < ');
    expect(new MySqlDialect().sqlToQuery(chain.groupBy.mock.calls[0][0]).sql).toContain('COLLATE utf8mb4_bin');
  });
  it('uses fixed media for the whole curve and leaves incomplete coverage blank', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { tag: '日本', media: 'cna', bucket: 23, count: '2' },
        { tag: '日本', media: 'ltn', bucket: 23, count: '1' },
      ]),
    };
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Db;
    const basis = {
      id: 'test',
      media: ['cna', 'ltn', 'udn'],
      coverageFrom: start.toISOString(),
      validFrom: new Date(+start + 24 * HOUR).toISOString(),
    };
    const result = await loadHourlyTrends(db, ['日本'], ['new'], start, new Date(+start + 25 * HOUR), basis);
    const points = result.get('日本')!;
    expect(points[0]).toMatchObject({ hourlyCount: 3, average24h: null, count: null, score: null });
    expect(points[22].score).toBeNull();
    expect(points[23]).toMatchObject({ hourlyCount: 0, average24h: 3 / 24, count: 3 });
    expect(points[23].score).toBeCloseTo(((1.5 + 1) / 3) * 50);
    expect(points[24]).toMatchObject({ hourlyCount: 0, average24h: 0, count: 0, score: 0 });
    const query = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(query.params.slice(0, 4)).toEqual(['日本', 'cna', 'ltn', 'udn']);
    expect(query.params).not.toContain('new');
  });
});

describe('hourly ranks', () => {
  it('maps snapshot hours to the stored score rank and ignores collation variants', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { tag: '日本', hourStart: start, rank: 3 },
        { tag: '日本', hourStart: new Date(+start + HOUR), rank: 1 },
        { tag: 'Japan variant', hourStart: new Date(+start + 2 * HOUR), rank: 9 },
      ]),
    };
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Db;
    const ranks = await loadHourlyRanks(db, '日本', 'news', start, new Date(+start + 3 * HOUR));
    expect([...ranks]).toEqual([
      [start.toISOString(), 3],
      [new Date(+start + HOUR).toISOString(), 1],
    ]);
    const query = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(query.params).toEqual(['日本', 'news', '2026-10-03 00:00:00.000', '2026-10-03 03:00:00.000']);
  });
});
