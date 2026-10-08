import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://www.zmedia.com.tw/Document/NewsDetail/44574';
const title = '本篇新聞報導';
const body = '自己的採訪與新聞內容。'.repeat(30);
const page = (credit = '') =>
  `<title>震傳媒Z.media ${title}</title><meta property="og:title" content="${title}"><meta property="og:url" content="${url}"><meta name="author" content="UDIGIT TECHNOLOGY CO.,LTD."><section class="newsDetail"><div class="article-group"><div class="info-group"><p class="title">${title}</p></div><article><p>${credit}${body}</p></article></div></section>`;
it('excludes only the own technical template metadata without inventing a reporter', () => {
  expect(extractArticle(page(), url).authors).toEqual([]);
});
it('retains a separately declared own reporter and independently supplied author metadata', () => {
  expect(extractArticle(page('【記者王小明／臺北報導】'), url).authors).toEqual(['王小明']);
  expect(extractArticle(page().replace('UDIGIT TECHNOLOGY CO.,LTD.', '王小明'), url).authors).toEqual(['王小明']);
});
it('requires own article identity and headline before excluding the technical field', () => {
  for (const html of [
    page().replace(`content="${url}"`, 'content="https://www.zmedia.com.tw/Document/NewsDetail/1"'),
    page().replace(`content="${title}"`, 'content="其他篇'),
  ])
    expect(extractArticle(html, url).authors).toContain('UDIGIT TECHNOLOGY CO.,LTD.');
  expect(extractArticle(page(), 'https://example.com/Document/NewsDetail/44574').authors).toContain('UDIGIT TECHNOLOGY CO.,LTD.');
});
