import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { parseFeed } from './feed.ts';
import { dacotaOwnProse } from './news-dacota-body.ts';
import { publisherSummary } from './summary.ts';

const url = 'https://dacota.tw/blog/post/artcraft';
const title = '自己的創作者軟體報導';
const intro = '這篇文章介紹創作者使用的軟體、影像工作流程及開源工具，也說明相關技術與實際工作之間的差別。'.repeat(3);
const conclusion = '業界對”取代軟體”仍持保留態度，文章說明標準、更新成本及相容性的限制。'.repeat(3);
function page() {
  const description = `${intro}\r\n軟體介紹\r\n第一個工具及下載連結\r\n第二個工具及下載連結\r\n${conclusion.replaceAll('”', '"')}`;
  return `<link rel="canonical" href="${url}"><meta property="og:url" content="${url}"><meta property="og:title" content="${title}">
    <meta name="author" content="雲爸"><meta property="article:published_time" content="2026-10-08T15:00:52+08:00">
    <script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', mainEntityOfPage: { '@id': url }, headline: title, author: { '@type': 'Person', name: '雲爸' }, description })}</script>
    <body class="single-post postid-150741"><main id="genesis-content"><article class="post-150741 entry">
    <header class="entry-header"><h1 class="entry-title" itemprop="headline">${title}</h1><a class="entry-author-link" rel="author"><span class="entry-author-name">雲爸</span></a></header>
    <div class="entry-content"><div class="Zi_ad_ar_iR"><p>${intro}</p><h2>軟體介紹</h2><ul><li>第一個工具及下載連結</li><li>第二個工具及下載連結</li></ul><p>${conclusion}</p><iframe>影音嵌入</iframe><script>追蹤程式</script></div></div>
    </article><article><p>推薦文章與廣告</p></article></main><aside><p>側欄文字</p></aside></body>`;
}
it('restores all own paragraphs, headings and list items from the ad-named prose wrapper', () => {
  expect(dacotaOwnProse(load(page()), url)).toBe(
    [intro, '軟體介紹', '第一個工具及下載連結', '第二個工具及下載連結', conclusion].join('\n\n'),
  );
});
it('passes the verified own prose through the crawler while preserving its author, title and date', () => {
  const parsed = extractArticle(page(), url);
  expect(parsed.bodySource).toBe('article:dacota-own-prose');
  expect(parsed.bodyStatus).toBe('ok');
  expect(parsed.body).toContain(conclusion);
  expect(parsed.body).not.toContain('推薦文章');
  expect(parsed.authors).toEqual(['雲爸']);
  expect(parsed.title).toBe(title);
  expect(parsed.publishedAt?.toISOString()).toBe('2026-10-08T07:00:52.000Z');
  expect(
    extractArticle(page().replace('property="og:title" content="' + title, 'property="og:title" content="更新前的標題'), url).title,
  ).toBe(title);
});
it('requires own URL, post ID, heading, author and a unique own BlogPosting', () => {
  for (const html of [
    page().replace('href="' + url, 'href="https://dacota.tw/blog/post/other'),
    page().replace('content="' + url, 'content="https://dacota.tw/blog/post/other'),
    page().replace('postid-150741', 'postid-150742'),
    page().replace('class="entry-title" itemprop="headline">' + title, 'class="entry-title" itemprop="headline">別篇標題'),
    page().replace('class="entry-author-name">雲爸', 'class="entry-author-name">別人'),
    page().replace('"@id":"' + url, '"@id":"https://dacota.tw/blog/post/other'),
    page().replace('type="application/ld+json"', 'type="text/plain"'),
    page().replace('Zi_ad_ar_iR', 'advertisement'),
    page() + '<main id="genesis-content"><article class="post-150741 entry"></article></main>',
  ])
    expect(dacotaOwnProse(load(html), url)).toBeNull();
  expect(dacotaOwnProse(load(page()), 'https://other.test/blog/post/artcraft')).toBeNull();
});
it('rejects altered narrative or additional unsupported visible prose while retaining original rendered quote typography', () => {
  expect(dacotaOwnProse(load(page().replace('<p>' + conclusion, '<p>改過的敘事。' + conclusion)), url)).toBeNull();
  expect(dacotaOwnProse(load(page().replace('<iframe>', '<div>額外未查證段落</div><iframe>')), url)).toBeNull();
  expect(dacotaOwnProse(load(page().replace('<p>' + conclusion, '<p>' + conclusion.replace('相容性', '不同內容'))), url)).toBeNull();
});
it('cleans the exact own RSS trailer through parseFeed while preserving the supplied excerpt and other sources', () => {
  const excerpt = '媒體提供的摘要前段...';
  const description = `${excerpt} 繼續閱讀 The post ${title} first appeared on 雲爸的私處.`;
  const feed = parseFeed(
    `<rss><channel><item><title>${title}</title><link>${url}</link><description><![CDATA[${description}]]></description></item></channel></rss>`,
  ).items[0];
  expect(feed.summary).toBe(excerpt);
  expect(feed.summarySource).toBe('feed:description');
  for (const [source, heading, location] of [
    ['meta:description', title, url],
    ['feed:description', '另一個標題', url],
    ['feed:description', title, 'https://other.test/blog/post/artcraft'],
  ])
    expect(publisherSummary(description, source, heading, location).summary).toBe(description);
});
