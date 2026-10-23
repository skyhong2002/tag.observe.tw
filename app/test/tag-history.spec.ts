// A keyword's first article and busiest day (jobs/tag-history-job.ts), and the
// hours a tag stayed charted (tag_stats.hours_count), against a real MariaDB
// (TEST_DB_URL). Only this spec's own article ids and labels are touched.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { eq, inArray, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/client.ts';
import { articles, articleTags, tagHistory, tagStats } from '../src/db/schema.ts';
import { copyNewKeywords, peakOf, recountTag, refreshRecentDays, taipeiDay } from '../src/jobs/tag-history-job.ts';
import { runTagStatsJob } from '../src/jobs/tag-stats-job.ts';
import { rankingCategories } from '../src/media-categories.ts';
import { loadNewKeywords } from '../src/v1/tag-history.ts';

describe('peakOf and taipeiDay', () => {
  it('keeps the earliest of equally busy days', () => {
    expect(
      peakOf([
        { day: '2024-07-25', n: 9 },
        { day: '2022-08-03', n: 9 },
        { day: '2023-01-01', n: 3 },
      ]),
    ).toEqual({ day: '2022-08-03', n: 9 });
    expect(peakOf([])).toBeNull();
  });
  it('counts days in Taipei time', () => {
    expect(taipeiDay(new Date('2026-10-23T15:59:59Z'))).toBe('2026-10-23');
    expect(taipeiDay(new Date('2026-10-23T16:00:00Z'))).toBe('2026-10-24');
  });
});

const url = process.env.TEST_DB_URL;
const IDS = Array.from({ length: 12 }, (_, i) => 991_000 + i);
const TAG = '歷史測試詞';
const NEW = ['新詞測試甲', '新詞測試乙', '新詞測試丙', '舊詞測試'];

