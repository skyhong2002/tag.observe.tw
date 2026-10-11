// How articles were written (writing/rules.ts, jobs/writing-job.ts): per
// article, per outlet and over time. Shares use analysed articles (those with
// a body) as the denominator; syndication sites that republish other outlets
// stay out of the outlet table and totals.
import { and, desc, eq, gte, isNotNull, lt, notInArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { articles, articleWriting } from '../db/schema.ts';
import { syndicationMedia } from '../jobs/similarity-job.ts';
import { outletIdentity } from '../similarity/attribution.ts';
import { PLATFORMS, ROLES, TITLE_TAGS, VERSION } from '../writing/rules.ts';
import { taipeiDay } from './event-archive.ts';

const DAY = 86400e3;
const MIN_MEDIA_ARTICLES = 100;

const intIn = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const fromDay = (days: number, now: number) => taipeiDay(new Date(now - (days - 1) * DAY));
const zero = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
const excluded = () =>
  syndicationMedia.size
    ? sql`AND media NOT IN (${sql.join(
        [...syndicationMedia].map((m) => sql`${m}`),
        sql`, `,
      )})`
    : sql``;

type Counts = {
  articles: number;
  social: number;
  roles: Record<string, number>;
  platforms: Record<string, number>;
  titleTags: Record<string, number>;
};

async function counts(db: Db, from: string, mediaFilter: string | null) {
  const where = mediaFilter ? sql`media = ${mediaFilter}` : sql`1 = 1 ${excluded()}`;
  const [rows] = await db.execute(sql`
    SELECT media, day, role, platform, COUNT(*) AS n,
      SUM(JSON_CONTAINS(title_tags, '"懸念"')) AS t1, SUM(JSON_CONTAINS(title_tags, '"反應"')) AS t2, SUM(JSON_CONTAINS(title_tags, '"攻擊"')) AS t3
    FROM article_writing WHERE day >= ${from} AND ${where}
    GROUP BY media, day, role, platform`);
  return rows as unknown as Array<{
    media: string;
    day: string | Date;
    role: string | null;
    platform: string | null;
    n: number;
    t1: number;
    t2: number;
    t3: number;
  }>;
}

function empty(): Counts {
  return { articles: 0, social: 0, roles: zero(ROLES), platforms: zero(PLATFORMS), titleTags: zero(TITLE_TAGS) };
}
function add(c: Counts, r: { role: string | null; platform: string | null; n: number; t1: number; t2: number; t3: number }) {
  const n = Number(r.n);
  c.articles += n;
  if (r.platform) {
    c.social += n;
    c.platforms[r.platform] = (c.platforms[r.platform] ?? 0) + n;
    if (r.role) c.roles[r.role] = (c.roles[r.role] ?? 0) + n;
  }
  c.titleTags['懸念'] += Number(r.t1);
  c.titleTags['反應'] += Number(r.t2);
  c.titleTags['攻擊'] += Number(r.t3);
}
// DATE columns arrive as UTC midnight (pool timezone 'Z').
const dayKey = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export async function writingOverview(db: Db, days: number, now = Date.now()) {
  const from = fromDay(days, now);
  const rows = await counts(db, from, null);
  const totals = empty();
  const byMedia = new Map<string, Counts>();
  const byDay = new Map<string, Counts>();
  for (const r of rows) {
    add(totals, r);
    const m = byMedia.get(r.media) ?? empty();
    add(m, r);
    byMedia.set(r.media, m);
    const k = dayKey(r.day);
    const d = byDay.get(k) ?? empty();
    add(d, r);
    byDay.set(k, d);
  }
  const [posterRows] = await db.execute(sql`
    SELECT poster, role, COUNT(*) AS n, COUNT(DISTINCT media) AS outlets FROM article_writing
    WHERE day >= ${from} AND poster IS NOT NULL AND role <> '網友民眾' ${excluded()}
    GROUP BY poster, role ORDER BY n DESC LIMIT 40`);
  return {
    generatedAt: new Date(now).toISOString(),
    version: VERSION,
    days,
    from,
    totals,
    daily: [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([day, c]) => ({ day, ...c })),
    media: [...byMedia]
      .filter(([, c]) => c.articles >= MIN_MEDIA_ARTICLES)
      .map(([media, c]) => ({ media, name: outletIdentity(media).name, ...c }))
      .sort((a, b) => b.social / b.articles - a.social / a.articles),
    posters: (posterRows as unknown as Array<{ poster: string; role: string; n: number; outlets: number }>).map((r) => ({
      name: r.poster,
      role: r.role,
      articles: Number(r.n),
      outlets: Number(r.outlets),
    })),
  };
}

export async function mediaWriting(db: Db, media: string, days: number, now = Date.now()) {
  const from = fromDay(days, now);
  const rows = await counts(db, from, media);
  const totals = empty();
  const byDay = new Map<string, Counts>();
  for (const r of rows) {
    add(totals, r);
    const k = dayKey(r.day);
    const d = byDay.get(k) ?? empty();
    add(d, r);
    byDay.set(k, d);
  }
  return {
    media,
    name: outletIdentity(media).name,
    version: VERSION,
    days,
    from,
    excludedFromStatistics: syndicationMedia.has(media),
    totals,
    daily: [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([day, c]) => ({ day, articles: c.articles, social: c.social })),
  };
}

export interface WritingListQuery {
  role?: string;
  media?: string;
  platform?: string;
  tag?: string;
  poster?: string;
  days: number;
  limit: number;
  before?: number;
}

export async function writingArticles(db: Db, q: WritingListQuery, now = Date.now()) {
  const conds = [gte(articleWriting.day, fromDay(q.days, now))];
  if (q.role) conds.push(eq(articleWriting.role, q.role));
  if (q.platform) conds.push(eq(articleWriting.platform, q.platform));
  if (q.media) conds.push(eq(articleWriting.media, q.media));
  // Syndication sites repeat other outlets' articles; list them only when asked for.
  else if (syndicationMedia.size) conds.push(notInArray(articleWriting.media, [...syndicationMedia]));
  if (q.poster) conds.push(eq(articleWriting.poster, q.poster));
  if (q.tag) conds.push(sql`JSON_CONTAINS(${articleWriting.titleTags}, ${JSON.stringify(q.tag)})`);
  else conds.push(isNotNull(articleWriting.platform));
  if (q.before) conds.push(lt(articleWriting.articleId, q.before));
  const rows = await db
    .select({
      id: articleWriting.articleId,
      media: articleWriting.media,
      publishedAt: articleWriting.publishedAt,
      platform: articleWriting.platform,
      poster: articleWriting.poster,
      role: articleWriting.role,
      evidence: articleWriting.evidence,
      titleTags: articleWriting.titleTags,
      title: articles.title,
      url: articles.url,
    })
    .from(articleWriting)
    .innerJoin(articles, eq(articles.id, articleWriting.articleId))
    .where(and(...conds))
    .orderBy(desc(articleWriting.articleId))
    .limit(q.limit);
  return {
    articles: rows.map((r) => ({ ...r, name: outletIdentity(r.media).name, publishedAt: r.publishedAt.toISOString() })),
    next: rows.length === q.limit ? rows[rows.length - 1].id : null,
  };
}

export async function articleWritingOf(db: Db, id: number) {
  const [row] = await db.select().from(articleWriting).where(eq(articleWriting.articleId, id)).limit(1);
  if (!row) return null;
  return {
    articleId: row.articleId,
    version: row.version,
    analyzedAt: row.analyzedAt.toISOString(),
    social: row.platform
      ? { platform: row.platform, poster: row.poster, role: row.role, roleSource: row.roleSource, evidence: row.evidence }
      : null,
    titleTags: row.titleTags,
  };
}

const oneOf = (value: unknown, list: readonly string[]) => (typeof value === 'string' && list.includes(value) ? value : undefined);

export function registerWriting(app: FastifyInstance, db: Db) {
  // Aggregates change slowly (the job runs every 10 minutes); share one result per window.
  const memo = new Map<string, { at: number; value: Promise<unknown> }>();
  const cached = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const hit = memo.get(key);
    if (hit && Date.now() - hit.at < 300_000) return hit.value as Promise<T>;
    const value = load();
    memo.set(key, { at: Date.now(), value });
    value.catch(() => memo.delete(key));
    return value;
  };

  app.get<{ Querystring: { days?: string } }>('/api/v1/writing', async (request, reply) => {
    const days = intIn(request.query.days, 30, 7, 90);
    reply.header('cache-control', 'public, max-age=300');
    return cached(`all:${days}`, () => writingOverview(db, days));
  });

  app.get<{ Querystring: Record<string, string | undefined> }>('/api/v1/writing/articles', async (request, reply) => {
    const q = request.query;
    const tag = oneOf(q.tag, TITLE_TAGS);
    reply.header('cache-control', 'public, max-age=120');
    return writingArticles(db, {
      role: oneOf(q.role, ROLES),
      platform: oneOf(q.platform, PLATFORMS),
      tag,
      media: typeof q.media === 'string' ? q.media.slice(0, 32) : undefined,
      poster: typeof q.poster === 'string' ? q.poster.slice(0, 40) : undefined,
      days: intIn(q.days, 30, 1, 90),
      limit: intIn(q.limit, 30, 1, 100),
      before: intIn(q.before, 0, 1, Number.MAX_SAFE_INTEGER) || undefined,
    });
  });

  app.get<{ Params: { media: string }; Querystring: { days?: string } }>('/api/v1/media/:media/writing', async (request, reply) => {
    const media = request.params.media.slice(0, 32);
    const days = intIn(request.query.days, 90, 7, 365);
    reply.header('cache-control', 'public, max-age=300');
    return cached(`${media}:${days}`, () => mediaWriting(db, media, days));
  });

  app.get<{ Params: { id: string } }>('/api/v1/articles/:id/writing', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return reply.code(400).send({ error: 'invalid article id' });
    const row = await articleWritingOf(db, id);
    if (!row) return reply.code(404).send({ error: 'not analysed' });
    reply.header('cache-control', 'public, max-age=300');
    return row;
  });
}
