import MediaTabs from '@/components/MediaTabs';
import TrafficComparison from '@/components/TrafficComparison';
import { API_ORIGIN } from '@/lib/api';
import { buildComparison, type CrawlComparison } from '@/lib/traffic-comparison.mts';
import traffic from '../../../../../../app/data/media-traffic.json';
import catalog from '../../../../../../app/data/news-source-catalog.json';

export const metadata = {
  title: '媒體流量與收錄',
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">媒體流量與收錄</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">各家媒體的本站收錄篇數與 Similarweb 流量，一起查看。</p>
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
        </p>
      </header>
      <TrafficComparison data={buildComparison(traffic.snapshots, catalog.sources, crawl)} initial={params} />
      <details
        id="classification-method"
        className="scroll-mt-20 border-t border-zinc-200 pt-4 text-xs leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
      >
        <summary className="w-fit cursor-pointer font-medium">資料來源與比較方式</summary>
        <div className="mt-2 max-w-4xl space-y-2">
          <p>
            Similarweb 資料來自人工整理表，匯入日期 {traffic.retrievedAt.slice(0, 10)}
            。單位未在新聞欄明示，顯示原表值，不推算造訪人數。人工調整過的數值另行標示；缺值不補零。品牌全站與新聞子頻道可能重疊，每家媒體採主來源，不相加，也不推算全台市占。
          </p>
          <p>
            本站文章數依真實發布月份（台北時間）統計目前已收錄紀錄，並非該媒體完整發稿量。本月資料持續累積中，抓取也可能不完整。流量與篇數是不同指標，不能推算成每篇文章的實際閱讀量。發現來源以關聯計數，不改文章的原媒體歸屬。
          </p>
          <p>此頁不呈現政治分類評分；原始整理表的分類屬人工標記，不是 Similarweb 的政治傾向評分。</p>
        </div>
      </details>
    </div>
  );
}
