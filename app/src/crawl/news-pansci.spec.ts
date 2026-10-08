import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

const url = 'https://pansci.asia/archives/382371';
const title = '自己文章的標題';
const paragraph = '自己完整的科普文章段落，所有內容都要保留。'.repeat(20);
const own = `<section class="load_post" data-post_id="382371" data-url="${url}" data-title="${title}"><section><div class="post-title-box"><h1>${title}</h1></div><span class="post-text-blue"><a rel="author" href="/archives/author/careonline">careonline</a></span></section><div class="post-content-container"><div class="pansc-content" id="pansc-ad1">廣告和追蹤程式<script>tracking()</script></div><ul class="wp-block-list"><li>作者／<a href="https://www.careonline.com.tw/">照護線上編輯部</a></li><li>本文轉載自 Care Online 照護線上《<a href="https://www.careonline.com.tw/2024/06/kawasaki-disease-240605.html">${title}</a>》，歡迎喜歡這篇文章的朋友訂閱支持 Care Online 喔</li></ul><p>${paragraph}</p><h2>應保留的標題</h2><ul class="wp-block-list"><li>第一個條件</li><li>第二個條件</li></ul><p>這是討論廣告的正常文章段落。</p></div></section>`;
const page = `<link rel="canonical" href="${url}">${own}<section class="load_post" data-post_id="382372" data-url="https://pansci.asia/archives/382372"><a rel="author" href="/archives/author/promo">另一篇作者</a><div class="post-content-container"><p>相關文章內容</p></div></section>`;
it('keeps all own paragraphs, headings and list items while excluding the other infinite-scroll author', () => {
  const a = extractArticle(page, url);
  expect(a.authors).toEqual(['照護線上編輯部']);
  expect(a.body).toContain(paragraph);
  for (const text of ['應保留的標題', '第一個條件', '第二個條件', '討論廣告的正常文章段落']) expect(a.body).toContain(text);
  for (const text of ['追蹤程式', 'tracking()', '另一篇作者', '相關文章內容']) expect(a.body).not.toContain(text);
  expect(a.provider).toBe('Care Online 照護線上');
  expect(extractAttributions(a.body!, 'pansci', a.provider)[0]).toMatchObject({ media: 'careonline', countryCode: 'ZZ' });
});
it('requires numeric own section identity, matching own heading and canonical, and understood blocks', () => {
  for (const html of [
    page.replace('data-post_id="382371"', 'data-post_id="382370"'),
    page.replace('data-title="' + title, 'data-title="不同標題'),
    page.replace('rel="canonical" href="' + url, 'rel="canonical" href="https://pansci.asia/archives/382372'),
    page.replace('<h2>應保留的標題</h2>', '<div class="unreviewed-prose">必須檢查的正文</div>'),
    page + own,
  ])
    expect(extractArticle(html, url).bodySource).not.toBe('article:pansci-own-blocks');
});
it('requires an exact own linked original declaration before assigning the provider', () => {
  for (const html of [
    page.replace('www.careonline.com.tw/2024', 'other.test/2024'),
    page.replace('本文轉載自', '受訪者提到'),
    page.replace('data-post_id="382371"', 'data-post_id="382370"'),
  ])
    expect(extractArticle(html, url).provider).not.toBe('Care Online 照護線上');
});
