import type { SourceOverride } from '../sources.ts';
// Hand-ported adjustments for media whose legacy PHP relied on page-specific
// markers or whose feeds moved. Keep entries small and commented.
export const overrides: Record<string, SourceOverride> = {
  // ETtoday's news sitemaps stopped updating on 2026-07-21; Feedburner is live.
  ettoday: {
    list: {
      urls: [
        { cat: 'realtime', url: 'https://feeds.feedburner.com/ettoday/realtime' },
        { cat: 'news', url: 'https://feeds.feedburner.com/ettoday/news' },
      ],
    },
  },
  // Found by the weekly source probe (2026-09-29): full-site sitemap, recent items only.
  edh: { list: { urls: [{ cat: 'news', url: 'https://edh.tw/sitemap.xml' }] } },
  // No feed at all: discover article links from the homepage/section pages (issue #4).
  // /news/<14-digit id>-<category>: one story per category it is filed under.
  ctee: {
    list: {
      urls: [{ cat: 'news', url: 'https://www.ctee.com.tw/' }],
      discover: { pattern: '^/news/\\d{14}-\\d+$' },
      articleId: String.raw`^/news/(\d{14})-\d+$`,
    },
  },
  cw: { list: { urls: [{ cat: 'news', url: 'https://www.cw.com.tw/' }], discover: { pattern: '^/article/\\d+' } } },
  bnext: {
    list: {
      urls: [
        { cat: 'news', url: 'https://www.bnext.com.tw/articles' },
        { cat: 'news', url: 'https://www.bnext.com.tw/' },
      ],
      discover: { pattern: '^/article/\\d+' },
    },
  },
  vogue: { list: { urls: [{ cat: 'news', url: 'https://www.vogue.com.tw/' }], discover: { pattern: '^/(article|galerie)/' } } },
  eld: { list: { urls: [{ cat: 'news', url: 'https://www.roomie.tw/' }], discover: { pattern: '^/posts/\\d+' } } },
  oncc: { list: { urls: [{ cat: 'news', url: 'https://hk.on.cc/tw/news/index.html' }], discover: { pattern: '/bkn/cnt/news/\\d{8}/' } } },
  dramaqueen: { list: { urls: [{ cat: 'news', url: 'https://www.dramaqueen.com.tw/' }], discover: { pattern: '^/news/\\d{8}/' } } },
  // Legacy parsed the HTML listing with '<item' markers; the site has a real feed.
  nius: { list: { urls: [{ cat: 'feed', url: 'https://www.niusnews.com/feed' }] } },
  // Restored sources (issue #4): feeds found via robots.txt on 2026-09-28.
  // /<section>/<id>: a story filed under two sections appears twice.
  tvbs: {
    list: { urls: [{ cat: 'news', url: 'https://news.tvbs.com.tw/sitemap/news-sitemap' }], articleId: String.raw`^/[a-z-]+/(\d+)$` },
  },
  ctitv: {
    list: { urls: [{ cat: 'news', url: 'https://ctinews.com/rss/sitemap-news.xml' }] },
    titleSuffix: String.raw`\s*\|\s*中天新聞網`,
  },
  upmedia: { list: { urls: [{ cat: 'news', url: 'https://www.upmedia.mg/sitemapnews' }] } },
  epochtimes: { list: { urls: [{ cat: 'news', url: 'https://www.epochtimes.com/feed' }] } },
  udn: {
    list: { urls: [{ cat: 'news', url: 'https://udn.com/sitemapxml/news/mapindex.xml' }] },
    titleSuffix: String.raw`\s*\|\s*聯合新聞網`,
  },
  // Second batch probed 2026-09-28 (sitemap indexes: newest 4 children followed).
  // The full sitemap also lists channels, magazine issues and account pages.
  commonhealth: {
    list: { urls: [{ cat: 'news', url: 'https://www.commonhealth.com.tw/sitemap.xml' }], include: String.raw`^/article/\d+$` },
    titleSuffix: String.raw`\s*-\s*康健雜誌`,
  },
  cti: { list: { urls: [{ cat: 'news', url: 'https://ctinews.com/rss/sitemap.xml' }] } },
  daman: { list: { urls: [{ cat: 'news', url: 'http://feeds.feedburner.com/feed' }] } },
  // RSS is gone (404) and the sitemap lists only static pages; the news and
  // column sections link recent /node/<id> articles (dated on the page).
  einfo: {
    list: {
      urls: [
        { cat: 'news', url: 'https://e-info.org.tw/section/news' },
        { cat: 'column', url: 'https://e-info.org.tw/section/column' },
      ],
      discover: { pattern: String.raw`^/node/\d+$` },
    },
  },
  // Pages carry no date and the homepage recycles years-old columns; only the
  // news section's own links count.
  foodnext: {
    list: {
      urls: [{ cat: 'news', url: 'https://www.foodnext.net/news/newsnow/' }],
      discover: { pattern: String.raw`^/news/newsnow/paper/\d+$` },
    },
  },
  ldope: { list: { urls: [{ cat: 'news', url: 'https://ldope.com/sitemap_index.xml' }] } },
  lihpao: { list: { urls: [{ cat: 'news', url: 'https://www.lihpao.com/sitemap.xml' }] } },
  marieclaire: { list: { urls: [{ cat: 'news', url: 'https://www.marieclaire.com.tw/sitemap.xml' }] } },
  shoppingdesign: { list: { urls: [{ cat: 'news', url: 'https://www.shoppingdesign.com.tw/rss' }] } },
  supertaste: {
    list: { urls: [{ cat: 'news', url: 'https://supertaste.tvbs.com.tw/sitemap.xml' }], include: String.raw`^/[a-z-]+/\d+$` },
    titleSuffix: String.raw`\s*\|\s*食尚玩家`,
  },
  // Ghost RSS (latest 15, dated); sitemap-posts.xml is over the 8 MB cap.
  // Every story may also exist as a -zh-hans copy.
  theinitium: {
    list: {
      urls: [{ cat: 'news', url: 'https://theinitium.com/rss/' }],
      include: String.raw`^/\d{8}-`,
      articleId: String.raw`^/(\d{8}-.+?)(?:-zh-hans)?/?$`,
    },
  },
  tvbshealth: { list: { urls: [{ cat: 'news', url: 'https://health.tvbs.com.tw/sitemap/sitemap.xml' }] } },
  tvbswoman: {
    list: {
      urls: [{ cat: 'news', url: 'https://woman.tvbs.com.tw/sitemap/recent_article_sitemap.xml' }],
      include: String.raw`^/[a-z-]+/\d+$`,
    },
    titleSuffix: String.raw`\s*\|\s*女人我最大`,
  },
  // One story is listed under every category it belongs to: /news/content/<category>/<id>;
  // topic pages link the same id as /specialtopic/content/<topic>/<id>.
  taisounds: {
    list: { articleId: String.raw`^/(?:news|specialtopic)/content/\d+/(\d+)` },
    titleSuffix: String.raw`\s*\|[^|]*-\s*太報 TaiSounds`,
  },
  // "<title> | 綜合 | 運動 | NOWnews今日新聞": up to three short section names.
  nownews: { titleSuffix: String.raw`(?:\s\|\s[^|]{1,12}){0,3}\s*\|\s*NOWnews今日新聞` },
  pts: { titleSuffix: String.raw`\s*[|｜]\s*公視新聞網 PNN` },
  techbang: { titleSuffix: String.raw`\s*\|\s*T客邦` },
  // Yahoo's own reporting only (the user's call, 2026-09-29): its RSS is all
  // partner media. Section pages also link partner stories, so each page's
  // provider must contain "Yahoo" (特派記者、特別企劃、新聞編輯室、財經編輯室、股市).
  yahoo: {
    group: 'hourly',
    list: {
      urls: [
        { cat: 'reporter', url: 'https://tw.news.yahoo.com/yahoo-reporter/' },
        { cat: 'explains', url: 'https://tw.news.yahoo.com/topic/explains/' },
        { cat: 'finance', url: 'https://tw.stock.yahoo.com/reporter' },
      ],
      discover: { pattern: String.raw`-\d{9}\.html$` },
      articleId: String.raw`-(\d{9})\.html$`,
    },
    article: { enabled: true, batch: 60, delayMs: 2000, userAgent: undefined, provider: 'Yahoo' },
  },
  // The sitemap has no dates at all; the news index links the latest stories.
  '1111': {
    list: { urls: [{ cat: 'news', url: 'https://www.1111.com.tw/news/' }], discover: { pattern: String.raw`^/news/jobns/\d+$` } },
  },
  // 旺報 is now a China Times print section (2603xx); chinatimes' own listing
  // (today's realtime news) does not include it.
  want: {
    group: 'hourly',
    list: {
      urls: [{ cat: 'news', url: 'https://www.chinatimes.com/newspapers/2603' }],
      discover: { pattern: String.raw`^/newspapers/\d{14}-2603\d{2}$` },
    },
  },
  // Feedburner feed died; the site's own feed is current (checked 2026-09-29).
  soft4fun: { list: { urls: [{ cat: 'news', url: 'https://www.soft4fun.net/feed' }] } },
  // RSS gone; the homepage links ~90 recent /article/<id> stories.
  healthnews: {
    list: { urls: [{ cat: 'news', url: 'https://www.healthnews.com.tw/' }], discover: { pattern: String.raw`^/article/\d+$` } },
  },
  // Issue #4 replacements (2026-09-29); the rss.app proxies these used are gone.
  elle: { list: { urls: [{ cat: 'news', url: 'https://www.elle.com/tw/sitemap_google_news.xml' }] } },
  hbr: {
    list: {
      urls: [{ cat: 'news', url: 'https://www.hbrtaiwan.com/sitemap/sitemap-articles.xml' }],
      include: String.raw`^/article/\d+`,
      articleId: String.raw`^/article/(\d+)`,
    },
    titleSuffix: String.raw`\s*\|\s*哈佛商業評論.*`,
  },
  // Pages carry no publish date: only newly linked homepage stories count.
  ngm: {
    list: {
      urls: [{ cat: 'news', url: 'https://www.natgeomedia.com/' }],
      discover: { pattern: String.raw`^/[a-z]+/article/content-\d+\.html$` },
    },
    titleSuffix: String.raw`\s*-\s*國家地理雜誌中文網`,
  },
  // Media the legacy site never tracked, added 2026-09-30 at the user's request.
  // 中視 publishes news as YouTube clips ("…│中視新聞 20260929"); the channel
  // feed also carries shows and live streams. Video keywords are channel-wide
  // boilerplate, so tags come from titles only.
  ctv: {
    group: 'news',
    list: {
      urls: [{ cat: 'news', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCO3bfz4KY6zGT5IOaFJuxpA' }],
      titleInclude: String.raw`^(?!.*(LIVE|直播)).*│中視新聞`,
    },
    titleSuffix: String.raw`\s*│\s*中視新聞.*`,
    article: { enabled: false, batch: 20, delayMs: 3000, skipMeta: true },
  },
  // English print edition, RSS 1.0 with day-level dates; page keywords are only the paper's name.
  taipeitimes: {
    group: 'hourly',
    list: { urls: [{ cat: 'news', url: 'https://www.taipeitimes.com/xml/index.rss' }] },
    article: { enabled: false, batch: 20, delayMs: 3000, skipMeta: true },
  },
  // 經濟日報: Google News sitemap covering every channel.
  udnmoney: {
    group: 'news',
    list: { urls: [{ cat: 'news', url: 'https://money.udn.com/sitemap/gnews/1001' }], articleId: String.raw`^/money/story/\d+/(\d+)` },
    titleSuffix: String.raw`\s*\|\s*經濟日報`,
    article: { enabled: false, batch: 20, delayMs: 3000 },
  },
  moneydj: {
    group: 'news',
    list: { urls: [{ cat: 'news', url: 'https://www.moneydj.com/kmdj/RssCenter.aspx' }] },
    titleSuffix: String.raw`\s*-\s*MoneyDJ理財網`,
    article: { enabled: true, batch: 20, delayMs: 3000 },
  },
  // news.ltn.com.tw/news/<section>/<breakingnews|paper>/<id>: a story is listed
  // under every section (politics, life, the city…). Other LTN hosts are unaffected.
  ltn: { list: { articleId: String.raw`^/news/[^/]+/((?:breakingnews|paper)/\d+)$` } },
  // 2026-10-01 audit. GNN tags are #hashtag links; the legacy Firefox 31 UA is dropped.
  gamer: { article: { userAgent: undefined, tagSelector: 'a[href*="search_tag.php"]' } },
  // 報導者 pages have no keyword meta; the post's tags are the first "tags" array in the page state.
  reporter: { article: { jsonTags: 'tags' } },
};
