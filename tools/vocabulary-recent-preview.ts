/** Resumable, read-only recent-count hydration for existing private aggregates. */

import { statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import type { RowDataPacket } from 'mysql2/promise';
import { VocabularyAggregate } from '../app/src/vocabulary/aggregate.ts';
import { probeHome } from '../app/src/vocabulary/runner.ts';
import { aggregateRange, withVocabularySource } from '../app/src/vocabulary/source.ts';

process.umask(0o077);
const directory = process.env.TAG_VOCABULARY_EXPORT_DIR;
if (!directory || process.env.TAG_VOCABULARY_EXPORT_ENABLED !== 'true') throw Error('Export not enabled');
const lock = new DatabaseSync(join(directory, 'runner-lock.sqlite'));
lock.exec('CREATE TABLE IF NOT EXISTS lock(id INTEGER PRIMARY KEY); BEGIN IMMEDIATE');
const aggregate = new VocabularyAggregate(join(directory, 'aggregate.sqlite'));
const started = Date.now();
const asOf = aggregate.get<string>('recentHydrationAsOf') ?? new Date().toISOString();
aggregate.set('recentHydrationAsOf', asOf);
const sqlTime = (value: number) => new Date(value).toISOString().slice(0, 19).replace('T', ' ');
const cutoffs = [30, 90, 180].map((days) => sqlTime(Date.parse(asOf) - days * 86400000));
const end = sqlTime(Date.parse(asOf));
let size = 1000,
  lastProbe = 0,
  processed = 0;
const metrics = { queries: 0, queryMs: 0, maxQueryMs: 0, rows: 0, homeSamples: 0, homeMaxMs: 0, homeTotalMs: 0 };
const guard = async () => {
  if (Date.now() - started > Number(process.env.TAG_VOCABULARY_MAX_DURATION_MS ?? 3600000)) throw Error('runtime-budget');
  if (Date.now() - lastProbe < 2000) return;
  const home = await probeHome();
  metrics.homeSamples++;
  metrics.homeMaxMs = Math.max(metrics.homeMaxMs, home.ttfbMs);
  metrics.homeTotalMs += home.ttfbMs;
  console.log(JSON.stringify({ phase: 'home', ...home }));
  if (home.status !== 200 || home.ttfbMs > 1000) throw Error('home-ttfb');
  const disk = await statfs(directory);
  if (disk.bavail * disk.bsize < 4 * 1024 ** 3) throw Error('disk-reserve');
  lastProbe = Date.now();
};
try {
  await withVocabularySource(async (db) => {
    while (!aggregate.get('recentHydrationComplete')) {
      await guard();
      const cursor = aggregate.get<{ key: string; tag: string }>('recentHydrationCursor');
      const keys = aggregate.db
        .prepare(
          `SELECT group_key,MIN(label) tag FROM terms ${cursor ? 'WHERE group_key>?' : ''} GROUP BY group_key ORDER BY group_key LIMIT ?`,
        )
        .all(...(cursor ? [cursor.key, size] : [size]));
      if (!keys.length) {
        // Source ingestion may advance while the old total counts are being hydrated.
        // Recompute only contradictory groups before marking the preview complete.
        const inconsistent = aggregate.db
          .prepare('SELECT group_key,MIN(t.label) tag FROM terms t JOIN recent_counts r USING(label) WHERE r180>n GROUP BY group_key')
          .all();
        for (const row of inconsistent) {
          await guard();
          const startedQuery = Date.now();
          const terms = await aggregateRange(db, null, String(row.tag), true, new Date(asOf));
          const elapsed = Date.now() - startedQuery;
          metrics.queries++;
          metrics.queryMs += elapsed;
          metrics.maxQueryMs = Math.max(metrics.maxQueryMs, elapsed);
          aggregate.replaceExact(String(row.group_key), terms);
          await delay(100);
        }
        aggregate.set('recentHydrationComplete', true);
        break;
      }
      const upper = keys.at(-1)!;
      let rows: RowDataPacket[];
      const at = Date.now();
      try {
        const [result] = await db.query<RowDataPacket[]>(
          `SELECT CONVERT(BINARY tag USING utf8mb4) tag,SUM(published_at>=?) r30,SUM(published_at>=?) r90,COUNT(*) r180 FROM article_tags FORCE INDEX(tag_published) WHERE ${cursor ? 'tag>? AND ' : ''}tag<=? AND published_at>=? AND published_at<=? GROUP BY BINARY tag`,
          [cutoffs[0], cutoffs[1], ...(cursor ? [cursor.tag] : []), upper.tag, cutoffs[2], end],
        );
        rows = result;
      } catch (e) {
        if ((e as { errno?: number }).errno === 1969 && size > 1) {
          size = Math.max(1, Math.floor(size / 2));
          continue;
        }
        throw e;
      } finally {
        const elapsed = Date.now() - at;
        metrics.queries++;
        metrics.queryMs += elapsed;
        metrics.maxQueryMs = Math.max(metrics.maxQueryMs, elapsed);
        await delay(100);
      }
      aggregate.transaction(() => {
        const put = aggregate.db.prepare('INSERT OR REPLACE INTO recent_counts VALUES(?,?,?,?,?)');
        for (const row of rows) put.run(row.tag, Number(row.r30), Number(row.r90), Number(row.r180), asOf);
        aggregate.set('recentHydrationCursor', { key: upper.group_key, tag: upper.tag });
      });
      metrics.rows += rows.length;
      processed += keys.length;
      if (processed % 10000 < keys.length) console.log(JSON.stringify({ phase: 'recent-counts', processed, asOf, ...metrics }));
      if (size < 1000) size = Math.min(1000, size * 2);
    }
  });
  console.log(JSON.stringify({ status: 'complete', asOf, elapsedMs: Date.now() - started, ...metrics }));
} catch (e) {
  console.log(JSON.stringify({ status: 'paused', reason: (e as Error).message, asOf, elapsedMs: Date.now() - started, ...metrics }));
  process.exitCode = 1;
} finally {
  aggregate.close();
  lock.close();
}
