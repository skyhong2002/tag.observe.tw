import { and, eq, gte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { eventThreads } from '../db/schema.ts';

// Type-ahead for event threads, which have no title of their own: match the
// typed text against each recent thread's keywords. The last 14 days hold
// about 1,500 news threads, so they stay in memory for ten minutes.

export type ThreadRow = { id: number; majorTags: string[]; allTags: string[]; maxScore: number; lastTime: Date };

const DAYS = 14;

/** A hit in the main keywords beats one in the long tail; then the newer thread (a follow is for what comes next), then the bigger one. */
export function rankThreadSuggestions(rows: ThreadRow[], q: string, limit: number) {
  const needle = q.normalize('NFKC').trim().toLowerCase();
  if (!needle) return [];
  const hit = (tags: string[]) => tags.some((tag) => tag.normalize('NFKC').toLowerCase().includes(needle));
  return rows
    .map((row) => ({ row, rank: hit(row.majorTags) ? 2 : hit(row.allTags) ? 1 : 0 }))
    .filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank || b.row.lastTime.getTime() - a.row.lastTime.getTime() || b.row.maxScore - a.row.maxScore)
    .slice(0, limit)
    .map(({ row }) => ({ id: row.id, tags: row.majorTags, lastTime: row.lastTime.toISOString() }));
}

export function registerEventSuggest(app: FastifyInstance, db: Db) {
  let cache: { at: number; rows: Promise<ThreadRow[]> } | null = null;
  const load = () => {
    if (!cache || Date.now() - cache.at > 600000) {
      const rows = db
        .select({
          id: eventThreads.id,
          majorTags: eventThreads.majorTags,
          allTags: eventThreads.allTags,
          maxScore: eventThreads.maxScore,
          lastTime: eventThreads.lastTime,
        })
        .from(eventThreads)
        .where(and(eq(eventThreads.category, 'news'), gte(eventThreads.lastTime, new Date(Date.now() - DAYS * 86400000))));
      const entry = { at: Date.now(), rows };
      cache = entry;
      rows.catch(() => {
        if (cache === entry) cache = null;
      });
    }
    return cache.rows;
  };
  // Build the list when the server starts listening (not under inject), so the
  // first reader after a deploy does not wait for it.
  app.addHook('onListen', async () => {
    Promise.resolve(load()).catch(() => {});
  });
  app.get<{ Querystring: { q?: string; limit?: string } }>('/api/v1/events/threads/suggest', async (request, reply) => {
    const q = (request.query.q ?? '').trim().slice(0, 60);
    const limit = Math.min(20, Math.max(1, Math.floor(Number(request.query.limit) || 8)));
    reply.header('cache-control', 'public, max-age=300');
    return { q, days: DAYS, threads: q ? rankThreadSuggestions(await load(), q, limit) : [] };
  });
}
