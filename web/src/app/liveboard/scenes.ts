// What /api/v1/liveboard/scenes sends the simple board's event and topic
// lenses (app/src/v1/liveboard-scenes.ts), and how the screen words it.

import { cleanEventHeadline, clipHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import type { EventCoverage } from '@/lib/pages';
import type { Lens, LiveboardSettings } from './settings';

export interface SceneCounts {
  /** Articles published in the last 24 hours… */
  day: number;
  /** …collected in the last hour… */
  hour: number;
  /** …and in the hour before it. */
  previous: number;
  /** Collected in each of the last 12 hours, oldest first. */
  hours: number[];
}
/** A report as any news row names it: outlet, when, bylines and the outlets it names as source or cites, tags. */
export interface SceneBrief {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  tags: string[];
  authors: string[];
  attributions: Array<{ media: string; name: string; evidence: string }>;
}
export interface SceneNews {
  id: number | null;
  title: string;
  media: string;
  image: string | null;
  brief: SceneBrief | null;
  /** Other outlets that ran it, and the one that probably ran it first. */
  copies: Array<{ media: string; mediaTitle: string }>;
  source: { id: number; media: string; mediaTitle: string; title: string; publishedAt: string } | null;
}
export interface SceneArticle extends SceneBrief {
  /** Collected in the last hour (else earlier in the day). */
  recent: boolean;
  /** Other outlets that ran the same report. */
  copies: Array<{ media: string; mediaTitle: string }>;
}
export interface SceneEvent {
  rank: number;
  prevRank: number | null;
  score: number;
  prevScore: number | null;
  major: string[];
  tags: Array<{ tag: string; burst: number }>;
  news: SceneNews[];
  href: string | null;
  counts: SceneCounts;
  /** When its newest report came in. */
  newest: string | null;
  /** Hours on the table, and rank in each of the last 24 snapshots. */
  hours: number | null;
  rankTrail: Array<number | null> | null;
  coverage: EventCoverage;
  articles: SceneArticle[];
}
export interface SceneRow {
  key: string;
  title: string;
  href: string;
  media: string | null;
  mediaTitle: string | null;
  news?: SceneNews[];
  major?: string[];
  /** A group's busiest tags over the last 24 hours. */
  keywords?: string[];
  /** The newest report of a group or an outlet's topic. */
  latest?: SceneBrief | null;
  counts: SceneCounts;
}
export interface LiveScenes {
  generatedAt: string;
  windows: { day: string; hour: string; previous: string };
  eventHour: string | null;
  events: SceneEvent[];
  boards: { media: SceneRow[]; threads: SceneRow[]; categories: SceneRow[]; groups: SceneRow[] };
}

/** A YouTube video about an event, as /api/v1/liveboard/videos sends it (app/src/v1/liveboard-videos.ts). */
export interface SceneVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  channel: string;
  /** The channel's YouTube page (absent from an API older than this field). */
  channelUrl?: string | null;
  publishedAt: string;
  /** Cumulative views as 有影 last saw them. */
  views: number | null;
  /** The event's major tags it holds (on the day's and live boards, those of its event). */
  matched: string[];
  /** On the day's and live boards: the top event it belongs to, if any. */
  event?: { href: string | null; major: string[] } | null;
  /** A live stream: viewers now, today's peak, when it started, viewers over its last samples. */
  live?: { viewers: number; peak: number | null; startedAt: string | null; trend: number[] };
}
export interface LiveVideos {
  generatedAt: string;
  source: string;
  window: { since: string; until: string };
  partial: boolean;
  events: Array<{ href: string | null; major: string[]; videos: SceneVideo[] }>;
  /** The most viewed videos of the last 24 hours, and the streams live now. */
  day: SceneVideo[];
  live: SceneVideo[];
}
/** Which event a list of videos is for: its thread page, else its major tags. */
export const eventKey = (e: { href: string | null; major: readonly string[] }) => e.href ?? e.major.join('、');

/** Events the event lens steps through, one a frame. */
export const EVENT_FRAMES = 6;

/** The report a story leads with, as the events page picks it (selectEventLead). */
export const storyLead = (news: readonly SceneNews[] | undefined, major: readonly string[] | undefined) =>
  selectEventLead(news ?? [], major ?? []);
/** A story's lead headline from its stored best ones, or its major tags. */
export function storyHeadline(news: readonly SceneNews[] | undefined, major: readonly string[] | undefined): string {
  const lead = storyLead(news, major);
  return lead ? clipHeadline(cleanEventHeadline(lead.title)) : (major ?? []).join('、');
}

/** A change as the screen says it: +3 / −2 / ±0. */
export const signed = (n: number, digits = 0) => {
  const text = Math.abs(n).toFixed(digits);
  return Number(text) === 0 ? '±0' : `${n > 0 ? '+' : '−'}${text}`;
};

/** How long a frame stays once it has faded in: a keyword cloud's past hour `step` and its present `hold`;
 *  an event (with or without its videos) `hold`, since its articles are read; a leaderboard half as long again, for its ten rows. */
export function stayOf(
  scene: 'cloud' | 'compare' | 'events' | 'videos' | 'board',
  last: boolean,
  s: Pick<LiveboardSettings, 'step' | 'hold'>,
) {
  if (scene === 'board') return Math.round(s.hold * 1.5);
  if (scene === 'events' || scene === 'videos') return s.hold;
  return last ? s.hold : s.step;
}

/** The scene a lens plays, for its timing: the day's and live video boards stay as a leaderboard does. */
export const sceneOf = (lens: Lens) => (lens.scene === 'videos' && lens.feed !== 'events' ? 'board' : lens.scene);

/** hh:mm in Taipei. */
export const clock = (iso: string) =>
  new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** How long ago, as a screen says it: 剛剛, 12 分鐘前, 1 小時 5 分前. */
export function since(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60e3));
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} 小時 ${minutes % 60} 分前` : `${hours} 小時前`;
}
