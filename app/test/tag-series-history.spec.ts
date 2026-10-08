import { describe, expect, it } from 'vitest';
import { prependTagSeries, type TagSeries, trendRange } from '../../web/src/lib/tag-series-history.mts';
import { hourlyMovingAverage } from '../src/v1/tag-series.ts';

describe('scrollable trend history', () => {
  it('keeps the moving average continuous and the same dates after prepending', () => {
    const hour = 3600e3;
    const boundary = Date.parse('2026-10-03T00:00:00Z');
    const counts = new Map(Array.from({ length: 72 }, (_, i) => [boundary + (i - 48) * hour, i % 24 === 12 ? 240 : 0]));
    const window = (from: number, to: number): TagSeries => ({
      tag: '蔣萬安',
      category: 'all',
      hours: 24,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      hasMore: true,
      basis: { id: 'same', media: ['cna'], coverageFrom: '2026-09-01T00:00:00Z', validFrom: '2026-09-02T00:00:00Z' },
      points: hourlyMovingAverage(counts, new Date(from), new Date(to)).map((p) => ({ ...p, score: null, count: null, rank: null })),
    });
    const latest = window(boundary, boundary + 24 * hour);
    const older = window(boundary - 24 * hour, boundary);
    const combined = prependTagSeries(latest, older);
    expect(combined.points).toHaveLength(48);
    expect(combined.points.every((p) => p.average24h === 10)).toBe(true);
    const shifted = trendRange(older.points.length, 24, combined.points.length);
    expect(combined.points.slice(shifted.start, shifted.end + 1)).toEqual(latest.points);
    expect(prependTagSeries(latest, { ...older, hasMore: false }).hasMore).toBe(false);
    expect(() => prependTagSeries(latest, { ...older, basis: { ...older.basis, id: 'different' } })).toThrow();
    expect(() => prependTagSeries(latest, { ...older, to: latest.to })).toThrow();
  });
  it('clamps pan positions without changing the selected duration', () => {
    expect(trendRange(-100, 72, 216)).toEqual({ start: 0, end: 71 });
    expect(trendRange(1000, 72, 216)).toEqual({ start: 144, end: 215 });
    expect(trendRange(30, 72, 216)).toEqual({ start: 30, end: 101 });
  });
});
