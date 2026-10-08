import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';

const url = 'https://www.huanqiu.com/article/ownReport';
const title = '自己的文化報導';
function page(source: string) {
  const encoded = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<title>${title}</title><meta property="og:url" content="${url}"><div class="data-container"><article><textarea class="article-aid">ownReport</textarea><textarea class="article-title">${title}</textarea><textarea class="article-time">1791424558707</textarea><textarea class="article-content">${encoded('<article><section><p>' + '文化報導的完整原文。'.repeat(30) + '</p></section></article>')}</textarea><textarea class="article-source-name">${encoded(source)}</textarea></article></div>`;
}
const source = '<a href="https://www.peopleapp.com/column/30053296435-500007730096">人民日报</a>';
it('recognizes the own linked original provider and records its source role using the independently registered outlet identity', () => {
  const a = extractArticle(page(source), url);
  expect(a.provider).toBe('人民日报');
  expect(extractAttributions(a.body!, 'huanqiu', a.provider)).toEqual([
    { media: 'people_daily', name: '人民日報', country: '中國', countryCode: 'CN', evidence: '內容提供者：人民日报', kind: 'explicit' },
  ]);
});
it('requires complete own article identity and the exact linked source declaration', () => {
  for (const html of [
    page(source).replace('article-aid">ownReport', 'article-aid">differentReport'),
    page(source).replace(`content="${url}"`, 'content="https://www.huanqiu.com/article/otherReport"'),
    page(source.replace('www.peopleapp.com', 'unknown.test')),
    page(source.replace('/column/30053296435-500007730096', '/unrelated')),
    page(source.replace('人民日报', '受访者')),
    page(source + '<span>其他来源</span>'),
    page('受访者提及人民日报'),
  ])
    expect(extractArticle(html, url).provider).not.toBe('人民日报');
});
it('does not turn recommendations or plain story mentions into an original provider', () => {
  const a = extractArticle(page('') + '<aside>' + source + '</aside>', url);
  expect(a.provider).toBeNull();
  expect(extractAttributions(a.body!, 'huanqiu', a.provider)).toEqual([]);
});
