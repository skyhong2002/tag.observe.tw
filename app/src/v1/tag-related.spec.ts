import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { loadRelatedTags } from './tag-related.ts';

const from = new Date('2026-10-03T00:00:00Z');
const to = new Date('2026-10-04T00:00:00Z');
describe('related tags', () => {
  it('ranks co-occurring tags per entry, drops noise and case variants, and caps the list', async () => {
    const pairs = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { tag: '柯文哲', other: '京華城', count: '12' },
        { tag: '柯文哲', other: '沈慶京', count: '9' },
        { tag: '柯文哲', other: '即時新聞', count: '30' },
        { tag: '柯文哲', other: '柯文哲', count: '3' },
        { tag: '柯文哲', other: '民眾黨', count: '9' },
        { tag: '柯文哲', other: '北檢', count: '2' },
        { tag: 'Unrequested', other: 'x', count: '1' },
      ]),
    };
    const totals = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([{ tag: '柯文哲', count: '24' }]),
    };
    const db = { select: vi.fn().mockReturnValueOnce(pairs).mockReturnValueOnce(totals) } as unknown as Db;
    const result = await loadRelatedTags(db, ['柯文哲', '0050'], ['cna', 'ltn'], from, to, 3);
    expect(result.get('柯文哲')).toEqual([
      { tag: '京華城', count: 12, share: 0.5 },
      { tag: '民眾黨', count: 9, share: 0.375 },
      { tag: '沈慶京', count: 9, share: 0.375 },
    ]);
    expect(result.get('0050')).toEqual([]);
    expect(result.has('Unrequested')).toBe(false);
    const query = new MySqlDialect().sqlToQuery(pairs.where.mock.calls[0][0]);
    expect(query.params).toEqual(['柯文哲', '0050', 'cna', 'ltn', '2026-10-03 00:00:00.000', '2026-10-04 00:00:00.000']);
    expect(new MySqlDialect().sqlToQuery(pairs.groupBy.mock.calls[0][0]).sql).toContain('COLLATE utf8mb4_bin');
  });
  it('skips the database when there is nothing to look up', async () => {
    const db = { select: vi.fn() } as unknown as Db;
    expect(await loadRelatedTags(db, [], ['cna'], from, to)).toEqual(new Map());
    expect(await loadRelatedTags(db, ['a'], [], from, to)).toEqual(new Map([['a', []]]));
    expect(db.select).not.toHaveBeenCalled();
  });
});
