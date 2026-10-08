import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://i-media.tw/Article/Detail/51331';
const title = '反公害串連';
const prose = '民眾透過公民投票表達對環境保護的意見。'.repeat(20);
const excerpt = `${prose.slice(0, 100)}...`;
const page = () =>
  `<head><title>${title} | i-media 愛傳媒</title><meta property="og:title" content="${title} | i-media 愛傳媒"><meta property="og:url" content="https:///Article/Detail/51331"><meta property="og:description" content="楊渡/作家${excerpt}"></head><body><article class="entry"><h1 class="single-post__entry-title">${title}</h1><div class="entry__article-wrap"><div class="entry__share"><div class="fb-share-button" data-href="${url}"></div></div><div class="entry__article"><div id="articleContent"><p><strong>楊渡</strong><strong>/</strong><strong>作家</strong></p><p>${prose}</p></div></div></div></article><aside><p>王小明/作家</p></aside></body>`;
it('extracts the own opening writer role and preserves the supplied excerpt without its matching byline wrapper', () => {
  expect(extractArticle(page(), url)).toMatchObject({ authors: ['楊渡'], summary: excerpt, summarySource: 'meta:og:description' });
});
it('requires the complete own title, share identity, writer role and article scope', () => {
  for (const html of [
    page().replace(`data-href="${url}"`, 'data-href="https://i-media.tw/Article/Detail/51332"'),
    page().replace(`${title} | i-media 愛傳媒`, '另一篇 | i-media 愛傳媒'),
    page().replace('<strong>作家</strong>', '<strong>受訪者</strong>'),
    page().replace('id="articleContent"', 'id="otherContent"'),
  ])
    expect(extractArticle(html, url).authors).not.toContain('楊渡');
  expect(extractArticle(page(), 'https://example.com/Article/Detail/51331').authors).not.toContain('楊渡');
});
it('preserves an unrelated summary, without deleting a similar name occurring in the prose', () => {
  expect(extractArticle(page().replace(`楊渡/作家${excerpt}`, '受訪作家楊渡分享環境保護的故事。'), url).summary).toBe(
    '受訪作家楊渡分享環境保護的故事。',
  );
});
