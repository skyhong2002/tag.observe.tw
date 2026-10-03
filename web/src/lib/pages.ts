import { API_ORIGIN } from './api';
export interface EventNews {
  id: number | null;
  media: string;
  title: string;
  url: string;
  image: string | null;
}
export interface EventItem {
  rank: number;
  score: number;
  major: string[];
  tags: { tag: string; burst: number | null }[];
  news: EventNews[];
  relatedEventPk: string | null;
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
export interface TopicMedia {
  media: string;
  title: string;
  icon: string | null;
  link: string;
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
export const fetchTopics = () => get<{ media: TopicMedia[]; feed?: FeedTopic[] }>('/api/v1/topics?limit=60', 300);
export const fetchTopicMedia = (media: string, limit = 30) =>
  get<{ media: string; title: string; link: string; mediaImage?: string; topics: Topic[] }>(
    `/api/v1/topics?media=${media}&limit=${limit}`,
    300,
  );
