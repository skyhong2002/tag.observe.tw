import MediaTabs from '@/components/MediaTabs';
import MethodLink from '@/components/MethodLink';
import TrafficComparison from '@/components/TrafficComparison';
import { API_ORIGIN } from '@/lib/api';
import { buildComparison, type CrawlComparison } from '@/lib/traffic-comparison.mts';
import disabled from '../../../../../../app/data/crawl-disabled.json';
import traffic from '../../../../../../app/data/media-traffic.json';
import catalog from '../../../../../../app/data/news-source-catalog.json';

const hidden = new Set(disabled.excludedMedia);

export const metadata = {
  title: 'Similar Web',
  description: '查看各家媒體的本站收錄篇數與 Similarweb 流量。',
};
export const revalidate = 300;

export default async function MediaSourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let crawl: CrawlComparison | null = null;
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/media-traffic-comparison`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) crawl = await response.json();
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
      <TrafficComparison data={buildComparison(traffic.snapshots, catalog.sources, crawl, hidden)} initial={params} />
    </div>
  );
}
