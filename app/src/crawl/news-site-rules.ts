import type { CheerioAPI } from 'cheerio';
import { GOVERNMENT_NEWS_SITES } from './government-sites.ts';
import { BLOCKED_NEWS_SITES } from './news-blocked-sites.ts';
import { ENN_NEWS_SITES } from './news-enn.ts';
import { EXTRA_NEWS_SITES } from './news-extra-site-rules.ts';
import { LEGACY_NEWS_SITES } from './news-legacy-sites.ts';
import { PLATFORM_NEWS_SITES } from './news-platform-sites.ts';
import { ROUND3_LEGACY_NEWS_SITES } from './news-round3-legacy-sites.ts';
import { ROUND3_NEWS_SITES } from './news-round3-sites.ts';
import { ROUND4_NEWS_SITES } from './news-round4-sites.ts';

export interface NewsSiteRules {
  bodySelector: string;
  bodyHtmlSelector?: string;
  titleSelector?: string;
  authorSelector?: string;
  publishedSelector?: string;
  /** null explicitly selects visible text instead of a datetime attribute. */
  publishedAttribute?: string | null;
  publicationPattern?: RegExp;
  publicationFormat?: 'epoch-ms' | 'epoch-seconds' | 'day-first' | 'utc' | 'roc';
  preferPrintedPublication?: boolean;
  /** Correct a known false UTC declaration only when its wall clock agrees with printed evidence. */
  correctUtcClock?: boolean;
  providerSelector?: string;
  /** First capture isolates a provider explicitly named in a shared credit. */
  providerPattern?: RegExp;
  bodyExcludeSelector?: string;
  /** Keep the container even when a page wrapper's class looks like ads/share UI (#ad-root, under-ads). */
  trustContainer?: boolean;
  /** Paragraphs are <div>/<br> blocks; read the container as text. */
  plainTextBody?: boolean;
  /** The verified container is the whole report even below the 200-character threshold. */
  preferShortBody?: boolean;
}

type Site = NewsSiteRules & { host: string; path: RegExp };
const matsuFirstPost = '.table.detail > .row:has(> .forumlist > a[name="1"])';

