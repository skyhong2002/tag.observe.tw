import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleFacets, ArticleList, ArticlePager, type ListingLink } from '@/components/ArticleResults';
import MethodLink from '@/components/MethodLink';
import StructuredData from '@/components/StructuredData';
import TagChart from '@/components/TagChart';
import TagStatusPanel from '@/components/TagStatusPanel';
import { fetchMedia, fetchTagArticles, fetchTagSeries, fetchTagStatus, type MediaInfo, taipei } from '@/lib/api';
import { countArticles, fetchArticleListing, isCamp, validCursor } from '@/lib/article-search';
import { decodeRouteParam, pageMetadata, pageSchema } from '@/lib/seo.mts';
import { tagHours } from '@/lib/tag-query';

export const revalidate = 60;
type Params = { tag: string };
type Query = { hours?: string; camp?: string; cursor?: string };
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}): Promise<Metadata> {
  const tag = decodeRouteParam((await params).tag);
  const sp = await searchParams;
  const hours = Math.max(48, tagHours(sp));
  const recent = await fetchTagArticles(tag, hours).catch(() => null);
  const headline = recent?.articles[0]?.title;
  const description = headline
    ? `「${tag}」新聞與媒體報導對照。近 ${hours} 小時收錄的報導包括：${Array.from(headline).slice(0, 70).join('')}。查看關鍵字熱度與逐時趨勢。`
    : `追蹤「${tag}」相關新聞，對照各媒體報導、關鍵字熱度與逐時趨勢，探索相關事件。`;
  return {
    ...pageMetadata(`/tag/${encodeURIComponent(tag)}/`, `${tag}新聞與趨勢`, description, true),
    alternates: {
      canonical: `https://tag.observe.tw/tag/${encodeURIComponent(tag)}/`,
      types: { 'application/rss+xml': [{ url: `/feeds/tag/${encodeURIComponent(tag)}.xml`, title: `新文易數｜${tag}` }] },
    },
    // One camp or an older page of the list is a view of this page, not another one.
    ...(isCamp(sp.camp) || validCursor(sp.cursor) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function TagPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Query> }) {
  const tag = decodeRouteParam((await params).tag);
  const sp = await searchParams;
  // The footer's @notes/tag/[tag] makes the same series request for the basis list.
  const hours = tagHours(sp);
  const camp = isCamp(sp.camp) ? sp.camp : null;
  const cursor = validCursor(sp.cursor);
  const span = hours % 24 === 0 ? `過去 ${hours / 24} 天` : `過去 ${hours} 小時`;
  const link: ListingLink = (patch) => {
    const next: Record<string, string | null> = { hours: hours === 72 ? null : String(hours), camp, cursor, ...patch };
    const query = new URLSearchParams(Object.entries(next).filter((kv): kv is [string, string] => Boolean(kv[1])));
    return `/tag/${encodeURIComponent(tag)}/${query.size ? `?${query}` : ''}`;
  };
  const [series, { page, facets }, media, status, mentions] = await Promise.all([
    fetchTagSeries(tag, 'all', hours),
    // The list and its camp split use the chart's window and every tagged article in it.
    fetchArticleListing({ tag, hours, camp, cursor }),
    fetchMedia().catch((): MediaInfo => ({})),
    fetchTagStatus(tag).catch(() => null),
    // Reports that name the tag in their title or summary but were not tagged with it.
    cursor ? Promise.resolve(null) : countArticles({ q: tag, hours }),
  ]);
  const tagged = facets?.total ?? 0;
  const untagged = mentions === null ? 0 : mentions - tagged;
  const searchDays = hours <= 24 ? 1 : hours <= 168 ? 7 : 31;
  const searchHref = `/search/?${new URLSearchParams({ q: tag, ...(searchDays === 31 ? {} : { days: String(searchDays) }) })}`;
  // A tag the site has never recorded: no articles, no counts, no ranking, history or events.
  if (
    status &&
    !status.ranking &&
    !status.history &&
    status.threads.length === 0 &&
    status.related.length === 0 &&
    tagged === 0 &&
    !page?.articles.length &&
    !series.points.some((p) => p.count || p.hourlyCount)
  )
    notFound();
  return (
    <div className="space-y-6">
      <StructuredData
        data={pageSchema(
          `/tag/${encodeURIComponent(tag)}/`,
          `${tag}新聞與趨勢`,
          [['/ranking/', '關鍵字排行']],
          (page?.articles ?? []).slice(0, 10).map((a) => ({ name: a.title, path: `/article/${a.id}/` })),
        )}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="text-zinc-500">#</span>
          {tag}
        </h1>
        <div className="flex gap-1 text-sm">
          {[24, 72, 168].map((h) => (
            <Link
              key={h}
              href={`/tag/${encodeURIComponent(tag)}?hours=${h}`}
              className={`rounded-md px-3 py-1 ${h === hours ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
            >
              {h / 24} 天
            </Link>
          ))}
          <a
            href={`https://www.google.com/search?tbm=nws&q=${encodeURIComponent(tag)}`}
            className="rounded-md bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google 新聞 ↗
          </a>
          <a
            href={`/feeds/tag/${encodeURIComponent(tag)}.xml`}
            className="rounded-md bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            title="用 RSS 閱讀器訂閱"
          >
            RSS
          </a>
        </div>
      </div>
      {status && <TagStatusPanel status={status} />}
      <section className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium text-zinc-600">
          每小時新聞數量與 24 小時移動平均（固定基準 {series.basis.media.length} 家媒體）
          <MethodLink className="text-xs font-normal" />
        </h2>
        <TagChart points={series.points} />
      </section>
      {!page ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">報導列表暫時無法使用，請稍後再試。</p>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <aside className="space-y-4 lg:order-2">
            {facets && <ArticleFacets facets={facets} subject={`#${tag} `} span={span} camp={camp} link={link} media={media} />}
            {status && status.threads.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-zinc-600">相關事件</h2>
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {status.threads.map((t) => (
                    <li key={t.id} className="px-3 py-2">
                      <Link href={`/eve/${t.id}/`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                        {t.maxTag ?? t.majorTags[0] ?? `事件 ${t.id}`}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                        {t.majorTags
                          .filter((x) => x !== t.maxTag)
                          .slice(0, 4)
                          .join('、')}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {taipei(t.firstTime)} 起 · 在榜 {t.hours} 小時
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
          <div className="min-w-0 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">{cursor ? '更早的報導' : `${span}標成 #${tag} 的報導`}</h2>
              {untagged > 0 && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  另有 {untagged.toLocaleString()} 篇標題或摘要提到「{tag}」，但沒有這個標籤。
                  <Link href={searchHref} className="text-brand-700 hover:underline dark:text-brand-400">
                    看所有提到「{tag}」的文章 →
                  </Link>
                </p>
              )}
            </div>
            <ArticleList page={page} byHour={hours <= 24} empty={`${span}沒有標成 #${tag} 的報導${camp ? '（目前只看單一傾向）' : ''}。`} />
            <ArticlePager page={page} cursor={cursor} link={link} />
          </div>
        </section>
      )}
    </div>
  );
}
