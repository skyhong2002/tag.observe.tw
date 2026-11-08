// One-off repair for #30: re-create legacy articles that the crawler deleted while an
// article_origins row still pointed at them. Each candidate is the archived prepared
// row for that exact origin (source key + raw hash), read back from the NAS.
//
// Restores the row under its original ID so the existing origin is valid again. The
// url_key is recomputed with the current source rules (Yahoo now keys by full path),
// because the old key may have been taken by another row since the deletion.
// Skips (never overwrites) when the article exists again, the origin does not point at
// that ID, or the URL/key now belongs to another row. Dry run unless --apply.
//
//   node --env-file=.env tools/nearline/restore-origin-articles.ts --input candidates.jsonl [--apply] [--receipt out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { sourceByMedia } from '../../app/src/crawl/registry.ts';
import { urlKey } from '../../app/src/crawl/text.ts';

export type RestoreCandidate = {
  sourceKey: string;
  rawHash: string;
  articleId: string;
  article: {
    media: string;
    publishedAt: string;
    crawledAt: string;
    url: string;
    title: string;
    image: string | null;
    category: string | null;
    creator: string | null;
    tags: string[];
    description: string | null;
  };
};
export type RestoreResult = {
  articleId: string;
  sourceKey: string;
  action: 'restored' | 'would_restore' | 'skipped';
  reason?: string;
  conflictId?: string;
};

const dateSql = (value: string) => new Date(value).toISOString().slice(0, 19).replace('T', ' ');

export async function restoreOriginArticles(
  c: PoolConnection,
  candidates: RestoreCandidate[],
  { apply = false, now = new Date() }: { apply?: boolean; now?: Date } = {},
): Promise<RestoreResult[]> {
  const results: RestoreResult[] = [];
  const seen = new Set<string>();
  for (const cand of candidates) {
    const a = cand.article;
    const base = { articleId: cand.articleId, sourceKey: cand.sourceKey };
    if (!/^[1-9]\d*$/.test(cand.articleId)) throw new Error(`Invalid article ID for ${cand.sourceKey}`);
    if (seen.has(cand.articleId)) {
      results.push({ ...base, action: 'skipped', reason: 'duplicate_candidate' });
      continue;
    }
    seen.add(cand.articleId);
    const spec = sourceByMedia(a.media);
    if (!spec) {
      results.push({ ...base, action: 'skipped', reason: 'unknown_media' });
      continue;
    }
    const key = urlKey(a.url, spec.list.articleId);
    await c.beginTransaction();
    try {
      const [origin] = await c.query<RowDataPacket[]>(
        'SELECT article_id FROM article_origins WHERE source_key=? AND raw_hash=? FOR UPDATE',
        [cand.sourceKey, cand.rawHash],
      );
      const [present] = await c.query<RowDataPacket[]>('SELECT id FROM articles WHERE id=? FOR UPDATE', [cand.articleId]);
      const [conflict] = await c.query<RowDataPacket[]>(
        'SELECT id FROM articles WHERE media=? AND (url=? OR url_key=?) LIMIT 1 FOR UPDATE',
        [a.media, a.url, key],
      );
      let skip: Omit<RestoreResult, 'articleId' | 'sourceKey' | 'action'> | null = null;
      if (origin.length !== 1 || String(origin[0].article_id) !== cand.articleId) skip = { reason: 'origin_mismatch' };
      else if (present.length) skip = { reason: 'article_present' };
      else if (conflict.length) skip = { reason: 'url_or_key_taken', conflictId: String(conflict[0].id) };
      if (skip || !apply) {
        await c.rollback();
        results.push(skip ? { ...base, action: 'skipped', ...skip } : { ...base, action: 'would_restore' });
        continue;
      }
      await c.query(
        `INSERT INTO articles
         (id,media,published_at,crawled_at,url,url_key,title,image,category,creator,tags,description,source,content_accessed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'legacy',?)`,
        [
          cand.articleId,
          a.media,
          dateSql(a.publishedAt),
          dateSql(a.crawledAt),
          a.url,
          key,
          a.title,
          a.image,
          a.category,
          a.creator,
          JSON.stringify(a.tags),
          a.description,
          a.description ? dateSql(now.toISOString()) : null,
        ],
      );
      if (a.tags.length)
        await c.query(
          'INSERT INTO article_tags (article_id,tag,published_at) VALUES ? ON DUPLICATE KEY UPDATE published_at=VALUES(published_at)',
          [a.tags.map((tag) => [cand.articleId, tag, dateSql(a.publishedAt)])],
        );
      await c.commit();
      results.push({ ...base, action: 'restored' });
    } catch (error) {
      await c.rollback();
      throw error;
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { input: { type: 'string' }, apply: { type: 'boolean' }, receipt: { type: 'string' } } });
  if (!values.input) throw new Error('--input required');
  const candidates = readFileSync(values.input, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RestoreCandidate);
  const { createDb } = await import('../../app/src/db/client.ts');
  const db = createDb(undefined, { poolSize: 1 });
  const c = await db.pool.getConnection();
  try {
    const results = await restoreOriginArticles(c, candidates, { apply: !!values.apply });
    const counts: Record<string, number> = {};
    for (const r of results) {
      const k = r.action + (r.reason ? `:${r.reason}` : '');
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const receipt = { apply: !!values.apply, at: new Date().toISOString(), candidates: candidates.length, counts, results };
    if (values.receipt) writeFileSync(values.receipt, `${JSON.stringify(receipt, null, 1)}\n`, { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ apply: receipt.apply, candidates: receipt.candidates, counts }));
  } finally {
    c.release();
    await db.close();
  }
}
