import * as cheerio from 'cheerio';
import { type FetchRequest, fetchText } from './fetch.ts';
import { decodeEntities, resolveUrl, stripTracking, TRACKING } from './text.ts';
import { cnaNewsTopics, ltnSpecialTopics, udnTopicIndex } from './topic-extractors-a1.ts';
import { ctsTopics, ettodayFeatureIndex, ftvTopics, nextappleSpecial, setnTopics, ttvProjects } from './topic-extractors-a2.ts';
import {
  cwNavTopics,
  insideFeatures,
  mirrorTopics,
  nownewsTopicGroups,
  taisoundsTopics,
  tnlFeatures,
  twreporterTopics,
} from './topic-extractors-b1.ts';
import { womanyCollections, wycTopics, zaobaoSpecials } from './topic-extractors-b2.ts';
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
// 中時 albums carry no 廣告 label; these are the brand/campaign packages it
// links from every album page (永慶房屋, the 寶島旺旺行/旺旺福來報 promos).
const chinatimesSponsored = (item: TopicItem) => /\/album\/(yungching|ctnewyear[AB])\//.test(item.url);
export const TOPIC_RULES: TopicRule[] = [
  // newtalk anchors carry the latest article title; the topic name is the URL slug.
  {
    media: 'newtalk',
    fallbackImage: 'https://newtalk.tw/images/ogimage.jpg',
    // /news/topics/list redirects here. A canary serves two layouts at random
    // (20 or 10 topics a page, numbered differently), which breaks paging; the
    // cookie pins the new one: ~15 pages, ~150 topics.
    url: 'https://newtalk.tw/news/topics',
    pattern: /\/news\/topics\/view\/\d+/,
    kind: 'topic',
    paginate: {
      url: (n) => `https://newtalk.tw/news/topics/${n}`,
      max: 30,
      request: () => ({ headers: { cookie: 'canary_id=0; canary_version=new' } }),
    },
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
    // Carousel slides put the name in .feature_title beside a long description.
    title: (a) => a.find('.title, .feature_title').first().text().trim() || heading(a),
    extract: setnTopics,
    // ~5 pages; past the last one the site repeats it, which stops pagination.
    paginate: { url: (n) => `https://www.setn.com/Plist.aspx?p=${n}`, max: 10 },
    listings: [
      // The homepage features a few running ones (好康搜查線 /project/162) the index lacks.
      {
        url: 'https://www.setn.com/',
        pattern: /\/(klist|project)\/\d+/i,
        title: (a) => a.find('.title, .feature_title').first().text().trim() || heading(a),
        extract: setnTopics,
      },
    ],
  },
  {
    media: 'cts',
    fallbackImage: 'https://news.cts.com.tw/assets/fb_img.jpg',
    url: 'https://news.cts.com.tw/topic/',
    // Also the event microsites it banners (event.cts.com.tw/2026asiangames/).
    pattern: /\/topic\/[0-9a-f-]{36}|^https:\/\/event\.cts\.com\.tw\/[\w-]+\/?$/,
    // Story dates come with the listing, so auto classifies on insert.
    extract: ctsTopics,
  },
  {
    media: 'ebc',
    fallbackImage: 'https://news.ebc.net.tw/img/ebc_news.jpg',
    // /topic now 301s to the homepage, whose topic bar is the whole set (no archive).
    url: 'https://news.ebc.net.tw/',
    pattern: /\/topic\/\d+$/,
    kind: 'topic',
  },
  {
    media: 'cna',
    fallbackImage: 'https://imgcdn.cna.com.tw/www/images/pic_fb.jpg',
    // The HTML list shows 20 of ~100; its "more" button pages through the
    // WNewsList API. Microsites (netzero.cna.com.tw) sit in the same list and
    // keep publishing, so they stay 議題 too.
    url: 'https://www.cna.com.tw/list/newstopic.aspx',
    pattern: /\/topic\/newstopic\/\d+\.aspx$|^https:\/\/[\w-]+\.cna\.com\.tw\/?$/,
    scope: '#jsMainList',
    extract: cnaNewsTopics,
    kind: 'topic',
    paginate: {
      url: () => 'https://www.cna.com.tw/cna2018api/api/WNewsList',
      max: 10,
      request: (n) =>
        n === 1
          ? {}
          : {
              method: 'POST',
              body: JSON.stringify({ action: '0', category: 'newstopic', pagesize: '20', pageidx: n }),
              // The default Accept prefers XML, which this API answers with a 500.
              headers: { 'content-type': 'application/json', accept: 'application/json' },
            },
    },
    // Parent topics (5056 縣市長選舉) link their sub-topics as section headings.
    children: '.definKind h2 a',
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
    // /pack/packnews now redirects here. The index shows ~36 picks; each
    // category page lists all of its topics (~111 in total), dormant ones too.
    url: 'https://news.tvbs.com.tw/topics',
    pattern: /\/topics\/[a-z]+\/\d+$/,
    kind: 'topic',
    listings: [
      ...['politics', 'world', 'life', 'local', 'money', 'entertainment', 'sports', 'china', 'health', 'tech', 'esg', 'travel', 'cars'].map(
        (cat) => ({ url: `https://news.tvbs.com.tw/topics/${cat}`, pattern: /\/topics\/[a-z]+\/\d+$/, kind: 'topic' as const }),
      ),
      // Event microsites are only linked from the homepage's topic chip bar.
      {
        url: 'https://news.tvbs.com.tw/',
        pattern: /^https:\/\/news\.tvbs\.com\.tw\/(events|exhibition)\/[\w-]+(\/(index\.html)?)?$/,
        kind: 'feature',
      },
    ],
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
    // 15 a page, most recently updated first; ~49 pages reach back to 2021
    // (later pages are 已停更 topics) and page 50+ is a 404.
    paginate: { url: (n) => `https://news.pts.org.tw/hotTopic?page=${n}`, max: 50 },
    // /curation is 專題: one-off long-form features. Cards split into an image
    // link and an <h3> title link; the card selector joins them. ~8 pages; the
    // same 5 highlights head every page.
    listings: [
      {
        url: 'https://news.pts.org.tw/curation',
        kind: 'feature',
        pattern: /\/curation\/\d+$/,
        card: '.curation-main, .curation-secondary .col-lg-6, .project-card',
        title: heading,
        paginate: { url: (n) => `https://news.pts.org.tw/curation?page=${n}`, max: 12 },
      },
      // 新聞實驗室「數位敘事」: interactive projects and microsites across pts.org.tw.
      {
        url: 'https://newslab.pts.org.tw/topic',
        kind: 'feature',
        pattern:
          /^https:\/\/(news\.pts\.org\.tw\/(projects?|presentation|live)\/[^?#]+|newmedia\.pts\.org\.tw\/[^/?#]+|(?!(news|newslab|www)\.)[\w-]+\.pts\.org\.tw\/)/,
        // Cover and title are separate links. A row can hold two stories, so the
        // card only lends a cover; titles come from the link itself.
        card: '.md\\:flex, .border',
        title: (a) => textOf(a),
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
        extract: udnTopicIndex,
      },
      // 新媒體中心: one-off multimedia/data/interactive packages on vip.udn.com,
      // udn.com/newmedia and the older udn.com/upf/newmedia. udn.com/newmedia/
      // itself only shows the latest few; these are its full category pages.
      ...['issue', 'data', 'interaction'].map((category) => ({
        url: `https://udn.com/newmedia/office/${category}/`,
        kind: 'feature' as const,
        pattern:
          /udn\.com\/(newmedia\/(?!office\b)(\d{4}\/|election\d{4}\/)?[\w-]+|event\/newmedia_[\w-]+|upf\/newmedia\/\d{4}_data\/[\w-]+)/,
        scope: '.page-posts',
        // Each post links its cover, title and summary; all carry the title attribute.
        title: (a: cheerio.Cheerio<import('domhandler').Element>) => decodeEntities(a.attr('title') ?? '') || textOf(a),
      })),
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
    kind: 'topic',
    listings: [
      // 新聞事件簿: /topic/ tag pages for past events, mostly dormant 議題 (auto).
      {
        url: 'https://features.ltn.com.tw/',
        pattern: /ltn\.com\.tw\//,
        scope: '.project',
        title: (a) => decodeEntities(a.find('img').attr('alt') ?? '') || heading(a),
      },
      // 專題專區: yearly microsites on features./election./sports.ltn.com.tw.
      {
        url: 'https://features.ltn.com.tw/special_topic',
        pattern: /(features|election|sports)\.ltn\.com\.tw\/[^/?#]+/,
        scope: '.project',
        title: (a) => decodeEntities(a.find('img').attr('alt') ?? '') || heading(a),
        extract: ltnSpecialTopics,
        kind: 'feature',
      },
    ],
  },
  {
    media: 'nextapple',
    fallbackImage: 'https://static.nextapple.tw/web/layout/img/index.jpg',
    url: 'https://news.nextapple.com/collection/topic',
    pattern: /\/collection\/topic\/[^/?#]+/,
    // Topic collections are short news bursts or running stories: auto.
    listings: [
      { url: 'https://special.nextapple.com/', pattern: /^https:\/\/special\.nextapple\.com\/[^/?#]+\/?$/, extract: nextappleSpecial },
    ],
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
    extract: ftvTopics,
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
    title: heading,
    extract: ettodayFeatureIndex,
    // Mixed: running keyword pages (地震, podcast) and one-off packages. Deep
    // pages are thousands of stale celebrity tags, so only the first few.
    paginate: { url: (n) => `https://www.ettoday.net/feature/index/0/${n}`, max: 5 },
    listings: [
      {
        // Public CSV linked by features.ettoday.net, also used by its browser UI.
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSC8DHP42p7MvVh8FXxjEJwZejAS3lzw7hvNAU4zeVP82zZCmefGCLWXOqeqanUrbvokw3UxKn7uzDm/pub?output=csv',
        pattern: /features\.ettoday\.net\/[^/?#]+|\/events\/depth-topic\//,
        extract: ettodayDigitalTopics,
        kind: 'feature',
      },
      // The nav's highlighted buttons link the current event microsites (2026大選, 亞運).
      {
        url: 'https://www.ettoday.net/',
        scope: '.nav_1_v4 .piece > li.style_1',
        pattern: /^https:\/\/(www\.ettoday\.net\/events|events\.ettoday\.net)\/[\w-]+\/[\w-]+\.php7?$/,
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
    extract: insideFeatures,
    kind: 'feature',
    paginate: { url: (n) => `https://www.inside.com.tw/features?page=${n}`, max: 10 },
  },
  {
    media: 'nownews',
    url: 'https://www.nownews.com/topics/',
    fallbackImage: 'https://www.nownews.com/icon/banner.jpg',
    pattern: /nownews\.com\//,
    extract: nownewsTopics,
    // Brand microsites (跨世代, 心理假).
    kind: 'feature',
    listings: [
      {
        // 重磅追蹤: monthly numbered series, 5 to a page.
        url: 'https://www.nownews.com/topicgroup/',
        pattern: /nownews\.com\/news\/\d+/,
        extract: nownewsTopicGroups,
        kind: 'feature',
        paginate: { url: (n) => `https://www.nownews.com/topicgroup/${n}/`, max: 8 },
      },
    ],
  },
  // The dedicated /topic index currently returns a challenge; the public
  // homepage also carries the editor-selected topic links (not article tags).
  {
    media: 'ctee',
    url: 'https://www.ctee.com.tw/',
    fallbackImage: 'https://static.ctee.com.tw/img/ctee-logo-main.png?20260825',
    pattern: /ctee\.com\.tw\/topic\/[^/?#]+\/\d+-\d+|topic\.ctee\.com\.tw\/[^/?#]+\/?$/,
    title: heading,
    // Annual and monthly packages (people2026, 上市櫃8月營收, 年度好書); www /topic/
    // pages answer 403, so story dates could not classify them anyway.
    kind: 'feature',
  },
  {
    media: 'chinatimes',
    url: 'https://www.chinatimes.com/album/',
    fallbackImage: '/favicons/chinatimes.png',
    // 專輯 mix running stories (美伊, 會員文章) with monthly one-offs: auto.
    pattern: /\/album\/[^/?#]+\/\d+-\d+$/,
    title: heading,
    // The full index spans two pages (data-count on its pagination).
    paginate: { url: (n) => `https://www.chinatimes.com/album/total?page=${n}`, max: 3 },
    sponsored: chinatimesSponsored,
    // Section indexes reach albums the main one has dropped; the homepage is a
    // fallback should the album pages be challenged again (they were once).
    listings: ['global/', 'album-star/', 'album-focus', 'album-sports', 'album-military/', 'album-technology/', ''].map((path) => ({
      url: path ? `https://www.chinatimes.com/album/${path}` : 'https://www.chinatimes.com/',
      pattern: /\/album\/[^/?#]+\/\d+-\d+$/,
      title: heading,
      sponsored: chinatimesSponsored,
    })),
  },
  {
    media: 'ttv',
    url: 'https://news.ttv.com.tw/Projs/',
    fallbackImage: '/favicons/ttv.png',
    pattern: /^\/Proj\/(?!index\.html)[^/?#]+$/,
    // Heading link above the project's story thumbnails: the first one is the cover.
    card: '.project-list > li',
    title: heading,
    extract: ttvProjects,
    // Programme series: some still air weekly (益起看世界), others stopped
    // (熱線追蹤, 2024), so auto; story IDs carry ROC dates (dateFromStoryUrl).
    kind: 'auto',
  },
  {
    media: 'tnl',
    url: 'https://www.thenewslens.com/feature',
    fallbackImage: '/favicons/tnl.png',
    pattern: /\/feature\/[^/?#]+\/?$/,
    scope: '.item-content',
    card: '.item-content',
    title: (a) => heading(a.closest('.item-content')),
    extract: tnlFeatures,
    kind: 'feature',
    // 20 a page; deep pages reach back to 2020.
    paginate: { url: (n) => `https://www.thenewslens.com/feature?page=${n}`, max: 10 },
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
    // Running 議題, columns and programmes. Their pages render stories
    // client-side, so auto would see no story list and call them features.
    kind: 'topic',
  },
  {
    media: 'fountmedia',
    url: 'https://www.fountmedia.io/topic',
    fallbackImage: '/favicons/fountmedia.png',
    pattern: /^\/topic\/[^/?#]+$/,
    scope: 'article',
    title: (a) => a.find('.intro-bl .content').text().trim() || heading(a),
    // 放．專題: one-off packages; the slider's /topic/<id> links alias these.
    kind: 'feature',
  },
  {
    media: 'technews',
    url: 'https://technews.tw/topics/',
    fallbackImage: '/favicons/technews.png',
    // Topic pages are bare slugs, as are the site's feeds, portals and static pages.
    pattern:
      /^\/(?!(?:feed|topics|tn-rss|event-portal|enterprise-portal|aboutus|contact|staff|copyright|privacy-policy|terms-of-use|content-exchange)\/)[a-z][\w-]+\/$/,
    scope: '#content .carousel-banner_item, #content .column_list_item_wrapper',
    // Mixed: some keep gaining /YYYY/MM/DD/ stories, most were published once.
    kind: 'auto',
    card: '.carousel-banner_item, .column_list_item_wrapper',
  },
  {
    media: 'techorange',
    // 特展: the full index on one page (/feature/2/ redirects back to it).
    url: 'https://techorange.com/feature/',
    fallbackImage: '/favicons/techorange.png',
    pattern: /techorange\.com\/feature\/(?!\d+\/)[^/?#]+\/?$/,
    card: '.e-loop-item',
    // The cover link's only text is its <noscript> image markup.
    title: (a) => {
      const card = a.closest('.e-loop-item');
      return card.find('.elementor-heading-title').first().text().trim() || (card.find('img[alt]').attr('alt') ?? '').trim();
    },
    kind: 'feature',
    // The homepage names the newest packages, some of which the index leaves untitled.
    listings: [
      { url: 'https://techorange.com/', pattern: /techorange\.com\/feature\/(?!\d+\/)[^/?#]+\/?$/, title: heading, kind: 'feature' },
    ],
  },
  {
    media: 'ithome',
    url: 'https://www.ithome.com.tw/feature',
    fallbackImage: '/favicons/ithome.png',
    // These /article/ pages are the feature bundles; their constituent stories use /news/.
    pattern: /^\/article\/\d+$/,
    scope: '.view-content',
    title: heading,
    // One-off packages (cover stories, surveys), 12 a page back to 2015; the
    // Drupal pager is 0-based. Five pages cover roughly the last 18 months.
    kind: 'feature',
    paginate: { url: (n) => `https://www.ithome.com.tw/feature?page=${n - 1}`, max: 5 },
  },
  {
    media: 'einfo',
    url: 'https://e-info.org.tw/feature',
    fallbackImage: '/favicons/einfo.png',
    pattern: /^\/feature\/\d+$/,
    scope: 'main',
    card: 'article',
    // 專題報導: one-off reporting packages, all on one page.
    kind: 'feature',
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
    // One-off packages; three pages in all (the Drupal pager is 0-based).
    kind: 'feature',
    paginate: { url: (n) => `https://www.coolloud.org.tw/topics?page=${n - 1}`, max: 5 },
  },
  {
    media: 'foodnext',
    url: 'https://www.foodnext.net/topic',
    fallbackImage: '/favicons/foodnext.png',
    pattern: /^\/issue\/\d+$/,
    scope: '.article-list',
    card: '.article-list',
    // 食專題: single long-form pieces, the whole archive on one page.
    kind: 'feature',
  },
  {
    media: 'cnyes',
    url: 'https://news.cnyes.com/projects/cat/all',
    fallbackImage: '/favicons/cnyes.png',
    pattern: /^https:\/\/topics\.cnyes\.com\/[^/?#]+\/?$/,
    title: heading,
    // Every topics.cnyes.com microsite is an advertiser's package (CME, funds, IPOs).
    kind: 'feature',
    sponsored: () => true,
  },
  {
    media: 'shoppingdesign',
    url: 'https://www.shoppingdesign.com.tw/topic',
    fallbackImage: '/favicons/shoppingdesign.png',
    pattern: /\/topic\/view\/\d+$/,
    title: heading,
    // Magazine theme packages (some brand-made, unmarked). A bare-UA request
    // is redirected away, which made the index look empty in audits.
    kind: 'feature',
    paginate: { url: (n) => `https://www.shoppingdesign.com.tw/topic?page=${n}`, max: 6 },
  },
  {
    media: 'sportsv',
    url: 'https://www.sportsv.net/feature',
    fallbackImage: '/favicons/sportsv.png',
    pattern: /\/feature\/[^/?#]+$/,
    card: '.item',
    // Mixed: season-long hubs (playoffs, World Cup) and one-off packages.
    // Newest first back to ~2010; five pages reach about two years back.
    kind: 'auto',
    paginate: { url: (n) => `https://www.sportsv.net/feature?page=${n}`, max: 5 },
  },
  {
    media: 'tvbshealth',
    url: 'https://health.tvbs.com.tw/topic',
    fallbackImage: '/favicons/tvbshealth.png',
    pattern: /health\.tvbs\.com\.tw\/exhibition\//,
    scope: 'main',
    title: heading,
    // 專題企劃: advertiser-funded campaign microsites (/exhibition/<slug>/<year>/),
    // except the editorial year-in-review (health-review).
    kind: 'feature',
    sponsored: (t) => !/\/exhibition\/[^/]*-review\b/.test(t.url),
    paginate: { url: (n) => `https://health.tvbs.com.tw/topic?page=${n}`, max: 3 },
  },
  {
    media: 'supertaste',
    url: 'https://supertaste.tvbs.com.tw/topic',
    fallbackImage: '/favicons/supertaste.png',
    pattern: /supertaste\.tvbs\.com\.tw\/exhibition\//,
    card: '[class~="group/card"]',
    // 專題企劃: campaign microsites made with tourism boards and brands, all
    // on one page; the year-in-review ones (supertaste-review) are editorial.
    kind: 'feature',
    sponsored: (t) => !/\/exhibition\/[^/]*-review\b/.test(t.url),
  },
  {
    media: 'womany',
    url: 'https://womany.net/collections',
    fallbackImage: '/favicons/womany.png',
    pattern: /^\/collections\/[^/?#]+$/,
    scope: '.collection-item',
    title: heading,
    // 特別企劃: one-off packages, many of them brand campaigns (品牌贊助 badge).
    extract: womanyCollections,
    kind: 'feature',
  },
  {
    media: 'wyc',
    url: 'https://dq.yam.com/topic/list/1',
    fallbackImage: '/favicons/wyc.png',
    pattern: /^\/topic\/\d+\/1(?:\?redirect=\d+)?$/,
    title: heading,
    extract: wycTopics,
    // 精選主題: packages of explainers around one event; four pages in all.
    kind: 'feature',
    paginate: { url: (n) => `https://dq.yam.com/topic/list/${n}`, max: 4 },
  },
  {
    media: 'mplus',
    url: 'http://www.mplus.com.tw/topic/all',
    fallbackImage: '/favicons/mplus.png',
    pattern: /\/topic\/\d+$/,
    scope: '.theme',
    title: heading,
    // One-off packages; the site has not published one since 2022.
    kind: 'feature',
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
    // Running story categories, all on one page; most have gone quiet (已停更).
    kind: 'topic',
  },
  {
    media: 'zaobao',
    url: 'https://www.zaobao.com.sg/special',
    fallbackImage: '/favicons/zaobao.png',
    pattern: /^\/specials?\/[^/?#]+$/,
    title: (a) => a.closest('h2').text().trim() || heading(a),
    extract: zaobaoSpecials,
    listings: [
      {
        // 互动新闻: one-off interactive microsites; skip the quizzes inside them.
        url: 'https://www.zaobao.com.sg/interactive-graphics',
        pattern: /^https:\/\/interactive\.zaobao\.com\.sg\/(?![^?#]*quiz)[^?#]+\/$/,
        card: '.card',
        kind: 'feature',
      },
    ],
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
    // Running story collections; their story URLs carry no dates for auto.
    kind: 'topic',
  },
  {
    media: 'businesstoday',
    url: 'https://www.businesstoday.com.tw/',
    fallbackImage: '/favicons/businesstoday.png',
    scope: '.latest__side-slider',
    pattern: /^https:\/\//,
    redirectHosts: ['btoday.cc', 'supr.link'],
    title: (a) => a.find('h4').text().trim(),
    // 數位專題 slides: mostly one-off microsites, but the election 戰情室 is a
    // running hub; both list dated /post/YYYYMMDDnnnn stories.
    kind: 'auto',
  },
  {
    media: 'theinitium',
    url: 'https://theinitium.com/series/',
    fallbackImage: '/favicons/theinitium.png',
    // /issue/ is a general taxonomy; /series/ is the curated reporting series.
    // 最近更新 holds the new ones; the per-year sections below list every series.
    pattern: /^(?:https:\/\/theinitium\.com)?\/tag\/[^/?#]+\/$/,
    scope: '#series-latest',
    card: '[class~="border"]',
    // Mixed: running series (wars, elections) and one-off packages.
    kind: 'auto',
    listings: [
      {
        // Ghost repeats the whole page here: the full archive (back to 2015)
        // under its own source, so it is stored as backlog.
        url: 'https://theinitium.com/series/page/2/',
        pattern: /^(?:https:\/\/theinitium\.com)?\/tag\/[^/?#]+\/$/,
        scope: 'main',
        card: '[class~="border"]',
        kind: 'auto',
      },
      {
        // 欄目: columns, podcasts and newsletters keep publishing.
        url: 'https://theinitium.com/column/',
        pattern: /^(?:https:\/\/theinitium\.com)?\/tag\/[^/?#]+\/$/,
        scope: 'main',
        card: '[class~="border"]',
        kind: 'topic',
      },
    ],
  },
  {
    media: 'heho',
    url: 'https://heho.com.tw/medical-feature-stories',
    fallbackImage: '/favicons/heho.png',
    // Single-slug landing pages on the main and section hosts; not the
    // tools.* / npower.* lookup tools or WordPress archive paths.
    pattern: /^https:\/\/(?:(?:www|sport|kids)\.)?heho\.com\.tw\/(?!(?:tag|category|archives|author|page)\/?$)[a-z0-9][\w-]+\/?$/,
    scope: '#main .row-dashed',
    card: '.col-inner',
    // 醫療專題: one-off packages and campaign hubs.
    kind: 'feature',
  },
  {
    media: 'edh',
    url: 'https://edh.tw/special',
    fallbackImage: '/favicons/edh.png',
    pattern: /\/special\/[^/?#]+$|edh\.tw\/evt\/[^/?#]+\/?$/,
    // Each card links a bold name and a longer summary to the same page.
    title: (a) => a.closest('.group').find('a.font-bold').first().text().trim() || heading(a),
    kind: 'feature',
    // /evt/ are advertisers' campaign sites; /special/<id> are edh's own packages.
    sponsored: (t) => /edh\.tw\/evt\//.test(t.url),
    paginate: { url: (n) => `https://edh.tw/special?page=${n}`, max: 5 },
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
    // 特輯: one-off themed packages, all on one page.
    kind: 'feature',
  },
];

// Tracking keys outlets append to topic links (中時 ?ctrack=, ?chdtv) on top of the generic ones.
const TOPIC_TRACKING = /^(ctrack|chdtv)$/i;
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
              // Retired packages (今周刊 /catalog/N) bounce back to the listing page.
              if (stripTracking(target.url) === stripTracking(listing.url)) throw Error('short link fell back to the listing');
              item.url = stripTracking(target.url);
            } catch (error) {
              errors.push(`${item.url}: ${(error as Error).message}`);
              continue;
            }
          }
          if (!item.kind && kind !== 'auto') item.kind = kind;
          if (listing.sponsored) item.sponsored = !!item.sponsored || listing.sponsored(item);
          const prev = items.get(item.url);
          if (!prev) items.set(item.url, { ...item, source: listing.url, page: n });
          // A listing that declares the kind beats an earlier 'auto' one (端 columns also appear under series).
          else if (!prev.kind && item.kind) prev.kind = item.kind;
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
