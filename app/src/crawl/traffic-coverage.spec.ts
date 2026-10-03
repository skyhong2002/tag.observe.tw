import { describe, expect, it } from 'vitest';
import { calculateTrafficCoverage, trafficBaseline } from './traffic-coverage.ts';

describe('traffic-weighted source coverage', () => {
  const all = new Set(trafficBaseline.sources.map((s) => s.media));
  it('keeps the screenshot denominator fixed and ignores unrelated outlets', () => {
    const result = calculateTrafficCoverage(new Set([...all, 'yahoo']), new Set([...all, 'yahoo']));
    expect(result.totalSources).toBe(29);
    expect(result.totalTraffic).toBe(253.287);
    expect(result.coveredShare).toBe(1);
    expect(result.meetsTarget).toBe(true);
  });
  it('does not count a configured source without recent collected articles', () => {
    const collected = new Set(all);
    collected.delete('udn');
    const result = calculateTrafficCoverage(all, collected);
    expect(result.configuredShare).toBe(1);
    expect(result.coveredTraffic).toBe(214.277);
    expect(result.meetsTarget).toBe(false);
    expect(result.missing.map((s) => s.media)).toEqual(['udn']);
  });
  it('does not count disabled sources even if their articles still exist', () => {
    const active = new Set(all);
    active.delete('ettoday');
    const result = calculateTrafficCoverage(active, all);
    expect(result.coveredTraffic).toBe(222.417);
    expect(result.meetsTarget).toBe(false);
  });
  it('weights traffic rather than the fraction of outlets and reports an empty window as failing', () => {
    const collected = new Set(all);
    for (const media of ['mirrordaily', 'mnews', 'yam', 'knews']) collected.delete(media);
    const result = calculateTrafficCoverage(all, collected);
    expect(result.coveredSources).toBe(25);
    expect(result.coveredShare).toBeCloseTo(0.980358, 5);
    expect(result.meetsTarget).toBe(true);
    expect(calculateTrafficCoverage(all, new Set()).coveredShare).toBe(0);
    expect(calculateTrafficCoverage(all, new Set()).meetsTarget).toBe(false);
  });
});
