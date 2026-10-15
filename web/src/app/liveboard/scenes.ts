// What /api/v1/liveboard/scenes sends the simple board's event and topic
// lenses (app/src/v1/liveboard-scenes.ts), and how the screen words it.

import { cleanEventHeadline, clipHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import type { LiveboardSettings } from './settings';

export interface SceneCounts {
  /** Articles published today (Asia/Taipei)… */
  today: number;
  /** …collected in the last hour… */
  hour: number;
  /** …and in the hour before it. */
  previous: number;
  /** Collected in each of the last 12 hours, oldest first. */
  hours: number[];
}
export interface SceneNews {
  title: string;
  media: string;
  image: string | null;
}
export interface SceneArticle {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  /** Collected in the last hour (else earlier today). */
  recent: boolean;
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
  counts: SceneCounts;
}
export interface LiveScenes {
  generatedAt: string;
  windows: { today: string; hour: string; previous: string };
  eventHour: string | null;
  events: SceneEvent[];
  boards: { media: SceneRow[]; threads: SceneRow[]; categories: SceneRow[]; groups: SceneRow[] };
}

/** Events the event lens steps through, one a frame. */
export const EVENT_FRAMES = 6;

/** A story's lead headline from its stored best ones, or its major tags. */
export function storyHeadline(news: readonly SceneNews[] | undefined, major: readonly string[] | undefined): string {
  const lead = selectEventLead(news ?? [], major ?? []);
  return lead ? clipHeadline(cleanEventHeadline(lead.title)) : (major ?? []).join('、');
}

/** A change as the screen says it: +3 / −2 / ±0. */
export const signed = (n: number, digits = 0) => {
  const text = Math.abs(n).toFixed(digits);
  return Number(text) === 0 ? '±0' : `${n > 0 ? '+' : '−'}${text}`;
};

/** How long a frame stays once it has faded in: a keyword cloud's past hour `step` and its present `hold`;
 *  an event `hold`, since its articles are read; a leaderboard half as long again, for its ten rows. */
export function stayOf(scene: 'cloud' | 'events' | 'board', last: boolean, s: Pick<LiveboardSettings, 'step' | 'hold'>) {
  if (scene === 'board') return Math.round(s.hold * 1.5);
  if (scene === 'events') return s.hold;
  return last ? s.hold : s.step;
}

/** hh:mm in Taipei. */
export const clock = (iso: string) =>
  new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
