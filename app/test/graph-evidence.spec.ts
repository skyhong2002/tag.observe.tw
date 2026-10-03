import { describe, expect, it } from 'vitest';
import { graphEvidence, highlightedRelationship, sameGraphSelection } from '../../web/src/lib/graph-evidence.mts';
import type { SimilarityArticle, SimilarityData, SimilarityEdge } from '../src/similarity/types.ts';

const article = (id: number, media: string, date: string): SimilarityArticle => ({
  id,
  media,
  mediaTitle: media,
  country: '台灣',
  countryCode: 'TW',
  title: `新聞 ${id}`,
  url: 'https://example.com',
  publishedAt: date,
  authors: ['記者甲'],
  bodyLength: 800,
  attributions: [],
});
const a = article(1, 'a', '2026-10-03T01:00:00Z'),
  b = article(2, 'b', '2026-10-03T02:00:00Z'),
  c = article(3, 'c', '2026-10-03T03:00:00Z');
const source = (media: string) => ({
  media,
  name: media,
  country: '台灣',
  countryCode: 'TW',
  kind: 'explicit' as const,
  evidence: '明示引用共同文字',
});
const data: Pick<SimilarityData, 'citations' | 'pairs'> = {
  citations: [
    { article: a, source: source('b') },
    { article: b, source: source('a') },
    { article: c, source: source('b') },
  ],
  pairs: [{ id: '1:2', a, b, kind: 'high', score: 0.9, containment: 0.9, sharedShingles: 300, evidence: '共同段落' }],
};
const edge: SimilarityEdge = { source: 'a', target: 'b', kind: 'citation', count: 1, score: null };

describe('inline graph evidence browser', () => {
  it('shows all evidence without a selection, newest first, without mutating the sample', () => {
    const result = graphEvidence(data, null, 'all', '', 'all');
    expect(result).toHaveLength(4);
    expect(result[0].key).toBe('citation:3:b');
    expect(data.citations[0].article.id).toBe(1);
    expect(graphEvidence(data, null, 'similarity', '', 'all').map((item) => item.kind)).toEqual(['similarity']);
  });
  it('filters a selected outlet by citation direction while preserving its similarity evidence', () => {
    const all = graphEvidence(data, { node: 'a' }, 'all', '', 'all');
    expect(all).toHaveLength(3);
    expect(graphEvidence(data, { node: 'a' }, 'citation', '', 'outgoing').map((item) => item.key)).toEqual(['citation:1:b']);
    expect(graphEvidence(data, { node: 'a' }, 'citation', '', 'incoming').map((item) => item.key)).toEqual(['citation:2:a']);
    expect(graphEvidence(data, { node: 'a' }, 'all', '', 'outgoing')).toHaveLength(2);
    expect(graphEvidence(data, { node: 'isolated' }, 'all', '', 'all')).toEqual([]);
  });
  it('preserves citation direction and separates edge kinds for the same two outlets', () => {
    expect(graphEvidence(data, { edge }, 'all', '', 'all').map((item) => item.key)).toEqual(['citation:1:b']);
    expect(graphEvidence(data, { edge }, 'similarity', '', 'all')).toEqual([]);
    expect(
      graphEvidence(data, { edge: { ...edge, source: 'b', target: 'a', kind: 'similarity' } }, 'all', '', 'all').map((item) => item.key),
    ).toEqual(['similarity:1:2']);
  });
  it('searches titles, authors, media and evidence together and returns empty results safely', () => {
    expect(graphEvidence(data, null, 'all', '新聞 3 記者甲 B', 'all').map((item) => item.key)).toEqual(['citation:3:b']);
    expect(graphEvidence(data, null, 'all', '共同段落', 'all').map((item) => item.kind)).toEqual(['similarity']);
    expect(graphEvidence(data, null, 'all', '找不到', 'all')).toEqual([]);
    expect(graphEvidence({ citations: [], pairs: [] }, null, 'all', '', 'all')).toEqual([]);
  });
});

describe('pinned graph relationships', () => {
  it('highlights all incident links in either direction and excludes unrelated ones', () => {
    expect(highlightedRelationship(edge, { node: 'a' })).toBe(true);
    expect(highlightedRelationship(edge, { node: 'b' })).toBe(true);
    expect(highlightedRelationship({ ...edge, kind: 'similarity' }, { node: 'a' })).toBe(true);
    expect(highlightedRelationship(edge, { node: 'c' })).toBe(false);
    expect(highlightedRelationship(edge, null)).toBe(false);
  });
  it('pins exactly the selected directed edge and recognizes repeated selection by identity', () => {
    expect(sameGraphSelection({ edge }, { edge: { ...edge, count: 9 } })).toBe(true);
    expect(highlightedRelationship({ ...edge, source: 'b', target: 'a' }, { edge })).toBe(false);
    expect(highlightedRelationship({ ...edge, kind: 'similarity' }, { edge })).toBe(false);
    expect(sameGraphSelection({ node: 'a' }, { node: 'a' })).toBe(true);
    expect(sameGraphSelection({ node: 'a' }, { edge })).toBe(false);
    expect(sameGraphSelection(null, { node: 'a' })).toBe(false);
  });
});
