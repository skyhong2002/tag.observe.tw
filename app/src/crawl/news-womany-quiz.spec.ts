import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://womany.net/collections/dragon-year';
const description = '測出潛意識要給你的龍年開運解方';
const html = `<head><link rel="canonical" href="${url}"><meta name="description" content="${description}"></head><body><h1 class="seo-title">龍年解答之書</h1><div class="entry-content"><div class="header"><h2 class="quiz-title"><img></h2></div><div class="description"><p>${description}</p><p class="quiz-playtime-counter">你是第 <span class="num">0</span> 個龍年開運的人！</p></div><div class="btn-group"><a id="quiz-start" href="#">點我進行心理測驗</a></div></div></body>`;

it('keeps the corroborated quiz introduction and supplied summary without the changing counter', () => {
  for (const count of ['0', '3021'])
    expect(extractArticle(html.replace('>0<', `>${count}<`), url)).toMatchObject({
      body: description,
      bodySource: 'feature:womany-quiz-description',
      bodyStatus: 'short',
      summary: description,
      authors: [],
      publishedAt: null,
    });
});

it('requires the own collection, canonical, quiz controls and matching publisher summary', () => {
  for (const [page, address] of [
    [html, 'https://example.com/collections/dragon-year'],
    [html, 'https://womany.net/read/article'],
    [html.replace(`href="${url}"`, 'href="https://womany.net/collections/other"'), url],
    [html.replace('id="quiz-start"', 'id="other"'), url],
    [html.replace('quiz-playtime-counter', 'ordinary-prose'), url],
    [html.replace(`content="${description}"`, 'content="另一篇介紹"'), url],
  ])
    expect(extractArticle(page, address).bodySource).not.toBe('feature:womany-quiz-description');
});
