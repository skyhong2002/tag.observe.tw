import { describe, expect, it } from 'vitest';
import baseline from '../../data/ranking-baseline.json' with { type: 'json' };
import { applyRankingBasis, rankingBasis } from './ranking-basis.ts';
import { computeRanking, normalizedScore } from './ranking-compute.ts';

describe('fixed ranking cohort', () => {
  const basis = { id: 'test-v1', media: ['a', 'b'], coverageFrom: '2026-09-28T00:00:00Z', validFrom: '2026-09-29T00:00:00Z' };
  it('ignores newly added outlets in both the numerator and denominator', () => {
    const rows = [{ media: 'a', tags: '[日本]' }];
    const before = computeRanking(rows, { hours: 24, basis });
    const after = computeRanking([...rows, ...Array.from({ length: 108 }, (_, i) => ({ media: `new${i}`, tags: '[日本][美國]' }))], {
      hours: 24,
      basis,
    });
    expect(after).toEqual(before);
    expect(after.weight).toBe(2); // b is retained despite no articles
    expect(normalizedScore(after, after.entries[0].score)).toBe(25);
  });
  it('recomputes legacy numerators from per-outlet counts and keeps the archive untouched', () => {
    const old = computeRanking(
      [
        { media: 'a', tags: '[日本]' },
        { media: 'a', tags: '[日本]' },
        { media: 'new', tags: '[日本][美國]' },
      ],
      { hours: 24 },
    );
    const chart = applyRankingBasis(old, basis, new Date(basis.validFrom));
    expect(chart.entries).toEqual([{ tag: '日本', rank: 1, count: 2, score: 1.5, media: { a: 2 } }]);
    expect(normalizedScore(chart, chart.entries[0].score)).toBe(37.5);
    expect(old.entries).toHaveLength(2);
    expect(applyRankingBasis(old, basis, new Date(basis.coverageFrom)).available).toBe(false);
    // A stored cohort missing a current member cannot be restated.
    expect(applyRankingBasis({ ...old, basis: { ...basis, id: 'other', media: ['a'] } }, basis, new Date(basis.validFrom)).available).toBe(
      false,
    );
  });
  it('restates charts on a cohort that only removed outlets, but not on one that added them', () => {
    const v1 = { ...basis, id: 'test-v1:all:abc', media: ['a', 'b', 'c'] };
    const old = computeRanking(
      [
        { media: 'c', tags: '[香港]' },
        { media: 'a', tags: '[日本]' },
      ],
      { hours: 24, basis: v1 },
    );
    const removed = applyRankingBasis(old, basis, new Date(basis.validFrom));
    expect(removed.available).toBe(true);
    expect(removed.weight).toBe(2);
    expect(removed.entries.map((e) => e.tag)).toEqual(['日本']);
    const added = { ...basis, id: 'test-v3', media: ['a', 'b', 'c', 'd'] };
    expect(applyRankingBasis(old, added, new Date(basis.validFrom)).available).toBe(false);
  });
  it('never treats legacy omitted tags as known zeros', () => {
    const { truncated: _, ...old } = computeRanking([], { hours: 24 });
    expect(applyRankingBasis(old, basis, new Date(basis.validFrom)).truncated).toBe(true);
  });
  it('keeps every category within the frozen all-media cohort and starts after a full day', () => {
    const all = rankingBasis('all');
    expect(all.media.length).toBe(110);
    expect(all.media).not.toContain('oncc');
    for (const category of Object.keys(baseline.categories)) {
      const b = rankingBasis(category);
      expect(b.media.length).toBeGreaterThan(0);
      expect(new Set(b.media).size).toBe(b.media.length);
      expect(b.media.every((m) => all.media.includes(m))).toBe(true);
      expect(Date.parse(b.validFrom) - Date.parse(b.coverageFrom)).toBe(24 * 3600e3);
      expect(rankingBasis(category)).toEqual(b);
    }
  });
});
