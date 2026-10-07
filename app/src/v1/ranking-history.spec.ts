import { describe, expect, it } from 'vitest';
import type { RankingChart } from '../jobs/ranking-compute.ts';
import { burstTrails } from './ranking-history.ts';

const HOUR = 3600e3;
const end = Date.parse('2026-10-05T12:00:00Z');

function chart(scores: Record<string, number>, truncated = false): RankingChart {
  const entries = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, score], i) => ({ rank: i + 1, tag, score, count: 1, media: {} }));
  return { available: true, truncated, weight: 50, hours: 24, mediaCount: 1, articleCount: 1, entries };
}

/** Hourly charts for the 50 hours up to `end`, each from `scores(hoursBeforeEnd)`. */
function charts(scores: (ago: number) => Record<string, number>) {
  return new Map(Array.from({ length: 51 }, (_, ago) => [end - ago * HOUR, chart(scores(ago))] as const));
}

describe('burstTrails', () => {
  it('follows the burst order, not the score order, hour by hour', () => {
    // steady keeps the higher score; rising climbs from nothing over the last hours.
    const all = charts((ago) => ({ steady: 40, rising: Math.max(0, 30 - ago * 5) }));
    const trails = burstTrails(all, [end - 2 * HOUR, end - HOUR, end]);
    expect(trails.get('rising')?.map((p) => p.position)).toEqual([1, 1, 1]);
    expect(trails.get('steady')?.map((p) => p.position)).toEqual([2, 2, 2]);
    expect(trails.get('rising')?.at(-1)?.t).toBe('2026-10-05T12:00:00.000Z');
  });

  it('leaves a gap for hours without a snapshot or without a comparable burst', () => {
    const all = charts(() => ({ alpha: 10, beta: 5 }));
    all.delete(end - HOUR);
    // Six hours before the last point, a truncated chart without beta leaves beta's burst unknown there.
    all.set(end - 6 * HOUR, chart({ alpha: 10 }, true));
    const trails = burstTrails(all, [end - HOUR, end]);
    expect(trails.get('alpha')?.map((p) => p.position)).toEqual([null, 1]);
    expect(trails.get('beta')?.map((p) => p.position)).toEqual([null, null]);
  });
});
