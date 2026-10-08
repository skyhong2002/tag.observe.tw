import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://health.tvbs.com.tw/exhibition/insomnia/2024/article_2-1.html';
const intro = '主廚示範麻油雞飯，雞肉與雞蛋含有色胺酸，幫助放鬆入眠。';
const html = `<html><head><title>好眠食譜／多吃雞蛋幫助入眠｜健康2.0</title><link rel="canonical" href="${url}"><meta name="description" content="${intro}"></head><body><section class="menu"><p>導航污染</p></section><section class="content9"><div class="title-wrapper"><h1>多吃雞蛋幫助入眠</h1><p class="mbr-text">◎ 整理／羅以容<br>◎ 諮詢專家／陳欣湄醫師．陳之穎主廚<br></p></div></section><section class="content1"><div class="container"><div class="row"><div><p class="mbr-text">${intro}<br><br><strong>食材準備：</strong><br>雞肉、雞蛋、糙米飯。</p></div></div></div></section><section class="image3"><img alt="照片人物"></section><section class="content1"><div class="container"><div class="row"><div><p class="mbr-text">作法step by step：<br>1. 炒香薑片。<br>2. 放入雞肉與米飯。</p></div></div></div></section><section class="video2"><p>看影片</p></section><section class="content1"><div class="container"><div class="row"><div><p class="mbr-text">${intro}延伸閱讀污染</p></div></div></div></section><footer>製作團隊污染</footer></body></html>`;

it('extracts the written recipe and its arranger, excluding experts, navigation and later story cards', () => {
  const article = extractArticle(html, url);
  expect(article).toMatchObject({ authors: ['羅以容'], bodySource: 'feature:tvbshealth-exhibition', summary: intro, publishedAt: null });
  expect(article.body).toContain('2. 放入雞肉與米飯。');
  expect(article.body).toContain('食材準備：\n\n雞肉、雞蛋、糙米飯。');
  expect(article.body).not.toMatch(/污染|看影片|陳欣湄|陳之穎/);
});

it('requires the reviewed host, path, own canonical and matching unique heading', () => {
  for (const [page, address] of [
    [html, 'https://example.com/exhibition/insomnia/2024/article_2-1.html'],
    [html, 'https://health.tvbs.com.tw/exhibition/insomnia/2024/index.html'],
    [html.replace(`href="${url}"`, 'href="https://health.tvbs.com.tw/other"'), url],
    [html.replace('好眠食譜／多吃雞蛋幫助入眠｜', '另一篇報導／'), url],
    [html.replace('</body>', '<h1>第二篇</h1></body>'), url],
  ])
    expect(extractArticle(page, address).bodySource).not.toBe('feature:tvbshealth-exhibition');
});

it('requires publisher summary corroboration and does not infer author names from expert credits', () => {
  expect(extractArticle(html.replace('◎ 整理／羅以容<br>', ''), url).authors).toEqual([]);
  expect(extractArticle(html.replace(`content="${intro}"`, 'content="另一篇摘要"'), url).bodySource).not.toBe(
    'feature:tvbshealth-exhibition',
  );
});
