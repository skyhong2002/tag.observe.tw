import { MySqlDialect } from 'drizzle-orm/mysql-core';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import {
  contentArticle,
  contentStatus,
  loadMediaContent,
  parseContentId,
  parseContentPage,
  registerArticleContent,
} from './article-content.ts';

const fetched = new Date('2026-10-03T01:00:00Z');
const row = {
  id: 9,
  media: 'cna',
  title: '保存的報導',
  url: 'https://offline.example/news',
  image: 'https://offline.example/photo.jpg',
  publishedAt: fetched,
  tags: ['報導'],
  description: null,
  authors: [' 王記者 ', '王記者'],
  creator: '舊署名',
  body: '第一段。\n\n第二段 <script>alert(1)</script>',
  bodyStatus: 'ok',
  bodySource: 'article',
  contentFetchedAt: fetched,
  attributions: [],
  bodyChars: 33,
};
function fakeDb(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  const select = vi.fn().mockReturnValue(chain);
  return { db: { select } as unknown as Db, select, chain };
}
describe('stored article content', () => {
  it('validates positive safe integer ids, cursors and bounded page sizes', () => {
    for (const value of ['0', '-1', '1.2', ' 1', '01', '1e2', '9007199254740992', '__proto__', ['1']]) {
      expect(parseContentId(value)).toBeNull();
    }
    expect(parseContentId('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseContentPage({ q: ' 台積電 ', hours: '72' })).toEqual({ cursor: null, limit: 40, hours: 72, q: '台積電' });
    expect(parseContentPage({ q: 'x'.repeat(61) })).toBeNull();
    expect(parseContentPage({})).toEqual({ cursor: null, limit: 40 });
    expect(parseContentPage({ cursor: '9', limit: '100' })).toEqual({ cursor: 9, limit: 100 });
    expect(parseContentPage({ cursor: '9', hours: '72' })).toEqual({ cursor: 9, limit: 40, hours: 72 });
    for (const hours of ['0', '169', '2.5', 'all', '']) expect(parseContentPage({ hours })).toBeNull();
    for (const query of [{ cursor: '' }, { cursor: 'x' }, { limit: '101' }, { limit: '0' }, { limit: '2.5' }]) {
      expect(parseContentPage(query)).toBeNull();
    }
  });
  it('preserves missing, blocked and expiry states and never treats absent body as available', () => {
    for (const status of ['short', 'missing', 'blocked', 'error', 'expired'] as const)
      expect(contentStatus(status, 0, fetched)).toBe(status);
    expect(contentStatus('ok', 0, fetched)).toBe('missing');
    expect(contentStatus(null, 0, null)).toBe('not_fetched');
    expect(contentStatus(null, 0, fetched)).toBe('missing');
    expect(contentStatus(null, 10, fetched)).toBe('short');
    expect(contentStatus('ok', 200, fetched)).toBe('ok');
    expect(contentStatus('unknown', 0, null)).toBe('error');
  });
  it('keeps publisher identity separate and retains the supplied author byline', () => {
    expect(contentArticle(row)).toMatchObject({ authors: ['王記者'], publisher: { media: 'cna', country: '台灣' } });
    expect(contentArticle({ ...row, authors: null })).toMatchObject({ authors: ['舊署名'] });
  });
  it('pages with one lookahead row and selects character counts without selecting bodies', async () => {
    const { db, select, chain } = fakeDb([
      { ...row, id: 9 },
      { ...row, id: 8 },
      { ...row, id: 7 },
    ]);
    const result = await loadMediaContent(db, 'cna', { cursor: 10, limit: 2 });
    expect(result.articles.map((a) => a.id)).toEqual([9, 8]);
    expect(result).toMatchObject({ nextCursor: '8', count: 2, limit: 2 });
    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(select.mock.calls[0][0]).not.toHaveProperty('body');
    expect(result.articles[0]).not.toHaveProperty('body');
    expect(result.articles[0].image).toBe(row.image);
  });
  it('applies the publication window alongside the archive cursor', async () => {
    const { db, chain } = fakeDb([]);
    await loadMediaContent(db, 'rti', { cursor: 99, limit: 40, hours: 24 }, fetched);
    const query = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(query.sql).toContain('`articles`.`id` < ?');
    expect(query.sql).toContain('`articles`.`published_at` >= ?');
    expect(query.params).toEqual(['rti', 99, '2026-10-02 01:00:00.000']);
  });
  it('combines keyword, media and cursor filters with escaped LIKE wildcards', async () => {
    const { db, chain } = fakeDb([]);
    await loadMediaContent(db, 'rti', { cursor: 99, limit: 40, q: 'AI_10%' });
    const query = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(query.sql).toContain('JSON_CONTAINS');
    expect(query.params).toEqual(['rti', 99, '%AI\\_10\\%%', '%AI\\_10\\%%', 'AI_10%']);
  });
  it('serves preserved text with no source request and reports not found or invalid inputs', async () => {
    const { db, select } = fakeDb([row]);
    const app = Fastify();
    registerArticleContent(app, db);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('upstream is gone'));
    try {
      const response = await app.inject('/api/v1/articles/9/content');
      expect(response.statusCode).toBe(200);
      expect(response.json().content.body).toBe(row.body);
      expect(fetchSpy).not.toHaveBeenCalled();
      for (const path of [
        '/api/v1/articles/0/content',
        '/api/v1/media/cna/content?cursor=1.5',
        '/api/v1/media/cna/content?limit=101',
        '/api/v1/media/cna/content?hours=169',
      ]) {
        expect((await app.inject(path)).statusCode).toBe(400);
      }
      for (const path of ['/api/v1/media/unknown-content-outlet/content', '/api/v1/media/__proto__/content']) {
        expect((await app.inject(path)).statusCode).toBe(404);
      }
      expect(select).toHaveBeenCalledTimes(1);
      select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
      expect((await app.inject('/api/v1/articles/12/content')).statusCode).toBe(404);
    } finally {
      fetchSpy.mockRestore();
      await app.close();
    }
  });
});
