import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { sourceByMedia } from './registry.ts';

const url = 'https://j-media.tw/Article/Detail/38688';
const prose = '主文介紹臺南好米季的稻田彩繪、健走與食農教育，邀請民眾參加活動。'.repeat(10);
const page = (credit: string) => `<link rel="canonical" href="${url}"><meta name="description" content="聚傳媒原站提供的活動摘要。">
  <meta property="article:published_time" content="2026-10-08T06:15:00+08:00">
  <article class="entry"><header class="single-post__entry-header"><h1 class="single-post__entry-title">臺南好米季</h1></header>
  <div class="entry__article-wrap"><div class="entry__article"><div><p>${credit}<br>${prose}</p></div></div></div></article>
  <aside><p>【聚傳媒特約記者王小明報導】其他報導</p></aside>`;
const rules = sourceByMedia('j_media')!.article;

it('reads the complete own reporter declaration after its photo caption without crediting the government or sidebar', () => {
  const result = extractArticle(page('照片取自臺南市政府<br>【聚傳媒特約記者陳欣如報導】'), url, rules);
  expect(result.authors).toEqual(['陳欣如']);
  expect(result.summary).toBe('聚傳媒原站提供的活動摘要。');
  expect(result.publishedAt?.toISOString()).toBe('2026-10-07T22:15:00.000Z');
  expect(result.body).toContain(prose);
});

it('accepts the same main reporter declaration when no photo caption precedes it', () => {
  expect(extractArticle(page('【聚傳媒記者陳欣如報導】'), url, rules).authors).toEqual(['陳欣如']);
});

it('reads the complete own columnist role with a corroborating name in the main heading and cleans its supplied wrapper', () => {
  const credit = '照片為電影預告截圖【聚論壇鄭自隆專欄】';
  const excerpt = '主文介紹臺南好米季的稻田彩繪、健走與食農教育，邀請民眾參加活動。...';
  const html = page('照片為電影預告截圖<br>【聚論壇鄭自隆專欄】')
    .replace('臺南好米季</h1>', '鄭自隆》專欄評論</h1>')
    .replace('聚傳媒原站提供的活動摘要。', credit + excerpt);
  expect(extractArticle(html, url, rules)).toMatchObject({ authors: ['鄭自隆'], summary: excerpt, summarySource: 'meta:description' });
  for (const invalid of [
    html.replace('鄭自隆》專欄評論', '其他作者》專欄評論'),
    html.replaceAll('【聚論壇鄭自隆專欄】', '【聚論壇鄭自隆專欄'),
    html.replace('照片為電影預告截圖<br>【聚論壇', '受訪者表示【聚論壇'),
  ])
    expect(extractArticle(invalid, url, rules).authors).toEqual([]);
});

it('handles a standalone opening movie photo caption before the own columnist paragraph and a supplied excerpt crossing paragraphs', () => {
  const prefix = '照片為電影預告截圖【聚論壇鄭自隆專欄】';
  const excerpt = '專欄第一段。專欄第二段。...';
  const html = page('照片為電影預告截圖</p><p>【聚論壇鄭自隆專欄】專欄第一段。</p><p>專欄第二段。')
    .replace('臺南好米季</h1>', '鄭自隆》專欄評論</h1>')
    .replace('聚傳媒原站提供的活動摘要。', prefix + excerpt);
  expect(extractArticle(html, url, rules)).toMatchObject({ authors: ['鄭自隆'], summary: excerpt, summarySource: 'meta:description' });
  expect(extractArticle(html.replace('<p>照片為電影預告截圖</p>', '<p>受訪者提及電影。</p>'), url, rules).authors).toEqual([]);
});

it('does not infer a reporter from prose mentions, incomplete credits or newsroom placeholders', () => {
  for (const credit of [
    '照片取自臺南市政府',
    '受訪者表示【聚傳媒特約記者陳欣如報導】',
    '【聚傳媒特約記者陳欣如',
    '【聚傳媒記者編輯中心報導】',
  ]) {
    expect(extractArticle(page(credit), url, rules).authors).toEqual([]);
  }
});

it('removes only the corroborated own photo/byline wrapper while preserving the supplied excerpt and truncation', () => {
  const prefix = '照片取自臺南市政府【聚傳媒特約記者陳欣如報導】';
  const excerpt = '主文介紹臺南好米季的稻田彩繪、健走與食農教育，邀請民眾參加活動。...';
  const html = `<link rel="canonical" href="${url}">${page('照片取自臺南市政府<br>【聚傳媒特約記者陳欣如報導】')}`.replace(
    '聚傳媒原站提供的活動摘要。',
    prefix + excerpt,
  );
  expect(extractArticle(html, url, rules)).toMatchObject({ summary: excerpt, summarySource: 'meta:description', authors: ['陳欣如'] });
  for (const invalid of [
    html.replace(`href="${url}"`, 'href="https://j-media.tw/Article/Detail/1"'),
    html.replace('content="照片取自臺南市政府', 'content="照片取自其他網站'),
    html.replace(`content="${prefix}${excerpt}`, `content="${prefix}其他不相關故事內容...`),
  ]) {
    expect(extractArticle(invalid, url, rules).summary).not.toBe(excerpt);
  }
});
