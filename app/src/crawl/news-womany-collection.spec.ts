import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

it('reads Womany own collection introduction instead of one nested story or guide step', () => {
  const url = 'https://womany.net/collections/2026Unilever';
  const intro = '企業將多元共融理念帶入日常生活，支持女性參與並推動社會對話。'.repeat(8);
  const html = `<link rel="canonical" href="${url}"><meta name="description" content="原站獨立摘要。"><div class="body"><div class="container"><div><h1 class="seo-title">企劃題名</h1><section class="component editor"><div class="container"><p class="description desktop">${intro}</p><p class="description mobile">${intro}</p><a><article>只是一張故事卡片。</article></a></div></section><section class="component youtube"><div class="container"><p class="description">完整的企劃影片說明。</p></div></section><section class="component tag_articles"><div class="container"><p class="description">推薦文章不能算企劃介紹。</p></div></section><section class="component socialshare"><div class="container"><p class="description">分享按鈕文字。</p></div></section></div><footer><p>頁尾。</p></footer></div></div>`;
  expect(extractArticle(html, url)).toMatchObject({
    body: `${intro}\n\n完整的企劃影片說明。`,
    bodySource: 'feature:womany-description',
    bodyStatus: 'ok',
    summary: '原站獨立摘要。',
    authors: [],
    publishedAt: null,
  });
  expect(extractArticle(html.replace('class="seo-title"', 'class="unrelated"'), url).bodySource).not.toBe('feature:womany-description');
  expect(extractArticle(html.replace(`href="${url}"`, 'href="https://womany.net/collections/other"'), url).bodySource).not.toBe(
    'feature:womany-description',
  );
  expect(extractArticle(html, 'https://womany.net/read/article/123').bodySource).not.toBe('feature:womany-description');
});

it('preserves neutral and mobile-only Womany collection paragraphs without importing linked article prose', () => {
  const url = 'https://womany.net/collections/ChildWelfare';
  const html = `<link rel="canonical" href="${url}"><div class="body"><div class="container"><div><h1 class="seo-title">育兒企劃</h1><section class="component qa-fold"><div class="container"><p class="description">這是企劃提出的育兒問題。</p><span><article><p>單一步驟。</p></article></span></div></section><section class="component gallery"><div class="container"><p class="description mobile">這是企劃提供的補充說明。</p></div></section></div></div></div>`;
  expect(extractArticle(html, url)).toMatchObject({
    body: '這是企劃提出的育兒問題。\n\n這是企劃提供的補充說明。',
    bodyStatus: 'short',
    bodySource: 'feature:womany-description',
  });
});
