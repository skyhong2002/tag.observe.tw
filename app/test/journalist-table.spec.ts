import { describe, expect, it } from 'vitest';
import { matchesFilters, metricCount, metricShare, sortValue, type TableFilters } from '../../web/src/lib/journalist-table.mts';
import type { JournalistSummary } from '../src/journalists/aggregate.ts';

const row: JournalistSummary = {
  name: '王小明',
  articles: 100,
  compared: 80,
  unmatched: 20,
  withBody: 90,
  cited: 10,
  latest: '2026-10-01T00:00:00Z',
  media: [{ media: 'a', name: 'A', count: 100 }],
  similar: { articles: 60, pairs: 300, later: 25, earlier: 30, sameAuthor: 40, attributed: 5, identical: 10 },
};
const filters: TableFilters = {
  query: '',
  media: '',
  relation: '',
  minArticles: 0,
  minCoverage: 0,
  metric: 'unmatched',
  minShare: '',
  maxShare: '',
};
describe('journalist table ratios and filters', () => {
  it('uses total posts as the denominator, never pair counts or compared-only totals', () => {
    expect(metricCount(row, 'matched')).toBe(60);
    expect(metricShare(row, 'matched')).toBe(0.6);
    expect(metricShare(row, 'unmatched')).toBe(0.2);
    expect(metricShare({ ...row, articles: 0 }, 'unmatched')).toBeNull();
  });
  it('orders proportion independently of volume', () => {
    const smaller = { ...row, articles: 10, unmatched: 5 };
    expect(sortValue(row, 'unmatched', 'count')).toBeGreaterThan(sortValue(smaller, 'unmatched', 'count'));
    expect(sortValue(row, 'unmatched', 'share')).toBeLessThan(sortValue(smaller, 'unmatched', 'share'));
  });
  it('intersects filters and includes exact percentage boundaries', () => {
    const combined: TableFilters = {
      ...filters,
      query: ' 小明 ',
      media: 'a',
      relation: 'unmatched',
      minArticles: 100,
      minCoverage: 80,
      minShare: '20',
      maxShare: '20',
    };
    expect(matchesFilters(row, combined)).toBe(true);
    for (const patch of [{ media: 'b' }, { minArticles: 101 }, { minCoverage: 81 }, { minShare: '21' }, { maxShare: '19' }]) {
      expect(matchesFilters(row, { ...combined, ...patch })).toBe(false);
    }
    expect(matchesFilters({ ...row, unmatched: 0 }, { ...filters, relation: 'unmatched' })).toBe(false);
    expect(matchesFilters(row, filters)).toBe(true);
  });
});
