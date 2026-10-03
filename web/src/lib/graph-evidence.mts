import type { SimilarityEdge } from '../../../app/src/similarity/types.ts';

export type { EvidenceItem } from './story-origins.mts';

export type GraphSelection = { node: string } | { edge: SimilarityEdge } | null;
export type RelationshipMode = 'all' | 'similarity' | 'citation';
/** Citations: outgoing cites another outlet. Similarity: outgoing published later, incoming was the group's earliest. */
export type CitationDirection = 'all' | 'outgoing' | 'incoming';

export function sameGraphSelection(a: GraphSelection, b: GraphSelection): boolean {
  if (!a || !b) return a === b;
  if ('node' in a) return 'node' in b && a.node === b.node;
  return 'edge' in b && a.edge.kind === b.edge.kind && a.edge.source === b.edge.source && a.edge.target === b.edge.target;
}

export function highlightedRelationship(edge: SimilarityEdge, selection: GraphSelection): boolean {
  if (!selection) return false;
  return 'node' in selection ? edge.source === selection.node || edge.target === selection.node : sameGraphSelection({ edge }, selection);
}
