import { DatabaseSync } from 'node:sqlite';
import type { SQL } from 'drizzle-orm';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { articles, articleTags, crawlRuns, rejectedUrls } from '../db/schema.ts';
import type { FeedItem } from './feed.ts';
import { discoverNews } from './news-discovery.ts';
import { runArticles, runIndex } from './pipeline.ts';
import type { SourceSpec } from './sources.ts';
import { urlKey } from './text.ts';

vi.mock('./news-discovery.ts', () => ({ discoverNews: vi.fn() }));

const now = new Date('2026-10-03T08:00:00Z');
const publishedAt = new Date('2026-10-03T07:00:00Z');
const item: FeedItem = {
  url: 'https://publisher.example/news/123',
  title: '當日完整新聞',
  publishedAt,
  description: '這是摘要，不能代替正文。',
  creator: '來源記者',
  verifiedContent: {
    body: '記者實際採訪取得完整內容，這段文字已經由來源探索程序驗證。\n\n第二段包含報導的後續內容與結尾。',
    authors: ['來源記者'],
    bodySource: 'rss:content:encoded',
    bodyStatus: 'ok',
  },
};
const spec: SourceSpec = {
  media: 'publisher',
  group: 'hourly',
  list: { urls: [], autoDiscover: { homeUrl: 'https://publisher.example/' } },
  article: { enabled: true, batch: 10, delayMs: 0 },
};
type Row = Record<string, unknown> & { id: number; media: string; urlKey: string };

