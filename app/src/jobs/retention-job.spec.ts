import { DatabaseSync } from 'node:sqlite';
import type { SQL } from 'drizzle-orm';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client.ts';
import { runRetentionJob } from './retention-job.ts';

describe('nearline retention guards', () => {
  it('rejects invalid archive budgets before touching the database', async () => {
    for (const contentBatch of [0, -1, 1.5, Number.NaN, 50001]) {
      await expect(runRetentionJob({} as Db, { contentBatch })).rejects.toThrow('batch');
    }
  });
  it('without storage never clears content; only unlinked own-source empty noise can be deleted', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`CREATE TABLE articles(id INTEGER,source TEXT,published_at TEXT,fetched_at TEXT,tags TEXT,body TEXT,description TEXT);
      CREATE TABLE article_archives(article_id INTEGER); CREATE TABLE article_origins(article_id INTEGER);`);
    const insert = sqlite.prepare('INSERT INTO articles VALUES (?,?,?,NULL,?,?,?)');
    for (const [id, source, tags, body, description] of [
      [1, 'own', '[]', null, null],
      [2, 'legacy', '[]', null, null],
      [3, 'own', '[]', 'body', null],
      [4, 'own', '[]', null, 'summary'],
      [5, 'own', '[]', null, null],
      [6, 'own', '[]', null, null],
    ] as const)
      insert.run(id, source, '2014-01-01', tags, body, description);
    sqlite.exec('INSERT INTO article_archives VALUES (5); INSERT INTO article_origins VALUES (6)');
    const deletes: unknown[] = [];
    let predicate: SQL;
    const empty = Object.assign(Promise.resolve([]), { from: () => empty, where: () => empty, limit: () => empty });
    const tx = {
      select: () => ({
        from: () => ({
          where: (condition: SQL) => {
            predicate = condition;
            return { limit: () => ({ for: async () => [] }) };
          },
        }),
      }),
    };
    const db = {
      select: () => empty,
      transaction: async (fn: (db: unknown) => Promise<void>) => fn(tx),
      update: () => {
        throw new Error('Content must not be cleared without archive storage');
      },
      delete: () => ({
        where: async (condition: unknown) => {
          deletes.push(condition);
          return [{ affectedRows: 0 }];
        },
      }),
      execute: async () => [{ affectedRows: 0 }],
    } as unknown as Db;
    try {
      const result = await runRetentionJob(db);
      expect(result.archiveDisabled).toBe(1);
      const compiled = new MySqlDialect().sqlToQuery(predicate!);
      sqlite.function('JSON_LENGTH', (value) => JSON.parse(String(value)).length);
      const selected = sqlite.prepare(`SELECT id FROM articles WHERE ${compiled.sql}`).all(...(compiled.params as string[]));
      expect(selected.map((r) => r.id)).toEqual([1]);
      expect(result.contentEvicted).toBe(0);
      expect(deletes.length).toBe(4);
    } finally {
      sqlite.close();
    }
  });
});
