import { and, desc, gte, lte, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';
import {
  type BylineRow,
  countSimilarity,
  countUnmatched,
  type JournalistOutlet,
  type JournalistPair,
  type JournalistSimilarity,
  type JournalistSummary,
  orientPair,
  rowJournalists,
  summarizeJournalists,
} from '../journalists/aggregate.ts';
import { journalistKey } from '../journalists/names.ts';
import { startRemovalRequestSync } from '../journalists/removal-requests.ts';
import { type Attribution, normalizeAttributions, outletIdentity } from '../similarity/attribution.ts';
import { METHOD } from '../similarity/compute.ts';
import { loadArticles, pairsOfArticles, toPair, WINDOW_DAYS } from '../similarity/store.ts';
import type { SimilarityIndexStats } from '../similarity/types.ts';
import { type ContentStatus, contentStatus, publicContentState } from './article-content.ts';
import { cachedIndexView, similarityParams } from './similarity.ts';

// Journalist pages: who is credited, where they publish, and which of their
// stories overlap with other outlets. The index reuses the similarity sample
// for its window; a person's page runs a focused comparison of that person's
// stories against same-period articles sharing a tag at other outlets.

const titles = catalog as Record<string, { title: string | null }>;
const mediaTitle = (media: string) => titles[media]?.title ?? outletIdentity(media).name;
const syndication = new Set(baseline.sources.filter((s) => s.classification === '內容').map((s) => s.media));
export const DETAIL_MAX_HOURS = 720;
export const INDEX_LIMIT = 3000;

export interface JournalistIndex {
  generatedAt: string;
  hours: number;
  threshold: number;
  method: string;
  /** Similarity index coverage of the period. */
  index: Pick<SimilarityIndexStats, 'analyzed' | 'pairs' | 'windowDays'> & { from: string };
  totals: { journalists: number; articles: number; credited: number };
  limit: number;
  journalists: JournalistSummary[];
}
export interface JournalistArticle {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: Date;
  tags: string[];
  bodyStatus: ContentStatus;
  bodyChars: number;
  /** The byline exactly as the publisher wrote it. */
  byline: string[];
  coauthors: string[];
  attributions: Attribution[];
  /** Similar articles at other outlets found for this story. */
  matches: number;
  /** Whether the similarity index has compared the story. */
  compared: boolean;
}
export interface JournalistDetail {
  name: string;
  generatedAt: string;
  hours: number;
  threshold: number;
  method: string;
  stats: {
    articles: number;
    withBody: number;
    averageChars: number | null;
    cited: number;
    tags: Array<{ tag: string; count: number }>;
    similar: JournalistSimilarity;
  };
  media: JournalistOutlet[];
  articles: JournalistArticle[];
  pairs: JournalistPair[];
  index: {
    /** Own stories the index compared with every other outlet. */
    compared: number;
    /** Compared articles with no similar counterpart; not proof of originality. */
    unmatched: number;
    /** Own stories with a usable body still waiting for the index. */
    pending: number;
    windowDays: number;
  };
}

export function journalistParams(query: { hours?: string; threshold?: string; limit?: string }, maxHours: number, defaultHours: number) {
  const hours = Number(query.hours ?? defaultHours),
    threshold = Number(query.threshold ?? 0.65),
    limit = Number(query.limit ?? 500);
  if (!Number.isInteger(hours) || hours < 1 || hours > maxHours) return null;
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) return null;
  if (!Number.isInteger(limit) || limit < 1 || limit > INDEX_LIMIT) return null;
  return { hours, threshold, limit };
}
/** A page key must look like a name someone could be credited as: short, printable, no wildcards. */
export function journalistName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = journalistKey(value);
  if (key.length < 2 || key.length > 40 || /[%_\\\p{C}]/u.test(key)) return null;
  return key;
}

