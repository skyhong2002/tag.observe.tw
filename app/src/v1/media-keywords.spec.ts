import { MySqlDialect } from 'drizzle-orm/mysql-core';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { buildVocab } from '../crawl/title-tags.ts';
import type { Db } from '../db/client.ts';
import { KEYWORD_SAMPLE_LIMIT, loadMediaKeywords, mediaKeywordTerms, registerMediaKeywords } from './media-keywords.ts';

const vocab = buildVocab([
  { tag: '台積電', n: 50 },
  { tag: '半導體', n: 40 },
  { tag: 'AI', n: 20 },
]);
describe('media keyword cloud', () => {
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
});
