import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { parseFeed } from './feed.ts';
import { publisherSummary } from './summary.ts';

const url = 'https://www.contentplatform.info/articles/528681/own-story/';
const title = '自己的文章標題';
const html = `<title>${title} | 報新聞 Mega News</title><link rel="canonical" href="${url}"><body class="single-post postid-528681"><div class="tdb-single-title"><h1 class="tdb-title-text">${title}</h1></div></body>`;
it('uses the own numeric article heading corroborated by the complete publisher suffix', () => {
  expect(extractArticle(html, url).title).toBe(title);
  expect(
    extractArticle(
      html.replace(title, '自己的　文章標題').replace(`<h1 class="tdb-title-text">${title}`, '<h1 class="tdb-title-text">自己的 文章標題'),
      url,
    ).title,
  ).toBe('自己的 文章標題');
});
it('requires exact own identity, headline and complete suffix without deleting story text', () => {
  for (const page of [
    html.replace('postid-528681', 'postid-528682'),
    html.replace('href="' + url, 'href="https://www.contentplatform.info/articles/1/another/'),
    html.replace(`<h1 class="tdb-title-text">${title}`, '<h1 class="tdb-title-text">另一篇文章'),
    html.replace(' | 報新聞 Mega News', ' | 報新聞'),
    html.replace('</body>', '<h1>推薦文章</h1></body>'),
    html.replace('</title>', '</title><meta property="og:title" content="其他新聞">'),
  ])
    expect(extractArticle(page, url).title).not.toBe(title);
  expect(extractArticle(html, 'https://another.example/articles/528681/own-story/').title).toBe(title + ' | 報新聞 Mega News');
});

it('rejects explicit photo captions only for the reviewed publisher RSS scope, preserving real supplied excerpts', () => {
  const caption = '《圖說》國慶晚會將由國內外藝人及表演團隊接力演出。 […]';
  expect(publisherSummary(caption, 'feed:description', title, url)).toEqual({ summary: null, summarySource: null });
  for (const [value, source, link, headline] of [
    [caption, 'meta:description', url, title],
    [caption, 'feed:description', 'https://another.example/articles/528681/story/', title],
    [caption, 'feed:description', 'https://www.contentplatform.info/articles/category/news/', title],
    [caption, 'feed:description', url, '《圖說》是一種藝術形式'],
    ['【記者陳小明報導】完整新聞重點。', 'feed:description', url, title],
  ])
    expect(publisherSummary(value, source, headline, link)).toEqual({ summary: value, summarySource: source });
});

it('passes the own RSS entry URL into caption exclusion while retaining other publisher excerpts', () => {
  const entries = [url, 'https://another.example/articles/528681/story/']
    .map(
      (link) =>
        `<item><title>${title}</title><link>${link}</link><description><![CDATA[<p>《圖說》國慶晚會將由表演團隊接力演出。 […]</p>]]></description></item>`,
    )
    .join('');
  const result = parseFeed(`<rss><channel>${entries}</channel></rss>`).items;
  expect(result[0].summary).toBeNull();
  expect(result[0].summarySource).toBeNull();
  expect(result[1].summary).toContain('《圖說》');
  expect(result[1].summarySource).toBe('feed:description');
});
