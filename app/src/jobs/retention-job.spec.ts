import { DatabaseSync } from 'node:sqlite';
import type { SQL } from 'drizzle-orm';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client.ts';
import { runRetentionJob } from './retention-job.ts';

describe('archived article retention', () => {
  it('expires bodies by acquisition time with a crawl-time fallback, independently of publication age', async () => {
    const updates: Array<{ values: Record<string, unknown>; where: SQL }> = [];
    const empty = Object.assign(Promise.resolve([]), { from: () => empty, where: () => empty, limit: () => empty });
    const db = {
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async (where: SQL) => {
            updates.push({ values, where });
            return [{ affectedRows: 0 }];
          },
        }),
      }),
      select: () => empty,
      delete: () => ({ where: async () => [{ affectedRows: 0 }] }),
    } as unknown as Db;
    await runRetentionJob(db, { now: () => new Date('2026-10-03T12:00:00Z') });
    const body = updates.find((entry) => entry.values.bodyStatus === 'expired')!;
    const query = new MySqlDialect().sqlToQuery(body.where);
    expect(query.sql).toContain('COALESCE(`articles`.`content_fetched_at`, `articles`.`crawled_at`)');
    expect(query.sql).not.toContain('published_at');
    expect(query.sql).toContain('`articles`.`body` IS NOT NULL');
    expect(query.params).toContainEqual(new Date('2026-07-05T12:00:00Z'));
    // Exercise the real retention predicate against old publication dates and
    // the boundary, including pre-migration rows without content_fetched_at.
    const sqlite = new DatabaseSync(':memory:');
    try {
      sqlite.exec('CREATE TABLE articles (id INTEGER, body TEXT, published_at TEXT, content_fetched_at TEXT, crawled_at TEXT)');
      const insert = sqlite.prepare('INSERT INTO articles VALUES (?, ?, ?, ?, ?)');
      insert.run(1, 'archive body', '2011-01-01T00:00:00.000Z', '2026-10-03T00:00:00.000Z', '2026-10-03T00:00:00.000Z');
      insert.run(2, 'expired body', '2011-01-01T00:00:00.000Z', '2026-07-04T00:00:00.000Z', '2026-10-03T00:00:00.000Z');
      insert.run(3, 'legacy fresh', '2011-01-01T00:00:00.000Z', null, '2026-10-03T00:00:00.000Z');
      insert.run(4, 'legacy expired', '2011-01-01T00:00:00.000Z', null, '2026-07-04T00:00:00.000Z');
      insert.run(5, 'boundary', '2011-01-01T00:00:00.000Z', '2026-07-05T12:00:00.000Z', '2026-07-05T12:00:00.000Z');
      const rows = sqlite
        .prepare(`SELECT id FROM articles WHERE ${query.sql} ORDER BY id`)
        .all(...query.params.map((value) => (value instanceof Date ? value.toISOString() : String(value))));
      expect(rows.map((row) => row.id)).toEqual([2, 4]);
    } finally {
      sqlite.close();
    }
    const description = new MySqlDialect().sqlToQuery(updates.find((entry) => 'description' in entry.values)!.where);
    expect(description.sql).toContain('published_at');
  });
});
