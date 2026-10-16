import MethodLink from '@/components/MethodLink';
import SectionTabs from '@/components/SectionTabs';
import TrafficComparison from '@/components/TrafficComparison';
import { pageMetadata } from '@/lib/seo.mts';
import { loadComparison, loadOutput, loadWeekly } from './load';

export const metadata = pageMetadata(
  '/media/traffic/',
  '媒體流量與排名',
  '對照媒體網站流量資料與本站新聞收錄範圍，查看媒體分類、來源與統計方法。',
  true,
);
export const revalidate = 300;

export default async function MediaSourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [data, weekly, output] = await Promise.all([loadComparison(), loadWeekly().catch(() => ({})), loadOutput()]);
  const params = Object.fromEntries(
    Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return (
    <div className="space-y-5">
      <SectionTabs here="/media/traffic/" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">媒體流量與排名</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Similarweb 估算月造訪量與 Cloudflare Radar 排名 <MethodLink />
        </p>
      </header>
      <TrafficComparison data={data} weekly={weekly} output={output} initial={params} />
    </div>
  );
}
