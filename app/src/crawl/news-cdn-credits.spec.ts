import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://cdn-news.org/News.aspx?EntityID=News&PK=00000000a49b02ab3d038b51ababd7449de4c61bdddfae88';
const title = '企業領袖談信仰';
const page = `<title>${title}</title><meta property="og:title" content="${title}"><div class="news-details-layout2"><div class="container"><div class="row mb-20"><div class="mask-content-lg"><ul class="post-info-light"><li>特約記者&nbsp;莊堯亭</li><li>綜合報導</li><li>2026/10/08 09:12</li></ul><h2 class="size-c34">${title}</h2></div><div class="mask-content-xs"><ul class="post-info-light"><li>特約記者 莊堯亭 綜合報導</li><li>2026/10/08 09:12</li></ul></div></div></div></div><aside><div class="mask-content-lg"><li>特約記者 其他記者</li></div></aside><article>${'自己的報導正文。'.repeat(40)}</article>`;
it('uses only the own correspondent agreed by desktop and mobile article headers', () => {
  expect(extractArticle(page, url).authors).toEqual(['莊堯亭']);
});
it('rejects mismatched title, mobile credit, date and duplicate own header scope', () => {
  for (const html of [
    page.replace(`content="${title}"`, 'content="另一篇"'),
    page.replace('莊堯亭 綜合報導', '其他人 綜合報導'),
    page.replace('2026/10/08 09:12</li></ul></div></div>', '2026/10/07 09:12</li></ul></div></div>'),
    page.replace('<aside>', '<div class="news-details-layout2"><div class="container"><div class="row mb-20"></div></div></div><aside>'),
  ])
    expect(extractArticle(html, url).authors).not.toContain('莊堯亭');
});
it('requires the publisher host and complete article query identity', () => {
  for (const value of [
    url.replace('cdn-news.org', 'example.com'),
    url.replace('EntityID=News', 'EntityID=Other'),
    url.replace(/PK=.*/, 'PK=bad'),
  ])
    expect(extractArticle(page, value).authors).not.toContain('莊堯亭');
});
