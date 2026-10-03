import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleThumbnail from '@/components/ArticleThumbnail';
import CompactArticleList from '@/components/CompactArticleList';
import DiscoverySources from '@/components/DiscoverySources';
import MediaSidebar from '@/components/MediaSidebar';
import MediaWordCloud from '@/components/MediaWordCloud';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import { API_ORIGIN, taipei } from '@/lib/api';
import { CONTENT_STATUS, type MediaContent } from '@/lib/article-content';
import { loadMediaKeywords, loadMediaProfile, mediaReference, profileCamp, profileStatus } from '@/lib/media-profile';
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
  apiQuery.set('limit', '60');
  const hours = query.get('hours'),
    cursor = query.get('cursor'),
    keyword = query.get('q');
  const cloudHours = Number(hours ?? 168);
  const [res, profile, keywords] = await Promise.all([
    fetch(`${API_ORIGIN}/api/v1/media/${encodeURIComponent(media)}/content?${apiQuery}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null),
    loadMediaProfile(media),
    media === 'google_news' || media === 'dongtaiwang' ? null : loadMediaKeywords(media, cloudHours),
  ]);
  if (res?.status === 404 || res?.status === 400) notFound();
  if (!res?.ok) return <p className="py-8 text-zinc-600 dark:text-zinc-400">暫時無法取得文章，請稍後重新整理。</p>;
  const data = (await res.json()) as MediaContent;
  const discovery = data.sourceKind === 'discovery';
  const base = `/media/${encodeURIComponent(media)}/`;
  const firstQuery = new URLSearchParams(query);
  firstQuery.delete('cursor');
  const nextQuery = new URLSearchParams(query);
  if (data.nextCursor) nextQuery.set('cursor', data.nextCursor);
  const clearQuery = new URLSearchParams(firstQuery);
  clearQuery.delete('q');
  const reference = mediaReference(media);
  const periodHref = (value: string | null) => {
    const next = new URLSearchParams(firstQuery);
    if (value) next.set('hours', value);
    else next.delete('hours');
    return withReadingQuery(base, next);
  };
  const since = profile?.collectingSince
    ? new Date(profile.collectingSince).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    : null;
  return (
    <div className="pb-4">
      <nav aria-label="麵包屑" className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/media/" className="hover:text-brand-700 dark:hover:text-brand-400">
          媒體
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        {data.title}
      </nav>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-300 pb-4 dark:border-zinc-700">
        <div>
          <div className="flex items-center gap-2.5">
            {profile?.icon && <SafeImage src={profile.icon} alt="" width={28} height={28} className="rounded" />}
            <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{discovery ? '文章發現來源' : data.publisher?.country}</span>
            {!discovery && profile?.categoryLabel && (
              <>
                <span>·</span>
                <span>{profile.categoryLabel}</span>
              </>
            )}
            {!discovery && profile && (
              <>
                <span>·</span>
                <span>{profileStatus[profile.status]}</span>
              </>
            )}
          </p>
        </div>
        <dl className="flex gap-5 text-right sm:gap-7">
          {(discovery
            ? [{ label: '本頁收錄', value: data.count }]
            : [
                { label: '今日收錄', value: profile?.today },
                { label: '近 24 小時', value: profile?.last24h },
                { label: '近 7 天', value: profile?.last7d },
              ]
          ).map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                {item.value?.toLocaleString('zh-TW') ?? '—'}
                <span className="ml-1 text-[10px] font-normal text-zinc-500">篇</span>
              </dd>
            </div>
          ))}
        </dl>
      </header>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-6">
        <MediaSidebar label={discovery ? '發現來源資料' : undefined}>
          {!discovery && <MediaWordCloud data={keywords} media={media} hours={cloudHours} />}
          <section
            aria-label={discovery ? '發現來源資料' : '媒體基本資料'}
            className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800"
          >
            <h2 className="mb-3 text-sm font-semibold">{discovery ? '發現來源' : '媒體資料'}</h2>
            {discovery && (
              <p className="mb-3 leading-6 text-zinc-600 dark:text-zinc-400">
                經{data.title}發現的文章，依原始刊登媒體收錄。點選標題可在本站閱讀，刊登時間保留原文日期。
              </p>
            )}
            <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-y-2.5 leading-5">
              <dt className="text-zinc-500 dark:text-zinc-400">{discovery ? '發現來源' : '刊登媒體'}</dt>
              <dd>{discovery ? data.title : data.publisher?.name}</dd>
              {data.publisher && (
                <>
                  <dt className="text-zinc-500 dark:text-zinc-400">所屬地區</dt>
                  <dd>{data.publisher.country}</dd>
                </>
              )}
              {!discovery && profile && (
                <>
                  <dt className="text-zinc-500 dark:text-zinc-400">本站分類</dt>
                  <dd>
                    {profile.categoryLabel ?? '未分類'} · {profileCamp[profile.camp]}
                  </dd>
                </>
              )}
              {reference && (
                <>
                  <dt className="text-zinc-500 dark:text-zinc-400">來源網站</dt>
                  <dd>
                    <SourceLink
                      url={
                        'websiteUrl' in reference && typeof reference.websiteUrl === 'string'
                          ? reference.websiteUrl
                          : `https://${reference.domain}`
                      }
                      label={reference.domain}
                      className="!min-h-0"
                    />
                  </dd>
                </>
              )}
              {!discovery && (
                <>
                  <dt className="text-zinc-500 dark:text-zinc-400">開始收錄</dt>
                  <dd>{since ?? '暫無資料'}</dd>
                  <dt className="text-zinc-500 dark:text-zinc-400">最新報導</dt>
                  <dd>
                    {profile?.lastArticle
                      ? new Date(profile.lastArticle).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
                      : '暫無資料'}
                  </dd>
                </>
              )}
              <dt className="text-zinc-500 dark:text-zinc-400">最近更新</dt>
              <dd>{profile?.lastCrawlOk ? taipei(profile.lastCrawlOk) : '暫無資料'}</dd>
            </dl>
            <Link
              href={`/media/sources/?${new URLSearchParams({ q: data.media })}`}
              className="mt-3 block border-t border-zinc-200 pt-2.5 text-brand-700 hover:underline dark:border-zinc-800 dark:text-brand-400"
            >
              Similar Web →
            </Link>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
              {discovery ? '發現來源協助找到文章；文章與全文仍歸屬各原媒體。' : '收錄量為本站抓取的報導，非媒體全部發稿量。'}
              正文從取得全文起保存 90 天。
            </p>
          </section>
        </MediaSidebar>
        <section aria-label="文章列表" className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <h2 className="text-sm font-semibold">{cursor ? '較早收錄' : '最新收錄'}</h2>
            <nav aria-label="刊登時間範圍" className="flex flex-wrap gap-1 text-xs">
              {[
                { value: null, label: '全部' },
                { value: '24', label: '1 天' },
                { value: '72', label: '3 天' },
                { value: '168', label: '7 天' },
              ].map(({ value, label }) => (
                <Link
                  key={label}
                  href={periodHref(value)}
                  aria-current={hours === value ? 'page' : undefined}
                  className={`rounded px-2.5 py-1.5 ${hours === value ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={base} className="mb-1 flex gap-2">
            {hours && <input type="hidden" name="hours" value={hours} />}
            <input
              key={keyword ?? ''}
              name="q"
              defaultValue={keyword ?? ''}
              maxLength={60}
              aria-label={discovery ? '搜尋此來源發現的文章' : '搜尋這家媒體的報導'}
              placeholder={discovery ? '搜尋此來源發現的文章' : '搜尋這家媒體的報導'}
              className="min-w-0 flex-1 rounded border border-zinc-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-brand-600 dark:border-zinc-700"
            />
            <button
              type="submit"
              className="rounded border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              搜尋
            </button>
          </form>
          {keyword && (
            <p className="flex items-center justify-between gap-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span>篩選「{keyword}」</span>
              <Link href={withReadingQuery(base, clearQuery)} className="hover:underline">
                清除篩選 ×
              </Link>
            </p>
          )}
          <CompactArticleList count={data.count}>
            {!data.articles.length && (
              <div className="space-y-3 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  {keyword
                    ? '沒有符合關鍵字的報導。'
                    : cursor
                      ? '已經沒有更早的文章。'
                      : hours
                        ? '這段時間沒有收錄報導。'
                        : discovery
                          ? '此來源尚無已收錄的文章。'
                          : '這個媒體尚無收錄文章。'}
                </p>
                {(cursor || hours || keyword) && (
                  <Link href={base} className="inline-block py-2 text-brand-700 hover:underline dark:text-brand-400">
                    查看所有收錄 →
                  </Link>
                )}
              </div>
            )}
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.articles.map((article) => {
                const headline = readingTitle(article.title),
                  href = withReadingQuery(`/article/${article.id}/`, query),
                  readable = article.bodyChars > 0;
                return (
                  <li key={article.id} id={`article-${article.id}`} className="scroll-mt-32 py-2.5">
                    <article className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[15px] font-medium leading-6">
                          <Link href={href} className="hover:text-brand-700 dark:hover:text-brand-400">
                            {headline.section && (
                              <span className="mr-1.5 text-xs font-normal text-brand-700 dark:text-brand-400">{headline.section}</span>
                            )}
                            {headline.title}
                          </Link>
                        </h3>
                        {article.description && (
                          <p className="mt-1 hidden text-xs leading-5 text-zinc-500 group-data-[summaries=true]/list:line-clamp-2 dark:text-zinc-400">
                            {article.description}
                          </p>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                          {discovery && (
                            <Link
                              href={`/media/${encodeURIComponent(article.media)}/`}
                              className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                            >
                              {article.mediaTitle}
                            </Link>
                          )}
                          <time dateTime={article.publishedDate ?? article.publishedAt}>
                            {article.publishedDate ?? taipei(article.publishedAt)}
                          </time>
                          {article.authors.length > 0 && <span className="max-w-40 truncate">{article.authors.join('、')}</span>}
                          <span className={readable ? 'text-zinc-500 dark:text-zinc-400' : 'text-amber-700 dark:text-amber-400'}>
                            {readable ? '可讀內文' : CONTENT_STATUS[article.bodyStatus].label}
                          </span>
                          <SourceLink url={article.url} className="!min-h-5 !text-[11px]" />
                        </div>
                        <DiscoverySources sources={article.discoverySources} />
                      </div>
                      <ArticleThumbnail src={article.image} href={href} title={headline.title} />
                    </article>
                  </li>
                );
              })}
            </ul>
          </CompactArticleList>
          <nav
            aria-label="文章分頁"
            className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800"
          >
            {cursor ? (
              <Link href={withReadingQuery(base, firstQuery)} className="py-2 hover:underline">
                ← 回到最新收錄
              </Link>
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400">每頁最多 60 篇</span>
            )}
            {data.nextCursor && (
              <Link
                href={withReadingQuery(base, nextQuery)}
                className="rounded border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                更早的文章 →
              </Link>
            )}
          </nav>
        </section>
      </div>
    </div>
  );
}
