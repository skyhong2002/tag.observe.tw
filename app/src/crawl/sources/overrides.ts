import type { SourceOverride } from '../sources.ts';
// Hand-ported adjustments for media whose legacy PHP relied on page-specific
// markers or whose feeds moved. Keep entries small and commented.
export const overrides: Record<string, SourceOverride> = {
  google_news: {
    group: 'hourly',
    discovery: 'google_news',
    list: { urls: [{ cat: 'news', url: 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant' }] },
    article: { enabled: false, batch: 0, delayMs: 0 },
  },
  dongtaiwang: {
    group: 'hourly',
    discovery: 'dongtaiwang',
    list: { urls: [{ cat: 'news', url: 'https://dongtaiwang.com/loc/phome.php?v=0' }] },
    article: { enabled: false, batch: 0, delayMs: 0 },
  },
  // gq.com.tw and cheers.com.tw sit behind Cloudflare JS challenges. Their
  // official LINE TODAY channels carry complete articles; every page must name
  // the outlet in LINE's provider meta. URLs and times are LINE TODAY's own.
  gq: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://today.line.me/tw/v3/publisher/100473',
        articlePattern: '^/tw/v3/article/[A-Za-z0-9]+$',
        provider: '^GQ$',
        maxArticles: 10,
      },
    },
    titleSuffix: String.raw`\s*\|\s*GQ\s*\|\s*LINE TODAY`,
    article: { enabled: true, provider: '^GQ$' },
  },
  cheers: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://today.line.me/tw/v3/publisher/100427',
        articlePattern: '^/tw/v3/article/[A-Za-z0-9]+$',
        provider: '^Cheers 快樂工作人$',
        maxArticles: 10,
      },
    },
    titleSuffix: String.raw`\s*\|\s*Cheers 快樂工作人\s*\|\s*LINE TODAY`,
    article: { enabled: true, provider: '^Cheers 快樂工作人$' },
  },
  // Restored archive publishers retain original publication dates.
  punchline: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://punchline.asia/',
        articlePattern: '^/archives/\\d+/?$',
        includeArchive: true,
        maxArticles: 12,
        feedUrls: ['https://punchline.asia/feed'],
      },
    },
    article: { enabled: true },
  },
  gv: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://zht.globalvoices.org/',
        articlePattern: '^/\\d{4}/\\d{2}/\\d{2}/\\d+/$',
        includeArchive: true,
        maxArticles: 12,
        feedUrls: ['https://zht.globalvoices.org/feed/'],
      },
    },
    article: { enabled: true },
  },
  dramaqueen: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://www.dramaqueen.com.tw/',
        articlePattern: '^/news/\\d{8}/\\d+\\.html$',
        includeArchive: true,
        maxArticles: 12,
      },
    },
    article: { enabled: true },
  },
  viewpointtaiwan: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'http://www.viewpointtaiwan.com/',
        feedUrls: ['http://www.viewpointtaiwan.com/feed/'],
        includeArchive: true,
        maxArticles: 12,
      },
    },
    article: { enabled: true },
  },
  nom: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://nommagazine.com/',
        includeArchive: true,
        maxArticles: 12,
        feedUrls: ['https://nommagazine.com/feed/'],
      },
    },
    article: { enabled: true },
  },
  pantravel: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://pantravel.life/',
        includeArchive: true,
        maxArticles: 12,
        feedUrls: ['https://pantravel.life/feed'],
      },
    },
    article: { enabled: true },
  },
  mplus: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://www.mplus.com.tw/', includeArchive: true, maxArticles: 12 } },
    article: { enabled: true },
  },
  // News stories (/tech/dt/n/) are member-only; the column index lists the
  // latest free /col/article pages, the homepage only links about three.
  digitimes: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://www.digitimes.com.tw/col/',
        articlePattern: '/col/article/\\?id=\\d+',
        includeArchive: true,
        maxArticles: 12,
      },
    },
    article: { enabled: true, authorSelector: '.author-caption h2 > span' },
  },
  bw: {
    group: 'hourly',
    list: {
      autoDiscover: {
        homeUrl: 'https://www.businessweekly.com.tw/Channel/business/0000000319',
        requestTimeoutMs: 15000,
        articlePattern: '^/[a-z]+/(?:blog|indep)/\\d+$',
        maxArticles: 12,
        transport: 'curl',
        includeArchive: true,
      },
    },
    article: { enabled: true },
  },
  // Restored 2026-10-03 from current publisher pages; each source passed
  // recent-publication and complete-body checks before scheduling.
  wyc: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://dq.yam.com/', maxArticles: 12, articlePattern: '^/post/\\d+$' } },
    article: { enabled: true },
  },
  daman: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://www.damanwoo.com/', maxArticles: 12, articlePattern: '^/node/\\d+$' } },
    article: { enabled: true },
  },
  babyou: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://babyou.me/', maxArticles: 12, feedUrls: ['https://babyou.me/feed'] } },
    article: { enabled: true },
  },
  techcrunch: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://techcrunch.com/', maxArticles: 12, feedUrls: ['https://techcrunch.com/feed/'] } },
    article: { enabled: true },
  },
  tsna: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://tsna.com/', maxArticles: 12, articlePattern: '^/article/\\d+$' } },
    article: { enabled: true },
  },
  musou: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://watchout.tw/', maxArticles: 12, articlePattern: '^/(?:reports|forum)/[a-zA-Z0-9]+$' } },
    article: { enabled: true },
  },
  hypesphere: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://hypesphere.com/', maxArticles: 12, feedUrls: ['https://hypesphere.com/feed/'] } },
    article: { enabled: true },
  },
  ldope: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://ldope.com/', maxArticles: 12, articlePattern: '^/news/' } },
    article: { enabled: true },
  },
  eventsinfocus: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://eventsinfocus.org/', maxArticles: 12, articlePattern: '^/news/\\d+$' } },
    article: { enabled: true },
  },
  voicettank: {
    group: 'hourly',
    list: { autoDiscover: { homeUrl: 'https://voicettank.org/', maxArticles: 12, feedUrls: ['https://voicettank.org/feed/'] } },
    article: { enabled: true },
  },
  asiatatler: {
    group: 'hourly',
    list: {
      autoDiscover: { homeUrl: 'https://www.tatlerasia.com/', maxArticles: 12, articlePattern: '^/(?!list/).*(?:zh-hant|zh-[^/]+-hant)$' },
    },
    article: { enabled: true },
  },
  adaymag: {
    group: 'hourly',
    list: {
      autoDiscover: { homeUrl: 'https://www.adaymag.com/', maxArticles: 12, articlePattern: '^/20\\d{2}/\\d{2}/\\d{2}/[^/]+\\.html$' },
    },
    article: { enabled: true },
  },
  // Direct Housefun endpoints currently return AWS WAF challenges. This
  // publisher-specific feed carries Housefun articles published by MyHousing;
  // retain the actual partner URL and require the article's own provider credit.
  housefun: {
    list: {
      urls: [{ cat: 'news', url: 'https://www.myhousing.com.tw/byline/%e5%a5%bd%e6%88%bf%e7%b6%b2news/feed/' }],
      include: '^/(?:n|p)/(?:[^/?]+/)*\\d+/$',
    },
    titleSuffix: ' | 住展雜誌',
    article: { enabled: true, provider: '^好房網News$' },
  },
  // The RSS contains only 150 stories; the publisher's own news sitemap
  // exposes 700 with publication dates. Externals are partner syndication.
  mirror: {
    list: {
      urls: [
        { cat: 'news', url: 'https://www.mirrormedia.mg/rss/posts-news.xml' },
        { cat: 'news', url: 'https://www.mirrormedia.mg/rss/rss.xml' },
      ],
      include: '^/story/[^/?]+/?$',
    },
  },
  // robots.txt advertises this current news sitemap; the legacy endpoint
  // lags behind. Keep it as a supplement for its longer publication window.
  storm: {
    list: {
      urls: [
        { cat: 'news', url: 'https://www.storm.mg/sitemaps/1/article-news-1.xml' },
        { cat: 'news', url: 'https://www.storm.mg/sitemap/news' },
      ],
      include: String.raw`^/(?:article|lifestyle)/\d+/?$`,
    },
  },
  // Public pages use outlet-specific body wrappers rather than <article>.
  bbc: { article: { enabled: true, bodySelector: 'main' } },
  nikkei: { article: { enabled: true, bodySelector: '#contentDiv .newsText' } },
  // Current official successor explicitly identifies its Taiwan Lihpao history.
  // The previous lihpao.com domain now serves unrelated English SEO content.
  lihpao: {
    list: { urls: [{ cat: 'news', url: 'https://www.limedia.tw/feed/' }] },
    article: { enabled: true },
  },
  // The publisher exposes full text in content:encoded on its official RSS.
  // Article pages challenge automated readers; summaries are never substituted.
  bccnews: {
    list: {
      autoDiscover: {
        homeUrl: 'https://bccnews.com.tw/',
        feedUrls: ['https://bccnews.com.tw/feed'],
        feedBody: 'full-text',
        maxArticles: 12,
      },
    },
    article: { enabled: true },
  },
  newsmarket: {
    list: {
      autoDiscover: {
        homeUrl: 'https://www.newsmarket.com.tw/',
        apiUrls: ['https://www.newsmarket.com.tw/wp-json/wp/v2/posts?per_page=12'],
        maxArticles: 12,
      },
    },
    article: { enabled: true },
  },
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
  womany: { titleSuffix: String.raw`\s*｜\s*女人迷\s*Womany`, article: { titleSelector: 'h1' } },
  cw: {
    list: { urls: [{ cat: 'news', url: 'https://www.cw.com.tw/' }], discover: { pattern: '^/article/\\d+' } },
    titleSuffix: String.raw`\s*｜\s*天下雜誌`,
  },
  // The news sitemap stopped updating at 2026-10-03 21:38 (+08) while the site
  // kept publishing; /realtime/ lists the latest ~24 stories. The sitemap stays
  // first so its dates and keywords apply whenever it moves again.
  ftv: {
    list: {
      urls: [
        { cat: 'news', url: 'https://www.ftvnews.com.tw/sitemap/sitemap.xml' },
        { cat: 'news', url: 'https://www.ftvnews.com.tw/realtime/' },
      ],
      discover: { pattern: '^/news/detail/[A-Za-z0-9]+$', titleSelector: 'h2.title' },
    },
  },
  bnext: {
    list: {
      urls: [
        { cat: 'news', url: 'https://www.bnext.com.tw/articles' },
        { cat: 'news', url: 'https://www.bnext.com.tw/' },
      ],
      discover: { pattern: '^/article/\\d+' },
    },
  },
  vogue: {
    list: { urls: [{ cat: 'news', url: 'https://www.vogue.com.tw/' }], discover: { pattern: '^/(article|galerie)/' } },
    // Related embeds repeat .byline links throughout the page; only the
    // headline's credit block identifies this article's reporting team.
    article: { authorSelector: '.content-header-text .byline__name-link, .content-header__accreditation .byline__name-link' },
  },
  // The homepage stopped listing new posts after 2026-10-02; the WordPress
  // feed (latest 20, dated) is current.
  eld: { list: { urls: [{ cat: 'news', url: 'https://www.roomie.tw/feed' }] } },
  oncc: {
    group: 'hourly',
    list: { urls: [{ cat: 'news', url: 'https://hk.on.cc/tw/news/index.html' }], discover: { pattern: '/bkn/cnt/news/\\d{8}/' } },
  },
  // Legacy parsed the HTML listing with '<item' markers; the site has a real feed.
  nius: { list: { urls: [{ cat: 'feed', url: 'https://www.niusnews.com/feed' }] } },
  // Restored sources (issue #4): feeds found via robots.txt on 2026-09-28.
  // /<section>/<id>: a story filed under two sections appears twice.
  tvbs: {
    list: { urls: [{ cat: 'news', url: 'https://news.tvbs.com.tw/sitemap/news-sitemap' }], articleId: String.raw`^/[a-z-]+/(\d+)$` },
    article: { bodySelector: '.article-editor-content', authorSelector: '[data-section="article-contributors"]' },
  },
  ctitv: {
    list: { urls: [{ cat: 'news', url: 'https://ctinews.com/rss/sitemap-news.xml' }] },
    titleSuffix: String.raw`\s*\|\s*中天新聞網`,
  },
  upmedia: {
    list: { urls: [{ cat: 'news', url: 'https://www.upmedia.mg/sitemapnews' }] },
    article: { bodySelector: '.news-box-text' },
  },
  epochtimes: { list: { urls: [{ cat: 'news', url: 'https://www.epochtimes.com/feed' }] } },
  udn: {
    // Weekly archive sitemaps give every article the same lastmod. The plain
    // sitemap cap kept returning the same 300 old stories. Google News maps
    // include actual publication dates, headlines and tags across all pages.
    list: {
      urls: [
        { cat: 'news', url: 'https://udn.com/sitemap/gnews/2' },
        { cat: 'magazine', url: 'https://udn.com/sitemap/gnews/1015' },
      ],
    },
    titleSuffix: String.raw`\s*\|\s*聯合新聞網`,
    // JSON-LD may put only the dateline in Person.name. Keep the full visible
    // byline, including agency credit when no reporter is named.
    article: { bodySelector: '.article-content__editor', authorSelector: '.article-content__author' },
  },
  // Second batch probed 2026-09-28 (sitemap indexes: newest 4 children followed).
  // The full sitemap also lists channels, magazine issues and account pages.
  commonhealth: {
    list: { urls: [{ cat: 'news', url: 'https://www.commonhealth.com.tw/sitemap.xml' }], include: String.raw`^/article/\d+$` },
    titleSuffix: String.raw`\s*-\s*康健雜誌`,
  },
  cti: { list: { urls: [{ cat: 'news', url: 'https://ctinews.com/rss/sitemap.xml' }] } },
  // RSS is gone (404) and the sitemap lists only static pages; the news and
  // column sections link recent /node/<id> articles (dated on the page). News
  // cards use an empty overlay link; discoverLinks reads the card's .title.
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
    article: { bodySelector: '.news-box-text' },
    titleSuffix: String.raw`\s*\|[^|]*-\s*太報 TaiSounds`,
  },
  // "<title> | 綜合 | 運動 | NOWnews今日新聞": up to three short section names.
  nownews: { titleSuffix: String.raw`(?:\s\|\s[^|]{1,12}){0,3}\s*\|\s*NOWnews今日新聞` },
  pts: {
    titleSuffix: String.raw`\s*[|｜]\s*公視新聞網 PNN`,
    article: { authorSelector: '.article_authors .reporter-container a[href*="/author/"]' },
  },
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
  // The news index became a curated set that stopped showing new stories
  // (2026-10-04: newest linked 167613 while 167675 was out); section lists
  // load by XHR. The news sitemap has no dates but lists newest first.
  '1111': {
    list: {
      urls: [{ cat: 'news', url: 'https://www.1111.com.tw/news/sitemap.xml' }],
      include: String.raw`^/news/jobns/\d+$`,
      sitemapHead: 40,
    },
    // The story sits in loose <div>s inside the yellow panel, after the
    // headline, dateline and photo; topic buttons follow it.
    article: {
      bodySelector: '.yellow-white-bg',
      bodyExcludeSelector: 'h1, time, center, a.btn',
      authorSelector: '.yellow-white-bg > time',
    },
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
  // The RSS froze at 2026-09-23 (and often times out) while the site publishes
  // daily; the homepage links ~50 recent /Article/<category>/<id> stories.
  top1health: {
    list: { urls: [{ cat: 'news', url: 'https://www.top1health.com/' }], discover: { pattern: String.raw`^/Article/\d+/\d+$` } },
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
    article: {
      enabled: true,
      batch: 20,
      delayMs: 3000,
      skipMeta: true,
      bodySelector: '#left_blake .archives',
      authorSelector: '#left_blake .name',
    },
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
  ltn: {
    list: { articleId: String.raw`^/news/[^/]+/((?:breakingnews|paper)/\d+)$` },
    // iStyle lacks articleBody and has malformed structured URL identities.
    article: {
      bodySelector: '.content940 .text',
      // Current news pages put the reporter above the body; iStyle retains
      // its older .auther field. Both are article credits, not image captions.
      authorSelector: '.article_meta .article_edit, .content940 .time .auther',
    },
  },
  // 2026-10-01 audit. GNN tags are #hashtag links; the legacy Firefox 31 UA is dropped.
  gamer: { article: { userAgent: undefined, tagSelector: 'a[href*="search_tag.php"]' } },
  // 報導者 pages have no keyword meta; the post's tags are the first "tags" array in the page state.
  reporter: { article: { jsonTags: 'tags', authorSelector: 'a[href^="/authors/"]' } },
  // Verified public-page body containers, 2026-10-03 similarity audit.
  ftnn: { article: { bodySelector: '.news-body' } },
  rti: { article: { bodySelector: '.text.ivu-mt', authorSelector: 'a[href*="newsauthorlist"]' } },
  // Verified visible credits absent from NewsArticle.author, 2026-10-06.
  cmmedia: { article: { authorSelector: '.article_author-bar .article_author a.author' } },
  i_media: { article: { authorSelector: '.entry__meta-author a[href*="Author="]' } },
  ithome: { article: { authorSelector: '.submitted .author a[href^="/users/"]' } },
  coolloud: { article: { authorSelector: '.group-author .field-name-field-author a' } },
  // The new Newtalk template wraps figure captions and recommendations in
  // <article>; its own text container preserves the opening agency dispatch.
  newtalk: { article: { bodySelector: '#newtalk-news-view-content' } },
  // Elementor also emits <article> cards for related stories on this page.
  watchmedia01: { article: { bodySelector: '.elementor-widget-theme-post-content' } },
  // 2026-10-03 traffic coverage: latest lists, with dates and tags from articles.
  mirrordaily: {
    group: 'news',
    list: {
      urls: [{ cat: 'news', url: 'https://www.mirrordaily.news/section/latest' }],
      discover: { pattern: String.raw`^/story/\d+$`, titleSelector: 'figcaption' },
    },
    titleSuffix: String.raw`\s*-\s*鏡報`,
    article: { enabled: true, batch: 40, delayMs: 3000 },
  },
  mnews: {
    group: 'news',
    list: {
      urls: ['pol', 'int', 'fin', 'soc', 'lif', 'sport', 'ent', 'local'].map((cat) => ({
        cat,
        url: `https://www.mnews.tw/category/${cat}`,
      })),
      // mm-/md- are partner copies; static /story/privacy etc. are not articles.
      discover: { pattern: String.raw`^/story/\d{8}[a-z]+\d+$`, titleSelector: '[class*="title" i]' },
    },
    // JSON-LD names only the first reporter; repeated author metas include
    // the complete reporting team.
    article: { enabled: true, batch: 40, delayMs: 3000, authorSelector: 'meta[name="author"]' },
  },
  knews: {
    group: 'news',
    list: {
      urls: [{ cat: 'news', url: 'https://www.knews.com.tw/realtime/latest' }],
      discover: { pattern: '^/news/[A-F0-9]{32}$', titleSelector: '.title' },
    },
    titleSuffix: String.raw`\s*｜\s*知新聞`,
    article: { enabled: true, batch: 40, delayMs: 3000 },
  },
};
