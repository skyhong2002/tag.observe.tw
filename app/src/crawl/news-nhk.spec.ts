import { describe, expect, it } from 'vitest';
import { discoverNhk, nhkArticle } from './news-nhk.ts';

const now = new Date('2026-10-04T00:00:00Z');
const id = '20261003de54017';
const row = {
  id,
  page_url: `/nhkworld/zt/news/${id}/`,
  title: '日本新聞測試報導',
  public_at: String(Date.parse('2026-10-03T01:00:00Z')),
  updated_at: String(now.getTime()),
  description: '摘要不應充當全文。',
  detail: '這是公共新聞完整內文，刊登日期應保留原始時間，並且不能被後來的更新時間取代。'.repeat(8),
};

describe('NHK public Traditional Chinese news', () => {
  it('uses full detail and publication time, preserving the public article URL', () => {
    const item = nhkArticle({ data: row }, id, now);
    expect(item?.publishedAt?.toISOString()).toBe('2026-10-03T01:00:00.000Z');
    expect(item?.url).toBe(`https://www3.nhk.or.jp${row.page_url}`);
    expect(item?.verifiedContent?.body).toBe(row.detail);
  });

  it('rejects mismatched identities, excerpts, missing dates, old and future stories', () => {
    for (const change of [
      { id: '20261003other' },
      { page_url: 'https://example.com/story' },
      { detail: row.description },
      { public_at: '' },
      { public_at: String(now.getTime() + 86400000) },
      { public_at: String(now.getTime() - 30 * 86400000) },
    ])
      expect(nhkArticle({ data: { ...row, ...change } }, id, now)).toBeNull();
  });

  it('reads only official JSON and stops requests on rate limiting', async () => {
    const requested: string[] = [];
    const result = await discoverNhk(
      { homeUrl: 'https://www3.nhk.or.jp/nhkworld/zt/news/' },
      {
        now: () => now,
        fetch: async (url) => {
          requested.push(url);
          return {
            url,
            status: requested.length === 1 ? 200 : 429,
            contentType: 'application/json',
            ms: 0,
            body: JSON.stringify({ data: [row, { ...row, id: '20261003other' }] }),
          };
        },
      },
    );
    expect(requested).toEqual([
      'https://www3.nhk.or.jp/nhkworld/data/zt/news/all.json',
      `https://www3.nhk.or.jp/nhkworld/data/zt/news/${id}.json`,
    ]);
    expect(result.samples).toHaveLength(0);
  });
});
