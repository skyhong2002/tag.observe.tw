import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sourceByMedia } from '../crawl/registry.ts';
import { createDb } from '../db/client.ts';
import { importCandidates, importIssue } from './import.ts';
import { normalizeLegacyArticle } from './normalize.ts';

const now = new Date('2026-10-05T09:00:00Z');
const context = {
  source: 'tag-analysis/tag',
  table: 'tag_cna',
  generation: 'test-generation',
  capturedAt: now.toISOString(),
  objects: ['a'.repeat(64)],
  spec: sourceByMedia('cna')!,
};
const candidate = (id: number, path = String(id)) =>
  normalizeLegacyArticle(
    {
      newsid: String(id),
      title: 'Historical title',
      url: `https://www.cna.com.tw/news/aall/${path}.aspx`,
      create_time: '2014-01-01 10:00:00',
      ctime: '2014-01-01 11:00:00',
      tags: '[歷史][History][history]',
      description: 'Old summary',
    },
    context,
  );
it('holds recent rows, oversized multibyte summaries, and invalid dates', () => {
  expect(importIssue(candidate(1), now)).toBeNull();
  const recent = candidate(1);
  recent.article.crawledAt = now.toISOString();
  expect(importIssue(recent, now)).toBe('recent_requires_separate_review');
  expect(importIssue(recent, now, true)).toBeNull();
  const large = candidate(1);
  large.article.description = '中'.repeat(22000);
  expect(importIssue(large, now)).toBe('description_exceeds_text_bytes');
  const invalid = candidate(1);
  invalid.disposition = 'quarantine';
  invalid.reasons = ['invalid_publication_time'];
  expect(importIssue(invalid, now)).toBe('invalid_publication_time');
  expect(importIssue(invalid, now, true)).toBe('invalid_publication_time');
});
const testUrl = process.env.LEGACY_IMPORT_TEST_DB_URL;
describe.skipIf(!testUrl)('disposable MariaDB import', () => {
  const db = testUrl ? createDb(testUrl) : null;
  beforeAll(async () => {
    const target = new URL(testUrl!);
    if (target.hostname !== '127.0.0.1' || target.pathname !== '/legacy_import_test' || target.port !== '23316')
      throw new Error('Disposable test DB required');
    await migrate(db!.db, { migrationsFolder: resolve('app/src/db/migrations') });
  });
  afterAll(async () => {
    await db?.close();
  });
  it('preserves own data, detects collation and split identity conflicts, resumes, and rolls back a failed batch', async () => {
    const c = await db!.pool.getConnection();
    const run = (rows: ReturnType<typeof candidate>[], apply: boolean) =>
      importCandidates(c, rows, { apply, now, generation: context.generation, object: 'objects/aa/test.sql.gz' });
    try {
      const own = candidate(2);
      await c.query(
        "INSERT INTO articles (media,published_at,crawled_at,url,url_key,title,tags,body,description,source) VALUES ('cna','2014-01-01 02:00:00','2014-01-01 03:00:00',?,?,?,'[]','OWN BODY','OWN SUMMARY','own')",
        [own.article.url, own.article.urlKey, own.article.title],
      );
      const collision = candidate(3, 'Case');
      const collision2 = candidate(4, 'case');
      const rows = [candidate(1), own, collision, collision2];
      expect((await run(rows, false)).map((r) => r.action)).toEqual(['inserted', 'linked_existing', 'quarantine', 'quarantine']);
      const [before] = await c.query('SELECT COUNT(*) n FROM articles');
      expect((before as { n: number }[])[0].n).toBe(1);
      expect((await run(rows, true)).map((r) => r.action)).toEqual(['inserted', 'linked_existing', 'quarantine', 'quarantine']);
      expect((await run(rows, true)).map((r) => r.action)).toEqual(['already_imported', 'already_imported', 'quarantine', 'quarantine']);
      const [preserved] = await c.query('SELECT source,body,description FROM articles WHERE url=?', [own.article.url]);
      expect(preserved).toMatchObject([{ source: 'own', body: 'OWN BODY', description: 'OWN SUMMARY' }]);
      const [inserted] = await c.query(
        "SELECT source,body,fetched_at,content_fetched_at,content_accessed_at FROM articles WHERE source='legacy'",
      );
      expect(inserted).toMatchObject([
        { source: 'legacy', body: null, fetched_at: null, content_fetched_at: null, content_accessed_at: now },
      ]);
      const changed = candidate(1);
      changed.lineage.rawSha256 = 'b'.repeat(64);
      expect((await run([changed], true))[0].reason).toBe('source_version_conflict');
      const mismatch = candidate(5, '2');
      mismatch.article.title = 'Different';
      expect((await run([mismatch], true))[0].reason).toBe('existing_identity_or_metadata_conflict');
      const caseMismatch = candidate(6, '2');
      caseMismatch.article.url = caseMismatch.article.url.toUpperCase();
      expect((await run([caseMismatch], true))[0].reason).toBe('existing_identity_or_metadata_conflict');
      const split = candidate(7);
      split.article.url = candidate(1).article.url;
      split.article.urlKey = own.article.urlKey;
      expect((await run([split], true))[0].reason).toBe('existing_identity_or_metadata_conflict');
      const malformed = candidate(9);
      malformed.article.title = 'X'.repeat(513);
      await expect(run([candidate(8), malformed], true)).rejects.toThrow();
      const [rolledBack] = await c.query('SELECT COUNT(*) n FROM articles WHERE url=?', [candidate(8).article.url]);
      expect((rolledBack as { n: number }[])[0].n).toBe(0);
      expect((await run([candidate(8)], true))[0].action).toBe('inserted');
      const equivalent1 = candidate(101, 'identical');
      const equivalent2 = candidate(102, 'identical');
      equivalent2.article.crawledAt = '2014-01-02T00:00:00Z';
      const equivalent = await run([equivalent1,equivalent2],true);
      expect(equivalent.map((r)=>r.action)).toEqual(['inserted','linked_existing']);
      expect(equivalent[0].articleId).toBe(equivalent[1].articleId);
      const contentConflict = candidate(103,'identical-other');
      const contentConflict2 = candidate(104,'identical-other');
      contentConflict2.article.description='Conflicting summary';
      expect((await run([contentConflict,contentConflict2],true)).map((r)=>r.reason)).toEqual(['input_identity_collision','input_identity_collision']);
      const revised = candidate(101,'identical');
      revised.lineage.rawSha256='d'.repeat(64);
      const revisedResult=await importCandidates(c,[revised],{apply:true,now,generation:'new-generation',object:'objects/aa/test.sql.gz',allowSourceVersions:true});
      expect(revisedResult[0].action).toBe('linked_existing');
      expect(revisedResult[0].articleId).toBe(equivalent[0].articleId);
      const changedIdentity=candidate(101,'changed-identity');
      changedIdentity.lineage.rawSha256='e'.repeat(64);
      expect((await importCandidates(c,[changedIdentity],{apply:true,now,generation:'new-generation',object:'objects/aa/test.sql.gz',allowSourceVersions:true}))[0].reason).toBe('source_version_conflict');
      await expect(run([candidate(11), candidate(11)], true)).rejects.toThrow('Duplicate source keys');
      const missing = candidate(12);
      const [created] = await run([missing], true);
      await c.query('DELETE FROM articles WHERE id=?', [created.articleId]);
      expect((await run([missing], true))[0].reason).toBe('missing_origin_article');
      const recent = candidate(10);
      recent.article.publishedAt = now.toISOString();
      recent.article.crawledAt = now.toISOString();
      expect((await run([recent], true))[0].reason).toBe('recent_requires_separate_review');
      const allowRecent = () =>
        importCandidates(c, [recent], {
          apply: true,
          allowRecent: true,
          now,
          generation: context.generation,
          object: 'objects/aa/test.sql.gz',
        });
      expect((await allowRecent())[0].action).toBe('inserted');
      expect((await allowRecent())[0].action).toBe('already_imported');
      const [recentStored] = await c.query('SELECT source,fetched_at,content_fetched_at FROM articles WHERE url=?', [recent.article.url]);
      expect(recentStored).toMatchObject([{ source: 'legacy', fetched_at: null, content_fetched_at: null }]);
    } finally {
      c.release();
    }
  }, 30000);
});