// Verified against article HTML on 2026-10-03. Every fallback is restricted to
// an explicit host, article URL shape, and main-article container. Header clocks,
// recommendation cards, URL dates and modification times are not evidence.
const SITES: Site[] = [
  {
    host: 'mirrordaily.news',
    path: /^\/story\/\d+$/,
    bodySelector: 'div:has(> article.brief.story-renderer):has(> div > article.content.story-renderer)',
    plainTextBody: true,
    bodyExcludeSelector:
      'div:has(> article.brief.story-renderer) > section, div:has(> article.brief.story-renderer) > div:not(:has(> article.content.story-renderer))',
  },
  {
    host: 'udn.com',
    path: /^\/news\/story\/\d+\/\d+(?:\?|$)/,
    bodySelector: '.article-content__editor',
    authorSelector: '.article-content__author',
    providerSelector: '.authors .article-content__author',
    providerPattern: /^\s*(台灣醒報)\s*[／/]\s*記者/u,
  },
  {
    host: 'anntw.com',
    path: /^\/articles\/\d{8}-[A-Za-z0-9]+$/,
    bodySelector: 'article > .markdown-body',
    titleSelector: '.article-header h3',
    bodyExcludeSelector: '.cover',
  },
  {
    host: 'upmedia.mg',
    path: /^\/tw\/[^/]+\/[^/]+\/\d+(?:\?|$)/,
    bodySelector: '.news-box-text',
    plainTextBody: true,
    bodyExcludeSelector: '.news-box-text .mbt-text, .news-box-text .news-foot, .news-box-text .rss_close',
  },
  {
    host: 'setn.com',
    path: /^\/(?:news\/\d+|News\.aspx\?)/i,
    bodySelector: '#newsContent',
    publishedSelector: '.article_time_box .time_item:first-child > span',
    preferPrintedPublication: true,
  },
  {
    host: 'taiwanhot.net',
    path: /^\/news\/\d+(?:\/|$)/,
    bodySelector: 'article .news_content',
    titleSelector: '.content_wrapper > .top_title .news_title',
    authorSelector: '.content_wrapper > .top_title .reporter_name',
    publishedSelector: '.content_wrapper > .top_title .post_time',
    publishedAttribute: null,
  },
  {
    host: 'taronews.tw',
    path: /^\/\d{4}\/\d{2}\/\d{2}\/\d+\/$/,
    bodySelector: 'article .entry-content',
    publishedSelector: '.post-header time.post-published:contains("發表時間")',
    publishedAttribute: 'datetime',
    preferPrintedPublication: true,
  },
  {
    host: 'epochtimes.com',
    path: /^\/(?:b5|gb)\/\d{2,4}\/\d{1,2}\/\d{1,2}\/n\d+\.htm$/,
    bodySelector: '#artbody[itemprop="articleBody"]',
    publishedSelector: '#artbody > header time[datetime]',
    publishedAttribute: 'datetime',
    correctUtcClock: true,
  },
  {
    host: 'theinitium.com',
    path: /^\/\d{8}-[^/]+\/$/,
    bodySelector: 'article',
    publishedSelector: '.post-info time',
    publishedAttribute: null,
    correctUtcClock: true,
  },
  // EBC's JSON-LD rewrites punctuation and merges headlines into the prose.
  {
    host: 'news.ebc.net.tw',
    path: /^\/news\/[^/]+\/\d+\/?$/,
    bodySelector: '.article_main > .article_content',
    preferShortBody: true,
    providerSelector: '.article_main > .article_content > div.rss_box',
  },
  ...BLOCKED_NEWS_SITES,
  ...EXTRA_NEWS_SITES,
  ...ENN_NEWS_SITES,
  ...LEGACY_NEWS_SITES,
  ...PLATFORM_NEWS_SITES,
  ...ROUND3_LEGACY_NEWS_SITES,
  ...ROUND3_NEWS_SITES,
  ...ROUND4_NEWS_SITES,
  ...GOVERNMENT_NEWS_SITES,
  {
    host: 'myhousing.com.tw',
    path: /^\/(?:n|p)\/(?:[^/?]+\/)*\d+\/$/,
    bodySelector: '#post > .elementor-widget-theme-post-content',
    bodyExcludeSelector: '#post > .elementor-widget-theme-post-content > div:has(> a:only-child)',
    providerSelector: 'meta[name="author"]',
  },
  {
    host: 'ntdtv.com',
    path: /^\/(?:b5|gb)\/\d{4}\/\d{2}\/\d{2}\/a\d+\.html$/,
    bodySelector: '.article_content',
    titleSelector: '.article_title > h1',
    publishedSelector: '.article_info > .time',
    publicationPattern: /^北京(?:時間|时间)[：:]\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/,
    // This template appends Z to its local clock in JSON-LD. The article
    // header explicitly identifies Beijing time and supplies the correct zone.
    preferPrintedPublication: true,
  },
  {
    host: 'biao-news.com',
    path: /^\/news_view\.php\?/,
    bodySelector: '.itembox_intro.editor',
    titleSelector: 'h1.heading_view',
    publishedSelector: '.itembox-left > .info_view_date',
  },
  {
    host: 'factcheck.afp.com',
    path: /^\/doc\.afp\.com\.[A-Z0-9]+$/,
    bodySelector: 'article .wrapper-body',
    authorSelector: 'article .sub-header .person-link',
    // ClaimReview embeds the claim date before the actual report date.
    preferPrintedPublication: true,
    publishedSelector: 'article .date-full-format[data-type="created"]',
    publishedAttribute: 'data-utc-time',
    publicationFormat: 'epoch-seconds',
  },
  {
    host: 'tw.aboluowang.com',
    path: /^\/(?:\d{4}\/\d{4}\/\d+\.html)$/,
    bodySelector: '[itemprop="articleBody"]',
    providerSelector: 'meta[property="og:article:author"]',
  },
  {
    host: 'focustaiwan.tw',
    path: /^\/[^/]+\/\d{12}$/,
    bodySelector: '.PrimarySide > .paragraph',
    authorSelector: '.PrimarySide .author > p:first-child',
  },
  {
    host: 'fclnews.com',
    path: /^\/\d+\/$/,
    bodySelector: '.elementor-widget-theme-post-content',
    providerSelector: '.elementor-widget-theme-post-content p > a[href="https://more-news.tw/"]',
  },
  {
    host: 'bbc.com',
    path: /^\/zhongwen\/articles\/[^/]+(?:\/trad)?(?:\?|$)/,
    bodySelector: 'main',
    bodyExcludeSelector: '[data-testid="consentBanner"] + small, [data-testid="consentBanner"], [id="end-of-youtube-content"]',
  },
  {
    host: 'hsnews.com.tw',
    path: /^\/[^/]+\/[^/]+\.html$/,
    bodySelector: '.article-details [itemprop="articleBody"]',
    authorSelector: '.article-details .article-info [itemprop="author"]',
    publishedSelector: '.article-details .article-info time[itemprop="datePublished"]',
    publishedAttribute: 'datetime',
  },
  {
    host: 'ap.org',
    path: /^\/news-highlights\/(?:elections|spotlights)\/\d{4}\/[^/]+\/$/,
    bodySelector: 'article .content-container__inner',
  },
  {
    host: 'news.cn',
    path: /^\/[^/]+\/\d{8}\/[a-f0-9]+\/c\.html$/i,
    bodySelector: '#detail > #detailContent',
    publishedSelector: '.mheader > .info',
  },
  { host: 'n.yam.com', path: /^\/Article\/\d+$/i, bodySelector: 'section.inner-page > .inner-content' },
  { host: 'taipeipost.org', path: /^\/\d+\/$/, bodySelector: 'main > .elementor-widget-text-editor > .elementor-widget-container' },
  {
    host: 'matsu.idv.tw',
    path: /^\/topicdetail\.php\?f=1&t=\d+(?:&|$)/,
    bodySelector: `${matsuFirstPost} > .col > .threadtext`,
    titleSelector: `${matsuFirstPost} .articleTitlte`,
    publishedSelector: `${matsuFirstPost} > .forumlist p.smalltext`,
    publicationPattern: /^發表時間\s*:\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/,
  },
  {
    host: 'taiwanus.net',
    path: /^\/news\/press\/\d{4}\/\d+\.htm$/,
    bodySelector: '#showxyz',
    publishedSelector: 'p[align="right"] > font[size="2"]',
    publicationPattern: /\]於(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})上傳/,
  },
  {
    host: 'nvns.net',
    path: /^\/news_view(?:\.php)?\?/,
    bodySelector: '.page-left > .editor',
    titleSelector: '.page-left > .view-heading .title',
    publishedSelector: '.page-left > .page-headline-flex .date-time > .title',
  },
  ...['lai-media.net', 'iw-times.com'].map(
    (host): Site => ({
      host,
      path: /^\/news_view(?:\.php)?\?/,
      bodySelector: '.page-left > .editor',
      titleSelector: '.page-left > .headingbar_pageview h1',
      publishedSelector: '.page-left > .headingbar_pageview .info_view_date > .info-text',
    }),
  ),
  {
    host: 'news.homeplus.net.tw',
    path: /^\/single\/\d+$/,
    bodySelector: 'article.main-article > .news-content',
    titleSelector: 'article.main-article > header h1',
    publishedSelector: 'article.main-article > header > .details > li:first-child',
    publicationFormat: 'day-first',
  },
  {
    host: 'chengpou.com.mo',
    path: /^\/dailynews\/\d+\.html$/,
    bodySelector: '#daily-news-content',
    publishedSelector: '#daily-news-title-container .daily-news-date',
  },
  {
    host: 'news.cctv.com',
    path: /^\/\d{4}\/\d{2}\/\d{2}\/ARTI[^/]+\.shtml$/,
    bodySelector: '#text_area.text_area',
    publishedSelector: '.content_19568 > .title_area > .info > span',
  },
  // 人民網 channels linked from the homepage share this article template
  // (checked 2026-10-04); pic.* galleries and tw.* (own rule) differ.
  ...[
    'politics',
    'world',
    'finance',
    'ent',
    'society',
    'opinion',
    'military',
    'edu',
    'health',
    'leaders',
    'kpzg',
    'theory',
    'cpc',
    'dangjian',
    'art',
  ].map(
    (channel): Site => ({
      host: `${channel}.people.com.cn`,
      path: /^\/n1\/\d{4}\/\d{4}\/c\d+-\d+\.html$/,
      bodySelector: '#rm_txt_zw',
      publishedSelector: '.rm_txt #newstime',
    }),
  ),
  {
    host: '163.com',
    path: /^\/(?:news|dy|sports)\/article\/[A-Z0-9]+\.html$/i,
    bodySelector: '#content.post_content .post_body',
  },
  ...['sports.huanqiu.com', 'world.huanqiu.com', 'china.huanqiu.com', 'mil.huanqiu.com'].map(
    (host): Site => ({
      host,
      path: /^\/article\/[A-Za-z0-9]+$/,
      bodySelector: 'article > textarea.article-content',
      bodyHtmlSelector: 'article > textarea.article-content',
      titleSelector: 'article > textarea.article-title',
      publishedSelector: 'article > textarea.article-time',
      publicationFormat: 'epoch-ms',
    }),
  ),
  { host: 'news.taiwannet.com.tw', path: /^\/news\/\d+\//, bodySelector: '.news-detail-box .news-date-txt-box' },
  {
    host: 'pinview.com.tw',
    path: /^\/News\/\d+\.html$/i,
    bodySelector: '.article #contentText',
    titleSelector: '.article-title h1',
    publishedSelector: '.article > .article-title > span',
  },
  {
    host: 'mdnkids.com',
    path: /^\/content\.asp\?/i,
    bodySelector: '.page_main_box > .col > div:not(.row)',
    titleSelector: '.page_main_box h2',
    publishedSelector: '.page_main_box > .col > .row > .col > span',
    publicationPattern: /\((\d{4}\/\d{1,2}\/\d{1,2})\)/,
  },
  {
    host: 'i-media.tw',
    path: /^\/Article\/Detail\/\d+/i,
    bodySelector: '#articleContent',
    authorSelector: 'article.entry .entry__meta-author a[href*="Author="]',
    titleSelector: 'article.entry h1',
    publishedSelector: 'article.entry > .entry__meta-holder .entry__meta-date',
  },
  {
    host: 'tcnews.com.tw',
    path: /^\/[a-z-]+\/item\/\d+\.html$/,
    bodySelector: 'article.single-post > .post-content',
    publishedSelector: 'article.single-post > .meta-data .event-date',
  },
  {
    host: 'kingtop.com.tw',
    path: /^\/detail\.php\?/,
    bodySelector: 'article.post-details > .single-blog-wrapper',
    titleSelector: '.post-title-wrapper h1',
    publishedSelector: '.post-title-wrapper .post-metas li:has(.icon-calendar)',
  },
  {
    host: 'greatnews.com.tw',
    path: /^\/news_pagein\.php\?/,
    bodySelector: '#news_are .newsin_text',
    titleSelector: '#news_are .newsin_title',
    publishedSelector: '#news_are .newsin_date',
  },
  {
    host: 'kamalan-news.com',
    path: /^\/[a-z-]+\/\d+\/\d+$/,
    bodySelector: '.post-full .entry-content',
    publishedSelector: '.post-full > .entry-main > .in-date-tag > .post-meta-date',
  },
  {
    host: 'bo6s.com.tw',
    path: /^\/news_detail\.php\?/,
    bodySelector: 'article .news-content',
    titleSelector: 'article h1',
    publishedSelector: 'article .news-header time[datetime]',
  },
  {
    host: 'news.st-media.com.tw',
    path: /^\/news\/\d+$/,
    bodySelector: '.page-content > .row',
    publishedSelector: '.top-info > div > span.date',
  },
  {
    host: 'cdn-news.org',
    path: /^\/(?:News\.aspx\?|news\/N\d+)/i,
    bodySelector: '.news-details-layout2 .col-xl-8 > .item-box-light-lg',
    publishedSelector: '.news-details-layout2 .mask-content-lg > .post-info-light li > a',
  },
  {
    host: 'merit-times.com.tw',
    path: /^\/NewsPage\.aspx\?/i,
    bodySelector: '#article_content .articleBox',
    publishedSelector: 'article .writerInfo .posTime',
  },
  {
    host: 'fountmedia.io',
    path: /^\/article\/\d+$/,
    bodySelector: '.newsWrapDetail #div1.content',
    publishedSelector: '.newsWrapDetail .detitle2 .small-4 > div',
  },
  {
    host: 'matsu-news.gov.tw',
    path: /^\/news\/article\/\d+$/,
    bodySelector: '.single-post > .post-text.news-page',
    titleSelector: '.single-post > .topic h3',
    publishedSelector: '.single-post > .topic > .post-tools > li',
  },
  { host: 'sunmedia.tw', path: /^\/news\/[^/]+\/.+/, bodySelector: '.article-page-content .article-description-box' },
  {
    host: 'zmedia.com.tw',
    path: /^\/Document\/NewsDetail\/\d+$/i,
    bodySelector: '.newsDetail .article-group .ckeditor-group',
    publishedSelector: '.newsDetail .article-group > .info-group > .date',
  },
  {
    host: 'my-formosa.com.tw',
    path: /^\/DOC_\d+\.htm$/i,
    bodySelector: '.blog-page .Bigcontent',
    titleSelector: '.blog-page > h1',
    publishedSelector: '.blog-page > .details .date',
  },
  {
    host: 'idn.com.tw',
    path: /^\/news\/news_content\.aspx\?/i,
    bodySelector: 'td.newsa',
    titleSelector: 'td.headnewsd',
  },
  {
    host: 'ntdtv.com.tw',
    path: /^\/b5\/\d{8}\/(?:video|news)\/\d+\.html/i,
    bodySelector: '#article_box #article_content',
    titleSelector: '#article_box h1',
    publishedSelector: '#article_content > p:first-child',
    publicationPattern: /^【新唐人亞太台\s+(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)訊】/,
  },
];

