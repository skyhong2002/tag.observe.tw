import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import traffic from '../../data/media-traffic.json' with { type: 'json' };
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import { allSources, excludedMedia } from '../crawl/registry.ts';
import type { Db } from '../db/client.ts';
import { articleDiscoveries, articles } from '../db/schema.ts';
import { publisherDomains } from '../jobs/media-traffic-job.ts';
import { readLiveTraffic } from '../media-traffic/live.ts';
import { readRadar } from '../media-traffic/radar.ts';
import { isDiscoverySource } from './article-content.ts';
import { listedMediaSources } from './media-stats.ts';

export interface MediaTrafficComparison {
  generatedAt: string;
  collectionStartedAt: string | null;
  months: string[];
  media: Array<{
    media: string;
    sourceKind: 'publisher' | 'discovery';
    firstAcquiredAt: string | null;
    monthly: Array<{ month: string; articles: number }>;
  }>;
}
const HOUR = 3600e3;
const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(4)) - 1;
const monthKey = (index: number) => `${Math.floor(index / 12)}${String((index % 12) + 1).padStart(2, '0')}`;
export const taipeiPublicationMonth = (date: Date) => new Date(date.getTime() + 8 * HOUR).toISOString().slice(0, 7).replace('-', '');
export function trafficComparisonMonths(now: Date, snapshots: string[]): string[] {
  const current = taipeiPublicationMonth(now);
  const reference = snapshots.filter((month) => /^\d{4}(?:0[1-9]|1[0-2])$/.test(month) && month <= current);
  const end = monthIndex(current);
  const start = Math.max(end - 23, Math.min(end, ...reference.map(monthIndex)));
  // Keep historical reference months even after they leave the rolling window;
  // do not manufacture an unbounded sequence of intervening empty months.
  return [...new Set([...reference, ...Array.from({ length: end - start + 1 }, (_, i) => monthKey(start + i))])].sort();
}
export function taipeiMonthStart(month: string): Date {
  if (!/^\d{4}(?:0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
  return new Date(`${month.slice(0, 4)}-${month.slice(4)}-01T00:00:00+08:00`);
}
export function monthlyArticleFilter(from: Date, now: Date) {
  return and(
    eq(articles.source, 'own'),
    gte(articles.publishedAt, from),
    lte(articles.publishedAt, now),
    sql`NOT (${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt})`,
  );
}
export const publicationMonthSql = () => sql<string>`DATE_FORMAT(DATE_ADD(${articles.publishedAt}, INTERVAL 8 HOUR), '%Y%m')`;
type MonthlyRow = { media: string; month: string; count: number | string };
type FirstRow = { media: string; first: Date | string | null };
function utcIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function assembleTrafficComparison(
  now: Date,
  months: string[],
  sources: Array<{ media: string }>,
  publisherMonths: MonthlyRow[],
  publisherFirsts: FirstRow[],
  discoveryMonths: MonthlyRow[],
  discoveryFirsts: FirstRow[],
): MediaTrafficComparison {
  const firstBy = new Map(
    [...publisherFirsts.filter((row) => !isDiscoverySource(row.media)), ...discoveryFirsts].map((row) => [row.media, utcIso(row.first)]),
  );
  const byMonth = new Map(
    [...publisherMonths.filter((row) => !isDiscoverySource(row.media)), ...discoveryMonths].map((row) => [
      `${row.media}:${row.month}`,
      Number(row.count),
    ]),
  );
  const starts = publisherFirsts
    .map((row) => utcIso(row.first))
    .filter((value): value is string => value !== null)
    .sort();
  return {
    generatedAt: now.toISOString(),
    collectionStartedAt: starts[0] ?? null,
    months,
    media: [...new Set(sources.map((source) => source.media))].map((media) => ({
      media,
      sourceKind: isDiscoverySource(media) ? 'discovery' : 'publisher',
      firstAcquiredAt: firstBy.get(media) ?? null,
      monthly: months.map((month) => ({ month, articles: byMonth.get(`${media}:${month}`) ?? 0 })),
    })),
  };
}
export async function loadMediaTrafficComparison(db: Db, now = new Date()): Promise<MediaTrafficComparison> {
  const months = trafficComparisonMonths(
    now,
    traffic.snapshots.map((snapshot) => snapshot.month),
  );
  const filter = monthlyArticleFilter(taipeiMonthStart(months[0]), now);
  const month = publicationMonthSql();
  const [publisherMonths, publisherFirsts, discoveryMonths, discoveryFirsts] = await Promise.all([
    db.select({ media: articles.media, month, count: sql<number>`COUNT(*)` }).from(articles).where(filter).groupBy(articles.media, month),
    db
      .select({ media: articles.media, first: sql<Date | string | null>`MIN(${articles.crawledAt})` })
      .from(articles)
      .where(and(eq(articles.source, 'own'), lte(articles.crawledAt, now)))
      .groupBy(articles.media),
    db
      .select({ media: articleDiscoveries.media, month, count: sql<number>`COUNT(DISTINCT ${articles.id})` })
      .from(articleDiscoveries)
      .innerJoin(articles, eq(articles.id, articleDiscoveries.articleId))
      .where(and(filter, lte(articleDiscoveries.discoveredAt, now)))
      .groupBy(articleDiscoveries.media, month),
    db
      .select({ media: articleDiscoveries.media, first: sql<Date | string | null>`MIN(${articleDiscoveries.discoveredAt})` })
      .from(articleDiscoveries)
      .innerJoin(articles, eq(articles.id, articleDiscoveries.articleId))
      .where(and(eq(articles.source, 'own'), lte(articleDiscoveries.discoveredAt, now)))
      .groupBy(articleDiscoveries.media),
  ]);
  return assembleTrafficComparison(
    now,
    months,
    [...catalog.sources.filter((source) => !excludedMedia.has(source.media)), ...listedMediaSources(allSources())],
    publisherMonths,
    publisherFirsts,
    discoveryMonths,
    discoveryFirsts,
  );
}
/** Cache only successful reads and share one in-flight load among concurrent requests. */
export function trafficComparisonCache<T>(load: () => Promise<T>, clock = Date.now, ttlMs = 300_000): () => Promise<T> {
  let cached: { value: T; expiresAt: number } | undefined;
  let pending: Promise<T> | undefined;
  return () => {
    if (cached && cached.expiresAt > clock()) return Promise.resolve(cached.value);
    if (!pending) {
      pending = Promise.resolve()
        .then(load)
        .then((value) => {
          cached = { value, expiresAt: clock() + ttlMs };
          return value;
        })
        .finally(() => {
          pending = undefined;
        });
    }
    return pending;
  };
}
export function registerMediaTrafficComparison(app: FastifyInstance, db: Db) {
  const load = trafficComparisonCache(() => loadMediaTrafficComparison(db));
  const visible = new Set(publisherDomains());
  app.get('/api/v1/media-radar', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=60');
    const snapshot = await readRadar();
    return { ...snapshot, domains: snapshot.domains.filter((row) => visible.has(row.domain)) };
  });
  app.get('/api/v1/media-traffic-live', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=60');
    const { failedAt = {}, ...snapshot } = await readLiveTraffic();
    return {
      ...snapshot,
      domains: snapshot.domains.filter((row) => visible.has(row.domain)),
      failedAt: Object.fromEntries(Object.entries(failedAt).filter(([domain]) => visible.has(domain))),
    };
  });
  app.get('/api/v1/media-traffic-comparison', async (_request, reply) => {
    const result = await load();
    reply.header('cache-control', 'public, max-age=300');
    return result;
  });
}
