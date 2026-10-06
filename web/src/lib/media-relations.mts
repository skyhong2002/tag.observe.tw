import type { SimilarityEdge, SimilarityNode } from '../../../app/src/similarity/types.ts';

/** One outlet's relationships with another outlet, counted in articles as the index does. */
export interface MediaPartner {
  id: string;
  name: string;
  external: boolean;
  /** Direct measured pairs, independent of article chronology. */
  similar: number;
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

/** Similarity is undirected; citations point from the citing outlet to the cited one. */
export function mediaRelations(data: { nodes: SimilarityNode[]; edges: SimilarityEdge[] }, media: string): MediaRelations {
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const partners = new Map<string, MediaPartner>();
  const partner = (id: string) => {
    let entry = partners.get(id);
    if (!entry) {
      const node = byId.get(id);
      entry = { id, name: node?.name ?? id, external: node?.external ?? false, similar: 0, cites: 0, citedBy: 0, total: 0 };
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
    } else entry.similar += edge.count;
    entry.total += edge.count;
  }
  return {
    node: byId.get(media) ?? null,
    partners: [...partners.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh-TW') || a.id.localeCompare(b.id)),
  };
}
