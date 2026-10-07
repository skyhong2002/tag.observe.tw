import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

it('reads FoodNext complete own interview and writing credits after its separate takeaways', () => {
  const url = 'https://www.foodnext.net/issue/paper/5098742327';
  const html = `<meta property="og:url" content="http://www.foodnext.net/issue/paper/5098742327"><meta name="author" content="食力 foodNEXT"><div><h1>原文章題名</h1><p class="date">2022/09/07</p><div class="post-content"><blockquote>你應該要知道的食事<p>獨立導讀。</p></blockquote><p>採訪＝林玉婷、李加祈<br>撰文＝李加祈</p><p>完整正文。</p></div><div class="Recommended-Entry"><p>撰文＝王小明</p><p class="date">2026/10/08</p></div></div>`;
  expect(extractArticle(html, url)).toMatchObject({ authors: ['林玉婷', '李加祈'], publishedAt: new Date('2022-09-06T16:00:00Z') });
  expect(extractArticle(html.replace('採訪＝林玉婷、李加祈<br>撰文＝李加祈', '撰文=食力企劃'), url).authors).toEqual(['食力企劃']);
  expect(extractArticle(html.replace('採訪＝林玉婷、李加祈<br>撰文＝李加祈', '撰文=王小明'), url).authors).toEqual(['王小明']);
  expect(
    extractArticle(html.replace('採訪＝林玉婷、李加祈<br>撰文＝李加祈', '採訪＝林玉婷、李加祈<br>撰文＝李加祈提供活動介紹'), url).authors,
  ).toEqual(['食力 foodNEXT']);
  expect(extractArticle(html.replace('paper/5098742327"', 'paper/0000000000"'), url).authors).toEqual(['食力 foodNEXT']);
  expect(extractArticle(html, 'https://example.com/issue/paper/5098742327').authors).toEqual(['食力 foodNEXT']);
});

it('reads AFP main author links without trailing separators while retaining declared adaptation credits', () => {
  const html =
    '<article><div class="sub-header"><span class="person-link"><a href="/writer">Gwen Roley</a>,</span><span class="person-link"><a href="/desk">AFP Canada</a></span><span class="person-link"><a href="/translation">AFP USA</a></span></div><div class="wrapper-body"><p>Own report.</p></div></article><aside><span class="person-link"><a href="/other">Other Author</a></span></aside>';
  expect(extractArticle(html, 'https://factcheck.afp.com/doc.afp.com.D2FE863').authors).toEqual(['Gwen Roley', 'AFP Canada', 'AFP USA']);
});
