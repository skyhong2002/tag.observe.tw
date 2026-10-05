import type { Metadata } from 'next';
import { ArticleFacets, ArticleList, ArticlePager, type ListingLink, RangeChips } from '@/components/ArticleResults';
import MethodLink from '@/components/MethodLink';
import PeriodEvents from '@/components/PeriodEvents';
import { fetchMedia, type MediaInfo } from '@/lib/api';
import { fetchArticleListing, isCamp, rangeDays, validCursor } from '@/lib/article-search';
import { fetchEventPeriod } from '@/lib/pages';
import { pageMetadata } from '@/lib/seo.mts';

// 最新文章 (/article/): every stored article across outlets, newest first. It
// opens with the period's main event threads so the stream reads as coverage
// of those stories; articles carrying a thread's major tags are marked with it.
// The list and facets are 搜尋新聞's, without a search term, and leave out
// articles whose publish time is still only when we found them (they would
// otherwise sit at the top in undated batches). Only the unfiltered first
// page is canonical.

export const revalidate = 60;
type Query = { days?: string; camp?: string; cursor?: string };
const DEFAULT_DAYS = 1;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = rangeDays(sp.days, DEFAULT_DAYS) !== DEFAULT_DAYS || isCamp(sp.camp) || validCursor(sp.cursor);
  return {
    ...pageMetadata('/article/', '最新文章', '本站收錄的所有媒體文章，依刊登時間由新到舊，附各媒體與藍綠傾向的篇數分布。'),
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArticleIndexPage({ searchParams }: { searchParams: Promise<Query> }) {
  const sp = await searchParams;
  const days = rangeDays(sp.days, DEFAULT_DAYS);
  const camp = isCamp(sp.camp) ? sp.camp : null;
  const cursor = validCursor(sp.cursor);
  const link: ListingLink = (patch) => {
    const next: Record<string, string | null> = { days: days === DEFAULT_DAYS ? null : String(days), camp, ...patch };
    const params = new URLSearchParams(Object.entries(next).filter((kv): kv is [string, string] => Boolean(kv[1])));
    return `/article/${params.size ? `?${params}` : ''}`;
  };
  const [{ page, facets }, media, period] = await Promise.all([
    fetchArticleListing({ days, camp, cursor, settled: true }),
    fetchMedia().catch((): MediaInfo => ({})),
    fetchEventPeriod(days, 7),
  ]);
  const threads = period?.threads ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">最新文章</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          本站收錄的所有媒體文章，依刊登時間由新到舊。要找特定字詞，請用頁首的搜尋框。
        </p>
        <p className="text-xs">
          <MethodLink />
        </p>
      </div>
      <RangeChips days={days} defaultDays={DEFAULT_DAYS} link={link} />
      {!cursor && <PeriodEvents threads={threads} days={days} media={media} />}
      {!page ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">文章列表暫時無法使用，請稍後再試。</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {facets && (
            <aside className="lg:order-2">
              <div className="lg:sticky lg:top-20">
                <ArticleFacets facets={facets} subject="全站" span={`過去 ${days} 天`} camp={camp} link={link} media={media} />
              </div>
            </aside>
          )}
          <div className="min-w-0 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">{cursor ? '更早的文章' : '所有文章'}</h2>
            <ArticleList
              page={page}
              byHour={days === 1}
              threads={threads}
              empty={`過去 ${days} 天沒有收錄文章${camp ? '（目前只看單一傾向）' : ''}。`}
            />
            <ArticlePager page={page} cursor={cursor} link={link} />
          </div>
        </div>
      )}
    </div>
  );
}
