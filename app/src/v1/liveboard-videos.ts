import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { currentScenes, headlineDice, storyNeed } from './liveboard-scenes.ts';

// The simple liveboard's video lenses (web/src/app/liveboard/), from 有影儀表板
// (youtube.observe.tw): YouTube videos about each of the top events, the
// day's most viewed videos, and the streams live now. The events are this
// site's; 有影 only finds the videos: its public /api/v1/videos lists the
// videos whose title or description holds a tag word for word (no model
// involved), by views, and /api/v1/live/current the live streams it watches.
// A video belongs to an event as an article does: it holds two of the
// event's major tags (all of them when there are fewer); the day's videos and
// the live streams name the top event they belong to, if any. Views and
// viewers are 有影's counts, never mixed with article counts. 有影
// unreachable means no videos (or its last list), not an error.

const YOUTUBE_ORIGIN = (process.env.TAG_YOUTUBE_ORIGIN ?? 'https://youtube.observe.tw').replace(/\/+$/, '');
const HOUR = 3600e3;
/** Events looked up: the event lens's frames (EVENT_FRAMES in web/src/app/liveboard/scenes.ts). */
const EVENTS = 6;
/** Most-viewed videos asked for per tag. */
const PER_TAG = 50;
const PER_EVENT = 8;
/** Titles this alike (Dice over character pairs) are one broadcast uploaded by two channels, as reports are folded. */
const SAME_TITLE = 0.7;
/** Videos of one channel in an event's list while other channels' are waiting. */
const CHANNEL_SHARE = 2;
/** The window ends on a ten-minute mark, so a tag's list is fetched again at most every ten minutes. */
const TICK = 10 * 60e3;
/** Live viewer counts move faster: 有影 samples them every few minutes. */
const LIVE_TICK = 2 * 60e3;
/** The day's videos and live streams on their boards. */
const BOARD = 8;
/** Most-viewed videos of the day, and live streams, asked for before folding copies. */
const DAY_POOL = 60;
const LIVE_POOL = 40;
const TIMEOUT_MS = 6000;
/** Requests to 有影 at once (its public limit is 60 a minute per IP, and its database answers 503 under bursts). */
const PARALLEL = 2;
const CACHE_MS = 60e3;

export interface SceneVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  channel: string;
  /** The channel's YouTube page, so the name can be opened (null when 有影 sends no channel id). */
  channelUrl: string | null;
  publishedAt: string;
  /** Cumulative views as 有影 last saw them (null when it has none). */
  views: number | null;
  /** The event's major tags the video holds (on the day's and live boards, those of its event). */
  matched: string[];
  /** On the day's and live boards: the top event it belongs to, if any. */
  event?: { href: string | null; major: string[] } | null;
  /** A live stream: viewers now, today's peak, when it started, and viewers over its last samples, oldest first. */
  live?: { viewers: number; peak: number | null; startedAt: string | null; trend: number[] };
}
export interface EventVideos {
  /** The event's thread page, or its major tags when it has none (as the scenes send them). */
  href: string | null;
  major: string[];
  videos: SceneVideo[];
}
export interface LiveVideos {
  generatedAt: string;
  source: string;
  window: { since: string; until: string };
  /** Some list could not be fetched (nor stood in for), so something may be missing. */
  partial: boolean;
  events: EventVideos[];
  /** The most viewed videos published in the window, and the streams live now, most viewers first. */
  day: SceneVideo[];
  live: SceneVideo[];
}

/** A video as 有影's /api/v1/videos lists it (the fields used here). */
export interface YoutubeVideo {
  id: string;
  title: string;
  description?: string | null;
  channelTitle?: string | null;
  youtubeChannelId?: string | null;
  thumbnail?: string | null;
  publishedAt: string;
  views?: number | null;
  youtubeUrl?: string | null;
  keywordEvidence?: Array<{ term: string }>;
}
/** A stream as 有影's /api/v1/live/current lists it. */
export interface YoutubeLive extends YoutubeVideo {
  currentViewers?: number | null;
  todayPeak?: number | null;
  startedAt?: string | null;
  trend?: Array<{ time: string; value: number }> | null;
}

const fold = (s: string) => s.toLowerCase();

