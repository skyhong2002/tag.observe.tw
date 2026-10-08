import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

const url = 'https://news.cctv.com/2026/10/08/ARTI5xLqIO8DknYSzHUjdAMG261008.shtml';
const title = '自己的新聞標題';
const page = `<meta property="og:title" content="${title}"><meta name="apple-mobile-web-app-title" content="${title}"><div class="title_area"><h1>${title}</h1><div class="info"><span id="author"></span><span class="source">新华社</span><span>2026年10月08日 11:15</span></div></div><div id="text_area"><p>${'原文完整的新聞段落。'.repeat(30)}</p></div>`;
it('uses the exact own source field without treating it as a reporter', () => {
  const a = extractArticle(page, url, { bodySelector: '#text_area' });
  expect(a.provider).toBe('新华社');
  expect(a.authors).toEqual([]);
  expect(extractAttributions(a.body!, 'cctv', a.provider)[0]).toMatchObject({ media: 'xinhua', evidence: '內容提供者：新华社' });
});
it('requires the matching own headline, printed date, unique header, and CCTV article route', () => {
  for (const html of [
    page.replace('content="' + title, 'content="其他標題'),
    page.replace('2026年10月08日', '2026年10月07日'),
    page + '<div class="title_area"><h1>相關報導</h1></div>',
    page.replace('<span class="source">新华社</span>', '<span class="source">央视网</span>'),
  ])
    expect(extractArticle(html, url).provider).toBeNull();
  expect(extractArticle(page, url.replace('news.cctv.com', 'other.test')).provider).toBeNull();
});
it('ignores recommendations and article mentions in the absence of the own declaration', () => {
  expect(
    extractArticle(
      page.replace('class="source">新华社', 'class="source">央视网') + '<aside><span class="source">新华社</span></aside>',
      url,
    ).provider,
  ).toBeNull();
});
it('uses the complete own terminal text reporter credit and excludes photographers and poster designers', () => {
  const html = page;
  const footer = '<p>新华社记者 张百慧 摄</p><p>文字记者：徐壮、邢拓</p><p>海报设计：马发展</p>';
  expect(extractArticle(html.replace('</p></div>', '</p>' + footer + '</div>'), url).authors).toEqual(['徐壮', '邢拓']);
  expect(extractArticle(html + '<aside>' + footer + '</aside>', url).authors).toEqual([]);
  expect(extractArticle(html.replace('</p></div>', '</p><p>受訪者提到文字记者：徐壮、邢拓</p></div>'), url).authors).toEqual([]);
});
