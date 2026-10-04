// Integration drill against an explicitly disposable local database and NAS validation directory.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createDb } from '../../app/src/db/client.ts';
import { articleArchives, articleOrigins, articles } from '../../app/src/db/schema.ts';
import { runRetentionJob } from '../../app/src/jobs/retention-job.ts';
import { archiveColdContent, restoreArticleContent } from '../../app/src/nearline/content.ts';
import { type ArchiveStore, archiveStoreFromEnv } from '../../app/src/nearline/store.ts';
import { loadArticleContent } from '../../app/src/v1/article-content.ts';

const target = new URL(process.env.NEARLINE_SMOKE_DB_URL ?? 'mysql://invalid');
if (target.hostname !== '127.0.0.1' || target.pathname !== '/nearline_test' || !target.port || target.port === '13306') {
  throw new Error('Use the disposable loopback nearline_test database, never the production database');
}
const store = archiveStoreFromEnv();
if (!store || !/\/validation\/content-[a-zA-Z0-9-]+$/.test(store.remote))
  throw new Error('NAS remote must be a unique validation/content-* directory');
const connection = createDb(target.toString());
const { db } = connection;
const now = new Date('2026-10-04T12:00:00Z');
const old = new Date('2014-01-01T00:00:00Z');
const checks: string[] = [];
try {
  await migrate(db, { migrationsFolder: resolve('app/src/db/migrations') });
  assert.equal((await db.select().from(articles)).length, 0, 'test database must be empty');
  await db.insert(articles).values([
    {
      id: 1,
      media: 'cna',
      title: 'Cold own article',
      url: 'https://www.cna.com.tw/test/1',
      tags: [],
      source: 'own',
      publishedAt: old,
      crawledAt: old,
      body: 'Version A',
      description: '重要摘要',
      bodyStatus: 'ok',
      bodySource: 'article',
      contentFetchedAt: old,
    },
    {
      id: 2,
      media: 'cna',
      title: 'Legacy index',
      url: 'https://www.cna.com.tw/test/2',
      tags: [],
      source: 'legacy',
      publishedAt: old,
      crawledAt: old,
    },
    {
      id: 3,
      media: 'cna',
      title: 'Own noise',
      url: 'https://www.cna.com.tw/test/3',
      tags: [],
      source: 'own',
      publishedAt: old,
      crawledAt: old,
    },
    {
      id: 4,
      media: 'cna',
      title: 'Linked own article',
      url: 'https://www.cna.com.tw/test/4',
      tags: [],
      source: 'own',
      publishedAt: old,
      crawledAt: old,
    },
    {
      id: 5,
      media: 'cna',
      title: 'Recently used old publication',
      url: 'https://www.cna.com.tw/test/5',
      tags: [],
      source: 'legacy',
      publishedAt: old,
      crawledAt: old,
      contentFetchedAt: old,
      contentAccessedAt: now,
      body: 'Keep this cache',
      bodyStatus: 'ok',
    },
  ]);
  await db.insert(articleOrigins).values({
    sourceKey: 'test/tag_cna/4',
    rawHash: 'a'.repeat(64),
    articleId: 4,
    generation: 'test-generation',
    sourceObject: 'test-object',
    adapterVersion: 'test-v1',
    linkedAt: now,
  });
  await db.insert(articles).values({
    id: 6,
    media: 'cna',
    title: 'Capacity-pressure candidate',
    url: 'https://www.cna.com.tw/test/6',
    tags: [],
    source: 'own',
    publishedAt: old,
    crawledAt: old,
    contentFetchedAt: new Date('2026-09-01T00:00:00Z'),
    body: 'Thirty-day idle cache',
    bodyStatus: 'ok',
  });
  const failure: ArchiveStore = {
    remote: store.remote,
    putVerified: async () => {
      throw new Error('simulated NAS outage');
    },
    getVerified: (...args) => store.getVerified(...args),
  };
  await assert.rejects(archiveColdContent(db, failure, now), /NAS outage/);
  assert.equal((await db.select().from(articles).where(eq(articles.id, 1)))[0].body, 'Version A');
  checks.push('NAS failure keeps local body/description');
  const racing: ArchiveStore = {
    remote: store.remote,
    getVerified: (...args) => store.getVerified(...args),
    putVerified: async (bytes) => {
      const receipt = await store.putVerified(bytes);
      await db.update(articles).set({ body: 'version a' }).where(eq(articles.id, 1));
      return receipt;
    },
  };
  assert.equal((await archiveColdContent(db, racing, now)).evicted, 0);
  checks.push('Case-only concurrent body update defeats stale eviction');
  const result = await runRetentionJob(db, { archiveStore: store, now: () => now, batch: 10 });
  assert.equal(result.contentEvicted, 1);
  const retained = await db.select().from(articles);
  assert.deepEqual(retained.map((r) => r.id).sort(), [1, 2, 4, 5, 6]);
  assert.equal(retained.find((r) => r.id === 1)!.body, null);
  assert.equal(retained.find((r) => r.id === 1)!.description, null);
  assert.equal(retained.find((r) => r.id === 5)!.body, 'Keep this cache');
  assert.equal((await db.select().from(articleOrigins)).length, 1);
  checks.push('Only own contentless unlinked noise deleted; legacy, origins and archive indices survive');
  // Tied verification timestamps must not select the wrong content version.
  const versions = await db.select().from(articleArchives);
  assert.equal(versions.length, 2);
  await restoreArticleContent(db, store, 1, now);
  const restored = (await db.select().from(articles).where(eq(articles.id, 1)))[0];
  assert.equal(restored.body, 'version a');
  assert.equal(restored.description, '重要摘要');
  assert.equal(restored.contentAccessedAt?.toISOString(), now.toISOString());
  assert.equal((await archiveColdContent(db, store, now)).archived, 0);
  await assert.rejects(restoreArticleContent(db, store, 1, now), /conflict/);
  assert.equal((await loadArticleContent(db, 1, now))!.content.body, null);
  checks.push('NAS hydration restores exact content, refreshes cache lifetime, refuses overwrite, preserves public seven-day window');
  const pressure: ArchiveStore = {
    remote: store.remote,
    localFreeBytes: async () => 15 * 2 ** 30,
    putVerified: (...args) => store.putVerified(...args),
    getVerified: (...args) => store.getVerified(...args),
  };
  const pressured = await runRetentionJob(db, { archiveStore: pressure, now: () => now, batch: 10 });
  assert.equal(pressured.contentEvicted, 1);
  assert.ok(pressured.cachePressurePages > 0);
  assert.equal((await db.select().from(articles).where(eq(articles.id, 6)))[0].body, null);
  await restoreArticleContent(db, store, 6, now);
  checks.push('Simulated 15 GiB free space archives 30-day idle content; recently restored/used content stays cached');
  const report = {
    checkedAt: new Date().toISOString(),
    checks,
    retention: result,
    archiveVersions: (await db.select().from(articleArchives)).length,
    remote: store.remote,
    migrations: '0000 through 0016',
    productionModified: false,
  };
  const directory = process.env.NEARLINE_SMOKE_REPORT_DIR;
  if (directory) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await connection.close();
}
