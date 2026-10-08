import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { parseArticleQuery, searchArticles } from './articles.ts';

describe('tag article search', () => {
  it('bounds the tag index for both pagination and whole-match facets', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    };
    const query = parseArticleQuery(
      { tag: '蔣萬安', hours: '72', facets: '1', cursor: '1791388800000_123' },
      new Date('2026-10-08T15:00:00Z'),
    );
    if ('error' in query) throw new Error(query.error);
    await searchArticles({ select: () => chain } as unknown as Db, query);
    expect(chain.where).toHaveBeenCalledTimes(2);
    for (const [condition] of chain.where.mock.calls) {
      const sql = new MySqlDialect().sqlToQuery(condition);
      expect(sql.sql).toContain('`article_tags`.`published_at` >= ?');
      expect(sql.sql).toContain('`article_tags`.`published_at` < ?');
      expect(sql.params).toContain('2026-10-05 15:00:00.000');
      expect(sql.params).toContain('2026-10-08 15:00:00.000');
    }
  });
});
