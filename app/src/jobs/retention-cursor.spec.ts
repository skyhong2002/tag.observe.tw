import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { getTableName, type SQL } from 'drizzle-orm';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client.ts';
import { archiveColdContent, type ContentRow } from '../nearline/content.ts';
import { type ArchiveStore, digest } from '../nearline/store.ts';
import { runRetentionJob } from './retention-job.ts';

const now = new Date('2026-10-23T00:00:00Z');
const old = new Date('2025-01-01T00:00:00Z');
const dialect = new MySqlDialect();
const bindings = (params: unknown[]) =>
  params.map((v) => (v instanceof Date ? v.toISOString().slice(0, 23).replace('T', ' ') : v)) as Array<string | number | null>;

function fixture(emptyPrefix = 1000, cold = 61) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE articles(id INTEGER PRIMARY KEY,published_at TEXT,crawled_at TEXT,
    content_accessed_at TEXT,content_fetched_at TEXT,body TEXT,description TEXT,summary TEXT,summary_source TEXT)`);
  sqlite.function('GREATEST', { varargs: true }, (...values) => values.map(String).sort().at(-1)!);
  const rows = new Map<number, ContentRow>();
  const add = (id: number, body: string | null, acquired = old) => {
    const row = {
      id,
      media: 'test',
      url: `https://archive.test/${id}`,
      publishedAt: old,
      crawledAt: old,
      body,
      description: null,
      summary: null,
      summarySource: null,
      bodyStatus: body ? 'ok' : 'expired',
      contentAccessedAt: null,
      contentFetchedAt: acquired,
    } as ContentRow;
    rows.set(id, row);
    sqlite
      .prepare('INSERT INTO articles VALUES (?,?,?,?,?,?,?,?,?)')
      .run(
        id,
        '2025-01-01 00:00:00.000',
        '2025-01-01 00:00:00.000',
        null,
        acquired.toISOString().slice(0, 23).replace('T', ' '),
        body,
        null,
        null,
        null,
      );
  };
  for (let id = 1; id <= emptyPrefix + cold; id++) add(id, id <= emptyPrefix ? null : `body-${id}`);
  // Restored today: an old publication must remain cached.
  add(emptyPrefix + cold + 1, 'recently restored', now);
  const queries: Array<{ sql: string; params: unknown[]; selected: number[] }> = [];
  const packages: number[][] = [];
  let onVerified = () => {};
  const store: ArchiveStore = {
    remote: 'test:Archive',
    putVerified: async (data) => {
      const pack = JSON.parse(gunzipSync(data).toString());
      packages.push(pack.entries.map((entry: { article: { id: number } }) => entry.article.id));
      onVerified();
      return { key: 'verified-object', hash: digest(data) };
    },
    getVerified: async () => {
      throw new Error('not used');
    },
  };
  const empty = { from: () => empty, where: () => empty, limit: async () => [] };
  const db = {
    select: () => ({
      from: (table: Parameters<typeof getTableName>[0]) => {
        if (getTableName(table) !== 'articles') return empty;
        return {
          where: (condition: SQL) => ({
            orderBy: () => ({
              limit: async (limit: number) => {
                const query = dialect.sqlToQuery(condition);
                const selected = sqlite
                  .prepare(`SELECT id FROM articles WHERE ${query.sql} ORDER BY id LIMIT ?`)
                  .all(...bindings(query.params), limit)
                  .map((row) => Number(row.id));
                queries.push({ ...query, selected });
                return selected.map((id) => ({ ...rows.get(id)! }));
              },
            }),
          }),
        };
      },
    }),
    insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => {} }) }),
    update: () => ({
      set: (values: Partial<ContentRow>) => ({
        where: async (condition: SQL) => {
          const query = dialect.sqlToQuery(condition);
          // SQLite IS implements the null-safe equality used by the real eviction guard.
          const predicate = query.sql.replaceAll('BINARY ', '').replaceAll('<=>', 'IS');
          const selected = sqlite.prepare(`SELECT id FROM articles WHERE ${predicate}`).all(...bindings(query.params));
          for (const found of selected) {
            const id = Number(found.id);
            sqlite.prepare('UPDATE articles SET body=NULL,description=NULL,summary=NULL,summary_source=NULL WHERE id=?').run(id);
            Object.assign(rows.get(id)!, values);
          }
          return [{ affectedRows: selected.length }];
        },
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => [] }) }) }) }),
      }),
    execute: async () => [{ affectedRows: 0 }],
    delete: () => ({ where: async () => [{ affectedRows: 0 }] }),
  } as unknown as Db;
  return {
    db,
    store,
    rows,
    queries,
    packages,
    onVerified: (fn: () => void) => {
      onVerified = fn;
    },
    restore: (id: number, body: string) => {
      rows.get(id)!.body = body;
      sqlite.prepare('UPDATE articles SET body=? WHERE id=?').run(body, id);
    },
    setFetchedAt: (id: number, date: Date) => {
      rows.get(id)!.contentFetchedAt = date;
      sqlite.prepare('UPDATE articles SET content_fetched_at=? WHERE id=?').run(date.toISOString().slice(0, 23).replace('T', ' '), id);
    },
    close: () => sqlite.close(),
  };
}

