import { describe, expect, it } from 'vitest';
import { availableGraphTags, filterGraphMedia, type GraphFilters, graphEvidenceScope } from '../../web/src/lib/graph-filters.mts';
import { createGraphTooltip } from '../../web/src/lib/graph-tooltip.mts';
import { mediaGraphPositions } from '../../web/src/lib/media-graph.mts';
import type { SimilarityEdge, SimilarityNode } from '../src/similarity/types.ts';

const node = (id: string, articles: number, counts: Partial<SimilarityNode> = {}): SimilarityNode => ({
  id,
  articles,
  name: id,
  country: '台灣',
  countryCode: 'TW',
  external: false,
  similar: 0,
  earliest: 0,
  later: 0,
  outgoing: 0,
  incoming: 0,
  ...counts,
});
const nodes = [
  node('large', 1000, { similar: 1, earliest: 1, outgoing: 3 }),
  node('blue', 100, { incoming: 2 }),
  node('green', 500, { similar: 1, later: 1, incoming: 1 }),
  node('small', 1, { outgoing: 1 }),
  node('isolated', 9999),
];
const edges: SimilarityEdge[] = [
  { source: 'large', target: 'blue', kind: 'citation', count: 2, score: null },
  { source: 'large', target: 'green', kind: 'similarity', count: 1, score: 0.95 },
  { source: 'small', target: 'green', kind: 'citation', count: 1, score: null },
];
const camps = { blue: 'blue', green: 'green', small: 'green' } as const;
const tags = [
  { id: 'news', label: '新聞', media: ['large', 'blue', 'small'] },
  { id: 'finance', label: '財經', media: ['green'] },
];
const defaults: GraphFilters = { limit: 30, camp: 'all', tag: '' };
const filter = (options: Partial<GraphFilters>) => filterGraphMedia(nodes, edges, camps, tags, { ...defaults, ...options });

