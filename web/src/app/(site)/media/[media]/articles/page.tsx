import Link from 'next/link';
import { notFound } from 'next/navigation';
import { API_ORIGIN, taipei } from '@/lib/api';
import { CONTENT_STATUS, type MediaContent } from '@/lib/article-content';

export const revalidate = 60;
export default async function MediaArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ media: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { media } = await params;
  const { cursor: rawCursor } = await searchParams;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;
  if (cursor !== undefined && (!/^[1-9]\d{0,15}$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))) notFound();
  const query = new URLSearchParams({ limit: '40' });
  if (cursor) query.set('cursor', cursor);
  const res = await fetch(`${API_ORIGIN}/api/v1/media/${encodeURIComponent(media)}/content?${query}`, {
    next: { revalidate },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (res?.status === 404 || res?.status === 400) notFound();
  if (!res?.ok) return <p className="text-zinc-600">暫時無法取得全文資料庫，請稍後再試。</p>;
  const data = (await res.json()) as MediaContent;
  const base = `/media/${encodeURIComponent(media)}/articles/`;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href={`/media/${encodeURIComponent(media)}/`} className="text-sm text-brand-700 hover:underline dark:text-brand-400">
          ← {data.title}報導總覽
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{data.title}全文資料庫</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          刊登媒體所屬地區：{data.publisher.country}。依收錄順序顯示，每頁最多 40 篇。
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          點選文章可閱讀本站保存的正文、署名與引用來源。原站文章下架後，保存期間仍可閱讀；正文於刊登 90 天後清除。
        </p>
      </header>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {!data.articles.length && (
          <li className="p-6 text-sm text-zinc-600 dark:text-zinc-400">{cursor ? '這一頁沒有更多收錄文章。' : '這個媒體尚無收錄文章。'}</li>
        )}
        {data.articles.map((article) => (
          <li key={article.id} className="space-y-2 p-4">
            <Link href={`/article/${article.id}/`} className="block font-medium leading-relaxed hover:underline">
              {article.title || '未提供標題'}
            </Link>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {taipei(article.publishedAt)}・原站署名：{article.authors.length ? article.authors.join('、') : '未提供'}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {CONTENT_STATUS[article.bodyStatus].label}・{article.bodyChars.toLocaleString('zh-TW')} 字
              {article.contentFetchedAt ? `・擷取 ${taipei(article.contentFetchedAt)}` : ''}
            </p>
            <Link href={`/article/${article.id}/`} className="inline-block text-sm text-brand-700 hover:underline dark:text-brand-400">
              {article.bodyChars > 0 ? '閱讀保存內容' : '查看文章與正文狀態'} →
            </Link>
          </li>
        ))}
      </ul>
      <nav aria-label="全文資料庫分頁" className="flex flex-wrap justify-between gap-3 text-sm">
        {cursor ? (
          <Link
            href={base}
            className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            回到最新收錄
          </Link>
        ) : (
          <span />
        )}
        {data.nextCursor && (
          <Link
            href={`${base}?cursor=${encodeURIComponent(data.nextCursor)}`}
            className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            更早收錄文章 →
          </Link>
        )}
      </nav>
    </div>
  );
}
