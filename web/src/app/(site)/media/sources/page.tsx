import Link from 'next/link';
import MediaTabs from '@/components/MediaTabs';
import MethodLink from '@/components/MethodLink';
import TrafficComparison from '@/components/TrafficComparison';
import { API_ORIGIN } from '@/lib/api';
import { pageMetadata } from '@/lib/seo.mts';
import { buildComparison, type CrawlComparison, type LiveTraffic } from '@/lib/traffic-comparison.mts';
import disabled from '../../../../../../app/data/crawl-disabled.json';
import traffic from '../../../../../../app/data/media-traffic.json';
import catalog from '../../../../../../app/data/news-source-catalog.json';

const hidden = new Set(disabled.excludedMedia);

export const metadata = pageMetadata(
  '/media/sources/',
  '媒體流量與收錄比較',
  '對照媒體網站流量資料與本站新聞收錄範圍，查看媒體分類、來源與統計方法。',
  true,
);
export const revalidate = 300;

export default async function MediaSourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let crawl: CrawlComparison | null = null;
  let live: LiveTraffic | null = { status: 'failed', checkedAt: null, error: null, domains: [] };
  try {
    const [crawlResult, liveResult] = await Promise.allSettled([
      fetch(`${API_ORIGIN}/api/v1/media-traffic-comparison`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${API_ORIGIN}/api/v1/media-traffic-live`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
      }),
    ]);
    if (crawlResult.status === 'fulfilled' && crawlResult.value.ok) crawl = await crawlResult.value.json();
    if (liveResult.status === 'fulfilled' && liveResult.value.ok) live = await liveResult.value.json();
  } catch {
    /* Traffic history remains readable when collection statistics are unavailable. */
  }
  const params = Object.fromEntries(
    Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return (
    <div className="space-y-5">
      <header>
        <MediaTabs current="sources" />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Similar Web</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <a
            href={traffic.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="開啟原始流量表單（外部連結，由 Gene Hong 維護）"
            className="inline-flex items-center gap-1 text-brand-700 underline underline-offset-4 dark:text-brand-400"
          >
            原始流量表單 <span aria-hidden="true">↗</span>
          </a>
          <span>由 Gene Hong 維護</span>
          <MethodLink />
        </p>
      </header>
      <nav aria-label="流量資料來源" className="flex gap-4 text-sm">
        <Link
          href="/media/sources/"
          aria-current={params.source !== 'reference' ? 'page' : undefined}
          className="underline underline-offset-4"
        >
          自動抓取
        </Link>
        <Link
          href="/media/sources/?source=reference"
          aria-current={params.source === 'reference' ? 'page' : undefined}
          className="underline underline-offset-4"
        >
          整理表歷史資料
        </Link>
      </nav>
      <TrafficComparison
        key={params.source === 'reference' ? 'reference' : 'live'}
        data={buildComparison(traffic.snapshots, catalog.sources, crawl, hidden, params.source === 'reference' ? null : live)}
        initial={params}
      />
    </div>
  );
}
