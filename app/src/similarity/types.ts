import type { Attribution } from './attribution.ts';

export interface PairRelationInfo {
  kind: 'attributed' | 'same-byline' | 'unattributed';
  sharedAuthors: string[];
  aCitesB: boolean;
  bCitesA: boolean;
  aCreditRole?: '來源' | '引用';
  bCreditRole?: '來源' | '引用';
  commonSources: Array<{ media: string; name: string }>;
  publication: 'same' | 'a-earlier' | 'b-earlier' | 'unknown';
}
export interface SimilarityArticle {
  id: number;
  media: string;
  mediaTitle: string;
  country: string;
  countryCode: string;
  title: string;
  url: string;
  publishedAt: string;
  authors: string[];
  datePending?: boolean;
  bodyLength: number;
  attributions: Attribution[];
}
export interface SimilarityPair {
  relation?: PairRelationInfo;
  id: string;
  a: SimilarityArticle;
  b: SimilarityArticle;
  score: number;
  containment: number;
  sharedShingles: number;
  kind: 'identical' | 'high';
  evidence: string;
}
export interface SimilarityNode {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  /** Articles of this outlet analysed in the period. */
  articles: number;
  external: boolean;
  /** Distinct articles of this outlet in a story group with another outlet. */
  similar: number;
  sameByline?: number;
  attributed?: number;
  unattributed?: number;
  /** Unattributed direct matches: articles with an earlier confirmed publication. */
  earliest: number;
  /** Unattributed direct matches: articles with a later confirmed publication. */
  later: number;
  /** Distinct articles of this outlet citing another outlet. */
  outgoing: number;
  /** Distinct articles elsewhere citing this outlet. */
  incoming: number;
}
export interface SimilarityEdge {
  source: string;
  target: string;
  kind: 'similarity' | 'citation';
  /** Visual category; matching bylines take priority over source credits. */
  relation?: PairRelationInfo['kind'];
  /** Arrow points from target to source; orange means publication order only. */
  directed?: boolean;
  count: number;
  score: number | null;
  sameByline?: number;
  attributed?: number;
  unattributed?: number;
}
export interface SimilarityCoverage {
  media: string;
  name: string;
  total: number;
  fetched: number;
  usable: number;
  /** Usable bodies already compared by the index. */
  indexed: number;
  withAuthors: number;
  missing: number;
  pending: number;
  enabled: boolean;
  excludedFromStatistics: boolean;
}
export interface SimilarityWindow {
  /** Rolling window in hours, or null for a range of Taipei dates. */
  hours: number | null;
  /** Inclusive Taipei dates for a date range. */
  days: { from: string; to: string } | null;
  from: string;
  to: string;
}
export interface SimilarityIndexStats {
  /** Usable bodies published in the period, outside syndication sites. */
  available: number;
  /** Of those, compared by the index. */
  analyzed: number;
  /** Usable bodies waiting for the next index run. */
  pending: number;
  /** Stored pairs at or above the threshold inside the period. */
  pairs: number;
  groups: number;
  citations: number;
  /** Articles are compared with others published at most this many days apart. */
  windowDays: number;
}
export interface SimilarityData extends SimilarityWindow {
  generatedAt: string;
  threshold: number;
  method: string;
  coverage: SimilarityCoverage[];
  index: SimilarityIndexStats;
  nodes: SimilarityNode[];
  edges: SimilarityEdge[];
}

/** Connected article groups; sourceId is a display representative, not an inferred content source. */
export interface StoryGroupData {
  id: string;
  sourceId: number | null;
  articleIds: number[];
  tiedFirst: number;
  pairCount: number;
  /** Highest-scoring pairs of the group (at most GROUP_PAIR_LIMIT). */
  pairs: SimilarityPair[];
}
export type EvidenceRef =
  | {
      kind: 'origin';
      key: string;
      publishedAt: string;
      articleId: number;
      sourceId: number;
      groupId: string;
      directPair: SimilarityPair | null;
    }
  | { kind: 'citation'; key: string; publishedAt: string; articleId: number; source: Attribution };
export interface SimilarityEvidence {
  total: number;
  page: number;
  pageSize: number;
  /** Story links from an outlet in `scope` to a source outside it. */
  hiddenSources: number;
  items: EvidenceRef[];
  articles: Record<string, SimilarityArticle>;
  groups: Record<string, StoryGroupData>;
}

export interface SimilarityDaily {
  from: string;
  to: string;
  threshold: number;
  days: string[];
  totals: { articles: number[]; pairs: number[]; identical: number[]; citations: number[] };
  media: Array<{
    media: string;
    name: string;
    articles: number[];
    pairs: number[];
    /** Unattributed direct matches published earlier; excludes shared bylines and pending dates. */
    sameByline?: number[];
    attributed?: number[];
    unattributed?: number[];
    copied: number[];
    /** Unattributed direct matches published later; excludes shared bylines and pending dates. */
    copying: number[];
    citing: number[];
    cited: number[];
  }>;
}

export interface ArticleSimilarity {
  articleId: number;
  threshold: number;
  /** When the index compared this article; null while it waits. */
  indexedAt: string | null;
  /** Normalized body length, or null if the body was too short to compare. */
  chars: number | null;
  windowDays: number;
  matches: Array<{
    article: SimilarityArticle;
    relation?: PairRelationInfo;
    score: number;
    containment: number;
    kind: 'identical' | 'high';
    evidence: string;
  }>;
}
