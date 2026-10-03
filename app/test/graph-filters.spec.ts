import { describe, expect, it } from 'vitest';
import { availableGraphTags, filterGraphMedia, type GraphFilters, graphEvidenceScope } from '../../web/src/lib/graph-filters.mts';
import { createGraphTooltip } from '../../web/src/lib/graph-tooltip.mts';
import { mediaGraphPositions } from '../../web/src/lib/media-graph.mts';
import { withStoryOrigins } from '../../web/src/lib/story-origins.mts';
import type { SimilarityData, SimilarityNode } from '../src/similarity/types.ts';

const node = (id: string, articles: number): SimilarityNode => ({
  id,
  articles,
  name: id,
  country: '台灣',
  countryCode: 'TW',
  external: false,
});
const nodes = [node('large', 1000), node('blue', 100), node('green', 500), node('small', 1), node('isolated', 9999)];
const edges: SimilarityData['edges'] = [
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

const article = (id: number, media: string) => ({
  id,
  media,
  mediaTitle: media,
  country: '台灣',
  countryCode: 'TW',
  title: '<script>新聞</script>',
  url: 'https://example.com',
  publishedAt: '2026-10-04T00:00:00Z',
  authors: [],
  bodyLength: 500,
  attributions: [],
});
const a = article(1, 'large'),
  b = article(2, 'green');
const data: SimilarityData = {
  nodes,
  edges,
  hours: 48,
  threshold: 0.65,
  generatedAt: '2026-10-04T00:00:00Z',
  method: 'test',
  coverage: [],
  sample: { analyzed: 2, available: 2, limit: 10000, truncated: false, pairLimit: 2000, pairsTruncated: false, from: null },
  pairs: [{ id: '1:2', a, b, score: 0.95, containment: 1, sharedShingles: 300, kind: 'high', evidence: '共同段落' }],
  citations: [
    { article: a, source: { media: 'blue', name: 'blue', country: '台灣', countryCode: 'TW', kind: 'explicit', evidence: '引用 blue' } },
  ],
};

describe('filtered evidence and hover summaries', () => {
  it('scopes both ends of evidence to the graph without mutating the original sample', () => {
    const scope = graphEvidenceScope(data, filter({ limit: 2 }).nodes);
    expect(scope.pairs).toHaveLength(1);
    expect(scope.citations).toEqual([]);
    expect(scope.edges).toEqual([edges[1]]);
    expect(data.citations).toHaveLength(1);
  });
  it('keeps cross-category evidence while excluding relationships between context outlets', () => {
    const related = { article: b, source: data.citations[0].source };
    const view = withStoryOrigins({ ...data, citations: [...data.citations, related] });
    const scope = graphEvidenceScope(view, nodes, new Set(['green']));
    expect(scope.citations).toEqual([related]);
    expect(scope.pairs).toEqual(data.pairs);
    expect(scope.origins).toHaveLength(1);
    expect(scope.edges).not.toContainEqual(edges[0]);
    const unrelatedOrigins = graphEvidenceScope(view, nodes, new Set(['blue']));
    expect(unrelatedOrigins.origins).toEqual([]);
    expect(unrelatedOrigins.pairs).toEqual([]);
    expect(view.citations).toHaveLength(2);
  });
  it('shows citation direction, relationship volume and escaped article titles', () => {
    const view = withStoryOrigins(data);
    const tooltip = createGraphTooltip(view, nodes, camps);
    const citation = tooltip({ edge: edges[0] }, edges);
    expect(citation).toContain('large → blue');
    expect(citation).toContain('2 篇文章明示引用');
    expect(citation).toContain('&lt;script&gt;新聞&lt;/script&gt;');
    expect(citation).not.toContain('<script>');
    const similar = tooltip({ edge: view.edges.find((edge) => edge.kind === 'similarity')! }, view.edges);
    expect(similar).toContain('green → large');
    expect(similar).toContain('95.0%');
  });
  it('shows scoped counts for media and explains an outlet with no remaining links', () => {
    const view = withStoryOrigins(data);
    const tooltip = createGraphTooltip(view, nodes, camps);
    expect(tooltip({ node: 'large' }, edges)).toContain('引用 1 篇');
    expect(tooltip({ node: 'large' }, edges)).toContain('同組報導 1 篇');
    expect(tooltip({ node: 'green' }, edges)).toContain('綠營傾向');
    const isolated = createGraphTooltip(data, filter({ camp: 'blue' }).nodes, camps)({ node: 'blue' }, []);
    expect(isolated).toContain('目前篩選與關係模式下沒有連線');
    expect(isolated).toContain('被引用 0 篇');
    expect(tooltip({ node: 'unknown' }, [])).toBe('');
  });
});
