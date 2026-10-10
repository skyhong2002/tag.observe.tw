import type { TagFlow } from './tag-flow-history.mts';

export type { TagFlow } from './tag-flow-history.mts';

export const API_ORIGIN = process.env.TAG_API_ORIGIN ?? 'http://127.0.0.1:18130';

export interface Category {
  key: string;
  label: string;
  media: number;
  /** Member outlets; labels are edited by admins at /admin/media/. */
  members: string[];
  /** Has a frozen ranking roster, so /ranking/ can show it. */
  ranked: boolean;
}
export interface RankingBasis {
  id: string;
  media: string[];
  coverageFrom: string;
  validFrom: string;
}
export type RankingOrder = 'burst' | 'score' | 'growth';
export type RankingGate = 'all' | 'early' | 'broad';
export interface DiscoverySignals {
  growth: number | null;
  early: boolean;
  broad: boolean;
  earlyJump: boolean | null;
  broadJump: boolean | null;
}
export interface FirstCollection {
  at: string;
  firstPublishedAt: string;
  recent: boolean;
}
export interface DraftEvidence {
  articles: number;
  analyzed: number;
  similarArticles: number;
  groups: number;
  threshold: number;
}
export interface RankingEntry {
  rank: number;
  position: number;
  tag: string;
  score: number;
  count: number;
  media: Record<string, number>;
  normalized: number;
  burst: number | null;
  history: Record<string, number | null>;
  rank24h: number | null;
  new: boolean;
  signals?: DiscoverySignals;
  firstCollection?: FirstCollection | null;
  drafts?: DraftEvidence;
  trend?: Array<{ t: string; hourlyCount: number | null; average24h: number | null }>;
  related?: Array<{ tag: string; count: number; share: number }>;
  /** Burst position per snapshot hour, oldest first (ranks=1). */
  rankTrail?: Array<{ t: string; position: number | null }>;
}
export interface Ranking {
  snapshot: {
    id: number;
    category: string;
    hourStart: string;
    computedAt: string;
    weight: number;
    articleCount: number | null;
    mediaCount: number | null;
    basis: RankingBasis;
    available: boolean;
    historyAvailable: number[];
  };
  order: RankingOrder;
  gate?: RankingGate;
  matchedCount?: number;
  unknownGrowthCount?: number;
  entries: RankingEntry[];
}
export interface Article {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  tags: string[];
}
export type { SeriesPoint, TagSeries } from './tag-series-history.mts';
export type Camp = 'blue' | 'green' | 'other';
export type MediaInfo = Record<string, { title: string | null; icon: string | null; camp?: Camp }>;
export interface TagStatus {
  tag: string;
  ranking: {
    category: string;
    hourStart: string;
    position: number;
    rank: number;
    normalized: number;
    burst: number | null;
    count: number;
    mediaCount: number;
    basisMediaCount: number;
    rank24h: number | null;
    new: boolean;
    signals?: DiscoverySignals;
  } | null;
  related: Array<{ tag: string; count: number; share: number }>;
  threads: Array<{
    id: number;
    maxTag: string | null;
    majorTags: string[];
    firstTime: string;
    lastTime: string;
    hours: number;
    maxScore: number;
  }>;
  history: { level: number; firstHour: string; lastHour: string; hoursCount: number; maxHour: string; maxCount: number } | null;
  firstCollection?: FirstCollection | null;
  drafts?: DraftEvidence | null;
}

async function get<T>(path: string, revalidate = 60): Promise<T> {
  // Recover from a transient cached response or transport failure within the
  // same server render, rather than leaving the page with a frozen placeholder.
  try {
    const res = await fetch(API_ORIGIN + path, {
      next: { revalidate },
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) return (await res.json()) as T;
  } catch {
    // The fresh attempt below also covers network errors and invalid JSON.
  }
  const res = await fetch(API_ORIGIN + path, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}
// Ten minutes, so label edits at /admin/media/ show up soon.
export const fetchCategories = () => get<Category[]>('/api/v1/categories', 600);
export const fetchMedia = () => get<MediaInfo>('/api/v1/media', 600);
export const fetchRanking = (
  category: string,
  order: RankingOrder,
  limit = 50,
  trend = false,
  related = false,
  options: { gate?: RankingGate; signals?: boolean; ranks?: boolean } | boolean = {},
) => {
  const params = typeof options === 'boolean' ? { ranks: options } : options;
  return get<Ranking>(
    `/api/v1/ranking?category=${encodeURIComponent(category)}&order=${order}&limit=${limit}${trend ? '&trend=1' : ''}${related ? '&related=1' : ''}${params.gate ? `&gate=${params.gate}` : ''}${params.signals ? '&signals=1' : ''}${params.ranks ? '&ranks=1' : ''}`,
  );
};
export const fetchTagArticles = (tag: string, hours = 48) =>
  get<{ tag: string; articles: Article[] }>(`/api/v1/tags/${encodeURIComponent(tag)}/articles?hours=${hours}&limit=80`);
export const fetchTagStatus = (tag: string) => get<TagStatus>(`/api/v1/tags/${encodeURIComponent(tag)}/status`);
export const fetchTagSeries = (tag: string, category = 'all', hours = 72) =>
  get<import('./tag-series-history.mts').TagSeries>(
    `/api/v1/tags/${encodeURIComponent(tag)}/series?category=${encodeURIComponent(category)}&hours=${hours}`,
    300,
  );

/** Per hour, the other keywords on the reports tagged `tag` ([tag, reports]). */
export const fetchTagFlow = (tag: string, hours = 336, span: 'day' | 'hour' = 'hour') =>
  get<TagFlow>(`/api/v1/tags/${encodeURIComponent(tag)}/flow?hours=${hours}&span=${span}`, 300);

export const taipei = (iso: string) =>
  new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour12: false,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
// Without minutes, zh-TW renders the hour as "18時"; format with minutes instead.
export const taipeiHour = (iso: string) => taipei(iso).replace(/:\d\d$/, ':00');
