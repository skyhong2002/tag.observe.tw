import { describe, expect, it } from 'vitest';
import {
  connectedMedia,
  displayedGraphEdges,
  edgeWeightWidth,
  forcePositions,
  mainGraphEdges,
  mediaCommunities,
  mediaGraphPositions,
  mediaIconSizes,
  mediaLabelColor,
  mediaViewportLimit,
  nodeArticleCounts,
  selectGraphMedia,
} from '../../web/src/lib/media-graph.mts';
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

describe('responsive media selection', () => {
  const nodes = [
    { ...node('large'), articles: 100 },
    { ...node('small'), articles: 10 },
    { ...node('agency'), articles: 0, external: true },
    node('partner'),
    node('isolated'),
  ];
  const edges: SimilarityData['edges'] = [
    { source: 'large', target: 'agency', kind: 'citation', count: 20, score: null },
    { source: 'small', target: 'partner', kind: 'similarity', count: 2, score: 0.8 },
    { source: 'missing', target: 'isolated', kind: 'citation', count: 100, score: null },
  ];
  it('reserves more room per medium on small or short canvases', () => {
    const phone = mediaViewportLimit(356, 381);
    const laptop = mediaViewportLimit(1406, 607);
    const wide = mediaViewportLimit(2526, 1100);
    expect(phone).toBeLessThan(laptop);
    expect(laptop).toBeLessThan(wide);
    expect(mediaViewportLimit(1406, 350)).toBeLessThan(laptop);
  });
  it('keeps strong citation-only partners and never creates dangling links or isolated nodes', () => {
    const graph = selectGraphMedia(nodes, edges, 2);
    expect(graph.nodes.map((node) => node.id)).toEqual(['large', 'agency']);
    expect(graph.edges).toEqual([edges[0]]);
    for (const budget of [0, 1, 2, 3, 4, 99]) {
      const selected = selectGraphMedia(nodes, edges, budget);
      expect(selected.nodes.length).toBeLessThanOrEqual(budget);
      expect(connectedMedia(selected.nodes, selected.edges)).toEqual(selected.nodes);
      expect(selected.nodes.some((node) => node.id === 'isolated')).toBe(false);
    }
    expect(selectGraphMedia(nodes, edges, 99).nodes).toHaveLength(4);
    expect(
      selectGraphMedia([...nodes].reverse(), [...edges].reverse(), 2)
        .nodes.map((node) => node.id)
        .sort(),
    ).toEqual(graph.nodes.map((node) => node.id).sort());
  });
  it('colors only explicitly classified labels and supports both themes', () => {
    expect(mediaLabelColor('blue', false)).toBe('#1d4ed8');
    expect(mediaLabelColor('green', false)).toBe('#15803d');
    expect(mediaLabelColor(undefined, false)).toBe('#52525b');
    expect(mediaLabelColor('blue', true)).toBe('#60a5fa');
    expect(mediaLabelColor('green', true)).toBe('#4ade80');
  });
});

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

