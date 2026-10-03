import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import disabledSpec from '../../data/crawl-disabled.json' with { type: 'json' };
import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import catalog from '../../data/media-catalog.json' with { type: 'json' };
import { allSources, disabled } from '../crawl/registry.ts';
import type { Db } from '../db/client.ts';
import { articleDiscoveries, articles, crawlRuns } from '../db/schema.ts';
import { isDiscoverySource } from './article-content.ts';
import { campOf } from './coverage.ts';
import { iconUrl } from './icons.ts';
import { CATEGORY_LABELS } from './routes.ts';

// Per-media article counts and crawl health for the public /media/ dashboard.
const info = favicons as unknown as Record<string, { icon: string | null; title: string | null }>;
const categories = catalog.categories as Record<string, string[]>;
const SKIP_CATEGORY = new Set(['blue', 'green', 'adct']); // overlays, not a media's home category
const categoryOf = (m: string) => Object.entries(categories).find(([c, list]) => !SKIP_CATEGORY.has(c) && list.includes(m))?.[0] ?? null;
const HOUR = 3600e3;

type ListedSource = { media: string; group: 'news' | 'hourly' | 'off' };
export function listedMediaSources(sources: ListedSource[]): ListedSource[] {
  const duplicates = (disabledSpec as { duplicates?: Record<string, string> }).duplicates ?? {};
  const excluded = new Set((disabledSpec as { excludedMedia?: string[] }).excludedMedia ?? []);
  const listed = new Map(sources.map(({ media, group }) => [media, { media, group }]));
  // Registration and scheduling are independent: an unverified, paused or
  // citation-only outlet still belongs in the directory, even with no articles.
  for (const [media, entry] of Object.entries(info)) {
    if (entry.title && !listed.has(media)) listed.set(media, { media, group: 'off' });
  }
  return [...listed.values()].filter((s) => !excluded.has(s.media) && !duplicates[s.media] && (s.group !== 'off' || info[s.media]?.title));
}

export type MediaStatus = 'ok' | 'stale' | 'failing' | 'disabled';
export function statusFor(
  s: { disabled: boolean; group: string; lastArticle: Date | null; runs3h: number; failed3h: number },
  now: number,
): MediaStatus {
  if (s.disabled) return 'disabled';
  if (s.runs3h > 0 && s.failed3h === s.runs3h) return 'failing';
  const staleAfter = (s.group === 'news' ? 6 : 24) * HOUR;
  if (!s.lastArticle || now - s.lastArticle.getTime() > staleAfter) return 'stale';
  return 'ok';
}
/** Start of today in Asia/Taipei (UTC+8, no DST) as a UTC instant. */
export const taipeiMidnight = (now: number) => new Date(Math.floor((now + 8 * HOUR) / (24 * HOUR)) * 24 * HOUR - 8 * HOUR);

