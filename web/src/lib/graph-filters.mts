import type { SimilarityData, SimilarityEdge, SimilarityNode } from '../../../app/src/similarity/types.ts';
import { connectedMedia, type MediaCamps } from './media-graph.mts';

export type MediaTag = { id: string; label: string; media: string[] };
export type GraphFilters = { limit: number; camp: 'all' | 'blue' | 'green' | 'other'; tag: string };

/** Rank after applying camp/tag filters. Only relationships between retained outlets survive. */
export function filterGraphMedia(
  nodes: SimilarityNode[],
  edges: SimilarityEdge[],
  camps: MediaCamps,
  tags: MediaTag[],
  filters: GraphFilters,
) {
  const tagged = filters.tag ? new Set(tags.find((tag) => tag.id === filters.tag)?.media ?? []) : null;
  const matches = connectedMedia(nodes, edges)
    .filter((node) => (!tagged || tagged.has(node.id)) && (filters.camp === 'all' || (camps[node.id] ?? 'other') === filters.camp))
    .sort((a, b) => b.articles - a.articles || a.id.localeCompare(b.id));
  const retained = filters.limit > 0 ? matches.slice(0, filters.limit) : matches;
  const ids = new Set(retained.map((node) => node.id));
  return { nodes: retained, edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)), available: matches.length };
}

export function graphEvidenceScope(data: SimilarityData, nodes: SimilarityNode[]) {
  const ids = new Set(nodes.map((node) => node.id));
  return {
    ...data,
    nodes,
    edges: data.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    pairs: data.pairs.filter((pair) => ids.has(pair.a.media) && ids.has(pair.b.media)),
    citations: data.citations.filter((citation) => ids.has(citation.article.media) && ids.has(citation.source.media)),
  };
}
