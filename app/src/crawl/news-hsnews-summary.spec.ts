import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://hsnews.com.tw/political-news/own-report.html';
const title = '地方服務報導';
const excerpt = '縣議員參選人走訪地方，分享市場改善與閱讀推廣經驗，並表示公共服務需要持續傾聽居民的生活需求。';
const page = `<title>${title}</title><link rel="canonical" href="${url}"><meta property="og:title" content="${title}"><meta name="description" content="花蓮最速報即時訊息及花蓮新聞，在地報導！花蓮最速報提供您各地區最各類新聞報導，滿足您知的權利！"><meta property="og:description" content="${excerpt} {loadmoduleid..."><div class="article-details"><div class="article-header"><h1>${title}</h1></div><div itemprop="articleBody"><p>${excerpt}</p><p>${'更多自己的報導內容。'.repeat(30)}</p></div></div>`;
it('uses the supplied OG excerpt without the exact unresolved own module suffix', () => {
  expect(extractArticle(page, url)).toMatchObject({ summary: excerpt, summarySource: 'meta:og:description' });
});
it('requires own URL, headline, unique body and exact opening prose agreement', () => {
  for (const html of [
    page.replace(`href="${url}"`, 'href="https://hsnews.com.tw/political-news/other.html"'),
    page.replace(`content="${title}"`, 'content="另一篇"'),
    page.replace(`<p>${excerpt}</p>`, '<p>另一篇正文。</p>'),
    page.replace('class="article-details"', 'class="other-article"'),
  ])
    expect(extractArticle(html, url).summary).toContain('{loadmoduleid...');
  expect(extractArticle(page, 'https://example.com/political-news/own-report.html').summary).toContain('{loadmoduleid...');
});
it('preserves meaningful mentions and other template-like text without guessing repairs', () => {
  const independent = '花蓮最速報採訪地方團隊，介紹市場更新計畫。';
  expect(extractArticle(page.replace(`${excerpt} {loadmoduleid...`, independent), url).summary).toBe(independent);
  expect(extractArticle(page.replace('{loadmoduleid...', '{loadmoduleid 123}'), url).summary).toContain('{loadmoduleid 123}');
});