describe('graph media filters', () => {
  it('ranks sampled article counts and keeps only links between retained outlets', () => {
    const result = filter({ limit: 2 });
    expect(result.nodes.map((n) => n.id)).toEqual(['large', 'green']);
    expect(result.available).toBe(4);
    expect(result.edges).toEqual([edges[1]]);
    expect(filter({ limit: 0 }).nodes).toHaveLength(4);
    expect(filterGraphMedia([...nodes].reverse(), [...edges].reverse(), camps, tags, { ...defaults, limit: 2 }).nodes).toEqual(
      result.nodes,
    );
  });
  it('applies camp and tag before the limit and does not introduce neighbours from other camps', () => {
    expect(filter({ camp: 'green', limit: 1 }).nodes.map((n) => n.id)).toEqual(['green']);
    expect(filter({ camp: 'green', tag: 'news', limit: 1 }).nodes.map((n) => n.id)).toEqual(['small', 'green']);
    expect(filter({ camp: 'blue' }).edges).toEqual([]);
    expect(filter({ camp: 'other' }).nodes.map((n) => n.id)).toEqual(['large']);
    expect(filter({ tag: 'missing' }).nodes).toEqual([]);
    expect(filter({ camp: 'blue', tag: 'finance' }).nodes).toEqual([]);
  });
  it('lays out retained outlets even when filtering removes all their neighbours', () => {
    const result = filter({ camp: 'blue' });
    expect(mediaGraphPositions(result.nodes, result.edges, 900, 600, true)).toEqual([{ id: 'blue', x: 450, y: 300 }]);
    const islands = mediaGraphPositions(nodes.slice(0, 4), [], 900, 600, true);
    expect(islands).toHaveLength(4);
    expect(islands.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(mediaGraphPositions([], [], 900, 600, true)).toEqual([]);
  });
  it('keeps tags with cross-category relationships and hides tags without data', () => {
    const categories = [...tags, { id: 'empty', label: '空分類', media: [] }, { id: 'isolated', label: '無連線', media: ['isolated'] }];
    expect(availableGraphTags(nodes, edges, camps, categories, defaults)).toEqual(tags);
    expect(availableGraphTags(nodes, [], camps, categories, defaults)).toEqual([]);
  });
  it('checks camp, media limit and relationship mode before offering a tag', () => {
    const categories = [...tags, { id: 'green-pair', label: '綠營配對', media: ['green', 'small'] }];
    const available = (options: Partial<GraphFilters>, mode: 'all' | 'similarity' | 'citation' = 'all') =>
      availableGraphTags(nodes, edges, camps, categories, { ...defaults, ...options }, mode).map((tag) => tag.id);
    expect(available({ camp: 'green' })).toEqual(['news', 'finance', 'green-pair']);
    expect(available({ camp: 'blue' })).toEqual([]);
    expect(available({ limit: 1 })).toEqual(['news', 'finance', 'green-pair']);
    expect(available({}, 'similarity')).toEqual(['news', 'finance', 'green-pair']);
    expect(available({}, 'citation')).toEqual(['news', 'finance', 'green-pair']);
    expect(available({ camp: 'green' }, 'similarity')).toEqual([]);
    expect(available({ tag: 'finance' })).toEqual(['news', 'finance', 'green-pair']);
  });
  it('adds direct partners after limiting category outlets and excludes unrelated partner relationships', () => {
    const result = filter({ tag: 'finance', limit: 1 });
    expect(result.nodes.map((n) => n.id)).toEqual(['green', 'large', 'small']);
    expect(result.focus).toEqual(new Set(['green']));
    expect(result.edges).toEqual([edges[1], edges[2]]);
    expect(result.nodes.some((n) => n.id === 'blue')).toBe(false);
    const partnerEdge = { source: 'large', target: 'small', kind: 'citation', count: 1, score: null } as const;
    const expanded = filterGraphMedia(nodes, [...edges, partnerEdge], camps, tags, { ...defaults, tag: 'finance', limit: 1 });
    expect(expanded.edges).not.toContainEqual(partnerEdge);
    expect(expanded.nodes).toEqual(result.nodes);
  });
});

// Similarity edges arrive from the index already pointing at the group's earliest outlet.
const storyEdge: SimilarityEdge = { source: 'green', target: 'large', kind: 'similarity', count: 1, score: 0.95 };

describe('filtered relationships and hover summaries', () => {
  it('scopes both ends of relationships to the graph without mutating the original data', () => {
    const data = { edges, threshold: 0.65 };
    const scope = graphEvidenceScope(data, filter({ limit: 2 }).nodes);
    expect(scope.nodes.map((n) => n.id)).toEqual(['large', 'green']);
    expect(scope.edges).toEqual([edges[1]]);
    expect(scope.threshold).toBe(0.65);
    expect(data.edges).toHaveLength(3);
  });
  it('keeps cross-category relationships while excluding relationships between context outlets', () => {
    expect(graphEvidenceScope({ edges }, nodes, new Set(['green'])).edges).toEqual([edges[1], edges[2]]);
    expect(graphEvidenceScope({ edges }, nodes, new Set(['blue'])).edges).toEqual([edges[0]]);
    expect(graphEvidenceScope({ edges }, nodes, new Set(['isolated'])).edges).toEqual([]);
  });
  it('shows citation direction, relationship volume and escaped outlet names', () => {
    const tooltip = createGraphTooltip([...nodes, node('<b>x</b>', 1)], camps);
    const citation = tooltip({ edge: edges[0] }, edges);
    expect(citation).toContain('blue → large');
    expect(citation).toContain('2 篇文章來源／引用');
    const similar = tooltip({ edge: storyEdge }, [storyEdge]);
    expect(similar).toContain('large → green');
    expect(similar).toContain('95.0%');
    expect(tooltip({ edge: { ...storyEdge, score: null } }, [])).toContain('經同組配對歸源');
    const escaped = tooltip({ node: '<b>x</b>' }, []);
    expect(escaped).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(escaped).not.toContain('<b>x</b>');
  });
  it('shows period-wide counts for media and explains an outlet with no remaining links', () => {
    const tooltip = createGraphTooltip(nodes, camps);
    expect(tooltip({ node: 'large' }, edges)).toContain('引用 3 篇');
    expect(tooltip({ node: 'large' }, edges)).toContain('同組最早 1 篇 · 同組較晚 0 篇');
    expect(tooltip({ node: 'green' }, edges)).toContain('綠營傾向');
    const isolated = createGraphTooltip(filter({ camp: 'blue' }).nodes, camps)({ node: 'blue' }, []);
    expect(isolated).toContain('目前篩選與關係模式下沒有連線');
    expect(isolated).toContain('被採用／引用 2 篇');
    expect(tooltip({ node: 'unknown' }, [])).toBe('');
  });
});
