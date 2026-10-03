import type { NewsSiteRules } from './news-site-rules.ts';

// Additional publisher templates verified against live article HTML.
export const EXTRA_NEWS_SITES: Array<NewsSiteRules & { host: string; path: RegExp }> = [
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
];
