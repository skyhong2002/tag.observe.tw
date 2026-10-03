import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { extractArticle, parsePublished } from './article.ts';
import { discoverNews } from './news-discovery.ts';
import { newsSiteEvidence, newsSiteRules } from './news-site-rules.ts';

const body = '地方政府公布交通改善計畫，將增加公車班次，並公開工程預算與施工進度，邀請居民參與討論。'.repeat(7);
const paragraph = `<p>${body}</p>`;
const title = '<meta property="og:title" content="地方新聞測試標題">';

// Reduced markup from real article responses fetched on 2026-10-03. Preserve
// the observed wrappers, date labels and neighboring widgets; replace prose
// with synthetic text so fixtures do not redistribute publishers' articles.
const fixtures = [
  {
    url: 'https://www.pinview.com.tw/News/63344.html',
    html: `<div class="article"><div class="article-title"><h1>地方新聞測試標題</h1><span>2026/10/02 14:25:04</span></div><div id="contentText">${paragraph}</div></div>`,
    published: '2026-10-02T06:25:04.000Z',
  },
  {
    url: 'https://www.mdnkids.com/content.asp?Link_String_=24A300000VTNXSO',
    html: `<div class="page_main_box"><div class="col col-md-12"><div class="row"><h2>地方新聞測試標題</h2><div class="col col-md-12"><span>記者／綜合報導<br>(2026/10/3)</span></div></div><div>${paragraph}</div></div></div>`,
    published: '2026-10-02T16:00:00.000Z',
  },
  {
    url: 'https://i-media.tw/Article/Detail/51155',
    html: `<article class="entry"><h1>地方新聞測試標題</h1><div class="entry__meta-holder"><ul><li class="entry__meta-date">2026-10-02 18:09</li></ul></div><div id="articleContent">${paragraph}<li class="entry__meta-date">更新時間：2026/10/02 18:12</li></div></article><aside><li class="entry__meta-date">2026-10-03 18:06</li></aside>`,
    published: '2026-10-02T10:09:00.000Z',
  },
  {
    url: 'https://www.tcnews.com.tw/culture/item/30821.html',
    html: `<article class="single-post"><div class="meta-data"><span class="event-date">2026/10/03 10:43 (10/03 15:42更新)</span></div><div class="post-content">${paragraph}</div></article>`,
    published: '2026-10-03T02:43:00.000Z',
  },
  {
    url: 'https://www.kingtop.com.tw/detail.php?type=lastest&id=54377',
    html: `<div class="post-title-wrapper"><h1>地方新聞測試標題</h1><div class="post-metas"><ul><li><i class="icon-calendar"></i>2026年十月03日</li></ul></div></div><article class="post-details"><div class="single-blog-wrapper"><p></p><div>${body}</div><p></p></div></article>`,
    published: '2026-10-02T16:00:00.000Z',
  },
  {
    url: 'https://greatnews.com.tw/news_pagein.php?iType=1003&n_id=315472',
    html: `<div id="news_are"><div class="newsin_title">地方新聞測試標題</div><div class="newsin_text"><div class="newsin_date">2026-10-02</div>${paragraph}</div></div>`,
    published: '2026-10-01T16:00:00.000Z',
  },
  {
    url: 'https://www.kamalan-news.com/social/46/19146',
    html: `<div class="post-full"><div class="entry-main"><div class="in-date-tag"><div class="post-meta-date"><i></i>2026年10月02日  14:22</div></div><div class="entry-content">${paragraph}</div></div></div>`,
    published: '2026-10-02T06:22:00.000Z',
  },
  {
    url: 'https://www.bo6s.com.tw/news_detail.php?NewsID=117213',
    html: `<article><div class="news-header"><h1>地方新聞測試標題</h1><time datetime="2026-10-03T18:22:00">2026-10-03 18:22</time><div class="news-content">${paragraph}</div></div></article>`,
    published: '2026-10-03T10:22:00.000Z',
  },
  {
    url: 'https://news.st-media.com.tw/news/63252',
    html: `<div class="top-info"><div><span class="date mr-4">2026.10.03</span></div></div><div class="page-content"><div class="row"><div class="column">${paragraph}</div></div></div>`,
    published: '2026-10-02T16:00:00.000Z',
  },
  {
    url: 'https://cdn-news.org/News.aspx?EntityID=News&PK=00000000a49ac9e3',
    html: `<div class="news-details-layout2"><div class="mask-content-lg"><ul class="post-info-light"><li>記者</li><li><a>2026/10/03 16:25</a></li></ul></div><div class="col-xl-8"><div class="item-box-light-lg">${paragraph}<div class="ai-article" style="display:none">隱藏摘要</div></div></div></div>`,
    published: '2026-10-03T08:25:00.000Z',
  },
  {
    url: 'https://www.merit-times.com.tw/NewsPage.aspx?unid=943622',
    html: `<header><span class="Westdate">2026年10月3日</span></header><article><div class="writerInfo"><span class="posTime">2026.10.01</span></div><div id="article_content"><div class="articleBox">${paragraph}</div></div></article>`,
    published: '2026-09-30T16:00:00.000Z',
  },
  {
    url: 'https://www.fountmedia.io/article/430754',
    html: `<div class="newsWrapDetail"><div class="detitle2"><div class="cell small-4"><div>2026.10.03</div></div></div><div id="div1" class="content">${paragraph}</div></div>`,
    published: '2026-10-02T16:00:00.000Z',
  },
  {
    url: 'https://www.matsu-news.gov.tw/news/article/244929',
    html: `<div class="single-post"><div class="topic"><h3>地方新聞測試標題</h3><ul class="post-tools"><li>2026-10-03</li></ul></div><div class="post-text news-page">${paragraph}</div></div>`,
    published: '2026-10-02T16:00:00.000Z',
  },
  {
    url: 'https://www.zmedia.com.tw/Document/NewsDetail/44464',
    html: `<section class="newsDetail"><div class="article-group"><div class="info-group"><p class="date">2026/10/01 | 記者 綜合報導</p></div><div class="ckeditor-group">${paragraph}</div></div></section>`,
    published: '2026-09-30T16:00:00.000Z',
  },
  {
    url: 'https://my-formosa.com.tw/DOC_229633.htm',
    html: `<div class="blog-page"><h1>地方新聞測試標題</h1><div class="details"><small class="date">2026-10-02</small></div><div class="Bigcontent">${body}<br><br></div></div>`,
    published: '2026-10-01T16:00:00.000Z',
  },
  {
    url: 'https://www.ntdtv.com.tw/b5/20261002/video/411495.html',
    html: `<div id="article_box"><h1>地方新聞測試標題</h1><div class="article_info">更新時間：2026-10-03 13:33:55</div><div id="article_content"><p>【新唐人亞太台 2026 年 10 月 02 日訊】${body}</p></div></div>`,
    published: '2026-10-01T16:00:00.000Z',
  },
  {
    url: 'https://news.cctv.com/2026/10/02/ARTIg5zpNGB2PXGoc9g5vO5Z261002.shtml',
    html: `<div class="content_19568"><div class="title_area"><div class="info"><span>2026年10月02日 19:46</span></div></div><div id="text_area" class="text_area">${paragraph}</div></div>`,
    published: '2026-10-02T11:46:00.000Z',
  },
  {
    url: 'http://politics.people.com.cn/n1/2026/1003/c461001-40808997.html',
    html: `<div class="rm_txt"><b id="newstime">2026年10月03日05:36</b><div id="rm_txt_zw">${paragraph}</div></div>`,
    published: '2026-10-02T21:36:00.000Z',
  },
  {
    url: 'https://nvns.net/news_view.php?new_sn=144955&new_csn=1467',
    html: `<div class="page-left"><div class="view-heading"><span class="title">地方新聞測試標題</span></div><div class="page-headline-flex"><div class="date-time"><span class="title">2026-10-03 17:49:09</span></div></div><div class="editor">${paragraph}</div></div>`,
    published: '2026-10-03T09:49:09.000Z',
  },
  {
    url: 'https://lai-media.net/news_view.php?new_sn=144958&new_csn=3104',
    html: `<div class="page-left"><div class="headingbar_pageview"><h1>地方新聞測試標題</h1><div class="info_view_date"><span class="info-text">2026-10-03 18:28:00</span></div></div><div class="editor">${paragraph}</div></div>`,
    published: '2026-10-03T10:28:00.000Z',
  },
  {
    url: 'https://www.iw-times.com/news_view.php?new_sn=144912&new_csn=3352',
    html: `<div class="page-left"><div class="headingbar_pageview"><h1>地方新聞測試標題</h1><div class="info_view_date"><span class="info-text">2026-10-03 12:13:00</span></div></div><div class="editor">${paragraph}</div></div>`,
    published: '2026-10-03T04:13:00.000Z',
  },
  {
    url: 'https://news.homeplus.net.tw/single/332787',
    html: `<article class="main-article"><header><h1>地方新聞測試標題</h1><ul class="details"><li>06-10-2026</li><li>生活</li></ul></header><div class="news-content">${paragraph}</div></article>`,
    published: '2026-10-05T16:00:00.000Z',
  },
  {
    url: 'https://www.chengpou.com.mo/dailynews/263092.html',
    html: `<div id="daily-news-title-container"><div><p class="daily-news-date">2026-10-02</p></div></div><div id="daily-news-content">${paragraph}</div>`,
    published: '2026-10-01T16:00:00.000Z',
  },
  {
    url: 'http://matsu.idv.tw/topicdetail.php?f=1&t=344504',
    html: `<div class="table detail"><div class="row rowTitle">張貼者</div><div class="row"><div class="col forumlist"><a name="1"></a><span><p class="smalltext">發表時間 : 2026-10-03 16:30:44<br>FORM: Logged</p></span></div><div class="col"><span class="articleTitlte">地方新聞測試標題</span><span class="threadtext">${body}</span></div></div></div>`,
    published: '2026-10-03T08:30:44.000Z',
  },
  {
    url: 'https://www.taiwanus.net/news/press/2026/202610021038091660.htm',
    html: `<p align="right"><font size="2">[Taiwanus]於2026-10-02 10:38:09上傳</font></p><table><tr><td id="showxyz"><div>${body}</div></td></tr></table>`,
    published: '2026-10-02T02:38:09.000Z',
  },
  {
    url: 'http://www.news.cn/sci-tech/20260922/a5b3411743f44f368b657f669cc6d38a/c.html',
    html: `<div class="mheader"><div class="info">2026-09-22 10:21:56<span>來源：新聞編輯室</span></div></div><div id="detail"><span id="detailContent">${paragraph}</span></div>`,
    published: '2026-09-22T02:21:56.000Z',
  },
  {
    url: 'https://www.biao-news.com/news_view.php?new_sn=144926&new_csn=2713',
    html: `<h1 class="heading_view">地方新聞測試標題</h1><div class="itembox-left"><div class="info info_view_date">2026-10-03</div></div><div class="itembox_intro editor">${paragraph}</div>`,
    published: '2026-10-02T16:00:00.000Z',
  },
];

