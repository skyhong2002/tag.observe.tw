// Issue #11: replaces the one-off old-site comparison with a self-contained
// health check: per media, last 24h index runs, items, and article-stage tag
// rate. Exposed as Prometheus gauges for Grafana.
import { and, gte, sql } from 'drizzle-orm';
import { Gauge } from 'prom-client';
import { measureTrafficCoverage } from '../crawl/traffic-coverage.ts';
import type { Db } from '../db/client.ts';
import { articles, crawlRuns } from '../db/schema.ts';
import { registry } from '../metrics.ts';

export const crawlItems = new Gauge({
  name: 'tag_crawl_items_24h',
  help: 'Listing items fetched per media in 24h',
  labelNames: ['media'] as const,
  registers: [registry],
});
export const crawlFailed = new Gauge({
  name: 'tag_crawl_failed_runs_24h',
  help: 'Failed index runs per media in 24h',
  labelNames: ['media'] as const,
  registers: [registry],
});
export const crawlTagRate = new Gauge({
  name: 'tag_crawl_tag_rate_24h',
  help: 'Share of articles (24h) with tags per media',
  labelNames: ['media'] as const,
  registers: [registry],
});
export const crawlHealthy = new Gauge({ name: 'tag_crawl_sources_healthy', help: 'Sources with items in 24h', registers: [registry] });
export const crawlTrafficCoverage = new Gauge({
  name: 'tag_crawl_traffic_coverage_ratio',
  help: 'Traffic share of eligible reference outlets with dated articles collected in 48h, excluding untraced syndication (target 0.95)',
  registers: [registry],
});

export async function runCrawlHealthJob(db: Db, { log = (_o: object, _m: string) => {} } = {}) {
  const since = new Date(Date.now() - 24 * 3600e3);
  const runs = await db
    .select({
      media: crawlRuns.media,
      items: sql<number>`SUM(${crawlRuns.fetched})`,
      failed: sql<number>`SUM(${crawlRuns.status}='failed')`,
    })
    .from(crawlRuns)
    .where(and(gte(crawlRuns.startedAt, since), sql`${crawlRuns.stage}='index'`))
    .groupBy(crawlRuns.media);
  const tagged = await db
    .select({ media: articles.media, n: sql<number>`COUNT(*)`, t: sql<number>`SUM(JSON_LENGTH(${articles.tags})>0)` })
    .from(articles)
    .where(and(gte(articles.publishedAt, since), sql`${articles.source}='own'`))
    .groupBy(articles.media);
  let healthy = 0;
  for (const r of runs) {
    crawlItems.set({ media: r.media }, Number(r.items));
    crawlFailed.set({ media: r.media }, Number(r.failed));
    if (Number(r.items) > 0) healthy++;
  }
  for (const r of tagged) crawlTagRate.set({ media: r.media }, Number(r.n) ? Number(r.t) / Number(r.n) : 0);
  crawlHealthy.set(healthy);
  const trafficCoverage = await measureTrafficCoverage(db);
  crawlTrafficCoverage.set(trafficCoverage.coveredShare);
  const summary = {
    sources: runs.length,
    healthy,
    failing: runs.filter((r) => Number(r.items) === 0).map((r) => r.media),
    trafficCoverage,
  };
  log(summary, 'crawl health');
  return summary;
}
