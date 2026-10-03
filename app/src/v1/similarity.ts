import { and, desc, gte, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import { sourcesInGroup } from '../crawl/registry.ts';
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';
import { outletIdentity } from '../similarity/attribution.ts';
import { buildGraph, computeSimilarity, MAX_ARTICLES, METHOD } from '../similarity/compute.ts';
import type { SimilarityData } from '../similarity/types.ts';

export function similarityParams(query: { hours?: string; threshold?: string }) {
  const hours = Number(query.hours ?? 48),
    threshold = Number(query.threshold ?? 0.65);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168 || !Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) return null;
  return { hours, threshold };
}
export async function loadSimilarity(db: Db, hours: number, threshold: number, now = new Date()): Promise<SimilarityData> {
  const window = and(gte(articles.publishedAt, new Date(now.getTime() - hours * 3600e3)), lte(articles.publishedAt, now));
  const counts = await db
    .select({
      media: articles.media,
      total: sql<number>`COUNT(*)`,
      fetched: sql<number>`SUM(${articles.contentFetchedAt} IS NOT NULL)`,
      usable: sql<number>`SUM(${articles.bodyStatus} = 'ok' AND ${articles.body} IS NOT NULL)`,
      withAuthors: sql<number>`SUM(JSON_LENGTH(${articles.authors}) > 0 OR COALESCE(${articles.creator}, '') <> '')`,
    })
    .from(articles)
    .where(window)
    .groupBy(articles.media);
  const active = new Set([...sourcesInGroup('news'), ...sourcesInGroup('hourly')].map((s) => s.media));
  const syndication = new Set(baseline.sources.filter((s) => s.classification === '內容').map((s) => s.media));
  const allMedia = new Set([...baseline.sources.map((s) => s.media), ...counts.map((s) => s.media)]);
  const coverage = [...allMedia].map((media) => {
    const c = counts.find((c) => c.media === media);
    const total = Number(c?.total ?? 0),
      fetched = Number(c?.fetched ?? 0),
      usable = Number(c?.usable ?? 0);
    return {
      media,
      name: outletIdentity(media).name,
      total,
      fetched,
      usable,
      withAuthors: Number(c?.withAuthors ?? 0),
      missing: fetched - usable,
      pending: total - fetched,
      enabled: active.has(media),
      excludedFromStatistics: syndication.has(media),
    };
  });
  // Bound CPU and memory; show the exact sample and truncation to readers.
  // Missing-body articles remain visible in coverage but cannot imply no match.
  const rows = await db
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
    .where(
      and(
        window,
        sql`${articles.bodyStatus} = 'ok'`,
        sql`${articles.body} IS NOT NULL`,
        ...(syndication.size
          ? [
              sql`${articles.media} NOT IN (${sql.join(
                [...syndication].map((s) => sql`${s}`),
                sql`, `,
              )})`,
            ]
          : []),
      ),
    )
    .orderBy(desc(articles.publishedAt), desc(articles.id))
    .limit(MAX_ARTICLES);
  const result = computeSimilarity(rows, threshold);
  const available = coverage.filter((c) => !c.excludedFromStatistics).reduce((sum, c) => sum + c.usable, 0);
  return {
    generatedAt: now.toISOString(),
    hours,
    threshold,
    method: METHOD,
    coverage,
    sample: {
      available,
      analyzed: result.analyzed,
      limit: MAX_ARTICLES,
      truncated: available > rows.length,
      pairsTruncated: result.pairsTruncated,
    },
    pairs: result.pairs,
    ...buildGraph(rows, result.pairs),
  };
}
export function registerSimilarity(app: FastifyInstance, db: Db) {
  // Share pending requests, cap cache variants, and expire after one minute.
  const cache = new Map<string, { at: number; value: Promise<SimilarityData> }>();
  app.get<{ Querystring: { hours?: string; threshold?: string } }>('/api/v1/similarity', async (request, reply) => {
    const params = similarityParams(request.query);
    if (!params) return reply.code(400).send({ error: 'hours must be an integer 1–168; threshold must be 0.5–1' });
    const key = `${params.hours}:${params.threshold}`;
    let entry = cache.get(key);
    if (!entry || Date.now() - entry.at > 60000) {
      if (cache.size >= 8) cache.delete(cache.keys().next().value as string);
      entry = { at: Date.now(), value: loadSimilarity(db, params.hours, params.threshold) };
      cache.set(key, entry);
    }
    try {
      const data = await entry.value;
      reply.header('cache-control', 'public, max-age=60');
      return data;
    } catch (error) {
      cache.delete(key);
      throw error;
    }
  });
}
