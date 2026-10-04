import * as cheerio from 'cheerio';
import { type FetchRequest, fetchText } from './fetch.ts';
import { decodeEntities, resolveUrl, stripTracking, TRACKING } from './text.ts';
import { cwNavTopics, mirrorTopics, taisoundsTopics, twreporterTopics } from './topic-extractors-b1.ts';
import { registrable } from './topic-page.ts';

// Port of topic/maint/crawler/*_topic.php. The legacy scripts sliced HTML by
// literal markers that have since drifted for most sites; these rules match
// the current pages by link pattern instead. `TOPIC_LINKS` (app/src/topic-html.js)
// keeps the public listing URLs for the UI.
export type TopicKind = 'topic' | 'feature';
export interface TopicItem {
  url: string;
  title: string;
  image: string | null;
  category: string | null;
  /** Set by extractors that know the item's kind; otherwise the listing's declared kind. */
  kind?: TopicKind;
  sponsored?: boolean;
  /** Story dates the listing payload already carries (CTS Nuxt publishTime). */
  storyDates?: Date[];
}
/** A listed item with where it was found, for per-row backlog. */
export interface ListedTopic extends TopicItem {
  source: string;
  page: number;
}
export interface TopicSourceResult {
  url: string;
  kind: TopicKind | 'auto';
  items: number;
  pages?: number;
  error?: string;
}
export interface TopicRule {
  media: string;
  /** Display name for outlets missing from app/data/favicon-catalog.json. */
  name?: string;
  /** The outlet's own share image (homepage og:image): cover for topics without one. */
  fallbackImage: string;
  url: string;
  pattern: RegExp;
  /** Only consider links inside this selector (skips nav/menu links). */
  scope?: string;
  /** Card shared by a separate image link and heading link. */
  card?: string;
  /** Only these known short-link hosts may be resolved; final URL must be this outlet. */
  redirectHosts?: string[];
  /** Replaces link scraping for pages whose topics live in embedded data. */
  extract?: (html: string, rule: TopicRule) => TopicItem[];
  /** Selector for the cover image when the first <img> is an overlay. */
  image?: string;
  title?: (a: cheerio.Cheerio<import('domhandler').Element>, $: cheerio.CheerioAPI) => string;
  userAgent?: string;
  /** 議題 (keeps gaining stories) or 專題 (one-off package) for every item of
   *  this listing; 'auto' (default) classifies each by its story dates.
   *  Listings do not inherit the rule's kind. */
  kind?: TopicKind | 'auto';
  /** Page 1 is `url`, then pages 2..max; stops at the first page without new links.
   *  `request` (also used for page 1) turns a page into a POST. */
  paginate?: { url: (n: number) => string; max: number; request?: (n: number) => FetchRequest };
  /** On this listing's topic pages, links to sub-topics (CNA `.definKind h2 a`). */
  children?: string;
  /** Marks advertiser/brand partnership packages (合作). */
  sponsored?: (item: TopicItem) => boolean;
  /** Additional official indexes; each has independent extraction and health. */
  listings?: Omit<TopicRule, 'media' | 'name' | 'fallbackImage' | 'listings'>[];
}

const textOf = (a: cheerio.Cheerio<import('domhandler').AnyNode>) =>
  decodeEntities(a.text().replace(/\s+/g, ' ').trim()) ||
  decodeEntities(a.attr('title') ?? '') ||
  decodeEntities(a.find('img').attr('alt') ?? '');
// Card links whose visible text mixes date, counters and summary: take the heading.
const heading = (a: cheerio.Cheerio<import('domhandler').AnyNode>) =>
  decodeEntities(a.find('h1,h2,h3,h4,h5').first().text().replace(/\s+/g, ' ').trim()) || textOf(a);
