import type { SimilarityData, SimilarityEdge } from '../../../app/src/similarity/types.ts';

import type { OriginData, StoryOrigin } from './story-origins.mts';

export type GraphSelection = { node: string } | { edge: SimilarityEdge } | null;
export type RelationshipMode = 'all' | 'similarity' | 'citation';
/** Citations: outgoing cites another outlet. Similarity: outgoing published later, incoming was the group's earliest. */
export type CitationDirection = 'all' | 'outgoing' | 'incoming';
export type EvidenceItem =
  | { kind: 'origin'; key: string; publishedAt: string; origin: StoryOrigin }
  | { kind: 'citation'; key: string; publishedAt: string; citation: SimilarityData['citations'][number] }
  | { kind: 'similarity'; key: string; publishedAt: string; pair: SimilarityData['pairs'][number] };

export function sameGraphSelection(a: GraphSelection, b: GraphSelection): boolean {
  if (!a || !b) return a === b;
  if ('node' in a) return 'node' in b && a.node === b.node;
  return 'edge' in b && a.edge.kind === b.edge.kind && a.edge.source === b.edge.source && a.edge.target === b.edge.target;
}

export function highlightedRelationship(edge: SimilarityEdge, selection: GraphSelection): boolean {
  if (!selection) return false;
  return 'node' in selection ? edge.source === selection.node || edge.target === selection.node : sameGraphSelection({ edge }, selection);
}

/** Browse the complete evidence by default; selection narrows it without changing the graph layout. */
export function graphEvidence(
  data: Pick<OriginData, 'pairs' | 'citations' | 'origins'>,
  selection: GraphSelection,
  mode: RelationshipMode,
  query: string,
  direction: CitationDirection,
): EvidenceItem[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (...text: string[]) => {
    const haystack = text.join(' ').toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  };
  const items: EvidenceItem[] = [];
  if (mode !== 'similarity' && (!selection || 'node' in selection || selection.edge.kind === 'citation')) {
    for (const citation of data.citations) {
      const { article, source } = citation;
      if (selection) {
        if ('node' in selection) {
          const outgoing = direction !== 'incoming' && article.media === selection.node;
          const incoming = direction !== 'outgoing' && source.media === selection.node;
          if (!outgoing && !incoming) continue;
        } else if (article.media !== selection.edge.source || source.media !== selection.edge.target) continue;
      }
      if (!matches(article.title, article.mediaTitle, source.name, ...article.authors, source.evidence)) continue;
      items.push({ kind: 'citation', key: `citation:${article.id}:${source.media}`, publishedAt: article.publishedAt, citation });
    }
  }
  if (mode !== 'citation' && (!selection || 'node' in selection || selection.edge.kind === 'similarity')) {
    if (data.origins)
      for (const origin of data.origins) {
        const { article, source } = origin;
        if (
          selection &&
          ('node' in selection
            ? !(
                (article.media === selection.node && (mode !== 'similarity' || direction !== 'incoming')) ||
                (source.media === selection.node && (mode !== 'similarity' || direction !== 'outgoing'))
              )
            : article.media !== selection.edge.source || source.media !== selection.edge.target)
        )
          continue;
        if (
          !matches(
            article.title,
            source.title,
            article.mediaTitle,
            source.mediaTitle,
            ...article.authors,
            ...source.authors,
            ...origin.group.pairs.map((pair) => pair.evidence),
          )
        )
          continue;
        items.push({ kind: 'origin', key: `origin:${origin.id}`, publishedAt: article.publishedAt, origin });
      }
    else
      for (const pair of data.pairs) {
        const ids = [pair.a.media, pair.b.media];
        if (
          selection &&
          ('node' in selection
            ? !ids.includes(selection.node)
            : !ids.includes(selection.edge.source) || !ids.includes(selection.edge.target))
        )
          continue;
        if (!matches(pair.a.title, pair.b.title, pair.a.mediaTitle, pair.b.mediaTitle, ...pair.a.authors, ...pair.b.authors, pair.evidence))
          continue;
        items.push({
          kind: 'similarity',
          key: `similarity:${pair.id}`,
          publishedAt: pair.a.publishedAt > pair.b.publishedAt ? pair.a.publishedAt : pair.b.publishedAt,
          pair,
        });
      }
  }
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.key.localeCompare(b.key));
}
