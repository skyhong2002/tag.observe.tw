import type { NewsSiteRules } from './news-site-rules.ts';

// Public article templates verified on 2026-10-03. The Yam header identifies
// the actual syndicated publisher; sidebar .source-name elements are unrelated.
export const BLOCKED_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
  {
    host: 'businessweekly.com.tw',
    path: /^\/[a-z]+\/(?:blog|indep)\/\d+$/,
    titleSelector: 'h1',
    bodySelector: '.article-body.Single-article',
  },
  {
    host: 'ftvnews.com.tw',
    path: /^\/news\/detail\/[A-Za-z0-9]+$/,
    titleSelector: 'h1',
    bodySelector: '.article-body > article',
    providerSelector: '.article-body > article > #preface > p:first-child',
    // The preface contains the actual lead, including on syndicated articles.
    // A mention of RWNews in the body is not a provider credit.
    bodyExcludeSelector: '.aphorism, strong:has(> a.othernews), #newscontent > p:has(> a[href^="https://rwnews.tw/article.php?news="])',
  },
  {
    host: 'n.yam.com',
    path: /^\/Article\/\d+$/i,
    titleSelector: 'section.inner-page h1',
    bodySelector: 'section.inner-page > .inner-content',
    providerSelector: 'section.inner-page .source-name',
  },
];
