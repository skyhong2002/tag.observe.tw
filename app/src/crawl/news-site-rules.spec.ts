import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { extractArticle, parsePublished } from './article.ts';
import { discoverNews } from './news-discovery.ts';
import { newsSiteEvidence, newsSiteRules } from './news-site-rules.ts';
import { sourceByMedia } from './registry.ts';

it('reads Ifeng content provider only from the selected article source credit', () => {
  const html =
    '<aside><a rel="medianame">推荐媒体</a></aside><article><h1>新闻标题</h1><div class="index_sourceTitleText_hash"><a rel="medianame">新华社</a></div><div class="index_articleBox_hash"><div class="index_text_hash"><p>这是新闻内容。</p></div></div></article>';
  expect(extractArticle(html, 'https://news.ifeng.com/c/8x2H6OhjklO')).toMatchObject({
    title: '新闻标题',
    provider: '新华社',
    body: '这是新闻内容。',
  });
});

it('uses Meihua article h1 independently from its author-prefixed metadata title', () => {
  const html =
    '<meta property="og:title" content="金價波動 |梅花新聞網 陳素貞/綜合報導| 梅花新聞網"><article class="entry"><h1>金價波動</h1><div id="articleContent"><p>完整文章內容。</p></div></article>';
  expect(extractArticle(html, 'https://www.i-meihua.com/Article/Detail/57258').title).toBe('金價波動');
});

