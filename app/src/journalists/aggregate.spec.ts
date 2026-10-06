import { describe, expect, it } from 'vitest';
import type { SimilarityArticle, SimilarityPair } from '../similarity/types.ts';
import { type BylineRow, countFirstSeen, countSimilarity, countUnmatched, orientPair, summarizeJournalists } from './aggregate.ts';

const article = (id: number, media: string, publishedAt: string, authors: string[], attributions: string[] = []): SimilarityArticle => ({
  id,
  media,
  mediaTitle: media,
  country: '台灣',
  countryCode: 'TW',
  title: `t${id}`,
  url: `https://example.com/${id}`,
  publishedAt,
  authors,
  bodyLength: 500,
  attributions: attributions.map((m) => ({
    media: m,
    name: m,
    country: '台灣',
    countryCode: 'TW',
    evidence: 'x',
    kind: 'explicit' as const,
  })),
});
const pair = (a: SimilarityArticle, b: SimilarityArticle, kind: SimilarityPair['kind'] = 'high'): SimilarityPair => ({
  id: `${a.id}-${b.id}`,
  a,
  b,
  score: 0.8,
  containment: 0.9,
  sharedShingles: 300,
  kind,
  evidence: 'shared',
});
const row = (id: number, media: string, publishedAt: string, authors: string[], extra: Partial<BylineRow> = {}): BylineRow => ({
  id,
  media,
  publishedAt: new Date(publishedAt),
  authors,
  creator: null,
  bodyStatus: 'ok',
  hasBody: true,
  indexed: true,
  attributions: null,
  ...extra,
});

describe('orientPair', () => {
  it('puts the journalist’s article first and measures who published later', () => {
    const own = article(1, 'setn', '2026-10-01T02:00:00Z', ['記者王小明']);
    const other = article(2, 'cna', '2026-10-01T01:30:00Z', ['中央社'], ['setn']);
    const oriented = orientPair(pair(other, own), (a) => a.id === 1, '王小明')!;
    expect(oriented.own.id).toBe(1);
    expect(oriented.minutes).toBe(-30);
    expect(oriented.relation).toBe('later');
    expect(oriented.sameAuthor).toBe(false);
    expect(oriented.otherCitesOwn).toBe(true);
    expect(oriented.ownCitesOther).toBe(false);
    expect(countSimilarity([oriented])).toMatchObject({ earlier: 0, later: 0, attributed: 1 });
  });
  it('flags the same byline at another outlet instead of calling it copying', () => {
    const own = article(1, 'udn', '2026-10-01T02:00:00Z', ['王小明']);
    const other = article(2, 'udnmoney', '2026-10-01T01:00:00Z', ['記者王小明／台北報導']);
    const oriented = orientPair(pair(own, other), (a) => a.id === 1, '王小明')!;
    expect(oriented.sameAuthor).toBe(true);
    expect(countSimilarity([oriented])).toEqual({
      pairs: 1,
      articles: 1,
      later: 0,
      earlier: 0,
      sameAuthor: 1,
      attributed: 0,
      identical: 0,
    });
  });
  it('returns null when neither side is the journalist’s', () => {
    expect(
      orientPair(pair(article(1, 'a', '2026-10-01T00:00:00Z', []), article(2, 'b', '2026-10-01T00:00:00Z', [])), () => false, 'x'),
    ).toBeNull();
  });
});

describe('summarizeJournalists', () => {
  it('groups by person, counts outlets and sample pairs, and drops desk credits', () => {
    const rows = [
      row(1, 'setn', '2026-10-01T02:00:00Z', ['記者王小明'], {
        attributions: [{ media: 'cna', name: '中央社', country: '台灣', countryCode: 'TW', evidence: 'e', kind: 'explicit' }],
      }),
      row(2, 'ebc', '2026-10-01T03:00:00Z', ['王小明、陳大文']),
      row(3, 'ltn', '2026-09-30T00:00:00Z', ['自由時報電子報']),
      row(4, 'cna', '2026-10-01T01:30:00Z', ['中央社'], { bodyStatus: 'short', hasBody: true, indexed: false }),
    ];
    const pairs = [pair(article(4, 'cna', '2026-10-01T01:30:00Z', ['中央社']), article(1, 'setn', '2026-10-01T02:00:00Z', ['記者王小明']))];
    const result = summarizeJournalists(rows, pairs, (m) => m.toUpperCase());
    expect(result.map((j) => j.name)).toEqual(['王小明', '陳大文']);
    const [wang] = result;
    expect(wang.articles).toBe(2);
    expect(wang.media).toEqual([
      { media: 'ebc', name: 'EBC', count: 1 },
      { media: 'setn', name: 'SETN', count: 1 },
    ]);
    expect(wang.cited).toBe(1);
    expect(wang.compared).toBe(2);
    expect(wang.latest).toBe('2026-10-01T03:00:00.000Z');
    expect(wang.similar).toEqual({ pairs: 1, articles: 1, later: 1, earlier: 0, sameAuthor: 0, attributed: 0, identical: 0 });
  });
});

