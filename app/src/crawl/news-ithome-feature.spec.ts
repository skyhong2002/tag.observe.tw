import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { sourceByMedia } from './registry.ts';

it('uses the own iThome feature introduction and matching supplied description after an empty global meta', () => {
  const url = 'https://www.ithome.com.tw/article/170893';
  const intro = '臺灣大型企業持續加碼資安預算，投資金額創新高。';
  const story = '這是旗下文章的介紹，不能當成專題自身的正文。'.repeat(8);
  const html = `<link rel="canonical" href="${url}"><meta name="description" content=""><meta name="description" content="${intro}"><article id="node-170893" class="node-featured-story"><header><h1>企業資安大調查</h1></header><div class="row-fluid"><div class="field-name-body"><div class="field-items"><div class="field-item"><p>${intro}</p></div></div></div></div></article><article class="node-info"><div class="submitted"><span class="author"><a href="/users/related">其他作者</a></span></div><p>${story}</p></article>`;
  expect(extractArticle(html, url, sourceByMedia('ithome')!.article)).toMatchObject({
    body: intro,
    bodySource: 'feature:ithome-description',
    bodyStatus: 'short',
    summary: intro,
    summarySource: 'meta:description',
    authors: [],
    publishedAt: null,
  });
  expect(extractArticle(html.replace(`content="${intro}"`, 'content="其他文章的摘要"'), url).summary).toBeNull();
  expect(extractArticle(html.replace(`content="${intro}"`, 'content=""'), url).summary).toBeNull();
  expect(extractArticle(html.replace('node-170893', 'node-000000'), url).bodySource).not.toBe('feature:ithome-description');
  expect(extractArticle(html.replace('class="node-featured-story"', 'class="node-info"'), url).bodySource).not.toBe(
    'feature:ithome-description',
  );
  expect(extractArticle(html, 'https://www.ithome.com.tw/news/170893').bodySource).not.toBe('feature:ithome-description');
});
