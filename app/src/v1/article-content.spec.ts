import { MySqlDialect } from 'drizzle-orm/mysql-core';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import {
  contentArticle,
  contentStatus,
  loadArticleContent,
  loadMediaContent,
  parseContentId,
  parseContentPage,
  publicContentState,
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
  summary: null,
  summarySource: null,
  authors: [' 王記者 ', '王記者'],
  creator: '舊署名',
  body: '第一段。\n\n第二段 <script>alert(1)</script>',
  bodyStatus: 'ok',
  bodySource: 'article',
  contentFetchedAt: fetched,
  crawledAt: new Date('2026-10-01T00:00:00Z'),
  attributions: [],
  bodyChars: 33,
};
function fakeDb(rows: unknown[], discoveries: unknown[] = [], collections: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  const discoveryChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(discoveries) };
  const collectionChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(collections) };
  const select = vi.fn().mockReturnValueOnce(chain).mockReturnValueOnce(discoveryChain).mockReturnValue(collectionChain);
  const touchWhere = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
  const update = vi.fn(() => ({ set: () => ({ where: touchWhere }) }));
  return { db: { select, update } as unknown as Db, select, chain, discoveryChain, update, touchWhere };
}
describe('stored article content', () => {
  const soon = new Date('2026-10-05T00:00:00Z');
  it('shows the body only within seven days of publication and gives that as the deadline', async () => {
    const { db } = fakeDb([row]);
    const result = await loadArticleContent(db, row.id, soon);
    expect(result?.content).toMatchObject({ status: 'ok', body: row.body, chars: Array.from(row.body).length, source: 'article' });
    expect(result?.content.expiresAt?.toISOString()).toBe('2026-10-10T01:00:00.000Z');
  });
  it('reports a body past the reading window exactly like a deleted one', async () => {
    const later = new Date('2026-10-10T01:00:00Z');
    const hidden = (await loadArticleContent(fakeDb([row]).db, row.id, later))!.content;
    const deleted = (await loadArticleContent(fakeDb([{ ...row, body: null, bodyStatus: 'expired' }]).db, row.id, later))!.content;
    expect(hidden).toMatchObject({ status: 'expired', body: null, chars: 0, source: null });
    expect(hidden.expiresAt?.toISOString()).toBe('2026-10-10T01:00:00.000Z');
    expect({ ...hidden, source: null }).toEqual({ ...deleted, source: null });
  });
  it('never opens a fresh window for old articles fetched recently', async () => {
    const { db } = fakeDb([{ ...row, publishedAt: new Date('2011-01-01T00:00:00Z') }]);
    const result = await loadArticleContent(db, row.id, soon);
    expect(result?.content).toMatchObject({ status: 'expired', body: null, chars: 0 });
    expect(result?.content.expiresAt?.toISOString()).toBe('2011-01-08T00:00:00.000Z');
  });
  it('keeps reasons unrelated to storage and invents no deadline for never-acquired content', async () => {
    for (const bodyStatus of [null, 'blocked', 'missing', 'error']) {
      const absent = fakeDb([{ ...row, body: null, bodyStatus, contentFetchedAt: null }]);
      expect((await loadArticleContent(absent.db, row.id, soon))?.content.expiresAt).toBeNull();
    }
    expect(publicContentState('blocked', 0, new Date('2011-01-01T00:00:00Z'), soon).status).toBe('blocked');
    expect(publicContentState('short', 40, new Date('2011-01-01T00:00:00Z'), soon)).toEqual({
      status: 'expired',
      chars: 0,
      visible: false,
    });
  });
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
  it('exposes independent summary text and its provenance in article metadata', () => {
    expect(contentArticle({ ...row, summary: '編輯摘要', summarySource: 'article:selector' })).toMatchObject({
      summary: '編輯摘要',
      summarySource: 'article:selector',
      description: null,
    });
  });
  it('keeps publisher identity separate and retains the supplied author byline', () => {
    expect(contentArticle(row)).toMatchObject({ authors: ['王記者'], publisher: { media: 'cna', country: '台灣' } });
    expect(contentArticle({ ...row, authors: null })).toMatchObject({ authors: ['舊署名'] });
  });
  it('exposes verified date-only publications without inventing a publication clock time', () => {
    const article = contentArticle({
      ...row,
      media: 'cn_wsj',
      url: 'https://china.createsend1.com/t/j-e-ydlrkkiy-hynykddkd-r/',
      publishedAt: new Date('2025-10-08T00:00:00Z'),
    });
    expect(article).toMatchObject({ publishedDate: '2025-10-08', publishedDatePrecision: 'day' });
    expect(contentArticle({ ...row, url: article.url })).not.toHaveProperty('publishedDate');
    expect(contentArticle(row)).not.toHaveProperty('publishedDatePrecision');
  });
  it('hides the length and status of bodies past the reading window in media listings', async () => {
    const old = { ...row, id: 5, publishedAt: new Date('2026-09-01T00:00:00Z') };
    const { db } = fakeDb([{ ...row, id: 6 }, old]);
    const result = await loadMediaContent(db, 'cna', { cursor: null, limit: 40 }, new Date('2026-10-05T00:00:00Z'));
    expect(result.articles.map((a) => [a.id, a.bodyStatus, a.bodyChars])).toEqual([
      [6, 'ok', 33],
      [5, 'expired', 0],
    ]);
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
    expect(query.params).toEqual(['rti', 99, '%AI\\_10\\%%', '%AI\\_10\\%%', '%AI\\_10\\%%', 'AI_10%']);
  });
  it('loads discovery labels once per page while preserving the original publisher and article IDs', async () => {
    const sources = [
      { articleId: 9, media: 'google_news', url: 'https://news.google.com/articles/test', discoveredAt: fetched },
      { articleId: 9, media: 'dongtaiwang', url: 'https://dongtaiwang.com/news/test', discoveredAt: fetched },
      { articleId: 8, media: 'google_news', url: 'https://news.google.com/articles/test2', discoveredAt: fetched },
    ];
    const { db, select, discoveryChain } = fakeDb(
      [
        { ...row, id: 9 },
        { ...row, id: 8 },
        { ...row, id: 7 },
      ],
      sources,
    );
    const result = await loadMediaContent(db, 'cna', { cursor: null, limit: 2 });
    expect(select).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ sourceKind: 'publisher', publisher: { media: 'cna' } });
    expect(result.articles[0]).toMatchObject({ id: 9, media: 'cna', publisher: { media: 'cna' } });
    expect(result.articles[0].discoverySources).toHaveLength(2);
    expect(result.articles[1].discoverySources).toEqual([expect.objectContaining({ media: 'google_news', discoveredAt: fetched })]);
    const query = new MySqlDialect().sqlToQuery(discoveryChain.where.mock.calls[0][0]);
    expect(query.params).toEqual([9, 8]);
  });
  it.each(['google_news', 'dongtaiwang'])('uses the discovery relation for %s without reassigning publisher identity', async (media) => {
    const { db, chain } = fakeDb([row], [{ articleId: 9, media, url: 'https://example.com/discovery', discoveredAt: fetched }]);
    const result = await loadMediaContent(db, media, { cursor: 10, limit: 2, hours: 24 }, fetched);
    expect(result).toMatchObject({ sourceKind: 'discovery', publisher: null, count: 1 });
    expect(result.articles[0]).toMatchObject({
      id: 9,
      media: 'cna',
      publisher: { media: 'cna' },
      discoverySources: [expect.objectContaining({ media })],
    });
    const query = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(query.sql).toMatch(/exists\s*\(SELECT 1 FROM/);
    expect(query.sql).toContain('`article_discoveries`.`article_id` = `articles`.`id`');
    expect(query.sql).not.toContain('`articles`.`media` =');
    expect(query.params).toEqual([media, 10, '2026-10-02 01:00:00.000']);
  });
  it('returns no publisher for an empty discovery page and avoids a redundant relation query', async () => {
    const { db, select } = fakeDb([]);
    expect(await loadMediaContent(db, 'google_news', { cursor: null, limit: 40 })).toMatchObject({
      sourceKind: 'discovery',
      publisher: null,
      count: 0,
      articles: [],
    });
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('includes actual discovery URLs and dates on the reader without replacing original publication data', async () => {
    const discoveredAt = new Date('2026-10-03T05:00:00Z');
    const { db } = fakeDb([row], [{ articleId: 9, media: 'google_news', url: 'https://news.google.com/articles/test', discoveredAt }]);
    const result = await loadArticleContent(db, 9);
    expect(result?.article).toMatchObject({
      media: 'cna',
      url: row.url,
      publishedAt: fetched,
      discoverySources: [{ media: 'google_news', title: 'Google 新聞', url: 'https://news.google.com/articles/test', discoveredAt }],
    });
  });
  it('includes all actual collection memberships without changing article tags', async () => {
    const { db } = fakeDb(
      [row],
      [],
      [
        { id: 7, media: 'cna', title: '手動編選專題', kind: 'feature' },
        { id: 3, media: 'cna', title: '持續追蹤議題', kind: 'topic' },
      ],
    );
    const result = await loadArticleContent(db, 9);
    expect(result?.article.collections).toEqual([
      { id: '3', media: 'cna', title: '持續追蹤議題', kind: 'topic' },
      { id: '7', media: 'cna', title: '手動編選專題', kind: 'feature' },
    ]);
    expect(result?.article.tags).toEqual(row.tags);
  });
  it('serves preserved text with no source request and reports not found or invalid inputs', async () => {
    const { db, select } = fakeDb([row]);
    const app = Fastify();
    registerArticleContent(app, db);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('upstream is gone'));
    // The route reads the real clock; pin it inside the fixture's reading window.
    vi.useFakeTimers({ toFake: ['Date'], now: soon });
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
      expect(select).toHaveBeenCalledTimes(3);
      select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
      expect((await app.inject('/api/v1/articles/12/content')).statusCode).toBe(404);
    } finally {
      vi.useRealTimers();
      fetchSpy.mockRestore();
      await app.close();
    }
  });
});
