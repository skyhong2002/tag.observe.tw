import { describe, expect, it } from 'vitest';
import { BURST_STEPS, computeBurst, computeRanking, effectiveWeight, splitLegacyTags } from './ranking-compute.ts';

describe('splitLegacyTags', () => {
  it('mirrors PHP explode/str_replace/strlen>1', () => {
    expect(splitLegacyTags('[台灣][a][美國]')).toEqual(['台灣', '美國']);
    expect(splitLegacyTags('')).toEqual([]);
    expect(splitLegacyTags('[ab]')).toEqual(['ab']);
    expect(splitLegacyTags('[[x]]')).toEqual([]);
  });
});

describe('computeRanking', () => {
  it('drops source aliases only for the originating outlet', () => {
    const chart = computeRanking(
      [
        { media: 'ftnn', tags: '[FTNN 新聞網][台積電]' },
        { media: 'udn', tags: '[FTNN 新聞網]' },
      ],
      { hours: 24 },
    );
    expect(chart.entries.find((entry) => entry.tag === 'FTNN 新聞網')).toMatchObject({ count: 1, media: { udn: 1 } });
    expect(chart.articleCount).toBe(2);
  });
  it('filters noise before the rank limit and when reading old snapshots without changing denominators', () => {
    const chart = computeRanking(
      [
        { media: 'a', tags: '[地方][生活][115年][2015][2026][0050][日本]' },
        { media: 'b', tags: '[生活]' },
      ],
      { hours: 24, limit: 2 },
    );
    expect(chart.entries.map((e) => e.tag)).toEqual(['0050', '日本']);
    expect(chart.mediaCount).toBe(2);
    expect(chart.articleCount).toBe(2);
    const old = {
      ...chart,
      entries: [
        { ...chart.entries[0], tag: '地方', rank: 1 },
        { ...chart.entries[1], rank: 2 },
      ],
    };
    expect(computeBurst(old, new Map()).map((e) => [e.tag, e.rank])).toEqual([['日本', 1]]);
    expect(old.entries).toHaveLength(2);
  });
  it('applies the per-media 0.5^n decay and counts every mention', () => {
    const rows = [
      { media: 'setn', tags: '[核能][台電]' },
      { media: 'setn', tags: '[核能]' },
      { media: 'setn', tags: '[核能]' },
      { media: 'cna', tags: '[核能][選舉]' },
    ];
    const chart = computeRanking(rows, { weight: 33, hours: 24 });
    expect(chart.articleCount).toBe(4);
    expect(chart.mediaCount).toBe(2);
    const nuclear = chart.entries[0];
    expect(nuclear.tag).toBe('核能');
    expect(nuclear.count).toBe(4);
    expect(nuclear.score).toBeCloseTo(1 + 0.5 + 0.25 + 1);
    expect(nuclear.media).toEqual({ setn: 3, cna: 1 });
    expect(chart.entries.map((e) => e.tag)).toEqual(['核能', '台電', '選舉']);
  });
  it('limits entries and keeps stable order for ties', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ media: 'm', tags: `[tag${i}]` }));
    const chart = computeRanking(rows, { weight: 1, hours: 1, limit: 3 });
    expect(chart.entries.map((e) => e.tag)).toEqual(['tag0', 'tag1', 'tag2']);
  });
});

describe('weights', () => {
  it('defaults to the number of media that published and falls back for old charts', () => {
    const chart = computeRanking(
      [
        { media: 'a', tags: '[xx]' },
        { media: 'b', tags: '[xx]' },
        { media: 'c', tags: '[yy]' },
      ],
      { hours: 24 },
    );
    expect(chart.weight).toBe(3);
    expect(chart.mediaCount).toBe(3);
    expect(computeRanking([], { hours: 24 }).weight).toBe(1);
    expect(effectiveWeight({ weight: 14, mediaCount: 69 })).toBe(69); // own chart from before the change
    expect(effectiveWeight({ weight: 14, mediaCount: 0 })).toBe(14); // legacy chart without a count
  });
});

describe('computeBurst', () => {
  const basis = { id: 'test-v1', media: ['a', 'b', 'c', 'd'], coverageFrom: '2026-09-28T00:00:00Z', validFrom: '2026-09-29T00:00:00Z' };
  const current = computeRanking(
    [
      { media: 'a', tags: '[xx]' },
      { media: 'b', tags: '[xx][yy]' },
    ],
    { hours: 24, basis },
  );
  const older = computeRanking([{ media: 'a', tags: '[xx]' }], { hours: 24, basis });
  const history = () => new Map(BURST_STEPS.map(([h]) => [h, older]));
  it('uses the same fixed denominator even when more cohort outlets publish', () => {
    const [x, y] = computeBurst(current, history());
    expect(x.tag).toBe('xx');
    expect(x.normalized).toBe(25);
    expect(x.burst).toBeCloseTo(25 + 12.5 * (0.92 + 0.84 + 0.7 + 0.5 + 0.25));
    expect(y.history[3]).toBe(0); // known absent from an untruncated chart
  });
  it('keeps a missing snapshot unknown instead of inventing a rise from zero', () => {
    const missing = history();
    missing.delete(48);
    expect(computeBurst(current, missing).every((e) => e.burst === null && e.history[48] === null)).toBe(true);
  });
  it('bounds a top-500 omission by the cut-off score instead of zero', () => {
    const truncated = history();
    truncated.set(3, { ...older, truncated: true });
    const yy = computeBurst(current, truncated).find((e) => e.tag === 'yy')!;
    // older keeps only xx (12.5), so yy scored at most 12.5 three hours ago.
    expect(yy.history[3]).toBeNull();
    expect(yy.burst).toBeCloseTo(12.5 + (12.5 - 12.5) * 0.92 + 12.5 * (0.84 + 0.7 + 0.5 + 0.25));
    const empty = history();
    empty.set(3, { ...older, entries: [], truncated: true });
    expect(computeBurst(current, empty).every((e) => e.burst === null)).toBe(true);
  });
  it('does not infer anything from incompatible cohorts or warmup history', () => {
    for (const old of [
      { ...older, basis: { ...basis, id: 'other' } },
      { ...older, available: false },
    ]) {
      const incompatible = history();
      incompatible.set(3, old);
      expect(computeBurst(current, incompatible).every((e) => e.burst === null)).toBe(true);
    }
  });
});
