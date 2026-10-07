import { and, desc, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import { normalizeAuthorCredits } from '../crawl/byline.ts';
import type { Db } from '../db/client.ts';
import { articles, similarityPairs, topics } from '../db/schema.ts';
import { articleMediaOf } from '../jobs/topics-job.ts';
import { type Attribution, normalizeAttributions } from '../similarity/attribution.ts';
import { classifyRelation } from '../similarity/relation.ts';
import type { PairRelationInfo } from '../similarity/types.ts';
import { type Camp, campOf } from './coverage.ts';
import { loadActivity } from './liveboard-activity.ts';
import { liveObservation } from './site-observation.ts';

// Polling feed for the unattended /liveboard/ screen: own articles inserted
// since an id cursor, recent body-copy stories (an earliest "lead" and the
// later articles sharing its text) since a computedAt cursor, and per-camp
// publishing counts. Article ids are the insert order; legacy imports share
// the sequence, so every article query is bounded by source and publish time.

const mediaInfo = catalog as unknown as Record<string, { title: string | null }>;
const MINUTE = 60e3;
const HOUR = 60 * MINUTE;
const SEED_HOURS = 3;
const CURSOR_HOURS = 48;
const ARTICLE_LIMIT = 40;
const STORY_LIMIT = 12;
const FOLLOWER_LIMIT = 8;
const CACHE_MS = 60e3;
// Body text for the screen to read from: a few lines for a new article, more
// for the lead and closest copies of a story, which are compared side by side.
const ARTICLE_TEXT = 600;
const STORY_TEXT = 1500;
const STORY_TEXT_FOLLOWERS = 3;
const READING_TEXT = 700;
const READING_LIMIT = 60;

export interface LiveArticle {
  id: number;
  media: string;
  mediaTitle: string;
  camp: Camp;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  datePending: boolean;
  tags: string[];
  /** Start of the stored body, else the summary; null when neither is stored. */
  text: string | null;
  /** Bylines as stored (often reporters, sometimes the outlet itself). */
  authors: string[];
  /** Explicit source credits/citations, independent of author names. */
  attributions?: Attribution[];
}
export interface LiveFollower {
  relation?: PairRelationInfo;
  article: LiveArticle;
  score: number;
  containment: number;
  kind: string;
  evidence: string;
  /** False when this article only matched another follower, not the lead itself. */
  direct: boolean;
  gapMinutes: number;
}
export interface LiveStory {
  key: string;
  computedAt: string;
  lead: LiveArticle;
  followers: LiveFollower[];
  /** Followers beyond the ones listed. */
  more: number;
}
export interface LiveBucket {
  t: string;
  blue: number;
  green: number;
  other: number;
}
export interface LiveStats {
  last60m: LiveBucket[];
  hourly24: LiveBucket[];
  total24h: number;
  activeMedia1h: number;
}

type ArticleRow = {
  id: number;
  media: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: Date;
  crawledAt: Date;
  fetchedAt: Date | null;
  tags: string[];
  text?: string | null;
  textChars?: number;
  authors?: string[] | null;
  creator?: string | null;
  attributions?: Attribution[] | null;
};
export type PairRow = {
  aId: number;
  bId: number;
  score: number;
  containment: number;
  kind: string;
  evidence: string;
  computedAt: Date;
};

const articleCols = (textChars: number) => ({
  id: articles.id,
  media: articles.media,
  title: articles.title,
  url: articles.url,
  image: articles.image,
  publishedAt: articles.publishedAt,
  crawledAt: articles.crawledAt,
  fetchedAt: articles.fetchedAt,
  tags: articles.tags,
  authors: articles.authors,
  creator: articles.creator,
  attributions: articles.attributions,
  // Twice the shown length, since readableText drops lines that are not prose.
  text: sql<string | null>`COALESCE(NULLIF(LEFT(${articles.body}, ${textChars * 2}), ''), NULLIF(${articles.description}, ''))`,
  textChars: sql<number>`${textChars}`,
});

// A sentence end (headlines rarely carry 。), or a line too long to be a headline.
const PROSE = /。|[.!?]["'”’)]?(\s|$)/;
/**
 * The stored body as paragraphs a screen can show, or null. Some extractions
 * pick up page chrome (tag lists, dates, 上一篇／下一篇, related headlines);
 * only lines that end sentences or run too long for a headline are kept.
 */
export function readableText(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  const lines = text
    .replace(/[^\S\n]+/g, ' ')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => [...l].length >= 60 || ([...l].length >= 20 && PROSE.test(l)));
  if (!lines.length) return null;
  const joined = lines.join('\n');
  return [...joined].length > max ? [...joined].slice(0, max).join('') : joined;
}

export const liveArticle = (r: ArticleRow): LiveArticle => ({
  id: r.id,
  media: r.media,
  mediaTitle: mediaInfo[r.media]?.title ?? r.media,
  camp: campOf(r.media),
  title: r.title,
  url: r.url,
  image: r.image,
  publishedAt: r.publishedAt.toISOString(),
  // Same rule as /api/v1/articles: the publish time is still only first-seen.
  datePending: r.fetchedAt === null && r.publishedAt.getTime() === r.crawledAt.getTime(),
  tags: r.tags.slice(0, 8),
  text: readableText(r.text, Number(r.textChars ?? 600)),
  authors: normalizeAuthorCredits(r.authors?.length ? r.authors : r.creator?.trim() ? [r.creator.trim()] : []).slice(0, 4),
  attributions: normalizeAttributions(r.attributions ?? [], r.media),
});

/**
 * Joins pairs into connected stories. The earliest-published member leads;
 * each other member is scored by its own pair with the lead when there is
 * one, else by its best pair inside the story.
 */
export function groupStories(pairs: PairRow[], byId: Map<number, LiveArticle>): LiveStory[] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let root = x;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };
  const usable = pairs.filter((p) => byId.has(p.aId) && byId.has(p.bId));
  for (const p of usable) {
    const a = find(p.aId),
      b = find(p.bId);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map<number, PairRow[]>();
  for (const p of usable) {
    const root = find(p.aId);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  }
  const time = (a: LiveArticle) => Date.parse(a.publishedAt);
  const stories: LiveStory[] = [];
  for (const group of groups.values()) {
    const members = [...new Set(group.flatMap((p) => [p.aId, p.bId]))].map((id) => byId.get(id)!);
    members.sort((a, b) => time(a) - time(b) || a.id - b.id);
    const [lead, ...rest] = members;
    const followers = rest.map((article): LiveFollower => {
      const own = group.filter((p) => p.aId === article.id || p.bId === article.id);
      const direct = own.find((p) => p.aId === lead.id || p.bId === lead.id);
      const pair = direct ?? own.reduce((best, p) => (p.score > best.score ? p : best));
      return {
        article,
        relation: direct ? classifyRelation(lead, article) : undefined,
        score: pair.score,
        containment: pair.containment,
        kind: pair.kind,
        evidence: pair.evidence,
        direct: Boolean(direct),
        gapMinutes: Math.round((time(article) - time(lead)) / MINUTE),
      };
    });
    // Direct copies of the lead first, then by how closely they match.
    followers.sort((a, b) => Number(b.direct) - Number(a.direct) || b.score - a.score || a.gapMinutes - b.gapMinutes);
    const computedAt = new Date(Math.max(...group.map((p) => p.computedAt.getTime()))).toISOString();
    stories.push({
      key: `${lead.id}`,
      computedAt,
      lead,
      followers: followers.slice(0, FOLLOWER_LIMIT),
      more: Math.max(0, followers.length - FOLLOWER_LIMIT),
    });
  }
  return stories.sort((a, b) => b.computedAt.localeCompare(a.computedAt) || b.followers.length + b.more - (a.followers.length + a.more));
}

