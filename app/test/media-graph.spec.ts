import { describe, expect, it } from 'vitest';
import { edgeWeightWidth, forcePositions, mediaGraphPositions, mediaIconSizes, nodeArticleCounts } from '../../web/src/lib/media-graph.mts';
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

describe('edge weights', () => {
  it('keeps count differences visible over a wide range and uses the same scale across modes', () => {
    const widths = [1, 2, 10, 100, 1000].map((count) => edgeWeightWidth(count, 1000));
    expect(widths[0]).toBe(1);
    expect(widths.at(-1)).toBe(8);
    expect(widths.every((width, i) => i === 0 || width > widths[i - 1])).toBe(true);
    expect(edgeWeightWidth(0, 0)).toBe(1);
    expect(edgeWeightWidth(Number.NaN, Number.NaN)).toBe(1);
  });
});

describe('isolated outlets on the perimeter', () => {
  const edge = { source: 'a', target: 'b', kind: 'citation' as const, count: 2, score: null };
  it('keeps every outlet visible and separates unconnected outlets from the force layout', () => {
    const nodes = [node('reporter'), node('a'), node('b'), node('isolated')];
    for (const [width, height] of [
      [356, 455],
      [1118, 607],
    ]) {
      const points = mediaGraphPositions(nodes, [edge], width, height);
      expect(points.map((p) => p.id)).toEqual(nodes.map((n) => n.id));
      for (const point of points.filter((p) => ['reporter', 'isolated'].includes(p.id))) {
        expect(Math.max(Math.abs(point.x) / width, Math.abs(point.y) / height)).toBeCloseTo(0.45);
      }
      for (const point of points.filter((p) => ['a', 'b'].includes(p.id))) {
        expect(Math.abs(point.x)).toBeLessThan(width * 0.4);
        expect(Math.abs(point.y)).toBeLessThan(height * 0.4);
      }
      const added = mediaGraphPositions([...nodes, node('extra')], [edge], width, height);
      expect(added.filter((p) => ['a', 'b'].includes(p.id))).toEqual(points.filter((p) => ['a', 'b'].includes(p.id)));
    }
  });
  it('moves outlets to the outside when a relationship mode hides their edges, without inventing links', () => {
    const nodes = [node('a'), node('b'), node('reporter')];
    const points = mediaGraphPositions(nodes, [], 400, 500);
    expect(points).toHaveLength(nodes.length);
    expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(mediaGraphPositions([], [], 400, 500)).toEqual([]);
    expect(mediaGraphPositions([node('reporter')], [], 400, 500)).toHaveLength(1);
    expect(mediaGraphPositions(nodes, [{ ...edge, target: 'missing' }], 400, 500)).toEqual(points);
  });
});

describe('media icon volume', () => {
  it('encodes article volume with increasing bounded areas on desktop and mobile', () => {
    const nodes = [0, 1, 10, 100, 1000].map((n) => ({ ...node(String(n)), articles: n }));
    for (const width of [356, 1118]) {
      const sizes = [...mediaIconSizes(nodes, width).values()];
      expect(sizes.every((size, i) => i === 0 || size > sizes[i - 1])).toBe(true);
      expect(sizes[0]).toBe(width < 600 ? 16 : 20);
      expect(sizes.at(-1)).toBe(width < 600 ? 34 : 64);
      const area = (i: number) => sizes[i] ** 2 - sizes[0] ** 2;
      expect(area(3) / area(2)).toBeCloseTo(10);
    }
  });
  it('does not use citation-only outlets as a proxy for their uncollected article volume', () => {
    const nodes = [node('small'), { ...node('large'), articles: 100 }, { ...node('reuters'), external: true, articles: 0 }];
    const sizes = mediaIconSizes(nodes, 1118);
    expect(sizes.get('reuters')).toBe(24);
    expect(mediaIconSizes(nodes, 356).get('reuters')).toBe(18);
    expect(
      mediaIconSizes(
        nodes.map((n) => (n.external ? { ...n, articles: 100000 } : n)),
        1118,
      ),
    ).toEqual(sizes);
    expect(mediaIconSizes([], 356).size).toBe(0);
    expect(mediaIconSizes([{ ...node('bad'), articles: Number.NaN }], 1118).get('bad')).toBe(20);
  });
});
