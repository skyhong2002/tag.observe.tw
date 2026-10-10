import MediaTabs from '@/components/MediaTabs';
import MethodLink from '@/components/MethodLink';
import TrafficComparison from '@/components/TrafficComparison';
import { pageMetadata } from '@/lib/seo.mts';
import traffic from '../../../../../../app/data/media-traffic.json';
import { loadComparison } from './load';

export const metadata = pageMetadata(
  '/media/sources/',
  '媒體流量與收錄比較',
  '對照媒體網站流量資料與本站新聞收錄範圍，查看媒體分類、來源與統計方法。',
  true,
);
export const revalidate = 300;

export default async function MediaSourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadComparison();
  const params = Object.fromEntries(
    Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return (
    <div className="space-y-5">
      <header>
        <MediaTabs current="sources" />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">媒體流量與排名</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <a
            href={traffic.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="開啟原始流量表單（外部連結，由 Gene Hong 維護）"
            className="inline-flex items-center gap-1 text-brand-700 underline underline-offset-4 dark:text-brand-400"
          >
            GeneHong 原始流量表單 <span aria-hidden="true">↗</span>
          </a>
          <span>由 Gene Hong 維護</span>
          <MethodLink />
        </p>
      </header>
      <TrafficComparison data={data} initial={params} />
    </div>
  );
}