export function registerMediaStats(app: FastifyInstance, db: Db) {
  app.get('/api/v1/media-stats', async (_request, reply) => {
    const now = Date.now();
    const today = taipeiMidnight(now),
      day = new Date(now - 24 * HOUR),
      week = new Date(now - 7 * 24 * HOUR),
      future = new Date(now + HOUR);
    const counts = await db
      .select({
        media: articles.media,
        // Rows whose publish time is still unknown (listing gave none, page not
        // fetched yet: published_at == crawled_at) are counted separately.
        pendingDate: sql<number>`SUM(${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt})`,
        today: sql<number>`SUM(${articles.publishedAt} >= ${today} AND NOT (${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt}))`,
        last24h: sql<number>`SUM(${articles.publishedAt} >= ${day} AND NOT (${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt}))`,
        last7d: sql<number>`SUM(NOT (${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt}))`,
        tagged24h: sql<number>`SUM(${articles.publishedAt} >= ${day} AND JSON_LENGTH(${articles.tags}) > 0 AND NOT (${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt}))`,
        lastArticle: sql<
          Date | string | null
        >`MAX(IF(${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt}, NULL, ${articles.publishedAt}))`,
      })
      .from(articles)
      .where(and(gte(articles.publishedAt, week), lte(articles.publishedAt, future), sql`${articles.source} = 'own'`))
      .groupBy(articles.media);
    // When our own crawler first stored an article for each media: the 7-day
    // column only covers that much until a full week has passed.
    const firsts = await db
      .select({ media: articles.media, first: sql<Date | string | null>`MIN(${articles.crawledAt})` })
      .from(articles)
      .where(sql`${articles.source} = 'own'`)
      .groupBy(articles.media);
    const firstBy = new Map(firsts.map((f) => [f.media, f.first]));
    // Aggregators expose discoveries under the original article identity. Their
    // row counts are useful, but must never inflate site-wide publication totals.
    const discoveries = await db
      .select({
        media: articleDiscoveries.media,
        pendingDate: sql<number>`0`,
        today: sql<number>`SUM(${articles.publishedAt} >= ${today})`,
        last24h: sql<number>`SUM(${articles.publishedAt} >= ${day})`,
        last7d: sql<number>`SUM(${articles.publishedAt} >= ${week})`,
        tagged24h: sql<number>`SUM(${articles.publishedAt} >= ${day} AND JSON_LENGTH(${articles.tags}) > 0)`,
        lastArticle: sql<Date | string | null>`MAX(${articles.publishedAt})`,
        first: sql<Date | string | null>`MIN(${articleDiscoveries.discoveredAt})`,
      })
      .from(articleDiscoveries)
      .innerJoin(articles, eq(articles.id, articleDiscoveries.articleId))
      .where(lte(articles.publishedAt, future))
      .groupBy(articleDiscoveries.media);
    for (const row of discoveries) firstBy.set(row.media, row.first);
    const runs = await db
      .select({
        media: crawlRuns.media,
        runs3h: sql<number>`SUM(${crawlRuns.startedAt} >= ${new Date(now - 3 * HOUR)})`,
        failed3h: sql<number>`SUM(${crawlRuns.startedAt} >= ${new Date(now - 3 * HOUR)} AND ${crawlRuns.status} = 'failed')`,
        lastOk: sql<Date | string | null>`MAX(IF(${crawlRuns.status} = 'ok', ${crawlRuns.finishedAt}, NULL))`,
      })
      .from(crawlRuns)
      .where(and(gte(crawlRuns.startedAt, day), sql`${crawlRuns.stage} = 'index'`))
      .groupBy(crawlRuns.media);
    const byCount = new Map([...counts, ...discoveries].map((c) => [c.media, c]));
    const byRun = new Map(runs.map((r) => [r.media, r]));
    const off = disabled();
    // Aggregates come back as 'YYYY-MM-DD HH:MM:SS' strings; the DB stores UTC
    // (client timezone 'Z'), so parse as UTC rather than host-local time.
    const toDate = (v: unknown) => (v instanceof Date ? v : typeof v === 'string' && v ? new Date(`${v.replace(' ', 'T')}Z`) : null);
    const rows = listedMediaSources(allSources())
      .map((s) => {
        const c = byCount.get(s.media),
          r = byRun.get(s.media);
        const last24h = Number(c?.last24h ?? 0);
        const lastArticle = toDate(c?.lastArticle);
        const base = {
          disabled: s.group === 'off' || off.has(s.media),
          group: s.group,
          lastArticle,
          runs3h: Number(r?.runs3h ?? 0),
          failed3h: Number(r?.failed3h ?? 0),
        };
        const category = categoryOf(s.media);
        return {
          media: s.media,
          sourceKind: isDiscoverySource(s.media) ? 'discovery' : 'publisher',
          title: info[s.media]?.title ?? s.media,
          icon: iconUrl(s.media),
          category,
          categoryLabel: category ? (CATEGORY_LABELS[category] ?? category) : null,
          camp: campOf(s.media),
          schedule: base.disabled ? 'off' : s.group === 'news' ? 'every 9 min' : 'hourly',
          today: Number(c?.today ?? 0),
          last24h,
          last7d: Number(c?.last7d ?? 0),
          collectingSince: toDate(firstBy.get(s.media)),
          pendingDate: Number(c?.pendingDate ?? 0),
          taggedShare24h: last24h ? Number(c?.tagged24h ?? 0) / last24h : null,
          lastArticle,
          lastCrawlOk: toDate(r?.lastOk),
          status: statusFor(base, now),
        };
      })
      .sort((a, b) => b.last24h - a.last24h || b.last7d - a.last7d || a.media.localeCompare(b.media));
    const active = rows.filter((r) => r.status !== 'disabled');
    const publishers = rows.filter((r) => r.sourceKind === 'publisher');
    const sum = (k: 'today' | 'last24h') => publishers.reduce((s, r) => s + r[k], 0);
    const tagged = publishers.reduce((s, r) => s + (r.taggedShare24h ?? 0) * r.last24h, 0);
    reply.header('cache-control', 'public, max-age=120');
    return {
      generatedAt: new Date(now).toISOString(),
      todayStart: today.toISOString(),
      totals: {
        today: sum('today'),
        last24h: sum('last24h'),
        publishingMedia24h: publishers.filter((r) => r.last24h > 0).length,
        pendingDate: rows.reduce((s, r) => s + r.pendingDate, 0),
        activeSources: active.length,
        disabledSources: rows.length - active.length,
        taggedShare24h: sum('last24h') ? tagged / sum('last24h') : null,
        statusCounts: Object.fromEntries(['ok', 'stale', 'failing', 'disabled'].map((s) => [s, rows.filter((r) => r.status === s).length])),
      },
      media: rows,
    };
  });
}
