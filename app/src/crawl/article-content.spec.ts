import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const URL = 'https://news.example/article/1';
const paragraph = '城市議會今天討論公共運輸政策，居民希望增加班次，主管機關表示將參考調查結果並公布後續規畫。';
const body = [paragraph.repeat(3), paragraph.repeat(3)].join('\n\n');
const ld = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

describe('article body and byline extraction', () => {
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
