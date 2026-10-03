import type { NewsSiteRules } from './news-site-rules.ts';

// Migrated Minpo articles preserve their original publisher in the article
// byline. The shared /author/peoplemedia-contributor/ page is not that credit.
export const ROUND3_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
  {
    host: 'grinews.com',
    path: /^\/news\/(?!author\/|category\/|tag\/|wp-json\/)[^/]+\/$/,
    titleSelector: 'article > .post-banner > .post-title',
    bodySelector: 'article > .post-content',
    // The shared CO author archive also contains TechOrange posts; use the
    // explicit license credit inside this article to distinguish the brands.
    providerSelector: 'article > .post-content > p > span > strong > span > a',
  },
  {
    host: 'roomie.tw',
    path: /^\/posts\/\d+$/,
    titleSelector: 'main > article:first-of-type h1',
    bodySelector: 'main > article:first-of-type > .content',
    providerSelector: 'main > article:first-of-type .author-section a[href*="/posts/author/"]',
    bodyExcludeSelector: '.wp-block-heading:has(a[href*="instagram.com/roomie"])',
  },
  {
    host: 'fearless.cool',
    path: /^\/mag\/[^/]+\/$/,
    titleSelector: 'main.site-main h1.entry-title',
    bodySelector: 'main.site-main > .page-content > div:not(.post-tags)',
    providerSelector: 'main.site-main .page-content p > strong:contains("※本文版權為")',
    bodyExcludeSelector: 'p:has(a[href^="mailto:"]), p:contains("投稿、推薦作者、討論文章")',
  },
  {
    host: 'e-info.org.tw',
    path: /^\/node\/\d+$/,
    titleSelector: 'main h1',
    publishedSelector: 'main time.date',
    providerSelector: 'main [class^="post-credit__CreditName"]',
    bodySelector: 'main article[class^="post-content__Content"]',
    bodyHtmlSelector: 'main article[class^="post-content__Content"]',
  },
  {
    host: 'vigormedia.tw',
    path: /^\/(?!author\/|category\/|tag\/|wp-json\/)[^/]+\/$/,
    titleSelector: '.tdb_single_title h1',
    publishedSelector: '.tdb_single_date time',
    providerSelector: '.tdb_single_author .tdb-author-name',
    bodySelector: '.tdb_single_content > .tdb-block-inner',
    bodyExcludeSelector: '.sharedaddy, .jp-relatedposts, .fb-comments, .peoplemedia-content-notice',
  },
];