/** Counts per camp in `count` buckets of `size` ms, the last one ending at `end`. */
export function bucketByCamp(
  rows: Array<{ media: string; at: number; n: number }>,
  end: number,
  size: number,
  count: number,
): LiveBucket[] {
  const start = end - size * count;
  const buckets = Array.from({ length: count }, (_, i) => ({ t: new Date(start + i * size).toISOString(), blue: 0, green: 0, other: 0 }));
  for (const r of rows) {
    const i = Math.floor((r.at - start) / size);
    if (i >= 0 && i < count) buckets[i][campOf(r.media)] += r.n;
  }
  return buckets;
}

async function loadStats(db: Db, now: number): Promise<LiveStats> {
  const end = Math.ceil(now / (5 * MINUTE)) * 5 * MINUTE;
  const rows = await db
    .select({
      media: articles.media,
      bucket: sql<number>`TIMESTAMPDIFF(SECOND, '1970-01-01', ${articles.publishedAt}) DIV 300`,
      n: sql<number>`COUNT(*)`,
    })
    .from(articles)
    .where(and(eq(articles.source, 'own'), gte(articles.publishedAt, new Date(end - 25 * HOUR)), lte(articles.publishedAt, new Date(now))))
    .groupBy(articles.media, sql`2`);
  const counts = rows.map((r) => ({ media: r.media, at: Number(r.bucket) * 5 * MINUTE, n: Number(r.n) }));
  const hourEnd = Math.ceil(now / HOUR) * HOUR;
  const recent = counts.filter((r) => r.at >= now - HOUR);
  return {
    last60m: bucketByCamp(counts, end, 5 * MINUTE, 12),
    hourly24: bucketByCamp(counts, hourEnd, HOUR, 24),
    total24h: counts.filter((r) => r.at >= now - 24 * HOUR).reduce((sum, r) => sum + r.n, 0),
    activeMedia1h: new Set(recent.map((r) => r.media)).size,
  };
}

