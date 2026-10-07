import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { parseFeed } from './feed.ts';
import { publisherSummary } from './summary.ts';

const body = '這是新聞正文的事實、訪談及完整說明。'.repeat(30);
describe('publisher summary metadata', () => {
  it('prefers PTS editorial summary without changing its separately structured body', () => {
    const html = `<h1>原文標題</h1><meta name="description" content="搜尋引擎摘要"><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', articleBody: body })}</script><div class="post-article"><div class="articleimg">媒體編輯的摘要，與正文分開。</div></div>`;
    const detail = extractArticle(html, 'https://news.pts.org.tw/article/830328');
    expect(detail).toMatchObject({
      summary: '媒體編輯的摘要，與正文分開。',
      summarySource: 'article:selector',
      description: '搜尋引擎摘要',
      body,
    });
  });
  it('does not apply a publisher selector on another host', () => {
    const detail = extractArticle(
      '<meta name="description" content="官方 metadata 摘要"><div class="post-article"><div class="articleimg">圖片說明</div></div>',
      'https://example.org/article/1',
    );
    expect(detail).toMatchObject({ summary: '官方 metadata 摘要', summarySource: 'meta:description' });
  });
  it('uses the matching article abstract instead of a recommendation abstract', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@graph': [
        { '@type': 'NewsArticle', url: 'https://example.org/other', abstract: '其他新聞摘要' },
        { '@type': 'NewsArticle', url: 'https://example.org/story', abstract: '本篇新聞摘要', articleBody: body },
      ],
    })}</script>`;
    expect(extractArticle(html, 'https://example.org/story')).toMatchObject({ summary: '本篇新聞摘要', summarySource: 'jsonld:abstract' });
  });
  it('labels description fallback and never synthesizes a summary from body prose', () => {
    expect(
      extractArticle(
        `<meta property="og:description" content="官方分享摘要"><article><p>${body}</p></article>`,
        'https://example.org/story',
      ),
    ).toMatchObject({ summary: '官方分享摘要', summarySource: 'meta:og:description' });
    expect(extractArticle(`<article><p>${body}</p></article>`, 'https://example.org/story')).toMatchObject({
      summary: null,
      summarySource: null,
    });
  });
  it('rejects title duplicates and full-text sized feed descriptions', () => {
    expect(publisherSummary('新聞標題', 'meta:description', '新聞標題').summary).toBeNull();
    expect(publisherSummary('文'.repeat(4001), 'feed:description').summary).toBeNull();
    expect(publisherSummary('摘要 &amp; 說明\n  第二句', 'meta:summary')).toEqual({
      summary: '摘要 & 說明 第二句',
      summarySource: 'meta:summary',
    });
  });
  it('skips verified site slogans and tries the article-specific social description', () => {
    const detail = extractArticle(
      '<meta name="description" content="lai賴傳媒新聞網追求公正、快速的新聞，讓讀者「看新聞就搜賴傳媒新聞網」。"><meta property="og:description" content="渣打銀行發布第4季展望，持續看好台灣股市。">',
      'https://lai-media.net/news_view.php?new_sn=145420',
    );
    expect(detail).toMatchObject({ summary: '渣打銀行發布第4季展望，持續看好台灣股市。', summarySource: 'meta:og:description' });
  });
  it('rejects whitespace-normalized headlines and standalone bylines', () => {
    expect(extractArticle('<h1>新聞　標題</h1><meta name="description" content="新聞 標題">', 'https://example.org/a').summary).toBeNull();
    expect(publisherSummary('【記者林文強/台北報導】', 'meta:description').summary).toBeNull();
    expect(publisherSummary('文/ 金融消費中心', 'meta:description').summary).toBeNull();
    expect(publisherSummary('迷音 Miin — Let me in!', 'meta:description').summary).toBeNull();
    expect(publisherSummary('記者林文強報導這項公共政策的影響。', 'meta:description').summary).not.toBeNull();
    expect(publisherSummary('記者王丹荷／綜合報導 韓國樂團宣布再度來臺，將舉辦巡迴演唱會。', 'meta:description').summary).not.toBeNull();
  });
  it('preserves RSS description and Atom summary provenance without using full Atom content', () => {
    const rss = parseFeed(
      '<rss><channel><item><title>標題</title><link>https://example.org/a</link><description>RSS摘要</description></item></channel></rss>',
    );
    expect(rss.items[0]).toMatchObject({ summary: 'RSS摘要', summarySource: 'feed:description' });
    const atom = parseFeed(
      '<feed><entry><title>標題</title><link href="https://example.org/a"/><summary>Atom摘要</summary><content>全文</content></entry></feed>',
    );
    expect(atom.items[0]).toMatchObject({ summary: 'Atom摘要', summarySource: 'feed:summary' });
    const noSummary = parseFeed(
      '<feed><entry><title>標題</title><link href="https://example.org/a"/><content>全文</content></entry></feed>',
    );
    expect(noSummary.items[0].summary).toBeNull();
  });
});
