import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { ownReporterAuthors } from './news-own-reporter.ts';

const ustv = 'https://news.ustv.com.tw/newsdetail/20261008A043';
const star = 'https://www.stheadline.com/politics/3623792/%E8%87%AA%E5%B7%B1';
const identity = (url: string, title: string, canonical = url) =>
  `<link rel="canonical" href="${canonical}"><meta property="og:url" content="${url}"><meta property="og:title" content="${title}">`;
const ustvPage = `${identity(ustv, '自己的新聞 | 科技 | 非凡新聞', ustv.replace('https:', 'http:'))}
  <meta name="author" content="非凡新聞"><main id="newsdetail"><div class="subject">自己的新聞</div>
  <div class="social-area"><div class="reporter">非凡新聞 / 記者<a href="/reporter/115">黃靖棻</a>, 攝影<a href="/reporter/54">陳昱志</a></div></div>
  <article><p>受訪者 Alice 與陳娣螢的話。</p><p>（記者黃靖棻、陳昱志／台北採訪報導）</p></article></main>
  <main id="newsdetail2"><div class="reporter">記者<a href="/reporter/1">別篇作者</a></div></main>`;
const starPage = `${identity(star, '自己的新聞', 'https://www.stheadline.com/politics/3623792/自己')}
  <div id="articlecontent_3623792"><div class="article-title"><h1>自己的新聞</h1></div><article id="3623792">
  <div class="content-body" itemprop="articleBody"><p>受訪者郭某說，記者：另一人。</p><p>記者：郭詠欣、李曉林</p><ad></ad></div></article></div>
  <aside><p>記者：推薦作者</p></aside>`;

it('uses the own USTV reporter role and excludes its photographer despite the combined terminal credit', () => {
  expect(ownReporterAuthors(load(ustvPage), ustv)).toEqual(['黃靖棻']);
  expect(extractArticle(ustvPage, ustv).authors).toEqual(['黃靖棻']);
  expect(ownReporterAuthors(load(ustvPage.replace(', 攝影<a href="/reporter/54">陳昱志</a>', '')), ustv)).toEqual(['黃靖棻']);
});
it('requires USTV own identity, subject and linked role structure', () => {
  for (const html of [
    ustvPage.replace('content="' + ustv, 'content="https://news.ustv.com.tw/newsdetail/20261008A044'),
    ustvPage.replace('href="http://news.ustv.com.tw', 'href="http://other.test'),
    ustvPage.replace('class="subject">自己的新聞', 'class="subject">別篇新聞'),
    ustvPage.replace('/reporter/115', 'https://other.test/reporter/115'),
    ustvPage.replace(' / 記者', ' / 攝影'),
    ustvPage.replace(', 攝影', ', 責任編輯'),
    ustvPage.replace('記者<a', '記者<span><a'),
    ustvPage + '<main id="newsdetail"></main>',
  ])
    expect(ownReporterAuthors(load(html), ustv)).toBeNull();
});
it('uses only the last plain own Star article reporter paragraph with matching encoded URL identity', () => {
  expect(ownReporterAuthors(load(starPage), star)).toEqual(['郭詠欣', '李曉林']);
  expect(extractArticle(starPage, star).authors).toEqual(['郭詠欣', '李曉林']);
  expect(ownReporterAuthors(load(starPage.replace('記者：郭詠欣、李曉林', '記者 高俊謙')), star)).toEqual(['高俊謙']);
  expect(ownReporterAuthors(load(starPage.replace('記者：郭詠欣、李曉林', '記者：陳翠瑩</p><p>攝影：葉偉豪')), star)).toEqual(['陳翠瑩']);
});
it('rejects Star narrative, quotes, captions, links, later prose and mismatched article identity', () => {
  for (const credit of [
    '受訪者說記者：郭詠欣、李曉林',
    '攝影：郭詠欣、李曉林',
    '<blockquote>記者：郭詠欣、李曉林</blockquote>',
    '<a href="/other">記者：郭詠欣、李曉林</a>',
    '記者：郭詠欣、李曉林</p><p>之後的正文',
    '記者：郭詠欣、李曉林</p><p>攝影：<a>葉偉豪</a>',
    '記者：郭詠欣、李曉林</p><p>葉偉豪攝影',
  ])
    expect(ownReporterAuthors(load(starPage.replace('記者：郭詠欣、李曉林', credit)), star)).toBeNull();
  for (const html of [
    starPage.replace('href="https://www.stheadline.com/politics/3623792', 'href="https://www.stheadline.com/politics/3623791'),
    starPage.replace('content="' + star, 'content="https://www.stheadline.com/politics/3623791/自己'),
    starPage.replace('<h1>自己的新聞', '<h1>別篇新聞'),
    starPage.replace('article id="3623792"', 'article id="3623791"'),
    starPage + '<div id="articlecontent_3623792"></div>',
  ])
    expect(ownReporterAuthors(load(html), star)).toBeNull();
  expect(ownReporterAuthors(load(starPage), 'https://other.test/politics/3623792/自己')).toBeNull();
});
