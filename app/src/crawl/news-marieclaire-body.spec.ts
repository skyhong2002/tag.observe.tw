import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { marieclaireStructuredBody } from './news-marieclaire-body.ts';

const url = 'https://www.marieclaire.com.tw/lifestyle/travel/96328';
const title = '旅行新動向';
const prose = `第一章節正文談到「延伸閱讀：」字樣與旅遊來源引用（https://example.org/）。${'旅遊設施與航線的詳細新聞內容。'.repeat(25)}`;
const suffix = '延伸閱讀：其他旅宿新聞其他郵輪新聞';
const node = { '@type': 'NewsArticle', url, headline: title, articleBody: prose + suffix, author: { name: 'Sky Chen' } };
const html = `<link rel="canonical" href="${url}"><meta name="description" content="原站提供的旅遊摘要。">
  <script type="application/ld+json">${JSON.stringify(node)}</script><article><h1>${title}</h1>
  <div class="articleContent" id="content96328" itemprop="articleBody"><h2>第一章節</h2><p>${prose.slice(4)}</p>
  <p class="extendArticle">延伸閱讀：</p><ul class="extendArticle"><li><a href="/lifestyle/travel/92739">其他旅宿新聞</a></li><li><a href="/lifestyle/travel/92347">其他郵輪新聞</a></li></ul></div></article>`;

it('removes only the terminal DOM-proven related list while retaining headings, citations, byline and publisher summary', () => {
  const result = extractArticle(html, url);
  expect(result.body).toBe(prose);
  expect(result.bodySource).toBe('ld+json');
  expect(result.authors).toEqual(['Sky Chen']);
  expect(result.summary).toBe('原站提供的旅遊摘要。');
});

it.each([
  ['canonical', html.replace(`href="${url}"`, 'href="https://www.marieclaire.com.tw/lifestyle/travel/1"')],
  ['container identity', html.replace('id="content96328"', 'id="content1"')],
  ['headline', html.replace(`<h1>${title}</h1>`, '<h1>其他文章</h1>')],
  ['changed visible prose', html.replace('<h2>第一章節</h2>', '<h2>其他章節</h2>')],
  ['unmarked list', html.replaceAll('class="extendArticle"', 'class="unknown"')],
  ['nonterminal list', html.replace('</div></article>', '<p>後續正文</p></div></article>')],
  ['external list', html.replace('/lifestyle/travel/92739', 'https://example.org/lifestyle/travel/92739')],
])('preserves structured prose when %s does not corroborate removal', (_, changed) => {
  expect(marieclaireStructuredBody(load(changed), url, node)).toBe(node.articleBody);
});
