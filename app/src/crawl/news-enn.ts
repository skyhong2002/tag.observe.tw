import type { NewsSiteRules } from './news-site-rules.ts';

// ENN and 17news are explicitly named as the same publisher group by 17news's
// public terms. Individual stories still require an ENN reporter's lead credit.
export const ENN_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
  {
    host: '17news.net',
    path: /^\/archives\/\d+$/,
    titleSelector: 'article.ak-article h1.ak-post-title',
    bodySelector: 'article.ak-article > .ak-article-inner > .ak-post-content',
    providerSelector: 'article.ak-article > .ak-article-inner > .ak-post-content > p:first-of-type',
  },
];
