import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://taiwannews.com.tw/en/news/6452738';
const title = 'AMD to increase Taiwan investment';
const datedTitle = title + ' | Taiwan News | Oct. 6, 2026 15:36';
const page = `<title>${datedTitle}</title><meta property="og:title" content="${datedTitle}"><meta property="og:url" content="${url}"><meta property="article:published_time" content="Oct. 6, 2026 15:36"><h1>${title}</h1><section class="max-w-2xl border-2 bg-light-2"><div><a href="/en/journalist/4539"><img alt="Lai Jyun-tang"></a><div><p><a href="/en/journalist/4539">Lai Jyun-tang</a></p><p class="text-gray-3 text-subtle-large">Taiwan News, Staff Writer</p></div></div></section><aside><a href="/en/journalist/999">Other Writer</a></aside><article>${'The own article report. '.repeat(30)}</article>`;
it('reads only the own named staff profile corroborated by its avatar link and article identity', () => {
  expect(extractArticle(page, url).authors).toEqual(['Lai Jyun-tang']);
});
it('rejects wrong article identity, inconsistent avatar, unnamed role and duplicate staff cards', () => {
  for (const html of [
    page.replace(`content="${url}"`, 'content="https://taiwannews.com.tw/en/news/1"'),
    page.replace(`content="${datedTitle}"`, 'content="Another article"'),
    page.replace('alt="Lai Jyun-tang"', 'alt="Other Writer"'),
    page.replace('Staff Writer', 'Other Role'),
    page.replace(
      '</section>',
      '</section><section class="max-w-2xl border-2 bg-light-2"><p class="text-gray-3 text-subtle-large">Taiwan News, Staff Writer</p></section>',
    ),
  ])
    expect(extractArticle(html, url).authors).not.toContain('Lai Jyun-tang');
});
it('does not use staff names from another host or a non-article route', () => {
  expect(extractArticle(page, url.replace('taiwannews.com.tw', 'example.com')).authors).not.toContain('Lai Jyun-tang');
  expect(extractArticle(page, url.replace('/en/news/', '/en/journalist/')).authors).not.toContain('Lai Jyun-tang');
});
