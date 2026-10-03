import { and, desc, gte, inArray, lte, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags } from '../db/schema.ts';
import {
  type BylineRow,
  countSimilarity,
  type JournalistOutlet,
  type JournalistPair,
  type JournalistSimilarity,
  type JournalistSummary,
  orientPair,
  rowJournalists,
  summarizeJournalists,
} from '../journalists/aggregate.ts';
import { journalistKey } from '../journalists/names.ts';
import { type Attribution, normalizeAttributions, outletIdentity } from '../similarity/attribution.ts';
import { METHOD } from '../similarity/compute.ts';
import { computeSimilarityAsync } from '../similarity/compute-async.ts';
import type { SimilarityData } from '../similarity/types.ts';
import { type ContentStatus, contentStatus } from './article-content.ts';
import { cachedSimilarity, similarityParams } from './similarity.ts';

// Journalist pages: who is credited, where they publish, and which of their
// stories overlap with other outlets. The index reuses the similarity sample
// for its window; a person's page runs a focused comparison of that person's
// stories against same-period articles sharing a tag at other outlets.

const titles = catalog as Record<string, { title: string | null }>;
const mediaTitle = (media: string) => titles[media]?.title ?? outletIdentity(media).name;
const syndication = new Set(baseline.sources.filter((s) => s.classification === '內容').map((s) => s.media));
export const FOCUS_LIMIT = 100;
export const CANDIDATES_PER_ARTICLE = 40;
export const CANDIDATE_LIMIT = 3000;
export const CANDIDATE_WINDOW_MS = 48 * 3600e3;
export const DETAIL_MAX_HOURS = 720;
export const INDEX_LIMIT = 3000;