async function loadStories(db: Db, now: number): Promise<LiveStory[]> {
  // Pairs land in batches every ten minutes; three hours of batches is plenty
  // for a screen that shows them one at a time.
  const pairs = await db
    .select({
      aId: similarityPairs.aId,
      bId: similarityPairs.bId,
      score: similarityPairs.score,
      containment: similarityPairs.containment,
      kind: similarityPairs.kind,
      evidence: similarityPairs.evidence,
      computedAt: similarityPairs.computedAt,
    })
    .from(similarityPairs)
    .where(and(gte(similarityPairs.lastPublished, new Date(now - 24 * HOUR)), gte(similarityPairs.computedAt, new Date(now - 3 * HOUR))))
    .orderBy(desc(similarityPairs.computedAt), desc(similarityPairs.score))
    .limit(400);
  const ids = [...new Set(pairs.flatMap((p) => [p.aId, p.bId]))];
  const rows = ids.length ? await db.select(articleCols(STORY_TEXT)).from(articles).where(inArray(articles.id, ids)) : [];
  const stories = groupStories(pairs, new Map(rows.map((r) => [r.id, liveArticle(r)])));
  // Only the lead and the closest copies are shown with their text.
  for (const story of stories)
    story.followers = story.followers.map((f, i) => (i < STORY_TEXT_FOLLOWERS ? f : { ...f, article: { ...f.article, text: null } }));
  return stories;
}

