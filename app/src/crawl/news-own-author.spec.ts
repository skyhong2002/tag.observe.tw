import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { ownArticleAuthors } from './news-own-author.ts';

const title = '自己的報導';
const tmnu = 'https://www.tmnu.org.tw/news/4922';
const nhk = 'https://www3.nhk.or.jp/nhkworld/zt/news/nd-20261007de55607/';
function article(url: string, body = 'TMNU記者 涂長琨／綜合報導') {
  const isNhk = url === nhk;
  const org = isNhk ? 'NHK WORLD' : 'TMNU台灣多媒體新聞聯合網';
  const credit = { '@type': isNhk ? 'Organization' : 'Person', name: org, ...(isNhk ? { url: 'https://www3.nhk.or.jp/nhkworld/' } : {}) };
  const data = {
    '@type': isNhk ? 'NewsArticle' : 'Article',
    headline: title,
    articleSection: '部會新聞',
    mainEntityOfPage: isNhk ? url : { '@id': url },
    author: credit,
    publisher: { ...credit, '@type': 'Organization' },
  };
  return `<meta property="og:url" content="${url}"><meta property="og:title" content="${title}${isNhk ? ' | NHK WORLD-JAPAN News' : '_部會新聞 | 綜合新聞'}">
    <script type="application/ld+json">${JSON.stringify(data)}</script>${
      isNhk
        ? `<div class="p-article__head"><h1 class="c-title"><span class="c-title__text">${title}</span></h1></div>`
        : `<div class="article-heading"><h1 class="article-sebhead">${title}</h1></div><div class="article-body"><div class="article-content c-editor"><p><img src="photo.jpg"></p><p>資料圖(海委會提供)</p><hr><p>${body}</p><p>原文正文及受訪者的話。</p></div></div>`
    }`;
}
it('uses the own reporter line despite a publisher mislabeled Person, excluding the photo credit', () => {
  expect(ownArticleAuthors(load(article(tmnu)), tmnu)).toEqual(['涂長琨']);
});
it('requires matching own URL, headline and unique article structure', () => {
  for (const html of [
    article(tmnu).replace('content="' + tmnu, 'content="https://www.tmnu.org.tw/news/4921'),
    article(tmnu).replace('"@id":"' + tmnu, '"@id":"https://www.tmnu.org.tw/news/4921'),
    article(tmnu).replace('class="article-sebhead">' + title, 'class="article-sebhead">別篇標題'),
    article(tmnu) + '<div class="article-body"><div class="article-content c-editor"></div></div>',
  ])
    expect(ownArticleAuthors(load(html), tmnu)).toBeNull();
});
it('does not use quotes, photography, recommendations, or a later body mention as a byline', () => {
  for (const body of [
    '受訪者說：TMNU記者 涂長琨／綜合報導',
    '攝影 涂長琨',
    '<blockquote>TMNU記者 涂長琨／綜合報導</blockquote>',
    '<a href="/news/other">TMNU記者 涂長琨／綜合報導</a>',
  ])
    expect(ownArticleAuthors(load(article(tmnu, body)), tmnu)).toEqual([]);
  expect(ownArticleAuthors(load(article(tmnu, '沒有記者署名') + '<aside><p>TMNU記者 涂長琨／綜合報導</p></aside>'), tmnu)).toEqual([]);
});
it('recognizes NHK organizational authors without discarding a differently declared person', () => {
  expect(ownArticleAuthors(load(article(nhk)), nhk)).toEqual([]);
  expect(ownArticleAuthors(load(article(nhk).replace('"author":{"@type":"Organization"', '"author":{"@type":"Person"')), nhk)).toBeNull();
});
const ct = 'https://ct.org.tw/html/news/3-3.php?cat=12&article=1404576';
const ctPage = `<meta property="og:url" content="${ct}"><meta property="og:title" content="${title}"><meta name="author" content="lumiere-app.com">
  <div class="nine wide column"><h1 class="ui header my-0">${title}</h1><div class="author"><span>基督教論壇報</span><span class="writer"><a href="/html/search/author.php?select_type=news&author=論壇報編採">論壇報編採</a></span><a onclick="add_trace('N','1404576','');">追蹤</a></div></div><aside><h1>熱門文章</h1></aside>`;
it('rejects the CT technical template author when its own slot declares a collective newsroom', () => {
  expect(ownArticleAuthors(load(ctPage), ct)).toEqual(['論壇報編採']);
  expect(ownArticleAuthors(load(ctPage.replace("'1404576'", "'1404575'")), ct)).toBeNull();
  expect(ownArticleAuthors(load(ctPage.replace('author=論壇報編採', 'author=另一人')), ct)).toBeNull();
  expect(ownArticleAuthors(load(ctPage.replace('href="/html/search', 'href="https://other.test/html/search')), ct)).toBeNull();
});
