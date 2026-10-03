import { describe, expect, it } from 'vitest';
import { graphEvidence } from '../../web/src/lib/graph-evidence.mts';
import { filterGraphMedia, graphEvidenceScope } from '../../web/src/lib/graph-filters.mts';
import { createGraphTooltip } from '../../web/src/lib/graph-tooltip.mts';
import { nodeArticleCounts } from '../../web/src/lib/media-graph.mts';
import { groupStoryOrigins, withStoryOrigins } from '../../web/src/lib/story-origins.mts';
import type { SimilarityArticle, SimilarityData, SimilarityPair } from '../src/similarity/types.ts';

const article = (id: number, media: string, time: string): SimilarityArticle => ({
  id,
  media,
  mediaTitle: media,
  title: `報導 ${id}`,
  publishedAt: time,
  url: `https://example.com/${id}`,
  country: '台灣',
  countryCode: 'TW',
  bodyLength: 800,
  authors: [],
  attributions: [],
});
const a = article(1, 'A', '2026-10-04T01:00:00Z'),
  b = article(2, 'B', '2026-10-04T02:00:00Z'),
  c = article(3, 'C', '2026-10-04T03:00:00Z');
const pair = (a: SimilarityArticle, b: SimilarityArticle, score = 0.9): SimilarityPair => ({
  id: `${a.id}:${b.id}`,
  a,
  b,
  score,
  containment: score,
  sharedShingles: 200,
  kind: 'high',
  evidence: `共同段落 ${a.id}:${b.id}`,
});
const sample = (pairs: SimilarityPair[]): SimilarityData => ({
  nodes: [a, b, c].map((n) => ({ id: n.media, name: n.media, country: '台灣', countryCode: 'TW', articles: 10, external: false })),
  pairs,
  edges: [{ source: 'B', target: 'A', kind: 'citation', count: 1, score: null }],
  citations: [
    { article: b, source: { media: 'A', name: 'A', country: '台灣', countryCode: 'TW', kind: 'explicit', evidence: '據 A 報導' } },
  ],
  threshold: 0.65,
  hours: 48,
  generatedAt: c.publishedAt,
  method: 'test',
  coverage: [],
  sample: { analyzed: 3, available: 3, limit: 10000, truncated: false, pairLimit: 2000, pairsTruncated: false, from: null },
});

