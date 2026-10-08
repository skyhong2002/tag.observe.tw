import type { Metadata } from 'next';
import type { StoredContent } from '@/lib/article-content';
import { isAllowedImage } from '@/lib/images';
import { readingExcerpt, readingTitle } from '@/lib/reading.mts';
import { articleIndexable, publicArticleContent, SITE_ORIGIN } from '@/lib/seo.mts';

/**
 * Metadata for a page that shows one article: /article/[id]/ and the 專題
 * pages that render the feature's own article.
 */
export function articleMetadata(
  { article, content }: StoredContent,
  {
    path,
    titleSuffix = article.mediaTitle,
    indexable,
  }: {
    path: string;
    titleSuffix?: string;
    /** Decided by the caller when the article alone is not a useful search result. */
    indexable: boolean;
  },
): Metadata {
  const headline = readingTitle(article.title).title;
  const title = `${headline}｜${titleSuffix}`;
  const visible = publicArticleContent(content);
  const text = article.summary?.trim() || visible.body?.trim() || article.description?.trim();
  const summary = text ? readingExcerpt(text) : title;
  const characters = Array.from(summary.replace(/\s+/g, ' '));
  const description = characters.slice(0, 160).join('') + (characters.length > 160 ? '…' : '');
  const url = SITE_ORIGIN + path;
  const images = isAllowedImage(article.image)
    ? [{ url: article.image, alt: `${headline}（新聞配圖）` }]
    : [{ url: `${SITE_ORIGIN}/opengraph-image.png`, width: 1200, height: 630, alt: '新文易數：同一件事，各家怎麼說' }];
  return {
    title,
    description,
    ...(!indexable ? { robots: { index: false, follow: true } } : {}),
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

export { articleIndexable };

/** A 專題's own article is read at its /feature/ URL: the page that also lists its stories. */
export function featurePathOf(article: StoredContent['article']): string | null {
  const own = article.collections?.find((c) => c.kind === 'feature' && c.self);
  return own ? `/feature/${encodeURIComponent(own.media)}/${encodeURIComponent(own.id)}/` : null;
}
