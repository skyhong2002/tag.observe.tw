import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

const text = '這是文章內容，引用受訪者說法並交代新聞背景。'.repeat(30);
function article(url: string, writer: string, translator: string, lead: string, closing = '') {
  const credit = (label: string, name: string) =>
    `<div class="contributor"><div class="contributor-name"><span class="credit-label">${label}</span><a class="user-link" href="https://zht.globalvoices.org/author/test/">${name}</a></div></div>`;
  return `<meta name="author" content="${writer}"><div class="post-header-container"><div class="post-header"><h2 class="post-title"><a rel="bookmark" href="${url}">新聞題名</a></h2><div class="post-header-credit"><div class="avatar-credits-container">${credit('作者 (English)', writer)}${credit('譯者 (繁體中文)', translator)}${credit('校對 (繁體中文)', '責任編輯')}</div></div></div></div><div class="full-article"><div class="post"><div class="entry-container"><div class="entry"><p>${lead}</p><p>${text}</p>${closing}</div></div></div></div>`;
}

it('keeps the Global Voices original writer and named translators while separating the supplying publisher account', () => {
  const url = 'https://zht.globalvoices.org/2024/12/22/36780/';
  const lead =
    '本文由Hans Tse撰寫，並於2024年12月12日刊登於《香港自由新聞》（Hong Kong Free Press，簡稱HKFP）。全球之聲根據夥伴協議重新刊登於此。';
  const html = article(
    url,
    'Hong Kong Free Press',
    '臺北科技大學應用英文研究所翻譯小組',
    lead,
    '<div class="methods">譯者：Gwendolyn Liu, Riley Hung, Young Chung</div>',
  );
  const parsed = extractArticle(html, url);
  expect(parsed).toMatchObject({ authors: ['Hans Tse', 'Gwendolyn Liu', 'Riley Hung', 'Young Chung'], provider: '香港自由新聞' });
  expect(extractAttributions(parsed.body!, 'gv', parsed.provider)).toContainEqual(
    expect.objectContaining({ media: 'hkfp', evidence: '內容提供者：香港自由新聞' }),
  );
  expect(extractArticle(html.replace('作者 (English)', '攝影 (English)'), url).authors).toEqual(['Hong Kong Free Press']);
  expect(extractArticle(html.replace('rel="bookmark"', 'rel="other"'), url).authors).toEqual(['Hong Kong Free Press']);
  expect(extractArticle(html.replace(`href="${url}"`, 'href="http://["'), url).authors).toEqual(['Hong Kong Free Press']);
  expect(extractArticle(html.replace('全球之聲根據夥伴協議重新刊登於此。', '有人提及這篇報導。'), url).provider).toBeNull();
});

it('preserves both the own English edition writer and declared original writer together with the Traditional Chinese translator', () => {
  const url = 'https://zht.globalvoices.org/2024/11/21/36727/';
  const lead = '本文原由 Alina Mikhalkina 撰寫，並於 2024 年 9 月 28 日首次刊載於 NewsMaker；現經全球之聲依內容共享協議，編譯、轉載於此。';
  const html = article(url, 'Anastasia Pestova', 'Tenn', lead);
  const parsed = extractArticle(html, url);
  expect(parsed).toMatchObject({ authors: ['Anastasia Pestova', 'Alina Mikhalkina', 'Tenn'], provider: 'NewsMaker' });
  expect(extractAttributions(parsed.body!, 'gv', parsed.provider)).toContainEqual(
    expect.objectContaining({ media: 'newsmaker', countryCode: 'ZZ' }),
  );
  expect(extractArticle(html.replace('本文原由', '受訪者提及本文原由'), url)).toMatchObject({
    authors: ['Anastasia Pestova', 'Tenn'],
    provider: null,
  });
  expect(extractArticle(html.replace('譯者 (繁體中文)', '譯者 (日本語)'), url).authors).toEqual(['Anastasia Pestova', 'Alina Mikhalkina']);
  expect(extractArticle(html.replace(url, 'https://zht.globalvoices.org/2024/11/21/99999/'), url).authors).toEqual(['Anastasia Pestova']);
  expect(extractArticle(html, 'https://example.com/2024/11/21/36727/').authors).toEqual(['Anastasia Pestova']);
});