describe('media icon volume', () => {
  it('encodes article volume with increasing bounded areas on desktop and mobile', () => {
    const nodes = [0, 1, 10, 100, 1000].map((n) => ({ ...node(String(n)), articles: n }));
    for (const width of [356, 1118]) {
      const sizes = [...mediaIconSizes(nodes, width).values()];
      expect(sizes.every((size, i) => i === 0 || size > sizes[i - 1])).toBe(true);
      expect(sizes[0]).toBe(width < 600 ? 16 : 20);
      expect(sizes.at(-1)).toBe(width < 600 ? 28 : 46);
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

describe('readable relationship overview', () => {
  const edge = (source: string, target: string, count: number) => ({ source, target, count, kind: 'citation' as const, score: null });
  const nodes = ['a', 'b', 'c', 'd', 'e', 'isolated'].map(node);
  const edges = [
    edge('a', 'b', 10),
    edge('a', 'c', 9),
    edge('b', 'c', 8),
    edge('b', 'd', 7),
    edge('c', 'd', 6),
    edge('d', 'e', 5),
    edge('a', 'e', 1),
  ];
  it('hides genuinely unconnected media while retaining endpoints of weak links', () => {
    expect(connectedMedia(nodes, edges).map((n) => n.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(connectedMedia(nodes, [edge('a', 'unknown', 2)])).toEqual([]);
    expect(connectedMedia(nodes, [])).toEqual([]);
  });
  it('thins the overview without mutating evidence, and expands every incident link on hover', () => {
    const dense = ['a', 'b', 'c', 'd', 'e'].flatMap((a, i, ids) => ids.slice(i + 1).map((b, j) => edge(a, b, 20 - i - j)));
    const overview = mainGraphEdges(dense);
    expect(overview.length).toBeLessThan(dense.length);
    expect(connectedMedia(nodes, overview).map((n) => n.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(displayedGraphEdges(dense, overview, true, null)).toEqual(dense);
    const hidden = dense.find((e) => !overview.includes(e))!;
    const focused = displayedGraphEdges(dense, overview, false, hidden.source);
    expect(focused).toContain(hidden);
    expect(focused.filter((e) => e.source === hidden.source || e.target === hidden.source)).toEqual(
      dense.filter((e) => e.source === hidden.source || e.target === hidden.source),
    );
    expect(displayedGraphEdges(dense, overview, false, null)).toEqual(overview);
    expect(dense).toHaveLength(10);
    expect(
      mainGraphEdges([...dense].reverse())
        .map((e) => `${e.source}:${e.target}`)
        .sort(),
    ).toEqual(overview.map((e) => `${e.source}:${e.target}`).sort());
  });
  it('preserves relative geometry across screen sizes and input order', () => {
    const desktop = mediaGraphPositions(nodes, edges, 1100, 650);
    const phone = mediaGraphPositions([...nodes].reverse(), [...edges].reverse(), 356, 450);
    const byId = new Map(phone.map((p) => [p.id, p]));
    const origin = desktop[0],
      mobileOrigin = byId.get(origin.id)!;
    const scale =
      Math.hypot(phone[0].x - mobileOrigin.x, phone[0].y - mobileOrigin.y) /
      Math.hypot(desktop.find((p) => p.id === phone[0].id)!.x - origin.x, desktop.find((p) => p.id === phone[0].id)!.y - origin.y);
    for (const p of desktop) {
      expect(byId.get(p.id)!.x - mobileOrigin.x).toBeCloseTo((p.x - origin.x) * scale);
      expect(byId.get(p.id)!.y - mobileOrigin.y).toBeCloseTo((p.y - origin.y) * scale);
    }
  });
  it('separates strongly related communities joined by a weak bridge', () => {
    const groupedNodes = ['a', 'b', 'c', 'd', 'e', 'f'].map(node);
    const groupedEdges = [
      edge('a', 'b', 20),
      edge('a', 'c', 20),
      edge('b', 'c', 20),
      edge('d', 'e', 20),
      edge('d', 'f', 20),
      edge('e', 'f', 20),
      edge('c', 'd', 1),
    ];
    const labels = mediaCommunities(groupedNodes, groupedEdges);
    expect(labels.get('a')).toBe(labels.get('c'));
    expect(labels.get('d')).toBe(labels.get('f'));
    expect(labels.get('a')).not.toBe(labels.get('d'));
    expect(mediaCommunities([...groupedNodes].reverse(), [...groupedEdges].reverse())).toEqual(labels);
    for (const [width, height] of [
      [356, 450],
      [1100, 650],
    ]) {
      const positions = mediaGraphPositions([...groupedNodes, node('isolated')], groupedEdges, width, height);
      expect(positions).toHaveLength(6);
      expect(positions.every((p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)).toBe(true);
      expect(positions).toEqual(mediaGraphPositions(groupedNodes, groupedEdges, width, height));
      const first = positions.filter((p) => ['a', 'b', 'c'].includes(p.id)),
        second = positions.filter((p) => ['d', 'e', 'f'].includes(p.id));
      expect(
        Math.max(...first.map((p) => p.x)) < Math.min(...second.map((p) => p.x)) ||
          Math.max(...first.map((p) => p.y)) < Math.min(...second.map((p) => p.y)),
      ).toBe(true);
    }
    expect(mediaGraphPositions(nodes, [], 356, 450)).toEqual([]);
  });
});
