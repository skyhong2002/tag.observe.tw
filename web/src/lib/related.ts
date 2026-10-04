import { API_ORIGIN } from './api';

export type { ArticleRelated, RelatedArticle } from '../../../app/src/v1/article-related-types';

import type { ArticleRelated } from '../../../app/src/v1/article-related-types';

/** Server-side: 延伸閱讀 for one article; null when unavailable. */
export async function fetchArticleRelated(id: number): Promise<ArticleRelated | null> {
  const response = await fetch(`${API_ORIGIN}/api/v1/articles/${id}/related`, {
    next: { revalidate: 300 },
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  return response.json() as Promise<ArticleRelated>;
}
