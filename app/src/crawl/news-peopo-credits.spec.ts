import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://www.peopo.org/news/859660';
const title = '大村公共建設動土';
const credit = '［記者/賴杰宏/大村報導］';
const prose = '地方公共建設舉行動土典禮，縣府與居民討論工程進度與社會服務，預計未來提供更多完善設施。'.repeat(5);
const excerpt = prose.slice(0, 60) + '…';
const page = `<link rel="canonical" href="${url}"><meta property="og:description" content="${title}${credit}${excerpt}"><div id="block-peopo-content"><article class="node--type-post node--view-mode-full"><header><h1>${title}</h1></header><div class="node__content"><div class="field--name-body"><p><strong>${title}</strong></p><p><span><strong>${credit}</strong></span><br>${prose}</p></div></div></article></div><aside><strong>［記者/其他記者/大村報導］</strong></aside>`;
it('uses the own complete reporter declaration and cleans only its corroborated supplied summary wrapper', () => {
  expect(extractArticle(page, url)).toMatchObject({ authors: ['賴杰宏'], summary: excerpt, summarySource: 'meta:og:description' });
});
it('requires own canonical, repeated main title and reporter slot at the opening report', () => {
  for (const html of [
    page.replace(`href="${url}"`, 'href="https://www.peopo.org/news/1"'),
    page.replace(`<h1>${title}</h1>`, '<h1>其他標題</h1>'),
    page.replace('id="block-peopo-content"', 'id="other-content"'),
    page.replace(credit + '</strong>', '受訪者提到' + credit + '</strong>'),
  ])
    expect(extractArticle(html, url).authors).not.toContain('賴杰宏');
  expect(extractArticle(page, 'https://example.com/news/859660').authors).not.toContain('賴杰宏');
});
it('preserves independently supplied excerpts and rejects unrelated summary cleanup', () => {
  expect(extractArticle(page.replace(title + credit + excerpt, '獨立提供的新聞摘要。'), url).summary).toBe('獨立提供的新聞摘要。');
  expect(extractArticle(page.replace(title + credit + excerpt, title + credit + '另一篇不同報導內容與細節。'), url).summary).toContain(
    title,
  );
});
