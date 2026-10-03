import { describe, expect, it } from 'vitest';
import type { SimilarityArticle, SimilarityPair } from '../similarity/types.ts';
import { type BylineRow, countSimilarity, orientPair, summarizeJournalists } from './aggregate.ts';

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
  });
  it('flags the same byline at another outlet instead of calling it copying', () => {
    const own = article(1, 'udn', '2026-10-01T02:00:00Z', ['王小明']);
    const other = article(2, 'udnmoney', '2026-10-01T01:00:00Z', ['記者王小明／台北報導']);
    const oriented = orientPair(pair(own, other), (a) => a.id === 1, '王小明')!;
    expect(oriented.sameAuthor).toBe(true);
    expect(countSimilarity([oriented])).toEqual({ pairs: 1, articles: 1, later: 0, earlier: 0, sameAuthor: 1, identical: 0 });
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
    expect(wang.similar).toEqual({ pairs: 1, articles: 1, later: 1, earlier: 0, sameAuthor: 0, identical: 0 });
  });
});
