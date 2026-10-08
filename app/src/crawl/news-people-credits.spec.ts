import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const url = 'http://politics.people.com.cn/n1/2026/1008/c461001-40810262.html';
const title = '以文化滋养精神家园';
const prose = '自己的完整新聞報導內容。'.repeat(30);
const page = (credit = '本报记者  耿  磊  李卓尔', overseas = false, closing = '') => {
  const source = overseas ? '人民日报海外版' : '人民日报';
  return `<title>${title} --时政--人民网</title><meta name="contentid" content="40810262"><meta name="catalogs" content="461001"><meta name="publishdate" content="2026-10-08"><meta name="author" content="104665"><meta name="source" content="来源：${source}"><div class="rm_txt"><div class="col col-1"><h1>${title}</h1><div class="author cf">${credit}</div><div class="channel"><div class="col-1-1"><a href="http://paper.people.com.cn/${overseas ? 'rmrbhwb' : 'rmrb'}/pc/content/202610/08/content_30184429.html">人民网－${source}</a></div></div><div class="rm_txt_con"><div id="rm_txt_zw"><p>照片：其他人摄（人民图片）</p><p>${prose}</p><p>${closing}</p></div></div></div></div><aside><div class="author">本报记者 其他记者</div></aside>`;
};
it('uses the own reporter slot and dated original-paper source instead of numeric metadata', () => {
  expect(extractArticle(page(), url)).toMatchObject({ authors: ['耿磊', '李卓尔'], provider: '人民日报' });
});
it('reads the complete own closing wire reporter credit separately from photo and responsibility editors', () => {
  expect(extractArticle(page('', true, '（据新华社北京电 记者周慧敏、张格、蔡馨逸）'), url)).toMatchObject({
    authors: ['周慧敏', '张格', '蔡馨逸'],
    provider: '人民日报海外版',
  });
  expect(extractArticle(page('', true, '（编辑：其他人）'), url).authors).toEqual([]);
});
it('requires article IDs, publication date, own headline and exact matching original-paper link', () => {
  for (const html of [
    page().replace('content="40810262"', 'content="1"'),
    page().replace('content="2026-10-08"', 'content="2026-10-07"'),
    page().replace('/content/202610/08/', '/content/202610/07/'),
    page().replace(`<title>${title}`, '<title>另一篇'),
    page().replace('class="rm_txt"', 'class="other-article"'),
  ])
    expect(extractArticle(html, url).authors).not.toEqual(['耿磊', '李卓尔']);
  expect(extractArticle(page(), url.replace('politics.people.com.cn', 'example.com')).authors).not.toEqual(['耿磊', '李卓尔']);
});
