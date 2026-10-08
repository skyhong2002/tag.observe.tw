import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'https://www.cna.com.tw/news/aipl/202610080021.aspx';
const headline = '柏林國慶酒會';
const caption = '柏林國慶酒會合照。（駐德代表處提供）中央社記者林尚縈柏林傳真　115年10月8日';
const first = '（中央社記者林尚縈柏林7日專電）中華民國國慶酒會在柏林登場，多名議員出席。';
const rest = '友台小組主席指出，面對自由民主國家共同挑戰，應持續深化交流合作。'.repeat(8);
const body = `${caption}${first}\n\n${rest}`;
const node = {
  '@type': 'NewsArticle',
  url,
  headline,
  articleBody: body,
  author: { '@type': 'Person', name: '林尚縈' },
  datePublished: '2026-10-08T07:45:00+08:00',
};
const page = (record = node) =>
  `<head><link rel="canonical" href="${url}"><meta name="description" content="${first}"><script type="application/ld+json">${JSON.stringify(record)}</script></head><body><div class="centralContent"><h1>${headline}</h1><div class="fullPic"><figure><img><figcaption class="picinfo">${caption}</figcaption></figure></div><div class="paragraph"><p>${first}</p><p>${rest}</p></div><div class="paragraph appDownload"><p>下載中央社 APP</p></div></div></body>`;

it('removes only the own marked photo prefix corroborated by the following report, preserving author, summary and date', () => {
  expect(extractArticle(page(), url)).toMatchObject({
    body: `${first}\n\n${rest}`,
    bodySource: 'ld+json',
    authors: ['林尚縈'],
    summary: first,
    publishedAt: new Date('2026-10-07T23:45:00Z'),
  });
});

it('requires the own article identity, heading, caption marker and following prose', () => {
  for (const [html, address] of [
    [page(), 'https://example.com/news/aipl/202610080021.aspx'],
    [page().replace(`href="${url}"`, 'href="https://www.cna.com.tw/news/aipl/202610080022.aspx"'), url],
    [page({ ...node, headline: '另一篇新聞' }), url],
    [page().replace('class="picinfo"', 'class="ordinary-text"'), url],
    [page().replace(`<p>${first}</p>`, '<p>另一篇的正文</p>'), url],
  ])
    expect(extractArticle(html, address).body).toContain(caption.replace(/\s+/g, ' '));
});

it('preserves an ordinary report without a matching leading caption and does not remove caption wording in prose', () => {
  const unprefixed = { ...node, articleBody: `${first}\n\n${rest}\n\n${caption}` };
  expect(extractArticle(page(unprefixed), url).body).toBe(`${first}\n\n${rest}\n\n${caption.replace(/\s+/g, ' ')}`);
});

it('removes a separately marked trailing caption only when the entire remaining body equals own written paragraphs', () => {
  const trailing = '議員與代表合照。（代表處提供）';
  const record = { ...node, articleBody: `${body}${trailing}` };
  const html = page(record).replace(
    `</p></div><div class="paragraph appDownload">`,
    `</p><div class="media"><figure><figcaption class="picinfo">${trailing}</figcaption></figure></div></div><div class="paragraph appDownload">`,
  );
  expect(extractArticle(html, url).body).toBe(`${first}\n\n${rest}`);
  // An unmarked sentence or an upstream difference cannot be removed as a caption.
  expect(extractArticle(html.replace(`>${trailing}</figcaption>`, '>另一張照片</figcaption>'), url).body).toContain(trailing);
  expect(
    extractArticle(
      html.replace(JSON.stringify(record), JSON.stringify({ ...record, articleBody: `${record.articleBody}另一句原文。` })),
      url,
    ).body,
  ).toContain(trailing);
});
