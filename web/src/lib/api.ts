import type { TagFlow } from './tag-flow-history.mts';

export type { TagFlow } from './tag-flow-history.mts';

export const API_ORIGIN = process.env.TAG_API_ORIGIN ?? 'http://127.0.0.1:18130';

export interface Category {
  key: string;
  label: string;
  media: number;
  /** Member outlets of the analysis group (media-categories.ts). */
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
/** A keyword's whole archive: first article ever and busiest Taipei day (archive=1). */
export interface TagArchive {
  firstAt: string;
  /** Null until the keyword's days have been counted. */
  peakDay: string | null;
  peakCount: number | null;
  computedAt: string | null;
}
/** A keyword first seen recently (/api/v1/keywords/new). */
export interface NewKeyword {
  tag: string;
  firstAt: string;
  lastAt: string | null;
  articleCount: number;
  peakDay: string | null;
  peakCount: number | null;
  /** Articles per outlet, busiest first (media=1). */
  media?: Record<string, number>;
}
export type NewKeywordSort = 'first' | 'count' | 'peak' | 'last';
export const fetchNewKeywords = (days: number, min: number, sort: NewKeywordSort, dir: 'asc' | 'desc', limit: number, media = false) =>
  get<{ days: number; minArticles: number; total: number; keywords: NewKeyword[] }>(
    `/api/v1/keywords/new?days=${days}&min=${min}&sort=${sort}&dir=${dir}&limit=${limit}${media ? '&media=1' : ''}`,
  );
/** The category's hourly chart record, kept since 2026-09-28 (archive=1). */
export interface TagChartHistory {
  firstHour: string;
  maxHour: string;
  maxCount: number;
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
  archive?: TagArchive | null;
  charted?: TagChartHistory | null;
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
  archive?: TagArchive | null;
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
  options:
    | { gate?: RankingGate; signals?: boolean; ranks?: boolean; archive?: boolean; sort?: 'first' | 'peak'; dir?: 'asc' | 'desc' }
    | boolean = {},
) => {
  const params = typeof options === 'boolean' ? { ranks: options } : options;
  return get<Ranking>(
    `/api/v1/ranking?category=${encodeURIComponent(category)}&order=${order}&limit=${limit}${trend ? '&trend=1' : ''}${related ? '&related=1' : ''}${params.gate ? `&gate=${params.gate}` : ''}${params.signals ? '&signals=1' : ''}${params.ranks ? '&ranks=1' : ''}${params.archive ? '&archive=1' : ''}${params.sort ? `&sort=${params.sort}&dir=${params.dir ?? 'desc'}` : ''}`,
  );
};
export const fetchTagArticles = (tag: string, hours = 48) =>
  get<{ tag: string; articles: Article[] }>(`/api/v1/tags/${encodeURIComponent(tag)}/articles?hours=${hours}&limit=80`);
export const fetchTagStatus = (tag: string) => get<TagStatus>(`/api/v1/tags/${encodeURIComponent(tag)}/status`);

/** The Wikidata person a tag names, with the sketch avatar (docs/tag-avatars.md). */
export interface TagPerson {
  wikidataId: string;
  label: string | null;
  description: string | null;
  facts: {
    citizenship: string[];
    occupations: string[];
    parties: string[];
    positions: { label: string; current: boolean }[];
  } | null;
  avatar: {
    url: string;
    file: string;
    pageUrl: string;
    license: string | null;
    licenseUrl: string | null;
    artist: string | null;
  } | null;
}
/** Every tag with a shown sketch avatar → its URL. */
export const fetchTagAvatars = () => get<{ avatars: Record<string, string> }>('/api/v1/tag-avatars', 300).then((r) => r.avatars);
export const fetchTagPerson = (tag: string) =>
  get<{ tag: string; person: TagPerson | null }>(`/api/v1/tags/${encodeURIComponent(tag)}/person`, 300).then((r) => r.person);
/** The picture of a non-person tag (docs/tag-visuals.md). */
export interface TagVisual {
  kind: 'place' | 'flag' | 'logo' | 'emoji';
  emoji: string | null;
  label: string | null;
  wikidataId: string | null;
  /** Outline or logo (SVG or WebP). */
  image: string | null;
  /** Places: where the place is. */
  large: string | null;
  /** Logos: the Commons file and its terms. */
  source: { pageUrl: string; license: string | null; licenseUrl: string | null; artist: string | null } | null;
}
/** Every shown non-person picture, as the home cloud draws it: an image URL or an emoji. */
export const fetchTagVisuals = () =>
  get<{ visuals: Record<string, { kind: TagVisual['kind']; image: string | null; emoji: string | null; aspect?: number }> }>(
    '/api/v1/tag-visuals',
    300,
  ).then((r) => r.visuals);
export const fetchTagVisual = (tag: string) =>
  get<{ tag: string; visual: TagVisual | null }>(`/api/v1/tags/${encodeURIComponent(tag)}/visual`, 300).then((r) => r.visual);
/** Groups and topics a tag is filed under (docs/tag-groups.md). */
export interface GroupRef {
  id: number;
  label: string;
  kind: 'group' | 'topic';
}
/** `source` is 'parent' for a group shown only because a subgroup holds the tag. */
export interface TagGroupRef extends GroupRef {
  parentId: number | null;
  source: string;
}
export const fetchTagGroups = (tag: string) =>
  get<{ tag: string; groups: TagGroupRef[] }>(`/api/v1/tags/${encodeURIComponent(tag)}/groups`, 300).then((r) => r.groups);
export const fetchTagGroupList = () =>
  get<{ groups: Array<GroupRef & { parentId: number | null; tags: number }> }>('/api/v1/tag-groups', 300).then((r) => r.groups);
export interface TagGroupSummary extends GroupRef {
  parentId: number | null;
  /** Tags in the group and its subgroups. */
  tags: number;
  /** Of those, tags past the news ranking's first bar this period, and their reports summed. */
  active: number;
  recent: number;
  previous: number;
  top: Array<{ tag: string; recent: number; previous: number }>;
}
export const fetchTagGroupOverview = (days: number) =>
  get<{ days: number; groups: TagGroupSummary[] }>(`/api/v1/tag-groups/overview?days=${days}`, 300).then((r) => r.groups);
export interface TagGroupRanking extends GroupRef {
  parents: GroupRef[];
  children: GroupRef[];
  subgroups: GroupRef[];
  days: number;
  tags: number;
  ranking: Array<{ tag: string; recent: number; previous: number; groups: number[] }>;
}
export const fetchTagGroupRanking = (id: number, days: number) =>
  get<TagGroupRanking>(`/api/v1/tag-groups/${id}/ranking?days=${days}`, 300);
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
/** Taipei calendar date with the year, YYYY-MM-DD. */
export const taipeiDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
/** Taipei time of day, HH:MM. */
export const taipeiClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' });