export async function loadJournalistIndex(
  db: Db,
  hours: number,
  threshold: number,
  limit: number,
  now = new Date(),
): Promise<JournalistIndex> {
  const params = similarityParams({ hours: String(hours), threshold: String(threshold) }, now)!;
  const window = and(gte(articles.publishedAt, params.from), lte(articles.publishedAt, params.to));
  const [rows, view] = await Promise.all([
    db
      .select({
        id: articles.id,
        media: articles.media,
        publishedAt: articles.publishedAt,
        authors: articles.authors,
        creator: articles.creator,
        bodyStatus: articles.bodyStatus,
        hasBody: sql<number>`${articles.body} IS NOT NULL`,
        indexed: sql<number>`${articles.similarityAt} IS NOT NULL`,
        attributions: articles.attributions,
      })
      .from(articles)
      .where(and(window, or(sql`JSON_LENGTH(${articles.authors}) > 0`, sql`COALESCE(${articles.creator}, '') <> ''`))),
    cachedIndexView(db, params),
  ]);
  const bylines: BylineRow[] = rows.map((row) => ({
    ...row,
    hasBody: Number(row.hasBody) === 1,
    indexed: Number(row.indexed) === 1 && row.bodyStatus === 'ok' && Number(row.hasBody) === 1,
  }));
  const credited = new Set<number>();
  for (const row of bylines) if (rowJournalists(row).length) credited.add(row.id);
  // Only pairs touching a credited story can count for anyone.
  const relevant = view.pairs.filter((pair) => credited.has(pair.aId) || credited.has(pair.bId));
  const byId = await loadArticles(
    db,
    relevant.flatMap((pair) => [pair.aId, pair.bId]),
  );
  const pairs = relevant.map((pair) => toPair(pair, byId)).filter((pair) => pair !== null);
  const journalists = summarizeJournalists(bylines, pairs, mediaTitle);
  return {
    generatedAt: now.toISOString(),
    hours,
    threshold,
    method: METHOD,
    index: {
      analyzed: [...view.analyzed.values()].reduce((sum, n) => sum + n, 0),
      pairs: view.pairs.length,
      windowDays: WINDOW_DAYS,
      from: params.from.toISOString(),
    },
    totals: { journalists: journalists.length, articles: credited.size, credited: bylines.length },
    limit,
    journalists: journalists.slice(0, limit),
  };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

export async function loadJournalist(
  db: Db,
  name: string,
  hours: number,
  threshold: number,
  now = new Date(),
): Promise<JournalistDetail | null> {
  const from = new Date(now.getTime() - hours * 3600e3);
  const pattern = `%${escapeLike(name)}%`;
  const rows = await db
    .select({
      id: articles.id,
      media: articles.media,
      title: articles.title,
      url: articles.url,
      image: articles.image,
      publishedAt: articles.publishedAt,
      tags: articles.tags,
      authors: articles.authors,
      creator: articles.creator,
      bodyStatus: articles.bodyStatus,
      bodyChars: sql<number>`CHAR_LENGTH(COALESCE(${articles.body}, ''))`,
      contentFetchedAt: articles.contentFetchedAt,
      similarityAt: articles.similarityAt,
      attributions: articles.attributions,
    })
    .from(articles)
    .where(
      and(
        gte(articles.publishedAt, from),
        lte(articles.publishedAt, now),
        or(sql`${articles.authors} LIKE ${pattern}`, sql`${articles.creator} LIKE ${pattern}`),
      ),
    )
    .orderBy(desc(articles.publishedAt), desc(articles.id))
    .limit(1000);
  const own = rows.filter((row) => rowJournalists(row).includes(name));
  if (!own.length) return null;

  // Every pair the index stored for these stories, against all other
  // outlets' articles published within the comparison window.
  const indexed = new Set(own.filter((row) => row.similarityAt && !syndication.has(row.media)).map((row) => row.id));
  const stored = indexed.size ? await pairsOfArticles(db, [...indexed], threshold) : [];
  const pairs = stored
    .map((pair) => orientPair(pair, (article) => indexed.has(article.id), name))
    .filter((pair): pair is JournalistPair => pair !== null)
    .sort((a, b) => b.score - a.score || Date.parse(b.own.publishedAt) - Date.parse(a.own.publishedAt));
  const matches = new Map<number, number>();
  for (const pair of pairs) matches.set(pair.own.id, (matches.get(pair.own.id) ?? 0) + 1);

  const media = new Map<string, number>();
  const tagCount = new Map<string, number>();
  for (const row of own) {
    media.set(row.media, (media.get(row.media) ?? 0) + 1);
    for (const tag of new Set(row.tags)) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
  }
  // Comparisons above use every stored body; what readers see about each body
  // (status, length, counts) follows the public reading window.
  const shown = new Map(
    own.map((row) => {
      const chars = Number(row.bodyChars);
      return [row.id, publicContentState(contentStatus(row.bodyStatus, chars, row.contentFetchedAt), chars, row.publishedAt, now)];
    }),
  );
  const readable = own.filter((row) => shown.get(row.id)!.status === 'ok' && shown.get(row.id)!.chars > 0);
  const list: JournalistArticle[] = own.map((row) => {
    const state = shown.get(row.id)!;
    const byline = row.authors?.length ? row.authors : row.creator?.trim() ? [row.creator.trim()] : [];
    return {
      id: row.id,
      media: row.media,
      mediaTitle: mediaTitle(row.media),
      title: row.title,
      url: row.url,
      image: row.image,
      publishedAt: row.publishedAt,
      tags: row.tags,
      bodyStatus: state.status,
      bodyChars: state.chars,
      byline,
      coauthors: rowJournalists(row).filter((other) => other !== name),
      attributions: normalizeAttributions(row.attributions ?? [], row.media),
      matches: matches.get(row.id) ?? 0,
      compared: indexed.has(row.id),
    };
  });
  return {
    name,
    generatedAt: now.toISOString(),
    hours,
    threshold,
    method: METHOD,
    stats: {
      articles: own.length,
      withBody: readable.length,
      averageChars: readable.length ? Math.round(readable.reduce((sum, row) => sum + shown.get(row.id)!.chars, 0) / readable.length) : null,
      cited: list.filter((row) => row.attributions.length > 0).length,
      tags: [...tagCount]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'))
        .slice(0, 30)
        .map(([tag, count]) => ({ tag, count })),
      similar: countSimilarity(pairs, new Set(own.map((row) => row.id))),
    },
    media: [...media]
      .map(([key, count]) => ({ media: key, name: mediaTitle(key), count }))
      .sort((a, b) => b.count - a.count || a.media.localeCompare(b.media)),
    articles: list,
    pairs,
    index: {
      compared: indexed.size,
      unmatched: countUnmatched(pairs, indexed),
      pending: own.filter((row) => !row.similarityAt && row.bodyStatus === 'ok' && Number(row.bodyChars) > 0 && !syndication.has(row.media))
        .length,
      windowDays: WINDOW_DAYS,
    },
  };
}

export function registerJournalists(app: FastifyInstance, db: Db) {
  const indexCache = new Map<string, { at: number; value: Promise<JournalistIndex> }>();
  const detailCache = new Map<string, { at: number; value: Promise<JournalistDetail | null> }>();
  // Removal requests filed on GitHub take effect without a deploy; tests and
  // JOURNALIST_REMOVAL_SYNC=0 skip the network.
  if (process.env.JOURNALIST_REMOVAL_SYNC !== '0' && !process.env.VITEST) {
    const sync = startRemovalRequestSync({
      log: app.log,
      onChange: () => {
        indexCache.clear();
        detailCache.clear();
      },
    });
    app.addHook('onClose', async () => sync.stop());
  }
  const remember = <T>(
    cache: Map<string, { at: number; value: Promise<T> }>,
    key: string,
    ttl: number,
    size: number,
    load: () => Promise<T>,
  ) => {
    let entry = cache.get(key);
    if (!entry || Date.now() - entry.at > ttl) {
      if (cache.size >= size) cache.delete(cache.keys().next().value as string);
      entry = { at: Date.now(), value: load() };
      cache.set(key, entry);
      entry.value.catch(() => cache.delete(key));
    }
    return entry.value;
  };
  app.get<{ Querystring: { hours?: string; threshold?: string; limit?: string } }>('/api/v1/journalists', async (request, reply) => {
    const params = journalistParams(request.query, 168, 48);
    if (!params || !similarityParams({ hours: String(params.hours), threshold: String(params.threshold) }))
      return reply.code(400).send({ error: `hours must be an integer 1–168; threshold must be 0.5–1; limit must be 1–${INDEX_LIMIT}` });
    const data = await remember(indexCache, `${params.hours}:${params.threshold}:${params.limit}`, 120_000, 16, () =>
      loadJournalistIndex(db, params.hours, params.threshold, params.limit),
    );
    reply.header('cache-control', 'public, max-age=120');
    return data;
  });
  app.get<{ Params: { name: string }; Querystring: { hours?: string; threshold?: string } }>(
    '/api/v1/journalists/:name',
    async (request, reply) => {
      const name = journalistName(request.params.name);
      if (!name) return reply.code(400).send({ error: 'name must be 2–40 printable characters' });
      const params = journalistParams(request.query, DETAIL_MAX_HOURS, 168);
      if (!params) return reply.code(400).send({ error: `hours must be an integer 1–${DETAIL_MAX_HOURS}; threshold must be 0.5–1` });
      const data = await remember(detailCache, `${name}:${params.hours}:${params.threshold}`, 300_000, 64, () =>
        loadJournalist(db, name, params.hours, params.threshold),
      );
      if (!data) return reply.code(404).send({ error: 'no article credits this name in the period' });
      reply.header('cache-control', 'public, max-age=300');
      return data;
    },
  );
}
