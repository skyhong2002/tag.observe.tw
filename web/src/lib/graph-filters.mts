import type { SimilarityEdge, SimilarityNode } from '../../../app/src/similarity/types.ts';
import { connectedMedia, type MediaCamps } from './media-graph.mts';

import type { OriginData } from './story-origins.mts';

export type MediaTag = { id: string; label: string; media: string[] };
export type GraphFilters = { limit: number; camp: 'all' | 'blue' | 'green' | 'other'; tag: string };

/** Limit matching outlets, then include their direct partners when a tag is selected. */
export function filterGraphMedia(
  nodes: SimilarityNode[],
  edges: SimilarityEdge[],
  camps: MediaCamps,
  tags: MediaTag[],
  filters: GraphFilters,
) {
  const tagged = filters.tag ? new Set(tags.find((tag) => tag.id === filters.tag)?.media ?? []) : null;
  const eligible = connectedMedia(nodes, edges).filter((node) => filters.camp === 'all' || (camps[node.id] ?? 'other') === filters.camp);
  const eligibleIds = new Set(eligible.map((node) => node.id));
  const matches = eligible
    .filter((node) => !tagged || tagged.has(node.id))
    .sort((a, b) => b.articles - a.articles || a.id.localeCompare(b.id));
  const retained = filters.limit > 0 ? matches.slice(0, filters.limit) : matches;
  const ids = new Set(retained.map((node) => node.id));
  const focus = tagged ? new Set(ids) : null;
  const directEdges = edges.filter((edge) => eligibleIds.has(edge.source) && eligibleIds.has(edge.target));
  const expand = (selected: Set<string>) => {
    const expanded = new Set(selected);
    for (const edge of directEdges) {
      if (selected.has(edge.source) || selected.has(edge.target)) {
        expanded.add(edge.source);
        expanded.add(edge.target);
      }
    }
    return expanded;
  };
  const visibleIds = focus ? expand(focus) : ids;
  const available = focus ? expand(new Set(matches.map((node) => node.id))).size : matches.length;
  return {
    nodes: focus
      ? [...retained, ...eligible.filter((node) => visibleIds.has(node.id) && !ids.has(node.id)).sort((a, b) => a.id.localeCompare(b.id))]
      : retained,
    edges: directEdges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target) && (!focus || focus.has(edge.source) || focus.has(edge.target)),
    ),
    available,
    focus,
  };
}

/** Offer only tags that retain a visible relationship under the other controls. */
export function availableGraphTags(
  nodes: SimilarityNode[],
  edges: SimilarityEdge[],
  camps: MediaCamps,
  tags: MediaTag[],
  filters: GraphFilters,
  mode: 'all' | SimilarityEdge['kind'] = 'all',
) {
  return tags.filter((tag) =>
    filterGraphMedia(nodes, edges, camps, tags, { ...filters, tag: tag.id }).edges.some((edge) => mode === 'all' || edge.kind === mode),
  );
}

export function graphEvidenceScope(data: OriginData, nodes: SimilarityNode[], focus: ReadonlySet<string> | null = null) {
  const ids = new Set(nodes.map((node) => node.id));
  const includes = (source: string, target: string) =>
    ids.has(source) && ids.has(target) && (!focus || focus.has(source) || focus.has(target));
  return {
    ...data,
    nodes,
    edges: data.edges.filter((edge) => includes(edge.source, edge.target)),
    origins: data.origins?.filter((origin) => includes(origin.article.media, origin.source.media)),
    pairs: data.pairs.filter((pair) => includes(pair.a.media, pair.b.media)),
    citations: data.citations.filter((citation) => includes(citation.article.media, citation.source.media)),
  };
}
