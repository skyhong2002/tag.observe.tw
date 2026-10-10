import { MySqlDialect } from 'drizzle-orm/mysql-core';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { buildVocab } from '../crawl/title-tags.ts';
import type { Db } from '../db/client.ts';
import {
  compareKeywords,
  KEYWORD_SAMPLE_LIMIT,
  keywordBaseline,
  loadMediaKeywords,
  mediaKeywordTerms,
  peerGroup,
  registerMediaKeywords,
} from './media-keywords.ts';

const vocab = buildVocab([
  { tag: '台積電', n: 50 },
  { tag: '半導體', n: 40 },
  { tag: 'AI', n: 20 },
]);
describe('media keyword cloud', () => {
  it('excludes source aliases even when old title suffixes reintroduce them', () => {
    const brands = buildVocab([{ tag: '自由時報電子報', n: 500 }]);
    expect(mediaKeywordTerms([{ title: '台股上漲 | 自由時報電子報', tags: ['自由財經', '台積電'] }], brands, 'ltn')).toEqual([
      { label: '台積電', count: 1 },
    ]);
  });
  it('excludes the outlet name from stored tags and title matches, while keeping other media', () => {
    const brands = buildVocab([
      { tag: '世界新聞網', n: 50 },
      { tag: '紐約時報', n: 20 },
    ]);
    const rows = [{ title: '新聞標題 | 世界新聞網', tags: [' 世界新聞網 ', '紐約時報'] }];
    expect(mediaKeywordTerms(rows, brands, 'worldjournal')).toEqual([{ label: '紐約時報', count: 1 }]);
    expect(mediaKeywordTerms(rows, brands, 'udn')).toContainEqual({ label: '世界新聞網', count: 1 });
  });
  it('counts each keyword once per article, enriches titles and drops broad categories', () => {
    const result = mediaKeywordTerms(
      [
        { title: '台積電 AI 半導體', tags: ['國際', '台積電', '台積電', 'AI'] },
        { title: '半導體進展', tags: ['半導體', '財經'] },
        { title: 'AIRBUS', tags: [] },
      ],
      vocab,
    );
    expect(Object.fromEntries(result.map((r) => [r.label, r.count]))).toEqual({ 半導體: 2, AI: 1, 台積電: 1 });
    expect(mediaKeywordTerms([], vocab)).toEqual([]);
  });
  it('samples across the time window independently of list pagination and reports truncation', async () => {
    const rows = Array.from({ length: KEYWORD_SAMPLE_LIMIT + 1 }, () => ({ title: '台積電', tags: [] }));
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    const select = vi.fn().mockReturnValue(chain);
    const now = new Date('2026-10-03T04:00:00Z');
    const result = await loadMediaKeywords({ select } as unknown as Db, 'rti', 24, vocab, now);
    expect(result).toMatchObject({ sampledArticles: 2000, capped: true, terms: [{ label: '台積電', count: 2000 }] });
    expect(result.from.toISOString()).toBe('2026-10-02T04:00:00.000Z');
    expect(select.mock.calls[0][0]).not.toHaveProperty('body');
    const query = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(query.params).toEqual(['rti', '2026-10-02 04:00:00.000', '2026-10-03 04:00:00.000']);
    expect(query.sql).not.toContain('`articles`.`id`');
  });
  it('rejects unknown media and invalid windows before any database access', async () => {
    const select = vi.fn();
    const app = Fastify();
    registerMediaKeywords(app, { select } as unknown as Db);
    try {
      for (const media of ['unknown', '__proto__']) expect((await app.inject(`/api/v1/media/${media}/keywords`)).statusCode).toBe(404);
      for (const hours of ['0', '169', '-1', '2.5', 'abc'])
        expect((await app.inject(`/api/v1/media/rti/keywords?hours=${hours}`)).statusCode).toBe(400);
      expect(select).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('drops punctuation-only tags', () => {
    expect(mediaKeywordTerms([{ title: '', tags: ['""', '--', '台積電'] }], vocab)).toEqual([{ label: '台積電', count: 1 }]);
  });
  it('compares an outlet with the baseline outlets of its own category only', () => {
    expect(peerGroup('ltn')).toBe('news');
    expect(peerGroup('bnext')).toBe('3c');
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => ({ media: 'ltn', title: '', tags: i < 6 ? ['松山機場', 'AI'] : ['AI'] })),
      ...Array.from({ length: 90 }, (_, i) => ({ media: i % 2 ? 'cna' : 'setn', title: '', tags: i < 3 ? ['松山機場'] : ['AI'] })),
      // Not a baseline outlet, and a tech site: neither enters the news pool.
      ...Array.from({ length: 50 }, () => ({ media: 'worldjournal', title: '', tags: ['AI'] })),
      ...Array.from({ length: 50 }, () => ({ media: 'bnext', title: '', tags: ['松山機場'] })),
    ];
    const baseline = keywordBaseline(rows, vocab);
    expect(baseline.get('news')).toMatchObject({ articles: 100 });
    const result = compareKeywords(
      [
        { label: '松山機場', count: 6 },
        { label: 'AI', count: 10 },
      ],
      { media: 'ltn', sampledArticles: 10 },
      baseline,
    );
    expect(result.comparison).toEqual({ group: 'news', articles: 90, media: 2 });
    expect(result.terms).toEqual([
      { label: '松山機場', count: 6, share: 0.6, peerShare: 3 / 90, distinctive: true },
      { label: 'AI', count: 10, share: 1, peerShare: 87 / 90, distinctive: false },
    ]);
  });
  it('needs at least three articles and scales a capped sample before removing the outlet from its pool', () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({ media: 'ltn', title: '', tags: i < 20 ? ['罕見詞'] : [] })),
      ...Array.from({ length: 100 }, (_, i) => ({ media: 'cna', title: '', tags: i < 2 ? ['罕見詞'] : [] })),
    ];
    // The page saw 10 of ltn's 40 articles, 5 of them with the keyword: 20 of the
    // pool's 22 uses are ltn's own, leaving 2 among cna's 100 articles.
    const capped = compareKeywords([{ label: '罕見詞', count: 5 }], { media: 'ltn', sampledArticles: 10 }, keywordBaseline(rows, vocab));
    expect(capped.terms[0]).toMatchObject({ peerShare: 0.02, distinctive: true });
    const rare = compareKeywords([{ label: '罕見詞', count: 2 }], { media: 'ltn', sampledArticles: 4 }, keywordBaseline(rows, vocab));
    expect(rare.terms[0].distinctive).toBe(false);
    expect(compareKeywords([{ label: '罕見詞', count: 5 }], { media: 'ltn', sampledArticles: 10 }, null)).toMatchObject({
      comparison: null,
      terms: [{ peerShare: null, distinctive: false }],
    });
  });
});
