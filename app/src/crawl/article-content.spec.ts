import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import type { fetchText } from './fetch.ts';
import { discoverNews } from './news-discovery.ts';

const URL = 'https://news.example/article/1';
const paragraph = '城市議會今天討論公共運輸政策，居民希望增加班次，主管機關表示將參考調查結果並公布後續規畫。';
const body = [paragraph.repeat(3), paragraph.repeat(3)].join('\n\n');
const ld = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

describe('article body and byline extraction', () => {
  it('retains linked keywords inside prose while excluding independent tag and recommendation widgets', () => {
    const prose = `空軍說明<a class="tag" href="/search/tagging/2/F-16">F-16</a>缺項交機，<a class="tag" href="/search/tagging/2/戰機">戰機</a>交付安排。${body}`;
    const html = `<div class="article-content__editor"><p>${prose}</p><div class="tags"><p><a class="tag" href="/tag/other">獨立標籤不可納入</a></p></div><aside><p>相關推薦不可納入</p></aside><div class="related"><p><a class="tag" href="/search/tagging/2/other">推薦標題不可納入</a></p></div><p><a class="tag author" href="/author/1">作者介面不可納入</a></p><p><a class="tag" href="/tag/list">獨立連結導覽</a></p></div>`;
    const article = extractArticle(html, 'https://udn.com/news/story/7331/9827995', { bodySelector: '.article-content__editor' });
    expect(article.bodyStatus).toBe('ok');
    expect(article.body).toBe(`空軍說明F-16缺項交機，戰機交付安排。${body.replace(/\n\n/g, ' ')}`);
  });
  it('rejects reviewed programme previews before structured data can disguise them as full text', () => {
    const ntd = 'https://www.ntdtv.com/gb/2026/10/02/a104138452.html';
    const preview = `<div class="featured_video"></div><div itemprop="articleBody"><p>${paragraph.repeat(5)}</p><p>《新闻大家谈》制作组</p><p>（责任编辑：编辑）</p></div>`;
    expect(extractArticle(ld({ '@type': 'NewsArticle', articleBody: body }) + preview, ntd)).toMatchObject({
      body: null,
      bodyStatus: 'short',
      bodySource: 'publisher:excerpt',
    });
    for (const host of ['www.ntdtv.com/gb/2026/10/02/a123.html', 'www.soundofhope.org/post/945618']) {
      const html = `<div itemprop="articleBody"><p>${body}</p><h2><a href="https://www.ganjingworld.com/video/example"><strong>【点击观看完整视频】</strong></a></h2></div>`;
      expect(extractArticle(html, `https://${host}`)).toMatchObject({ body: null, bodyStatus: 'short' });
    }
    const teaser = `<div itemprop="articleBody"><p>${body}本期节目带你深入了解。</p><p>【<a href="https://www.ganjingworld.com/video/example">点击观看更多内容</a>】</p></div>`;
    expect(extractArticle(teaser, 'https://www.soundofhope.org/post/945795').bodyStatus).toBe('short');
  });

  it('retains complete reports with embedded video and ignores preview labels outside the main body', () => {
    const html = `<div class="featured_video"></div><div itemprop="articleBody"><iframe src="https://www.youtube.com/embed/test"></iframe><p>${paragraph.repeat(5)}</p><p>${paragraph.repeat(5)}</p><p>${paragraph.repeat(5)}</p><p>《新闻大家谈》制作组</p></div><aside><a href="https://video.example/">点击观看完整视频</a></aside>`;
    expect(extractArticle(html, 'https://www.ntdtv.com/gb/2026/10/02/a123.html').bodyStatus).toBe('ok');
    expect(extractArticle(html, 'https://www.soundofhope.org/post/123').bodyStatus).toBe('ok');
    const unrelated = `<div itemprop="articleBody"><p>${body}</p><a href="https://video.example/">点击观看完整视频</a></div>`;
    expect(extractArticle(unrelated, URL).bodyStatus).toBe('ok');
  });

  it('rejects Epoch daily headline-and-excerpt digests but keeps regular numbered reporting', () => {
    const paragraphs = [1, 2, 3]
      .map((number) => `<p>${number}.<a href="/gb/26/10/2/n123.htm">新聞標題</a>${paragraph.repeat(2)}</p>`)
      .join('');
    const intro = '<p>【大纪元2026年10月02日讯】大纪元每天为读者梳理翻墙必看的文章：</p>';
    const url = 'https://www.epochtimes.com/gb/26/10/2/n14862126.htm';
    expect(
      extractArticle(ld({ '@type': 'NewsArticle', articleBody: body }) + `<div class="article-main">${intro}${paragraphs}</div>`, url),
    ).toMatchObject({ body: null, bodyStatus: 'short' });
    expect(extractArticle(`<div class="article-main">${paragraphs}</div><aside>${intro}</aside>`, url).bodyStatus).toBe('ok');
    expect(extractArticle(`<div class="article-main">${intro}${paragraphs}</div>`, URL).bodyStatus).toBe('ok');
  });
  it.each(['entry-content', 'post-content', 'td-post-content', 'elementor-widget-theme-post-content', 'article-main'])(
    'extracts WordPress body from %s while excluding related widgets',
    (className) => {
      const html = `<div class="${className}">${body
        .split('\n\n')
        .map((p) => `<p>${p}</p>`)
        .join('')}<aside><p>無關新聞內容</p></aside><div class="related-news"><p>推薦其他新聞</p></div></div>`;
      expect(extractArticle(html, URL)).toMatchObject({ body, bodyStatus: 'ok', bodySource: `.${className}` });
    },
  );

  it('does not mistake global WordPress theme classes for an author container', () => {
    const html = `<html class="hide-author"><body class="ta-hide-date-author-in-list"><article>${body
      .split('\n\n')
      .map((p) => `<p>${p}</p>`)
      .join('')}</article><aside><article><p>其他新聞內容${body}</p></article></aside></body></html>`;
    expect(extractArticle(html, URL)).toMatchObject({ body, bodyStatus: 'ok' });
    expect(
      extractArticle(
        `<body class="hide-author"><div class="author"><article>${body
          .split('\n\n')
          .map((p) => `<p>${p}</p>`)
          .join('')}</article></div></body>`,
        URL,
      ),
    ).toMatchObject({ body: null, bodyStatus: 'missing' });
  });

  it('keeps WordPress taxonomy-tagged article bodies while removing actual tag widgets', () => {
    const html = `<article class="post hentry category-news tag-ai tag-123"><div class="entry-content"><p>${paragraph.repeat(6)}</p><div class="tags"><p>不應出現的標籤</p></div></div></article>`;
    expect(extractArticle(html, URL)).toMatchObject({ body: paragraph.repeat(6), bodyStatus: 'ok' });
  });

  it('retains a no-share article container while excluding positive share widgets', () => {
    const html = `<div class="entry-content no-share"><div class="content-inner"><p>${paragraph.repeat(6)}</p><div class="share"><p>分享工具文字</p></div></div></div>`;
    expect(extractArticle(html, URL)).toMatchObject({ body: paragraph.repeat(6), bodyStatus: 'ok' });
  });

  it('extracts a Focus Taiwan primary paragraph without unrelated sidebars', () => {
    const html = `<div class="PrimarySide"><div class="paragraph"><p>${paragraph.repeat(6)}</p></div></div><aside><div class="paragraph"><p>無關側欄</p></div></aside>`;
    expect(extractArticle(html, URL)).toMatchObject({
      body: paragraph.repeat(6),
      bodyStatus: 'ok',
      bodySource: '.PrimarySide > .paragraph',
    });
  });

  it('extracts a Yahoo reporter name without turning the desk affiliation into a person', () => {
    expect(
      extractArticle(
        ld({ '@type': 'NewsArticle', articleBody: body, author: { '@type': 'Person', name: '潘鈺楨｜Yahoo名人娛樂特派記者' } }),
        URL,
      ).authors,
    ).toEqual(['潘鈺楨']);
    expect(
      extractArticle(ld({ '@type': 'NewsArticle', articleBody: body, author: { '@type': 'Organization', name: 'Yahoo新聞編輯室' } }), URL)
        .authors,
    ).toEqual(['Yahoo新聞編輯室']);
  });
  it('extracts nested article JSON-LD and multiple author names without treating descriptions as content', () => {
    const html =
      '<meta name="description" content="摘要"><meta name="keywords" content="公共運輸,政策">' +
      ld({
        '@graph': [
          {
            '@type': 'WebPage',
            mainEntity: {
              '@type': ['Thing', 'NewsArticle'],
              articleBody: body,
              author: [{ '@type': 'Person', name: '陳記者' }, { name: '李記者' }, { name: '陳記者' }],
            },
          },
        ],
      });
    expect(extractArticle(html, URL)).toMatchObject({
      body,
      authors: ['陳記者', '李記者'],
      bodyStatus: 'ok',
      bodySource: 'ld+json',
      description: '摘要',
      tags: ['公共運輸', '政策'],
    });
  });

  it('selects the current article in a graph and ignores unrelated and non-article structured bodies', () => {
    const html = ld({
      '@graph': [
        { '@type': 'NewsArticle', url: 'https://news.example/article/2', articleBody: '其他新聞'.repeat(100), author: '其他作者' },
        { '@type': 'WebPage', articleBody: '網站導覽'.repeat(100) },
        { '@type': 'https://schema.org/NewsArticle', mainEntityOfPage: { '@id': URL }, articleBody: body, author: { name: '本文作者' } },
      ],
    });
    expect(extractArticle(html, URL)).toMatchObject({ body, authors: ['本文作者'], bodyStatus: 'ok' });
  });

  it('does not extract related ItemList articles when the actual article has no body', () => {
    const html = ld({
      '@type': 'ItemList',
      itemListElement: [{ '@type': 'NewsArticle', articleBody: body }],
    });
    expect(extractArticle(html, URL)).toMatchObject({ body: null, bodyStatus: 'missing', bodySource: 'none' });
  });

  it('does not select standalone recommendation articles as the current page body', () => {
    const html = `<main><h1>本文只有標題</h1></main><aside><article><p>${body}</p></article></aside><div class="related-news"><div class="article-content"><p>${body}</p></div></div>`;
    expect(extractArticle(html, URL)).toMatchObject({ body: null, bodyStatus: 'missing' });
  });

  it('cleans DOM paragraphs while retaining paragraph order, inline links, and nested prose', () => {
    const html = `<article><h1>標題</h1><div class="byline">陳記者</div>
      <p>  ${paragraph.repeat(3)} <a href="/reference">調查</a> </p>
      <div><p>${paragraph.repeat(3)}</p></div>
      <div class="ad-container"><p>廣告內容${paragraph.repeat(4)}</p></div>
      <aside><p>側欄${body}</p></aside><nav><p>網站導覽${body}</p></nav>
      <figure><p>圖說${body}</p><figcaption>圖片說明</figcaption></figure>
      <div class="related-news"><p>推薦文章${body}</p></div>
      <p><a href="/other">${body}</a></p>
      <div hidden><p>隱藏${body}</p></div>
      <script>${body}</script><style>${body}</style>
      <p>Advertisement</p><p>延伸閱讀：另一則報導</p></article>`;
    expect(extractArticle(html, URL)).toMatchObject({
      body: `${paragraph.repeat(3)} 調查\n\n${paragraph.repeat(3)}`,
      bodyStatus: 'ok',
      bodySource: 'article',
      authors: ['陳記者'],
    });
  });

  it('supports configured body and author selectors and semantic bodies without paragraphs', () => {
    const html = `<div class="reporter-name">陳記者</div><div id="custom-copy">${paragraph.repeat(3)}<br><br>${paragraph.repeat(3)}<div class="recommendations">推薦${body}</div></div>`;
    expect(extractArticle(html, URL, { bodySelector: '#custom-copy', authorSelector: '.reporter-name' })).toMatchObject({
      body,
      bodyStatus: 'ok',
      bodySource: 'selector',
      authors: ['陳記者'],
    });
    expect(extractArticle(`<div itemprop="articleBody">${body}</div>`, URL).bodyStatus).toBe('ok');
    expect(
      extractArticle(`<div class="news-box-text"><div>${paragraph.repeat(3)}</div><div>${paragraph.repeat(3)}</div></div>`, URL, {
        bodySelector: '.news-box-text',
      }).body,
    ).toBe(body);
  });

  it('falls back from malformed or short JSON-LD to a complete article DOM body', () => {
    const html =
      '<script type="application/ld+json">{"@type":</script>' +
      ld({ '@type': 'NewsArticle', articleBody: '只有導言' }) +
      `<div class="article-content"><p>${paragraph.repeat(3)}</p><p>${paragraph.repeat(3)}</p></div>`;
    expect(extractArticle(html, URL)).toMatchObject({ body, bodyStatus: 'ok', bodySource: '.article-content' });
  });

  it('normalizes structured HTML and removes advertising, captions, and related news', () => {
    const articleBody = `<p>${paragraph.repeat(3)} &amp; 討論</p><figure><p>圖片說明${body}</p></figure><div class="related"><p>${body}</p></div><p>${paragraph.repeat(3)}</p>`;
    expect(extractArticle(ld({ '@type': 'Article', articleBody }), URL).body).toBe(
      `${paragraph.repeat(3)} & 討論\n\n${paragraph.repeat(3)}`,
    );
  });

  it('reports missing and short separately and counts normalized content rather than whitespace or bytes', () => {
    const metaOnly = `<meta name="description" content="${body}"><meta property="og:description" content="${body}"><main><p>${body}</p></main>`;
    expect(extractArticle(metaOnly, URL)).toMatchObject({ body: null, bodyStatus: 'missing', authors: [] });
    expect(extractArticle(`<article><p>${'字'.repeat(199)} ${' '.repeat(500)}</p></article>`, URL)).toMatchObject({
      body: '字'.repeat(199),
      bodyStatus: 'short',
    });
    expect(extractArticle(`<article><p>${'字'.repeat(200)}</p></article>`, URL).bodyStatus).toBe('ok');
  });

  it('rejects challenge and paywall copy even when repeated enough to cross the body threshold', () => {
    const challenge = `<title>Just a moment...</title><article><p>${'Verify you are human. '.repeat(30)}</p></article>`;
    expect(extractArticle(challenge, URL)).toMatchObject({ body: null, bodyStatus: 'blocked' });
    const paywall = `<article><p>短導言</p><div class="paywall"><p>${'訂閱即可閱讀全文。'.repeat(30)}</p></div></article>`;
    expect(extractArticle(paywall, URL)).toMatchObject({ body: null, bodyStatus: 'blocked' });
    const structured = ld({
      '@type': 'NewsArticle',
      articleBody: 'Subscribe to read this article. '.repeat(30),
      isAccessibleForFree: false,
    });
    expect(extractArticle(structured, URL)).toMatchObject({ body: null, bodyStatus: 'blocked' });
  });

  it('keeps a complete accessible body when a subscription widget appears elsewhere on the page', () => {
    const html = `<article><p>${body}</p></article><div class="paywall"><p>訂閱即可閱讀其他文章</p></div><input name="cf-turnstile-response">`;
    expect(extractArticle(html, URL)).toMatchObject({ bodyStatus: 'ok', bodySource: 'article', body: normalizeBody(body) });
  });

  it('reads author metadata or scoped author markup without collecting arbitrary recommendation authors', () => {
    expect(extractArticle('<meta name="author" content="王記者"><meta name="author" content="李記者">', URL).authors).toEqual([
      '王記者',
      '李記者',
    ]);
    expect(
      extractArticle(
        '<article><span itemprop="author"><span itemprop="name">本文作者</span></span></article><aside><span itemprop="author">推薦作者</span></aside>',
        URL,
      ).authors,
    ).toEqual(['本文作者']);
  });
});

