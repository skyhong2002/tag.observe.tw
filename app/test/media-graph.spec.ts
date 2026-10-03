import { describe, expect, it } from 'vitest';
import { forcePositions, nodeArticleCounts } from '../../web/src/lib/media-graph.mts';
import type { SimilarityArticle, SimilarityData, SimilarityNode } from '../src/similarity/types.ts';

const article = (id: number, media: string): SimilarityArticle => ({
  id,
  media,
  mediaTitle: media,
  country: '台灣',
  countryCode: 'TW',
  title: '新聞',
  url: 'https://example.com',
  publishedAt: '2026-10-03T00:00:00Z',
  authors: [],
  bodyLength: 500,
  attributions: [],
});
const source = (media: string) => ({ media, name: media, country: '台灣', countryCode: 'TW', kind: 'explicit' as const, evidence: '引用' });
const pair = (a: SimilarityArticle, b: SimilarityArticle): SimilarityData['pairs'][number] => ({
  id: `${a.id}:${b.id}`,
  a,
  b,
  score: 0.9,
  containment: 0.9,
  sharedShingles: 200,
  kind: 'high',
  evidence: '內文',
});
const node = (id: string): SimilarityNode => ({ id, name: id, country: '台灣', countryCode: 'TW', articles: 1, external: false });

describe('media dashboard article counts', () => {
  it('counts distinct articles rather than citations or similar pairs, preserving direction', () => {
    const a = article(1, 'a'),
      b = article(2, 'b'),
      c = article(3, 'c');
    const counts = nodeArticleCounts({
      citations: [
        { article: a, source: source('b') },
        { article: a, source: source('c') },
        { article: a, source: source('b') },
        { article: c, source: source('b') },
      ],
      pairs: [pair(a, b), pair(a, c)],
    });
    expect(counts.get('a')).toEqual({ outgoing: 1, incoming: 0, similar: 1 });
    expect(counts.get('b')).toEqual({ outgoing: 0, incoming: 2, similar: 1 });
    expect(counts.get('c')).toEqual({ outgoing: 1, incoming: 1, similar: 1 });
  });
  it('handles a sample without relationships', () => {
    expect(nodeArticleCounts({ citations: [], pairs: [] }).size).toBe(0);
  });
});

describe('settled force layout', () => {
  it('keeps positions stable and finite for connected and isolated outlets on mobile and desktop', () => {
    const nodes = Array.from({ length: 40 }, (_, i) => node(String(i)));
    const edges = [
      { source: '0', target: '1', kind: 'citation' as const, count: 10, score: null },
      { source: 'missing', target: '0', kind: 'citation' as const, count: 1, score: null },
    ];
    for (const [width, height] of [
      [350, 480],
      [1100, 650],
    ]) {
      const positions = forcePositions(nodes, edges, width, height);
      expect(positions).toEqual(forcePositions(nodes, edges, width, height));
      expect(positions.map((p) => p.id)).toEqual(nodes.map((n) => n.id));
      expect(positions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
      expect(new Set(positions.map((p) => `${p.x}:${p.y}`)).size).toBe(nodes.length);
    }
  });
  it('handles empty and single outlet graphs', () => {
    expect(forcePositions([], [], 350, 480)).toEqual([]);
    expect(forcePositions([node('a')], [], 350, 480)).toHaveLength(1);
  });
});
