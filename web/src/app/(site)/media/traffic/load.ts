import { cache } from 'react';
import { API_ORIGIN } from '@/lib/api';
import {
  buildComparison,
  type CrawlComparison,
  type LiveTraffic,
  type RadarData,
  type TaiwanShareOverride,
  taiwanReadersByMedia,
  type WeeklyArticles,
  withPerArticle,
} from '@/lib/traffic-comparison.mts';
import disabled from '../../../../../../app/data/crawl-disabled.json';
import traffic from '../../../../../../app/data/media-traffic.json';
import catalog from '../../../../../../app/data/news-source-catalog.json';

const hidden = new Set(disabled.excludedMedia);

/** One load per request, shared by the table and the footer's 資料來源與計算方式 (which states each source's status). */
export const loadComparison = cache(async () => {
  let crawl: CrawlComparison | null = null;
  let live: LiveTraffic | null = { status: 'failed', checkedAt: null, error: null, domains: [] };
  let radar: RadarData = { status: 'failed', checkedAt: null, error: null, domains: [] };
  let taiwanShares: Record<string, TaiwanShareOverride> = {};
  try {
    const [crawlResult, liveResult, radarResult, sharesResult] = await Promise.allSettled([
      fetch(`${API_ORIGIN}/api/v1/media-traffic-comparison`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${API_ORIGIN}/api/v1/media-traffic-live`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${API_ORIGIN}/api/v1/media-radar`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${API_ORIGIN}/api/v1/media-taiwan-shares`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }),
    ]);
    if (crawlResult.status === 'fulfilled' && crawlResult.value.ok) crawl = await crawlResult.value.json();
    if (liveResult.status === 'fulfilled' && liveResult.value.ok) live = await liveResult.value.json();
    if (radarResult.status === 'fulfilled' && radarResult.value.ok) radar = await radarResult.value.json();
    if (sharesResult.status === 'fulfilled' && sharesResult.value.ok) taiwanShares = (await sharesResult.value.json()).shares ?? {};
  } catch {
    /* Traffic history remains readable when collection statistics are unavailable. */
  }
  return buildComparison(traffic.snapshots, catalog.sources, crawl, hidden, live, radar, taiwanShares);
});

/** Articles per media id over the past 7 days. `full` is false while the outlet has
 *  been collected for under a week (that week also carries the first listing's
 *  backlog), so its pace would skew per-article figures. */
export const loadWeekly = cache(async (): Promise<Record<string, WeeklyArticles>> => {
  // Same request as /media/'s table, so Next serves both from one fetch.
  const stats = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate: 120 } })
    .then((res) => (res.ok ? (res.json() as Promise<WeekStats>) : null))
    .catch(() => null);
  if (!stats) return {};
  const weekAgo = Date.parse(stats.generatedAt) - 7 * 86400e3;
  return Object.fromEntries(
    stats.media.map((row) => [row.media, { last7d: row.last7d, full: !row.collectingSince || Date.parse(row.collectingSince) <= weekAgo }]),
  );
});

/** Taiwan readers per media id for /media/ and /similarity/; empty when traffic is unavailable. */
export const loadTaiwanReaders = cache(async () => {
  const [comparison, weekly] = await Promise.all([loadComparison(), loadWeekly()]);
  const readers = taiwanReadersByMedia(comparison);
  for (const [media, week] of Object.entries(weekly))
    if (readers[media] && week.full) readers[media] = withPerArticle(readers[media], week.last7d);
  return readers;
});
interface WeekStats {
  generatedAt: string;
  media: Array<{ media: string; last7d: number; collectingSince: string | null }>;
}
