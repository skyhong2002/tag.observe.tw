import { API_ORIGIN } from './api';
export interface EventNews {
  id: number | null;
  media: string;
  camp?: Camp;
  title: string;
  url: string;
  image: string | null;
}
export type Camp = 'blue' | 'green' | 'other';
export interface EventCoverage {
  /** Outlets that wrote about the event's major tags in the past 24h, busiest first. */
  outlets: Array<{ media: string; camp: Camp }>;
  articles: number;
  camps: Record<Camp, number>;
  /** Blue/green split of the outlets on the story, 其他 excluded. */
  share: { blue: number; green: number } | null;
  /** log2 of the blue:green outlet ratio against the day's baseline; 0 is usual. */
  lean: number | null;
  /** Camp writing noticeably more than usual. */
  tilt: Camp | null;
  /** Camp that barely reported a story the other camp is on: its readers miss it. */
  blindspot: Camp[];
}
export interface CampBaseline {
  outlets: Record<Camp, number>;
  articles: Record<Camp, number>;
}
export interface EventItem {
  rank: number;
  score: number;
  major: string[];
  tags: { tag: string; burst: number | null }[];
  news: EventNews[];
  relatedEventPk: string | null;
  /** Rank in the previous snapshot; null when the thread is new this hour. */
  prevRank?: number | null;
  /** Hours the thread has been on the table so far. */
  hours?: number | null;
  /** Rank in each of the last 24 snapshot hours (oldest first); null = off the table. */
  rankTrail?: Array<number | null> | null;
  firstTime?: string | null;
  coverage?: EventCoverage;
}
export interface Topic {
  id: string;
  time: string | null;
  /** Already listed when tracking began: `time` is not when it started. */
  backlog?: boolean;
  title: string | null;
  url: string | null;
  image: string | null;
  /** 議題 keeps getting stories; 專題 is a one-off package. Absent on old API builds. */
  kind?: TopicKind;
  /** 'ended': a 議題 with no new story for 90 days (已停更). */
  status?: 'active' | 'ended';
  /** Marked by the outlet as advertising or a brand partnership. */
  sponsored?: boolean;
  parentId?: number | null;
  /** Earliest story listed on the topic page. */
  storyFirstAt?: string | null;
  storyLastAt?: string | null;
  /** 最後更新: storyLastAt, else `time` unless backlog; null = unknown. Absent on old API builds (see updatedAtOf). */
  updatedAt?: string | null;
  storyCount?: number | null;
  /** Site tags found in the name itself (whether or not anything was published on it lately). */
  tags?: string[];
  /** Child topics, listed under their parent on the per-media page. */
  children?: Topic[];
}
export type TopicKind = 'topic' | 'feature';
export interface TopicCounts {
  topic: number;
  feature: number;
}
/** Old API builds send no kind: everything there is a 議題. */
export const ofKind = (t: Pick<Topic, 'kind'>, kind: TopicKind) => (t.kind ?? 'topic') === kind;
/** Per-kind count for an outlet; the all-time total only stands in for 議題 on old builds. */
export const kindCount = (m: Pick<TopicMedia, 'count' | 'counts'>, kind: TopicKind) =>
  m.counts ? m.counts[kind] : kind === 'topic' ? m.count : undefined;

