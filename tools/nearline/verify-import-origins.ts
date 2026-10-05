// Independent read-only reconciliation of archived outcomes against live IDs.
import { createReadStream } from 'node:fs';
import { parseArgs } from 'node:util';
import { createGunzip } from 'node:zlib';
import type { RowDataPacket } from 'mysql2/promise';
import { createDb } from '../../app/src/db/client.ts';
import { jsonLines } from '../../app/src/legacy/jsonl.ts';

const { values } = parseArgs({ options: { audit: { type: 'string' }, expected: { type: 'string' } } });
if (!values.audit || !/^\d+$/.test(values.expected ?? '')) throw new Error('--audit and --expected required');
const db = createDb(undefined, { poolSize: 1 });
let verified = 0;
let batch: { sourceKey: string; rawHash: string; articleId: string }[] = [];
async function check() {
  if (!batch.length) return;
  const [actual] = await db.pool.query<RowDataPacket[]>(
    'SELECT o.source_key,o.raw_hash,o.article_id FROM article_origins o JOIN articles a ON a.id=o.article_id WHERE (o.source_key,o.raw_hash) IN (?)',
    [batch.map((row) => [row.sourceKey, row.rawHash])],
  );
  const found = new Map(actual.map((row) => [row.source_key + '/' + row.raw_hash, String(row.article_id)]));
  if (batch.some((row) => found.get(row.sourceKey + '/' + row.rawHash) !== row.articleId))
    throw new Error('Archived origin or article ID missing/mismatched in live database');
  verified += batch.length;
  batch = [];
}
try {
  for await (const line of jsonLines(createReadStream(values.audit).pipe(createGunzip()))) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (row.action === 'quarantine') continue;
    if (!['inserted', 'linked_existing', 'already_imported'].includes(row.action) || !/^[1-9]\d*$/.test(row.articleId ?? ''))
      throw new Error('Invalid archived outcome');
    batch.push(row);
    if (batch.length === 500) await check();
  }
  await check();
  if (verified !== Number(values.expected)) throw new Error('Verified origin total differs from expected');
  console.log(JSON.stringify({ verifiedOrigins: verified, verifiedAt: new Date().toISOString() }));
} finally {
  await db.close();
}