describe('retention archive cursor', () => {
  it('walks the cleared prefix once and preserves ascending archive order and the exact content budget', async () => {
    const f = fixture();
    try {
      const result = await runRetentionJob(f.db, { now: () => now, archiveStore: f.store, contentBatch: 55 });
      expect(result).toMatchObject({ contentArchived: 55, contentEvicted: 55 });
      expect(f.packages.flat()).toEqual(Array.from({ length: 55 }, (_, i) => 1001 + i));
      expect(f.queries.map((q) => q.selected.length)).toEqual([25, 25, 5]);
      expect(f.queries[0].sql).not.toContain('`articles`.`id` >');
      expect(f.queries[1].sql).toContain('`articles`.`id` >');
      expect(f.queries[1].params).toContain(1025);
      expect(f.queries[2].params).toContain(1050);
      expect(f.rows.get(1062)!.body).toBe('recently restored');
    } finally {
      f.close();
    }
  });

  it('starts a new run at zero and revisits content that changed behind the previous cursor', async () => {
    const f = fixture(5, 30);
    try {
      f.onVerified(() => f.restore(1, 'changed behind cursor'));
      await runRetentionJob(f.db, { now: () => now, archiveStore: f.store, contentBatch: 30 });
      expect(f.packages.flat()).not.toContain(1);
      f.onVerified(() => {});
      const before = f.queries.length;
      await runRetentionJob(f.db, { now: () => now, archiveStore: f.store, contentBatch: 1 });
      expect(f.queries[before].selected).toEqual([1]);
      expect(f.queries[before].sql).not.toContain('`articles`.`id` >');
    } finally {
      f.close();
    }
  });

  it('keeps a changed body when its archive no longer matches and retries it in a later run', async () => {
    const f = fixture(0, 2);
    try {
      f.onVerified(() => f.restore(1, 'new content after verification'));
      const result = await runRetentionJob(f.db, { now: () => now, archiveStore: f.store, contentBatch: 2 });
      expect(result).toMatchObject({ contentArchived: 2, contentEvicted: 1 });
      expect(f.rows.get(1)!.body).toBe('new content after verification');
      f.onVerified(() => {});
      await runRetentionJob(f.db, { now: () => now, archiveStore: f.store, contentBatch: 1 });
      expect(f.packages.at(-1)).toEqual([1]);
    } finally {
      f.close();
    }
  });

  it('resets the cursor when pressure changes the eligibility window', async () => {
    const f = fixture(1, 26);
    try {
      f.restore(1, 'thirty day cache');
      // Not eligible at 90 days, but eligible once pressure switches to seven days.
      f.setFetchedAt(1, new Date(now.getTime() - 30 * 86400_000));
      let calls = 0;
      f.store.localFreeBytes = async () => (++calls === 1 ? 21 * 2 ** 30 : 19 * 2 ** 30);
      await runRetentionJob(f.db, { now: () => now, archiveStore: f.store, contentBatch: 27 });
      expect(f.queries[0].selected).toEqual(Array.from({ length: 25 }, (_, i) => i + 2));
      expect(f.queries[1].sql).not.toContain('`articles`.`id` >');
      expect(f.queries[1].selected).toEqual([1, 27]);
    } finally {
      f.close();
    }
  });

  it('rejects invalid cursor values before storage or database access', async () => {
    for (const cursor of [-1, 0.1, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      await expect(archiveColdContent({} as Db, undefined, now, 25, undefined, cursor)).rejects.toThrow('cursor');
  });
});
