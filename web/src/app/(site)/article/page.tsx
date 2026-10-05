import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleFacets, ArticleList, ArticlePager, type ListingLink, RangeChips } from '@/components/ArticleResults';
import MethodLink from '@/components/MethodLink';
import { fetchMedia, type MediaInfo } from '@/lib/api';
import { fetchArticleListing, isCamp, rangeDays, validCursor } from '@/lib/article-search';
import { pageMetadata } from '@/lib/seo.mts';

// 文章 (/article/): every stored article across outlets, newest first, with the
// camp and outlet split of the period. The same list and facets as 搜尋新聞,
// without a search term. Only the unfiltered first page is canonical.

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
  const [{ page, facets }, media] = await Promise.all([
    fetchArticleListing({ days, camp, cursor }),
    fetchMedia().catch((): MediaInfo => ({})),
  ]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">最新文章</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          本站收錄的所有媒體文章，依刊登時間由新到舊。要找特定字詞，請用
          <Link href="/search/" className="text-brand-700 hover:underline dark:text-brand-400">
            搜尋
          </Link>
          。
        </p>
        <p className="text-xs">
          <MethodLink />
        </p>
      </div>
      {!page ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">文章列表暫時無法使用，請稍後再試。</p>
      ) : (
        <>
          <RangeChips days={days} link={link} />
          {facets && <ArticleFacets facets={facets} subject="全站" days={days} camp={camp} link={link} media={media} />}
          <ArticleList page={page} empty={`過去 ${days} 天沒有收錄文章${camp ? '（目前只看單一傾向）' : ''}。`} />
          <ArticlePager page={page} cursor={cursor} link={link} />
        </>
      )}
    </div>
  );
}
