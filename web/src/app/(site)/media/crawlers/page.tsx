import MediaCrawlersTable from '@/components/MediaCrawlersTable';
import MediaTabs from '@/components/MediaTabs';
import { API_ORIGIN } from '@/lib/api';
import type { MediaCrawler } from '@/lib/media-crawlers.mts';

export const revalidate = 120;
export const metadata = { title: '爬蟲資訊' };

export default async function CrawlersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const response = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate }, signal: AbortSignal.timeout(8000) }).catch(
    () => null,
  );
  const data = response?.ok ? ((await response.json()) as { media: MediaCrawler[] }) : null;
  return (
    <div className="space-y-5">
      <MediaTabs current="crawlers" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">爬蟲資訊</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">各媒體的抓取方式、下載工具與程式碼。收錄篇數請見「收錄概況」。</p>
      </header>
      {data ? <MediaCrawlersTable key={q} media={data.media} initialQuery={q} /> : <p>爬蟲資訊暫時無法取得，請稍後再試。</p>}
      <p className="text-xs leading-6 text-zinc-500">
        HTML 解析是下載網頁後擷取內容；JSON 是讀取公開結構化資料。自動探索會依站點選用 RSS、Sitemap 或 HTML；
        最近驗證方式不代表每次都採用相同路徑。正文擷取仍需逐篇驗證；標題、摘要與影片資料依來源提供，並非每篇皆具備。
        標籤提示保留完整抓取說明與最近驗證方式。
      </p>
    </div>
  );
}
