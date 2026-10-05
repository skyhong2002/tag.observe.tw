import { describe, expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

const url = 'https://example.com/story/1';
const lead = '市府今天公布公共運輸改善計畫，將增加班次並邀請居民參與討論。'.repeat(8);
const ending = '議員要求公開審查預算，交通局承諾定期公布執行進度。'.repeat(8);
const ld = (data: Record<string, unknown>) =>
  `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', url, ...data })}</script>`;

describe('article extraction review regressions', () => {
  it('retains EBC syndication evidence outside the visible prose paragraphs', () => {
    const credit = '•以上言論由 中央社 授權轉載，不代表東森新聞立場。';
    const html = `<div class="article_main"><div class="article_content"><p>${lead}</p><div class="rss_box">${credit}</div><h2 class="rss_box">相關專題</h2></div></div>`;
    const detail = extractArticle(html, 'https://news.ebc.net.tw/news/living/574100');
    expect(detail.provider).toBe(credit);
    expect(detail.body).toBe(lead);
    expect(extractAttributions(detail.body!, 'ebc', detail.provider)).toMatchObject([{ media: 'cna', kind: 'explicit' }]);
  });
  it('retains visible punctuation for short equivalent bodies too', () => {
    const prose = '居民說：「班次增加了！」（試辦路線）；票價維持 1.5 元。';
    const html = ld({ articleBody: prose.normalize('NFKC') }) + `<article><p>${prose}</p></article>`;
    expect(extractArticle(html, url)).toMatchObject({ body: prose, bodySource: 'article', bodyStatus: 'short' });
  });

  it('prefers the verified EBC container for short news instead of the longer structured headline and body', () => {
    const prose = '國道車多！車流回堵，請小心駕駛。';
    const html =
      ld({ url: 'https://news.ebc.net.tw/news/living/574100', articleBody: `國道交通新聞。${prose.normalize('NFKC')}` }) +
      `<div class="article_main"><div class="article_content"><p>${prose}</p></div></div>`;
    expect(extractArticle(html, 'https://news.ebc.net.tw/news/living/574100')).toMatchObject({
      body: prose,
      bodySource: 'selector',
      bodyStatus: 'short',
    });
  });
  it('keeps a verified EBC short report even when structured headlines and notices pad it beyond 200 characters', () => {
    const prose = '國道車多！車流回堵，請小心駕駛。'.repeat(6);
    const ebc = 'https://news.ebc.net.tw/news/living/574100';
    const html =
      ld({ url: ebc, articleBody: `新聞標題。${prose.normalize('NFKC')}${'授權轉載聲明。'.repeat(20)}` }) +
      `<div class="article_main"><div class="article_content"><p>${prose}</p></div></div>`;
    expect(extractArticle(html, ebc)).toMatchObject({ body: prose, bodySource: 'selector', bodyStatus: 'short' });
  });
  it.each(['article', 'div.article-content', 'div[itemprop="articleBody"]'])(
    'preserves visible punctuation and paragraphs for equivalent prose in %s',
    (selector) => {
      const prose = `${lead}居民說：「班次增加了！」（試辦路線）；票價維持 1.5 元。`;
      const dom = `${prose}\n\n${ending}`;
      const tag = selector === 'article' ? 'article' : 'div';
      const attrs = selector.includes('.') ? ' class="article-content"' : selector.includes('[') ? ' itemprop="articleBody"' : '';
      const html =
        ld({ articleBody: dom.normalize('NFKC').replace(/\n/g, '') }) + `<${tag}${attrs}><p>${prose}</p><p>${ending}</p></${tag}>`;
      expect(extractArticle(html, url)).toMatchObject({ body: dom, bodyStatus: 'ok' });
    },
  );

  it('ignores a duplicated structured headline when comparing complete visible prose', () => {
    const headline = '公共運輸新政策！';
    const html =
      ld({ headline, articleBody: `${headline}${lead}`.normalize('NFKC') }) + `<article><h1>${headline}</h1><p>${lead}</p></article>`;
    expect(extractArticle(html, url)).toMatchObject({ body: lead, bodySource: 'article' });
  });

  it('does not replace a full structured report with a matching DOM excerpt', () => {
    const html = ld({ articleBody: lead + ending }) + `<div class="article-content"><p>${lead}</p></div>`;
    expect(extractArticle(html, url)).toMatchObject({ body: lead + ending, bodySource: 'ld+json' });
  });

  it('uses EBC visible prose even when structured data embeds headings and rewrites brackets', () => {
    const prose = `公共運輸（試辦路線）改善了！${lead}`;
    const html =
      ld({
        url: 'https://news.ebc.net.tw/news/world/574175',
        articleBody: `新聞標題。${prose.replaceAll('（', '「').replaceAll('）', '」').normalize('NFKC')}小標題${ending}`,
      }) +
      `<div class="article_main"><div class="article_content"><p>${prose}</p><h2>小標題</h2><p>${ending}</p><div class="related"><p>推薦新聞</p></div></div></div>`;
    expect(extractArticle(html, 'https://news.ebc.net.tw/news/world/574175')).toMatchObject({
      body: `${prose}\n\n${ending}`,
      bodySource: 'selector',
    });
  });
  it.each(['comments-off', 'with-share', 'has-share-float', 'social-after-title', 'has-banner'])(
    'keeps article prose inside the observed %s layout wrapper while excluding actual widgets',
    (layout) => {
      const html = `<article class="post type-post tag-123 category-news ${layout}"><div class="entry-content">${`<p>${lead}</p>`}<div class="share"><p>分享介面</p></div><div class="comments"><p>讀者留言</p></div><div class="banner"><p>廣告內容</p></div></div></article>`;
      const article = extractArticle(html, url);
      expect(article.body).toBe(lead);
      expect(article.bodyStatus).toBe('ok');
    },
  );

  it('uses a verified body selector before a long structured teaser', () => {
    const html = ld({ articleBody: lead }) + `<div id="verified"><p>${ending}</p></div>`;
    expect(extractArticle(html, url, { bodySelector: '#verified' })).toMatchObject({ body: ending, bodySource: 'selector' });
  });

  it('retains the complete semantic DOM extension of a long JSON-LD teaser', () => {
    const html = ld({ articleBody: lead }) + `<div itemprop="articleBody"><p>${lead}</p><p>${ending}</p></div>`;
    expect(extractArticle(html, url)).toMatchObject({ body: `${lead}\n\n${ending}`, bodySource: '[itemprop="articleBody"]' });
  });

  it('keeps structured body when a longer DOM candidate is different prose', () => {
    const html = ld({ articleBody: lead }) + `<div class="article-content"><p>${ending.repeat(2)}</p></div>`;
    expect(extractArticle(html, url)).toMatchObject({ body: lead, bodySource: 'ld+json' });
  });

  it('falls back to JSON-LD when the configured selector contains only UI', () => {
    const html = ld({ articleBody: lead }) + '<div id="verified"><p>訂閱即可閱讀全文</p></div>';
    expect(extractArticle(html, url, { bodySelector: '#verified' })).toMatchObject({ body: lead, bodySource: 'ld+json' });
  });

  it('extracts article containers inside an ASP.NET page form', () => {
    const html = `<form id="aspnetForm"><div id="verified"><p>${lead}</p><p>${ending}</p></div></form>`;
    expect(extractArticle(html, url, { bodySelector: '#verified' })).toMatchObject({ body: `${lead}\n\n${ending}`, bodyStatus: 'ok' });
  });

  it('prefers a verified author selector over an otherwise valid JSON-LD author', () => {
    const html = ld({ articleBody: lead, author: { '@type': 'Person', name: '舊記者' } }) + '<div class="reporter-name">王小明</div>';
    expect(extractArticle(html, url, { authorSelector: '.reporter-name' }).authors).toEqual(['王小明']);
  });

  it('uses the scoped reporter byline when structured metadata credits an organization', () => {
    const html =
      ld({ articleBody: lead, author: { '@type': 'Organization', name: '自由時報電子報' } }) +
      '<article><div class="byline">記者王小明、李小華／台北報導</div></article>' +
      '<aside><div class="byline">推薦作者</div></aside>';
    expect(extractArticle(html, url).authors).toEqual(['王小明', '李小華']);
  });

  it('reads a reporter declaration at the start of the actual body', () => {
    const html =
      ld({ articleBody: lead, author: { '@type': 'Organization', name: '自由時報電子報' } }) +
      `<div itemprop="articleBody"><p>〔記者王小明／台北報導〕${lead}</p><p>${ending}</p></div>`;
    expect(extractArticle(html, url).authors).toEqual(['王小明']);
  });

  it('extracts a named reporter from a bracketed agency dispatch credit', () => {
    const html =
      ld({ articleBody: lead, author: { '@type': 'Organization', name: '中央社' } }) +
      `<article><p>（中央社記者王小明台北3日電）${lead}</p></article>`;
    expect(extractArticle(html, url).authors).toEqual(['王小明']);
  });

  it('does not turn a cited reporter or a related body into the article author', () => {
    const html =
      ld({ articleBody: lead, author: { '@type': 'Organization', name: '中央社' } }) +
      `<article><p>${lead}記者王小明／台北報導</p></article>` +
      `<aside><div itemprop="articleBody"><p>記者推薦作者／高雄報導${ending}</p></div></aside>`;
    expect(extractArticle(html, url).authors).toEqual(['中央社']);
  });

  it('extracts the iStyle template while excluding photo captions, inline hidden UI and its app promotion', () => {
    const html =
      '<div class="content940"><span class="time"><p class="auther">文／記者林欣若　圖／品牌提供</p></span>' +
      `<div class="text"><p>${lead}</p><p><span class="ph_b"><img src="/photo"><span class="ph_d">圖說文字</span></span></p>` +
      '<p style="text-align: center; display: none;">請繼續往下閱讀...</p>' +
      `<p>${ending}</p><p class="appE1121">不用抽 不用搶 現在用APP看新聞</p></div></div>`;
    expect(extractArticle(html, url, { bodySelector: '.content940 .text', authorSelector: '.content940 .time .auther' })).toMatchObject({
      body: `${lead}\n\n${ending}`,
      authors: ['林欣若'],
      bodyStatus: 'ok',
      bodySource: 'selector',
    });
  });

  it('preserves a full agency byline instead of a misleading Person dateline', () => {
    const html =
      ld({ articleBody: lead, author: { '@type': 'Person', name: '曼谷3日專電' } }) +
      '<div class="article-content__author">中央社／ 曼谷3日專電</div>';
    expect(extractArticle(html, url, { authorSelector: '.article-content__author' }).authors).toEqual(['中央社／ 曼谷3日專電']);
  });

  it('does not count UDN member widgets and related feature titles as a complete short article', () => {
    const short = '內文'.repeat(90);
    const html =
      '<div class="article-content__author">聯合報／ 記者王小明／台北即時報導</div>' +
      `<div class="article-content"><div class="article-content__editor"><p>${short}</p>` +
      '<div class="further-reading__box"><p>2026九合一選舉</p></div></div>' +
      '<div class="udn-privilege-details"><p>您即將前往會員中心 登入簽到送 LINE POINTS 🪙</p></div></div>';
    expect(
      extractArticle(html, url, { bodySelector: '.article-content__editor', authorSelector: '.article-content__author' }),
    ).toMatchObject({
      body: short,
      bodyStatus: 'short',
      authors: ['王小明'],
    });
  });
});
