import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArticleFacets, ArticleList, ArticlePager, type ListingLink, RangeChips } from '@/components/ArticleResults';
import MethodLink from '@/components/MethodLink';
import TagSummaryCard from '@/components/TagSummaryCard';
import { fetchMedia, fetchTagSeries, fetchTagStatus, type MediaInfo } from '@/lib/api';
import { countArticles, fetchArticleListing, isCamp, rangeDays, validCursor } from '@/lib/article-search';
import { clipHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import { fetchEvents } from '@/lib/pages';

// Site search over every stored article: title, summary and exact tag (we do
// not search article bodies), via /api/v1/articles. The query is typed in the
// header's search box, which this page fills with it; with no query the page
// sends readers to the plain listing (最新文章). The scope and what the
// camp bar counts are in the footer's 資料來源與計算方式 (SearchMethod).

type Search = { q?: string; days?: string; camp?: string; cursor?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const q = (await searchParams).q?.trim();
  return { title: q ? `搜尋：${q}` : '最新文章', robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const days = rangeDays(sp.days, 31);
  const camp = isCamp(sp.camp) ? sp.camp : null;
  const cursor = validCursor(sp.cursor);
  const link: ListingLink = (patch) => {
    const next: Record<string, string | null> = { q, days: days === 31 ? null : String(days), camp, ...patch };
    const params = new URLSearchParams(Object.entries(next).filter((kv): kv is [string, string] => Boolean(kv[1])));
    return `/search/?${params}`;
  };

  // Nothing to search for: the plain listing is the same list without a term.
  if (!q) redirect('/article/');
  // On the first page, whether the query is also a tag, and that tag's standing.
  const first = !cursor;
  const [{ page, facets }, media, events, tagged, status, series] = await Promise.all([
    fetchArticleListing({ q, days, camp, cursor }),
    fetchMedia().catch((): MediaInfo => ({})),
    first ? fetchEvents(30).catch(() => null) : null,
    first ? countArticles({ tag: q, hours: days * 24 }) : null,
    first ? fetchTagStatus(q).catch(() => null) : null,
    first ? fetchTagSeries(q, 'all', 72).catch(() => null) : null,
  ]);
  const needle = q.toLocaleLowerCase('zh-TW');
  const relatedEvents = (events?.events ?? [])
    .filter(
      (e) =>
        e.relatedEventPk &&
        [...e.major, ...e.tags.map((t) => t.tag), ...e.news.map((n) => n.title)].some((s) => s.toLocaleLowerCase('zh-TW').includes(needle)),
    )
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">「{q}」的搜尋結果</h1>
        <p className="text-xs">
          <MethodLink />
        </p>
      </div>

      {!page ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">搜尋暫時無法使用，請稍後再試。</p>
      ) : (
        <>
          <RangeChips days={days} defaultDays={31} link={link} />

          {tagged ? (
            <TagSummaryCard tag={q} tagged={tagged} span={`過去 ${days} 天`} status={status} points={series?.points ?? null} />
          ) : null}

          {relatedEvents.length > 0 && (
            <section className="space-y-2" aria-label="相關焦點事件">
              <h2 className="text-sm font-medium text-zinc-600">相關焦點事件</h2>
              <ul className="grid gap-2 md:grid-cols-3">
                {relatedEvents.map((e) => {
                  const lead = selectEventLead(e.news, e.major);
                  return (
                    <li key={e.relatedEventPk}>
                      <Link
                        href={`/eve/${e.relatedEventPk}/`}
                        className="block h-full rounded-xl border border-zinc-300 bg-white p-3 text-sm hover:border-brand-700 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <span className="text-xs text-zinc-500">{e.major.slice(0, 3).join(' · ')}</span>
                        <span className="mt-1 line-clamp-2 block font-medium">{lead ? clipHeadline(lead.title) : e.major.join('、')}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            {facets && (
              <aside className="lg:order-2">
                <div className="lg:sticky lg:top-20">
                  <ArticleFacets facets={facets} subject={`「${q}」`} span={`過去 ${days} 天`} camp={camp} link={link} media={media} />
                </div>
              </aside>
            )}
            <div className="min-w-0 space-y-4">
              <ArticleList page={page} q={q} empty={`過去 ${days} 天沒有符合「${q}」的文章${camp ? '（目前只看單一傾向）' : ''}。`} />
              <ArticlePager page={page} cursor={cursor} link={link} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
