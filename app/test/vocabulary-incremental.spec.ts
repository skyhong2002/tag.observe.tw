import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mysql, { type Connection } from 'mysql2/promise';
import { afterEach, describe, expect, it } from 'vitest';
import { VocabularyAggregate } from '../src/vocabulary/aggregate.ts';
import { runVocabulary, VocabularyPaused } from '../src/vocabulary/runner.ts';
import { type SourceTerm, VocabularySnapshots, vocabularyTerm } from '../src/vocabulary/snapshots.ts';
import { tagKey } from '../src/vocabulary/source.ts';

const dirs: string[] = [];
const term = (tag: string, n = 1): SourceTerm => ({
  tag,
  articleCount: n,
  firstPublishedAt: '2026-10-01T00:00:00.000Z',
  lastPublishedAt: '2026-10-01T00:00:00.000Z',
});
async function setup() {
  const d = await mkdtemp(join(tmpdir(), 'vocab-incremental-'));
  dirs.push(d);
  return d;
}
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
it('keeps only delta files between daily bases and replays across daily generations', async () => {
  const d = await setup(),
    s = new VocabularySnapshots(d),
    a = await s.publish(async () => [term('A')]);
  const b = await s.publishDelta([{ action: 'upsert', term: vocabularyTerm(term('B')) }], 2);
  expect(await readdir(join(d, b.id))).toEqual(['changes-0.json.gz', 'generation.json']);
  expect(await s.current()).toMatchObject({ id: a.id, total: 1 });
  const c = await s.publishStream([term('A'), term('B')], new Date(), { changes: [] });
  const e = await s.publishDelta([{ action: 'upsert', term: vocabularyTerm(term('B', 2)) }], 2);
  const p = await s.changes(a.id, e.id);
  expect(p.entries).toEqual([{ action: 'upsert', term: vocabularyTerm(term('B')), active: false }]);
  expect(p.nextCursor).toBe('1');
  const p2 = await s.changes(a.id, e.id, p.nextCursor!);
  expect(p2.entries[0]).toMatchObject({ term: { articleCount: 2 } });
  expect(p2.nextCursor).toBeNull();
  expect(p2.sha256).toBe(
    createHash('sha256')
      .update(JSON.stringify(p2.entries) + '\n')
      .digest('hex'),
  );
  expect((await s.changes(c.id, e.id)).entries).toEqual(p2.entries);
  await s.publish(async () => [term('B', 2)]);
  await s.publish(async () => [term('B', 2)]);
  await s.prune();
  await expect(s.changes(a.id)).rejects.toMatchObject({ code: 'resnapshot-required' });
});
describe.skipIf(process.env.VOCABULARY_INTEGRATION !== '1')('read-only MariaDB source integration', () => {
  it('bootstraps exact Unicode labels, catches late commits idempotently, and reconciles old deletions', async () => {
    const d = await setup();
    let writer: Connection | undefined, reader: Connection | undefined;
    const options = {
      host: '127.0.0.1',
      port: 18306,
      user: 'root',
      password: 'vocabulary-fixture',
      charset: 'utf8mb4',
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
    };
    try {
      writer = await mysql.createConnection(options);
      await writer.query('DROP DATABASE IF EXISTS vocabulary_fixture');
      await writer.query('CREATE DATABASE vocabulary_fixture CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      await writer.query('USE vocabulary_fixture');
      await writer.query('CREATE TABLE articles(id BIGINT PRIMARY KEY)');
      await writer.query(
        'CREATE TABLE article_tags(article_id BIGINT NOT NULL,tag VARCHAR(60) NOT NULL,published_at DATETIME NOT NULL,UNIQUE KEY article_tag(article_id,tag),KEY tag_published(tag,published_at))',
      );
      for (const [i, tag] of ['AI', 'ai', 'Á', 'a', 'a ', 'e\u0301', 'é', '新聞', '台灣', '最新事件', ''].entries()) {
        await writer.query('INSERT INTO articles VALUES(?)', [i + 1]);
        await writer.query('INSERT INTO article_tags VALUES(?,?,?)', [i + 1, tag, '2026-10-01']);
      }
      reader = await mysql.createConnection({ ...options, database: 'vocabulary_fixture' });
      await reader.query('SET SESSION max_statement_time=0.9');
      await reader.query('SET SESSION TRANSACTION READ ONLY');
      expect(await tagKey(reader, 'a ')).toBe(await tagKey(reader, 'Á'));
      expect(await tagKey(reader, 'e\u0301')).toBe(await tagKey(reader, 'é'));
      const opts = { directory: d, restMs: 0, batchSize: 2, probe: async () => ({ status: 200, ttfbMs: 10 }) };
      const fallbackReader = Object.create(reader) as Connection;
      fallbackReader.query = ((sql: string, ...args: unknown[]) =>
        sql.includes('GROUP BY BINARY tag')
          ? Promise.reject({ errno: 1969 })
          : (reader!.query as (sql: string, ...args: unknown[]) => unknown).call(reader, sql, ...args)) as Connection['query'];
      const pausedBootstrap = await runVocabulary(fallbackReader, { ...opts, maxDurationMs: 1 });
      expect(pausedBootstrap.status).toBe('paused');
      const first = await runVocabulary(fallbackReader, opts);
      expect(first.status).toBe('published');
      expect(first).toMatchObject({ terms: 11 });
      const store = new VocabularySnapshots(d),
        base = await store.current();
      const labels = (await store.page(base.id)).entries.map((t) => ('label' in t ? t.label : ''));
      expect(labels).toContain('a ');
      expect(labels).toContain('');
      await writer.query('INSERT INTO articles VALUES(12),(13)');
      await writer.query("INSERT INTO article_tags VALUES(13,'最新事件','2026-10-02')");
      const second = await runVocabulary(reader, { ...opts, mode: 'fast' });
      expect(second.status).toBe('published');
      const head = (await store.changes(base.id)).snapshot.id;
      expect((await store.changes(base.id, head)).entries).toContainEqual({
        action: 'upsert',
        active: true,
        term: { ...vocabularyTerm(term('最新事件', 2)), lastPublishedAt: '2026-10-02T00:00:00.000Z' },
      });
      // A lower id commits after the higher id was already observed.
      await writer.query("INSERT INTO article_tags VALUES(12,'爆紅事件','2026-10-02')");
      await runVocabulary(reader, { ...opts, mode: 'fast' });
      const late = (await store.changes(head)).snapshot.id;
      expect((await store.changes(head, late)).entries[0]).toMatchObject({ term: { label: '爆紅事件', articleCount: 1 } });
      await runVocabulary(reader, { ...opts, mode: 'fast' });
      expect((await store.changes(late)).snapshot.id).toBe(late);
      await writer.query('INSERT INTO articles VALUES(18),(19),(20)');
      await writer.query(
        "INSERT INTO article_tags VALUES(18,'新事件甲','2026-10-02'),(19,'新事件乙','2026-10-02'),(20,'新事件丙','2026-10-02')",
      );
      expect(await runVocabulary(reader, { ...opts, mode: 'fast', maxDurationMs: 30000 })).toMatchObject({
        status: 'published',
        pendingTags: 3,
      });
      expect(await runVocabulary(reader, { ...opts, mode: 'fast' })).toMatchObject({ status: 'published', pendingTags: 0 });
      const beforeReconcile = (await store.changes(late)).snapshot.id;
      await writer.query("DELETE FROM article_tags WHERE BINARY tag=BINARY 'AI'");
      await writer.query("UPDATE article_tags SET published_at='2026-10-03' WHERE BINARY tag=BINARY 'ai'");
      await runVocabulary(reader, { ...opts, mode: 'reconcile' });
      await runVocabulary(reader, opts);
      const daily = await store.current();
      const changes = await store.changes(beforeReconcile, daily.id);
      expect(changes.entries).toContainEqual({
        action: 'absent-from-index',
        active: false,
        label: 'AI',
        id: createHash('sha256').update('AI').digest('hex'),
      });
      expect((await store.page(daily.id)).entries.find((t) => 'label' in t && t.label === 'ai')).toMatchObject({
        lastPublishedAt: '2026-10-03T00:00:00.000Z',
      });
      const paused = await runVocabulary(reader, { ...opts, mode: 'fast', probe: async () => ({ status: 200, ttfbMs: 1001 }) });
      expect(paused.status).toBe('paused');
      expect((await store.current()).id).toBe(daily.id);
      await expect(reader.query('INSERT INTO articles VALUES(999)')).rejects.toBeDefined();
    } finally {
      await reader?.end();
      await writer?.end();
    }
  }, 30000);
});

it.skipIf(process.env.VOCABULARY_INTEGRATION !== '1')(
  'resumes a large single-key range without counting the checkpointed page twice',
  async () => {
    const d = await setup(),
      options = {
        host: '127.0.0.1',
        port: 18306,
        user: 'root',
        password: 'vocabulary-fixture',
        database: 'vocabulary_fixture',
        charset: 'utf8mb4',
        dateStrings: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
      };
    const w = await mysql.createConnection(options),
      r = await mysql.createConnection(options);
    try {
      await w.query('DELETE FROM article_tags');
      await w.query('DELETE FROM articles');
      for (let start = 1; start <= 5001; start += 1000) {
        const ids = Array.from({ length: Math.min(1000, 5002 - start) }, (_, i) => start + i);
        await w.query('INSERT INTO articles VALUES ?', [ids.map((i) => [i])]);
        await w.query('INSERT INTO article_tags VALUES ?', [ids.map((i) => [i, '熱門詞', '2026-10-01'])]);
      }
      await r.query('SET SESSION TRANSACTION READ ONLY');
      const fake = Object.create(r) as Connection;
      let rawPages = 0,
        interrupt = true;
      fake.query = ((sql: string, ...args: unknown[]) => {
        if (sql.includes('GROUP BY BINARY tag')) return Promise.reject({ errno: 1969 });
        if (sql.includes('ORDER BY published_at,article_id') && ++rawPages === 2 && interrupt)
          return Promise.reject(new VocabularyPaused('test-checkpoint'));
        return (r.query as (sql: string, ...args: unknown[]) => unknown).call(r, sql, ...args);
      }) as Connection['query'];
      const opts = { directory: d, restMs: 0, batchSize: 1, probe: async () => ({ status: 200, ttfbMs: 10 }) };
      expect(await runVocabulary(fake, opts)).toMatchObject({ status: 'paused', reason: 'test-checkpoint' });
      await expect(new VocabularySnapshots(d).current()).rejects.toMatchObject({ code: 'not-found' });
      interrupt = false;
      expect(await runVocabulary(fake, opts)).toMatchObject({ status: 'published', terms: 1 });
      const store = new VocabularySnapshots(d),
        base = await store.current();
      expect((await store.page(base.id)).entries[0]).toMatchObject({ label: '熱門詞', articleCount: 5001 });
    } finally {
      await r.end();
      await w.end();
    }
  },
  30000,
);

it('emits an inactive upsert when a low-frequency term ages out without a source edit', async () => {
  const d = await setup(),
    a = new VocabularyAggregate(join(d, 'aggregate.sqlite')),
    at = new Date('2026-01-01T00:00:00.000Z');
  try {
    a.replace(null, null, [{ ...term('短期事件'), firstPublishedAt: at.toISOString(), lastPublishedAt: at.toISOString(), groupKey: '01' }]);
    a.db.exec('DELETE FROM changes');
    a.queueActiveExpiry(new Date(at.getTime() + 180 * 86400000 - 1));
    expect(a.db.prepare('SELECT COUNT(*) n FROM changes').get()!.n).toBe(0);
    a.queueActiveExpiry(new Date(at.getTime() + 180 * 86400000 + 1));
    expect(a.db.prepare('SELECT COUNT(*) n FROM changes').get()!.n).toBe(1);
    const s = new VocabularySnapshots(d),
      base = await s.publish(async () => []);
    await s.publishDelta(
      [
        {
          action: 'upsert',
          term: vocabularyTerm({ ...term('短期事件'), firstPublishedAt: at.toISOString(), lastPublishedAt: at.toISOString() }),
        },
      ],
      1,
      new Date(at.getTime() + 180 * 86400000 + 1),
    );
    expect((await s.changes(base.id)).entries[0]).toMatchObject({ active: false });
  } finally {
    a.close();
  }
});
