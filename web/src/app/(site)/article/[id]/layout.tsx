import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { API_ORIGIN } from '@/lib/api';
import type { StoredContent } from '@/lib/article-content';
import { isAllowedImage } from '@/lib/images';
import { readingTitle } from '@/lib/reading.mts';
import { fetchArticleRelated } from '@/lib/related';
import { articleIndexable } from '@/lib/seo.mts';
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

  const { article, content } = (await res.json()) as StoredContent;
  // Only pages without a readable excerpt need the extra indexing decision.
  // These are the same cached requests the visible page already makes.
  const [related, similar] = articleIndexable(content, null, null)
    ? [null, null]
    : await Promise.all([fetchArticleRelated(Number(id)), fetchArticleSimilarity(Number(id))]);
  const headline = readingTitle(article.title).title;
  const title = `${headline}｜${article.mediaTitle}`;
  const summary = article.description?.trim() || content.body?.trim() || title;
  const characters = Array.from(summary.replace(/\s+/g, ' '));
  const description = characters.slice(0, 160).join('') + (characters.length > 160 ? '…' : '');
  const url = `https://tag.observe.tw/article/${article.id}/`;
  const images = isAllowedImage(article.image)
    ? [{ url: article.image, alt: `${headline}（新聞配圖）` }]
    : [{ url: 'https://tag.observe.tw/opengraph-image.png', width: 1200, height: 630, alt: '新文易數：同一件事，各家怎麼說' }];

  return {
    title,
    description,
    ...(!articleIndexable(content, related, similar) ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: url },
    authors: article.authors.map((name) => ({ name })),
    openGraph: {
      type: 'article',
      siteName: '新文易數',
      locale: 'zh_TW',
      title,
      description,
      url,
      images,
      publishedTime: article.publishedDate ?? article.publishedAt,
      authors: article.authors,
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  };
}

export default function ArticleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
