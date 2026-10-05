import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://example.com/news/1';
const prose = '市府今天公布公共運輸改善計畫，增加班次並邀請居民參與討論。'.repeat(10);
const ld = (body: string, name = '網站管理員') =>
  `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', url, articleBody: body, author: { '@type': 'Person', name } })}</script>`;

describe('reporter identity from the selected article', () => {
  it('prefers the visible opening reporter over a WordPress account', () => {
    expect(extractArticle(ld(prose) + `<div class="entry-content"><p>記者蔡佳坊／嘉義報導</p><p>${prose}</p></div>`, url).authors).toEqual([
      '蔡佳坊',
    ]);
  });
  it('reads an opening credit from JSON-LD without a DOM body', () => {
    expect(extractArticle(ld(`記者蔡佳坊／嘉義報導\n\n${prose}`), url).authors).toEqual(['蔡佳坊']);
  });
  it('does not credit an alternative body when the configured article has no byline', () => {
    const html =
      ld(prose, '本文作者') +
      `<div id="main"><p>${prose}</p></div><div class="article-body"><p>記者其他作者／台北報導</p><p>${prose}</p></div>`;
    expect(extractArticle(html, url, { bodySelector: '#main' }).authors).toEqual(['本文作者']);
  });
  it('does not mistake a later paragraph for the opening byline', () => {
    const html = ld(prose, '本文作者') + `<article><p>${prose}</p><p>記者其他作者／台北報導</p></article>`;
    expect(extractArticle(html, url).authors).toEqual(['本文作者']);
  });
  it('allows the opening credit after an obvious photo caption', () => {
    const html = `<article><p>▲公車站示意圖。（圖／資料照）</p><p>TMNU記者 陳們明／綜合報導</p><p>${prose}</p></article>`;
    expect(extractArticle(html, url).authors).toEqual(['陳們明']);
  });
  it('ignores author elements that are themselves hidden or related widgets', () => {
    const html =
      ld(prose, '本文作者') +
      '<div class="byline" hidden>記者隱藏作者／台北報導</div><div class="related byline">記者推薦作者／台北報導</div>';
    expect(extractArticle(html, url).authors).toEqual(['本文作者']);
  });
  it('uses a named lead reporter when the configured field only credits an agency', () => {
    const html = `<div class="credit">中央社</div><article><p>（中央社記者黎建忠名古屋3日電）${prose}</p></article>`;
    expect(extractArticle(html, url, { authorSelector: '.credit' }).authors).toEqual(['黎建忠']);
  });
  it('keeps declared organizational credits when no journalist is named', () => {
    expect(extractArticle('<meta name="author" content="中央社">' + `<article><p>${prose}</p></article>`, url).authors).toEqual(['中央社']);
  });
});