export function newsSiteRules(value: string): NewsSiteRules | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return SITES.find((site) => site.host === host && site.path.test(url.pathname + url.search));
  } catch {
    return undefined;
  }
}

function printedPublication(raw: string): string | null {
  const months = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  const normalized = raw.trim().replace(/年([一二三四五六七八九十]+)月/, (_, month) => `年${months.indexOf(month) + 1}月`);
  const date = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})(?:\s*日)?(?:[T\s]*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(normalized);
  if (!date) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = date;
  const zone = normalized.match(/(?:Z|[+-]\d{2}:\d{2})$/)?.[0] ?? '+08:00';
  const local = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}`;
  const iso = local + zone;
  const parsed = new Date(iso);
  // Reject rolling dates such as February 31, rather than repairing evidence.
  if (Number.isNaN(parsed.getTime()) || new Date(`${local}Z`).toISOString().slice(0, 10) !== iso.slice(0, 10)) return null;
  return iso;
}

export function newsSiteEvidence($: CheerioAPI, url: string) {
  const rules = newsSiteRules(url);
  if (!rules || !$(rules.bodySelector).length) return { title: null, publishedRaw: null, isArticle: false };
  const title =
    (rules.titleSelector ? $(rules.titleSelector).first().text().trim() : '') ||
    $('meta[property="og:title"]').first().attr('content')?.trim() ||
    $('title').first().text().trim() ||
    null;
  let publishedRaw: string | null = null;
  if (rules.publishedSelector) {
    for (const node of $(rules.publishedSelector).toArray()) {
      const element = $(node);
      let raw =
        (rules.publishedAttribute === null
          ? element.text().trim()
          : rules.publishedAttribute
            ? element.attr(rules.publishedAttribute)
            : (element.attr('datetime') ?? element.text().trim())) ?? '';
      if (rules.correctUtcClock && !/\d{1,2}:\d{2}/.test(raw)) continue;
      if (rules.publicationFormat === 'epoch-seconds' && /^\d{10}$/.test(raw)) {
        publishedRaw = new Date(Number(raw) * 1000).toISOString();
        break;
      }
      if (rules.publicationPattern) raw = rules.publicationPattern.exec(raw)?.[1] ?? '';
      if (rules.publicationFormat === 'roc') {
        raw = raw.replace(/^(\d{2,3})(?=\s*[-/.年])/, (_, year) => String(Number(year) + 1911));
      }
      if (rules.publicationFormat === 'day-first') raw = raw.replace(/^(\d{2})-(\d{2})-(\d{4})$/, '$3-$2-$1');
      if (rules.publicationFormat === 'utc') raw += 'Z';
      publishedRaw =
        rules.publicationFormat === 'epoch-ms'
          ? /^\d{13}$/.test(raw)
            ? new Date(Number(raw)).toISOString()
            : null
          : printedPublication(raw);
      if (publishedRaw) break;
    }
  }
  return {
    title,
    publishedRaw,
    isArticle: !!title,
    preferPrintedPublication: rules.preferPrintedPublication,
    correctUtcClock: rules.correctUtcClock,
  };
}

/** A later update is not publication evidence. Only its agreeing local clock
 * can corroborate a reviewed publisher's false UTC zone (also checked in RSS).
 * Compare through minutes because some visible headers omit seconds; retain
 * the declared seconds/milliseconds, never copy the update timestamp. */
export function correctPublicationClock(
  declared: Date | null,
  evidence: { publishedRaw: string | null; correctUtcClock?: boolean },
): Date | null {
  if (!declared || !evidence.correctUtcClock || !evidence.publishedRaw) return declared;
  const raw = evidence.publishedRaw;
  if (declared.toISOString().slice(0, 16) !== raw.slice(0, 16)) return declared;
  const zone = /([+-])(\d{2}):(\d{2})$/.exec(raw);
  if (!zone) return declared;
  const minutes = (Number(zone[2]) * 60 + Number(zone[3])) * (zone[1] === '+' ? 1 : -1);
  return new Date(declared.getTime() - minutes * 60000);
}
