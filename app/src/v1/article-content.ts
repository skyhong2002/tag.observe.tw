import { and, desc, eq, exists, gte, inArray, lt, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import reviewedPublications from '../../data/reviewed-publications.json' with { type: 'json' };
import { BODY_RETENTION_MS, bodyIsPublic, publicBodyUntil } from '../article-retention.ts';
import { normalizeAuthorCredits } from '../crawl/byline.ts';
import { excludedMedia, sourceByMedia } from '../crawl/registry.ts';
import { urlKey } from '../crawl/text.ts';
import type { Db } from '../db/client.ts';
import { articleDiscoveries, articles } from '../db/schema.ts';
import { type ArticleCollection, collectionsForArticle } from '../jobs/topic-stories.ts';
import { touchArticleContent } from '../nearline/content.ts';
import { type Attribution, normalizeAttributions, type OutletIdentity, outletIdentity } from '../similarity/attribution.ts';

export type ContentStatus = 'ok' | 'short' | 'missing' | 'blocked' | 'error' | 'not_fetched' | 'expired';
export interface DiscoverySource {
  media: string;
  title: string;
  url: string;
  discoveredAt: Date;
}
export interface ContentArticle {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: Date;
  publishedDate?: string;
  publishedDatePrecision?: 'day';
  tags: string[];
  description: string | null;
  summary: string | null;
  summarySource: string | null;
  authors: string[];
  publisher: OutletIdentity;
  discoverySources?: DiscoverySource[];
  collections?: ArticleCollection[];
}
export interface ArticleContentResponse {
  article: ContentArticle;
  content: {
    status: ContentStatus;
    body: string | null;
    chars: number;
    source: string | null;
    fetchedAt: Date | null;
    expiresAt: Date | null;
    attributions: Attribution[];
  };
}
export interface MediaContentResponse {
  media: string;
  title: string;
  sourceKind: 'discovery' | 'publisher';
  publisher: OutletIdentity | null;
  limit: number;
  count: number;
  nextCursor: string | null;
  articles: Array<ContentArticle & { bodyStatus: ContentStatus; bodyChars: number; contentFetchedAt: Date | null }>;
}
const titles = catalog as Record<string, { title: string | null }>;
export const CONTENT_PAGE_LIMIT = 100;
export const isDiscoverySource = (media: string) => media === 'google_news' || media === 'dongtaiwang';
export function parseContentId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,15}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
export function parseContentPage(query: { cursor?: string; limit?: string; hours?: string; q?: string }): {
  cursor: number | null;
  limit: number;
  hours?: number;
  q?: string;
} | null {
  const cursor = query.cursor === undefined ? null : parseContentId(query.cursor);
  if (query.cursor !== undefined && cursor === null) return null;
  const limit = query.limit === undefined ? 40 : parseContentId(query.limit);
  if (limit === null || limit > CONTENT_PAGE_LIMIT) return null;
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.trim().length > 60)) return null;
  const keyword = query.q?.trim() ? { q: query.q.trim() } : {};
  if (query.hours !== undefined) {
    const hours = parseContentId(query.hours);
    if (hours === null || hours > 168) return null;
    return { cursor, limit, hours, ...keyword };
  }
  return { cursor, limit, ...keyword };
}
export function contentStatus(status: string | null, chars: number, fetchedAt: Date | null): ContentStatus {
  if (status === 'expired' || status === 'blocked' || status === 'missing' || status === 'error' || status === 'short') return status;
  if (status === 'ok') return chars > 0 ? 'ok' : 'missing';
  if (status !== null) return 'error';
  if (chars > 0) return 'short';
  return fetchedAt ? 'missing' : 'not_fetched';
}
/**
 * What readers may know about a body. Outside the public window the body is
 * reported exactly like a deleted one: no text, zero length, status expired.
 * Reasons that say nothing about storage (blocked, missing, error) stay as they are.
 */
