import { API_ORIGIN } from './api';

export type {
  ArticleSimilarity,
  EvidenceRef,
  SimilarityArticle,
  SimilarityCoverage,
  SimilarityDaily,
  SimilarityData,
  SimilarityEdge,
  SimilarityEvidence,
  SimilarityNode,
  SimilarityPair,
  StoryGroupData,
} from '../../../app/src/similarity/types';

import type { ArticleSimilarity, SimilarityDaily, SimilarityData, SimilarityEvidence } from '../../../app/src/similarity/types';

/** A rolling window in hours, or inclusive Taipei dates (at most 31 days). */
export type SimilarityPeriod = { hours: number } | { from: string; to: string };
export const PERIOD_HOURS = [24, 48, 72, 168] as const;
export const MAX_RANGE_DAYS = 31;

export function periodQuery(period: SimilarityPeriod, threshold: number): URLSearchParams {
  const params = new URLSearchParams('hours' in period ? { hours: String(period.hours) } : { from: period.from, to: period.to });
  params.set('threshold', String(threshold));
  return params;
}

// Pages render after this resolves, and the gateway answers 503 when a page
// sends no headers for 15 s (app/src/ui-proxy.js); fail inside that budget so
// the page can show its own unavailable state.
export async function fetchSimilarity(period: SimilarityPeriod, threshold: number): Promise<SimilarityData> {
  const response = await fetch(`${API_ORIGIN}/api/v1/similarity?${periodQuery(period, threshold)}`, {
    next: { revalidate: 60 },
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(13_000),
  });
  if (!response.ok) throw new Error(`similarity: ${response.status}`);
  return response.json() as Promise<SimilarityData>;
}

export interface EvidenceQuery {
  mode: 'all' | 'similarity' | 'citation';
  relation?: 'attributed' | 'same-byline' | 'unattributed';
  node?: string;
  edge?: { kind: 'similarity' | 'citation'; source: string; target: string; relation?: EvidenceQuery['relation']; directed?: boolean };
  direction: 'all' | 'outgoing' | 'incoming';
  /** Media on screen; relationships need both ends inside. */
  scope?: string[];
  /** Category focus; relationships need one end inside. */
  focus?: string[];
  q: string;
  page: number;
  /** Whole percents; sent to the API as 0–1. */
  minScore?: number;
  maxScore?: number;
  bylines?: 'both' | 'missing' | 'none';
  gap?: 'same' | 'hour' | 'later';
  minGroup?: number;
  sort?: 'score';
}
/** Browser-side: one page of evidence from the full index, newest first. */
export async function fetchEvidence(period: SimilarityPeriod, threshold: number, query: EvidenceQuery, signal?: AbortSignal) {
  const params = periodQuery(period, threshold);
  params.set('mode', query.mode);
  if (query.relation) params.set('relation', query.relation);
  params.set('direction', query.direction);
  params.set('page', String(query.page));
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.node) params.set('node', query.node);
  if (query.edge) {
    params.set('edgeKind', query.edge.kind);
    if (query.edge.relation) params.set('edgeRelation', query.edge.relation);
    if (query.edge.directed !== undefined) params.set('edgeDirected', String(query.edge.directed));
    params.set('source', query.edge.source);
    params.set('target', query.edge.target);
  }
  if (query.scope) params.set('scope', query.scope.join(','));
  if (query.focus) params.set('focus', query.focus.join(','));
  if (query.minScore !== undefined) params.set('minScore', String(query.minScore / 100));
  if (query.maxScore !== undefined) params.set('maxScore', String(query.maxScore / 100));
  for (const key of ['bylines', 'gap', 'minGroup', 'sort'] as const) if (query[key]) params.set(key, String(query[key]));
  const response = await fetch(`/api/v1/similarity/evidence?${params}`, { headers: { accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`similarity evidence: ${response.status}`);
  return response.json() as Promise<SimilarityEvidence>;
}

/** Browser-side: per-day totals and per-outlet series for inclusive Taipei dates (at most 366 days). */
export async function fetchDaily(from: string, to: string, threshold: number, signal?: AbortSignal): Promise<SimilarityDaily> {
  const params = new URLSearchParams({ from, to, threshold: String(threshold) });
  const response = await fetch(`/api/v1/similarity/daily?${params}`, { headers: { accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`similarity daily: ${response.status}`);
  return response.json() as Promise<SimilarityDaily>;
}

/** Server-side: stored matches of one article at other outlets. */
export async function fetchArticleSimilarity(id: number, threshold = 0.65): Promise<ArticleSimilarity | null> {
  const response = await fetch(`${API_ORIGIN}/api/v1/articles/${id}/similarity?threshold=${threshold}`, {
    next: { revalidate: 300 },
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  return response.json() as Promise<ArticleSimilarity>;
}
