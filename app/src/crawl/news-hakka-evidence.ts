import { extractArticle, parsePublished } from './article.ts';

/** Validate the publisher's article API identity before using it as QA evidence. */
export function hakkaArticleFromPublicApi(url: string, record: unknown) {
  let page: URL;
  try {
    page = new URL(url);
  } catch {
    return null;
  }
  const id = /^\/news-detail\/(\d{10,})$/.exec(page.pathname)?.[1];
  if (!id || !['hakkatv.org.tw', 'www.hakkatv.org.tw'].includes(page.hostname) || !record || typeof record !== 'object') return null;
  const item = record as Record<string, unknown>;
  if (
    String(item.id) !== id ||
    item.status !== 1 ||
    typeof item.title !== 'string' ||
    item.title.length < 4 ||
    typeof item.content !== 'string'
  )
    return null;
  if (typeof item.created_at !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(item.created_at)) return null;
  const published = parsePublished(item.created_at);
  if (!published) return null;
  const structured = JSON.stringify({
    '@type': 'NewsArticle',
    url,
    headline: item.title,
    articleBody: item.content,
    datePublished: published.toISOString(),
    author: typeof item.author === 'string' && item.author ? { '@type': 'Person', name: item.author } : undefined,
  }).replace(/</g, '\\u003c');
  const detail = extractArticle(`<script type="application/ld+json">${structured}</script>`, url);
  return detail.bodyStatus === 'ok' ? { ...detail, bodySource: 'api:hakkatv' } : null;
}
