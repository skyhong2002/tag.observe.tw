import { describe, expect, it } from 'vitest';
import { hakkaArticleFromPublicApi } from './news-hakka-evidence.ts';

const url = 'https://www.hakkatv.org.tw/news-detail/1791369130715780';
const record = {
  id: '1791369130715780',
  status: 1,
  title: '中寮社區重陽活動完整新聞',
  created_at: '2026-10-07 20:00:34',
  author: '李永盛 南投中寮',
  content: '社區提供長者照護服務，並結合在地產業與文化活動。'.repeat(15),
};
describe('HakkaTV public API quality evidence', () => {
  it('retains the declared credit, article body and Taiwan timestamp without promoting a site description', () => {
    expect(hakkaArticleFromPublicApi(url, record)).toMatchObject({
      body: record.content,
      authors: ['李永盛 南投中寮'],
      publishedAt: new Date('2026-10-07T12:00:34Z'),
      summary: null,
      summarySource: null,
      bodySource: 'api:hakkatv',
    });
  });
  it.each([
    { ...record, id: '1791369130715781' },
    { ...record, status: 0 },
    { ...record, created_at: '' },
    { ...record, content: '短文' },
  ])('rejects mismatched, unpublished, undated or incomplete API records', (value) => {
    expect(hakkaArticleFromPublicApi(url, value)).toBeNull();
  });
  it('does not apply evidence from a different host or URL shape', () => {
    expect(hakkaArticleFromPublicApi('https://example.com/news-detail/1791369130715780', record)).toBeNull();
    expect(hakkaArticleFromPublicApi('https://www.hakkatv.org.tw/news', record)).toBeNull();
  });
});
