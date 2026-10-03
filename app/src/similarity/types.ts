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
  articles: number;
  external: boolean;
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
  withAuthors: number;
  missing: number;
  pending: number;
  enabled: boolean;
  excludedFromStatistics: boolean;
}
export interface SimilarityData {
  generatedAt: string;
  hours: number;
  threshold: number;
  method: string;
  coverage: SimilarityCoverage[];
  sample: {
    available: number;
    analyzed: number;
    limit: number;
    truncated: boolean;
    pairLimit: number;
    pairsTruncated: boolean;
    /** Oldest publish time among the analysed articles; null when nothing was analysed. */
    from: string | null;
  };
  pairs: SimilarityPair[];
  citations: Array<{ article: SimilarityArticle; source: Attribution }>;
  nodes: SimilarityNode[];
  edges: SimilarityEdge[];
}
