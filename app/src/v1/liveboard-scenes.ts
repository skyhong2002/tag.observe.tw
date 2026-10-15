import { and, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads, similarityPairs, tagGroupMembers, topics } from '../db/schema.ts';
import { latestEvents } from '../jobs/events-job.ts';
import { articleMediaOf } from '../jobs/topic-stories.ts';
import type { Attribution } from '../similarity/attribution.ts';
import { activeGroups, descendants } from '../tag-groups/tree.ts';
import { campBaseline, type EventFeedCoverage, eventsAt, feedCoverage, hoursSoFar, matchPrev, rankTrail } from './event-feed.ts';
import { articleCols, liveArticle } from './liveboard.ts';
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
/** Hours of collection counts behind each event and row, for its trail. */
const TRAIL = 12;
const EVENTS = 10;
/** Keywords sent with each event. */
const EVENT_TAGS = 14;
/** An event's articles: the last hour's, then today's earlier ones. */
const EVENT_ARTICLES = 8;
/** Newest reports of an event considered for its list. */
const POOL = 80;
const BOARD = 10;
/** Topics of one outlet on its leaderboard (some outlets keep a page per section). */
const PER_MEDIA = 2;
const CACHE_MS = 60e3;

export interface SceneCounts {
  today: number;
  /** In the hour up to now… */
  hour: number;
  /** …and the hour before it. */
  previous: number;
  /** Collected in each of the last TRAIL hours, oldest first (the last one is `hour`). */
  hours: number[];
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
  /** Its site tags, first eight. */
  tags: string[];
  /** Bylines, and the outlets it names as its source or cites (as on the full liveboard). */
  authors: string[];
  attributions: Attribution[];
  /** Other outlets that ran the same text (similarity pairs) or headline, listed under this one. */
  copies: Array<{ media: string; mediaTitle: string }>;
}
export interface SceneNews {
  title: string;
  media: string;
  image: string | null;
}
export interface SceneEvent {
  rank: number;
  /** null when the story was not on the previous snapshot. */
  prevRank: number | null;
  score: number;
  prevScore: number | null;
  major: string[];
  /** The keywords the event gathers, strongest first, with their burst. */
  tags: Array<{ tag: string; burst: number }>;
  /** Its stored best headlines, which the screen picks the lead from. */
  news: SceneNews[];
  href: string | null;
  counts: SceneCounts;
  /** When its newest report came in, so a quiet hour still says how long ago (null with none today). */
  newest: string | null;
  /** Hours its thread has been on the table, and its rank in each of the last 24 snapshots (as /api/v1/events). */
  hours: number | null;
  rankTrail: Array<number | null> | null;
  /** Outlets and camps on it over the day, with blind spots (as /api/v1/events). */
  coverage: EventFeedCoverage;
  /** The articles collected in the last hour, then today's earlier ones, each the latest published first. */
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
  /** Start of the trail's first hour. */
  trail: number;
}
export function windowsAt(now: number): Windows {
  return { now, today: taipeiMidnight(now).getTime(), hour: now - HOUR, previous: now - 2 * HOUR, trail: now - TRAIL * HOUR };
}