// The fluent double records writes; SQLite evaluates Drizzle's actual predicates.
// This catches guard regressions without duplicating their logic or opening a server DB.
function memoryDb(
  seed: Row[] = [],
  tagSeed: Array<{ articleId: number; tag: string; publishedAt: Date }> = [],
  articleTagTransaction = true,
) {
  const rows: Row[] = seed.map((row) => ({ source: 'own', ...row }));
  const tags = tagSeed.map((row) => ({ ...row }));
  const locks: string[] = [];
  let transactionDepth = 0;
  const writes: Array<{ table: unknown; values: Record<string, unknown>; condition: SQL }> = [];
  const selected: SQL[] = [];
  const columns = {
    id: 'id',
    source: 'source',
    media: 'media',
    url_key: 'urlKey',
    body_status: 'bodyStatus',
    fetched_at: 'fetchedAt',
    content_fetched_at: 'contentFetchedAt',
    content_attempts: 'contentAttempts',
    fetch_status: 'fetchStatus',
    published_at: 'publishedAt',
    crawled_at: 'crawledAt',
    url: 'url',
  };
  const value = (v: unknown): string | number | null =>
    v instanceof Date ? v.toISOString().replace('T', ' ').replace('Z', '') : typeof v === 'number' || typeof v === 'string' ? v : null;
  function matching(condition: SQL) {
    const sql = new MySqlDialect().sqlToQuery(condition);
    const sqlite = new DatabaseSync(':memory:');
    try {
      sqlite.exec(
        `CREATE TABLE articles (${Object.keys(columns)
          .map((name) => `\`${name}\``)
          .join(',')})`,
      );
      const insert = sqlite.prepare(
        `INSERT INTO articles VALUES (${Object.keys(columns)
          .map(() => '?')
          .join(',')})`,
      );
      for (const row of rows) insert.run(...Object.values(columns).map((key) => value(row[key])));
      const ids = new Set(
        sqlite
          .prepare(`SELECT id FROM articles WHERE ${sql.sql}`)
          .all(...sql.params.map(value))
          .map((r) => r.id),
      );
      return rows.filter((row) => ids.has(row.id));
    } finally {
      sqlite.close();
    }
  }
  const db = {
    async transaction<T>(callback: (tx: Db) => Promise<T>): Promise<T> {
      transactionDepth++;
      try {
        return await callback(db as unknown as Db);
      } finally {
        transactionDepth--;
      }
    },
    insert(table: unknown) {
      const chain = {
        ignore: () => chain,
        values(values: Record<string, unknown> | Array<Record<string, unknown>>) {
          if (table === crawlRuns) return { $returningId: async () => [{ id: 1 }] };
          let affectedRows = 0;
          for (const row of Array.isArray(values) ? values : [values]) {
            if (table === articleTags) {
              const tag = tags.find((tag) => tag.articleId === row.articleId && tag.tag === row.tag);
              if (tag) tag.publishedAt = row.publishedAt as Date;
              else tags.push(row as (typeof tags)[number]);
            }
            if (table === articles && !rows.some((r) => r.media === row.media && r.urlKey === row.urlKey)) {
              rows.push({ id: rows.length + 1, ...row } as Row);
              affectedRows++;
            }
          }
          return Object.assign(Promise.resolve([{ affectedRows }]), { onDuplicateKeyUpdate: async () => undefined });
        },
      };
      return chain;
    },
    update(table: unknown) {
      return {
        set: (values: Record<string, unknown>) => ({
          where: async (condition: SQL) => {
            writes.push({ table, values, condition });
            if (table === articleTags) {
              expect(transactionDepth).toBe(articleTagTransaction ? 1 : 0);
              const query = new MySqlDialect().sqlToQuery(condition);
              for (const tag of tags) if (tag.articleId === query.params[0]) tag.publishedAt = values.publishedAt as Date;
            }
            if (table === articles)
              for (const row of matching(condition)) {
                const attempts = Number(row.contentAttempts ?? 0);
                Object.assign(row, values);
                if (typeof values.contentAttempts === 'object') row.contentAttempts = attempts + 1;
              }
          },
        }),
      };
    },
    select() {
      return {
        from: (table: unknown) => ({
          where: (condition: SQL) => {
            if (table === rejectedUrls) return Promise.resolve([]);
            selected.push(condition);
            return Object.assign(Promise.resolve(matching(condition).map((row) => ({ ...row }))), {
              limit: (limit: number) => ({
                for: async (strength: string) => {
                  expect(transactionDepth).toBe(1);
                  locks.push(strength);
                  return matching(condition)
                    .slice(0, limit)
                    .map((row) => ({ ...row }));
                },
              }),
              orderBy: () => ({
                limit: async (limit: number) =>
                  matching(condition)
                    .slice(0, limit)
                    .map((row) => ({ ...row })),
              }),
            });
          },
        }),
      };
    },
  };
  return { db: db as unknown as Db, rows, tags, writes, selected, locks };
}

function discover(items: FeedItem[]) {
  vi.mocked(discoverNews).mockResolvedValue({
    items,
    errors: [],
    strategy: 'rss',
    listingUrl: 'https://publisher.example/feed',
    attempted: 1,
    samples: [],
  });
}

describe('discovered full content persistence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects headline-length RSS tags in both the article and ranking index', async () => {
    discover([{ ...item, tags: ['地方大小事', '高雄市', '經濟部「歡慶十月-精彩好市券」登場 高雄4處夜市連四週祭雙倍優惠'] }]);
    const { db, rows, tags } = memoryDb();
    await runIndex(db, spec, { now: () => now });
    expect(rows[0].tags).toEqual(['地方大小事', '高雄市']);
    expect(tags.map((tag) => tag.tag)).toEqual(['地方大小事', '高雄市']);
  });

  it('persists verified provider citations on both insert and body repair', async () => {
    discover([{ ...item, verifiedProvider: '新唐人電視台', summary: '經原站驗證的摘要', summarySource: 'article:selector' }]);
    const inserted = memoryDb();
    await runIndex(inserted.db, spec, { now: () => now });
    expect(inserted.rows[0].attributions).toEqual([expect.objectContaining({ media: 'ntdtv', evidence: '內容提供者：新唐人電視台' })]);
    expect(inserted.rows[0]).not.toHaveProperty('verifiedProvider');
    expect(inserted.rows[0]).toMatchObject({ summary: '經原站驗證的摘要', summarySource: 'article:selector' });
    const repaired = memoryDb([
      {
        id: 1,
        media: spec.media,
        urlKey: urlKey(item.url),
        title: item.title,
        publishedAt,
        crawledAt: now,
        bodyStatus: 'blocked',
        body: null,
      },
    ]);
    await runIndex(repaired.db, spec, { now: () => now });
    expect(repaired.rows[0].attributions).toEqual(inserted.rows[0].attributions);
    expect(repaired.rows[0]).not.toHaveProperty('verifiedProvider');
    expect(repaired.rows[0]).toMatchObject({ summary: '經原站驗證的摘要', summarySource: 'article:selector' });
  });

  it('preserves existing reporter credits when a retried page exposes no author', async () => {
    const { db, writes } = memoryDb([
      {
        id: 1,
        media: spec.media,
        urlKey: urlKey(item.url),
        url: item.url,
        title: item.title,
        publishedAt,
        crawledAt: now,
        fetchedAt: null,
        contentFetchedAt: null,
        authors: ['王小明'],
        creator: '王小明',
        tags: [],
      },
    ]);
    const fetch = vi.fn(async () => ({
      status: 200,
      body: '<html><article><p>這篇新聞沒有可辨識的記者署名，但仍有可供擷取的正文內容。</p></article></html>',
      url: item.url,
      contentType: 'text/html',
      ms: 1,
    }));
    expect(await runArticles(db, spec, { now: () => now, fetch })).toMatchObject({ updated: 1, failed: 0 });
    const update = writes.find((write) => write.table === articles && write.values.fetchStatus !== undefined);
    expect(update?.values.authors).toBeUndefined();
    expect(update?.values.creator).toBeUndefined();
  });

  it('preserves existing reporter credits when repaired feed content has no author', async () => {
    discover([{ ...item, verifiedContent: { ...item.verifiedContent!, authors: [] } }]);
    const { db, writes } = memoryDb([
      {
        id: 1,
        media: spec.media,
        urlKey: urlKey(item.url),
        title: item.title,
        publishedAt,
        crawledAt: now,
        bodyStatus: 'blocked',
        body: null,
        authors: ['王小明'],
        creator: '王小明',
      },
    ]);
    await runIndex(db, spec, { now: () => now });
    const repair = writes.find((write) => write.table === articles && write.values.body !== undefined);
    expect(repair?.values.body).toBe(item.verifiedContent?.body);
    expect(repair?.values.authors).toBeUndefined();
    expect(repair?.values.creator).toBeUndefined();
  });

  it('synchronizes feed creator with verified reporters on insert and body repair', async () => {
    discover([{ ...item, creator: '中央社' }]);
    const inserted = memoryDb();
    await runIndex(inserted.db, spec, { now: () => now });
    expect(inserted.rows[0]).toMatchObject({ authors: ['來源記者'], creator: '來源記者' });
    const repaired = memoryDb([
      {
        id: 1,
        media: spec.media,
        urlKey: urlKey(item.url),
        title: item.title,
        publishedAt,
        crawledAt: now,
        bodyStatus: 'blocked',
        body: null,
        creator: '中央社',
      },
    ]);
    await runIndex(repaired.db, spec, { now: () => now });
    expect(repaired.rows[0]).toMatchObject({ authors: ['來源記者'], creator: '來源記者' });
  });

  it('restores a newly acquired archive body without changing its historical publication date', async () => {
    const historical = new Date('2011-06-18T04:50:00Z');
    const acquired = new Date('2026-09-01T00:00:00Z');
    discover([{ ...item, publishedAt: historical }]);
    const { db, rows } = memoryDb([
      {
        id: 1,
        media: spec.media,
        urlKey: urlKey(item.url),
        title: item.title,
        publishedAt: historical,
        crawledAt: new Date('2020-01-01T00:00:00Z'),
        bodyStatus: 'expired',
        body: null,
        contentFetchedAt: acquired,
        contentAttempts: 1,
      },
    ]);
    await runIndex(db, spec, { now: () => now });
    expect(rows[0]).toMatchObject({ ...item.verifiedContent, publishedAt: historical, contentFetchedAt: acquired });
  });

  it.each([
    { label: 'recent legacy crawl timestamp', contentFetchedAt: null, crawledAt: now, restored: true },
    {
      label: 'exactly 90 days since acquisition',
      contentFetchedAt: new Date(now.getTime() - 90 * 86400e3),
      crawledAt: now,
      restored: true,
    },
    {
      label: 'over 90 days since acquisition despite a recent crawl',
      contentFetchedAt: new Date(now.getTime() - 90 * 86400e3 - 1),
      crawledAt: now,
      restored: false,
    },
    {
      label: 'expired legacy crawl timestamp',
      contentFetchedAt: null,
      crawledAt: new Date(now.getTime() - 90 * 86400e3 - 1),
      restored: false,
    },
  ])('honors the original archive lifetime: $label', async ({ contentFetchedAt, crawledAt, restored }) => {
    discover([item]);
    const original: Row = {
      id: 1,
      media: spec.media,
      urlKey: urlKey(item.url),
      title: item.title,
      publishedAt,
      crawledAt,
      bodyStatus: 'expired',
      body: null,
      contentFetchedAt,
      contentAttempts: 1,
    };
    const { db, rows, writes } = memoryDb([original]);
    await runIndex(db, spec, { now: () => now });
    if (restored) {
      expect(rows[0]).toMatchObject({ ...item.verifiedContent, contentFetchedAt: contentFetchedAt ?? crawledAt, contentAttempts: 2 });
      expect(writes.filter((write) => write.table === articles && write.values.source === undefined)).toHaveLength(1);
    } else {
      expect(rows[0]).toEqual({ source: 'own', ...original });
      expect(writes.filter((write) => write.table === articles && write.values.source === undefined)).toHaveLength(0);
    }
  });

  it('does not crawl recent legacy imports until the normal index rediscovers them', async () => {
    const acquired = new Date(now.getTime() - 3600e3);
    const { db, rows } = memoryDb([
      {
        id: 1,
        media: spec.media,
        urlKey: urlKey(item.url),
        url: item.url,
        title: 'Original legacy title',
        source: 'legacy',
        publishedAt,
        crawledAt: acquired,
        fetchedAt: null,
        contentFetchedAt: null,
        bodyStatus: null,
        tags: [],
        description: 'Legacy summary',
      },
    ]);
    const fetch = vi.fn(async () => ({ status: 404, body: '', url: item.url, contentType: 'text/html', ms: 1 }));
    expect(await runArticles(db, spec, { now: () => now, fetch })).toMatchObject({ fetched: 0 });
    expect(fetch).not.toHaveBeenCalled();
    discover([{ ...item, verifiedContent: undefined }]);
    await runIndex(db, spec, { now: () => now });
    expect(rows[0]).toMatchObject({
      source: 'own',
      crawledAt: now,
      publishedAt,
      title: 'Original legacy title',
      description: 'Legacy summary',
      fetchedAt: null,
      contentFetchedAt: null,
    });
    expect(await runArticles(db, spec, { now: () => now, fetch })).toMatchObject({ fetched: 1 });
  });

  it('persists verified body, author, provenance and timestamps at index time', async () => {
    discover([item]);
    const { db, rows } = memoryDb();
    const fetch = vi.fn();
    expect(await runIndex(db, spec, { now: () => now, fetch })).toEqual({ items: 1, inserted: 1, errors: [] });
    expect(rows[0]).toMatchObject({
      ...item.verifiedContent,
      media: spec.media,
      description: item.description,
      publishedAt,
      fetchedAt: now,
      contentFetchedAt: now,
      contentAttempts: 1,
      fetchStatus: 'notags',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('leaves summary-only discoveries pending for article extraction', async () => {
    const { verifiedContent: _content, ...summary } = item;
    discover([summary]);
    const { db, rows, writes } = memoryDb();
    await runIndex(db, spec, { now: () => now });
    expect(rows[0]).toMatchObject({ description: item.description, fetchedAt: null, fetchStatus: null });
    expect(rows[0]).not.toHaveProperty('body');
    expect(writes.filter((write) => write.table === articles && write.values.source === undefined)).toHaveLength(0);
    const fetch = vi.fn().mockResolvedValue({ url: item.url, status: 404, body: '', contentType: 'text/html', ms: 1 });
    expect(await runArticles(db, spec, { now: () => now, fetch })).toMatchObject({ fetched: 1, failed: 1 });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('never bypasses provider checks even when the listing creator matches the required provider', async () => {
    discover([item]);
    const { db, rows, writes } = memoryDb();
    const restricted = { ...spec, article: { ...spec.article, provider: '^來源記者$' } };
    await runIndex(db, restricted, { now: () => now });
    expect(rows[0]).toMatchObject({ creator: '來源記者', fetchedAt: null, fetchStatus: null });
    expect(rows[0]).not.toHaveProperty('body');
    expect(rows[0]).not.toHaveProperty('contentFetchedAt');
    expect(writes.filter((write) => write.table === articles && write.values.source === undefined)).toHaveLength(0);
    const fetch = vi.fn().mockResolvedValue({ url: item.url, status: 403, body: '', contentType: 'text/html', ms: 1 });
    expect(await runArticles(db, restricted, { now: () => now, fetch })).toMatchObject({ fetched: 1, failed: 1 });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('repairs an existing blocked row while preserving other publishers, URLs and valid bodies', async () => {
    discover([item]);
    const blocked: Row = {
      id: 1,
      media: spec.media,
      urlKey: urlKey(item.url),
      title: '',
      publishedAt: now,
      crawledAt: now,
      bodyStatus: 'blocked',
      body: null,
      contentAttempts: 2,
    };
    const { db, rows, writes } = memoryDb([
      blocked,
      { ...blocked, id: 2, media: 'other_publisher' },
      { ...blocked, id: 3, urlKey: urlKey('https://publisher.example/news/456') },
      { ...blocked, id: 4, bodyStatus: 'ok', body: 'Existing verified body' },
    ]);
    expect(await runIndex(db, spec, { now: () => now })).toMatchObject({ inserted: 0 });
    expect(rows[0]).toMatchObject({ ...item.verifiedContent, contentFetchedAt: now, contentAttempts: 3 });
    expect(rows[1]).toMatchObject({ bodyStatus: 'blocked', body: null, contentAttempts: 2 });
    expect(rows[2]).toMatchObject({ bodyStatus: 'blocked', body: null, contentAttempts: 2 });
    expect(rows[3]).toMatchObject({ bodyStatus: 'ok', body: 'Existing verified body', contentAttempts: 2 });
    const repair = writes.find((write) => write.table === articles && write.values.source === undefined);
    expect(repair).toBeDefined();
    const query = new MySqlDialect().sqlToQuery(repair!.condition);
    expect(query.params).toEqual([
      spec.media,
      urlKey(item.url),
      'missing',
      'short',
      'blocked',
      'error',
      'expired',
      new Date(now.getTime() - 90 * 86400e3),
    ]);
  });

  it('does not fetch the article again after index persisted valid body timestamps', async () => {
    discover([item]);
    const { db, rows, selected } = memoryDb();
    await runIndex(db, spec, { now: () => now });
    selected.length = 0;
    const fetch = vi.fn();
    expect(await runArticles(db, spec, { now: () => now, fetch })).toEqual({ fetched: 0, updated: 0, failed: 0, rejected: 0 });
    expect(selected).toHaveLength(2);
    expect(rows[0]).toMatchObject({ bodyStatus: 'ok', fetchedAt: now, contentFetchedAt: now });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('repairs missing title and fallback publication time together with existing ranking dates', async () => {
    discover([item]);
    const { db, rows, tags, locks } = memoryDb(
      [
        {
          id: 7,
          media: spec.media,
          urlKey: urlKey(item.url),
          url: item.url,
          title: '  ',
          publishedAt: now,
          crawledAt: now,
          bodyStatus: 'blocked',
          contentAttempts: 2,
        },
      ],
      [
        { articleId: 7, tag: '原有標籤', publishedAt: now },
        { articleId: 8, tag: '其他文章', publishedAt: now },
      ],
    );
    await runIndex(db, spec, { now: () => now });
    expect(locks).toEqual(['update']);
    expect(rows[0]).toMatchObject({ title: item.title, publishedAt, bodyStatus: 'ok' });
    expect(tags).toEqual([
      { articleId: 7, tag: '原有標籤', publishedAt },
      { articleId: 8, tag: '其他文章', publishedAt: now },
    ]);
  });

  it('preserves known title and publication time and uses that date for new feed tags', async () => {
    discover([{ ...item, tags: ['新標籤'] }]);
    const knownDate = new Date('2026-10-02T07:00:00Z');
    const { db, rows, tags, writes } = memoryDb(
      [
        {
          id: 7,
          media: spec.media,
          urlKey: urlKey(item.url),
          url: item.url,
          title: '已知正確標題',
          publishedAt: knownDate,
          crawledAt: now,
          bodyStatus: 'missing',
          contentAttempts: 1,
        },
      ],
      [{ articleId: 7, tag: '原有標籤', publishedAt: knownDate }],
    );
    await runIndex(db, spec, { now: () => now });
    expect(rows[0]).toMatchObject({ title: '已知正確標題', publishedAt: knownDate, bodyStatus: 'ok' });
    expect(tags).toEqual([
      { articleId: 7, tag: '原有標籤', publishedAt: knownDate },
      { articleId: 7, tag: '新標籤', publishedAt: knownDate },
    ]);
    expect(writes.filter((write) => write.table === articleTags)).toHaveLength(0);
  });
});

it('replaces reviewed feed modification time with page publication and moves ranking dates', async () => {
  const feedTime = new Date('2026-10-03T07:42:25Z');
  const pageTime = new Date('2026-10-03T03:50:14Z');
  const seed = {
    id: 7,
    media: spec.media,
    url: item.url,
    urlKey: urlKey(item.url),
    title: item.title,
    publishedAt: feedTime,
    crawledAt: now,
    fetchedAt: null,
    contentFetchedAt: null,
    contentAttempts: 0,
  };
  const fetch = async (url: string) => ({
    url,
    status: 200,
    body: `<meta property="article:published_time" content="${pageTime.toISOString()}"><script type="application/ld+json">{"@type":"NewsArticle","datePublished":"${pageTime.toISOString()}","dateModified":"${feedTime.toISOString()}"}</script><article><p>${'完整新聞正文。'.repeat(40)}</p></article>`,
    contentType: 'text/html',
    ms: 1,
  });
  const reviewed = memoryDb([seed], [{ articleId: 7, tag: '已存在標籤', publishedAt: feedTime }], false);
  expect(
    await runArticles(reviewed.db, { ...spec, article: { ...spec.article, preferPagePublication: true } }, { now: () => now, fetch }),
  ).toMatchObject({ updated: 1, failed: 0 });
  expect(reviewed.rows[0].publishedAt).toEqual(pageTime);
  expect(reviewed.tags[0].publishedAt).toEqual(pageTime);
  const ordinary = memoryDb([seed]);
  expect(await runArticles(ordinary.db, spec, { now: () => now, fetch })).toMatchObject({ updated: 1, failed: 0 });
  expect(ordinary.rows[0].publishedAt).toEqual(feedTime);
});
