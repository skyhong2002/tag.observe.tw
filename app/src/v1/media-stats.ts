import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import disabledSpec from '../../data/crawl-disabled.json' with { type: 'json' };
import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import catalog from '../../data/media-catalog.json' with { type: 'json' };
import { allSources, disabled } from '../crawl/registry.ts';
import { crawlTimestamp, nextIndexEligibleAt, sourceSchedule } from '../crawl/schedule.ts';
import { codeLink, crawlerInfo } from '../crawl/source-info.ts';
import { TOPIC_RULES } from '../crawl/topics.ts';
import type { Db } from '../db/client.ts';
import { articleDiscoveries, articles, crawlRuns, topics } from '../db/schema.ts';
import { articleMediaOf, topicCountPerMedia, topicSourceChecks } from '../jobs/topics-job.ts';
import { mediaScope } from '../media-scope.ts';
import { outletIdentity } from '../similarity/attribution.ts';
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

// Topic crawlers are keyed by the outlet's topic media (報導者 is twreporter
// there, reporter for articles).
const topicRuleOf = (media: string) =>
  TOPIC_RULES.find((r) => r.media === media) ?? TOPIC_RULES.find((r) => articleMediaOf(r.media) === media);

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
  const load = async () => {
    const now = Date.now();
    const today = taipeiMidnight(now),
      day = new Date(now - 24 * HOUR),
      week = new Date(now - 7 * 24 * HOUR),
      future = new Date(now + HOUR);
    const dated = sql`NOT (${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt})`;
    const summaryEligible = sql`${dated} AND ${articles.publishedAt} <= ${new Date(now)}`;
    const hasSummary = sql`${articles.summary} IS NOT NULL AND CHAR_LENGTH(TRIM(${articles.summary})) > 0`;
    const counts = await db
      .select({
        media: articles.media,
        summaryTotal: sql<number>`SUM(${summaryEligible})`,
        summaryCount: sql<number>`SUM(${summaryEligible} AND ${hasSummary})`,
        summarySources: sql<
          string | null
        >`GROUP_CONCAT(DISTINCT IF(${summaryEligible} AND ${hasSummary}, COALESCE(NULLIF(${articles.summarySource}, ''), 'unknown'), NULL))`,
        // Prefer an editorial lead when one was actually collected. This is
        // an example, not a claim that the largest ID is the newest report.
        summaryExampleId: sql<
          number | null
        >`COALESCE(MAX(IF(${summaryEligible} AND ${hasSummary} AND ${articles.summarySource} = 'article:selector', ${articles.id}, NULL)), MAX(IF(${summaryEligible} AND ${hasSummary}, ${articles.id}, NULL)))`,
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
      .where(
        and(
          gte(articles.publishedAt, week),
          lte(articles.publishedAt, future),
          sql`${articles.source} = 'own'`,
          // A 議題／專題 page's own row is the package, not a report: undated
          // ones sit at their first-seen time and carry no tags.
          sql`NOT EXISTS (SELECT 1 FROM ${topics} WHERE ${topics.url} = ${articles.url} AND ${topics.kind} IN ('topic', 'feature'))`,
        ),
      )
      .groupBy(articles.media);
    // When our own crawler first stored an article for each media: the 7-day
    // column only covers that much until a full week has passed.
    const firsts = await db
      .select({
        media: articles.media,
        first: sql<Date | string | null>`MIN(${articles.crawledAt})`,
        totalCollected: sql<number>`COUNT(*)`,
      })
      .from(articles)
      .where(sql`${articles.source} = 'own'`)
      .groupBy(articles.media);
    const firstBy = new Map(firsts.map((f) => [f.media, f.first]));
    const totalBy = new Map(firsts.map((f) => [f.media, Number(f.totalCollected)]));
    // Aggregators expose discoveries under the original article identity. Their
    // row counts are useful, but must never inflate site-wide publication totals.
    const discoveries = await db
      .select({
        media: articleDiscoveries.media,
        totalCollected: sql<number>`COUNT(*)`,
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
    for (const row of discoveries) {
      firstBy.set(row.media, row.first);
      totalBy.set(row.media, Number(row.totalCollected));
    }
    const runs = await db
      .select({
        media: crawlRuns.media,
        runs3h: sql<number>`SUM(${crawlRuns.stage} = 'index' AND ${crawlRuns.startedAt} >= ${new Date(now - 3 * HOUR)})`,
        failed3h: sql<number>`SUM(${crawlRuns.stage} = 'index' AND ${crawlRuns.startedAt} >= ${new Date(now - 3 * HOUR)} AND ${crawlRuns.status} = 'failed')`,
        lastIndexStarted: sql<Date | string | null>`MAX(IF(${crawlRuns.stage} = 'index', ${crawlRuns.startedAt}, NULL))`,
        lastIndexCompleted: sql<
          Date | string | null
        >`MAX(IF(${crawlRuns.stage} = 'index' AND ${crawlRuns.finishedAt} IS NOT NULL, ${crawlRuns.startedAt}, NULL))`,
        runs24h: sql<number>`SUM(${crawlRuns.startedAt} >= ${day} AND ${crawlRuns.finishedAt} IS NOT NULL)`,
        failures24h: sql<number>`SUM(${crawlRuns.startedAt} >= ${day} AND ${crawlRuns.finishedAt} IS NOT NULL AND (${crawlRuns.status} = 'failed' OR ${crawlRuns.failed} > 0 OR ${crawlRuns.detail} IS NOT NULL))`,
        lastFailureAt: sql<
          Date | string | null
        >`MAX(IF(${crawlRuns.startedAt} >= ${day} AND ${crawlRuns.finishedAt} IS NOT NULL AND (${crawlRuns.status} = 'failed' OR ${crawlRuns.failed} > 0 OR ${crawlRuns.detail} IS NOT NULL), ${crawlRuns.finishedAt}, NULL))`,
        lastOk: sql<
          Date | string | null
        >`MAX(IF(${crawlRuns.stage} = 'index' AND ${crawlRuns.status} = 'ok', ${crawlRuns.finishedAt}, NULL))`,
      })
      .from(crawlRuns)
      .where(sql`${crawlRuns.stage} IN ('index', 'article')`)
      .groupBy(crawlRuns.media);
    const [topicChecks, topicCounts] = await Promise.all([topicSourceChecks(db, new Date(now)), topicCountPerMedia(db)]);
    const byCount = new Map([...counts, ...discoveries].map((c) => [c.media, c]));
    const bySummary = new Map(counts.map((c) => [c.media, c]));
    const byRun = new Map(runs.map((r) => [r.media, r]));
    const off = disabled();
    // Aggregates come back as 'YYYY-MM-DD HH:MM:SS' strings; the DB stores UTC
    // (client timezone 'Z'), so parse as UTC rather than host-local time.
    const toDate = crawlTimestamp;
    const specs = allSources();
    const rows = listedMediaSources(specs)
      .map((s) => {
        const c = byCount.get(s.media),
          r = byRun.get(s.media);
        const summary = bySummary.get(s.media);
        const last24h = Number(c?.last24h ?? 0);
        const lastArticle = toDate(c?.lastArticle);
        const base = {
          disabled: s.group === 'off' || off.has(s.media),
          group: s.group,
          lastArticle,
          runs3h: Number(r?.runs3h ?? 0),
          failed3h: Number(r?.failed3h ?? 0),
        };
        const scheduling = sourceSchedule(s.media, s.group === 'news' ? 'news' : 'hourly');
        const lastIndexStarted = toDate(r?.lastIndexStarted);
        const lastIndexCompleted = toDate(r?.lastIndexCompleted);
        const running =
          !!lastIndexStarted &&
          lastIndexStarted.getTime() > (lastIndexCompleted?.getTime() ?? 0) &&
          now - lastIndexStarted.getTime() < 6 * HOUR;
        const category = categoryOf(s.media);
        const topicRule = topicRuleOf(s.media);
        const topicCheck = topicRule && topicChecks[topicRule.media];
        return {
          media: s.media,
          sourceKind: isDiscoverySource(s.media) ? 'discovery' : 'publisher',
          title: info[s.media]?.title ?? s.media,
          country: outletIdentity(s.media).country,
          countryCode: outletIdentity(s.media).countryCode,
          // Collected edition, readership and role; see data/media-scope.json.
          scope: mediaScope(s.media),
          crawler: crawlerInfo(
            s.media,
            specs.find((source) => source.media === s.media),
          ),
          summary: isDiscoverySource(s.media)
            ? null
            : {
                total: Number(summary?.summaryTotal ?? 0),
                withSummary: Number(summary?.summaryCount ?? 0),
                sources: summary?.summarySources ? summary.summarySources.split(',').sort() : [],
                exampleId: summary?.summaryExampleId ? Number(summary.summaryExampleId) : null,
              },
          icon: iconUrl(s.media),
          category,
          categoryLabel: category ? (CATEGORY_LABELS[category] ?? category) : null,
          camp: campOf(s.media),
          schedule: base.disabled ? 'off' : scheduling.minutes === 60 ? 'hourly' : `every ${scheduling.minutes} min`,
          crawlSchedule: {
            intervalMinutes: base.disabled ? null : scheduling.minutes,
            reason: base.disabled ? '未啟用' : scheduling.reason,
            reviewedAt: scheduling.reviewedAt,
            nextEligibleAt: base.disabled ? null : nextIndexEligibleAt(lastIndexCompleted, scheduling.dueAfterMinutes),
            lastStartedAt: lastIndexStarted,
            running: !base.disabled && running,
          },
          crawlHealth: {
            runs24h: Number(r?.runs24h ?? 0),
            failures24h: Number(r?.failures24h ?? 0),
            lastFailureAt: toDate(r?.lastFailureAt),
          },
          today: Number(c?.today ?? 0),
          last24h,
          last7d: Number(c?.last7d ?? 0),
          collectingSince: toDate(firstBy.get(s.media)),
          totalCollected: totalBy.get(s.media) ?? 0,
          pendingDate: Number(c?.pendingDate ?? 0),
          taggedShare24h: last24h ? Number(c?.tagged24h ?? 0) / last24h : null,
          lastArticle,
          lastCrawlOk: toDate(r?.lastOk),
          status: statusFor(base, now),
          // The outlet's 議題／專題 listings: per-source result of the latest topic run.
          topics: topicRule
            ? {
                media: topicRule.media,
                sources: topicCheck?.sources ?? [],
                checkedAt: topicCheck?.checkedAt ?? null,
                lastSuccessAt: topicCheck?.lastSuccessAt ?? null,
                status: topicCheck?.status ?? 'pending',
                counts: topicCounts[topicRule.media] ?? { topic: 0, feature: 0 },
                rulesUrl: codeLink('議題規則', 'app/src/crawl/topics.ts', `    media: '${topicRule.media}',`).url,
              }
            : null,
        };
      })
      .sort((a, b) => b.last24h - a.last24h || b.last7d - a.last7d || a.media.localeCompare(b.media));
    const active = rows.filter((r) => r.status !== 'disabled');
    const publishers = rows.filter((r) => r.sourceKind === 'publisher');
    const sum = (k: 'today' | 'last24h') => publishers.reduce((s, r) => s + r[k], 0);
    const tagged = publishers.reduce((s, r) => s + (r.taggedShare24h ?? 0) * r.last24h, 0);
    return {
      generatedAt: new Date(now).toISOString(),
      todayStart: today.toISOString(),
      summaryWindow: { since: week.toISOString(), until: new Date(now).toISOString(), hours: 168, basis: 'published_at' },
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
  };
  // The public response already advertises a two-minute cache. Share it on
  // the server too, so concurrent directory readers do not repeat DB scans.
  let cached: Awaited<ReturnType<typeof load>> | null = null;
  let expires = 0;
  let pending: ReturnType<typeof load> | null = null;
  app.get('/api/v1/media-stats', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=120');
    if (cached && Date.now() < expires) return cached;
    const request = (pending ??= load());
    try {
      cached = await request;
      expires = Date.now() + 120_000;
      return cached;
    } finally {
      if (pending === request) pending = null;
    }
  });
}
