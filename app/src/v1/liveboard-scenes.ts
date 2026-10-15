import { and, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads, tagGroupMembers, topics } from '../db/schema.ts';
import { latestEvents } from '../jobs/events-job.ts';
import { articleMediaOf } from '../jobs/topic-stories.ts';
import { activeGroups, descendants } from '../tag-groups/tree.ts';
import { eventsAt, matchPrev } from './event-feed.ts';
import { taipeiMidnight } from './media-stats.ts';
import { SHOWN } from './tag-groups.ts';

// The simple liveboard's event and topic scenes (web/src/app/liveboard/):
// the top events with their score against the previous hour's snapshot and
// the articles that joined them in the last hour, and leaderboards of the
// day's topics, each with its articles today, in the last hour and in the
// hour before. Topics are an outlet's own 議題／專題 pages, the cross-outlet
// event threads, and the tag groups (categories, and groups of people and
// parties). Counts are distinct own articles by publish time; an article
// joins an event or thread when it carries two of its major tags, and a
// group when it carries any of its tags. Today counts by publish time; the
// two hours count by when the articles were collected, since many land well
// after they were published and a last hour by publish time is never whole.
// An outlet's topic page is re-read every few hours, so its last-hour count
// lags.

const mediaInfo = catalog as unknown as Record<string, { title: string | null }>;
const HOUR = 3600e3;
/** Articles collected in the last two hours were published at most this long before (a few stragglers aside). */
const LATE = 8 * HOUR;
const EVENTS = 10;
const EVENT_ARTICLES = 5;
const BOARD = 10;
const CACHE_MS = 60e3;

export interface SceneCounts {
  today: number;
  /** In the hour up to now… */
  hour: number;
  /** …and the hour before it. */
  previous: number;
}
export interface SceneArticle {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  publishedAt: string;
}
export interface SceneNews {
  title: string;
  media: string;
}
export interface SceneEvent {
  rank: number;
  /** null when the story was not on the previous snapshot. */
  prevRank: number | null;
  score: number;
  prevScore: number | null;
  major: string[];
  /** Its stored best headlines, which the screen picks the lead from. */
  news: SceneNews[];
  href: string | null;
  counts: SceneCounts;
  /** The articles collected in the last hour, the latest published first. */
  articles: SceneArticle[];
}
export interface SceneRow {
  key: string;
  title: string;
  href: string;
  /** The outlet, for an outlet's own topic. */
  media: string | null;
  mediaTitle: string | null;
  /** A thread's stored headlines and major tags, for its lead headline. */
  news?: SceneNews[];
  major?: string[];
  counts: SceneCounts;
}
export interface LiveScenes {
  generatedAt: string;
  /** Start of today (Asia/Taipei), of the last hour and of the hour before it. */
  windows: { today: string; hour: string; previous: string };
  /** The event snapshot the events come from. */
  eventHour: string | null;
  events: SceneEvent[];
  boards: { media: SceneRow[]; threads: SceneRow[]; categories: SceneRow[]; groups: SceneRow[] };
}

export interface Windows {
  now: number;
  today: number;
  hour: number;
  previous: number;
}
export function windowsAt(now: number): Windows {
  return { now, today: taipeiMidnight(now).getTime(), hour: now - HOUR, previous: now - 2 * HOUR };
}

/** When an article was published (null while its page has not been read for the date) and collected. */
export interface Seen {
  published: number | null;
  crawled: number;
}
/** Distinct articles published today, and collected in the last hour and in the hour before. */
export function countSeen(seen: Iterable<Seen>, w: Windows): SceneCounts {
  const out = { today: 0, hour: 0, previous: 0 };
  for (const t of seen) {
    if (t.published !== null && t.published >= w.today && t.published <= w.now) out.today++;
    if (t.crawled > w.now) continue;
    if (t.crawled >= w.hour) out.hour++;
    else if (t.crawled >= w.previous) out.previous++;
  }
  return out;
}
const seenOf = (r: { publishedAt: Date; crawledAt: Date; pending: number | string | boolean }): Seen => ({
  published: Number(r.pending) ? null : r.publishedAt.getTime(),
  crawled: r.crawledAt.getTime(),
});

