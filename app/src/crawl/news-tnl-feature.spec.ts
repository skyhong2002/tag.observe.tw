import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://www.thenewslens.com/feature/crypto-hk';
const description = '除了虛擬資產工具的名字，你對虛擬加密貨幣的認識有多少？政府就監管加密貨幣交易諮詢大眾。';
const html = `<head><link rel="canonical" href="${url}"><meta name="description" content="${description}"></head><body><article class="album-list-wrapper"><section><div class="container intro-wrapper"><div class="item-info"><h1 class="item-title">虛擬資產，在香港的實質難關</h1><p>${description}</p></div></div></section><section><div class="section-title-wrapper"><div>製作團隊</div></div><p>Alex、Alvin</p><h2>目錄</h2><div class="lists-item-wrapper"><article><p>另一篇的正文污染</p><span class="byline">記者林小明報導</span></article></div></section></article></body>`;

it('selects the own album introduction without production names, linked reports or their bylines', () => {
  expect(extractArticle(html, url)).toMatchObject({
    body: description,
    summary: description,
    bodySource: 'feature:tnl-description',
    authors: [],
    publishedAt: null,
  });
});

it('retains a sponsored collection introduction without inventing its publication date or author', () => {
  expect(extractArticle(html.replace('<h1', '<span>SPONSORED</span><h1').replace('<p>Alex、Alvin</p>', ''), url)).toMatchObject({
    body: description,
    authors: [],
    publishedAt: null,
  });
});

it('requires own canonical, article path, one album and publisher excerpt matching the selected introduction', () => {
  for (const [page, address] of [
    [html, 'https://example.com/feature/crypto-hk'],
    [html, 'https://www.thenewslens.com/article/123'],
    [html.replace(`href="${url}"`, 'href="https://www.thenewslens.com/feature/another"'), url],
    [html.replace('album-list-wrapper', 'ordinary-article'), url],
    [html.replace(`content="${description}"`, 'content="另一篇摘要"'), url],
    [html.replace('</body>', '<article class="album-list-wrapper"></article></body>'), url],
  ])
    expect(extractArticle(page, address).bodySource).not.toBe('feature:tnl-description');
});
