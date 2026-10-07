import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

it('keeps Cool3c supplied excerpt while removing only a fully corroborated wrapper', () => {
  const url = 'https://www.cool3c.com/article/252732';
  const title = '日本清潔刷的新設計。';
  const excerpt = '磁吸式清潔刷結合彈性刷、刮水板與懸空收納，方便清潔水槽。';
  const description = `Vera發佈${title}，最新資訊於2026-10-08 01:17：${excerpt}#(252732)`;
  const node = {
    '@type': 'NewsArticle',
    mainEntityOfPage: url,
    headline: `${title} #家居 (252732) - Cool3c`,
    author: [{ '@type': 'Person', name: 'Vera' }],
    datePublished: '2026-10-08T01:17:00+08:00',
    description,
    articleBody: `完整正文開頭。${excerpt}另有更多內容。`,
  };
  const html = `<link rel="canonical" href="${url}"><h1>${title}</h1><meta name="author" content="Vera"><meta name="description" content="${description}"><script type="application/ld+json">${JSON.stringify(node)}</script>`;
  expect(extractArticle(html, url)).toMatchObject({
    summary: excerpt,
    summarySource: 'meta:description',
    authors: ['Vera'],
    publishedAt: new Date('2026-10-07T17:17:00Z'),
  });
  const partial = html.replaceAll(`${excerpt}#`, `。${excerpt}...#`).replace(`完整正文開頭。${excerpt}...`, `完整正文開頭。${excerpt}`);
  expect(extractArticle(partial, url).summary).toBe(`${excerpt}...`);
  expect(extractArticle(html.replace('name="author" content="Vera"', 'name="author" content="Other"'), url).summary).toBe(description);
  expect(extractArticle(html.replace('01:17:00+08:00', '02:17:00+08:00'), url).summary).toBe(description);
  expect(extractArticle(html.replace(`href="${url}"`, 'href="https://www.cool3c.com/article/other"'), url).summary).toBe(description);
  expect(extractArticle(html.replace(`完整正文開頭。${excerpt}`, '其他完全不同的正文。'), url).summary).toBe(description);
});