/** Tag matching follows the database's case-insensitive collation. */
const fold = (tag: string) => tag.toLowerCase();

/** The window's own articles by tag: when each was published and collected, and the articles carrying each tag. */
export class TagIndex {
  readonly at = new Map<number, Seen>();
  readonly byTag = new Map<string, number[]>();
  constructor(rows: Iterable<{ id: number; seen: Seen; tag: string }>) {
    for (const r of rows) {
      this.at.set(r.id, r.seen);
      const key = fold(r.tag);
      const list = this.byTag.get(key);
      if (list) list.push(r.id);
      else this.byTag.set(key, [r.id]);
    }
  }
  /** Articles carrying at least `need` of `tags`. */
  carrying(tags: Iterable<string>, need = 1): number[] {
    const hits = new Map<number, number>();
    for (const tag of new Set([...tags].map(fold))) for (const id of this.byTag.get(tag) ?? []) hits.set(id, (hits.get(id) ?? 0) + 1);
    return [...hits].flatMap(([id, n]) => (n >= need ? [id] : []));
  }
  seen(ids: Iterable<number>): Seen[] {
    return [...ids].flatMap((id) => {
      const t = this.at.get(id);
      return t === undefined ? [] : [t];
    });
  }
}
/** An event or thread: two of its major tags (all of them when it has fewer). */
export const storyNeed = (major: readonly string[]) => Math.min(2, major.length);