// Bodies are fetched in waves after the article itself, so a screen that wants
// to show text reads the articles whose bodies came in most recently.
async function loadReading(db: Db, now: number): Promise<Array<{ article: LiveArticle; readAt: string }>> {
  const rows = await db
    .select({ ...articleCols(READING_TEXT), readAt: articles.contentFetchedAt })
    .from(articles)
    .where(
      and(
        eq(articles.source, 'own'),
        eq(articles.bodyStatus, 'ok'),
        gte(articles.publishedAt, new Date(now - 6 * HOUR)),
        lte(articles.publishedAt, new Date(now + HOUR)),
        sql`${articles.contentFetchedAt} IS NOT NULL`,
      ),
    )
    .orderBy(desc(articles.contentFetchedAt), desc(articles.id))
    .limit(READING_LIMIT);
  return rows.map((r) => ({ article: liveArticle(r), readAt: r.readAt!.toISOString() }));
}

export interface LiveTopic {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  kind: 'topic' | 'feature';
  /** New: first listed in the last day; else it gained stories. */
  isNew: boolean;
  at: string;
  storyCount: number | null;
  stories: Array<{ title: string; url: string | null; date: string | null; article: LiveArticle | null }>;
}
const TOPIC_LIMIT = 12;
const STORY_TEASER = 160;
const TOPICS_PER_MEDIA = 2;

/** Topic pages that appeared or gained stories lately, at most two per outlet (some refresh dozens at once). */
export function pickTopics<T extends { media: string; at: string }>(rows: readonly T[]): T[] {
  const perMedia = new Map<string, number>();
  return [...rows]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((r) => {
      const n = perMedia.get(r.media) ?? 0;
      perMedia.set(r.media, n + 1);
      return n < TOPICS_PER_MEDIA;
    })
    .slice(0, TOPIC_LIMIT);
}

async function loadTopics(db: Db, now: number): Promise<LiveTopic[]> {
  const rows = await db
    .select({
      id: topics.id,
      media: topics.media,
      title: topics.title,
      url: topics.url,
      image: topics.image,
      kind: topics.kind,
      firstSeen: topics.firstSeen,
      backlog: topics.backlog,
      grewAt: topics.storyGrewAt,
      storyCount: topics.storyCount,
      pageStories: topics.pageStories,
    })
    .from(topics)
    .where(
      and(
        inArray(topics.kind, ['topic', 'feature']),
        eq(topics.sponsored, false),
        sql`(${topics.storyGrewAt} >= ${new Date(now - 6 * HOUR)} OR (${topics.firstSeen} >= ${new Date(now - 24 * HOUR)} AND ${topics.backlog} = 0))`,
      ),
    );
  const shaped = rows.map((r) => {
    const isNew = !r.backlog && now - r.firstSeen.getTime() < 24 * HOUR;
    const at = (isNew ? r.firstSeen : (r.grewAt ?? r.firstSeen)).toISOString();
    const stories = [...(r.pageStories ?? [])]
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .slice(0, 4)
      .map((st) => ({ key: st.key, title: st.title, url: st.url ?? null, date: st.date ?? null }));
    return {
      id: r.id,
      media: r.media,
      mediaTitle: mediaInfo[r.media]?.title ?? r.media,
      title: r.title,
      url: r.url,
      image: r.image,
      kind: r.kind as 'topic' | 'feature',
      isNew,
      at,
      storyCount: r.storyCount,
      stories,
    };
  });
  const picked = pickTopics(shaped);
  // The stories are the outlet's own articles: join them by url_key for the
  // photo, byline, tags and opening text the topic page listing lacks.
  const wanted = picked.flatMap((t) => t.stories.map((st) => ({ media: articleMediaOf(t.media), key: st.key })));
  const found = wanted.length
    ? await db
        .select({ ...articleCols(STORY_TEASER), urlKey: articles.urlKey })
        .from(articles)
        .where(
          and(
            inArray(articles.media, [...new Set(wanted.map((w) => w.media))]),
            inArray(
              articles.urlKey,
              wanted.map((w) => w.key),
            ),
          ),
        )
    : [];
  const byKey = new Map(found.map((r) => [`${r.media}|${r.urlKey}`, liveArticle(r)]));
  return picked.map((t) => ({
    ...t,
    stories: t.stories.map(({ key, ...st }) => {
      const article = byKey.get(`${articleMediaOf(t.media)}|${key}`) ?? null;
      // A dated article beats the date guessed from the topic page.
      return { ...st, title: article?.title ?? st.title, date: article?.publishedAt ?? st.date, article };
    }),
  }));
}

