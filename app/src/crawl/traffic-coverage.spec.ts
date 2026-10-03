import { describe, expect, it } from 'vitest';
import { calculateTrafficCoverage, trafficBaseline } from './traffic-coverage.ts';

describe('traffic-weighted source coverage', () => {
  const all = new Set(trafficBaseline.sources.map((s) => s.media));
  it('excludes untraced syndication from both sides while retaining the original reference', () => {
    const result = calculateTrafficCoverage(new Set([...all, 'yahoo']), new Set([...all, 'yahoo']));
    expect(result.referenceSources).toBe(29);
    expect(result.referenceTraffic).toBe(253.287);
    expect(result.totalSources).toBe(28);
    expect(result.totalTraffic).toBe(252.498);
    expect(result.coveredTraffic).toBe(252.498);
    expect(result.excludedTraffic).toBe(0.789);
    expect(result.excluded.map((s) => s.media)).toEqual(['yam']);
    expect(result.missing).toEqual([]);
    expect(result.coveredShare).toBe(1);
    expect(result.meetsTarget).toBe(true);
  });
  it('does not count a configured source without recent collected articles', () => {
    const collected = new Set(all);
    collected.delete('udn');
    const result = calculateTrafficCoverage(all, collected);
    expect(result.configuredShare).toBe(1);
    expect(result.coveredTraffic).toBe(213.488);
    expect(result.meetsTarget).toBe(false);
    expect(result.missing.map((s) => s.media)).toEqual(['udn']);
  });
  it('does not count disabled sources even if their articles still exist', () => {
    const active = new Set(all);
    active.delete('ettoday');
    const result = calculateTrafficCoverage(active, all);
    expect(result.coveredTraffic).toBe(221.628);
    expect(result.meetsTarget).toBe(false);
  });
  it('weights traffic rather than the fraction of outlets and reports an empty window as failing', () => {
    const collected = new Set(all);
    for (const media of ['mirrordaily', 'mnews', 'yam', 'knews']) collected.delete(media);
    const result = calculateTrafficCoverage(all, collected);
    expect(result.coveredSources).toBe(25);
    expect(result.coveredShare).toBeCloseTo(248.312 / 252.498, 8);
    expect(result.meetsTarget).toBe(true);
    expect(calculateTrafficCoverage(all, new Set()).coveredShare).toBe(0);
    expect(calculateTrafficCoverage(all, new Set()).meetsTarget).toBe(false);
  });
  it('does not count a syndicated source even when it is the only active source with articles', () => {
    const result = calculateTrafficCoverage(new Set(['yam']), new Set(['yam']));
    expect(result.coveredSources).toBe(0);
    expect(result.configuredShare).toBe(0);
    expect(result.coveredTraffic).toBe(0);
    expect(result.meetsTarget).toBe(false);
    expect(result.missing.some((s) => s.media === 'yam')).toBe(false);
  });
});
