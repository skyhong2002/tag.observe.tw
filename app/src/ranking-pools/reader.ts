import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type { Db } from '../db/client.ts';
import type { RankingBasis } from '../jobs/ranking-basis.ts';
import { collectPool, LIMITS, PoolUnavailable, type SourceRow, type WindowQuery } from './core.ts';

export const POOL_PAGE_SQL = `SET STATEMENT max_statement_time=2 FOR SELECT id, media, published_at AS publishedAt, tags FROM articles FORCE INDEX (articles_source_media_published) WHERE source='own' AND media=? AND published_at >= ? AND published_at < ? AND JSON_LENGTH(tags)>0 AND (published_at > ? OR (published_at = ? AND id > ?)) ORDER BY published_at,id LIMIT 2000`;
// Explicit syntax: Drizzle0.45 joins WITH CONSISTENT SNAPSHOT and READ ONLY
// without the required comma. Do not patch dependencies or drop READ ONLY.
export async function readPool(db: Db, query: WindowQuery, basis: RankingBasis, budgetMs = LIMITS.runtimeMs) {
  const started = performance.now(),
    deadline = started + budgetMs;
  let connection: PoolConnection | undefined,
    destroyed = false;
  const bounded = async <T>(operation: () => Promise<T>, capMs = budgetMs): Promise<T> => {
    const remaining = Math.min(capMs, deadline - performance.now());
    if (remaining <= 0) throw new PoolUnavailable('compute-deadline');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new PoolUnavailable('compute-deadline')), remaining);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  let acquiring = true;
  try {
    connection = await bounded(
      () =>
        (db as Db & { $client: Pool }).$client.getConnection().then((c) => {
          if (!acquiring) c.release();
          return c;
        }),
      2500,
    );
    acquiring = false;
    const sql = (text: string, values: unknown[] = []) =>
      bounded(
        () =>
          connection!.query({
            sql: text,
            values,
            timeout: Math.max(1, Math.min(2500, deadline - performance.now())),
          }),
        2500,
      );
    await sql('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await sql('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const [clock] = await sql('SELECT UTC_TIMESTAMP(3) AS snapshotTime');
    const asOf = new Date((clock as { snapshotTime: Date }[])[0].snapshotTime).toISOString();
    async function* rows() {
      for (const media of basis.media) {
        let publishedAt = query.since,
          id = 0;
        for (;;) {
          if (performance.now() >= deadline) throw new PoolUnavailable('compute-deadline');
          const [result] = await sql(POOL_PAGE_SQL, [
            media,
            new Date(query.since),
            new Date(query.until),
            new Date(publishedAt),
            new Date(publishedAt),
            id,
          ]);
          const page = result as unknown as { id: number; media: string; publishedAt: Date; tags: string[] | string }[];
          for (const row of page) {
            const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
            yield { id: Number(row.id), media: row.media, publishedAt: new Date(row.publishedAt), tags } as SourceRow;
          }
          if (page.length < 2000) break;
          const tail = page.at(-1)!;
          publishedAt = new Date(tail.publishedAt).toISOString();
          id = Number(tail.id);
          await sleep(20);
        }
      }
    }
    const result = { ...(await collectPool(rows(), query, basis)), asOf };
    await sql('COMMIT');
    return result;
  } catch (e) {
    acquiring = false;
    // Destroy only this failed read-only transaction: rollback cannot hold the producer indefinitely.
    if (connection) {
      connection.destroy();
      destroyed = true;
    }
    if (e instanceof PoolUnavailable) throw e;
    throw new PoolUnavailable('source-query-failed', { cause: e });
  } finally {
    if (connection && !destroyed) connection.release();
  }
}