const body = '地方政府公布交通改善計畫，將增加公車班次，並公開工程預算與施工進度，邀請居民參與討論。'.repeat(7);
const paragraph = `<p>${body}</p>`;
const title = '<meta property="og:title" content="地方新聞測試標題">';
it('reads ST Media reporter only from the main article header, not photos or recommendations', () => {
  const article = `<main class="main"><div class="content min-h"><div class="top-info"><div><span class="date">2026.10.07</span><span class="author">記者 范宏坤 報導</span></div></div><div class="row">${paragraph}<div>照片／王小明攝</div></div></div></main>`;
  const sidebar = '<aside><div class="top-info"><div><span class="author">記者 王小明 報導</span></div></div></aside>';
  const url = 'https://news.st-media.com.tw/news/63204';
  expect(extractArticle(article + sidebar, url).authors).toEqual(['范宏坤']);
  expect(extractArticle(article.replace('記者 范宏坤 報導', '攝影 范宏坤'), url).authors).toEqual([]);
  expect(extractArticle(article.replace('class="top-info"', 'class="other"') + sidebar, url).authors).toEqual([]);
  expect(extractArticle(article + sidebar, 'https://example.org/story').authors).toEqual([]);
});
it('reads the Youth Daily declared release time only from its main article', () => {
  const url = 'https://www.ydn.com.tw/tw/News/ugC_News_Detail.aspx?ID=647354';
  const html = `<aside><span id="ContentPlaceHolder1_domReleaseDate">2026/10/09 09:00</span></aside><article class="PageArticle"><div class="date"><span>發佈日期:</span><span id="ContentPlaceHolder1_domReleaseDate">2026/10/08 02:00</span></div><div id="ContentPlaceHolder1_div_Desc">${paragraph}</div></article>`;
  expect(extractArticle(html, url).publishedAt?.toISOString()).toBe('2026-10-07T18:00:00.000Z');
  expect(extractArticle(html, url).body).toBe(body);
  expect(extractArticle(html.replace('class="PageArticle"', ''), url).publishedAt).toBeNull();
  expect(extractArticle(html, 'https://example.org/story').publishedAt).toBeNull();
});

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
    url: 'http://finance.people.com.cn/n1/2026/1004/c1004-40809312.html',
    html: `<div class="layout rm_txt cf"><div class="col col-1 fl"><h1>地方新聞測試標題</h1><div class="channel cf"><div class="col-1-1 fl"><b id="newstime">2026年10月04日08:23</b> | 来源：经济日报</div></div><div class="rm_txt_con cf"><div id="rm_txt_zw">${paragraph}</div></div></div></div>`,
    published: '2026-10-04T00:23:00.000Z',
  },
  {
    url: 'http://theory.people.com.cn/n1/2026/1004/c40531-40809300.html',
    html: `<div class="text_con text_con01 rm_txt"><div class="text_c col-1"><h1>地方新聞測試標題</h1><p class="sou"><b id="newstime">2026年10月04日08:16</b>&nbsp;来源：经济日报</p><div class="show_text" id="rm_txt_zw">${paragraph}</div></div></div>`,
    published: '2026-10-04T00:16:00.000Z',
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
  {
    url: 'https://factcheck.afp.com/doc.afp.com.C8EL4NQ',
    html: `<article><li class="date-full-format" data-type="created" data-utc-time="1790272347">Published on September 24, 2026 at 19:52</li><li class="date-full-format" data-type="updated" data-utc-time="1790975952">Updated</li><div class="wrapper-body">${paragraph}</div><div class="date-short-format" data-utc-time="1790975952">Related article</div></article>`,
    published: '2026-09-24T17:52:27.000Z',
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

it('extracts AP report text without related services or gallery page furniture', () => {
  const url = 'https://www.ap.org/news-highlights/elections/2026/example-report/';
  const article = extractArticle(
    `${title}<article><section class="entry-content"><div class="content-container__inner">${paragraph}</div><aside>Explore related services ${'advertisement '.repeat(30)}</aside></section></article>`,
    url,
  );
  expect(article.body).toBe(body);
  expect(article.body).not.toContain('Explore related services');
});

describe('TaiSounds special-topic articles', () => {
  it('keeps direct text and nested paragraphs without the heading, clock or linked stories', () => {
    const html = `<title>作者姓名 混入列表標題 - 太報 TaiSounds</title><script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2023-12-07T07:20:00+08:00","author":{"name":"洪敏隆"}}</script><div class="container"><div class="special-text2"><h3>專題文章標題</h3><div class="publish">2023-12-07 07:20</div>首段直接文字。<br><br>${paragraph}<subh3>內文章節標題</subh3><br>末段直接文字。</div></div><div class="special-list"><h3>無關推薦標題</h3><p>無關推薦內容</p></div>`;
    const result = extractArticle(html, 'https://www.taisounds.com/specialtopic/content/101/95022', sourceByMedia('taisounds')?.article);
    expect(result.title).toBe('專題文章標題');
    expect(result.body).toContain('首段直接文字。');
    expect(result.body).toContain(body);
    expect(result.body).toContain('內文章節標題');
    expect(result.body).toContain('末段直接文字。');
    expect(result.body).not.toMatch(/專題文章標題|2023-12-07 07:20|無關推薦/);
    expect(result.authors).toEqual(['洪敏隆']);
    expect(result.publishedAt?.toISOString()).toBe('2023-12-06T23:20:00.000Z');
  });

  it('leaves ordinary news and topic landing pages outside the reviewed path', () => {
    for (const path of ['/news/content/101/95022', '/special/topic/101']) {
      const result = extractArticle(`<div class="special-text2"><h3>推薦標題</h3>${paragraph}</div>`, `https://www.taisounds.com${path}`);
      expect(result.bodySource).not.toBe('selector');
    }
  });
});

it('takes AP reporting credits ahead of the publishing account and removes only the declared organization suffix', () => {
  const html = `<meta name="author" content="Dominic Hurry"><article><div class="content-container__inner">${paragraph}</div><div class="post-meta"><p class="author">By Kaitlyn Humani and Barbara Ortutay, The Associated Press</p></div></article>`;
  expect(extractArticle(html, 'https://www.ap.org/news-highlights/spotlights/2026/ai-safety/').authors).toEqual([
    'Kaitlyn Humani',
    'Barbara Ortutay',
  ]);
  expect(
    extractArticle(
      html.replace(
        'Kaitlyn Humani and Barbara Ortutay, The Associated Press',
        'Linley Sanders, Sarah Jane Tribble, Ali Swenson and Fatima Hussein Associated Press and KFF Health News',
      ),
      'https://www.ap.org/news-highlights/spotlights/2026/poll/',
    ).authors,
  ).toEqual(['Linley Sanders', 'Sarah Jane Tribble', 'Ali Swenson', 'Fatima Hussein']);
});

it('separates a Babyou comprehensive-report role from the visible writer name', () => {
  const html = `<meta name="author" content="周昭安 綜合報導"><span class="elementor-post-info__item--type-author">周昭安 綜合報導</span><article>${paragraph}</article>`;
  const rules = sourceByMedia('babyou')?.article;
  expect(extractArticle(html, 'https://babyou.me/example', rules).authors).toEqual(['周昭安']);
  expect(extractArticle(html.replaceAll('周昭安 綜合報導', '姊妹淘編輯部'), 'https://babyou.me/example', rules).authors).toEqual([
    '姊妹淘編輯部',
  ]);
});

it('reads DW agency credits only from the selected article header', () => {
  const html = `<aside><span class="extra-info">路透社</span></aside><article><div class="content-area"><header><h1>新聞標題</h1><div class="author-details"><a rel="author">德正</a><span class="extra-info">德新社、法新社、美聯社</span></div></header>${paragraph}</div></article>`;
  expect(extractArticle(html, 'https://www.dw.com/zh-hant/story/a-79578715')).toMatchObject({
    provider: '德新社、法新社、美聯社',
    authors: ['德正'],
  });
  expect(extractArticle(html, 'https://www.dw.com/zh-hant/person-71098430').provider).toBeNull();
});

it('excludes only reviewed DW house promotion and license paragraphs from the news body', () => {
  const html = `<article><div class="content-area"><header><h1>新聞標題</h1></header><div class="rich-text">${paragraph}<p>受訪者在Instagram討論著作權與新聞工作。</p><p>DW中文有Instagram！歡迎搜尋dw.chinese，看更多深入淺出的圖文與影音報導。</p><p>© 2026年德國之聲版權聲明：本文所有內容受到著作權法保護，如無特別授權不得使用。</p></div></div></article>`;
  const result = extractArticle(html, 'https://www.dw.com/zh-hant/story/a-79578715');
  expect(result.body).toContain(body);
  expect(result.body).toContain('受訪者在Instagram討論著作權與新聞工作。');
  expect(result.body).not.toMatch(/DW中文有Instagram|德國之聲版權聲明/);
});

it('keeps a DW extra reporter name out of the agency-provider field', () => {
  const html = `<article><div class="content-area"><header><div class="author-details"><span class="extra-info">Felix Tamsut, 法新社、路透社</span></div></header>${paragraph}</div></article>`;
  expect(extractArticle(html, 'https://www.dw.com/zh-hant/story/a-79578715').provider).toBe('法新社、路透社');
  expect(
    extractArticle(html.replace('Felix Tamsut, 法新社、路透社', 'Collective Writer'), 'https://www.dw.com/zh-hant/story/a-79578715')
      .provider,
  ).toBeNull();
});

it('reads Blogger publication from the CCSN main post zoned title without using sidebar clocks', () => {
  const html = `<aside><abbr class="published" itemprop="datePublished" title="2026-10-08T10:00:00+08:00">最新</abbr></aside><div class="post"><h1>本篇新聞</h1><div class="post-body">${'這是完整的原站新聞內容。'.repeat(30)}</div><span class="post-timestamp"><a class="timestamp-link"><abbr class="published" itemprop="datePublished" title="2026-10-07T23:43:00+08:00">星期三, 10月 07, 2026</abbr></a></span></div>`;
  expect(extractArticle(html, 'https://www.ccsn0405.com/2026/10/8medical-japan.html').publishedAt?.toISOString()).toBe(
    '2026-10-07T15:43:00.000Z',
  );
  expect(extractArticle(html, 'https://example.org/2026/10/8medical-japan.html').publishedAt).toBeNull();
  expect(
    extractArticle(html.replace('title="2026-10-07T23:43:00+08:00"', ''), 'https://www.ccsn0405.com/2026/10/8medical-japan.html')
      .publishedAt,
  ).toBeNull();
});

it('reads MKnews publication from the main post datetime and explicit partner source', () => {
  const html = `<time class="entry-date published" datetime="2030-01-01T00:00:00+08:00"></time><article><div class="entry-meta">新聞來源:焦點時報 頭條</div><div class="entry-meta"><time class="entry-date published updated" datetime="2026-10-07T22:29:42+08:00">2026-10-07</time></div><div class="entry-content"><p>${'新聞內容。'.repeat(60)}</p></div></article>`;
  expect(extractArticle(html, 'https://mknews.com.tw/2026/10/1002678/')).toMatchObject({
    publishedAt: new Date('2026-10-07T14:29:42Z'),
    provider: '焦點時報',
  });
});
it('reads RTI agency evidence from the separately labelled news-source slot', () => {
  const html = `<div class="dateWrap"><div class="date"><span class="time">2026-10-07 21:47</span></div><div class="date"><span class="time">新聞引據：法新社</span></div><div class="date"><span class="time">採訪撰稿：王小明 責任編輯：王大明</span></div></div><div class="text ivu-mt"><p>${'新聞内容。'.repeat(60)}</p></div>`;
  expect(extractArticle(html, 'https://www.rti.org.tw/news?uid=3&pid=236330').provider).toBe('法新社');
  expect(
    extractArticle(html.replace('新聞引據：法新社', '新聞引據：新聞中心'), 'https://www.rti.org.tw/news?uid=3&pid=236330').provider,
  ).toBeNull();
});

it('reads the TechNews printed publication and excludes its donation and follow widgets', () => {
  const url = 'https://finance.technews.tw/2026/10/08/financial-report/';
  const html = `<aside><span class="head">發布日期</span><span class="body">2027 年 01 月 01 日 12:00</span></aside><article class="post"><div class="content"><header class="entry-header"><h1 class="entry-title">公司營收</h1><span class="head">作者</span><span class="body"><a rel="author">Atkinson</a></span><span class="head">發布日期</span><span class="body">2026 年 10 月 08 日 0:00</span></header><div class="entry-content">${paragraph}<div id="bmc-tn-modal"><p>您的咖啡贊助將是讓我們持續走下去的動力</p></div><div class="googlenews_Content"><p>從這裡可透過《Google 新聞》追蹤 TechNews</p></div></div></div></article>`;
  expect(extractArticle(html, url)).toMatchObject({
    title: '公司營收',
    authors: ['Atkinson'],
    body,
    publishedAt: new Date('2026-10-07T16:00:00Z'),
  });
  expect(extractArticle(html.replace('class="post"', 'class="other"'), url).publishedAt).toBeNull();
  expect(newsSiteRules('https://unreviewed.technews.tw/2026/10/08/financial-report/')).toBeUndefined();
});

it('reads PeoPo publication only from the full report header, ignoring related article times', () => {
  const url = 'https://www.peopo.org/news/859649';
  const html = `<div id="block-peopo-content"><article class="node--type-post node--view-mode-full"><header><div class="node__meta"><span class="me-1">2026/10/08 03:17</span></div></header>${paragraph}<aside><time datetime="2025-01-13T19:02:44+08:00">舊稿</time></aside></article></div>`;
  expect(extractArticle(html, url).publishedAt).toEqual(new Date('2026-10-07T19:17:00Z'));
  expect(extractArticle(html.replace('node--view-mode-full', 'node--view-mode-teaser'), url).publishedAt).toBeNull();
  expect(newsSiteRules('https://www.peopo.org/user/2539')).toBeUndefined();
});

it('reads Limedia complete author credit only from its own report header', () => {
  const url = 'https://www.limedia.tw/comm/74441/?utm_source=rss';
  const html = `<article class="post"><div class="td-post-header"><header class="td-post-title"><div class="td-module-meta-info"><div class="td-post-author-name"><a>潘韜宇／綜合報導</a></div></div></header></div><div class="td-post-content">${paragraph}</div></article><aside><div class="td-post-author-name"><a>王小明／綜合報導</a></div></aside>`;
  expect(extractArticle(html, url).authors).toEqual(['潘韜宇']);
  expect(extractArticle(html.replace('潘韜宇／綜合報導', '攝影：潘韜宇'), url).authors).toEqual([]);
});

it('reads Livio semantic header footer credits without using page footer or recommendation authors', () => {
  const url = 'https://livio.com.tw/257404/';
  const html = `<article class="post"><header class="entry-header"><footer class="entry-meta"><time class="entry-date published" datetime="2026-10-08T00:01:50+08:00">08 Oct. 2026</time><time class="updated" datetime="2026-09-05T12:43:49+08:00">更新</time><span class="byline"><span class="author vcard">Ben Ma</span></span></footer></header><div class="entry-content">${paragraph}</div></article><article class="post elementor-post"><header class="entry-header"><footer class="entry-meta"><span class="byline"><span class="author vcard">Another Author</span></span></footer></header></article>`;
  expect(extractArticle(html, url)).toMatchObject({ authors: ['Ben Ma'], publishedAt: new Date('2026-10-07T16:01:50Z') });
  const outsideHeader = html.replace('header class="entry-header"', 'div class="other"').replace('</header>', '</div>');
  expect(extractArticle(outsideHeader, url).authors).toEqual([]);
});

it('keeps CommonHealth declared writers separate from responsible editors in JSONLD', () => {
  const url = 'https://www.commonhealth.com.tw/article/94719';
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'NewsArticle',
    url,
    author: [
      { '@type': 'Person', name: '梁惠明' },
      { '@type': 'Person', name: '王湘翎' },
    ],
  })}</script><div class="article-info"><span><span class="flex--title">文 /</span><span class="flex--desc"><span class="desc--content"><a data-position="文章作者資訊">梁惠明</a></span></span></span><span><span class="flex--title">責任編輯 /</span><span class="flex--desc"><span class="desc--content"><a data-position="文章作者資訊">王湘翎</a></span></span></span></div><div itemprop="articleBody">${paragraph}</div>`;
  expect(extractArticle(html, url).authors).toEqual(['梁惠明']);
  expect(extractArticle(html.replace('文 /', '圖片 /'), url).authors).toEqual(['梁惠明', '王湘翎']);
});

it('reads Guancha complete opening writer credit without accepting quotations or photography', () => {
  const url = 'https://www.guancha.cn/GuoJi/2026_10_07_903416.shtml';
  const html = `<div class="left-main"><div class="content all-txt"><p>（文/观察者网 郭光昊）</p>${paragraph}<p>（文/观察者网 王小明）</p></div></div>`;
  expect(extractArticle(html, url).authors).toEqual(['郭光昊']);
  expect(extractArticle(html.replace('（文/观察者网 郭光昊）', '（图/观察者网 郭光昊）'), url).authors).toEqual([]);
  expect(extractArticle(html.replace('（文/观察者网 郭光昊）', '评论指出（文/观察者网 郭光昊）'), url).authors).toEqual([]);
});

it('reads TaipeiPost complete writing credit instead of a syndicated publishing account', () => {
  const url = 'https://taipeipost.org/397156/';
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', url, author: { name: '享民頭條' } })}</script><main><div class="elementor-widget-text-editor"><div class="elementor-widget-container"><p>編輯/鄭欣宜撰文</p>${paragraph}<p>編輯/王小明撰文</p></div></div></main>`;
  expect(extractArticle(html, url).authors).toEqual(['鄭欣宜']);
  expect(extractArticle(html.replace('編輯/鄭欣宜撰文', '照片/鄭欣宜提供'), url).authors).toEqual(['享民頭條']);
});

