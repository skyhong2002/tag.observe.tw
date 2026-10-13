import type { SQL } from 'drizzle-orm';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db/client.ts';
import { applyVotes, type PictureKind } from '../src/pictures/votes.ts';

// No DB/socket: execute the real voting function and inspect its actual SQL CAS.
function fixture(kind: PictureKind, shownRank: number | null, affectedRows: number, status = 'voted') {
  const rows: unknown[][] = [
    [{ rank: 2, n: 3 }],
    [{ status, shownRank }],
    ...(kind === 'visual' && !['chosen', 'hidden'].includes(status)
      ? [[{ tag: '甲', rank: 2, uploadedBy: null, uploadedAt: null, image: 'candidate.webp' }]]
      : []),
    [{ shownRank: 7 }],
  ];
  let predicate: SQL | undefined;
  let writes = 0;
  const db = {
    select() {
      const result = rows.shift();
      if (!result) throw Error('Unexpected read');
      const query = {
        from: () => query,
        where: () => query,
        groupBy: () => query,
        // biome-ignore lint/suspicious/noThenProperty: emulate an awaited Drizzle query.
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
    update() {
      writes++;
      return {
        set: () => ({
          where: async (where: SQL) => {
            predicate = where;
            return [{ affectedRows }];
          },
        }),
      };
    },
  } as unknown as Db;
  return { db, writes: () => writes, sql: () => predicate && new MySqlDialect().sqlToQuery(predicate) };
}

describe.each(['avatar', 'visual'] as const)('picture vote CAS: %s', (kind) => {
  it.each([null, 1])('checks both observed status and shown rank (%s) before updating', async (shownRank) => {
    const f = fixture(kind, shownRank, 1);
    expect(await applyVotes(f.db, '甲', kind)).toBe(2);
    const query = f.sql();
    expect(query?.sql).toContain('`status` = ?');
    expect(query?.sql).toContain(shownRank === null ? '`shown_rank` is null' : '`shown_rank` = ?');
    expect(query?.params).toEqual(shownRank === null ? ['甲', 'voted'] : ['甲', 'voted', shownRank]);
  });
  it('returns the concurrent admin selection after a failed CAS without retrying a stale vote', async () => {
    const f = fixture(kind, 1, 0);
    expect(await applyVotes(f.db, '甲', kind)).toBe(7);
    expect(f.writes()).toBe(1);
  });
  it.each(kind === 'avatar' ? ['chosen', 'hidden', 'nonhuman'] : ['chosen', 'hidden'])('leaves %s untouched', async (status) => {
    const f = fixture(kind, 7, 0, status);
    expect(await applyVotes(f.db, '甲', kind)).toBe(7);
    expect(f.writes()).toBe(0);
  });
});
