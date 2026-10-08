import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://www.mdnkids.com/content.asp?Link_String_=24A800000TRLVRM';
const title = '校事會議修法';
const first = '教育部公布校事會議修法，維護教師合理管教權。';
const rest = '學校應依規定處理案件，並向家長說明理由。'.repeat(20);
const page = (credit = '沈育如／臺北報導') =>
  `<head><title>${title}─國語日報社</title><meta property="og:url" content="${url}"><meta name="description" content="${first} ${rest}"><meta property="og:description" content="${first} ${rest}"></head><body><div class="page_main_box"><div class="col col-md-12"><div class="row"><h2>${title}</h2><div><span>${credit}<br>(2026/10/8)</span></div></div><div><p>${first}</p><p>${rest}</p></div></div></div><aside><span>其他記者／臺北報導</span></aside></body>`;
it('extracts only the own complete reporter header credit and rejects whole-report descriptions', () => {
  expect(extractArticle(page(), url)).toMatchObject({ authors: ['沈育如'], summary: null, summarySource: null });
});
it('keeps an unsigned editorial unsigned and preserves a separately supplied excerpt', () => {
  expect(extractArticle(page(''), url)).toMatchObject({ authors: [], summary: null });
  expect(extractArticle(page().replace(`content="${first} ${rest}"`, `content="${first}"`), url).summary).toBe(first);
});
it('requires own parameter identity, title and unique article/paragraph scope', () => {
  for (const html of [
    page().replace(`content="${url}"`, 'content="https://www.mdnkids.com/content.asp?Link_String_=24A800000IUAHYG"'),
    page().replace(`${title}─國語日報社`, '另一篇─國語日報社'),
    page().replace('class="page_main_box"', 'class="other-box"'),
    page().replace('</h2>', '</h2><h2>其他標題</h2>'),
  ])
    expect(extractArticle(html, url).authors).not.toContain('沈育如');
  expect(extractArticle(page(), 'https://example.com/content.asp?Link_String_=24A800000TRLVRM').authors).not.toContain('沈育如');
});