describe('verified news site article templates', () => {
  it('uses the simplified NTD Beijing publication clock through discovery and ignores later modification time', async () => {
    const url = 'https://www.ntdtv.com/gb/2026/10/03/a104138561.html';
    const html = `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-10-03T10:35:43Z","dateModified":"2026-10-03T13:06:40Z"}</script><link rel="canonical" href="${url}"><div class="article_title"><h1>朝鲜向东海发射弹道导弹</h1></div><div class="article_info"><span class="time">北京时间：2026-10-03 10:35</span></div><div class="article_content">${paragraph}</div>`;
    const result = await discoverNews(
      { homeUrl: 'https://www.ntdtv.com/', articleUrls: [url], includeArchive: true, maxArticles: 1 },
      {
        now: () => new Date('2026-10-03T12:00:00Z'),
        fetch: async () => ({ url, body: html, status: 200, contentType: 'text/html', ms: 1 }),
      },
    );
    expect(result.errors).toEqual([]);
    expect(result.samples).toEqual([
      expect.objectContaining({ url, title: '朝鲜向东海发射弹道导弹', publishedAt: '2026-10-03T02:35:00.000Z' }),
    ]);
    expect(extractArticle(html, url).publishedAt?.toISOString()).toBe('2026-10-03T02:35:00.000Z');
    expect(newsSiteEvidence(cheerio.load(html.replace('北京时间', '更新时间')), url).publishedRaw).toBeNull();
  });
  it('prefers explicitly zoned NTDTV article header over its incorrectly Z-suffixed JSON-LD', () => {
    const html = `${title}<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-10-03T18:53:57Z"}</script><div class="article_title"><h1>地方新聞測試標題</h1></div><div class="article_info"><div class="time">北京時間：2026-10-03 18:53</div></div><div class="article_content">${paragraph}</div>`;
    const url = 'https://www.ntdtv.com/b5/2026/10/03/a104138636.html';
    expect(extractArticle(html, url).publishedAt?.toISOString()).toBe('2026-10-03T10:53:00.000Z');
    expect(newsSiteEvidence(cheerio.load(html), url).preferPrintedPublication).toBe(true);
    expect(extractArticle(html, url.replace('ntdtv.com', 'other.example')).publishedAt?.toISOString()).toBe('2026-10-03T18:53:57.000Z');
    expect(extractArticle(html.replace('北京時間：2026-10-03 18:53', '更新時間：2026-10-03 18:53'), url).publishedAt?.toISOString()).toBe(
      '2026-10-03T18:53:57.000Z',
    );
  });
  it('extracts Yam and TaipeiPost only from their main article containers', () => {
    for (const [url, html] of [
      ['https://n.yam.com/Article/20251003889446', `<section class="inner-page"><div class="inner-content">${paragraph}</div></section>`],
      [
        'https://taipeipost.org/396136/',
        `<main><div class="elementor-widget-text-editor"><div class="elementor-widget-container">${paragraph}</div></div></main>`,
      ],
    ]) {
      const article = extractArticle(`${title}<meta property="article:published_time" content="2026-09-28T09:21:00+08:00">${html}`, url);
      expect(article.body, url).toBe(body);
      expect(article.publishedAt?.toISOString(), url).toBe('2026-09-28T01:21:00.000Z');
    }
  });

  it('never substitutes forum replies or recruitment posts for a short news post', () => {
    const fixture = fixtures.find((entry) => entry.url.includes('matsu.idv.tw'))!;
    const short = fixture.html.replace(body, '只有轉載連結');
    const reply = `<div class="row"><div class="col forumlist"><a name="2"></a><p class="smalltext">發表時間 : 2026-10-04 16:30:44</p></div><div class="col"><span class="threadtext">${body}</span></div></div>`;
    const html = title + short.replace(/<\/div>$/, `${reply}</div>`);
    const article = extractArticle(html, fixture.url);
    expect(article.bodyStatus).toBe('short');
    expect(article.body).toBe('只有轉載連結');
    expect(article.publishedAt?.toISOString()).toBe(fixture.published);
    expect(newsSiteRules(fixture.url.replace('f=1&', 'f=95&'))).toBeUndefined();
  });

  it('honors an explicit Hong Kong timezone in newspaper publication metadata', () => {
    expect(parsePublished('Sat Oct 03 07:23:11 HKT 2026')?.toISOString()).toBe('2026-10-02T23:23:11.000Z');
    expect(parsePublished('2026-10-03T07:23:11Z')?.toISOString()).toBe('2026-10-03T07:23:11.000Z');
  });

  it('decodes Huanqiu article HTML and uses its publication epoch rather than recommendation clocks', () => {
    const html = `<div class="data-container"><article><textarea class="article-title">地方新聞測試標題</textarea><textarea class="article-content">&lt;article&gt;${paragraph.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}&lt;aside&gt;推薦閱讀&lt;/aside&gt;&lt;/article&gt;</textarea><textarea class="article-time">1790986736177</textarea><textarea class="article-ext-xtime">1790999999999</textarea></article></div><aside><textarea class="item-time">1790999999999</textarea></aside>`;
    const url = 'https://sports.huanqiu.com/article/4TSO7327GjX';
    const article = extractArticle(html, url);
    expect(article.body).toBe(body);
    expect(article.bodyStatus).toBe('ok');
    expect(article.publishedAt?.toISOString()).toBe('2026-10-03T00:18:56.177Z');
    expect(newsSiteEvidence(cheerio.load(html.replace('1790986736177', 'not-a-timestamp')), url).publishedRaw).toBeNull();
  });

  it('extracts 163 main body while excluding recommendation prose', () => {
    const html = `${title}<meta property="article:published_time" content="2026-09-30T16:33:16+08:00"><div id="content" class="post_content"><div class="post_body">${paragraph}</div><ul class="post_recommends_list"><li><p>推薦文章</p></li></ul></div>`;
    const article = extractArticle(html, 'https://www.163.com/news/article/L83BH1KR000181BR.html');
    expect(article.body).toBe(body);
    expect(article.publishedAt?.toISOString()).toBe('2026-09-30T08:33:16.000Z');
  });

  it.each(fixtures)('extracts the main article and printed publication at $url', ({ url, html, published }) => {
    const article = extractArticle(title + html, url);
    expect(article.bodyStatus).toBe('ok');
    expect(article.body).toContain(body);
    expect(article.title).toBe('地方新聞測試標題');
    expect(article.publishedAt?.toISOString()).toBe(published);
    expect(newsSiteEvidence(cheerio.load(title + html), url).isArticle).toBe(true);
  });

  it('reads body-only site rules while leaving dates to existing semantic metadata', () => {
    for (const [url, html] of [
      [
        'https://news.taiwannet.com.tw/news/222118/example.html',
        `<div class="news-detail-box"><div class="news-date-txt-box">${paragraph}</div></div>`,
      ],
      [
        'https://sunmedia.tw/news/technology/1790982973-example',
        `<div class="article-page-content"><div class="has-banner"><div class="article-description-box">${paragraph}</div></div></div>`,
      ],
      [
        'https://www.idn.com.tw/news/news_content.aspx?artid=20261001hsieh009',
        `<table><tr><td class="headnewsd">地方新聞測試標題</td></tr><tr><td class="newsa">${body}<br></td></tr></table>`,
      ],
    ]) {
      const article = extractArticle(title + html, url);
      expect(article.bodyStatus, url).toBe('ok');
      expect(article.body, url).toContain(body);
      expect(article.publishedAt, url).toBeNull();
    }
  });

  it('does not use the same classes on another host or on a listing page', () => {
    const html = cheerio.load(title + fixtures[5].html);
    expect(newsSiteEvidence(html, 'https://other.example/news_pagein.php?n_id=315472').publishedRaw).toBeNull();
    expect(newsSiteEvidence(html, 'https://greatnews.com.tw/').publishedRaw).toBeNull();
    expect(newsSiteRules('https://greatnews.com.tw.evil.example/news_pagein.php?n_id=1')).toBeUndefined();
  });

  it('rejects site clocks, recommendation dates, update-only labels and impossible dates', () => {
    const url = fixtures[2].url;
    for (const printed of ['更新時間：2026/10/03 18:12', '2026-02-31 12:00', '尚無時間']) {
      const html = `${title}<div class="current-date">2026-10-03</div><article class="entry"><h1>地方新聞測試標題</h1><div class="entry__meta-holder"><span class="entry__meta-date">${printed}</span></div><div id="articleContent">${paragraph}</div></article><aside><span class="entry__meta-date">2026-10-03 18:06</span></aside>`;
      expect(newsSiteEvidence(cheerio.load(html), url).publishedRaw, printed).toBeNull();
    }
  });

  it('requires the main body and never derives publication from URL dates', () => {
    const html = cheerio.load(`${title}<div class="article_info">更新時間：2026-10-03 13:33:55</div>`);
    expect(newsSiteEvidence(html, fixtures[15].url)).toEqual({ title: null, publishedRaw: null, isArticle: false });
  });

  it('keeps short article bodies below the existing acceptance threshold', () => {
    const article = extractArticle(title + fixtures[5].html.replace(body, '短篇摘要'), fixtures[5].url);
    expect(article.bodyStatus).toBe('short');
  });
});
