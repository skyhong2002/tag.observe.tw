import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://www.natgeomedia.com/science/article/content-19458.html';
const title = '罕見超新星的報導';
const excerpt = '天文學家使用望遠鏡取得超新星遺骸的精細影像，發現氣體結塊形成如同珍珠鏈的结构，提供新的觀測證據。';
const page = `<meta property="og:url" content="${url}"><meta property="og:title" content="${title} - 國家地理雜誌中文網"><meta name="description" content="${excerpt}- 國家地理雜誌中文網"><div class="art-w65-left"><div class="content-title-area"><h1 class="content-title">${title}</h1></div><article class="text-black"><p>${excerpt}這是正文後續說明。</p></article></div>`;
it('removes only the own verified publication suffix from the publisher excerpt', () => {
  const a = extractArticle(page, url);
  expect(a.summary).toBe(excerpt);
  expect(a.summarySource).toBe('meta:description');
  expect(a.publishedAt).toBeNull();
});
it('keeps metadata when identity or prose does not corroborate suffix removal', () => {
  for (const html of [
    page.replace('content="' + url, 'content="https://www.natgeomedia.com/science/article/content-19459.html'),
    page.replace('class="content-title">' + title, 'class="content-title">其他標題'),
    page.replace(`<p>${excerpt}`, '<p>不同原文'),
  ])
    expect(extractArticle(html, url).summary).toContain('- 國家地理雜誌中文網');
});