export const TOPIC_RULES: TopicRule[] = [
  // newtalk anchors carry the latest article title; the topic name is the URL slug.
  {
    media: 'newtalk',
    fallbackImage: 'https://newtalk.tw/images/ogimage.jpg',
    url: 'https://newtalk.tw/news/topics/list',
    pattern: /\/news\/topics\/view\/\d+/,
    // The title link sits beside the block's lazy-loaded cover.
    card: '.news_block',
    title: (a) => {
      try {
        return decodeURIComponent((a.attr('href') ?? '').split('/').pop() ?? '');
      } catch {
        return '';
      }
    },
  },
  {
    media: 'setn',
    fallbackImage: 'https://attach.setn.com/images/setn_1200x676_20250103.png',
    url: 'https://www.setn.com/Plist.aspx',
    pattern: /\/(klist|project)\/\d+/i,
    title: (a) => a.find('.title').first().text().trim() || heading(a),
  },
  {
    media: 'cts',
    fallbackImage: 'https://news.cts.com.tw/assets/fb_img.jpg',
    url: 'https://news.cts.com.tw/topic/',
    pattern: /\/topic\/[0-9a-f-]{36}/,
    extract: nuxtTopics,
  },
  {
    media: 'ebc',
    fallbackImage: 'https://news.ebc.net.tw/img/ebc_news.jpg',
    url: 'https://news.ebc.net.tw/topic',
    pattern: /\/topic\/\d+/,
  },
  {
    media: 'cna',
    fallbackImage: 'https://imgcdn.cna.com.tw/www/images/pic_fb.jpg',
    url: 'https://www.cna.com.tw/list/newstopic.aspx',
    pattern: /\/topic\/newstopic\/\d+\.aspx/,
    listings: [
      {
        url: 'https://www.cna.com.tw/project/project_list/api/specialfeature.json',
        pattern: /\/(project|cards|story)\//,
        extract: cnaDigitalTopics,
        kind: 'feature',
        sponsored: (item) => item.category === '廣告',
      },
    ],
  },
  {
    media: 'tvbs',
    fallbackImage: 'https://news.tvbs.com.tw/assets/default_og_image.DD7eKhl_.png',
    url: 'https://news.tvbs.com.tw/pack/packnews',
    pattern: /\/(pack|topics)\/[a-z]*\/?\d+/,
    listings: [{ url: 'https://news.tvbs.com.tw/topics', pattern: /\/topics\/[a-z]+\/\d+$/ }],
  },
  // Each card also links its articles as hotTopic/N#topic-link-M; the JSON-LD
  // ItemList carries the clean topic names.
  {
    media: 'pts',
    fallbackImage: 'https://news.pts.org.tw/images/ptsnews-banner.jpg',
    url: 'https://news.pts.org.tw/hotTopic',
    pattern: /\/hotTopic\/\d+$/,
    extract: ldTopics,
    kind: 'topic',
    // /curation is 專題: one-off long-form features. Cards split into an image
    // link and an <h3> title link; the card selector joins them.
    listings: [
      {
        url: 'https://news.pts.org.tw/curation',
        kind: 'feature',
        pattern: /\/curation\/\d+$/,
        card: '.curation-main, .curation-secondary .col-lg-6, .project-card',
        title: heading,
      },
    ],
  },
  {
    media: 'udn',
    fallbackImage: 'https://udn.com/static/img/UDN_BABY.png',
    url: 'https://topic.udn.com/issue/index',
    pattern: /topic\.udn\.com\/(issue\/cards|newstopic|event)\/[\w-]+/,
    title: heading,
    listings: [
      {
        url: 'https://udn.com/topic/index',
        pattern: /topic\.udn\.com\/(issue\/cards|newstopic|event)\/[\w-]+/,
        // Image link and <h3> link are separate; the card joins them.
        card: '.story-list__news',
        title: heading,
      },
    ],
  },
  // The homepage keyword bar (.h_kw) is LTN's curated list of running topics;
  // other /topic/ links on the page are per-article tags that churn hourly.
  {
    media: 'ltn',
    fallbackImage: 'https://news.ltn.com.tw/assets/images/all/250_ltn.png',
    url: 'https://news.ltn.com.tw/',
    pattern: /news\.ltn\.com\.tw\/topic\/[^/?#]+/,
    scope: '.h_kw',
    listings: [
      {
        url: 'https://features.ltn.com.tw/',
        pattern: /ltn\.com\.tw\//,
        scope: '.project',
        title: (a) => decodeEntities(a.find('img').attr('alt') ?? '') || heading(a),
      },
      {
        url: 'https://features.ltn.com.tw/special_topic',
        pattern: /features\.ltn\.com\.tw\/[^/?#]+/,
        scope: '.project',
        title: (a) => decodeEntities(a.find('img').attr('alt') ?? '') || heading(a),
      },
    ],
  },
  {
    media: 'nextapple',
    fallbackImage: 'https://static.nextapple.tw/web/layout/img/index.jpg',
    url: 'https://news.nextapple.com/collection/topic',
    pattern: /\/collection\/topic\/[^/?#]+/,
    listings: [{ url: 'https://special.nextapple.com/', pattern: /^https:\/\/special\.nextapple\.com\/[^/?#]+\/?$/, title: heading }],
  },
  {
    media: 'ctwant',
    fallbackImage: 'https://static.ctwant.com/images/dist/ctwant.jpg',
    url: 'https://www.ctwant.com/topic/',
    pattern: /\/topic\/\d+/,
    scope: '.p-topic__list',
    image: 'img.cover',
    title: heading,
    // 議題 with an article count, newest update first (5 a page, ~58 pages);
    // past page 12 they have been quiet for months.
    kind: 'topic',
    paginate: { url: (n) => `https://www.ctwant.com/topic/?page=${n}`, max: 12 },
    listings: [
      {
        // The 永續 menu's 2023 論壇/新聞/影音 packages.
        url: 'https://www.ctwant.com/',
        pattern: /^\/topic\/\d+\/?$/,
        scope: '.m-navbar__subnav',
        kind: 'feature',
        title: (a) => {
          const section = a.closest('.m-navbar__list__item').contents().first().text().trim();
          return `${section}${textOf(a)}`;
        },
      },
    ],
  },
  {
    media: 'taisounds',
    fallbackImage: 'https://www.taisounds.com/images/default_og_img.png',
    url: 'https://www.taisounds.com/special/topiclist',
    pattern: /\/special\/topic\/\d+/,
    title: heading,
    // 主題報導: one-off reports. "More" is a POST returning the next 10 cards.
    extract: taisoundsTopics,
    kind: 'feature',
    paginate: {
      url: (n) => `https://www.taisounds.com/more/infinatetopic?page=${n}`,
      max: 20,
      request: (n) => (n > 1 ? { method: 'POST' } : {}),
    },
    listings: [
      {
        // 特別企劃: running coverage (九合一大選) that keeps gaining stories.
        url: 'https://www.taisounds.com/special/planlist',
        pattern: /\/special\/plan\/\d+/,
        title: heading,
        extract: taisoundsTopics,
        kind: 'topic',
        paginate: {
          url: (n) => `https://www.taisounds.com/more/infinateplan?page=${n}`,
          max: 10,
          request: (n) => (n > 1 ? { method: 'POST' } : {}),
        },
      },
    ],
  },
  {
    media: 'upmedia',
    fallbackImage: 'https://www.upmedia.mg/images/sitelogo.png',
    url: 'https://www.upmedia.mg/tw/project',
    // special-plan and 10th-anniversary-highlights are hubs over these projects.
    pattern: /\/tw\/project\/(?!special-plan\/?$|10th-anniversary-highlights\/?$)[^/?#]+\/?$/,
    // The menu's "特別企劃" link points at a project whose card has the real name.
    title: (a) => (a.is('.dropdown-item') ? '' : heading(a)),
    paginate: { url: (n) => `https://www.upmedia.mg/tw/project?p=${n}`, max: 5 },
  },
  // /topic/ itself redirect-loops; the homepage lists the running topics, each
  // "more" link sitting next to its title (banners link to index2 pages).
  {
    media: 'ftv',
    fallbackImage: 'https://cdn.ftvnews.com.tw/client/images/img-default.jpg',
    url: 'https://www.ftvnews.com.tw/',
    pattern: /^\/topic\/[\w-]+\/?$|topic\.ftvnews\.com\.tw\/[\w-]+\/?$/,
    title: (a) => decodeEntities(a.parent().find('.tw-font-bold').first().text().trim()) || textOf(a),
  },
  {
    media: 'twreporter',
    fallbackImage: 'https://www.twreporter.org/images/og-image-large.jpg',
    name: '報導者',
    // /topics shows 5 a page over ~46 pages; its API returns them all.
    url: 'https://go-api.twreporter.org/v2/topics?offset=0&limit=100',
    pattern: /^https:\/\/www\.twreporter\.org\/topics\/[\w%-]+$/,
    extract: twreporterTopics,
    paginate: { url: (n) => `https://go-api.twreporter.org/v2/topics?offset=${(n - 1) * 100}&limit=100`, max: 5 },
  },
  // Covers are only in the RSC payload (the <img> is a loading gif).
  {
    media: 'mirrordaily',
    fallbackImage: 'https://www.mirrordaily.news/images-next/default-image.png',
    name: '鏡報',
    url: 'https://www.mirrordaily.news/topic',
    pattern: /^\/topic\/\w+$/,
    title: (a) => decodeEntities(a.find('p.font-bold, span.font-bold').first().text().trim()) || textOf(a),
    kind: 'topic',
    // The homepage strip also carries topics missing from /topic (柯文哲二審 /topic/kao).
    listings: [
      {
        url: 'https://www.mirrordaily.news/',
        pattern: /^\/topic\/\w+$/,
        title: (a) => decodeEntities(a.find('p.font-bold, span.font-bold').first().text().trim()) || textOf(a),
        kind: 'topic',
      },
    ],
  },
  {
    media: 'ettoday',
    url: 'https://www.ettoday.net/feature/index',
    fallbackImage: 'https://cdn2.ettoday.net/style/ettoday2017/images/push.jpg',
    pattern: /\/feature\/(?!index(?:[/?#]|$))[^/?#]+/,
    scope: '.part_pictxt_2, .part_pictxt_1',
    title: heading,
    listings: [
      {
        // Public CSV linked by features.ettoday.net, also used by its browser UI.
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSC8DHP42p7MvVh8FXxjEJwZejAS3lzw7hvNAU4zeVP82zZCmefGCLWXOqeqanUrbvokw3UxKn7uzDm/pub?output=csv',
        pattern: /features\.ettoday\.net\/[^/?#]+|\/events\/depth-topic\//,
        extract: ettodayDigitalTopics,
      },
    ],
  },
  {
    media: 'mirror',
    url: 'https://www.mirrormedia.mg/section/topic',
    fallbackImage: 'https://www.mirrormedia.mg/images-next/default-og-img.png',
    pattern: /^\/topic\/[^/?#]+$/,
    scope: 'main',
    title: (a) => a.find('[class*="ItemTitle"]').first().text().trim() || heading(a),
    // Running beats (房市熱話題) beside one-off packages: classified by stories.
    // Advertorial-looking ones (台北畫刊, 魅力基隆) carry no 廣告/合作 mark on the page.
    extract: mirrorTopics,
    kind: 'auto',
  },
  {
    media: 'gvm',
    url: 'https://www.gvm.com.tw/topic',
    fallbackImage: 'https://www.gvm.com.tw/public/images/og-img.jpg',
    // Four-digit IDs only: /topic/20251230-style links 404.
    pattern: /\/topic\/\d{4}$/,
    scope: '.info-cards',
    title: (a) => a.find('.info-cards_title').text().trim() || heading(a),
    kind: 'feature',
    // ~8 a page over ~35 pages, newest first.
    paginate: { url: (n) => `https://www.gvm.com.tw/topic?page=${n}`, max: 10 },
    listings: [
      {
        // 特刊 (special issues) beside the regular issues on /magazine.
        url: 'https://www.gvm.com.tw/magazine',
        pattern: /\/magazine\/special\/\d+$/,
        title: (a) => a.attr('title')?.trim() || heading(a),
        kind: 'feature',
      },
    ],
  },
  {
    media: 'cw',
    url: 'https://www.cw.com.tw/special',
    fallbackImage: 'https://www.cw.com.tw/assets_new/img/fbshare.jpg',
    // Older pages link 2017–2019 packages as /special/NNNN.
    pattern: /cw\.com\.tw\/(feature\/[^/?#]+\/[^/?#]+|special\/\d+)$/,
    scope: '.articleGroup',
    title: (a) => a.closest('section.article').find('h3').first().text().trim() || textOf(a),
    kind: 'feature',
    // /feature/transformers/ is 天下's 廣告專輯 (brand packages).
    sponsored: (item) => /\/feature\/transformers\//.test(item.url),
    paginate: { url: (n) => `https://www.cw.com.tw/special?page=${n}`, max: 10 },
    listings: [
      {
        // Menu-level /feature/topic/ pages: the podcast column and a few packages.
        url: 'https://www.cw.com.tw/',
        pattern: /cw\.com\.tw\/feature\/topic\/[^/?#]+$/,
        extract: cwNavTopics,
      },
    ],
  },
  {
    media: 'bnext',
    url: 'https://www.bnext.com.tw/topics',
    fallbackImage: '/favicons/bnext.png',
    pattern: /\/topic\/view\/\d+$/,
    title: (a) => heading(a.parent()),
    kind: 'feature',
  },
  {
    media: 'inside',
    url: 'https://www.inside.com.tw/features',
    fallbackImage: 'https://bucket-image.inkmaginecms.com/version/hd/1/image/2024/09/6E1YHpoonTPnJJLNMbuiSwIji7p44zz384wR6Ips.jpg',
    pattern: /\/feature\/[^/?#]+$/,
    scope: '.post_list',
    title: (a) => a.closest('.post_list_item').find('.post_title').text().trim() || textOf(a),
  },
  {
    media: 'nownews',
    url: 'https://www.nownews.com/topics/',
    fallbackImage: 'https://www.nownews.com/icon/banner.jpg',
    pattern: /nownews\.com\//,
    extract: nownewsTopics,
  },
  // The dedicated /topic index currently returns a challenge; the public
  // homepage also carries the editor-selected topic links (not article tags).
  {
    media: 'ctee',
    url: 'https://www.ctee.com.tw/',
    fallbackImage: 'https://static.ctee.com.tw/img/ctee-logo-main.png?20260825',
    pattern: /ctee\.com\.tw\/topic\/[^/?#]+\/\d+-\d+|topic\.ctee\.com\.tw\/[^/?#]+\/?$/,
    title: heading,
  },
  {
    media: 'chinatimes',
    url: 'https://www.chinatimes.com/album/',
    fallbackImage: '/favicons/chinatimes.png',
    pattern: /\/album\/[^/?#]+\/\d+-\d+(?:\?chdtv)?$/,
    title: heading,
  },
  {
    media: 'ttv',
    url: 'https://news.ttv.com.tw/Projs/',
    fallbackImage: '/favicons/ttv.png',
    pattern: /^\/Proj\/(?!index\.html)[^/?#]+$/,
    // Heading link above the project's story thumbnails: the first one is the cover.
    card: '.project-list > li',
    title: heading,
  },
  {
    media: 'tnl',
    url: 'https://www.thenewslens.com/feature',
    fallbackImage: '/favicons/tnl.png',
    pattern: /\/feature\/[^/?#]+\/?$/,
    scope: '.item-content',
    card: '.item-content',
    title: (a) => heading(a.closest('.item-content')),
  },
  {
    media: 'ftnn',
    url: 'https://www.ftnn.com.tw/topic_index',
    fallbackImage: '/favicons/ftnn.png',
    pattern: /^\/topic_page\/\d+$/,
    title: heading,
  },
  {
    media: 'mnews',
    url: 'https://www.mnews.tw/topic',
    fallbackImage: '/favicons/mnews.png',
    pattern: /^\/topic\/[\w-]+$/,
    title: heading,
  },
  {
    media: 'knews',
    url: 'https://www.knews.com.tw/realtime/topic',
    fallbackImage: '/favicons/knews.png',
    pattern: /\/realtime\/topic\/[^/?#]+$/,
    title: (a) => decodeURIComponent((a.attr('href') ?? '').split('/').pop() ?? ''),
  },
  {
    media: 'fountmedia',
    url: 'https://www.fountmedia.io/topic',
    fallbackImage: '/favicons/fountmedia.png',
    pattern: /^\/topic\/[^/?#]+$/,
    scope: 'article',
    title: (a) => a.find('.intro-bl .content').text().trim() || heading(a),
  },
  {
    media: 'technews',
    url: 'https://technews.tw/topics/',
    fallbackImage: '/favicons/technews.png',
    pattern: /^\/[a-z][\w-]+\/$/,
    scope: '#content .carousel-banner_item, #content .column_list_item_wrapper',
    card: '.carousel-banner_item, .column_list_item_wrapper',
  },
  {
    media: 'techorange',
    url: 'https://techorange.com/',
    fallbackImage: '/favicons/techorange.png',
    pattern: /techorange\.com\/feature\/[^/?#]+\/?$/,
    title: heading,
  },
  {
    media: 'ithome',
    url: 'https://www.ithome.com.tw/feature',
    fallbackImage: '/favicons/ithome.png',
    // These /article/ pages are the feature bundles; their constituent stories use /news/.
    pattern: /^\/article\/\d+$/,
    scope: '.view-content',
    title: heading,
  },
  {
    media: 'einfo',
    url: 'https://e-info.org.tw/feature',
    fallbackImage: '/favicons/einfo.png',
    pattern: /^\/feature\/\d+$/,
    scope: 'main',
    card: 'article',
  },
  {
    media: 'coolloud',
    url: 'https://www.coolloud.org.tw/topics',
    fallbackImage: '/favicons/coolloud.png',
    pattern: /^\/topic\/style\d+\/\d+$/,
    // The cover sits next to the title overlay, not inside it.
    card: '.views-row',
    title: textOf,
    scope: '.cover-title',
  },
  {
    media: 'foodnext',
    url: 'https://www.foodnext.net/topic',
    fallbackImage: '/favicons/foodnext.png',
    pattern: /^\/issue\/\d+$/,
    scope: '.article-list',
    card: '.article-list',
  },
  {
    media: 'cnyes',
    url: 'https://news.cnyes.com/projects/cat/all',
    fallbackImage: '/favicons/cnyes.png',
    pattern: /^https:\/\/topics\.cnyes\.com\/[^/?#]+\/?$/,
    title: heading,
  },
  {
    media: 'shoppingdesign',
    url: 'https://www.shoppingdesign.com.tw/topic',
    fallbackImage: '/favicons/shoppingdesign.png',
    pattern: /\/topic\/view\/\d+$/,
    title: heading,
  },
  {
    media: 'sportsv',
    url: 'https://www.sportsv.net/feature',
    fallbackImage: '/favicons/sportsv.png',
    pattern: /\/feature\/[^/?#]+$/,
    card: '.item',
  },
  {
    media: 'tvbshealth',
    url: 'https://health.tvbs.com.tw/topic',
    fallbackImage: '/favicons/tvbshealth.png',
    pattern: /health\.tvbs\.com\.tw\/exhibition\//,
    scope: 'main',
    title: heading,
  },
  {
    media: 'supertaste',
    url: 'https://supertaste.tvbs.com.tw/topic',
    fallbackImage: '/favicons/supertaste.png',
    pattern: /supertaste\.tvbs\.com\.tw\/exhibition\//,
    card: '[class~="group/card"]',
  },
  {
    media: 'womany',
    url: 'https://womany.net/collections',
    fallbackImage: '/favicons/womany.png',
    pattern: /^\/collections\/[^/?#]+$/,
    scope: '.collection-item',
    title: heading,
  },
  {
    media: 'wyc',
    url: 'https://dq.yam.com/topic/list/1',
    fallbackImage: '/favicons/wyc.png',
    pattern: /^\/topic\/\d+\/1(?:\?redirect=1)?$/,
    title: heading,
  },
  {
    media: 'mplus',
    url: 'http://www.mplus.com.tw/topic/all',
    fallbackImage: '/favicons/mplus.png',
    pattern: /\/topic\/\d+$/,
    scope: '.theme',
    title: heading,
  },
  {
    media: 'news_pchome',
    url: 'https://news.pchome.com.tw/features/',
    fallbackImage: '/favicons/news_pchome.png',
    pattern: /^\/features\/[a-z]+\/\d+$/,
    title: heading,
  },
  {
    media: 'ntdtv_tw',
    url: 'https://www.ntdtv.com.tw/topic',
    fallbackImage: '/favicons/ntdtv_tw.png',
    pattern: /^\/topic\/category\/id\/\d+$/,
    title: (a) => a.attr('title') || heading(a),
  },
  {
    media: 'zaobao',
    url: 'https://www.zaobao.com.sg/special',
    fallbackImage: '/favicons/zaobao.png',
    pattern: /^\/specials?\/[^/?#]+$/,
    title: (a) => a.closest('h2').text().trim() || heading(a),
  },
  {
    media: 'gv',
    url: 'https://zht.globalvoices.org/specialcoverage/',
    fallbackImage: '/favicons/gv.png',
    pattern: /globalvoices\.org\/(special|specialcoverage)\/[^/?#]+\/$/,
    card: '.gv-promo-card',
  },
  {
    media: 'cdn_news',
    url: 'https://cdn-news.org/TopicNewsMain.aspx',
    fallbackImage: '/favicons/cdn_news.png',
    pattern: /^TopicNews\.aspx\?EntityID=TopicNews&PK=\w+$/,
    card: '.position-relative',
  },
  {
    media: 'businesstoday',
    url: 'https://www.businesstoday.com.tw/',
    fallbackImage: '/favicons/businesstoday.png',
    scope: '.latest__side-slider',
    pattern: /^https:\/\//,
    redirectHosts: ['btoday.cc', 'supr.link'],
    title: (a) => a.find('h4').text().trim(),
  },
  {
    media: 'theinitium',
    url: 'https://theinitium.com/series/',
    fallbackImage: '/favicons/theinitium.png',
    // /issue/ is a general taxonomy; /series/ is the curated reporting series.
    pattern: /theinitium\.com\/tag\/[^/?#]+\/$/,
    scope: 'main',
    card: '[class~="border"]',
  },
  {
    media: 'heho',
    url: 'https://heho.com.tw/medical-feature-stories',
    fallbackImage: '/favicons/heho.png',
    pattern: /heho\.com\.tw\/[a-z][\w-]+\/?$/,
    scope: '#main .row-dashed',
    card: '.col-inner',
  },
  {
    media: 'edh',
    url: 'https://edh.tw/special',
    fallbackImage: '/favicons/edh.png',
    pattern: /\/special\/[^/?#]+$|edh\.tw\/evt\/[^/?#]+\/?$/,
    title: heading,
  },
  {
    media: 'eld',
    url: 'https://www.roomie.tw/special',
    fallbackImage: '/favicons/eld.png',
    pattern: /\/special\/[^/?#]+$/,
    card: '[class~="first:pt-0"]',
    image: '.taxonomy-header img',
    title: (a) =>
      (a.closest('[class~="first:pt-0"]').find('.taxonomy-header img').first().attr('alt') ?? '').replace(/ (Cover|Banner)$/, ''),
  },
];

// Tracking keys outlets append to topic links (中時 ?ctrack=) on top of the generic ones.
const TOPIC_TRACKING = /^ctrack$/i;
/** A raw href without surrounding space or tracking query, so anchored patterns
 *  still match; hrefs with inner whitespace are template junk (鏡週刊). */
export function cleanTopicHref(raw: string): string | null {
  const href = raw.trim();
  if (!href || /\s/.test(href)) return null;
  const m = /^([^?#]*)(?:\?([^#]*))?(#.*)?$/.exec(href);
  if (!m?.[2]) return href;
  const query = m[2].split('&').filter((p) => {
    const key = p.split('=')[0];
    return key && !TRACKING.test(key) && !TOPIC_TRACKING.test(key);
  });
  return m[1] + (query.length ? `?${query.join('&')}` : '') + (m[3] ?? '');
}

export function extractTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  const out = new Map<string, { url: string; title: string; guessed: boolean; image: string | null }>();
  (rule.scope ? $(rule.scope).find('a[href]') : $('a[href]')).each((_, el) => {
    const a = $(el);
    const href = cleanTopicHref(a.attr('href') ?? '');
    if (!href || !rule.pattern.test(href)) return;
    const resolved = resolveUrl(href, rule.url);
    if (
      !resolved ||
      (registrable(new URL(resolved).hostname) !== registrable(new URL(rule.url).hostname) &&
        !rule.redirectHosts?.includes(new URL(resolved).hostname))
    )
      return;
    const url = stripTracking(resolved);
    const card = rule.card ? a.closest(rule.card) : a.closest('li, article, div');
    let title = rule.title ? rule.title(a, $) : rule.card && card.length ? heading(card) : textOf(a);
    // Anchor text that is just a date/time or a generic label is not a topic
    // name; use the card heading instead.
    let guessed = false;
    if (!title || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(title) || /^(→\s*)?(看更多|more|更多|閱讀|詳全文)/i.test(title)) {
      const card = a.closest('li, article, div');
      const heading = decodeEntities(card.find('h1,h2,h3,h4,.title,[class*=title]').first().text().replace(/\s+/g, ' ').trim());
      if (heading) [title, guessed] = [heading, true];
    }
    if (!title || title.length < 2 || /^(→\s*)?(看更多|more|更多|閱讀)/i.test(title)) return;
    const imgSel = rule.image ?? 'img';
    const imgEl = a.find(imgSel).first().length ? a.find(imgSel).first() : card.find(imgSel).first();
    const imgSrc = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('data-src-small') || imgEl.attr('src') || null;
    const image = imgSrc && !/^data:|loading\.(gif|svg)|imageholder|placeholder/i.test(imgSrc) ? resolveUrl(imgSrc, rule.url) : null;
    // A "more" link's card heading can be an article inside the topic block
    // (EBC), so the topic link's own text wins over a guessed heading.
    const prev = out.get(url);
    const keepTitle = prev && (prev.guessed === guessed ? prev.title.length >= title.length : !prev.guessed);
    if (!prev || !keepTitle || (!prev.image && image))
      out.set(url, {
        url,
        title: keepTitle ? prev.title : title.slice(0, 512),
        guessed: keepTitle ? prev.guessed : guessed,
        image: image ?? prev?.image ?? null,
      });
  });
  return [...out.values()].map(({ url, title, image }) => ({ url, title, image, category: null }));
}

export function topicListings(rule: TopicRule): TopicRule[] {
  return [rule, ...(rule.listings ?? []).map((listing) => ({ media: rule.media, fallbackImage: rule.fallbackImage, ...listing }))];
}

/** The listing whose topic pages carry sub-topic links, if any. */
export function childSelectorFor(media: string, url: string, rules = TOPIC_RULES): string | undefined {
  const rule = rules.find((r) => r.media === media);
  if (!rule) return undefined;
  let path = url;
  try {
    const u = new URL(url);
    path = u.pathname + u.search;
  } catch {}
  return topicListings(rule).find((l) => l.children && (l.pattern.test(url) || l.pattern.test(path)))?.children;
}

/** Sub-topic links on a topic page: same outlet, not the page itself. */
export function topicChildren(html: string, pageUrl: string, selector: string): { url: string; title: string }[] {
  const $ = cheerio.load(html);
  const site = registrable(new URL(pageUrl).hostname);
  const self = stripTracking(pageUrl);
  const out = new Map<string, string>();
  $(selector).each((_, el) => {
    const a = $(el).is('a') ? $(el) : $(el).find('a[href]').first();
    const href = cleanTopicHref(a.attr('href') ?? '');
    const resolved = href && resolveUrl(href, pageUrl);
    if (!resolved || registrable(new URL(resolved).hostname) !== site) return;
    const url = stripTracking(resolved);
    const title = textOf(a).slice(0, 512);
    if (url !== self && title.length >= 2 && !out.has(url)) out.set(url, title);
  });
  return [...out].map(([url, title]) => ({ url, title }));
}

export async function fetchTopicListings(rule: TopicRule, fetch = fetchText) {
  const items = new Map<string, ListedTopic>();
  const sources: TopicSourceResult[] = [];
  for (const listing of topicListings(rule)) {
    const kind = listing.kind ?? 'auto';
    try {
      const errors: string[] = [];
      const seen = new Set<string>();
      let accepted = 0;
      let pages = 0;
      for (let n = 1; n <= (listing.paginate?.max ?? 1); n++) {
        const pageUrl = n === 1 ? listing.url : listing.paginate!.url(n);
        let found: TopicItem[];
        try {
          const res = await fetch(pageUrl, { userAgent: listing.userAgent, ...listing.paginate?.request?.(n) });
          if (res.status < 200 || res.status >= 400) throw Error(`HTTP ${res.status}`);
          found = (listing.extract ?? extractTopics)(res.body, { ...listing, url: res.url || pageUrl });
          if (!found.length && n === 1) throw Error('no topic links matched');
        } catch (error) {
          // Later pages are a bonus: the first page alone keeps the source healthy.
          if (n === 1) throw error;
          break;
        }
        const fresh = found.filter((item) => !seen.has(item.url));
        if (!fresh.length) break;
        pages = n;
        for (const item of fresh) {
          seen.add(item.url);
          if (listing.redirectHosts?.includes(new URL(item.url).hostname)) {
            try {
              let target = await fetch(item.url, { timeout: 10000, retries: 0 });
              // Supr.link publishes a normal continuation link instead of an HTTP redirect.
              if (target.status === 200 && new URL(target.url).hostname === 'supr.link') {
                const href = cheerio.load(target.body)('a#user-click-link').attr('href');
                const destination = href && resolveUrl(href, target.url);
                if (!destination || registrable(new URL(destination).hostname) !== registrable(new URL(listing.url).hostname))
                  throw Error('short link left official outlet');
                target = await fetch(destination, { timeout: 10000, retries: 0 });
              }
              if (target.status < 200 || target.status >= 400) throw Error(`HTTP ${target.status}`);
              if (registrable(new URL(target.url).hostname) !== registrable(new URL(listing.url).hostname))
                throw Error('redirect left official outlet');
              item.url = stripTracking(target.url);
            } catch (error) {
              errors.push(`${item.url}: ${(error as Error).message}`);
              continue;
            }
          }
          if (!item.kind && kind !== 'auto') item.kind = kind;
          if (listing.sponsored) item.sponsored = !!item.sponsored || listing.sponsored(item);
          if (!items.has(item.url)) items.set(item.url, { ...item, source: listing.url, page: n });
          accepted++;
        }
      }
      sources.push({
        url: listing.url,
        kind,
        items: accepted,
        ...(pages > 1 ? { pages } : {}),
        ...(errors.length ? { error: errors.join('; ') } : {}),
      });
    } catch (error) {
      sources.push({ url: listing.url, kind, items: 0, error: (error as Error).message });
    }
  }
  return { items: [...items.values()], sources };
}

export async function fetchTopics(rule: TopicRule, fetch = fetchText): Promise<TopicItem[]> {
  const result = await fetchTopicListings(rule, fetch);
  if (!result.items.length) throw Error(result.sources.map((s) => `${s.url}: ${s.error}`).join('; '));
  return result.items;
}

export function cnaDigitalTopics(json: string, rule: TopicRule): TopicItem[] {
  const data = JSON.parse(json) as {
    NewsItems?: { PageUrl?: string; HeadLine?: string; Source?: string; ClassName?: string; IsAd?: string }[];
  };
  return (data.NewsItems ?? []).flatMap((item) => {
    const url = item.PageUrl && resolveUrl(item.PageUrl, rule.url);
    const title = decodeEntities(item.HeadLine?.trim() ?? '');
    if (!url || !title || item.IsAd === 'Y' || registrable(new URL(url).hostname) !== 'cna.com.tw' || !rule.pattern.test(url)) return [];
    return [
      {
        url: stripTracking(url),
        title: title.slice(0, 512),
        image: item.Source ? resolveUrl(item.Source, rule.url) : null,
        category: item.ClassName ?? null,
      },
    ];
  });
}

/** ETtoday's published sheet includes quoted commas, escaped quotes and newlines. */
export function ettodayDigitalTopics(csv: string, rule: TopicRule): TopicItem[] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (char === '\n') {
        rows.push(row);
        row = [];
      }
    } else field += char;
  }
  if (quoted) throw Error('Unterminated CSV field');
  if (field || row.length) rows.push([...row, field.replace(/\r$/, '')]);
  const header = (rows.shift() ?? []).map((s) => s.replace(/^\uFEFF/, '').trim());
  const at = (r: string[], name: string) => r[header.indexOf(name)]?.trim() ?? '';
  if (!['專題名稱', '網址', '年度', '序號'].every((key) => header.includes(key))) throw Error('Unexpected ETtoday sheet columns');
  return rows
    .sort((a, b) => Number(at(b, '序號')) - Number(at(a, '序號')))
    .flatMap((r) => {
      const title = at(r, '專題名稱');
      const url = resolveUrl(at(r, '網址'), 'https://features.ettoday.net/');
      if (
        !title ||
        !/^\d{4}$/.test(at(r, '年度')) ||
        !url ||
        registrable(new URL(url).hostname) !== 'ettoday.net' ||
        !rule.pattern.test(url)
      )
        return [];
      const cover = at(r, '大圖');
      return [
        {
          url: stripTracking(url),
          title: title.slice(0, 512),
          image: !cover || /\.(mp4|webm)(\?|$)/i.test(cover) ? null : resolveUrl(cover, url),
          category: null,
        },
      ];
    });
}

export function nownewsTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  return $('a[data-sec="topics"][data-tracetype="brand"]')
    .toArray()
    .flatMap((el) => {
      const a = $(el),
        card = a.closest('.list-item');
      const url = resolveUrl(a.attr('href') ?? '', rule.url);
      const title = decodeEntities(card.find('.topic-title').text().trim());
      if (!url || !title || registrable(new URL(url).hostname) !== 'nownews.com') return [];
      const image = card.find('img').attr('src');
      return [{ url: stripTracking(url), title, image: image ? resolveUrl(image, rule.url) : null, category: null }];
    });
}

// Topic names from a JSON-LD ItemList, covers from the page's links.
export function ldTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  const covers = new Map(extractTopics(html, rule).map((t) => [t.url, t.image]));
  const out = new Map<string, TopicItem>();
  $('script[type="application/ld+json"]').each((_, el) => {
    let doc: { '@type'?: string; itemListElement?: Array<{ url?: string; name?: string }> };
    try {
      doc = JSON.parse($(el).text());
    } catch {
      return;
    }
    if (doc['@type']?.toLowerCase() !== 'itemlist') return;
    for (const item of doc.itemListElement ?? []) {
      const url = item.url && resolveUrl(item.url, rule.url);
      const title = decodeEntities(item.name?.trim() ?? '');
      if (url && title && rule.pattern.test(url) && !out.has(url))
        out.set(url, { url, title: title.slice(0, 512), image: covers.get(url) ?? null, category: null });
    }
  });
  return out.size ? [...out.values()] : extractTopics(html, rule);
}

// Nuxt 3 pages serialise their state as a flat JSON array (devalue): objects
// hold indexes into the array. Topic records are the objects with a title,
// cover and a link matching the rule; anchors only exist for the nav subset.
export function nuxtTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  let data: unknown[];
  try {
    data = JSON.parse($('script#__NUXT_DATA__').text());
  } catch {
    return extractTopics(html, rule);
  }
  const str = (i: unknown) => (typeof i === 'number' && typeof data[i] === 'string' ? (data[i] as string) : null);
  const out = new Map<string, TopicItem>();
  for (const o of data) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
    const r = o as Record<string, unknown>;
    const link = str(r.link);
    const title = str(r.title)?.trim();
    if (!link || !title || !rule.pattern.test(link)) continue;
    const url = resolveUrl(link, rule.url);
    const img = str(r.thumbImageUrl) ?? str(r.imageUrl);
    if (url && !out.has(url)) out.set(url, { url, title: title.slice(0, 512), image: img && resolveUrl(img, rule.url), category: null });
  }
  return out.size ? [...out.values()] : extractTopics(html, rule);
}
