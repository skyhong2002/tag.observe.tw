import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://newcongress.tw/?p=38150';
const title = '市長，我失戀了';
const prose = '這是本文的第一段，討論城市裡的社會支持。'.repeat(20);
const credit = '作者：千水默內';
const excerpt = `${prose.slice(0, 180)}…`;
const page = () =>
  `<head><link rel="canonical" href="${url}"><meta property="og:title" content="${title} - "><meta name="description" content="${prose} ${credit}"><meta property="og:description" content="${excerpt}"></head><body><h1>網站名稱</h1><article id="post-38150" class="post"><header class="entry-header"><h1 class="entry-title">${title}</h1></header><div class="entry-content"><p>${prose}</p><p>${credit}</p><div class="sharedaddy">Share this</div><div class="jp-relatedposts">Related</div></div><footer class="entry-footer"><div class="entry-meta"><span class="byline"><span class="author vcard">千水默內</span></span></div></footer></article><aside><span class="author vcard">其他作者</span></aside></body>`;

it('keeps the declared pen name and selects the supplied OG excerpt instead of the full article description', () => {
  expect(extractArticle(page(), url)).toMatchObject({ authors: ['千水默內'], summary: excerpt, summarySource: 'meta:og:description' });
});

it('requires matching own identity and title before applying either correction', () => {
  for (const html of [
    page().replace('id="post-38150"', 'id="post-38151"'),
    page().replace(`${title} - `, '另一篇文章 - '),
    page().replace(`href="${url}"`, 'href="https://newcongress.tw/?p=38151"'),
  ]) {
    expect(extractArticle(html, url).summarySource).toBe('meta:description');
    expect(extractArticle(html, url).authors).not.toContain('千水默內');
  }
  expect(extractArticle(page(), 'https://example.com/?p=38150').summarySource).toBe('meta:description');
});

it('preserves a supplied shorter description and requires both matching writer credits', () => {
  expect(extractArticle(page().replace(`content="${prose} ${credit}"`, 'content="媒體提供的簡短摘要。"'), url).summary).toBe(
    '媒體提供的簡短摘要。',
  );
  expect(extractArticle(page().replace(`<p>${credit}</p>`, '<p>作者：另一位作者</p>'), url).authors).not.toContain('千水默內');
});