export function publicContentState(
  status: ContentStatus,
  chars: number,
  publishedAt: Date,
  now = new Date(),
): { status: ContentStatus; chars: number; visible: boolean } {
  if (bodyIsPublic(publishedAt, now)) return { status, chars, visible: true };
  const kept = status === 'blocked' || status === 'missing' || status === 'error';
  return { status: kept ? status : 'expired', chars: 0, visible: false };
}
const metadata = {
  id: articles.id,
  media: articles.media,
  title: articles.title,
  url: articles.url,
  image: articles.image,
  publishedAt: articles.publishedAt,
  tags: articles.tags,
  description: articles.description,
  summary: articles.summary,
  summarySource: articles.summarySource,
  authors: articles.authors,
  creator: articles.creator,
};
type MetadataRow = {
  id: number;
  media: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: Date;
  tags: string[];
  description: string | null;
  summary: string | null;
  summarySource: string | null;
  authors: string[] | null;
  creator: string | null;
};
export function contentArticle(row: MetadataRow): ContentArticle {
  const publication = (reviewedPublications as Record<string, { publishedDate: string; datePrecision: string }>)[row.url];
  const dateOnly = publication?.datePrecision === 'day' && row.publishedAt.toISOString().slice(0, 10) === publication.publishedDate;
  const authors = row.authors?.map((a) => a.trim()).filter(Boolean) ?? [];
  return {
    id: row.id,
    media: row.media,
    mediaTitle: titles[row.media]?.title ?? row.media,
    title: row.title,
    url: row.url,
    image: row.image,
    publishedAt: row.publishedAt,
    ...(dateOnly ? { publishedDate: publication.publishedDate, publishedDatePrecision: 'day' as const } : {}),
    tags: row.tags,
    description: row.description,
    summary: row.summary ?? null,
    summarySource: row.summarySource ?? null,
    authors: normalizeAuthorCredits(authors.length ? authors : row.creator?.trim() ? [row.creator.trim()] : []),
    publisher: outletIdentity(row.media),
  };
}
async function loadDiscoverySources(db: Db, ids: number[]): Promise<Map<number, DiscoverySource[]>> {
  const result = new Map<number, DiscoverySource[]>();
  if (!ids.length) return result;
  const rows = await db
    .select({
      articleId: articleDiscoveries.articleId,
      media: articleDiscoveries.media,
      url: articleDiscoveries.discoveryUrl,
      discoveredAt: articleDiscoveries.discoveredAt,
    })
    .from(articleDiscoveries)
    .where(inArray(articleDiscoveries.articleId, ids));
  rows.sort((a, b) => a.discoveredAt.getTime() - b.discoveredAt.getTime() || a.media.localeCompare(b.media));
  for (const row of rows) {
    const sources = result.get(row.articleId) ?? [];
    sources.push({ media: row.media, title: titles[row.media]?.title ?? row.media, url: row.url, discoveredAt: row.discoveredAt });
    result.set(row.articleId, sources);
  }
  return result;
}
export async function loadArticleContent(db: Db, id: number, now = new Date()): Promise<ArticleContentResponse | null> {
  const [row] = await db
    .select({
      ...metadata,
      urlKey: articles.urlKey,
      body: articles.body,
      bodyStatus: articles.bodyStatus,
      bodySource: articles.bodySource,
      contentFetchedAt: articles.contentFetchedAt,
      crawledAt: articles.crawledAt,
      attributions: articles.attributions,
    })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (!row) return null;
  const [discoveries, collections] = await Promise.all([
    loadDiscoverySources(db, [id]),
    collectionsForArticle(db, row.media, row.urlKey ?? urlKey(row.url, sourceByMedia(row.media)?.list.articleId), row.url),
  ]);
  const stored = row.body?.trim() ? row.body : null;
  const storedChars = stored ? Array.from(stored).length : 0;
  const state = publicContentState(contentStatus(row.bodyStatus, storedChars, row.contentFetchedAt), storedChars, row.publishedAt, now);
  // The reader-facing deadline: the end of the public window, or the storage
  // deadline if that somehow comes first. Never reveals storage beyond it.
  const storageUntil = new Date((row.contentFetchedAt ?? row.crawledAt).getTime() + BODY_RETENTION_MS);
  const publicUntil = publicBodyUntil(row.publishedAt);
  const deadline = storageUntil < publicUntil ? storageUntil : publicUntil;
  return {
    article: { ...contentArticle(row), discoverySources: discoveries.get(id) ?? [], collections },
    content: {
      status: state.status,
      body: state.visible ? stored : null,
      chars: state.chars,
      source: state.visible ? row.bodySource : null,
      fetchedAt: row.contentFetchedAt,
      expiresAt: stored || state.status === 'expired' ? deadline : null,
      attributions: normalizeAttributions(row.attributions ?? [], row.media),
    },
  };
}
export async function loadMediaContent(
  db: Db,
  media: string,
  query: { cursor: number | null; limit: number; hours?: number; q?: string },
  now = new Date(),
): Promise<MediaContentResponse> {
  const discovery = isDiscoverySource(media);
  const keyword = query.q?.replace(/[\\%_]/g, '\\$&');
  // Select character counts, never full bodies, on this bounded listing. Reads
  // use existing stored records only and cannot trigger a fetch of the source.
  const rows = await db
    .select({
      ...metadata,
      bodyStatus: articles.bodyStatus,
      contentFetchedAt: articles.contentFetchedAt,
      bodyChars: sql<number>`COALESCE(CHAR_LENGTH(${articles.body}), 0)`,
    })
    .from(articles)
    .where(
      and(
        discovery
          ? exists(
              sql`(SELECT 1 FROM ${articleDiscoveries} WHERE ${articleDiscoveries.articleId} = ${articles.id} AND ${articleDiscoveries.media} = ${media})`,
            )
          : eq(articles.media, media),
        query.cursor ? lt(articles.id, query.cursor) : undefined,
        query.hours ? gte(articles.publishedAt, new Date(now.getTime() - query.hours * 3600e3)) : undefined,
        keyword
          ? or(
              sql`${articles.title} LIKE ${`%${keyword}%`}`,
              sql`${articles.description} LIKE ${`%${keyword}%`}`,
              sql`${articles.summary} LIKE ${`%${keyword}%`}`,
              sql`JSON_CONTAINS(${articles.tags}, JSON_QUOTE(${query.q}))`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(articles.id))
    .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);
  const discoveries = await loadDiscoverySources(
    db,
    page.map((row) => row.id),
  );
  return {
    media,
    title: titles[media]?.title ?? media,
    sourceKind: discovery ? 'discovery' : 'publisher',
    publisher: discovery ? null : outletIdentity(media),
    limit: query.limit,
    count: page.length,
    nextCursor: rows.length > query.limit ? String(page.at(-1)!.id) : null,
    articles: page.map((row) => {
      const chars = Number(row.bodyChars);
      const state = publicContentState(contentStatus(row.bodyStatus, chars, row.contentFetchedAt), chars, row.publishedAt, now);
      return {
        ...contentArticle(row),
        discoverySources: discoveries.get(row.id) ?? [],
        bodyStatus: state.status,
        bodyChars: state.chars,
        contentFetchedAt: row.contentFetchedAt,
      };
    }),
  };
}
export function registerArticleContent(app: FastifyInstance, db: Db) {
  app.get<{ Params: { id: string } }>('/api/v1/articles/:id/content', async (request, reply) => {
    const id = parseContentId(request.params.id);
    if (id === null) return reply.code(400).send({ error: 'bad article id' });
    const result = await loadArticleContent(db, id);
    if (!result) return reply.code(404).send({ error: 'article not found' });
    if (result.content.body || result.article.description) {
      await touchArticleContent(db, id);
    }
    reply.header('cache-control', 'public, max-age=60');
    return result;
  });
  app.get<{ Params: { media: string }; Querystring: { cursor?: string; limit?: string; hours?: string; q?: string } }>(
    '/api/v1/media/:media/content',
    async (request, reply) => {
      const { media } = request.params;
      if (!Object.hasOwn(titles, media) || excludedMedia.has(media)) return reply.code(404).send({ error: 'unknown media' });
      const query = parseContentPage(request.query);
      if (!query)
        return reply
          .code(400)
          .send({ error: 'bad cursor, limit, hours or q; limit must be 1–100, hours 1–168 and q at most 60 characters' });
      reply.header('cache-control', 'public, max-age=60');
      return loadMediaContent(db, media, query);
    },
  );
}
