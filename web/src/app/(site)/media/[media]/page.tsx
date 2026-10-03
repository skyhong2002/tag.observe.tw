import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleThumbnail from '@/components/ArticleThumbnail';
import SourceLink from '@/components/SourceLink';
import { API_ORIGIN, taipei } from '@/lib/api';
import { CONTENT_STATUS, type MediaContent } from '@/lib/article-content';
import { type ReadingParams, readingQuery, readingTitle, withReadingQuery } from '@/lib/reading.mts';

export const revalidate = 60;

export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ media: string }>;
  searchParams: Promise<ReadingParams>;
}) {
  const { media } = await params;
  const query = readingQuery(await searchParams);
  if (!query) notFound();
  const apiQuery = new URLSearchParams(query);
  apiQuery.set('limit', '30');
  const res = await fetch(`${API_ORIGIN}/api/v1/media/${encodeURIComponent(media)}/content?${apiQuery}`, {
    next: { revalidate },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (res?.status === 404 || res?.status === 400) notFound();
  if (!res?.ok) return <p className="py-12 text-zinc-600 dark:text-zinc-400">暫時無法取得文章，請稍後重新整理。</p>;
  const data = (await res.json()) as MediaContent;
  const base = `/media/${encodeURIComponent(media)}/`;
  const hours = query.get('hours');
  const cursor = query.get('cursor');
  const firstQuery = new URLSearchParams(query);
  firstQuery.delete('cursor');
  const nextQuery = new URLSearchParams(query);
  if (data.nextCursor) nextQuery.set('cursor', data.nextCursor);
  const tags = new Map<string, number>();
  for (const article of data.articles) for (const tag of new Set(article.tags)) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  const topTags = [...tags].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <div className="pb-8">
      <nav aria-label="麵包屑" className="mb-7 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/media/" className="hover:text-brand-700 dark:hover:text-brand-400">
          媒體
        </Link>
        <span className="mx-3" aria-hidden="true">
          /
        </span>
        <span className="text-zinc-700 dark:text-zinc-300">{data.title}</span>
      </nav>
      <header className="mb-8 border-b border-zinc-900 pb-8 dark:border-zinc-300">
        <p className="mb-3 text-xs font-medium tracking-[0.16em] text-brand-700 dark:text-brand-400">媒體報導 · {data.publisher.country}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{data.title}</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">瀏覽收錄報導，點選標題即可在本站閱讀。原站連結以 ↗ 標示。</p>
      </header>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-14">
        <section aria-label="文章列表" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <h2 className="font-semibold">{cursor ? '較早收錄' : '最新收錄'}</h2>
            <nav aria-label="刊登時間範圍" className="flex flex-wrap gap-1 text-sm">
              {[
                { value: null, label: '全部' },
                { value: '24', label: '1 天' },
                { value: '72', label: '3 天' },
                { value: '168', label: '7 天' },
              ].map(({ value, label }) => (
                <Link
                  key={label}
                  href={value ? `${base}?hours=${value}` : base}
                  aria-current={hours === value ? 'page' : undefined}
                  className={`rounded-full px-3 py-2 transition-colors ${hours === value ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {!data.articles.length && (
            <div className="space-y-4 py-16 text-center text-sm text-zinc-600 dark:text-zinc-400">
              <p>{cursor ? '已經沒有更早的文章。' : hours ? '這段時間沒有收錄報導。' : '這個媒體尚無收錄文章。'}</p>
              {(cursor || hours) && (
                <Link href={base} className="inline-block py-2 text-brand-700 hover:underline dark:text-brand-400">
                  查看所有收錄 →
                </Link>
              )}
            </div>
          )}
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data.articles.map((article) => {
              const headline = readingTitle(article.title);
              const href = withReadingQuery(`/article/${article.id}/`, query);
              const readable = article.bodyChars > 0;
              return (
                <li key={article.id} id={`article-${article.id}`} className="scroll-mt-32 py-6 sm:py-7">
                  <article>
                    <div className="flex items-start gap-4 sm:gap-6">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {headline.section && <span className="font-medium text-brand-700 dark:text-brand-400">{headline.section}</span>}
                          <time dateTime={article.publishedAt}>{taipei(article.publishedAt)}</time>
                        </div>
                        <h3 className="text-lg font-semibold leading-relaxed tracking-tight sm:text-xl">
                          <Link href={href} className="hover:text-brand-700 dark:hover:text-brand-400">
                            {headline.title}
                          </Link>
                        </h3>
                        {article.description && (
                          <p className="mt-2 line-clamp-2 text-sm leading-7 text-zinc-600 dark:text-zinc-400">{article.description}</p>
                        )}
                      </div>
                      <ArticleThumbnail src={article.image} href={href} title={headline.title} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {article.authors.length > 0 && <span>{article.authors.join('、')}</span>}
                      <Link
                        href={href}
                        className="inline-flex min-h-8 items-center gap-1.5 text-zinc-700 hover:text-brand-700 dark:text-zinc-300 dark:hover:text-brand-400"
                      >
                        {readable ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
                            站內閱讀<span aria-hidden="true"> →</span>
                          </>
                        ) : (
                          CONTENT_STATUS[article.bodyStatus].label
                        )}
                      </Link>
                      <SourceLink url={article.url} />
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          <nav
            aria-label="文章分頁"
            className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-6 text-sm dark:border-zinc-800"
          >
            {cursor ? (
              <Link href={withReadingQuery(base, firstQuery)} className="py-2 hover:underline">
                ← 回到最新收錄
              </Link>
            ) : (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">本頁 {data.count} 篇 · 依收錄順序</span>
            )}
            {data.nextCursor && (
              <Link
                href={withReadingQuery(base, nextQuery)}
                className="rounded-full border border-zinc-300 px-5 py-2.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                更早的文章 →
              </Link>
            )}
          </nav>
        </section>
        <aside className="space-y-8 text-sm">
          {topTags.length > 0 && (
            <section>
              <h2 className="mb-4 text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">本頁關鍵字</h2>
              <ul className="space-y-1">
                {topTags.map(([tag, count]) => (
                  <li key={tag}>
                    <Link
                      href={`/tag/${encodeURIComponent(tag)}/`}
                      className="flex justify-between gap-3 py-2 hover:text-brand-700 dark:hover:text-brand-400"
                    >
                      <span>{tag}</span>
                      <span className="tabular-nums text-zinc-400">{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="border-t border-zinc-200 pt-6 text-xs leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <h2 className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">關於本站閱讀</h2>
            <p>有內文的報導可直接閱讀。尚無內文時，文章頁會顯示收錄資訊與原站連結。</p>
            <p className="mt-2">正文保存至刊登後 90 天。</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