it('preserves the 1111 main dateline media desk credit instead of its corporate site author', () => {
  const url = 'https://www.1111.com.tw/news/jobns/167717';
  const spec = sourceByMedia('1111')!.article;
  const html = `<meta name="author" content="1111人力銀行 | 全球華人股份有限公司"><main><div class="yellow-white-bg"><time>2026-10-07 上午 09:24 媒體中心／綜合報導</time>${paragraph}</div></main>`;
  expect(extractArticle(html, url, spec).authors).toEqual(['媒體中心／綜合報導']);
  expect(extractArticle(html.replace('媒體中心／綜合報導', '記者林育如／台北報導'), url, spec).authors).toEqual(['林育如']);
  expect(extractArticle(html.replace('媒體中心／綜合報導', '媒體中心活動'), url, spec).authors).toEqual([
    '1111人力銀行 | 全球華人股份有限公司',
  ]);
});

it('reads Secret China complete reporter and translator credit after an opening photo caption', () => {
  const url = 'https://www.secretchina.com/news/b5/2026/10/08/1105810.html';
  const credit = '【看中國2026年10月8日訊】（看中國記者高芸編譯/綜合報導）';
  const html = `<div class="article_right" itemprop="articleBody"><p>官員訪問照片。（圖片來源：攝影社）</p><p>${credit}${body}</p><p>責任編輯王小明</p></div>`;
  expect(extractArticle(html, url).authors).toEqual(['高芸']);
  expect(extractArticle(html.replace(credit, credit.replace('記者高芸編譯', '攝影高芸編譯')), url).authors).toEqual([]);
  expect(extractArticle(html.replace(credit, '受訪者提及' + credit), url).authors).toEqual([]);
});