describe('single earliest source per similar story', () => {
  it('turns A–B–C into B→A and C→A, not a chronological chain or complete mesh', () => {
    const raw = sample([pair(a, b), pair(b, c)]),
      view = withStoryOrigins(raw);
    expect(view.groups).toHaveLength(1);
    expect(view.origins.map((o) => [o.article.id, o.source.id])).toEqual([
      [2, 1],
      [3, 1],
    ]);
    expect(view.edges.filter((e) => e.kind === 'similarity').map((e) => [e.source, e.target, e.count, e.score])).toEqual([
      ['B', 'A', 1, 0.9],
      ['C', 'A', 1, null],
    ]);
    expect(view.edges.filter((e) => e.kind === 'citation')).toEqual(raw.edges);
    expect(view.origins[1].directPair).toBeNull();
    expect(raw.edges).toHaveLength(1);
  });
  it('chooses earliest globally even if a connecting article was published later, using timestamps across timezones', () => {
    const first = { ...c, publishedAt: '2026-10-04T08:00:00+08:00' };
    const pairs = [pair(b, a), pair(b, first)];
    const result = groupStoryOrigins(pairs, 0.65);
    expect(result.origins.map((o) => [o.article.id, o.source.id])).toEqual([
      [1, 3],
      [2, 3],
    ]);
    expect(groupStoryOrigins([...pairs].reverse(), 0.65)).toEqual(result);
  });
  it('deduplicates measured pairs and keeps unrelated stories and below-threshold bridges separate', () => {
    const d = article(4, 'D', '2026-10-04T04:00:00Z'),
      e = article(5, 'E', '2026-10-04T05:00:00Z');
    const result = groupStoryOrigins([pair(a, b), pair(b, a, 0.8), pair(b, c, 0.4), pair(c, d), pair(d, e)], 0.65);
    expect(result.groups).toHaveLength(2);
    expect(result.origins.map((o) => [o.article.id, o.source.id])).toEqual([
      [2, 1],
      [4, 3],
      [5, 3],
    ]);
    expect(result.origins[0].directPair?.score).toBe(0.9);
  });
  it('keeps a deterministic single source for ties and does not invent a date for missing times', () => {
    const tie = { ...b, publishedAt: a.publishedAt },
      unknown = { ...c, publishedAt: '' };
    const result = groupStoryOrigins([pair(tie, a), pair(tie, unknown)], 0.65);
    expect(result.groups[0].source?.id).toBe(1);
    expect(result.groups[0].tiedFirst).toBe(2);
    expect(result.origins.map((o) => o.source.id)).toEqual([1, 1]);
    const missing = groupStoryOrigins([pair({ ...a, publishedAt: '' }, unknown)], 0.65);
    expect(missing.groups[0].source).toBeNull();
    expect(missing.origins).toEqual([]);
  });
  it('retains the original source when it is hidden by media filters instead of promoting B', () => {
    const view = withStoryOrigins(sample([pair(a, b), pair(b, c)]));
    const filtered = filterGraphMedia(view.nodes, view.edges, { B: 'green', C: 'green' }, [], { limit: 0, camp: 'green', tag: '' });
    expect(filtered.nodes.map((n) => n.id)).toEqual(['B', 'C']);
    expect(filtered.edges).toEqual([]);
    const scope = graphEvidenceScope(view, filtered.nodes);
    expect(scope.origins).toEqual([]);
    expect(view.origins.map((o) => o.source.id)).toEqual([1, 1]);
  });
  it('uses new directed origins for click evidence and hover, without inventing a direct C/A similarity score', () => {
    const view = withStoryOrigins(sample([pair(a, b), pair(b, c)]));
    const edge = view.edges.find((e) => e.kind === 'similarity' && e.source === 'C')!;
    const evidence = graphEvidence(view, { edge }, 'similarity', '', 'all');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ kind: 'origin', origin: { article: { id: 3 }, source: { id: 1 } } });
    expect(graphEvidence(view, { edge: { ...edge, source: 'A', target: 'C' } }, 'similarity', '', 'all')).toEqual([]);
    expect(graphEvidence(view, { node: 'A' }, 'similarity', '', 'all')).toHaveLength(2);
    expect(graphEvidence(view, null, 'similarity', '報導 1', 'all')).toHaveLength(2);
    const tooltip = createGraphTooltip(view, view.nodes, {});
    const html = tooltip({ edge }, view.edges);
    expect(html).toContain('C → A');
    expect(html).toContain('同組最早刊登來源');
    expect(html).not.toContain('90.0%');
    expect(nodeArticleCounts(view).get('A')?.similar).toBe(1);
    expect(nodeArticleCounts(view).get('C')?.similar).toBe(1);
  });
  it('counts articles only once, omits media self-loops, and keeps reverse flows for different stories', () => {
    const extra = { ...c, id: 4, media: 'B' },
      own = { ...c, id: 5, media: 'A' };
    const earlierB = article(6, 'B', '2026-10-03T01:00:00Z'),
      laterA = article(7, 'A', '2026-10-04T05:00:00Z');
    const view = withStoryOrigins(sample([pair(a, b), pair(b, c), pair(b, extra), pair(c, extra), pair(c, own), pair(earlierB, laterA)]));
    expect(view.edges.filter((e) => e.kind === 'similarity').map((e) => [e.source, e.target, e.count])).toEqual([
      ['B', 'A', 2],
      ['C', 'A', 1],
      ['A', 'B', 1],
    ]);
  });
});