/** The day's leaderboard: rows with articles today, most first, then the busiest last hour. */
export function rankBoard(rows: SceneRow[], limit = BOARD): SceneRow[] {
  return rows
    .filter((r) => r.counts.today > 0)
    .sort((a, b) => b.counts.today - a.counts.today || b.counts.hour - a.counts.hour || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Its publish time is a placeholder until its page is read. */
const pending = sql<number>`(${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt})`;
/** Own articles published today, or late enough to have been collected in the last two hours. */
const inWindow = (w: Windows) =>
  and(
    eq(articles.source, 'own'),
    gte(articles.publishedAt, new Date(Math.min(w.today, w.previous - LATE))),
    lte(articles.publishedAt, new Date(w.now)),
  );
const newsOf = (e: { news: Array<{ title: string; media: string }>; majorNews: Array<{ title: string; media: string }> }) =>
  (e.majorNews.length ? e.majorNews : e.news).slice(0, 6).map((n) => ({ title: n.title, media: n.media }));
const mediaTitle = (media: string) => mediaInfo[media]?.title ?? media;

async function loadIndex(db: Db, w: Windows): Promise<TagIndex> {
  const rows = await db
    .select({ id: articles.id, publishedAt: articles.publishedAt, crawledAt: articles.crawledAt, pending, tag: articleTags.tag })
    .from(articles)
    .innerJoin(articleTags, eq(articleTags.articleId, articles.id))
    .where(inWindow(w));
  return new TagIndex(rows.map((r) => ({ id: r.id, seen: seenOf(r), tag: r.tag })));
}

async function loadEvents(db: Db, index: TagIndex, w: Windows) {
  const latest = await latestEvents(db, 'news', EVENTS);
  if (!latest) return { hour: null, events: [] as SceneEvent[], latest: [] as Array<{ threadId: number | null; major: string[] }> };
  const [prevHour] = await db
    .select({ h: eventSnapshots.hourStart })
    .from(eventSnapshots)
    .where(and(eq(eventSnapshots.category, 'news'), lt(eventSnapshots.hourStart, latest.snapshot.hourStart)))
    .orderBy(desc(eventSnapshots.hourStart))
    .limit(1);
  const prev = await eventsAt(db, 'news', prevHour?.h ?? null);
  const members = latest.events.map((e) => index.carrying(e.major, storyNeed(e.major)));
  // The last hour's articles of every event, newest first, fetched together.
  // An article whose date is not read yet sorts by when it was collected.
  const dateOf = (id: number) => {
    const t = index.at.get(id);
    return t ? (t.published ?? t.crawled) : 0;
  };
  const recent = members.map((ids) =>
    ids.filter((id) => (index.at.get(id)?.crawled ?? 0) >= w.hour).sort((a, b) => dateOf(b) - dateOf(a) || b - a),
  );
  const wanted = [...new Set(recent.flatMap((ids) => ids.slice(0, EVENT_ARTICLES)))];
  const found = wanted.length
    ? await db
        .select({ id: articles.id, media: articles.media, title: articles.title, url: articles.url, publishedAt: articles.publishedAt })
        .from(articles)
        .where(inArray(articles.id, wanted))
    : [];
  const byId = new Map(found.map((a) => [a.id, a]));
  const list = latest.events.map((e, i): SceneEvent => {
    const before = matchPrev(e, prev);
    return {
      rank: e.rank,
      prevRank: before?.rank ?? null,
      score: e.score / 1e6,
      prevScore: before ? before.score / 1e6 : null,
      major: e.major,
      news: newsOf(e),
      href: e.threadId ? `/eve/${e.threadId}/` : null,
      counts: countSeen(index.seen(members[i]), w),
      articles: recent[i].slice(0, EVENT_ARTICLES).flatMap((id) => {
        const a = byId.get(id);
        return a
          ? [{ id, media: a.media, mediaTitle: mediaTitle(a.media), title: a.title, url: a.url, publishedAt: a.publishedAt.toISOString() }]
          : [];
      }),
    };
  });
  return { hour: latest.snapshot.hourStart.toISOString(), events: list, latest: latest.events };
}

async function threadBoard(db: Db, index: TagIndex, w: Windows, latest: Array<{ threadId: number | null; major: string[] }>) {
  const threads = await db
    .select({ id: eventThreads.id, majorTags: eventThreads.majorTags, combinedTo: eventThreads.combinedTo })
    .from(eventThreads)
    .where(and(eq(eventThreads.category, 'news'), gte(eventThreads.lastTime, new Date(w.today))));
  if (!threads.length) return [];
  const ids = new Set(threads.map((t) => t.id));
  // A thread carried on by a later one of today's threads is shown as that one.
  const shown = threads.filter((t) => !t.combinedTo.some((to) => ids.has(to)));
  const rows = await db
    .select({ threadId: events.threadId, news: events.news, majorNews: events.majorNews, major: events.major })
    .from(events)
    .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
    .where(
      and(
        eq(eventSnapshots.category, 'news'),
        gte(eventSnapshots.hourStart, new Date(w.today - HOUR)),
        inArray(
          events.threadId,
          shown.map((t) => t.id),
        ),
      ),
    )
    .orderBy(desc(eventSnapshots.hourStart));
  const last = new Map<number, (typeof rows)[number]>();
  for (const r of rows) if (r.threadId != null && !last.has(r.threadId)) last.set(r.threadId, r);
  const current = new Map(latest.flatMap((e) => (e.threadId ? [[e.threadId, e.major] as const] : [])));
  return rankBoard(
    shown.map((t): SceneRow => {
      // On the table now: the event's present major tags, as the event scene counts them.
      const major = current.get(t.id) ?? last.get(t.id)?.major ?? t.majorTags.slice(0, 3);
      const seen = last.get(t.id);
      return {
        key: `thread:${t.id}`,
        title: major.join('、'),
        href: `/eve/${t.id}/`,
        media: null,
        mediaTitle: null,
        news: seen ? newsOf(seen) : [],
        major,
        counts: countSeen(index.seen(index.carrying(major, storyNeed(major))), w),
      };
    }),
  );
}

async function mediaBoard(db: Db, w: Windows) {
  const recent = new Date(Math.min(w.today, w.previous) - 3 * 24 * HOUR);
  const rows = await db
    .select({ id: topics.id, media: topics.media, title: topics.title, kind: topics.kind, pageStories: topics.pageStories })
    .from(topics)
    .where(
      and(
        inArray(topics.kind, ['topic', 'feature']),
        eq(topics.sponsored, false),
        sql`(${topics.storyLastAt} >= ${recent} OR ${topics.storyGrewAt} >= ${recent})`,
      ),
    );
  // Members are the outlet's own articles on the topic page, joined by url_key.
  const keys = new Map<string, string[]>();
  for (const t of rows) {
    const media = articleMediaOf(t.media);
    for (const st of t.pageStories ?? []) (keys.get(media) ?? keys.set(media, []).get(media))?.push(st.key);
  }
  const at = new Map<string, Seen>();
  for (const [media, list] of keys)
    for (let i = 0; i < list.length; i += 1000) {
      const found = await db
        .select({ urlKey: articles.urlKey, publishedAt: articles.publishedAt, crawledAt: articles.crawledAt, pending })
        .from(articles)
        .where(and(inWindow(w), eq(articles.media, media), inArray(articles.urlKey, list.slice(i, i + 1000))));
      for (const a of found) if (a.urlKey) at.set(`${media}|${a.urlKey}`, seenOf(a));
    }
  return rankBoard(
    rows.map((t): SceneRow => {
      const media = articleMediaOf(t.media);
      const stories = new Set<string>((t.pageStories ?? []).map((st) => `${media}|${st.key}`));
      return {
        key: `topic:${t.id}`,
        title: t.title,
        href: `/${t.kind === 'feature' ? 'feature' : 'topic'}/${encodeURIComponent(t.media)}/${t.id}/`,
        media: t.media,
        mediaTitle: mediaTitle(t.media),
        counts: countSeen(
          [...stories].flatMap((k) => {
            const seen = at.get(k);
            return seen ? [seen] : [];
          }),
          w,
        ),
      };
    }),
  );
}

async function groupBoards(db: Db, index: TagIndex, w: Windows) {
  const [defs, members] = await Promise.all([
    activeGroups(db),
    db
      .selectDistinct({ groupId: tagGroupMembers.groupId, tag: tagGroupMembers.tag })
      .from(tagGroupMembers)
      .where(inArray(tagGroupMembers.status, [...SHOWN])),
  ]);
  const tagsIn = new Map<number, string[]>();
  for (const m of members) (tagsIn.get(m.groupId) ?? tagsIn.set(m.groupId, []).get(m.groupId))?.push(m.tag);
  const rows = defs.map((d) => {
    const tags = descendants(defs, d.id).flatMap((g) => tagsIn.get(g) ?? []);
    const row: SceneRow = {
      key: `group:${d.id}`,
      title: d.label,
      href: `/group/${d.id}/`,
      media: null,
      mediaTitle: null,
      counts: countSeen(index.seen(index.carrying(tags)), w),
    };
    return { kind: d.kind, row };
  });
  return {
    categories: rankBoard(rows.filter((r) => r.kind === 'topic').map((r) => r.row)),
    groups: rankBoard(rows.filter((r) => r.kind === 'group').map((r) => r.row)),
  };
}

export async function loadScenes(db: Db, now = Date.now()): Promise<LiveScenes> {
  const w = windowsAt(now);
  const [index, media] = await Promise.all([loadIndex(db, w), mediaBoard(db, w)]);
  const ev = await loadEvents(db, index, w);
  const [threads, groups] = await Promise.all([threadBoard(db, index, w, ev.latest), groupBoards(db, index, w)]);
  return {
    generatedAt: new Date(now).toISOString(),
    windows: { today: new Date(w.today).toISOString(), hour: new Date(w.hour).toISOString(), previous: new Date(w.previous).toISOString() },
    eventHour: ev.hour,
    events: ev.events,
    boards: { media, threads, ...groups },
  };
}

let cache: { at: number; value: Promise<LiveScenes> } | null = null;
export function registerLiveboardScenes(app: FastifyInstance, db: Db) {
  app.get('/api/v1/liveboard/scenes', async (_request, reply) => {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      const value = loadScenes(db);
      cache = { at: Date.now(), value };
      value.catch(() => {
        cache = null;
      });
    }
    reply.header('cache-control', 'public, max-age=60');
    return cache.value;
  });
}
