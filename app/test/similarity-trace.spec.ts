import { describe, expect, it } from 'vitest';
import { buildSimilarityTraceIndex, chronologySummary, pairChronology, traceEarlierArticles } from '../../web/src/lib/similarity-trace.mts';
import type { SimilarityArticle, SimilarityPair } from '../src/similarity/types.ts';

const article = (id: number, publishedAt: string): SimilarityArticle => ({
  id,
  publishedAt,
  media: `m${id}`,
  mediaTitle: `媒體 ${id}`,
  country: '台灣',
  countryCode: 'TW',
  title: `文章 ${id}`,
  url: `https://example.com/${id}`,
  authors: [],
  attributions: [],
  bodyLength: 500,
});
const a = article(1, '2026-10-04T01:00:00Z'),
  b = article(2, '2026-10-04T02:00:00Z'),
  c = article(3, '2026-10-04T03:00:00Z');
const pair = (a: SimilarityArticle, b: SimilarityArticle, score = 0.9): SimilarityPair => ({
  id: `${a.id}:${b.id}`,
  a,
  b,
  score,
  kind: 'high',
  containment: score,
  sharedShingles: 200,
  evidence: '共同段落',
});

describe('earlier similar reporting, without inferring plagiarism', () => {
  it('uses actual timestamps, not pair order, identifiers, or timezone string order', () => {
    const local = { ...a, publishedAt: '2026-10-04T09:00:00+08:00' };
    expect(pairChronology(pair(b, local))).toMatchObject({ status: 'ordered', earlier: { id: 1 }, later: { id: 2 }, gap: 3600_000 });
    expect(chronologySummary(pair(b, local))).toContain('媒體 1 → 媒體 2');
    expect(chronologySummary(pair(b, local))).toContain('非引用方向');
  });
  it('does not orient equal or unknown times even when text is identical', () => {
    const same = pair(a, { ...b, publishedAt: a.publishedAt });
    const unknown = pair(a, { ...b, publishedAt: '' });
    expect(pairChronology(same).status).toBe('same');
    expect(pairChronology(unknown).status).toBe('unknown');
    expect(buildSimilarityTraceIndex([same, unknown]).size).toBe(0);
  });
  it('traces backwards through real pairs and retains each step, excluding later detours and unrelated roots', () => {
    const later = article(4, '2026-10-04T04:00:00Z');
    const unconnected = article(5, '2026-10-04T00:00:00Z');
    const index = buildSimilarityTraceIndex([pair(a, b), pair(b, c), pair(c, later), pair(unconnected, later)]);
    const result = traceEarlierArticles(c, index);
    expect(result.map((item) => item.article.id)).toEqual([1, 2]);
    expect(result[0].steps.map((step) => step.pair.id)).toEqual(['2:3', '1:2']);
    expect(traceEarlierArticles(a, index)).toEqual([]);
  });
  it('deduplicates routes, prefers a direct measured pair, and preserves earliest ties', () => {
    const twin = article(4, a.publishedAt);
    const index = buildSimilarityTraceIndex([pair(a, b), pair(b, c), pair(a, c, 0.85), pair(twin, c)]);
    const result = traceEarlierArticles(c, index);
    expect(result.map((item) => item.article.id)).toEqual([1, 4, 2]);
    expect(result[0].steps).toHaveLength(1);
    expect(result[0].steps[0].pair.score).toBe(0.85);
  });
});
