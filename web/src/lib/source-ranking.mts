import type { SimilarityData } from '../../../app/src/similarity/types.ts';

/** Citation targets are sources. Similarity and earliest publication never count as citation. */
export function sourceRanking(data: Pick<SimilarityData, 'nodes' | 'edges'>) {
  return data.nodes
    .filter((node) => node.incoming > 0)
    .map((node) => ({
      ...node,
      citingMedia: [
        ...new Set(
          data.edges.filter((edge) => edge.kind === 'citation' && edge.target === node.id && edge.count > 0).map((edge) => edge.source),
        ),
      ],
    }))
    .sort((a, b) => b.incoming - a.incoming || a.name.localeCompare(b.name, 'zh-Hant'));
}
