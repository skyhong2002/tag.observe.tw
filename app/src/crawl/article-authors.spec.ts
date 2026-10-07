import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://example.com/news/1';
const prose = '市府今天公布公共運輸改善計畫，增加班次並邀請居民參與討論。'.repeat(10);
const ld = (body: string, name = '網站管理員') =>
  `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', url, articleBody: body, author: { '@type': 'Person', name } })}</script>`;

describe('reporter identity from the selected article', () => {
  it('prefers the visible opening reporter over a WordPress account', () => {
    expect(extractArticle(ld(prose) + `<div class="entry-content"><p>記者蔡佳坊／嘉義報導</p><p>${prose}</p></div>`, url).authors).toEqual([
      '蔡佳坊',
    ]);
  });
  it('reads an opening credit from JSON-LD without a DOM body', () => {
    expect(extractArticle(ld(`記者蔡佳坊／嘉義報導\n\n${prose}`), url).authors).toEqual(['蔡佳坊']);
  });
  it('does not credit an alternative body when the configured article has no byline', () => {
    const html =
      ld(prose, '本文作者') +
      `<div id="main"><p>${prose}</p></div><div class="article-body"><p>記者其他作者／台北報導</p><p>${prose}</p></div>`;
    expect(extractArticle(html, url, { bodySelector: '#main' }).authors).toEqual(['本文作者']);
  });
  it('does not mistake a later paragraph for the opening byline', () => {
    const html = ld(prose, '本文作者') + `<article><p>${prose}</p><p>記者其他作者／台北報導</p></article>`;
    expect(extractArticle(html, url).authors).toEqual(['本文作者']);
  });
  it('allows the opening credit after an obvious photo caption', () => {
    const html = `<article><p>▲公車站示意圖。（圖／資料照）</p><p>TMNU記者 陳們明／綜合報導</p><p>${prose}</p></article>`;
    expect(extractArticle(html, url).authors).toEqual(['陳們明']);
  });
  it('ignores author elements that are themselves hidden or related widgets', () => {
    const html =
      ld(prose, '本文作者') +
      '<div class="byline" hidden>記者隱藏作者／台北報導</div><div class="related byline">記者推薦作者／台北報導</div>';
    expect(extractArticle(html, url).authors).toEqual(['本文作者']);
  });
  it('uses a named lead reporter when the configured field only credits an agency', () => {
    const html = `<div class="credit">中央社</div><article><p>（中央社記者黎建忠名古屋3日電）${prose}</p></article>`;
    expect(extractArticle(html, url, { authorSelector: '.credit' }).authors).toEqual(['黎建忠']);
  });
  it('extracts desk-prefixed television reporters instead of the company credit', () => {
    const html =
      '<meta name="author" content="民間全民電視公司">' + `<article><p>社會中心／王毓珺　黃柏榕　新北市報導</p><p>${prose}</p></article>`;
    expect(extractArticle(html, url).authors).toEqual(['王毓珺', '黃柏榕']);
    const narrative = `<article><p>社會中心／交通問題引起市民關注</p><p>${prose}</p></article>`;
    expect(extractArticle(narrative, url).authors).toEqual([]);
  });
  it('keeps the agency without treating its dispatch location as a reporter', () => {
    const html = `<span class="credit">中央社／ 台北7日電</span><article><p>${prose}</p></article>`;
    expect(extractArticle(html, url, { authorSelector: '.credit' }).authors).toEqual(['中央社']);
  });
  it('reads TaiwanHot header credits and local publication without using related stories', () => {
    const html = `<div class="content_wrapper"><div class="top_title"><h2 class="news_title">本文標題</h2><span class="reporter_name">記者葉志成 ／桃園報導</span><span class="post_time">2026-10-07 18:54</span></div><article><div class="news_content"><p>${prose}</p></div></article></div><aside><span class="reporter_name">記者別人／台北報導</span><span class="post_time">2026-10-07 20:00</span></aside>`;
    const detail = extractArticle(html, 'https://taiwanhot.net/news/1150397/story');
    expect(detail.authors).toEqual(['葉志成']);
    expect(detail.publishedAt?.toISOString()).toBe('2026-10-07T10:54:00.000Z');
    expect(detail.body).toBe(prose);
    expect(
      extractArticle(html.replace('記者葉志成 ／桃園報導', '生活中心／綜合報導'), 'https://taiwanhot.net/news/1150397/story').authors,
    ).toEqual(['生活中心／綜合報導']);
  });
  it.each([
    ['商傳媒｜方承業／綜合外電報導', '方承業'],
    ['商傳媒｜吳承岳／台北報導', '吳承岳'],
  ])('separates syndicated Sun Media writer from the provider: %s', (credit, name) => {
    const html = `<article><div class="ak-post-content"><p>${credit}</p><p>${prose}</p></div></article>`;
    const detail = extractArticle(html, 'https://ammtw.com/174127');
    expect(detail.authors).toEqual([name]);
    expect(detail.provider).toBe('商傳媒');
    const unrelated = `<article><div class="ak-post-content"><p>${prose}</p></div></article><aside><p>${credit}</p></aside>`;
    expect(extractArticle(unrelated, 'https://ammtw.com/174127')).toMatchObject({ authors: [], provider: null });
  });
  it('separates Sina syndicated source from its terminal journalist credit', () => {
    const article = (first: string, last: string) =>
      `<meta name="author" content="新浪新闻"><section class="j_main_art"><article class="art_box"><section class="art_content"><p>${first}</p><p>${prose}</p><p>${last}</p></section></article></section><aside><p>来源：其他媒体</p><p>记者：其他作者</p></aside>`;
    const sinaUrl = 'https://news.sina.cn/gj/2026-10-07/detail-iniukxhc4898442.d.html';
    expect(extractArticle(article('来源：中国新闻周刊', '记者：王晨晨'), sinaUrl)).toMatchObject({
      provider: '中国新闻周刊',
      authors: ['王晨晨'],
    });
    expect(
      extractArticle(article('来源：懂球帝', '技术统计'), 'https://news.sina.cn/2026-10-07/detail-iniumcpz4854264.d.html'),
    ).toMatchObject({ provider: '懂球帝', authors: ['新浪新闻'] });
    expect(extractArticle(article('消息来源：有人表示', '记者：王晨晨认为这值得关注。'), sinaUrl)).toMatchObject({
      provider: null,
      authors: ['新浪新闻'],
    });
  });
  it('reads EBC syndication authorization after the related-story box', () => {
    const content = `<div class="rss_box"><div class="rss_title">更多 CTWANT 報導</div><a>其他新聞標題</a></div><div class="rss_box">•以上言論由 CTWANT 授權轉載，不代表東森新聞立場。</div>`;
    const html = `<meta name="author" content="CTWANT"><div class="article_main"><div class="article_content"><p>${prose}</p>${content}</div></div>`;
    expect(extractArticle(html, 'https://news.ebc.net.tw/news/world/574664')).toMatchObject({
      provider: '•以上言論由 CTWANT 授權轉載，不代表東森新聞立場。',
      authors: ['CTWANT'],
      body: prose,
    });
    expect(
      extractArticle(html.replace('•以上言論由 CTWANT 授權轉載，不代表東森新聞立場。', ''), 'https://news.ebc.net.tw/news/world/574664')
        .provider,
    ).toBeNull();
  });
  it('preserves LifeNews syndicated Sun Media writer and provider separately', () => {
    const html = `<meta name="author" content="商傳媒"><div class="ak-post-content"><p><a href="https://sunmedia.tw/">商傳媒</a>｜葉安庭／綜合外電報導</p><p>${prose}</p></div>`;
    expect(extractArticle(html, 'https://lifenews.com.tw/593669')).toMatchObject({ provider: '商傳媒', authors: ['葉安庭'] });
    const unrelated = `<div class="ak-post-content"><p>${prose}</p></div><aside><p>商傳媒｜其他作者／報導</p></aside>`;
    expect(extractArticle(unrelated, 'https://lifenews.com.tw/593669').provider).toBeNull();
  });
  it('reads GRI header pen names without overriding a syndicated article writer', () => {
    const article = (name: string, lead: string) =>
      `<article><ul class="post-meta"><li class="author">Post by <a>${name}</a></li></ul><div class="post-content"><p>${lead}</p><p>${prose}</p></div></article><aside><li class="author"><a>其他作者</a></li></aside>`;
    expect(extractArticle(article('小丞', '草根影響力新視野 小丞'), 'https://grinews.com/news/story/').authors).toEqual(['小丞']);
    expect(extractArticle(article('myhousing住展', '文／梁愷恩'), 'https://grinews.com/news/story/').authors).toEqual(['梁愷恩']);
    expect(extractArticle(article('admin', prose), 'https://grinews.com/news/story/').authors).toEqual([]);
  });
  it.each([
    ['翁聖權', '新營'],
    ['翁順利', '台南'],
  ])('reads the division slash in CDNS reporter credits: %s', (name, place) => {
    expect(
      extractArticle(`<article><p>記者${name}∕${place}報導</p><p>${prose}</p></article>`, 'https://www.cdns.com.tw/articles/1').authors,
    ).toEqual([name]);
  });
  it('separates the dated Healthnews credit appended to a GRI title', () => {
    const html = `<article><div class="post-banner"><div class="post-title">高齡人口增帶動輔具需求！ 2026-10-02　 健康醫療網／記者黃嫊雰報導</div></div><ul class="post-meta"><li class="author"><a href="https://grinews.com/news/author/healthnews/">健康醫療網</a></li></ul><div class="post-content"><p>${prose}</p></div></article>`;
    expect(extractArticle(html, 'https://grinews.com/news/story/')).toMatchObject({
      title: '高齡人口增帶動輔具需求！',
      authors: ['黃嫊雰'],
      provider: '健康醫療網',
      body: prose,
    });
  });
  it('keeps declared organizational credits when no journalist is named', () => {
    expect(extractArticle('<meta name="author" content="中央社">' + `<article><p>${prose}</p></article>`, url).authors).toEqual(['中央社']);
  });
});
