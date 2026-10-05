import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { API_ORIGIN } from '@/lib/api';
import type { StoredContent } from '@/lib/article-content';
import { articleIndexable, articleMetadata } from '@/lib/article-metadata';
import { fetchArticleRelated } from '@/lib/related';
import { fetchArticleSimilarity } from '@/lib/similarity';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();

  const res = await fetch(`${API_ORIGIN}/api/v1/articles/${id}/content`, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (res?.status === 404 || res?.status === 400) notFound();
  if (!res?.ok) return { title: '暫時無法取得文章', robots: { index: false, follow: true } };

  const stored = (await res.json()) as StoredContent;
  // Only pages without a readable excerpt need the extra indexing decision.
  // These are the same cached requests the visible page already makes.
  const [related, similar] = articleIndexable(stored.content, null, null)
    ? [null, null]
    : await Promise.all([fetchArticleRelated(Number(id)), fetchArticleSimilarity(Number(id))]);
  return articleMetadata(stored, {
    path: `/article/${stored.article.id}/`,
    indexable: articleIndexable(stored.content, related, similar),
  });
}

export default function ArticleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
