import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { completedHourWindow, hourlyMovingAverage, loadHourlyTrends } from './tag-series.ts';

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
        { tag: '日本', bucket: 0, count: '24' },
        { tag: '日本', bucket: 23, count: '48' },
      ]),
    };
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Db;
    const result = await loadHourlyTrends(db, ['日本', '0050'], ['cna'], start, new Date(+start + 2 * HOUR));
    expect(result.get('日本')?.map((p) => p.average24h)).toEqual([3, 2]);
    expect(result.get('0050')?.map((p) => p.hourlyCount)).toEqual([0, 0]);
    const query = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(query.params).toEqual(['日本', '0050', 'cna', '2026-10-02 01:00:00.000', '2026-10-03 02:00:00.000']);
    expect(query.sql).toContain(' < ');
  });
});
