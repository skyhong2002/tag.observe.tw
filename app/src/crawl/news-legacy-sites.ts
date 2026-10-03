import type { NewsSiteRules } from './news-site-rules.ts';

const jdaArticle = 'table[width="980"][cellpadding="10"] > tbody > tr > td[valign="top"]:first-child';

// Scoped to article templates inspected on the publishers' public archive pages.
// Publication selectors identify the printed publication, never URL/update dates.
export const LEGACY_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
  {
    host: 'tw.sports.yahoo.com',
    path: /^\/news\/[^/]+-(?:075035380|101043877)\.html$/,
    bodySelector: 'section.module-article-body article[id^="article-"] > .atoms',
    publishedSelector: 'header .article-time > time[datetime]',
    // These reviewed Dongtw syndication archives put their edit timestamp into
    // JSON-LD datePublished, while the visible header preserves publication.
    preferPrintedPublication: true,
  },
  {
    host: 'zht.globalvoices.org',
    path: /^\/\d{4}\/\d{2}\/\d{2}\/\d+\/$/,
    bodySelector: '.full-article .post > .entry-container > .entry',
  },
  {
    host: 'punchline.asia',
    path: /^\/archives\/\d+\/?$/,
    bodySelector: '.post-content.description[itemprop="articleBody"]',
    publishedSelector: 'time[itemprop="datePublished"][datetime]',
  },
  {
    host: 'nommagazine.com',
    path: /^\/(?!category\/|tag\/|page\/|author\/)[^/]+\/$/,
    bodySelector: '.zh-content',
  },
  {
    host: 'dramaqueen.com.tw',
    path: /^\/news\/\d{8}\/\d+\.html$/,
    bodySelector: '.Con_PrTl',
    publishedSelector: 'h2 > .time-info > span:first-of-type',
    // JSON-LD uses a generic google.com/article identity; the printed header
    // separately labels the publication day and last modification timestamp.
  },
  {
    host: 'viewpointtaiwan.com',
    path: /^\/(?:columnist|commentary|focus|share|%[a-f\d]{2})\/.+/i,
    bodySelector: '.sing-spacer',
  },
  {
    host: 'jdanews.com',
    path: /^\/\d{2}_\d{6}\.php$/,
    bodySelector: jdaArticle,
    titleSelector: `${jdaArticle} > p > font[size="5"]`,
    publishedSelector: `${jdaArticle} > p:first-child > font[size="2"]`,
    bodyExcludeSelector: `${jdaArticle} > table, ${jdaArticle} > div, ${jdaArticle} > p:has(a)`,
  },
  {
    host: 'taiwanenews.com',
    path: /^\/docs?\/\d{11}\.php$/,
    bodySelector: '#MsgContainer > div > blockquote',
    publishedSelector: '#MsgContainer > div > blockquote > p:first-child',
    publicationPattern: /(\d{4}年\d{1,2}月\d{1,2}日)/,
    // Some pages append a separately dated second story inside the same
    // blockquote. Keep only the first story identified by the page title/date.
    bodyExcludeSelector: '#MsgContainer > div > blockquote > h1, #MsgContainer > div > blockquote > h1 ~ *',
  },
];
