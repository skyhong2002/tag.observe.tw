import type { NewsSiteRules } from './news-site-rules.ts';

// Additional publisher templates verified against live article HTML.
export const EXTRA_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
  {
    host: 'tatlerasia.com',
    path: /^\/(?!list\/).*(?:zh-hant|zh-[^/]+-hant)$/,
    // Text is split across sibling .article-content blocks, interleaved with
    // image galleries. Selecting one block silently truncates the story.
    bodySelector: '.article-height',
    bodyExcludeSelector: '.article-content:not(:has(.rich-text))',
  },
  {
    host: 'watchout.tw',
    path: /^\/(?:reports|forum)\/[a-zA-Z0-9]+$/,
    bodySelector: '.content.paragraphs',
    titleSelector: 'h1',
    authorSelector: '.page.read.single .doc-header .authors-container > .authors > a[href^="https://watchout.tw/authors/"] .name',
    publishedSelector: '.page.read.single .doc-header .dates > div:first-child > span:last-child',
    preferPrintedPublication: true,
    // SSR prints UTC; verified against this article's publishedAt.seconds.
    publicationFormat: 'utc',
  },
  {
    host: 'eventsinfocus.org',
    path: /^\/news\/\d+$/,
    bodySelector: 'main#content .node__content > .field--name-body',
    titleSelector: 'main#content h1',
    publishedSelector: 'main#content .field--name-field-time > time[datetime]',
  },
  {
    host: 'news.taiwannet.com.tw',
    path: /^\/news\/\d+\//,
    bodySelector: '.news-date-txt-box',
    publishedSelector: '.news-date-box .news-time time',
  },
  {
    host: 'ct.org.tw',
    path: /^\/html\/news\/3-3\.php\?.*\barticle=\d+/,
    bodySelector: 'main .nine.wide.column > article',
    titleSelector: 'main .nine.wide.column > h1',
    publishedSelector: 'main .nine.wide.column > .meta > .date',
  },
  {
    host: 'guancha.cn',
    path: /^\/[^/]+\/\d{4}_\d{2}_\d{2}_\d+\.shtml$/,
    bodySelector: '.left-main > .all-txt',
    authorSelector: '.left-main > .all-txt > p:first-child',
    authorPattern: /^（文\/观察者网\s+([\p{Script=Han}]{2,5})）$/u,
    titleSelector: '.left-main > h3',
    publishedSelector: '.left-main > .time > span:first-child',
  },
  {
    host: 'wenweipo.com',
    path: /^\/a\/\d{6}\/\d{2}\/AP[\da-f]+\.html$/i,
    bodySelector: '#richTextContainer',
    titleSelector: '.title-bar h1',
    publishedSelector: '.title-bar .info-bar > .time',
  },
  {
    host: 'tkww.hk',
    path: /^\/a\/\d{6}\/\d{2}\/AP[\da-f]+\.html$/i,
    bodySelector: '.content-main-left .content-body-inner',
    titleSelector: '.content-title-text',
  },
  {
    host: 'hk.crntt.com',
    path: /^\/doc\/(?:\d+\/)*[\d_]+\.html(?:\?|$)/,
    bodySelector: '#zoom',
    titleSelector: 'font[style*="22px"] > strong',
    publishedSelector: 'td[align="center"]:has(> font)',
    publicationPattern: /CRNTT\.com\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/i,
  },
  {
    // Drupal: no published meta or JSON-LD; the byline row prints the day only.
    host: 'thinkingtaiwan.net',
    path: /^\/(?:article|content)\/\d+\/?$/,
    bodySelector: 'article.node .node-content > .field--name-body',
    titleSelector: '#block-thinking-theme-page-title h1 .field--name-title',
    publishedSelector: 'article.node .node__meta .post-date',
    publicationPattern: /發佈於\s*｜\s*(\d{4}-\d{2}-\d{2})/,
    // One item per writer; the expandable bio beside it is not part of the credit.
    authorSelector:
      'article.node .node__meta .field--name-field-writer.field__item, article.node .node__meta .field--name-field-writer .field__item',
  },
  {
    // Next.js streams the whole article into <div hidden id="S:0"> and swaps
    // it in with a script, so the hidden ancestor is expected. The lead and each
    // table-of-contents section are sibling div.article blocks; read their
    // shared wrapper, not the TOC, tags or 延伸閱讀.
    host: 'xinmedia.com',
    path: /^\/article\/\d+\/?$/,
    bodySelector: 'div:has(> div.article.break-word)',
    trustContainer: true,
    titleSelector: 'h1',
  },
];
