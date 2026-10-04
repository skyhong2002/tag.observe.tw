import type { SimilarityEdge, SimilarityNode } from '../../../app/src/similarity/types.ts';

/** One outlet's relationships with another outlet, counted in articles as the index does. */
export interface MediaPartner {
  id: string;
  name: string;
  external: boolean;
  /** Articles of this outlet that joined a story group the partner started. */
  later: number;
  /** Articles of the partner that joined a story group this outlet started. */
  earliest: number;
  /** Articles of this outlet explicitly citing the partner. */
  cites: number;
  /** Articles of the partner explicitly citing this outlet. */
  citedBy: number;
  total: number;
}
export interface MediaRelations {
  /** Index node of the outlet, or null when it has no analysed articles or relationships. */
  node: SimilarityNode | null;
  partners: MediaPartner[];
}

/** Similarity edges point from the later outlet to the group's earliest; citation edges from the citing outlet to the cited one. */
export function mediaRelations(data: { nodes: SimilarityNode[]; edges: SimilarityEdge[] }, media: string): MediaRelations {
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const partners = new Map<string, MediaPartner>();
  const partner = (id: string) => {
    let entry = partners.get(id);
    if (!entry) {
      const node = byId.get(id);
      entry = { id, name: node?.name ?? id, external: node?.external ?? false, later: 0, earliest: 0, cites: 0, citedBy: 0, total: 0 };
      partners.set(id, entry);
    }
    return entry;
  };
  for (const edge of data.edges) {
    if (edge.source === edge.target || (edge.source !== media && edge.target !== media)) continue;
    const outgoing = edge.source === media;
    const entry = partner(outgoing ? edge.target : edge.source);
    if (edge.kind === 'citation') {
      if (outgoing) entry.cites += edge.count;
      else entry.citedBy += edge.count;
    } else if (outgoing) entry.later += edge.count;
    else entry.earliest += edge.count;
    entry.total += edge.count;
  }
  return {
    node: byId.get(media) ?? null,
    partners: [...partners.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh-TW') || a.id.localeCompare(b.id)),
  };
}
