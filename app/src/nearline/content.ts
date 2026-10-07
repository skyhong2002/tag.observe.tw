import { gunzipSync, gzipSync } from 'node:zlib';
import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { BODY_RETENTION_MS, PUBLIC_BODY_WINDOW_MS } from '../article-retention.ts';
import type { Db } from '../db/client.ts';
import { articleArchives, articles } from '../db/schema.ts';
import { type ArchiveStore, digest } from './store.ts';

export type ContentRow = typeof articles.$inferSelect;
type StoredRow = Record<string, unknown> & {
  id: number;
  media: string;
  url: string;
  body: string | null;
  description: string | null;
  summary?: string | null;
  summarySource?: string | null;
};
export const cacheClock = () =>
  sql`GREATEST(COALESCE(${articles.contentAccessedAt}, ${articles.crawledAt}), COALESCE(${articles.contentFetchedAt}, ${articles.crawledAt}))`;

export function encodeContent(rows: ContentRow[]) {
  const entries = rows.map((row) => {
    const article = JSON.parse(JSON.stringify(row)) as StoredRow;
    const contentHash = digest(JSON.stringify(article));
    return { contentHash, article };
  });
  const raw = Buffer.from(JSON.stringify({ format: 'tag-content-v1', entries }));
  if (raw.length > 32 * 2 ** 20) throw new Error('Archive package exceeds 32 MiB; reduce retention batch');
  return { entries, data: gzipSync(raw) };
}

export function decodeContent(data: Buffer, id: number, contentHash: string): StoredRow {
  const pack = JSON.parse(gunzipSync(data, { maxOutputLength: 32 * 2 ** 20 }).toString('utf8'));
  if (pack.format !== 'tag-content-v1' || !Array.isArray(pack.entries)) throw new Error('Unsupported archive format');
  const entry = pack.entries.find(
    (entry: { article: StoredRow; contentHash: string }) => entry.article.id === id && entry.contentHash === contentHash,
  );
  if (!entry || digest(JSON.stringify(entry.article)) !== contentHash) throw new Error('Archive article identity/checksum mismatch');
  for (const field of ['body', 'description']) {
    if (entry.article[field] !== null && typeof entry.article[field] !== 'string') throw new Error('Invalid archived content');
  }
  // Older v1 archives predate independent summaries. Verify the original hash
  // before supplying backward-compatible missing values.
  for (const field of ['summary', 'summarySource']) {
    if (entry.article[field] !== undefined && entry.article[field] !== null && typeof entry.article[field] !== 'string')
      throw new Error('Invalid archived summary');
  }
  return { ...entry.article, summary: entry.article.summary ?? null, summarySource: entry.article.summarySource ?? null };
}

export function cacheAgeForSpace(freeBytes: number | undefined, reserveBytes = 20 * 2 ** 30) {
  return freeBytes !== undefined && freeBytes < reserveBytes ? PUBLIC_BODY_WINDOW_MS : BODY_RETENTION_MS;
}

