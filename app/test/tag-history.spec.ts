// A keyword's first article and busiest day (jobs/tag-history-job.ts), and the
// hours a tag stayed charted (tag_stats.hours_count), against a real MariaDB
// (TEST_DB_URL). Only this spec's own article ids and labels are touched.
import { eq, inArray, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/client.ts';
import { articles, articleTags, tagHistory, tagStats } from '../src/db/schema.ts';
import { peakOf, recountTag, refreshRecentDays, taipeiDay } from '../src/jobs/tag-history-job.ts';
import { runTagStatsJob } from '../src/jobs/tag-stats-job.ts';
import { rankingCategories } from '../src/media-categories.ts';

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

describe.skipIf(!url)('tag history (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  const cleanup = async () => {
    await db.delete(articleTags).where(inArray(articleTags.articleId, IDS));
    await db.delete(articles).where(inArray(articles.id, IDS));
    await db.delete(tagHistory).where(inArray(tagHistory.tag, [TAG, TAG.toUpperCase(), 'History測試', 'HISTORY測試']));
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
    expect(row).toMatchObject({ firstAt: new Date('2015-03-01T02:00:00Z'), peakDay: '2020-05-02', peakCount: 2 });
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