const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>, ttl = CACHE_MS): Promise<T> {
  let entry = cache.get(key);
  if (!entry || Date.now() - entry.at > ttl) {
    entry = { at: Date.now(), value: load() };
    cache.set(key, entry);
    entry.value.catch(() => cache.delete(key));
  }
  return entry.value as Promise<T>;
}

export function parseLiveQuery(q: { after?: string; pairsAfter?: string; readAfter?: string }) {
  const after = q.after && /^\d{1,15}$/.test(q.after) ? Number(q.after) : null;
  const pairsAfter = q.pairsAfter ? new Date(q.pairsAfter) : null;
  const readAfter = q.readAfter ? new Date(q.readAfter) : null;
  if (q.after && after === null) return { error: 'bad after' } as const;
  if (pairsAfter && Number.isNaN(pairsAfter.getTime())) return { error: 'bad pairsAfter' } as const;
  if (readAfter && Number.isNaN(readAfter.getTime())) return { error: 'bad readAfter' } as const;
  return { after, pairsAfter, readAfter };
}

export function registerLiveboard(app: FastifyInstance, db: Db) {
  app.get<{ Querystring: { after?: string; pairsAfter?: string; readAfter?: string } }>('/api/v1/liveboard', async (request, reply) => {
    const query = parseLiveQuery(request.query);
    if ('error' in query) return reply.code(400).send({ error: query.error });
    const now = Date.now();
    const [rows, allStories, stats, visitors, allReading, activity, topicUpdates] = await Promise.all([
      db
        .select(articleCols(ARTICLE_TEXT))
        .from(articles)
        .where(
          and(
            eq(articles.source, 'own'),
            sql`${articles.title} <> ''`,
            query.after === null ? undefined : gt(articles.id, query.after),
            gte(articles.publishedAt, new Date(now - (query.after === null ? SEED_HOURS : CURSOR_HOURS) * HOUR)),
            lte(articles.publishedAt, new Date(now + HOUR)),
          ),
        )
        .orderBy(desc(articles.id))
        .limit(ARTICLE_LIMIT),
      cached('stories', () => loadStories(db, now)),
      cached('stats', () => loadStats(db, now)),
      cached('visitors', () => liveObservation(db)),
      cached('reading', () => loadReading(db, now)),
      cached('activity', () => loadActivity(db, now), 15e3),
      cached('topics', () => loadTopics(db, now)),
    ]);
    const stories = query.pairsAfter
      ? allStories.filter((s) => s.computedAt > query.pairsAfter!.toISOString()).slice(0, STORY_LIMIT)
      : allStories.slice(0, STORY_LIMIT);
    const after = Math.max(query.after ?? 0, ...rows.map((r) => r.id));
    const pairsAfter = allStories.reduce((max, s) => (s.computedAt > max ? s.computedAt : max), query.pairsAfter?.toISOString() ?? '');
    const readAfter = query.readAfter?.toISOString() ?? '';
    const reading = allReading.filter((r) => r.readAt > readAfter);
    reply.header('cache-control', 'public, max-age=15');
    return {
      generatedAt: new Date(now).toISOString(),
      cursor: {
        after: after || null,
        pairsAfter: pairsAfter || null,
        readAfter: allReading[0]?.readAt ?? query.readAfter?.toISOString() ?? null,
      },
      articles: rows.map(liveArticle),
      stories,
      reading: reading.map((r) => r.article),
      activity,
      topics: topicUpdates,
      stats,
      // GA Realtime for this site; null when the live job is stale.
      visitors: visitors && { activeUsers: visitors.activeUsers, views: visitors.views, perMinute: visitors.perMinute },
    };
  });
}