describe.skipIf(!url)('tag history (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  const cleanup = async () => {
    await db.delete(articleTags).where(inArray(articleTags.articleId, IDS));
    await db.delete(articles).where(inArray(articles.id, IDS));
    await db.delete(tagHistory).where(inArray(tagHistory.tag, [TAG, TAG.toUpperCase(), 'History測試', 'HISTORY測試', ...NEW]));
    await db.delete(tagStats).where(eq(tagStats.tag, TAG));
  };
  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await close?.();
  });

  const seed = async (rows: Array<{ id: number; tag: string; at: string; media?: string }>) => {
    await db.insert(articles).values(
      rows.map((r) => ({
        id: r.id,
        media: r.media ?? 'udn',
        title: `報導 ${r.id}`,
        tags: [r.tag],
        authors: [],
        url: `https://example.com/history/${r.id}`,
        publishedAt: new Date(r.at),
        crawledAt: new Date(r.at),
      })),
    );
    await db.insert(articleTags).values(rows.map((r) => ({ articleId: r.id, tag: r.tag, publishedAt: new Date(r.at) })));
  };

  it('finds the first article and the busiest Taipei day, exact label only', async () => {
    await seed([
      { id: IDS[0], tag: 'History測試', at: '2015-03-01T02:00:00Z' },
      // 16:30 UTC is already the 2nd in Taipei
      { id: IDS[1], tag: 'History測試', at: '2020-05-01T16:30:00Z' },
      { id: IDS[2], tag: 'History測試', at: '2020-05-02T03:00:00Z' },
      { id: IDS[3], tag: 'History測試', at: '2021-01-01T03:00:00Z' },
      // A case variant is another keyword and does not count
      { id: IDS[4], tag: 'HISTORY測試', at: '2010-01-01T03:00:00Z' },
      { id: IDS[5], tag: 'HISTORY測試', at: '2021-01-01T04:00:00Z' },
      { id: IDS[6], tag: 'HISTORY測試', at: '2021-01-01T05:00:00Z' },
    ]);
    const now = new Date('2026-10-24T00:00:00Z');
    expect(await recountTag(db, 'History測試', now)).toBe(true);
    const [row] = await db.select().from(tagHistory).where(eq(tagHistory.tag, 'History測試'));
    expect(row).toMatchObject({
      firstAt: new Date('2015-03-01T02:00:00Z'),
      lastAt: new Date('2021-01-01T03:00:00Z'),
      articleCount: 4,
      peakDay: '2020-05-02',
      peakCount: 2,
    });
    // A tag with no articles left loses its row
    expect(await recountTag(db, '沒有這個詞', now)).toBe(false);
  });

  it('adds the latest days hourly and moves the peak when one beats it', async () => {
    const now = new Date('2026-10-23T12:00:00Z');
    await seed([
      { id: IDS[7], tag: TAG, at: '2024-01-01T03:00:00Z' },
      { id: IDS[8], tag: TAG, at: '2024-01-01T04:00:00Z' },
    ]);
    await recountTag(db, TAG, new Date('2026-10-20T00:00:00Z'));
    const before = await db.select().from(tagHistory).where(eq(tagHistory.tag, TAG));
    expect(before[0]).toMatchObject({ peakDay: '2024-01-01', peakCount: 2 });
    // Two articles yesterday tie the old peak (the earlier day stays); a third today wins.
    await seed([
      { id: IDS[9], tag: TAG, at: '2026-10-22T01:00:00Z' },
      { id: IDS[10], tag: TAG, at: '2026-10-22T02:00:00Z' },
    ]);
    expect(await refreshRecentDays(db, before, now)).toBe(0);
    await seed([{ id: IDS[11], tag: TAG, at: '2026-10-22T03:00:00Z' }]);
    expect(await refreshRecentDays(db, before, now)).toBe(1);
    const [after] = await db.select().from(tagHistory).where(eq(tagHistory.tag, TAG));
    expect(after).toMatchObject({ peakDay: '2026-10-22', peakCount: 3, computedAt: new Date('2026-10-20T00:00:00Z') });
  });

  it('copies keywords first seen lately from the vocabulary aggregate and lists them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tag-history-'));
    try {
      const sqlite = new DatabaseSync(join(dir, 'aggregate.sqlite'));
      sqlite.exec(
        'CREATE TABLE terms(label TEXT COLLATE BINARY PRIMARY KEY,group_key TEXT NOT NULL,n INTEGER NOT NULL,first_at TEXT NOT NULL,last_at TEXT NOT NULL) WITHOUT ROWID',
      );
      // Without the covering index nothing is read.
      expect(await copyNewKeywords(db, dir, new Date('2036-01-10T00:00:00Z'))).toBeNull();
      sqlite.exec('CREATE INDEX terms_first ON terms(first_at,n,last_at)');
      const put = sqlite.prepare('INSERT INTO terms VALUES(?,?,?,?,?)');
      put.run('新詞測試甲', 'a', 5, '2036-01-05T02:00:00.000Z', '2036-01-09T02:00:00.000Z');
      put.run('新詞測試丙', 'c', 40, '2036-01-02T02:00:00.000Z', '2036-01-09T05:00:00.000Z');
      put.run('新詞測試乙', 'b', 2, '2036-01-06T02:00:00.000Z', '2036-01-06T03:00:00.000Z'); // too few
      put.run('舊詞測試', 'd', 90, '2020-01-01T00:00:00.000Z', '2036-01-09T00:00:00.000Z'); // old
      put.run('甲', 'e', 9, '2036-01-05T00:00:00.000Z', '2036-01-09T00:00:00.000Z'); // one character
      const now = new Date('2036-01-10T00:00:00Z');
      sqlite.close();
      expect(await copyNewKeywords(db, dir, now)).toBe(2);
      // A recount fills the peak later; the copy never clears it.
      await db.update(tagHistory).set({ peakDay: '2036-01-08', peakCount: 3 }).where(eq(tagHistory.tag, '新詞測試甲'));
      expect(await copyNewKeywords(db, dir, now)).toBe(2);
      const recent = await loadNewKeywords(db, { days: 7, minArticles: 3, sort: 'first', dir: 'desc', limit: 10, now });
      expect(recent.total).toBe(1);
      expect(recent.keywords).toEqual([
        {
          tag: '新詞測試甲',
          firstAt: new Date('2036-01-05T02:00:00Z'),
          lastAt: new Date('2036-01-09T02:00:00Z'),
          articleCount: 5,
          peakDay: '2036-01-08',
          peakCount: 3,
        },
      ]);
      const byCount = await loadNewKeywords(db, { days: 30, minArticles: 3, sort: 'count', dir: 'desc', limit: 10, now });
      expect(byCount.keywords.map((k) => k.tag)).toEqual(['新詞測試丙', '新詞測試甲']);
      // Keywords without a peak yet sort last either way.
      const byPeak = await loadNewKeywords(db, { days: 30, minArticles: 3, sort: 'peak', dir: 'asc', limit: 10, now });
      expect(byPeak.keywords.map((k) => k.tag)).toEqual(['新詞測試甲', '新詞測試丙']);
      expect(await copyNewKeywords(db, join(dir, 'missing'), now)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('counts each charted hour once in tag_stats.hours_count', async () => {
    await db.delete(articleTags).where(inArray(articleTags.articleId, IDS));
    await db.delete(articles).where(inArray(articles.id, IDS));
    const [category, spec] = Object.entries(rankingCategories()).find(([key, c]) => key !== 'news' && c.media.length >= 2)!;
    const at = (h: number) => new Date(Date.UTC(2026, 9, 23, h, 10)).toISOString();
    await seed([
      { id: IDS[0], tag: TAG, at: at(1), media: spec.media[0] },
      { id: IDS[1], tag: TAG, at: at(1), media: spec.media[0] },
      { id: IDS[2], tag: TAG, at: at(1), media: spec.media[1] },
    ]);
    const hours = () =>
      db
        .select({ n: tagStats.hoursCount })
        .from(tagStats)
        .where(sql`${tagStats.tag} = ${TAG} AND ${tagStats.category} = ${category} AND ${tagStats.level} = 2`);
    const runAt = async (iso: string) => runTagStatsJob(db, { now: () => new Date(iso), categories: [category] });
    await runAt('2026-10-23T03:00:05Z');
    await runAt('2026-10-23T03:30:00Z'); // a rerun in the same hour
    await runAt('2026-10-23T04:00:05Z');
    await runAt('2026-10-23T05:00:05Z');
    expect(await hours()).toEqual([{ n: 3 }]);
  });
});
