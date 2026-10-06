import { personNames } from '../journalists/names.ts';
import { type Attribution, attributionRole } from './attribution.ts';
import type { PairRelationInfo } from './types.ts';

interface CreditedArticle {
  media: string;
  authors: string[];
  attributions?: Pick<Attribution, 'media' | 'name' | 'evidence'>[];
  publishedAt: string;
  datePending?: boolean;
}

// The read-side hydrates each article once but may classify thousands of its pairs.
// Weak keys let each bounded period be collected, and the signature detects credit edits.
const nameCache = new WeakMap<CreditedArticle, { signature: string; names: string[] }>();
function creditedNames(article: CreditedArticle) {
  const signature = article.authors.join('\0');
  const cached = nameCache.get(article);
  if (cached?.signature === signature) return cached.names;
  const names = [...new Set(article.authors.flatMap((credit) => personNames(credit, true)))];
  nameCache.set(article, { signature, names });
  return names;
}

/** Source credits and matching bylines are evidence, never proof of permission or identity. */
export function classifyRelation(a: CreditedArticle, b: CreditedArticle): PairRelationInfo {
  const aNames = creditedNames(a);
  const bNames = new Set(creditedNames(b));
  const sharedAuthors = aNames.filter((name) => bNames.has(name));
  const aSources = a.attributions ?? [];
  const bSources = b.attributions ?? [];
  const aCitesB = aSources.some((source) => source.media === b.media);
  const bCitesA = bSources.some((source) => source.media === a.media);
  const commonSources = aSources.filter((source) => bSources.some((other) => other.media === source.media));
  const attributed = aCitesB || bCitesA || commonSources.length > 0;
  const aTime = Date.parse(a.publishedAt),
    bTime = Date.parse(b.publishedAt);
  const publication =
    a.datePending || b.datePending || !Number.isFinite(aTime) || !Number.isFinite(bTime)
      ? 'unknown'
      : Math.abs(aTime - bTime) < 60e3
        ? 'same'
        : aTime < bTime
          ? 'a-earlier'
          : 'b-earlier';
  return {
    kind: attributed ? 'attributed' : sharedAuthors.length ? 'same-byline' : 'unattributed',
    sharedAuthors,
    aCitesB,
    bCitesA,
    aCreditRole: aCitesB ? attributionRole(aSources.find((source) => source.media === b.media)!) : undefined,
    bCreditRole: bCitesA ? attributionRole(bSources.find((source) => source.media === a.media)!) : undefined,
    commonSources: commonSources.map(({ media, name }) => ({ media, name })),
    publication,
  };
}

/** Graph arrows describe explicit credits or publication order, never inferred authorship. */
export function similarityConnection(a: CreditedArticle, b: CreditedArticle, relation = classifyRelation(a, b)) {
  const category = relation.sharedAuthors.length ? 'same-byline' : relation.kind;
  let source: string, target: string;
  let directed = false;
  if (category === 'attributed' && relation.aCitesB !== relation.bCitesA) {
    [source, target] = relation.aCitesB ? [a.media, b.media] : [b.media, a.media];
    directed = true;
  } else if (category === 'unattributed' && ['a-earlier', 'b-earlier'].includes(relation.publication)) {
    [source, target] = relation.publication === 'a-earlier' ? [b.media, a.media] : [a.media, b.media];
    directed = true;
  } else {
    [source, target] = [a.media, b.media].sort();
  }
  return { source, target, relation: category, directed };
}
