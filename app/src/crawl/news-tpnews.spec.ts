import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

const url = 'https://tpnews.org/tpnews-local-news-collection/local/2026/10/08/122500/report/';
const title = '網購水果的新聞';
const caption = '圖說：兩名警員協助民眾。';
const lead = '【民眾網編輯方笙楠臺北報導】臺北市警方發現超商內老翁遭到詐騙，及時上前協助，並勸阻匯款。';
function page(description = caption) {
  const data = {
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@id': url },
    url,
    headline: title,
    author: { '@type': 'Person', name: 'TPN新聞 實習編輯' },
    description: caption + ' ' + lead.slice(0, 40),
  };
  return `<link rel="canonical" href="${url}"><meta name="description" content="${description}"><script type="application/ld+json">${JSON.stringify(data)}</script><body class="postid-122500"><article class="p-entry l-primary"><div class="p-entry__inner"><div class="p-entry__header"><h1 class="p-entry__title">${title}</h1></div><div class="p-entry__body"><div><figure class="wp-caption"><figcaption class="wp-caption-text">${caption}</figcaption></figure><p>${lead}</p><p>完整新聞內容。${'文章內容的段落。'.repeat(30)}</p><p>原始新聞來源 <a href="https://taiwanpost.net/2026/local/174315/">${title}</a> <a href="https://taiwanpost.net/">臺灣郵報</a>.</p></div></div></div></article><aside><p>【民眾網編輯另一人臺北報導】相關文章</p></aside></body>`;
}
it('uses the own declared reporting editor and linked original rather than the import account', () => {
  const a = extractArticle(page(), url);
  expect(a.authors).toEqual(['方笙楠']);
  expect(a.provider).toBe('臺灣郵報');
  expect(extractAttributions(a.body!, 'tpnews', a.provider)[0]).toMatchObject({ media: 'taiwanpost', evidence: '內容提供者：臺灣郵報' });
});
it('falls back from an exact photo caption to the publisher supplied structured excerpt', () => {
  const a = extractArticle(page(), url);
  expect(a.summary).toBe(lead.slice(0, 40));
  expect(a.summarySource).toBe('jsonld:description');
  expect(extractArticle(page(lead), url).summary).toBe(lead);
});
it('requires own heading, canonical, post ID and complete reporting role', () => {
  for (const html of [
    page().replace('class="postid-122500"', 'class="postid-122501"'),
    page().replace('"@id":"' + url, '"@id":"https://tpnews.org/other'),
    page().replace('class="p-entry__title">' + title, 'class="p-entry__title">另一篇'),
    page().replaceAll('【民眾網編輯方笙楠臺北報導】', '【責任編輯方笙楠】'),
  ])
    expect(extractArticle(html, url).authors).not.toEqual(['方笙楠']);
});
it('does not infer the provider from a story mention or an unrelated footer link', () => {
  for (const html of [page().replace('原始新聞來源 ', '受訪者提到 '), page().replace('taiwanpost.net/2026', 'other.test/2026')])
    expect(extractArticle(html, url).provider).not.toBe('臺灣郵報');
});
