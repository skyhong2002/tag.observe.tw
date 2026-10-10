import { cache } from 'react';
import { API_ORIGIN } from '@/lib/api';
import { buildComparison, type CrawlComparison, type LiveTraffic, type RadarData } from '@/lib/traffic-comparison.mts';
import disabled from '../../../../../../app/data/crawl-disabled.json';
import traffic from '../../../../../../app/data/media-traffic.json';
import catalog from '../../../../../../app/data/news-source-catalog.json';

const hidden = new Set(disabled.excludedMedia);

/** One load per request, shared by the table and the footer's 資料來源與計算方式 (which states each source's status). */
export const loadComparison = cache(async () => {
  let crawl: CrawlComparison | null = null;
  let live: LiveTraffic | null = { status: 'failed', checkedAt: null, error: null, domains: [] };
  let radar: RadarData = { status: 'failed', checkedAt: null, error: null, domains: [] };
  try {
    const [crawlResult, liveResult, radarResult] = await Promise.allSettled([
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
    ]);
    if (crawlResult.status === 'fulfilled' && crawlResult.value.ok) crawl = await crawlResult.value.json();
    if (liveResult.status === 'fulfilled' && liveResult.value.ok) live = await liveResult.value.json();
    if (radarResult.status === 'fulfilled' && radarResult.value.ok) radar = await radarResult.value.json();
  } catch {
    /* Traffic history remains readable when collection statistics are unavailable. */
  }
  return buildComparison(traffic.snapshots, catalog.sources, crawl, hidden, live, radar);
});
