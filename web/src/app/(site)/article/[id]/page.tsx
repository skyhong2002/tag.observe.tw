import { notFound, permanentRedirect } from 'next/navigation';
import ArticleView from '@/components/article/ArticleView';
import { API_ORIGIN } from '@/lib/api';
import type { StoredContent } from '@/lib/article-content';
import { featurePathOf } from '@/lib/article-metadata';
import { type ReadingParams, readingQuery, withReadingQuery } from '@/lib/reading.mts';
import { fetchArticleRelated } from '@/lib/related';
import { fetchArticleSimilarity } from '@/lib/similarity';

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
  // Started alongside the content request; they resolve to null on failure.
  const similarRequest = fetchArticleSimilarity(Number(id));
  const relatedRequest = fetchArticleRelated(Number(id));
  const res = await fetch(`${API_ORIGIN}/api/v1/articles/${id}/content`, {
    next: { revalidate },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (res?.status === 404 || res?.status === 400) notFound();
  if (!res?.ok) return <p className="py-12 text-zinc-600 dark:text-zinc-400">暫時無法取得文章內容，請稍後重新整理。</p>;
  const [content, similar, related] = await Promise.all([res.json() as Promise<StoredContent>, similarRequest, relatedRequest]);
  const featurePath = featurePathOf(content.article);
  if (featurePath) permanentRedirect(featurePath);
  const mediaHref = `/media/${encodeURIComponent(content.article.media)}/`;
  return (
    <ArticleView
      content={content}
      related={related}
      similar={similar}
      back={{ href: `${withReadingQuery(mediaHref, query)}#article-${id}`, label: `${content.article.mediaTitle}報導` }}
    />
  );
}
