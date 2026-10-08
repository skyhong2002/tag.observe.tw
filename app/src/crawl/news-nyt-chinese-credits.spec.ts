import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://cn.nytimes.com/usa/20260929/report/zh-hant/';
const title = '本篇新聞標題';
const prose = '這是記者採訪取得的本篇報導內容。'.repeat(25);
const page = () =>
  `<head><title>${title} - 紐約時報中文網</title><link rel="canonical" href="${url}"><meta name="description" content="媒體提供的摘要。"><meta property="article:published_time" content="2026-09-29T09:23:04+08:00"></head><body><h1></h1><article class="article-content"><div class="article-header"><header><h1>${title}</h1></header><div class="byline-row"><div class="byline"><address>SOUMYA KARLAMANGLA, AMY QIN</address><time datetime="2026-09-29T09:23:04+08:00">2026年9月29日</time></div></div></div><div class="article-body"><p>${prose}</p></div><div class="article-author">其他研究協作者與照片提供者。</div></article><aside><address>其他作者</address></aside></body>`;
it('extracts the two complete declared writers without their sibling date or footer contributors', () => {
  expect(extractArticle(page(), url)).toMatchObject({
    authors: ['SOUMYA KARLAMANGLA', 'AMY QIN'],
    summary: '媒體提供的摘要。',
    publishedAt: new Date('2026-09-29T01:23:04Z'),
  });
});
it('requires unique own canonical, header, title and address scope', () => {
  for (const html of [
    page().replace(`href="${url}"`, 'href="https://cn.nytimes.com/usa/20260929/other/zh-hant/"'),
    page().replace(`${title} - 紐約時報中文網`, '別篇標題 - 紐約時報中文網'),
    page().replace('class="byline-row"', 'class="other-row"'),
    page().replace('</address>', '</address><address>OTHER WRITER</address>'),
  ])
    expect(extractArticle(html, url).authors).not.toEqual(['SOUMYA KARLAMANGLA', 'AMY QIN']);
  expect(extractArticle(page(), 'https://example.com/usa/20260929/report/zh-hant/').authors).not.toEqual(['SOUMYA KARLAMANGLA', 'AMY QIN']);
});
it('does not guess a date or role that is embedded inside an unrecognized address value', () => {
  expect(extractArticle(page().replace('SOUMYA KARLAMANGLA, AMY QIN', 'AMY QIN2026年9月29日'), url).authors).not.toEqual(['AMY QIN']);
});