it('reads a Twline main opening partner credit after its adjoining photo caption', () => {
  const url = 'https://twline365.com/2026/10/1243821/';
  const lead = '貴賓大合照。〈圖／記者翻攝-下同〉 〔焦點時報/記者蔡宗憲報導〕';
  const html = `<div class="td-post-content"><div class="tdb-block-inner"><p>${lead}活動即將登場。</p>${paragraph}<p>〔焦點時報/記者王小明報導〕</p></div></div>`;
  expect(extractArticle(html, url).authors).toEqual(['蔡宗憲']);
  expect(extractArticle(html.replace(lead, '受訪者提及〔焦點時報/記者蔡宗憲報導〕'), url).authors).toEqual([]);
  expect(extractArticle(html.replace(lead, '貴賓大合照。〈圖／記者翻攝-下同〉 〔焦點時報/攝影蔡宗憲〕'), url).authors).toEqual([]);
});

it('corrects EpochTimes publication using agreeing main publication and modification clocks', () => {
  const url = 'https://www.epochtimes.com/b5/26/10/7/n14865552.htm';
  const node = { '@type': 'NewsArticle', url, datePublished: '2026-10-08T03:29:39Z', dateModified: '2026-10-08T03:43:27Z' };
  const html = `<script type="application/ld+json">${JSON.stringify(node)}</script><main id="main"><div class="main_content"><div class="article"><h1>新聞標題</h1><div class="info"><time datetime="2026-10-08T03:43:27+08:00">更新 2026-10-08 3:29 AM</time></div><div id="artbody" itemprop="articleBody">${paragraph}</div></div></div></main>`;
  expect(extractArticle(html, url)).toMatchObject({ publishedAt: new Date('2026-10-07T19:29:39Z'), body });
  for (const unsafe of [
    html.replace('更新 2026-10-08 3:29 AM', '更新 2026-10-08 3:43 AM'),
    html.replace('03:43:27+08:00', '03:44:27+08:00'),
    html.replace('id="main"', 'id="sidebar"'),
    html.replace('"url":"' + url + '"', '"url":"https://www.epochtimes.com/b5/26/10/7/n999.htm"'),
  ])
    expect(extractArticle(unsafe, url).publishedAt).toEqual(new Date('2026-10-08T03:29:39Z'));
});

it('handles EpochTimes midnight/noon publication clocks without copying its later modification time', () => {
  const url = 'https://www.epochtimes.com/b5/26/10/7/n14865552.htm';
  for (const [hour, suffix] of [
    ['00', 'AM'],
    ['12', 'PM'],
  ]) {
    const node = { '@type': 'NewsArticle', url, datePublished: `2026-10-08T${hour}:01:09Z`, dateModified: `2026-10-08T${hour}:04:21Z` };
    const html = `<script type="application/ld+json">${JSON.stringify(node)}</script><main id="main"><div class="main_content"><div class="article"><div class="info"><time datetime="2026-10-08T${hour}:04:21+08:00">更新 2026-10-08 12:01 ${suffix}</time></div><div id="artbody" itemprop="articleBody">${paragraph}</div></div></div></main>`;
    expect(extractArticle(html, url).publishedAt).toEqual(new Date(`2026-10-08T${hour}:01:09+08:00`));
  }
});
