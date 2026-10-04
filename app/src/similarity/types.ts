import type { Attribution } from './attribution.ts';

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
  bodyLength: number;
  attributions: Attribution[];
}
export interface SimilarityPair {
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
  /** Of `similar`: articles that were the earliest in their group. */
  earliest: number;
  /** Of `similar`: articles whose group already had an earlier one. */
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
  count: number;
  score: number | null;
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

/** Articles linked by pairs, each pointing to the group's earliest publication. */
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
    /** Articles of this outlet that another outlet later matched (distinct, by own publish day). */
    copied: number[];
    /** Articles of this outlet published after a matching article elsewhere. */
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
    score: number;
    containment: number;
    kind: 'identical' | 'high';
    evidence: string;
  }>;
}