export async function archiveColdContent(db: Db, store: ArchiveStore | undefined, now: Date, batch = 25, maxAgeMs = BODY_RETENTION_MS) {
  if (!store) return { archived: 0, evicted: 0, archiveDisabled: 1 };
  const cutoff = new Date(now.getTime() - Math.max(PUBLIC_BODY_WINDOW_MS, maxAgeMs));
  const rows = await db
    .select()
    .from(articles)
    .where(
      and(
        lt(cacheClock(), cutoff),
        lt(articles.publishedAt, new Date(now.getTime() - PUBLIC_BODY_WINDOW_MS)),
        or(sql`${articles.body} IS NOT NULL`, sql`${articles.description} IS NOT NULL`, sql`${articles.summary} IS NOT NULL`),
      ),
    )
    .orderBy(asc(articles.id))
    .limit(batch);
  if (!rows.length) return { archived: 0, evicted: 0, archiveDisabled: 0 };
  const pack = encodeContent(rows);
  const receipt = await store.putVerified(pack.data);
  const verifiedAt = new Date();
  // Persist the retrieval index BEFORE any cache is removed. Database failure leaves content intact.
  await db
    .insert(articleArchives)
    .values(
      pack.entries.map((entry) => ({
        articleId: entry.article.id,
        contentHash: entry.contentHash,
        objectKey: receipt.key,
        objectHash: receipt.hash,
        archiveRemote: store.remote,
        archivedAt: now,
        verifiedAt,
      })),
    )
    .onDuplicateKeyUpdate({ set: { verifiedAt, objectKey: receipt.key, objectHash: receipt.hash, archiveRemote: store.remote } });
  let evicted = 0;
  for (const row of rows) {
    const contentHash = pack.entries.find((entry) => entry.article.id === row.id)!.contentHash;
    const result = await db
      .update(articles)
      .set({
        body: null,
        description: null,
        summary: null,
        summarySource: null,
        contentArchiveHash: contentHash,
        ...(row.body !== null ? { bodyStatus: 'expired' } : {}),
      })
      .where(
        and(
          eq(articles.id, row.id),
          lt(cacheClock(), cutoff),
          lt(articles.publishedAt, new Date(now.getTime() - PUBLIC_BODY_WINDOW_MS)),
          sql`BINARY ${articles.body} <=> BINARY ${row.body}`,
          sql`BINARY ${articles.description} <=> BINARY ${row.description}`,
          sql`BINARY ${articles.summary} <=> BINARY ${row.summary}`,
          sql`BINARY ${articles.summarySource} <=> BINARY ${row.summarySource}`,
          sql`${articles.contentFetchedAt} <=> ${row.contentFetchedAt}`,
          sql`${articles.contentAccessedAt} <=> ${row.contentAccessedAt}`,
        ),
      );
    evicted += (result as unknown as [{ affectedRows: number }])[0].affectedRows;
  }
  return { archived: rows.length, evicted, archiveDisabled: 0 };
}

/** Internal/admin use only. Does not extend the public seven-day body window. */
export async function restoreArticleContent(db: Db, store: ArchiveStore, id: number, now = new Date()) {
  const [cached] = await db.select({ hash: articles.contentArchiveHash }).from(articles).where(eq(articles.id, id)).limit(1);
  if (!cached?.hash) throw new Error('No evicted archive pointer for this article');
  const [index] = await db
    .select()
    .from(articleArchives)
    .where(and(eq(articleArchives.articleId, id), eq(articleArchives.contentHash, cached.hash)))
    .limit(1);
  if (!index) throw new Error('No verified archive for this article');
  if (index.archiveRemote !== store.remote) throw new Error('Configured remote differs from this archived version');
  const archived = decodeContent(await store.getVerified(index.objectKey, index.objectHash), id, index.contentHash);
  const result = await db
    .update(articles)
    .set({
      body: archived.body,
      description: archived.description,
      summary: archived.summary ?? null,
      summarySource: archived.summarySource ?? null,
      bodyStatus: archived.bodyStatus as string | null,
      bodySource: archived.bodySource as string | null,
      contentAccessedAt: now,
    })
    .where(
      and(
        eq(articles.id, id),
        sql`BINARY ${articles.media} <=> BINARY ${archived.media}`,
        sql`BINARY ${articles.url} <=> BINARY ${archived.url}`,
        eq(articles.contentArchiveHash, cached.hash),
        isNull(articles.body),
        isNull(articles.description),
        isNull(articles.summary),
        sql`${articles.contentFetchedAt} <=> ${archived.contentFetchedAt ? new Date(String(archived.contentFetchedAt)) : null}`,
      ),
    );
  if (!(result as unknown as [{ affectedRows: number }])[0].affectedRows)
    throw new Error('Restore conflict: article changed, missing, or cache already populated');
  return { id, contentHash: index.contentHash, restoredAt: now };
}

/** A daily-resolution touch bounds write volume while protecting actively used caches. */
export async function touchArticleContent(db: Db, id: number, now = new Date()) {
  await db
    .update(articles)
    .set({ contentAccessedAt: now })
    .where(
      and(
        eq(articles.id, id),
        or(sql`${articles.body} IS NOT NULL`, sql`${articles.description} IS NOT NULL`, sql`${articles.summary} IS NOT NULL`),
        or(isNull(articles.contentAccessedAt), lt(articles.contentAccessedAt, new Date(now.getTime() - 86400_000))),
      ),
    );
}
