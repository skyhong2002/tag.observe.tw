import { and, gte, lt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';
import { isTagNoise } from '../tag-noise.ts';

// Type-ahead for keyword boxes. The vocabulary is every tag on at least two
// articles in the last 14 days (about 50,000), counted from articles.tags by
// the published_at index (a few seconds) and refreshed every half hour, so
// each keystroke is an in-memory match rather than a LIKE '%…%' scan.

export type TagCount = { tag: string; articles: number };

const DAYS = 14;
const MAX_LENGTH = 16;

export function countTags(rows: Array<{ tags: string[] | null }>): TagCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) for (const tag of new Set(row.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .filter(([tag, count]) => count >= 2 && tag.length <= MAX_LENGTH && !isTagNoise(tag))
    .map(([tag, count]) => ({ tag, articles: count }));
}

/** Prefix matches first, then the most-tagged keyword, then the shorter one. */
export function rankTagSuggestions(rows: TagCount[], q: string, limit: number) {
  const needle = q.normalize('NFKC').trim().toLowerCase();
  if (!needle) return [];
  return rows
    .map((row) => ({ row, at: row.tag.normalize('NFKC').toLowerCase().indexOf(needle) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => Number(b.at === 0) - Number(a.at === 0) || b.row.articles - a.row.articles || a.row.tag.length - b.row.tag.length)
    .slice(0, limit)
    .map(({ row }) => row);
}

export function registerTagSuggest(app: FastifyInstance, db: Db) {
  // Serve the previous vocabulary while the next one loads; only the first request waits.
  let ready: TagCount[] | null = null;
  let loading: Promise<TagCount[]> | null = null;
  let loadedAt = 0;
  const load = () => {
    if (!loading && Date.now() - loadedAt > 1800000) {
      const now = new Date();
      loading = db
        .select({ tags: articles.tags })
        .from(articles)
        .where(and(gte(articles.publishedAt, new Date(now.getTime() - DAYS * 86400000)), lt(articles.publishedAt, now)))
        .then(countTags)
        .then((rows) => {
          ready = rows;
          loadedAt = Date.now();
          return rows;
        })
        .finally(() => {
          loading = null;
        });
      if (ready) loading.catch(() => {});
    }
    return ready ?? (loading as Promise<TagCount[]>);
  };
  // Build the list when the server starts listening (not under inject), so the
  // first reader after a deploy does not wait for it.
  app.addHook('onListen', async () => {
    Promise.resolve(load()).catch(() => {});
  });
  app.get<{ Querystring: { q?: string; limit?: string } }>('/api/v1/tags/suggest', async (request, reply) => {
    const q = (request.query.q ?? '').trim().slice(0, 60);
    const limit = Math.min(20, Math.max(1, Math.floor(Number(request.query.limit) || 8)));
    reply.header('cache-control', 'public, max-age=300');
    return { q, days: DAYS, tags: q ? rankTagSuggestions(await load(), q, limit) : [] };
  });
}
