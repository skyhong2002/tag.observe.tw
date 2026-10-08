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

it('uses own visible paragraphs with explicit provenance when JSON-LD omits one headline subject at a paragraph opening', () => {
  const title = '蔡英文：台灣是不可或缺的夥伴';
  const intro = '（中央社記者葉素萍台北8日電）前總統蔡英文今天出席研討會並致詞。';
  const second = '蔡英文辦公室發布新聞稿指出，民主夥伴應結合各自的產業能力。';
  const photo = '前總統蔡英文演說。（辦公室提供）';
  const ownNode = {
    ...node,
    headline: title,
    articleBody: `${photo}${intro}辦公室發布新聞稿指出，民主夥伴應結合各自的產業能力。${rest}`,
    author: { '@type': 'Person', name: '葉素萍' },
  };
  const html = `<head><link rel="canonical" href="${url}"><meta name="description" content="媒體提供的摘要。"><script type="application/ld+json">${JSON.stringify(ownNode)}</script></head><div class="centralContent"><h1>${title}</h1><div class="fullPic"><figure><figcaption class="picinfo">${photo}</figcaption></figure></div><div class="paragraph"><p>${intro}</p><p>${second}</p><p>${rest}</p></div><div class="paragraph appDownload"><p>下載 APP</p></div></div>`;
  expect(extractArticle(html, url)).toMatchObject({
    body: `${intro}\n\n${second}\n\n${rest}`,
    bodySource: 'article:cna-paragraphs',
    authors: ['葉素萍'],
    summary: '媒體提供的摘要。',
    publishedAt: new Date('2026-10-07T23:45:00Z'),
  });
  // Other content changes or a subject absent from the own headline do not prove this correction.
  expect(extractArticle(html.replace(second, `${second}額外變動。`), url).bodySource).not.toBe('article:cna-paragraphs');
  expect(extractArticle(html.replaceAll(title, '民主夥伴研討會'), url).bodySource).not.toBe('article:cna-paragraphs');
  expect(extractArticle(html.replace(`<p>${second}</p>`, `<p hidden>${second}</p>`), url).bodySource).not.toBe('article:cna-paragraphs');
  expect(
    extractArticle(html.replace(`href="${url}"`, 'href="https://www.cna.com.tw/news/aipl/202610080022.aspx"'), url).bodySource,
  ).not.toBe('article:cna-paragraphs');
});
