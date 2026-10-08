import type { NewsSiteRules } from './news-site-rules.ts';

/** Public text article templates; video captions and directory dates are excluded. */
export const PLATFORM_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
  {
    host: 'thepaper.cn',
    path: /^\/newsDetail_forward_\d+$/,
    bodySelector: 'main [class^="cententWrap__"]',
    titleSelector: 'main h1',
    authorSelector: 'main [class^="headerContent__"] > [class^="left__"] > div:first-child:not(.ant-space-item):not(:has(.ant-space-item))',
    providerSelector:
      'main [class^="headerContent__"] > [class^="left__"] > div:first-child:not(.ant-space-item):not(:has(.ant-space-item))',
    providerPattern: /^(?:“)?(海南日报|央视新闻)(?:”微信公号)?$/u,
    publishedSelector: 'main [class^="headerContent__"] [class^="left__"] .ant-space-item:first-child > span',
    publicationPattern: /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/,
  },
  {
    host: 'digitimes.com.tw',
    path: /^\/col\/article\/\?id=\d+(?:&|$)/,
    bodySelector: '#dg-col-article-content > .dg-col-article-body',
    titleSelector: '#dg-col-article-content h1',
    publishedSelector: '#dg-col-article-content > .d-flex .dg-color--spanish-gray',
    publicationPattern: /^(\d{4}-\d{2}-\d{2})$/,
  },
  {
    host: 'voachinese.com',
    path: /^\/a\/[^/]+\/\d+\.html$/,
    bodySelector: '#article-content > .wsw',
    titleSelector: 'h1',
    publishedSelector: 'time[pubdate][datetime]',
    bodyExcludeSelector: '.wsw__embed, .wsw__related',
  },
  {
    host: 'tnews.cc',
    path: /^\/[\w]+\/News\/View\/\d+$/i,
    bodySelector: '.edit-area > .article-content > .ql-editor',
    titleSelector: '.edit-area > .news-theme',
    publishedSelector: '.edit-area > .article-meta-container .article-meta > span:first-child',
    publicationPattern: /^發布時間[：:]\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})$/,
  },
  {
    // LINE TODAY names the licensed partner in <meta property="provider">;
    // the page's own "publisher" meta is always LINE TODAY. The single
    // <article> is the same container generic extraction already used.
    host: 'today.line.me',
    path: /^\/tw\/v3\/article\/[A-Za-z0-9]+$/,
    bodySelector: 'article',
    providerSelector: 'meta[property="provider"]',
  },
];