const textOf = (video: YoutubeVideo) => fold(`${video.title}\n${video.description ?? ''}`);
const sceneVideo = (video: YoutubeVideo, matched: string[]): SceneVideo => ({
  id: video.id,
  title: video.title,
  url: video.youtubeUrl ?? `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
  thumbnail: video.thumbnail ?? null,
  channel: video.channelTitle ?? '',
  channelUrl: video.youtubeChannelId ? `https://www.youtube.com/channel/${encodeURIComponent(video.youtubeChannelId)}` : null,
  publishedAt: video.publishedAt,
  views: video.views ?? null,
  matched,
});

/**
 * The first `limit` of a ranked list for the screen: one upload of each
 * broadcast (the better placed); as with reports, every channel gets one
 * before any gets a second, and none more than CHANNEL_SHARE while others
 * wait. The rank order is kept.
 */
export function pickDistinct<T extends { video: YoutubeVideo }>(ranked: readonly T[], limit: number): T[] {
  const kept: T[] = [];
  for (const v of ranked) if (!kept.some((k) => headlineDice(k.video.title, v.video.title) >= SAME_TITLE)) kept.push(v);
  const count = new Map<string, number>();
  const tier = kept.map((v) => {
    const channel = v.video.channelTitle ?? '';
    const n = (count.get(channel) ?? 0) + 1;
    count.set(channel, n);
    return n === 1 ? 0 : n <= CHANNEL_SHARE ? 1 : 2;
  });
  const chosen = new Set(
    kept
      .map((_, i) => i)
      .sort((a, b) => tier[a] - tier[b] || a - b)
      .slice(0, limit),
  );
  return kept.filter((_, i) => chosen.has(i));
}

/**
 * An event's videos from each of its major tags' lists: those holding enough
 * of its major tags (found in one tag's list, or naming the tag in the title
 * or description), the most tags first, then the most viewed (pickDistinct).
 */
export function matchVideos(
  major: readonly string[],
  lists: ReadonlyMap<string, readonly YoutubeVideo[]>,
  limit = PER_EVENT,
): SceneVideo[] {
  const found = new Map<string, { video: YoutubeVideo; tags: Set<string> }>();
  for (const tag of major)
    for (const video of lists.get(fold(tag)) ?? []) {
      const entry = found.get(video.id) ?? found.set(video.id, { video, tags: new Set() }).get(video.id);
      entry?.tags.add(tag);
    }
  const need = storyNeed(major);
  const ranked = [...found.values()]
    .map(({ video, tags }) => {
      const text = textOf(video);
      for (const tag of major) if (text.includes(fold(tag))) tags.add(tag);
      return { video, matched: major.filter((tag) => tags.has(tag)) };
    })
    .filter((v) => v.matched.length >= need)
    .sort(
      (a, b) =>
        b.matched.length - a.matched.length || (b.video.views ?? -1) - (a.video.views ?? -1) || a.video.id.localeCompare(b.video.id),
    );
  return pickDistinct(ranked, limit).map(({ video, matched }) => sceneVideo(video, matched));
}

/** The first of the events (in rank order) whose major tags the video holds, as matchVideos counts them. */
export function eventOf(
  video: YoutubeVideo,
  events: ReadonlyArray<{ href: string | null; major: string[] }>,
): { event: { href: string | null; major: string[] }; matched: string[] } | null {
  const text = textOf(video);
  for (const e of events) {
    const matched = e.major.filter((tag) => text.includes(fold(tag)));
    if (e.major.length && matched.length >= storyNeed(e.major)) return { event: { href: e.href, major: e.major }, matched };
  }
  return null;
}

/** A board of the day's videos or of live streams, ranked already: copies folded, each with its event. */
export function boardOf<V extends YoutubeVideo>(
  ranked: readonly V[],
  events: ReadonlyArray<{ href: string | null; major: string[] }>,
  extra: (video: V) => Partial<SceneVideo> = () => ({}),
  limit = BOARD,
): SceneVideo[] {
  return pickDistinct(
    ranked.map((video) => ({ video })),
    limit,
  ).map(({ video }) => {
    const hit = eventOf(video, events);
    return { ...sceneVideo(video, hit?.matched ?? []), event: hit?.event ?? null, ...extra(video) };
  });
}

/** Streams live now, most viewers first (none without a viewer count). */
export function liveRanked(rows: readonly YoutubeLive[]): YoutubeLive[] {
  return rows
    .filter((r) => (r.currentViewers ?? 0) > 0)
    .sort((a, b) => (b.currentViewers ?? 0) - (a.currentViewers ?? 0) || a.id.localeCompare(b.id));
}
const liveOf = (r: YoutubeLive): Partial<SceneVideo> => ({
  live: {
    viewers: r.currentViewers ?? 0,
    peak: r.todayPeak ?? null,
    startedAt: r.startedAt ?? null,
    trend: (r.trend ?? []).map((p) => p.value),
  },
});

