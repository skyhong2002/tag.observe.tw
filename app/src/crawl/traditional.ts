import opencc from 'opencc-js/cn2t';
import type { ArticleDetail } from './article.ts';
import type { FeedItem } from './feed.ts';

const converter = opencc.Converter({ from: 'cn', to: 'tw' });
export const toTraditional = (value: string): string => converter(value);
export function traditionalizeFeedItem(item: FeedItem): FeedItem {
  return {
    ...item,
    title: toTraditional(item.title),
    ...(item.category ? { category: toTraditional(item.category) } : {}),
    ...(item.tags ? { tags: [...new Set(item.tags.map(toTraditional))] } : {}),
    ...(item.description ? { description: toTraditional(item.description) } : {}),
    ...(item.summary ? { summary: toTraditional(item.summary) } : {}),
    ...(item.creator ? { creator: toTraditional(item.creator) } : {}),
    ...(item.contentHtml ? { contentHtml: toTraditional(item.contentHtml) } : {}),
    ...(item.verifiedContent
      ? {
          verifiedContent: {
            ...item.verifiedContent,
            body: toTraditional(item.verifiedContent.body),
            authors: item.verifiedContent.authors.map(toTraditional),
          },
        }
      : {}),
  };
}
export function traditionalizeArticle(detail: ArticleDetail): ArticleDetail {
  return {
    ...detail,
    title: detail.title ? toTraditional(detail.title) : detail.title,
    description: detail.description ? toTraditional(detail.description) : detail.description,
    summary: detail.summary ? toTraditional(detail.summary) : detail.summary,
    body: detail.body ? toTraditional(detail.body) : detail.body,
    authors: detail.authors.map(toTraditional),
    provider: detail.provider ? toTraditional(detail.provider) : detail.provider,
    tags: [...new Set(detail.tags.map(toTraditional))],
  };
}