describe('article-based similarity counts', () => {
  it('deduplicates each category while allowing one article in multiple categories', () => {
    const own = article(1, 'a', '2026-10-01T02:00:00Z', ['王小明']);
    const others = [
      article(2, 'b', '2026-10-01T01:00:00Z', []),
      article(3, 'c', '2026-10-01T01:30:00Z', []),
      article(4, 'd', '2026-10-01T03:00:00Z', []),
      article(5, 'e', '2026-10-01T04:00:00Z', ['王小明']),
      article(6, 'f', '2026-10-01T05:00:00Z', ['王小明']),
      article(7, 'g', '2026-10-01T06:00:00Z', [], ['a']),
      article(8, 'h', '2026-10-01T07:00:00Z', [], ['a']),
    ];
    const pairs = others.map((other) => orientPair(pair(own, other), (a) => a.id === 1, '王小明')!);
    expect(countSimilarity(pairs, new Set([1]))).toEqual({
      pairs: 7,
      articles: 1,
      later: 1,
      earlier: 1,
      sameAuthor: 1,
      attributed: 1,
      identical: 0,
    });
  });

  it('counts both in-period same-byline posts and excludes out-of-period counterparts regardless of orientation', () => {
    const a = article(1, 'a', '2026-10-01T02:00:00Z', ['王小明']);
    const b = article(2, 'b', '2026-10-01T03:00:00Z', ['王小明']);
    const outside = article(3, 'c', '2026-09-30T03:00:00Z', ['王小明']);
    const rows = [row(a.id, a.media, a.publishedAt, a.authors), row(b.id, b.media, b.publishedAt, b.authors)];
    for (const pairs of [
      [pair(a, b), pair(a, outside)],
      [pair(b, a), pair(outside, a)],
    ]) {
      const [summary] = summarizeJournalists(rows, pairs, (m) => m);
      expect(summary.similar).toEqual({
        pairs: 2,
        articles: 2,
        later: 0,
        earlier: 0,
        sameAuthor: 2,
        attributed: 0,
        identical: 0,
      });
      expect(summary.similar.articles).toBe(summary.articles);
      const oriented = pairs.map((p) => orientPair(p, (a) => a.id <= 2, '王小明')!);
      expect(countSimilarity(oriented, new Set([1, 2]))).toEqual(summary.similar);
    }
  });
});

describe('unmatched compared articles', () => {
  it('excludes unprocessed stories and removes both own endpoints of matches', () => {
    const a = article(1, 'a', '2026-10-01T02:00:00Z', ['王小明']);
    const b = article(2, 'b', '2026-10-01T03:00:00Z', ['王小明']);
    const oriented = orientPair(pair(a, b), () => true, '王小明')!;
    expect(countUnmatched([oriented, oriented], new Set([1, 2, 3]))).toBe(1);
    expect(countUnmatched([], new Set())).toBe(0);
    const rows = [1, 2, 3, 4].map((id) => row(id, `m${id}`, a.publishedAt, ['王小明'], { indexed: id !== 4 }));
    const [summary] = summarizeJournalists(rows, [pair(a, b)], (m) => m);
    expect(summary).toMatchObject({ articles: 4, compared: 3, unmatched: 1 });
  });
});

describe('first-seen reports', () => {
  it('subtracts the union of citations, earlier matches and unknown times, including both byline endpoints', () => {
    const date = '2026-10-01T02:00:00Z';
    const rows = Array.from({ length: 8 }, (_, i) => row(i + 1, `m${i}`, date, ['王小明']));
    rows[1].attributions = [{ media: 'cna', name: '中央社', country: '台灣', countryCode: 'TW', evidence: 'x', kind: 'explicit' }];
    rows[6].indexed = false;
    rows[7].datePending = true;
    const own = (id: number) => article(id, `m${id}`, date, ['王小明']);
    const oriented = (a: SimilarityArticle, b: SimilarityArticle) => orientPair(pair(a, b), (a) => a.id <= 8, '王小明')!;
    const pairs = [
      oriented(own(2), article(20, 'other', '2026-10-01T01:00:00Z', [])),
      oriented(own(3), article(21, 'other', '2026-10-01T01:00:00Z', ['王小明'])),
      oriented(own(4), article(22, 'other', date, [])),
      oriented(own(5), { ...own(6), publishedAt: '2026-10-01T03:00:00Z' }),
      oriented(own(6), { ...article(23, 'other', date, []), datePending: true }),
    ];
    // 1 has no match, 4 is simultaneous, 5 precedes 6. Citation+earlier on 2 is deducted once.
    expect(countFirstSeen(pairs, rows)).toBe(3);
    expect(countFirstSeen([], [])).toBe(0);
    expect(summarizeJournalists(rows, [], (m) => m)[0].firstSeen).toBe(5);
  });
});
