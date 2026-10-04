import MediaCrawlersTable from '@/components/MediaCrawlersTable';
import MediaTabs from '@/components/MediaTabs';
import MethodLink from '@/components/MethodLink';
import { API_ORIGIN } from '@/lib/api';
import type { MediaCrawler } from '@/lib/media-crawlers.mts';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 120;
export const metadata = pageMetadata(
  '/media/crawlers/',
  '爬蟲資訊',
  '查看各新聞來源的擷取方式、最近收錄與爬取狀態，了解本站新聞資料的涵蓋範圍與更新限制。',
);

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
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <MethodLink />
        </p>
      </header>
      {data ? <MediaCrawlersTable key={q} media={data.media} initialQuery={q} /> : <p>爬蟲資訊暫時無法取得，請稍後再試。</p>}
    </div>
  );
}
