import { describe, expect, it } from 'vitest';
import { computeBurst, computeRanking, effectiveWeight, splitLegacyTags } from './ranking-compute.ts';

describe('splitLegacyTags', () => {
  it('mirrors PHP explode/str_replace/strlen>1', () => {
    expect(splitLegacyTags('[台灣][a][美國]')).toEqual(['台灣', '美國']);
    expect(splitLegacyTags('')).toEqual([]);
    expect(splitLegacyTags('[ab]')).toEqual(['ab']);
    expect(splitLegacyTags('[[x]]')).toEqual([]);
  });
});

describe('computeRanking', () => {
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
  it('normalizes each chart by its own media count and applies the weighted history delta', () => {
    // current: 2 media publishing, xx in both -> score 2 -> 2/2*50 = 50
    const current = computeRanking(
      [
        { media: 'a', tags: '[xx]' },
        { media: 'b', tags: '[xx][yy]' },
      ],
      { hours: 24 },
    );
    // 3h ago: 4 media publishing, xx in one -> 1/4*50 = 12.5 (a constant weight would hide this)
    const older = computeRanking(
      [
        { media: 'a', tags: '[xx]' },
        { media: 'c', tags: '[zz]' },
        { media: 'd', tags: '[zz]' },
        { media: 'e', tags: '[zz]' },
      ],
      { hours: 24 },
    );
    const history = new Map<number, ReturnType<typeof computeRanking> | null>([
      [3, older],
      [6, null],
      [12, null],
      [24, null],
      [48, null],
    ]);
    const [x, y] = computeBurst(current, history);
    const nx = 50,
      ox = 12.5;
    expect(x.tag).toBe('xx');
    expect(x.normalized).toBeCloseTo(nx);
    expect(x.burst).toBeCloseTo(nx + (nx - ox) * 0.92 + nx * (0.84 + 0.7 + 0.5 + 0.25));
    expect(y.history[3]).toBeNull();
  });
});
