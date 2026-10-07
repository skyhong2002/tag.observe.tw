import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

it('recognizes a BigMedia own article wire organization only from matching main and declared credits', () => {
  const url = 'https://www.bigmedia.com.tw/article/1791406803565';
  const html = `<link rel="canonical" href="${url}"><meta id="articleAuthor" property="article:author" content="鉅聞天下｜PR Newswire"><article class="article-read-block"><div class="article-header"><h1>Own report</h1><div class="article-meta"><span>2026-10-08 02:15</span><span>鉅聞天下｜作者  PR Newswire</span></div></div><div class="article-content"><p>Own prose.</p></div></article><footer><a href="https://www.prnewswire.com/news-releases/">PR Newswire</a></footer>`;
  const article = extractArticle(html, url);
  expect(article.provider).toBe('PR Newswire');
  expect(extractAttributions(article.body ?? '', 'bigmedia', article.provider).map((item) => item.media)).toEqual(['prnewswire']);
  expect(extractArticle(html.replace('作者  PR Newswire', '作者  王小明'), url).provider).not.toBe('PR Newswire');
  expect(extractArticle(html.replace('content="鉅聞天下｜PR Newswire"', 'content="鉅聞天下｜王小明"'), url).provider).not.toBe(
    'PR Newswire',
  );
  expect(extractArticle(html.replace(`href="${url}"`, 'href="https://www.bigmedia.com.tw/article/other"'), url).provider).not.toBe(
    'PR Newswire',
  );
});
