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
}
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
    const res = await fetch(API_ORIGIN + path, { next: { revalidate } });
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
  news: Array<{ title: string; url: string; image: string | null; media: string }>;
}
export const fetchEventDay = (day?: string) =>
  get<{ day: string; days: string[]; threads: ArchivedThread[] }>(
    `/api/v1/events/threads${day ? `?day=${encodeURIComponent(day)}` : ''}`,
    300,
  );
export const fetchTopics = (limit = 120) => get<{ media: TopicMedia[]; feed?: FeedTopic[] }>(`/api/v1/topics?limit=${limit}`, 300);
export interface TopicMediaPage {
  media: string;
  title: string;
  link: string;
  mediaImage?: string;
  check?: TopicCheck;
  count?: number;
  topics: Array<Topic & { coverage?: TopicCoverage | null }>;
}
export const fetchTopicMedia = (media: string, limit = 30) =>
  get<TopicMediaPage>(`/api/v1/topics?media=${encodeURIComponent(media)}&limit=${limit}`, 300);
