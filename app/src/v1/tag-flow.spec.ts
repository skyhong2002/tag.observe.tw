import { MySqlDialect } from 'drizzle-orm/mysql-core';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { loadTagFlow, mergeTagFlowDays, registerTagFlow, tagFlowHours } from './tag-flow.ts';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 7, h, m));

describe('tag flow', () => {
  it('merges across Taipei midnight without merging two different dates', () => {
    expect(
      mergeTagFlowDays([
        { t: at(15).toISOString(), count: 2, tags: [['議題', 2]] },
        { t: at(16).toISOString(), count: 3, tags: [['議題', 3]] },
        {
          t: at(17).toISOString(),
          count: 4,
          tags: [
            ['議題', 2],
            ['選舉', 2],
          ],
        },
      ]),
    ).toEqual([
      { t: '2026-10-06T16:00:00.000Z', count: 2, tags: [['議題', 2]] },
      {
        t: '2026-10-07T16:00:00.000Z',
        count: 7,
        tags: [
          ['議題', 5],
          ['選舉', 2],
        ],
      },
    ]);
  });
  it('keeps an exclusive history boundary and reports older data even for an empty window', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }]),
    };
    const until = new Date('2026-10-01T16:00:00Z');
    const result = await loadTagFlow({ select: () => chain } as unknown as Db, '蔣萬安', 336, new Date(), { until, span: 'day' });
    expect(result).toMatchObject({ from: '2026-09-17T16:00:00.000Z', to: until.toISOString(), span: 'day', hasMore: true, points: [] });
    const sql = new MySqlDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(sql.sql).toContain('`article_tags`.`published_at` < ?');
    expect(sql.params).toEqual(['蔣萬安', '2026-09-17 16:00:00.000', '2026-10-01 16:00:00.000']);
  });
  it('rejects bad history parameters before querying the database', async () => {
    const select = vi.fn();
    const app = Fastify();
    registerTagFlow(app, { select } as unknown as Db);
    try {
      for (const query of ['until=garbage', 'until=2999-01-01', 'span=week', 'hours=abc', 'hours=0', 'hours=745']) {
        expect((await app.inject(`/api/v1/tags/test/flow?${query}`)).statusCode).toBe(400);
      }
      expect(select).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('keeps more than fifteen co-occurring keywords for expansion', () => {
    const tags = Array.from({ length: 25 }, (_, i) => `議題${i}`);
    const rows = [1, 2].map((id) => ({ id, media: 'cna', publishedAt: at(3), tags: ['蔣萬安', ...tags] }));
    expect(tagFlowHours('蔣萬安', rows)[0].tags).toHaveLength(25);
  });
  it('counts the company a keyword keeps per hour, once per report, without noise', () => {
    const rows = [
      { id: 1, media: 'udn', publishedAt: at(3, 10), tags: ['沈伯洋', '蔣萬安', '台灣', '2026年'] },
      { id: 1, media: 'udn', publishedAt: at(3, 10), tags: ['沈伯洋', '蔣萬安'] },
      { id: 2, media: 'ltn', publishedAt: at(3, 40), tags: ['沈伯洋', '蔣萬安', '蔣萬安', '毒品'] },
      { id: 3, media: 'ltn', publishedAt: at(5, 0), tags: ['沈伯洋', '毒品'] },
      { id: 4, media: 'cna', publishedAt: at(5, 30), tags: ['沈伯洋', '毒品', '政治'] },
    ];
    expect(tagFlowHours('沈伯洋', rows)).toEqual([
      { t: at(3).toISOString(), count: 2, tags: [['蔣萬安', 2]] },
      { t: at(5).toISOString(), count: 2, tags: [['毒品', 2]] },
    ]);
  });
});
