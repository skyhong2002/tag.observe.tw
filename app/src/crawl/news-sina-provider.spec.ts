import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

const url = 'https://news.sina.cn/sh/2026-10-08/detail-iniunvxc7576770.d.html';
const title = '自己的社會報導';
const page = `<meta property="og:url" content="${url}"><meta property="og:title" content="${title}"><article class="art_box"><h1 class="art_tit_h1">${title}</h1><div class="art_content"><p class="art_p">来源：羊城晚报</p><p class="art_p">潮新闻报道，${'完整社會新聞的段落。'.repeat(30)}</p><p class="art_p">（羊城晚报•羊城派综合自潮新闻、羊城晚报•羊城派综合）</p></div></article>`;
it('corroborates the complete own source lead and footer, retaining unverified jurisdiction honestly', () => {
  const a = extractArticle(page, url);
  expect(a.provider).toBe('羊城晚报');
  expect(extractAttributions(a.body!, 'news_sina', a.provider)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ media: 'yangcheng_daily', evidence: '內容提供者：羊城晚报', countryCode: 'ZZ' }),
      expect.objectContaining({ media: 'tidenews', countryCode: 'ZZ' }),
    ]),
  );
});
it('requires own identity and complete independent source declarations, not recommendations', () => {
  for (const html of [
    page.replace('content="' + url, 'content="https://news.sina.cn/other'),
    page.replace('class="art_tit_h1">' + title, 'class="art_tit_h1">另一篇'),
    page.replace('来源：羊城晚报', '受訪者提到羊城晚报'),
    page.replace('（羊城晚报•羊城派综合自潮新闻、羊城晚报•羊城派综合）', ''),
    page.replace('来源：羊城晚报', '来源：其他媒体') + '<aside>来源：羊城晚报</aside>',
  ])
    expect(extractArticle(html, url).provider).not.toBe('羊城晚报');
});
it('keeps every own paragraph and excludes a site footer outside the verified article body', () => {
  const a = extractArticle(
    page + '<footer><p>举报邮箱：public-contact@example.test</p><p>Copyright © 1996-2026 SINA Corporation</p></footer>',
    url,
  );
  expect(a.bodySource).toBe('article:sina-own-paragraphs');
  expect(a.body).toContain('潮新闻报道');
  expect(a.body).toContain('羊城派综合自潮新闻');
  expect(a.body).not.toContain('举报邮箱');
  expect(a.body).not.toContain('Copyright');
  expect(
    extractArticle(page.replace('<p class="art_p">潮新闻', '<div>未檢查的正文</div><p class="art_p">潮新闻'), url).bodySource,
  ).not.toBe('article:sina-own-paragraphs');
});

it('allows corroborated empty image slots and hidden share image, but never silently drops prose', () => {
  const image =
    '<a href="JavaScript:void(0)"><figure class="art_img_mini j_p_gallery"><img src="image.jpg"><h2 class="art_img_tit"></h2></figure></a><div id="wx_pic" style="display:none;"><img src="share.png"></div>';
  const html = page.replace('</div></article>', image + '</div></article>');
  expect(extractArticle(html, url).bodySource).toBe('article:sina-own-paragraphs');
  for (const altered of [
    html.replace('<h2 class="art_img_tit"></h2>', '<h2 class="art_img_tit">照片說明</h2>'),
    html.replace('display:none;', 'display:block;'),
    html.replace('<img src="share.png">', '<p>正文段落</p>'),
    html.replace('image.jpg', 'image.jpg').replace('<img src="image.jpg">', '<span><img src="image.jpg"></span>'),
  ])
    expect(extractArticle(altered, url).bodySource).not.toBe('article:sina-own-paragraphs');
});
