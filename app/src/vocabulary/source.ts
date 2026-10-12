import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { parseDbUrl } from '../db/client.ts';
import type { SourceTerm } from './snapshots.ts';
export interface AggregateTerm extends SourceTerm {
  groupKey: string;
}
export const keySql = "TRIM(TRAILING '0209' FROM HEX(WEIGHT_STRING(tag)))";
export async function withVocabularySource<T>(run: (db: Connection) => Promise<T>): Promise<T> {
  const db = await mysql.createConnection({
    ...parseDbUrl(process.env.TAG_DB_URL),
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectTimeout: 5000,
  });
  try {
    await db.query('SET SESSION max_statement_time=0.9');
    await db.query('SET SESSION TRANSACTION READ ONLY');
    return await run(db);
  } finally {
    await db.end();
  }
}
export async function upperTag(db: Connection, after: string | null, size: number) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT DISTINCT tag FROM article_tags FORCE INDEX(tag_published) ${after === null ? '' : 'WHERE tag>?'} ORDER BY tag LIMIT ${size}`,
    after === null ? [] : [after],
  );
  return rows.at(-1)?.tag as string | undefined;
}
export async function tagKey(db: Connection, tag: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT TRIM(TRAILING '0209' FROM HEX(WEIGHT_STRING(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci))) k`,
    [tag],
  );
  return String(rows[0].k);
}
export async function aggregateRange(db: Connection, after: string | null, until: string, exact = false): Promise<AggregateTerm[]> {
  const where = exact ? 'tag=?' : after === null ? 'tag<=?' : 'tag>? AND tag<=?';
  const params = exact ? [until] : after === null ? [until] : [after, until];
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT CONVERT(BINARY tag USING utf8mb4) tag,${keySql} groupKey,COUNT(*) n,MIN(published_at) firstAt,MAX(published_at) lastAt FROM article_tags FORCE INDEX(tag_published) WHERE ${where} GROUP BY BINARY tag`,
    params,
  );
  return rows.map((r) => ({
    tag: r.tag,
    groupKey: r.groupKey,
    articleCount: Number(r.n),
    firstPublishedAt: new Date(r.firstAt.replace(' ', 'T') + 'Z').toISOString(),
    lastPublishedAt: new Date(r.lastAt.replace(' ', 'T') + 'Z').toISOString(),
  }));
}
export async function maxArticleId(db: Connection) {
  const [r] = await db.query<RowDataPacket[]>('SELECT COALESCE(MAX(id),0) id FROM articles');
  return String(r[0].id);
}
export async function newArticleTags(db: Connection, after: { id: string; tag: string } | null, lower: string, upper: string, size = 5000) {
  const where = after ? '(article_id>? OR (article_id=? AND tag>?))' : 'article_id>?';
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT article_id,tag,published_at,${keySql} groupKey FROM article_tags FORCE INDEX(article_tag) WHERE ${where} AND article_id<=? ORDER BY article_id,tag LIMIT ${size}`,
    after ? [after.id, after.id, after.tag, upper] : [lower, upper],
  );
  return rows;
}
/** Rare huge single-key ranges use indexed keyset pages without GROUP BY. */
export async function exactTagRows(db: Connection, tag: string, cursor: { at: string; id: string } | null, limit = 5000) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT tag,${keySql} groupKey,article_id,published_at FROM article_tags FORCE INDEX(tag_published) WHERE tag=? ${cursor ? 'AND (published_at>? OR (published_at=? AND article_id>?))' : ''} ORDER BY published_at,article_id LIMIT ${limit}`,
    cursor ? [tag, cursor.at, cursor.at, cursor.id] : [tag],
  );
  return rows;
}
