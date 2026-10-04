import { DatabaseSync } from 'node:sqlite';
import type { SQL } from 'drizzle-orm';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import {
  archiveColdContent,
  type ContentRow,
  cacheAgeForSpace,
  cacheClock,
  decodeContent,
  encodeContent,
  restoreArticleContent,
} from './content.ts';
import { type ArchiveStore, digest } from './store.ts';

const row = {
  id: 1,
  media: 'cna',
  url: 'https://www.cna.com.tw/a',
  title: 'archive',
  body: '不可丟失的全文',
  description: '摘要',
  bodyStatus: 'ok',
  bodySource: 'article',
  publishedAt: new Date('2014-01-01Z'),
  crawledAt: new Date('2026-01-01Z'),
  contentFetchedAt: new Date('2026-01-01Z'),
  contentAccessedAt: null,
} as ContentRow;

function fixture() {
  const order: string[] = [];
  let updatePredicate: SQL | undefined;
  const chain = { from: () => chain, where: () => chain, orderBy: () => chain, limit: async () => [row] };
  const store: ArchiveStore = {
    remote: 'test:Archive',
    putVerified: vi.fn(async (data) => {
      order.push('verified');
      return { key: 'object', hash: digest(data) };
    }),
    getVerified: vi.fn(),
  };
  const db = {
    select: () => chain,
    insert: () => ({
      values: () => ({
        onDuplicateKeyUpdate: async () => {
          order.push('indexed');
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: async (predicate: SQL) => {
          updatePredicate = predicate;
          order.push('evicted');
          return [{ affectedRows: 1 }];
        },
      }),
    }),
  } as unknown as Db;
  return { db, store, order, predicate: () => updatePredicate! };
}

describe('verified content cache', () => {
  it('uses seven idle days under capacity pressure, otherwise ninety', () => {
    expect(cacheAgeForSpace(19 * 2 ** 30)).toBe(7 * 86400_000);
    expect(cacheAgeForSpace(20 * 2 ** 30)).toBe(90 * 86400_000);
    expect(cacheAgeForSpace(undefined)).toBe(90 * 86400_000);
  });
  it('round-trips content and rejects corrupt or mismatched records', () => {
    const pack = encodeContent([row]);
    expect(decodeContent(pack.data, 1, pack.entries[0].contentHash)).toMatchObject({ body: row.body, description: row.description });
    expect(() => decodeContent(pack.data, 2, pack.entries[0].contentHash)).toThrow('identity');
    const corrupt = Buffer.from(pack.data);
    corrupt[20] ^= 255;
    expect(() => decodeContent(corrupt, 1, pack.entries[0].contentHash)).toThrow();
  });
  it('orders readback verification, persistent indexing, then conditional eviction', async () => {
    const f = fixture();
    expect(await archiveColdContent(f.db, f.store, new Date('2026-10-04Z'))).toMatchObject({ archived: 1, evicted: 1 });
    expect(f.order).toEqual(['verified', 'indexed', 'evicted']);
    const query = new MySqlDialect().sqlToQuery(f.predicate());
    expect(query.sql).toContain('BINARY `articles`.`body` <=> BINARY');
    expect(query.sql).toContain('`articles`.`content_accessed_at` <=>');
    expect(query.params).toContain(row.body);
  });
  it('never evicts if NAS or archive indexing fails', async () => {
    const f = fixture();
    vi.mocked(f.store.putVerified).mockRejectedValue(new Error('NAS unavailable'));
    await expect(archiveColdContent(f.db, f.store, new Date())).rejects.toThrow('NAS unavailable');
    expect(f.order).toEqual([]);
    const second = fixture();
    second.db.insert = (() => ({
      values: () => ({
        onDuplicateKeyUpdate: async () => {
          throw new Error('database unavailable');
        },
      }),
    })) as unknown as Db['insert'];
    await expect(archiveColdContent(second.db, second.store, new Date())).rejects.toThrow('database unavailable');
    expect(second.order).toEqual(['verified']);
  });
  it('bases expiry on use/acquisition including old publications restored today', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE articles(id INTEGER,content_accessed_at TEXT,content_fetched_at TEXT,crawled_at TEXT)');
    db.function('GREATEST', { varargs: true }, (...values) => values.map(String).sort().at(-1)!);
    const insert = db.prepare('INSERT INTO articles VALUES (?,?,?,?)');
    insert.run(1, null, '2026-01-01', '2026-01-01');
    insert.run(2, '2026-10-04', '2026-01-01', '2026-01-01');
    insert.run(3, '2026-01-01', '2026-10-04', '2026-01-01');
    insert.run(4, null, null, '2026-10-04');
    try {
      const query = new MySqlDialect().sqlToQuery(cacheClock());
      expect(
        db
          .prepare(`SELECT id FROM articles WHERE ${query.sql} < '2026-07-06'`)
          .all()
          .map((r) => r.id),
      ).toEqual([1]);
    } finally {
      db.close();
    }
  });
  it('refuses a wrong remote or overwriting an existing cache', async () => {
    const pack = encodeContent([row]);
    const index = {
      articleId: 1,
      contentHash: pack.entries[0].contentHash,
      objectKey: 'object',
      objectHash: digest(pack.data),
      archiveRemote: 'correct:Archive',
    };
    const chain = { from: () => chain, where: () => chain, orderBy: () => chain, limit: async () => [index] };
    const update = vi.fn(() => ({ set: () => ({ where: async () => [{ affectedRows: 0 }] }) }));
    const pointer = { from: () => pointer, where: () => pointer, limit: async () => [{ hash: index.contentHash }] };
    let selects = 0;
    const db = { select: () => (++selects % 2 ? pointer : chain), update } as unknown as Db;
    const store = { remote: 'wrong:Archive', getVerified: vi.fn(async () => pack.data), putVerified: vi.fn() };
    await expect(restoreArticleContent(db, store, 1)).rejects.toThrow('remote');
    expect(store.getVerified).not.toHaveBeenCalled();
    store.remote = index.archiveRemote;
    await expect(restoreArticleContent(db, store, 1)).rejects.toThrow('Restore conflict');
  });
});