export interface JournalistIndex {
  generatedAt: string;
  hours: number;
  threshold: number;
  method: string;
  sample: SimilarityData['sample'];
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
  /** Whether the story was part of the focused comparison. */
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
  sample: {
    focus: number;
    focusLimit: number;
    focusTruncated: boolean;
    candidates: number;
    candidateLimit: number;
    candidatesTruncated: boolean;
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
  const window = and(gte(articles.publishedAt, new Date(now.getTime() - hours * 3600e3)), lte(articles.publishedAt, now));
  const [rows, similarity] = await Promise.all([
    db
      .select({
        id: articles.id,
        media: articles.media,
        publishedAt: articles.publishedAt,
        authors: articles.authors,
        creator: articles.creator,
        bodyStatus: articles.bodyStatus,
        hasBody: sql<number>`${articles.body} IS NOT NULL`,
        attributions: articles.attributions,
      })
      .from(articles)
      .where(and(window, or(sql`JSON_LENGTH(${articles.authors}) > 0`, sql`COALESCE(${articles.creator}, '') <> ''`))),
    cachedSimilarity(db, hours, threshold),
  ]);
  const bylines: BylineRow[] = rows.map((row) => ({ ...row, hasBody: Number(row.hasBody) === 1 }));
  const journalists = summarizeJournalists(
    bylines,
    similarity.pairs,
    similarity.sample.from ? new Date(similarity.sample.from) : null,
    mediaTitle,
  );
  const credited = new Set<number>();
  for (const row of bylines) if (rowJournalists(row).length) credited.add(row.id);
  return {
    generatedAt: now.toISOString(),
    hours,
    threshold,
    method: METHOD,
    sample: similarity.sample,
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

  // Focused comparison: the person's readable stories against other outlets'
  // same-period articles sharing at least one tag. Tags pick candidates; the
  // text comparison decides. Stories without tags get no candidates.
  const focusRows = own.filter((row) => row.bodyStatus === 'ok' && Number(row.bodyChars) > 0 && !syndication.has(row.media));
  const focus = focusRows.slice(0, FOCUS_LIMIT);
  const focusIds = new Set(focus.map((row) => row.id));
  const tags = [...new Set(focus.flatMap((row) => row.tags))].slice(0, 400);
  const candidateIds = new Map<number, number>();
  if (tags.length) {
    const earliest = new Date(Math.min(...focus.map((row) => row.publishedAt.getTime())) - CANDIDATE_WINDOW_MS);
    const latest = new Date(Math.max(...focus.map((row) => row.publishedAt.getTime())) + CANDIDATE_WINDOW_MS);
    const tagged = await db
      .select({ articleId: articleTags.articleId, tag: articleTags.tag, publishedAt: articleTags.publishedAt })
      .from(articleTags)
      .where(and(inArray(articleTags.tag, tags), gte(articleTags.publishedAt, earliest), lte(articleTags.publishedAt, latest)))
      .limit(40000);
    const byTag = new Map<string, Array<{ id: number; at: number }>>();
    for (const row of tagged) {
      if (focusIds.has(row.articleId)) continue;
      (byTag.get(row.tag) ?? byTag.set(row.tag, []).get(row.tag)!).push({ id: row.articleId, at: row.publishedAt.getTime() });
    }
    for (const row of focus) {
      const shared = new Map<number, { tags: number; distance: number }>();
      for (const tag of row.tags) {
        for (const candidate of byTag.get(tag) ?? []) {
          const distance = Math.abs(candidate.at - row.publishedAt.getTime());
          if (distance > CANDIDATE_WINDOW_MS) continue;
          const entry = shared.get(candidate.id) ?? { tags: 0, distance };
          entry.tags++;
          shared.set(candidate.id, entry);
        }
      }
      const ranked = [...shared].sort((a, b) => b[1].tags - a[1].tags || a[1].distance - b[1].distance).slice(0, CANDIDATES_PER_ARTICLE);
      for (const [id, entry] of ranked) candidateIds.set(id, Math.max(candidateIds.get(id) ?? 0, entry.tags));
    }
  }
  const candidateList = [...candidateIds].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const selected = candidateList.slice(0, CANDIDATE_LIMIT);
  const ids = [...focusIds, ...selected];
  const content = ids.length
    ? await db
        .select({
          id: articles.id,
          media: articles.media,
          title: articles.title,
          url: articles.url,
          publishedAt: articles.publishedAt,
          body: articles.body,
          bodyStatus: articles.bodyStatus,
          authors: articles.authors,
          creator: articles.creator,
          attributions: articles.attributions,
        })
        .from(articles)
        .where(and(inArray(articles.id, ids), sql`${articles.bodyStatus} = 'ok'`, sql`${articles.body} IS NOT NULL`))
    : [];
  const ordered = [
    ...content.filter((row) => focusIds.has(row.id)),
    ...content.filter((row) => !focusIds.has(row.id) && !syndication.has(row.media)),
  ];
  const result = ordered.length ? await computeSimilarityAsync(ordered, threshold, [...focusIds]) : { pairs: [] };
  const pairs = result.pairs
    .map((pair) => orientPair(pair, (article) => focusIds.has(article.id), name))
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
  const readable = own.filter((row) => row.bodyStatus === 'ok' && Number(row.bodyChars) > 0);
  const list: JournalistArticle[] = own.map((row) => {
    const chars = Number(row.bodyChars);
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
      bodyStatus: contentStatus(row.bodyStatus, chars, row.contentFetchedAt),
      bodyChars: chars,
      byline,
      coauthors: rowJournalists(row).filter((other) => other !== name),
      attributions: normalizeAttributions(row.attributions ?? [], row.media),
      matches: matches.get(row.id) ?? 0,
      compared: focusIds.has(row.id),
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
      averageChars: readable.length ? Math.round(readable.reduce((sum, row) => sum + Number(row.bodyChars), 0) / readable.length) : null,
      cited: list.filter((row) => row.attributions.length > 0).length,
      tags: [...tagCount]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'))
        .slice(0, 30)
        .map(([tag, count]) => ({ tag, count })),
      similar: countSimilarity(pairs),
    },
    media: [...media]
      .map(([key, count]) => ({ media: key, name: mediaTitle(key), count }))
      .sort((a, b) => b.count - a.count || a.media.localeCompare(b.media)),
    articles: list,
    pairs,
    sample: {
      focus: focus.length,
      focusLimit: FOCUS_LIMIT,
      focusTruncated: focusRows.length > focus.length,
      candidates: selected.length,
      candidateLimit: CANDIDATE_LIMIT,
      candidatesTruncated: candidateList.length > selected.length,
    },
  };
}

export function registerJournalists(app: FastifyInstance, db: Db) {
  const indexCache = new Map<string, { at: number; value: Promise<JournalistIndex> }>();
  const detailCache = new Map<string, { at: number; value: Promise<JournalistDetail | null> }>();
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