export interface TopicCheck {
  checkedAt: string | null;
  lastSuccessAt: string | null;
  status: string;
  fetched: number;
  stale: boolean;
}
export interface TopicMedia {
  check?: TopicCheck;
  media: string;
  title: string;
  icon: string | null;
  link: string;
  /** Topics listed by the outlet so far (all time). */
  count?: number;
  counts?: TopicCounts;
  latest: Topic | null;
  recent?: Topic[];
}
export interface TopicCoverage {
  tags: string[];
  count: number;
  capped: boolean;
  mediaCount: number;
  latest: Array<{ id?: number; media: string; mediaTitle: string; title: string; url: string; time: string }>;
}
export interface FeedTopic extends Topic {
  media: string;
  mediaTitle: string;
  icon: string | null;
  /** The outlet's own share image, for topics without a cover. */
  mediaImage?: string;
  /** Recent articles from all crawled outlets carrying the topic's tags. */
  coverage?: TopicCoverage | null;
}
async function get<T>(path: string, revalidate: number): Promise<T | null> {
  // null on any failure (API down during a build, 503 before the first snapshot).
  try {
    let res = await fetch(API_ORIGIN + path, { next: { revalidate } });
    // A 502/503 caught while the API restarts (every deploy) would otherwise be
    // served from the data cache for the whole revalidate window.
    if (!res.ok) res = await fetch(API_ORIGIN + path, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
export interface EventsSnapshot {
  hour: string;
  builtAt: string | null;
  stale?: boolean;
  /** Neighbouring snapshot hours, for browsing the archive. */
  prev?: string | null;
  next?: string | null;
  dayHours?: string[];
  /** Top score and event count per snapshot hour of the day. */
  dayStats?: Array<{ hour: string; top: number; count: number }>;
  /** The day's camp split, the reference for each event's lean. */
  baseline?: CampBaseline;
  events: EventItem[];
}
export const fetchEvents = (limit = 30, at?: string) =>
  get<EventsSnapshot>(`/api/v1/events?limit=${limit}${at ? `&at=${encodeURIComponent(at)}` : ''}`, 120);
export interface ArchivedThread {
  id: number;
  firstTime: string;
  lastTime: string;
  hours: number;
  majorTags: string[];
  maxTag: string | null;
  maxScore: number;
  bestRank: number | null;
  /** Rank over the 24 snapshot hours ending at `trailEnd`; null = off the table. */
  rankTrail?: Array<number | null> | null;
  /** The thread's last hour on the table that day. */
  trailEnd?: string | null;
  /** Outlets on the story over the day (the last 24h, for today). */
  coverage?: EventCoverage;
  news: EventNews[];
}
export interface EventDay {
  day: string;
  days: string[];
  dayHours?: string[];
  dayStats?: Array<{ hour: string; top: number; count: number }>;
  baseline?: CampBaseline;
  threads: ArchivedThread[];
}
export const fetchEventDay = (day?: string) => get<EventDay>(`/api/v1/events/threads${day ? `?day=${encodeURIComponent(day)}` : ''}`, 300);
/** Counts for a keyword within the requested kind. The other kind is zero. */
export interface TopicTagCount {
  tag: string;
  media: number;
  topic: number;
  feature: number;
}
export const fetchTopics = (limit = 120, kind: TopicKind = 'topic') =>
  get<{ media: TopicMedia[]; feed?: FeedTopic[]; tags?: TopicTagCount[] }>(`/api/v1/topics?limit=${limit}&kind=${kind}`, 300);
export interface TopicSearch {
  kind: TopicKind;
  tag: string | null;
  q: string | null;
  total: number;
  mediaCount: number;
  counts: TopicCounts;
  /** Requested kind, grouped by outlet. */
  topics: FeedTopic[];
  tags: TopicTagCount[];
}
/** Requested kind across outlets carrying a tag and/or with `q` in the name. */
export const fetchTopicSearch = ({ tag, q, kind }: { tag?: string; q?: string; kind: TopicKind }) => {
  const p = new URLSearchParams({ kind });
  if (tag) p.set('tag', tag);
  if (q) p.set('q', q);
  return get<TopicSearch>(`/api/v1/topics?${p}`, 300);
};
export interface TopicMediaPage {
  media: string;
  title: string;
  link: string;
  mediaImage?: string;
  check?: TopicCheck;
  count?: number;
  counts?: TopicCounts;
  topics: MediaTopic[];
}
export type MediaTopic = Topic & { coverage?: TopicCoverage | null; children?: MediaTopic[] };
export const fetchTopicMedia = (media: string, limit = 30, kind: TopicKind = 'topic') =>
  get<TopicMediaPage>(`/api/v1/topics?media=${encodeURIComponent(media)}&limit=${limit}&kind=${kind}`, 300);
