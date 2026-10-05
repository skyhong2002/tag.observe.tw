import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runArticles } from '../crawl/pipeline.ts';
import { sourceByMedia } from '../crawl/registry.ts';
import { buildVocab, loadTitleVocab } from '../crawl/title-tags.ts';
import { createDb } from '../db/client.ts';
import { articles, articleTags, rankingSnapshots } from '../db/schema.ts';
import { titleTagRecent } from './crawl-job.ts';
import { loadEventInputs } from './events-job.ts';
import { readOwnTagRows } from './ranking-job.ts';

const testUrl = process.env.LEGACY_POLICY_TEST_DB_URL;
describe.skipIf(!testUrl)('legacy ownership policy in disposable MariaDB', () => {
  const connection = testUrl ? createDb(testUrl) : null;
  beforeAll(async () => {
    const target = new URL(testUrl!);
    if (target.hostname !== '127.0.0.1' || target.port !== '23317' || target.pathname !== '/legacy_policy_test')
      throw new Error('Disposable DB required');
    await migrate(connection!.db, { migrationsFolder: resolve('app/src/db/migrations') });
  });
  afterAll(async () => {
    await connection?.close();
  });
  it('keeps recent legacy metadata out of crawl, ranking, events and title vocabulary', async () => {
    const db = connection!.db;
    const now = new Date();
    const own = '自主採訪';
    const legacy = '歷史樣本';
    await db.insert(articles).values([
      {
        id: 1,
        media: 'cna',
        url: 'https://www.cna.com.tw/own',
        title: own,
        source: 'own',
        publishedAt: now,
        crawledAt: now,
        tags: [own],
        fetchedAt: now,
        contentFetchedAt: now,
        bodyStatus: 'ok',
      },
      {
        id: 2,
        media: 'cna',
        url: 'https://www.cna.com.tw/legacy',
        title: legacy,
        source: 'legacy',
        publishedAt: now,
        crawledAt: now,
        tags: [legacy],
      },
    ]);
    await db.insert(articleTags).values([
      { articleId: 1, tag: own, publishedAt: now },
      { articleId: 2, tag: legacy, publishedAt: now },
    ]);
    expect(
      (await readOwnTagRows(db, ['cna'], new Date(now.getTime() - 3600e3), new Date(now.getTime() + 1000))).map((r) => r.newsid),
    ).toEqual([1]);
    const vocab = await loadTitleVocab(db, { minArticles: 1, minShort: 1 });
    expect(vocab.freq.has(own)).toBe(true);
    expect(vocab.freq.has(legacy)).toBe(false);
    await db
      .insert(rankingSnapshots)
      .values({
        category: 'all',
        hourStart: now,
        computedAt: now,
        hours: 24,
        weight: 1,
        mediaCount: 1,
        articleCount: 1,
        durationMs: 0,
        chart: JSON.stringify({ entries: [], weight: 1 }),
      });
    expect((await loadEventInputs(db, now)).rows.map((r) => r.id)).toEqual([1]);
    const fetch = vi.fn(async () => {
      throw new Error('Legacy import must not trigger a fetch');
    });
    expect(await runArticles(db, sourceByMedia('cna')!, { now: () => now, fetch })).toMatchObject({ fetched: 0 });
    expect(fetch).not.toHaveBeenCalled();
    // A fetched historical row must not be silently retagged by the live job.
    await db.update(articles).set({ title: own, tags: [], fetchedAt: now, fetchStatus: 'ok' }).where(eq(articles.id, 2));
    await titleTagRecent(db, buildVocab([{ tag: own, n: 20 }]));
    const [preserved] = await db.select({ tags: articles.tags, source: articles.source }).from(articles).where(eq(articles.id, 2));
    expect(preserved).toEqual({ tags: [], source: 'legacy' });
  });
});
