import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags } from '../db/schema.ts';
import { RANKING_CATEGORIES } from '../jobs/ranking-job.ts';
import { type Camp, campOf } from './coverage.ts';

// Public article search: every crawled article in a time window, filtered by
// keyword (title, summary or exact tag), media, ranking category, camp and/or
// tag, newest first, with a keyset cursor for paging. We do not store article
// bodies, so this is as close to full-text search as the data allows.

const mediaInfo = catalog as unknown as Record<string, { icon: string | null; title: string | null }>;
const HOUR = 3600e3;
export const MAX_SPAN_DAYS = 31;
export const MAX_LIMIT = 200;

export interface ArticleQuery {
  q: string | null;
  media: string[] | null;
  category: string | null;
  tag: string | null;
  camp: Camp | null;
  facets: boolean;
  since: Date;
  until: Date;
  limit: number;
  cursor: { at: Date; id: number } | null;
}
type Raw = Partial<
  Record<'q' | 'media' | 'category' | 'camp' | 'tag' | 'since' | 'until' | 'hours' | 'limit' | 'cursor' | 'facets', string>
>;

export const encodeCursor = (at: Date, id: number) => `${at.getTime()}_${id}`;
function decodeCursor(s: string) {
  const m = /^(\d{1,15})_(\d{1,19})$/.exec(s);
  return m ? { at: new Date(Number(m[1])), id: Number(m[2]) } : null;
}
function parseTime(s: string | undefined) {
  if (!s) return undefined;
  // A bare day is a Taipei calendar day, like the rest of the site.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00+08:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseArticleQuery(raw: Raw, now = new Date()): ArticleQuery | { error: string } {
  const q = raw.q?.trim().slice(0, 60) || null;
  let media: string[] | null = null;
  if (raw.media) {
    media = [
      ...new Set(
        raw.media
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
      ),
    ];
    const unknown = media.filter((m) => !mediaInfo[m]);
    if (unknown.length) return { error: `unknown media: ${unknown.slice(0, 5).join(',')}` };
    if (media.length > 50) return { error: 'at most 50 media' };
  }
  const category = raw.category || null;
  if (category && !RANKING_CATEGORIES[category]) return { error: 'unknown category' };
  const tag = raw.tag?.trim().slice(0, 60) || null;
  const camp = raw.camp || null;
  if (camp && camp !== 'blue' && camp !== 'green' && camp !== 'other') return { error: 'unknown camp' };
  const facets = raw.facets === '1' || raw.facets === 'true';
  const untilArg = parseTime(raw.until);
  if (untilArg === null) return { error: 'bad until' };
  const until = untilArg ?? now;
  const hours = raw.hours === undefined ? 24 : Number(raw.hours);
  if (!Number.isFinite(hours) || hours <= 0) return { error: 'bad hours' };
  const sinceArg = parseTime(raw.since);
  if (sinceArg === null) return { error: 'bad since' };
  const since = sinceArg ?? new Date(until.getTime() - Math.min(hours, MAX_SPAN_DAYS * 24) * HOUR);
  if (since >= until) return { error: 'since must be before until' };
  if (until.getTime() - since.getTime() > MAX_SPAN_DAYS * 24 * HOUR) return { error: `window longer than ${MAX_SPAN_DAYS} days` };
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(raw.limit)) || 50));
  const cursor = raw.cursor ? decodeCursor(raw.cursor) : null;
  if (raw.cursor && !cursor) return { error: 'bad cursor' };
  return { q, media, category, tag, camp: camp as Camp | null, facets, since, until, limit, cursor };
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function searchArticles(db: Db, query: ArticleQuery) {
  let media = query.media;
  if (query.category) {
    const inCategory = new Set(RANKING_CATEGORIES[query.category].media);
    media = (media ?? [...inCategory]).filter((m) => inCategory.has(m));
  }
  // 'other' is everything outside the blue/green lists, so it filters by
  // exclusion rather than by a media list.
  const campMedia = (c: Camp) => [...new Set(RANKING_CATEGORIES.all.media)].filter((m) => campOf(m) === c);
  if (query.camp && query.camp !== 'other') {
    const inCamp = new Set(campMedia(query.camp));
    media = (media ?? [...inCamp]).filter((m) => inCamp.has(m));
  }
  const notInCamps = query.camp === 'other' ? [...campMedia('blue'), ...campMedia('green')] : null;
  const empty = media !== null && media.length === 0;
  const conds = [
    gte(articles.publishedAt, query.since),
    lt(articles.publishedAt, query.until),
    sql`${articles.title} <> ''`,
    media ? inArray(articles.media, media) : undefined,
    notInCamps?.length
      ? sql`${articles.media} NOT IN (${sql.join(
          notInCamps.map((m) => sql`${m}`),
          sql`, `,
        )})`
      : undefined,
    query.q
      ? or(
          sql`${articles.title} LIKE ${`%${likeEscape(query.q)}%`}`,
          sql`${articles.description} LIKE ${`%${likeEscape(query.q)}%`}`,
          sql`JSON_CONTAINS(${articles.tags}, JSON_QUOTE(${query.q}))`,
        )
      : undefined,
  ];
  const pageConds = [
    ...conds,
    query.cursor
      ? or(lt(articles.publishedAt, query.cursor.at), and(eq(articles.publishedAt, query.cursor.at), lt(articles.id, query.cursor.id)))
      : undefined,
  ];
  const cols = {
    id: articles.id,
    media: articles.media,
    title: articles.title,
    description: articles.description,
    url: articles.url,
    image: articles.image,
    publishedAt: articles.publishedAt,
    crawledAt: articles.crawledAt,
    fetchedAt: articles.fetchedAt,
    section: articles.category,
    tags: articles.tags,
  };
  const rows = empty
    ? []
    : query.tag
      ? await db
          .select(cols)
          .from(articleTags)
          .innerJoin(articles, eq(articles.id, articleTags.articleId))
          .where(and(eq(articleTags.tag, query.tag), ...pageConds))
          .orderBy(desc(articles.publishedAt), desc(articles.id))
          .limit(query.limit + 1)
      : await db
          .select(cols)
          .from(articles)
          .where(and(...pageConds))
          .orderBy(desc(articles.publishedAt), desc(articles.id))
          .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);
  // Totals for the whole match (not just this page), per outlet and camp.
  let facets: { total: number; camps: Record<Camp, number>; media: Array<{ media: string; count: number }> } | undefined;
  if (query.facets) {
    const counts = empty
      ? []
      : query.tag
        ? await db
            .select({ media: articles.media, count: sql<number>`COUNT(*)` })
            .from(articleTags)
            .innerJoin(articles, eq(articles.id, articleTags.articleId))
            .where(and(eq(articleTags.tag, query.tag), ...conds))
            .groupBy(articles.media)
        : await db
            .select({ media: articles.media, count: sql<number>`COUNT(*)` })
            .from(articles)
            .where(and(...conds))
            .groupBy(articles.media);
    const camps: Record<Camp, number> = { blue: 0, green: 0, other: 0 };
    let total = 0;
    for (const c of counts) {
      camps[campOf(c.media)] += Number(c.count);
      total += Number(c.count);
    }
    facets = {
      total,
      camps,
      media: counts
        .map((c) => ({ media: c.media, count: Number(c.count) }))
        .sort((a, b) => b.count - a.count || a.media.localeCompare(b.media)),
    };
  }
  const last = page.at(-1);
  return {
    query: {
      q: query.q,
      media: query.media,
      category: query.category,
      tag: query.tag,
      camp: query.camp,
      since: query.since.toISOString(),
      until: query.until.toISOString(),
      limit: query.limit,
    },
    count: page.length,
    ...(facets ? { facets } : {}),
    nextCursor: rows.length > query.limit && last ? encodeCursor(last.publishedAt, last.id) : null,
    articles: page.map((r) => ({
      id: r.id,
      media: r.media,
      mediaTitle: mediaInfo[r.media]?.title ?? r.media,
      camp: campOf(r.media),
      title: r.title,
      description: r.description?.trim() || null,
      url: r.url,
      image: r.image,
      publishedAt: r.publishedAt,
      // Plain sitemaps carry no publish time: until the article page is
      // fetched, publishedAt is only when we first saw the URL.
      datePending: r.fetchedAt === null && r.publishedAt.getTime() === r.crawledAt.getTime(),
      section: r.section,
      tags: r.tags,
    })),
  };
}

export function registerArticleSearch(app: FastifyInstance, db: Db) {
  app.get<{ Querystring: Raw }>('/api/v1/articles', async (request, reply) => {
    const query = parseArticleQuery(request.query);
    if ('error' in query) return reply.code(400).send({ error: query.error });
    const result = await searchArticles(db, query);
    reply.header('cache-control', 'public, max-age=60');
    return result;
  });
}
