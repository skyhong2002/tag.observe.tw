import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleBody from '@/components/ArticleBody';
import ArticleImage from '@/components/ArticleImage';
import AuthorCredits from '@/components/AuthorCredits';
import DiscoverySources from '@/components/DiscoverySources';
import MediaHoverLink from '@/components/MediaHoverLink';
import SourceLink from '@/components/SourceLink';
import { API_ORIGIN, taipei } from '@/lib/api';
import { CONTENT_STATUS, type StoredContent } from '@/lib/article-content';
import { type ReadingParams, readingQuery, readingTitle, withReadingQuery } from '@/lib/reading.mts';

export const revalidate = 60;
export default async function ArticleContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ReadingParams>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const query = readingQuery(await searchParams) ?? new URLSearchParams();
  const res = await fetch(`${API_ORIGIN}/api/v1/articles/${id}/content`, {
    next: { revalidate },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (res?.status === 404 || res?.status === 400) notFound();
  if (!res?.ok) return <p className="py-12 text-zinc-600 dark:text-zinc-400">暫時無法取得文章內容，請稍後重新整理。</p>;
  const { article, content } = (await res.json()) as StoredContent;
  const state =
    content.source === 'publisher:excerpt' && content.status !== 'expired'
      ? { label: '原站僅提供摘要', detail: '這個來源提供的是節錄內容，本站未將其收錄為完整正文。' }
      : CONTENT_STATUS[content.status];
  const headline = readingTitle(article.title);
  const expiresAt = content.expiresAt
    ? new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(content.expiresAt))
    : null;
  const mediaHref = `/media/${encodeURIComponent(article.media)}/`;
  const backHref = `${withReadingQuery(mediaHref, query)}#article-${id}`;
  return (
    <article className="mx-auto max-w-[44rem] pb-10 pt-1 sm:pt-4">
      <nav aria-label="文章導覽" className="mb-8 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href={backHref}
          className="inline-flex min-h-9 items-center text-zinc-600 hover:text-brand-700 dark:text-zinc-400 dark:hover:text-brand-400"
        >
          ← {article.mediaTitle}報導
        </Link>
        <SourceLink url={article.url} label="原站文章" />
      </nav>
      <header className="mb-7">
        <p className="mb-4 flex flex-wrap items-center gap-3 text-xs font-medium tracking-wide text-brand-700 dark:text-brand-400">
          <MediaHoverLink media={article.media} className="hover:underline">
            {article.mediaTitle}
          </MediaHoverLink>
          {headline.section && (
            <>
              <span aria-hidden="true">/</span>
              <span>{headline.section}</span>
            </>
          )}
        </p>
        <h1 className="break-words text-[1.75rem] font-semibold leading-[1.5] tracking-tight sm:text-[2.25rem]">{headline.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
          <AuthorCredits credits={article.authors} />
          <time dateTime={article.publishedDate ?? article.publishedAt}>{article.publishedDate ?? taipei(article.publishedAt)}</time>
          {content.body && <span className="text-xs">約 {Math.max(1, Math.ceil(content.chars / 500))} 分鐘閱讀</span>}
        </div>
        <div className="mt-3">
          <DiscoverySources sources={article.discoverySources} />
        </div>
        {expiresAt && (content.body || content.status === 'expired') && (
          <section aria-label="正文保存期限" className="mt-5 rounded-lg bg-zinc-100 px-4 py-3 text-sm leading-7 dark:bg-zinc-900">
            <p className="font-medium">
              {content.status === 'expired' ? '正文保存期限已於 ' : '正文預計於 '}
              <time dateTime={content.expiresAt!}>{expiresAt}</time>
              {content.status === 'expired' ? ' 到期' : ' 後清除'}
              <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">（台北時間）</span>
            </p>
            <p className="text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              正文自取得起保存 90 天，到期後由每日清理作業移除；標題、標籤與原站連結仍會保留。
            </p>
          </section>
        )}
      </header>
      <ArticleImage src={article.image} title={headline.title} mediaTitle={article.mediaTitle} sourceUrl={article.url} />
      {content.body ? (
        <>
          {content.status !== 'ok' && (
            <p className="mb-6 border-l-2 border-amber-500 pl-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">{state.detail}</p>
          )}
          <ArticleBody body={content.body} />
        </>
      ) : (
        <section className="my-8 rounded-lg bg-zinc-50 p-6 dark:bg-zinc-900" aria-label="內文狀態">
          <h2 className="font-medium">{state.label}</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-400">{state.detail}</p>
          {article.description && (
            <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <h3 className="mb-2 text-xs text-zinc-500">文章摘要</h3>
              <p className="text-base leading-8">{article.description}</p>
            </div>
          )}
          <div className="mt-4">
            <SourceLink url={article.url} label="前往原站閱讀" />
          </div>
        </section>
      )}
      <footer className="mt-12 space-y-7 border-t border-zinc-200 pt-7 dark:border-zinc-800">
        {article.tags.length > 0 && (
          <nav aria-label="文章標籤" className="flex flex-wrap gap-2 text-sm">
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}/`}
                className="rounded-full bg-zinc-100 px-3 py-1.5 text-zinc-600 hover:text-brand-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-brand-400"
              >
                #{tag}
              </Link>
            ))}
          </nav>
        )}
        {content.attributions.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium">文中引用來源</h2>
            <ul className="space-y-3 text-sm">
              {content.attributions.map((source) => (
                <li key={source.media} className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
                  <p className="font-medium">
                    {source.name}
                    <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">{source.country}</span>
                  </p>
                  <p className="mt-1 break-words leading-7 text-zinc-600 dark:text-zinc-400">{source.evidence}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">文章提及的來源，不代表原始作者。</p>
          </section>
        )}
        <details className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          <summary className="cursor-pointer py-2 hover:text-zinc-900 dark:hover:text-zinc-200">保存資訊與閱讀說明</summary>
          <div className="mt-2 space-y-1">
            <p>
              {state.label}
              {content.body ? ` · ${content.chars.toLocaleString('zh-TW')} 字` : ''} · 刊登媒體所在地：{article.publisher.country}
            </p>
            {content.fetchedAt && <p>內文擷取：{taipei(content.fetchedAt)}</p>}
            <p>本站呈現已擷取的文字與收錄配圖，其他圖片與影音請見原站。正文從取得全文起保存 90 天。</p>
          </div>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5 text-sm dark:border-zinc-800">
          <Link href={backHref} className="py-2 hover:text-brand-700 dark:hover:text-brand-400">
            ← 繼續瀏覽{article.mediaTitle}
          </Link>
          <SourceLink url={article.url} label="原站文章" />
        </div>
      </footer>
    </article>
  );
}