/** When an article was published (null while its page has not been read for the date) and collected. */
export interface Seen {
  published: number | null;
  crawled: number;
}
/** Distinct articles published today, and collected in the last hour, the hour before and each hour of the trail. */
export function countSeen(seen: Iterable<Seen>, w: Windows): SceneCounts {
  const out = { today: 0, hour: 0, previous: 0, hours: new Array<number>(TRAIL).fill(0) };
  for (const t of seen) {
    if (t.published !== null && t.published >= w.today && t.published <= w.now) out.today++;
    if (t.crawled > w.now) continue;
    if (t.crawled >= w.hour) out.hour++;
    else if (t.crawled >= w.previous) out.previous++;
    if (t.crawled >= w.trail) out.hours[Math.min(TRAIL - 1, Math.floor((t.crawled - w.trail) / HOUR))]++;
  }
  return out;
}
/** The latest collection time among reports published today or collected in the trail. */
export function newestOf(seen: Iterable<Seen>, w: Windows): string | null {
  let at = 0;
  for (const t of seen) if (t.crawled <= w.now && (t.crawled >= w.trail || (t.published ?? 0) >= w.today)) at = Math.max(at, t.crawled);
  return at ? new Date(at).toISOString() : null;
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

/** The day's leaderboard: rows with articles today, most first, then the busiest last hour;
 *  with `perMedia`, no more than that many of one outlet. */
export function rankBoard(rows: SceneRow[], { limit = BOARD, perMedia = Infinity } = {}): SceneRow[] {
  const taken = new Map<string, number>();
  return rows
    .filter((r) => r.counts.today > 0)
    .sort((a, b) => b.counts.today - a.counts.today || b.counts.hour - a.counts.hour || a.title.localeCompare(b.title))
    .filter((r) => {
      if (!r.media) return true;
      const n = taken.get(r.media) ?? 0;
      taken.set(r.media, n + 1);
      return n < perMedia;
    })
    .slice(0, limit);
}

export interface ReportCandidate {
  id: number;
  media: string;
  title: string;
  /** Publish time (collection time while it is pending), for the order. */
  date: number;
  recent: boolean;
}
/** Headline as compared for copies: no spaces or punctuation. */
const headlineKey = (title: string) => title.replace(/[\s\p{P}\p{S}]+/gu, '');
/** Headlines this alike (Dice over character pairs) are one report rewritten by another outlet. */
const SAME_HEADLINE = 0.7;
const bigrams = (key: string) => {
  const out = new Map<string, number>();
  for (let i = 0; i < key.length - 1; i++) out.set(key.slice(i, i + 2), (out.get(key.slice(i, i + 2)) ?? 0) + 1);
  return out;
};
export function headlineDice(a: string, b: string): number {
  const x = bigrams(headlineKey(a)),
    y = bigrams(headlineKey(b));
  let shared = 0,
    total = 0;
  for (const n of x.values()) total += n;
  for (const n of y.values()) total += n;
  for (const [g, n] of x) shared += Math.min(n, y.get(g) ?? 0);
  return total ? (2 * shared) / total : 0;
}
/** Reports of one outlet in an event's list before the rest are let in. */
const OUTLET_SHARE = 2;
/**
 * An event's reports for the screen: copies of one report (the same text,
 * by similarity pair, or a nearly identical headline) fold into the earliest of them
 * in the section, the others listed as its copies; then the last hour's
 * reports, newest first, one per outlet before any outlet gets a second,
 * and today's earlier ones the same way, `limit` in all, no outlet past
 * OUTLET_SHARE while there are others to show.
 */
export function pickReports(
  candidates: readonly ReportCandidate[],
  pairs: ReadonlyArray<{ aId: number; bId: number }>,
  limit: number,
): Array<{ id: number; copies: number[] }> {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let root = x;
    while ((parent.get(root) ?? root) !== root) root = parent.get(root) as number;
    parent.set(x, root);
    return root;
  };
  const join = (a: number, b: number) => {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const ids = new Set(candidates.map((c) => c.id));
  for (const p of pairs) if (ids.has(p.aId) && ids.has(p.bId)) join(p.aId, p.bId);
  for (let i = 0; i < candidates.length; i++)
    for (let j = i + 1; j < candidates.length; j++)
      if (headlineDice(candidates[i].title, candidates[j].title) >= SAME_HEADLINE) join(candidates[i].id, candidates[j].id);
  const section = (recent: boolean) => {
    const groups = new Map<number, ReportCandidate[]>();
    for (const c of candidates)
      if (c.recent === recent) {
        const g = find(c.id);
        groups.set(g, [...(groups.get(g) ?? []), c]);
      }
    const all = [...groups.values()].map((members) => {
      const byDate = [...members].sort((a, b) => a.date - b.date || a.id - b.id);
      // The story's newest member orders it; its earliest one stands for it.
      return { lead: byDate[0], newest: byDate.at(-1)?.date ?? 0, copies: byDate.slice(1) };
    });
    all.sort((a, b) => b.newest - a.newest || b.lead.id - a.lead.id);
    const outlets = new Set<string>();
    const first = all.filter((g) => !outlets.has(g.lead.media) && outlets.add(g.lead.media));
    return [...first, ...all.filter((g) => !first.includes(g))];
  };
  // A report copied into both sections stays in the one it first reached.
  const recent = section(true);
  const seen = new Set(recent.flatMap((g) => [g.lead.id, ...g.copies.map((c) => c.id)].map(find)));
  const earlier = section(false).filter((g) => !seen.has(find(g.lead.id)));
  // No outlet past its share while others are waiting; the rest only fill what is left.
  const ordered = [...recent, ...earlier];
  const count = new Map<string, number>();
  const fair = ordered.filter((g) => {
    const n = (count.get(g.lead.media) ?? 0) + 1;
    count.set(g.lead.media, n);
    return n <= OUTLET_SHARE;
  });
  const chosen = new Set([...fair, ...ordered.filter((g) => !fair.includes(g))].slice(0, limit));
  return ordered
    .filter((g) => chosen.has(g))
    .map((g) => ({
      id: g.lead.id,
      copies: [...new Set(g.copies.filter((c) => c.media !== g.lead.media).map((c) => c.id))],
    }));
}

/** Its publish time is a placeholder until its page is read. */
const pending = sql<number>`(${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt})`;
/** Own articles published today, or late enough to have been collected in the trail's hours. */
const inWindow = (w: Windows) =>
  and(
    eq(articles.source, 'own'),
    gte(articles.publishedAt, new Date(Math.min(w.today, w.trail - LATE))),
    lte(articles.publishedAt, new Date(w.now)),
  );
type Stored = { title: string; media: string; image: string | null };
const newsOf = (e: { news: Stored[]; majorNews: Stored[] }): SceneNews[] =>
  (e.majorNews.length ? e.majorNews : e.news).slice(0, 6).map((n) => ({ title: n.title, media: n.media, image: n.image ?? null }));
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
  const hour = latest.snapshot.hourStart;
  const threadIds = latest.events.flatMap((e) => (e.threadId ? [e.threadId] : []));
  const [prev, baseline, onTable, trails] = await Promise.all([
    eventsAt(db, 'news', prevHour?.h ?? null),
    campBaseline(db, hour),
    hoursSoFar(db, 'news', threadIds, hour),
    rankTrail(db, 'news', threadIds, hour),
  ]);
  const coverage = await feedCoverage(
    db,
    hour,
    latest.events.map((e) => e.major),
    baseline,
  );
  const members = latest.events.map((e) => index.carrying(e.major, storyNeed(e.major)));
  // Every event's articles, fetched together: the last hour's, then today's
  // earlier ones, each newest first. One whose date is not read yet sorts by
  // when it was collected.
  const dateOf = (id: number) => {
    const t = index.at.get(id);
    return t ? (t.published ?? t.crawled) : 0;
  };
  const isRecent = (id: number) => (index.at.get(id)?.crawled ?? 0) >= w.hour;
  // Each event's candidates: the last hour's and today's, newest first, a
  // bounded pool; copies among them are found in one pass over the pairs.
  const pools = members.map((ids) =>
    [...ids]
      .filter((id) => isRecent(id) || dateOf(id) >= w.today)
      .sort((a, b) => dateOf(b) - dateOf(a) || b - a)
      .slice(0, POOL),
  );
  const pooled = [...new Set(pools.flat())];
  const [heads, pairs] = pooled.length
    ? await Promise.all([
        db.select({ id: articles.id, media: articles.media, title: articles.title }).from(articles).where(inArray(articles.id, pooled)),
        db
          .select({ aId: similarityPairs.aId, bId: similarityPairs.bId })
          .from(similarityPairs)
          .where(and(inArray(similarityPairs.aId, pooled), inArray(similarityPairs.bId, pooled))),
      ])
    : [[], []];
  const head = new Map(heads.map((h) => [h.id, h]));
  const picked = pools.map((pool) =>
    pickReports(
      pool.flatMap((id) => {
        const h = head.get(id);
        return h ? [{ id, media: h.media, title: h.title, date: dateOf(id), recent: isRecent(id) }] : [];
      }),
      pairs,
      EVENT_ARTICLES,
    ),
  );
  const wanted = [...new Set(picked.flatMap((list) => list.map((p) => p.id)))];
  const found = wanted.length ? await db.select(articleCols(0)).from(articles).where(inArray(articles.id, wanted)) : [];
  const byId = new Map(found.map((a) => [a.id, liveArticle(a)]));
  const list = latest.events.map((e, i): SceneEvent => {
    const before = matchPrev(e, prev);
    return {
      rank: e.rank,
      prevRank: before?.rank ?? null,
      score: e.score / 1e6,
      prevScore: before ? before.score / 1e6 : null,
      major: e.major,
      tags: e.tags.slice(0, EVENT_TAGS).map(([tag, burst]) => ({ tag, burst })),
      news: newsOf(e),
      href: e.threadId ? `/eve/${e.threadId}/` : null,
      counts: countSeen(index.seen(members[i]), w),
      newest: newestOf(index.seen(members[i]), w),
      hours: e.threadId ? (onTable.get(e.threadId) ?? null) : null,
      rankTrail: e.threadId ? (trails.get(e.threadId) ?? null) : null,
      coverage: coverage[i],
      articles: picked[i].flatMap(({ id, copies }) => {
        const a = byId.get(id);
        if (!a) return [];
        const copied = [...new Set(copies.flatMap((c) => head.get(c)?.media ?? []))];
        return [
          {
            id,
            media: a.media,
            mediaTitle: a.mediaTitle,
            title: a.title,
            url: a.url,
            image: a.image,
            publishedAt: a.publishedAt,
            recent: isRecent(id),
            tags: a.tags,
            authors: a.authors,
            attributions: a.attributions ?? [],
            copies: copied.map((media) => ({ media, mediaTitle: mediaTitle(media) })),
          },
        ];
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
    { perMedia: PER_MEDIA },
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
