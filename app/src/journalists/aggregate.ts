import type { Attribution } from '../similarity/attribution.ts';
import { classifyRelation } from '../similarity/relation.ts';
import type { SimilarityArticle, SimilarityPair } from '../similarity/types.ts';
import { journalistNames } from './names.ts';

// Pure aggregation over stored bylines and computed similarity pairs. Nothing
// here claims authorship: a later similar article is a signal to read, not a
// verdict, and the same name at two outlets may be two people.

export interface BylineRow {
  id: number;
  media: string;
  publishedAt: Date;
  authors: string[] | null;
  creator: string | null;
  bodyStatus: string | null;
  hasBody: boolean;
  /** Compared by the similarity index. */
  indexed: boolean;
  attributions: Attribution[] | null;
}
export interface JournalistOutlet {
  media: string;
  name: string;
  count: number;
}
export interface JournalistSimilarity {
  /** Pairs with at least one of this journalist's articles. */
  pairs: number;
  /** Distinct own articles that matched something. */
  articles: number;
  /** Pairs where the own article was published at least a minute after the other outlet's. */
  later: number;
  earlier: number;
  /** Pairs whose other side carries the same byline (the person's own copy elsewhere). */
  sameAuthor: number;
  attributed?: number;
  identical: number;
}
export interface JournalistSummary {
  name: string;
  articles: number;
  media: JournalistOutlet[];
  withBody: number;
  cited: number;
  latest: string;
  /** Articles the similarity index compared with other outlets. */
  compared: number;
  similar: JournalistSimilarity;
}
export type PairRelation = 'later' | 'earlier' | 'same';
export interface JournalistPair {
  own: SimilarityArticle;
  other: SimilarityArticle;
  score: number;
  containment: number;
  sharedShingles: number;
  kind: SimilarityPair['kind'];
  evidence: string;
  /** Other publish time minus own, in minutes: positive when the own article came first. */
  minutes: number;
  relation: PairRelation;
  sameAuthor: boolean;
  attributed?: boolean;
  publicationUnknown?: boolean;
  ownCitesOther: boolean;
  otherCitesOwn: boolean;
}

export function rowJournalists(row: { authors: string[] | null; creator: string | null }): string[] {
  const credits = row.authors?.length ? row.authors : row.creator?.trim() ? [row.creator] : [];
  return journalistNames(credits);
}
const emptySimilarity = (): JournalistSimilarity => ({
  pairs: 0,
  articles: 0,
  later: 0,
  earlier: 0,
  sameAuthor: 0,
  attributed: 0,
  identical: 0,
});

export function orientPair(pair: SimilarityPair, isOwn: (article: SimilarityArticle) => boolean, name: string): JournalistPair | null {
  const [own, other] = isOwn(pair.a) ? [pair.a, pair.b] : isOwn(pair.b) ? [pair.b, pair.a] : [null, null];
  if (!own || !other) return null;
  const minutes = Math.round((Date.parse(other.publishedAt) - Date.parse(own.publishedAt)) / 60000);
  const info = classifyRelation(own, other);
  const relation: PairRelation = info.publication === 'a-earlier' ? 'earlier' : info.publication === 'b-earlier' ? 'later' : 'same';
  return {
    own,
    other,
    score: pair.score,
    containment: pair.containment,
    sharedShingles: pair.sharedShingles,
    kind: pair.kind,
    evidence: pair.evidence,
    minutes: Number.isFinite(minutes) ? minutes : 0,
    relation,
    sameAuthor: info.sharedAuthors.includes(name),
    attributed: info.kind === 'attributed',
    publicationUnknown: info.publication === 'unknown',
    ownCitesOther: own.attributions.some((source) => source.media === other.media),
    otherCitesOwn: other.attributions.some((source) => source.media === own.media),
  };
}
export function countSimilarity(pairs: JournalistPair[]): JournalistSimilarity {
  const result = emptySimilarity();
  const matched = new Set<number>();
  for (const pair of pairs) {
    result.pairs++;
    matched.add(pair.own.id);
    if (pair.kind === 'identical') result.identical++;
    if (pair.sameAuthor) result.sameAuthor++;
    else if (pair.attributed || pair.ownCitesOther || pair.otherCitesOwn) result.attributed = (result.attributed ?? 0) + 1;
    else if (pair.relation === 'later') result.later++;
    else if (pair.relation === 'earlier') result.earlier++;
  }
  result.articles = matched.size;
  return result;
}

export function summarizeJournalists(
  rows: BylineRow[],
  pairs: SimilarityPair[],
  mediaTitle: (media: string) => string,
): JournalistSummary[] {
  const byName = new Map<string, { rows: BylineRow[]; media: Map<string, number> }>();
  const namesOf = new Map<number, string[]>();
  for (const row of rows) {
    const names = rowJournalists(row);
    if (!names.length) continue;
    namesOf.set(row.id, names);
    for (const name of names) {
      const entry = byName.get(name) ?? { rows: [] as BylineRow[], media: new Map<string, number>() };
      entry.rows.push(row);
      entry.media.set(row.media, (entry.media.get(row.media) ?? 0) + 1);
      byName.set(name, entry);
    }
  }
  const pairsOf = new Map<string, JournalistPair[]>();
  for (const pair of pairs) {
    for (const name of new Set([...(namesOf.get(pair.a.id) ?? []), ...(namesOf.get(pair.b.id) ?? [])])) {
      const oriented = orientPair(pair, (article) => namesOf.get(article.id)?.includes(name) ?? false, name);
      if (oriented) (pairsOf.get(name) ?? pairsOf.set(name, []).get(name)!).push(oriented);
    }
  }
  return [...byName]
    .map(([name, entry]) => ({
      name,
      articles: entry.rows.length,
      media: [...entry.media]
        .map(([media, count]) => ({ media, name: mediaTitle(media), count }))
        .sort((a, b) => b.count - a.count || a.media.localeCompare(b.media)),
      withBody: entry.rows.filter((row) => row.bodyStatus === 'ok' && row.hasBody).length,
      cited: entry.rows.filter((row) => (row.attributions?.length ?? 0) > 0).length,
      latest: new Date(Math.max(...entry.rows.map((row) => row.publishedAt.getTime()))).toISOString(),
      compared: entry.rows.filter((row) => row.indexed).length,
      similar: countSimilarity(pairsOf.get(name) ?? []),
    }))
    .sort((a, b) => b.articles - a.articles || a.name.localeCompare(b.name, 'zh-Hant'));
}
