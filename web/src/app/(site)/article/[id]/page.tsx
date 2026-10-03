import Link from 'next/link';
import { notFound } from 'next/navigation';
import { API_ORIGIN, taipei } from '@/lib/api';
import { CONTENT_STATUS, type StoredContent } from '@/lib/article-content';

export const revalidate = 60;
export default async function ArticleContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const res = await fetch(`${API_ORIGIN}/api/v1/articles/${id}/content`, {
    next: { revalidate },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (res?.status === 404 || res?.status === 400) notFound();
  if (!res?.ok) return <p className="text-zinc-600">暫時無法取得文章內容，請稍後再試。</p>;
  const { article, content } = (await res.json()) as StoredContent;
  const state = CONTENT_STATUS[content.status];
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/media/${encodeURIComponent(article.media)}/articles/`}
        className="text-sm text-brand-700 hover:underline dark:text-brand-400"
      >
        ← {article.mediaTitle}全文資料庫
      </Link>
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold leading-relaxed tracking-tight sm:text-3xl">{article.title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          刊登媒體：
          <Link href={`/media/${encodeURIComponent(article.media)}/`} className="hover:underline">
            {article.publisher.name}
          </Link>{' '}
          ・所屬地區：{article.publisher.country}・{taipei(article.publishedAt)}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          原站署名：{article.authors.length ? article.authors.join('、') : '未提供'}
        </p>
        {/^https?:\/\//i.test(article.url) && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-brand-700 hover:underline dark:text-brand-400"
          >
            查看原站文章 ↗
          </a>
        )}
      </header>
      <div className="space-y-2 rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="font-medium">
          {state.label}
          {content.body ? `・${content.chars.toLocaleString('zh-TW')} 字` : ''}
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">{state.detail}</p>
        {content.fetchedAt && <p className="text-zinc-600 dark:text-zinc-400">正文擷取時間：{taipei(content.fetchedAt)}</p>}
        <p className="text-zinc-600 dark:text-zinc-400">正文保存至刊登後 90 天；此頁閱讀本站保存內容。</p>
      </div>
      {content.body && (
        <div className="whitespace-pre-wrap break-words text-base leading-8 text-zinc-800 dark:text-zinc-200">{content.body}</div>
      )}
      {content.attributions.length > 0 && (
        <section className="space-y-3 border-t border-zinc-300 pt-5 dark:border-zinc-800">
          <h2 className="font-semibold">文中明示引用的媒體</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">引用證據表示文中提及來源，不等同原始作者；地區指媒體所屬地區。</p>
          <ul className="space-y-3 text-sm">
            {content.attributions.map((source) => (
              <li key={source.media} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                <p className="font-medium">
                  {source.name}・{source.country}
                </p>
                <p className="mt-1 break-words text-zinc-600 dark:text-zinc-400">引用證據：{source.evidence}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {article.tags.length > 0 && (
        <nav aria-label="文章標籤" className="flex flex-wrap gap-2 text-sm">
          {article.tags.map((tag) => (
            <Link
              key={tag}
              href={`/tag/${encodeURIComponent(tag)}/`}
              className="rounded-md bg-zinc-100 px-2 py-1 hover:underline dark:bg-zinc-800"
            >
              #{tag}
            </Link>
          ))}
        </nav>
      )}
    </article>
  );
}
