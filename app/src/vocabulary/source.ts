import { performance } from 'node:perf_hooks';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { parseDbUrl } from '../db/client.ts';
import { MAX_TERMS, type SourceTerm } from './snapshots.ts';

export const SOURCE_QUERY = `SELECT CONVERT(BINARY t.tag USING utf8mb4) AS tag,
  COUNT(DISTINCT t.article_id) AS articleCount,
  MIN(a.published_at) AS firstPublishedAt, MAX(a.published_at) AS lastPublishedAt
  FROM article_tags t INNER JOIN articles a ON a.id = t.article_id
  GROUP BY BINARY t.tag ORDER BY BINARY t.tag LIMIT ${MAX_TERMS + 1}`;

/** A covering loose-index probe bounds work before any join/filesort. Its
 * collation may merge exact labels and it includes orphan associations, so it
 * is a conservative preflight, not the published vocabulary count. */
export async function inspectVocabularySource(db: Connection) {
  const started = performance.now();
  await db.query('SET SESSION max_statement_time = 10');
  const [tables] = await db.execute<RowDataPacket[]>(
    'SELECT TABLE_NAME, ENGINE, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?)',
    ['article_tags', 'articles'],
  );
  if (tables.length !== 2 || tables.some((r) => r.ENGINE !== 'InnoDB')) throw Error('Consistent export requires InnoDB source tables.');
  const [columns] = await db.execute<RowDataPacket[]>(
    'SELECT CHARACTER_SET_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    ['article_tags', 'tag'],
  );
  if (columns.length !== 1 || !['utf8mb4', 'utf8mb3', 'utf8'].includes(columns[0].CHARACTER_SET_NAME))
    throw Error('Unsupported tag encoding.');
  const [plan] = await db.query<RowDataPacket[]>(`EXPLAIN ${SOURCE_QUERY}`);
  const [counts] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) n FROM (SELECT DISTINCT tag FROM article_tags ORDER BY tag LIMIT ${MAX_TERMS + 1}) labels`,
  );
  const indexedLabels = Number(counts[0].n);
  return {
    preflightMs: Math.round(performance.now() - started),
    tables,
    plan,
    indexedLabels,
    indexedLabelsCapped: indexedLabels > MAX_TERMS,
    limit: MAX_TERMS,
  };
}

export async function withVocabularySource<T>(run: (db: Connection) => Promise<T>): Promise<T> {
  const db = await mysql.createConnection({
    ...parseDbUrl(process.env.TAG_DB_URL),
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectTimeout: 5000,
  });
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

export async function readVocabularySource(db: Connection): Promise<SourceTerm[]> {
  // No database mutations or locking reads, even with existing service credentials.
  await db.query('SET SESSION max_statement_time = 30');
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  try {
    const [rows] = await db.query<RowDataPacket[]>(SOURCE_QUERY);
    if (rows.length > MAX_TERMS) throw Error('Vocabulary exceeds capacity.');
    const terms = rows.map((r) => ({
      tag: r.tag,
      articleCount: Number(r.articleCount),
      firstPublishedAt: r.firstPublishedAt.toISOString(),
      lastPublishedAt: r.lastPublishedAt.toISOString(),
    }));
    await db.commit();
    return terms;
  } catch {
    await db.rollback().catch(() => {});
    throw Error('Vocabulary source read failed or exceeded its deadline; current retained.');
  }
}
