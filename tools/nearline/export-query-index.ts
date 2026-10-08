// Read-only DB adapters for the unified nearline metadata index.
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { createDb } from '../../app/src/db/client.ts';
import {
  decimalId,
  legacyOriginReference,
  type OriginRecord,
  type SiteArchiveRecord,
  siteArchiveEntry,
} from '../../app/src/nearline/query-index.ts';

const archiveColumns = `CAST(article_id AS CHAR) articleId, content_hash contentHash,
 object_key objectKey, object_hash objectHash, archive_remote archiveRemote,
 DATE_FORMAT(archived_at,'%Y-%m-%dT%H:%i:%s.000Z') archivedAt,
 DATE_FORMAT(verified_at,'%Y-%m-%dT%H:%i:%s.000Z') verifiedAt`;

async function exportSite(connection: PoolConnection, output: string) {
  output = resolve(output);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const temporary = `${output}.${process.pid}.partial`;
  const file = await open(temporary, 'wx', 0o600);
  let records = 0;
  try {
    await file.writeFile(
      `${JSON.stringify({ type: 'header', format: 'tag-site-archive-snapshot-v1', capturedAt: new Date().toISOString() })}\n`,
    );
    let lastId = '0';
    let lastHash = '';
    for (;;) {
      const [rows] = await connection.query<(RowDataPacket & SiteArchiveRecord)[]>(
        `SELECT ${archiveColumns} FROM article_archives WHERE article_id > ? OR (article_id = ? AND content_hash > ?)
         ORDER BY article_id, content_hash LIMIT 500`,
        [lastId, lastId, lastHash],
      );
      if (!rows.length) break;
      for (const row of rows) {
        const record: SiteArchiveRecord = { ...row, type: 'archive' };
        siteArchiveEntry(record); // Validate before publishing the snapshot.
        await file.writeFile(`${JSON.stringify(record)}\n`);
        records++;
      }
      lastId = rows.at(-1)!.articleId;
      lastHash = rows.at(-1)!.contentHash;
    }
    await file.writeFile(`${JSON.stringify({ type: 'footer', records })}\n`);
    await file.sync();
    await file.close();
    await rename(temporary, output);
    return { format: 'tag-site-archive-snapshot-v1', records, output };
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
}

async function resolveArticle(connection: PoolConnection, articleId: string) {
  decimalId(articleId, true);
  // Bounded lookups use existing article_id indexes. No full article scan/export.
  const [archives] = await connection.query<(RowDataPacket & SiteArchiveRecord)[]>(
    `SELECT ${archiveColumns} FROM article_archives WHERE article_id = ? ORDER BY content_hash LIMIT 101`,
    [articleId],
  );
  const [origins] = await connection.query<(RowDataPacket & OriginRecord)[]>(
    `SELECT source_key sourceKey, raw_hash rawHash, CAST(article_id AS CHAR) articleId,
     generation, source_object sourceObject FROM article_origins WHERE article_id = ? ORDER BY source_key,raw_hash LIMIT 101`,
    [articleId],
  );
  return {
    format: 'tag-nearline-article-links-v1',
    articleId,
    entries: archives.slice(0, 100).map(siteArchiveEntry),
    legacyReferences: origins.slice(0, 100).map(legacyOriginReference),
    truncated: { contentVersions: archives.length > 100, legacyOrigins: origins.length > 100 },
    scope:
      'Read-only bounded metadata lookup; legacy references require lookup in the local package index. No content fetched or public visibility changed.',
  };
}

async function main() {
  process.umask(0o077);
  const { values } = parseArgs({ options: { out: { type: 'string' }, 'article-id': { type: 'string' } } });
  if (Boolean(values.out) === Boolean(values['article-id'])) throw new Error('Specify exactly one of --out or --article-id');
  if (values['article-id']) decimalId(values['article-id'], true);
  const db = createDb(undefined, { poolSize: 1 });
  let connection: PoolConnection | undefined;
  try {
    connection = await db.pool.getConnection();
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const result = values.out ? await exportSite(connection, values.out) : await resolveArticle(connection, values['article-id']!);
    await connection.commit();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    await db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    // DB errors can include credentials/SQL values; operator output stays bounded.
    console.error('Nearline metadata export failed. Check DB configuration and source receipts.');
    process.exitCode = 1;
  });
}