const normalizeBody = (value: string) => value.replace(/\s+/g, ' ').trim();

describe('publisher-declared excerpts across all extraction entrypoints', () => {
  const samples = [
    {
      url: 'https://nommagazine.com/reviewed-article/',
      selector: 'zh-content',
      marker: '本文為精彩摘要，欲下載完整圖解情報與詳細數據請前往圖解情報庫',
    },
    { url: 'https://tw.news.yahoo.com/news/reviewed-article-123456.html', selector: 'caas-body', marker: '全文未完，完整內容請見原站' },
    { url: 'https://tw.sports.yahoo.com/news/reviewed-article-123456.html', selector: 'caas-body', marker: '全文未完，完整內容請見原站' },
    {
      url: 'https://tw.news.yahoo.com/阿滴：學習要主動出擊，別被動接收-031821645.html',
      selector: 'module-article-body',
      marker: '全文未完，完整內容請見原站',
    },
    {
      url: 'https://tw.news.yahoo.com/吃飯也要潮，用故事激勵你大口吃肉-042947992.html',
      selector: 'module-article-body',
      marker: '全文未完，完整內容請見原站',
    },
  ];
  const article = (sample: (typeof samples)[number], markerInside = true) => {
    const container = (content: string) =>
      sample.selector === 'module-article-body'
        ? `<section class="module-article-body"><article><div class="atoms">${content}</div></article></section>`
        : `<div class="${sample.selector}">${content}</div>`;
    return `<title>真實文章標題</title>${ld({ '@type': 'NewsArticle', url: sample.url, datePublished: '2025-03-28T07:46:42Z', articleBody: body, author: { '@type': 'Person', name: '新聞記者' } })}${container(`<p>${body}</p>${markerInside ? `<p>${sample.marker}</p>` : ''}`)}${markerInside ? '' : `<aside>${container(`<p>${sample.marker}</p>`)}</aside>`}`;
  };
  it.each(samples)('does not mark a long excerpt as complete in shared runArticles extraction: $url', (sample) => {
    expect(extractArticle(article(sample), sample.url)).toMatchObject({
      body: null,
      bodyStatus: 'short',
      bodySource: 'publisher:excerpt',
      authors: ['新聞記者'],
    });
  });
  it.each(samples)('also rejects the excerpt through discovery and does not fall back to long JSON-LD: $url', async (sample) => {
    const fetch: typeof fetchText = async (url) => ({
      url,
      status: url === sample.url ? 200 : 404,
      body: url === sample.url ? article(sample) : '',
      contentType: 'text/html',
      ms: 1,
    });
    const result = await discoverNews(
      { homeUrl: new globalThis.URL(sample.url).origin + '/', articleUrls: [sample.url], includeArchive: true },
      { fetch, now: () => new Date('2026-10-03T00:00:00Z') },
    );
    expect(result.items).toEqual([]);
  });
  it.each(samples)('does not reject complete text because another article in a sidebar is an excerpt: $url', (sample) => {
    expect(extractArticle(article(sample, false), sample.url).bodyStatus).toBe('ok');
  });
  it('does not apply reviewed publisher declarations to unrelated sites', () => {
    const url = 'https://news.example/reviewed-article/';
    expect(extractArticle(article({ ...samples[0], url }), url).bodyStatus).toBe('ok');
  });
});
