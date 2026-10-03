import { and, gte, inArray, lte, sql } from 'drizzle-orm';
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';
import { sourcesInGroup } from './registry.ts';

export { baseline as trafficBaseline };

// Each outlet's weight is counted once, regardless of its article volume.
// Keep the denominator fixed, including missing and disabled outlets.
export function calculateTrafficCoverage(active: ReadonlySet<string>, collected: ReadonlySet<string>) {
  const sources = baseline.sources.map((s) => ({
    ...s,
    active: active.has(s.media),
    covered: active.has(s.media) && collected.has(s.media),
  }));
  // The spreadsheet has three decimal places. Sum integers to avoid rounding
  // a coverage just below the target up to a passing result.
  const weight = (s: { traffic: number }) => Math.round(s.traffic * 1000);
  const total = sources.reduce((sum, s) => sum + weight(s), 0);
  const covered = sources.reduce((sum, s) => sum + (s.covered ? weight(s) : 0), 0);
  const configured = sources.reduce((sum, s) => sum + (s.active ? weight(s) : 0), 0);
  return {
    sourceUrl: baseline.sourceUrl,
    retrievedAt: baseline.retrievedAt,
    scope: baseline.scope,
    windowHours: baseline.windowHours,
    target: baseline.target,
    totalTraffic: total / 1000,
    coveredTraffic: covered / 1000,
    configuredShare: configured / total,
    coveredShare: covered / total,
    meetsTarget: covered / total >= baseline.target,
    coveredSources: sources.filter((s) => s.covered).length,
    totalSources: sources.length,
    missing: sources.filter((s) => !s.covered),
  };
}

export async function measureTrafficCoverage(db: Db, now = new Date()) {
  const since = new Date(now.getTime() - baseline.windowHours * 3600e3);
  const collected = await db
    .select({ media: articles.media })
    .from(articles)
    .where(
      and(
        inArray(
          articles.media,
          baseline.sources.map((s) => s.media),
        ),
        gte(articles.publishedAt, since),
        lte(articles.publishedAt, now),
        gte(articles.crawledAt, since),
        sql`${articles.source} = 'own'`,
        sql`TRIM(${articles.title}) <> ''`,
        // Discovered links use crawl time until the article supplies its date.
        // Neither a pending link nor a dateless page proves recent coverage.
        sql`${articles.publishedAt} <> ${articles.crawledAt}`,
      ),
    )
    .groupBy(articles.media);
  const active = new Set([...sourcesInGroup('news'), ...sourcesInGroup('hourly')].map((s) => s.media));
  return {
    generatedAt: now.toISOString(),
    ...calculateTrafficCoverage(active, new Set(collected.map((s) => s.media))),
  };
}
