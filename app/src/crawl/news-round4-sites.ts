import type { NewsSiteRules } from './news-site-rules.ts';

// Article templates verified on 2026-10-04 for outlets whose bodies were
// stored as missing: the pages load publicly but the generic containers do not
// match them, or ordinary text (訂閱…閱讀) looked like a paywall.
export const ROUND4_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
  {
    host: 'gnn.gamer.com.tw',
    path: /^\/detail\.php\?sn=\d+$/,
    bodySelector: '.GN-lbox3 > .GN-lbox3B',
    plainTextBody: true,
  },
  {
    host: 'businesstoday.com.tw',
    path: /^\/article\/category\/\d+\/post\/\d+\/?$/,
    // The lead (.article__introduction) and the body share this editor container.
    bodySelector: '.cke_editable.font__select-content',
    trustContainer: true,
  },
  {
    host: 'hypebeast.com',
    path: /^\/zh\/\d{4}\/\d{1,2}\/[\w-]+\/?$/,
    bodySelector: 'article.post-body-article > .post-body-content',
    trustContainer: true,
  },
  {
    host: 'supertaste.tvbs.com.tw',
    path: /^\/[a-z-]+\/\d+\/?$/,
    bodySelector: 'article#article-content',
    trustContainer: true,
  },
  {
    host: '4gamers.com.tw',
    path: /^\/news\/detail\/\d+(?:\/[^/]*)?$/,
    // publicArticleHtml unwraps the server-rendered <noscript> copy of the article.
    bodySelector: 'main > article.render-content',
  },
  {
    host: 'pansci.asia',
    path: /^\/archives\/\d+\/?$/,
    // Later containers are the next articles, pre-rendered for infinite scroll;
    // the first match is the requested one.
    bodySelector: '.post-content-container',
  },
  {
    host: 'saydigi.com',
    path: /^\/\d{4}\/\d{2}\/\d+\.html$/,
    bodySelector: '#content-area > .cttt',
    trustContainer: true,
  },
  {
    host: 'healthnews.com.tw',
    path: /^\/article\/\d+\/?$/,
    bodySelector: '#article-content',
  },
  {
    host: 'natgeomedia.com',
    path: /^\/[a-z-]+\/article\/content-\d+\.html$/,
    bodySelector: 'article.under-ads',
    trustContainer: true,
  },
  {
    host: 'thefemin.com',
    path: /^\/\d{4}\/\d{2}\/[\w-]+\/?$/,
    // The body sits inside .share-container; without trusting it the generic
    // <article> fallback keeps only the 「所有內容嚴禁以任何方式轉載」 footer.
    bodySelector: 'article.blog-post .post-content.entry-content',
    trustContainer: true,
  },
  {
    host: 'twreporter.org',
    path: /^\/a\/[\w-]+\/?$/,
    bodySelector: '#article-body',
    // Every article ends with the same 「你的支持能幫助《報導者》…」 donation appeal.
    // The category links after the text are metadata, not prose.
    bodyExcludeSelector: '[class*="donation-box__Container"], [class*="metadata__MetadataContainer"]',
  },
];
