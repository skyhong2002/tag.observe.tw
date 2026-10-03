import type { Attribution } from '../../../app/src/similarity/attribution.ts';
import type { SimilarityArticle, SimilarityEvidence, SimilarityPair } from '../../../app/src/similarity/types.ts';

export interface StoryGroup {
  id: string;
  source: SimilarityArticle | null;
  articles: SimilarityArticle[];
  /** Highest-scoring measured pairs of the group; the server sends at most 100. */
  pairs: SimilarityPair[];
  /** Every measured pair of the group, including those not sent. */
  pairCount: number;
  tiedFirst: number;
}
export interface StoryOrigin {
  id: string;
  article: SimilarityArticle;
  source: SimilarityArticle;
  group: StoryGroup;
  directPair: SimilarityPair | null;
}
export type EvidenceItem =
  | { kind: 'origin'; key: string; publishedAt: string; origin: StoryOrigin }
  | { kind: 'citation'; key: string; publishedAt: string; citation: { article: SimilarityArticle; source: Attribution } };

/** Rebuild one evidence page from the server's references, sharing each group between its origins. */
export function evidenceItems(evidence: SimilarityEvidence): EvidenceItem[] {
  const article = (id: number | null) => (id === null ? undefined : evidence.articles[String(id)]);
  const groups = new Map<string, StoryGroup | null>();
  const group = (id: string) => {
    if (!groups.has(id)) {
      const data = evidence.groups[id];
      groups.set(
        id,
        data
          ? {
              id: data.id,
              source: article(data.sourceId) ?? null,
              articles: data.articleIds.map((member) => article(member)).filter((member): member is SimilarityArticle => !!member),
              pairs: data.pairs,
              pairCount: data.pairCount,
              tiedFirst: data.tiedFirst,
            }
          : null,
      );
    }
    return groups.get(id) ?? null;
  };
  const items: EvidenceItem[] = [];
  for (const ref of evidence.items) {
    const own = article(ref.articleId);
    if (!own) continue;
    if (ref.kind === 'citation') {
      items.push({ kind: 'citation', key: ref.key, publishedAt: ref.publishedAt, citation: { article: own, source: ref.source } });
      continue;
    }
    const source = article(ref.sourceId),
      story = group(ref.groupId);
    if (!source || !story) continue;
    items.push({
      kind: 'origin',
      key: ref.key,
      publishedAt: ref.publishedAt,
      origin: { id: `${ref.groupId}:${own.id}`, article: own, source, group: story, directPair: ref.directPair },
    });
  }
  return items;
}
