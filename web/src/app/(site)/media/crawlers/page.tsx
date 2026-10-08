import MediaCrawlersTable from '@/components/MediaCrawlersTable';
import MediaTabs from '@/components/MediaTabs';
import MethodLink from '@/components/MethodLink';
import { API_ORIGIN } from '@/lib/api';
import type { MediaCrawler } from '@/lib/media-crawlers.mts';
import { pageMetadata } from '@/lib/seo.mts';

export const revalidate = 120;
export const metadata = pageMetadata(
  '/media/crawlers/',
  '爬蟲資訊',
  '查看各新聞來源的擷取方式、最近收錄與爬取狀態，了解本站新聞資料的涵蓋範圍與更新限制。',
  true,
);

export default async function CrawlersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const response = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate }, signal: AbortSignal.timeout(8000) }).catch(
    () => null,
  );
  const data = response?.ok
    ? ((await response.json()) as { media: MediaCrawler[]; generatedAt: string; summaryWindow?: { since: string; until: string } })
    : null;
  const observed = data?.media.filter((row) => (row.summary?.total ?? 0) > 0) ?? [];
  const withSummary = observed.filter((row) => (row.summary?.withSummary ?? 0) > 0).length;
  return (
    <div className="space-y-5">
      <MediaTabs current="crawlers" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">爬蟲資訊</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <MethodLink />
        </p>
      </header>
      {data?.summaryWindow && (
        <section aria-label="摘要統計範圍" className="rounded-lg bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-900">
          <p>
            近 7 天有文章的 {observed.length} 家刊登媒體中，{withSummary} 家至少一篇已取得摘要。
          </p>
          <p className="mt-1 text-xs leading-6 text-zinc-500">
            「收錄內容」列出爬蟲收錄的內容；有取得摘要的媒體會顯示「摘要」標籤。摘要是網站提供的文章簡介或導言，本站不自行生成。
            以已出版且日期已確認的本站文章為範圍，包含後續補抓的摘要；沒有摘要標籤不代表網站不提供摘要。 統計更新時間：
            {new Date(data.summaryWindow.until).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}（台北）。
          </p>
        </section>
      )}
      {data ? (
        <MediaCrawlersTable key={q} media={data.media} initialQuery={q} asOf={data.generatedAt} />
      ) : (
        <p>爬蟲資訊暫時無法取得，請稍後再試。</p>
      )}
    </div>
  );
}