/** 有影's lists by request, each kept for its tick; older ticks are dropped as new ones come. */
const lists = new Map<string, { tick: number; value: Promise<unknown[] | null> }>();
/** Each request's last list that came, standing in while 有影 fails (a few minutes old beats none). */
const lastGood = new Map<string, unknown[]>();
/** A list from 有影 for this tick, else the last good one; null when there has never been one. */
async function youtubeList<T>(
  path: string,
  params: Record<string, string>,
  tick: number,
  key = `${path}?${new URLSearchParams(params)}`,
): Promise<T[] | null> {
  let hit = lists.get(key);
  if (!hit || hit.tick !== tick) {
    for (const [k, v] of lists) if (v.tick < tick - 24 * HOUR) lists.delete(k);
    const url = new URL(path, YOUTUBE_ORIGIN);
    url.search = new URLSearchParams(params).toString();
    const value = fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { data?: { rows?: unknown[] } };
        return Array.isArray(body.data?.rows) ? body.data.rows : null;
      })
      .catch(() => null);
    hit = { tick, value };
    lists.set(key, hit);
    const mine = hit;
    // A failed list is asked for again next time.
    value.then((rows) => {
      if (!rows && lists.get(key) === mine) lists.delete(key);
    });
  }
  const rows = await hit.value;
  if (rows) {
    lastGood.set(key, rows);
    if (lastGood.size > 200) lastGood.delete(lastGood.keys().next().value as string);
  }
  return (rows ?? lastGood.get(key) ?? null) as T[] | null;
}
/** The videos holding a tag, published in the window, most viewed first. */
const tagVideos = (tag: string, since: number, until: number) =>
  youtubeList<YoutubeVideo>(
    '/api/v1/videos',
    {
      keyword: tag,
      since: new Date(since).toISOString(),
      until: new Date(until).toISOString(),
      column: 'viewCount',
      limit: String(PER_TAG),
    },
    until,
    `tag:${fold(tag)}`,
  );

async function inTurns<T, R>(items: readonly T[], n: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await run(items[i]);
      }
    }),
  );
  return out;
}

export async function loadVideos(db: Db, now = Date.now()): Promise<LiveVideos> {
  const scenes = await currentScenes(db);
  const events = scenes.events.slice(0, EVENTS);
  const until = Math.floor(now / TICK) * TICK;
  const since = until - 24 * HOUR;
  const tags = [...new Map(events.flatMap((e) => e.major).map((tag) => [fold(tag), tag])).values()];
  const [got, day, live] = await Promise.all([
    inTurns(tags, PARALLEL, (tag) => tagVideos(tag, since, until)),
    youtubeList<YoutubeVideo>(
      '/api/v1/videos',
      { since: new Date(since).toISOString(), until: new Date(until).toISOString(), column: 'viewCount', limit: String(DAY_POOL) },
      until,
      'day',
    ),
    youtubeList<YoutubeLive>('/api/v1/live/current', { limit: String(LIVE_POOL) }, Math.floor(now / LIVE_TICK) * LIVE_TICK, 'live'),
  ]);
  const byTag = new Map<string, YoutubeVideo[]>();
  for (const [i, tag] of tags.entries()) byTag.set(fold(tag), got[i] ?? []);
  return {
    generatedAt: new Date(now).toISOString(),
    source: YOUTUBE_ORIGIN,
    window: { since: new Date(since).toISOString(), until: new Date(until).toISOString() },
    partial: got.some((rows) => !rows) || !day || !live,
    events: events.map((e) => ({ href: e.href, major: e.major, videos: matchVideos(e.major, byTag) })),
    day: boardOf(day ?? [], events),
    live: boardOf(liveRanked(live ?? []), events, liveOf),
  };
}

let cache: { at: number; value: Promise<LiveVideos> } | null = null;
export function registerLiveboardVideos(app: FastifyInstance, db: Db) {
  app.get('/api/v1/liveboard/videos', async (_request, reply) => {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      const value = loadVideos(db);
      cache = { at: Date.now(), value };
      value.catch(() => {
        cache = null;
      });
    }
    reply.header('cache-control', 'public, max-age=60');
    return cache.value;
  });
}
