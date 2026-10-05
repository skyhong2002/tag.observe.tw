// Recover existing membership URLs and enqueue missing articles through the normal index.
// Read-only by default; --apply persists. Does not fetch publisher pages.
import { and, eq, sql } from 'drizzle-orm';
import { createDb } from '../app/src/db/client.ts';
import { topics } from '../app/src/db/schema.ts';
import { indexTopicStories, resolveTopicStories } from '../app/src/jobs/topic-stories.ts';

const { db, close } = createDb();
const apply = process.argv.includes('--apply');
try {
  const rows = await db.select({ id: topics.id, media: topics.media, stories: topics.pageStories }).from(topics);
  const totals = { topics: 0, stories: 0, indexed: 0, missing: 0, unresolved: 0, inserted: 0 };
  for (const row of rows) {
    if (!row.stories?.length) continue;
    const resolved = await resolveTopicStories(db, row.media, row.stories);
    totals.topics++;
    totals.stories += resolved.length;
    totals.indexed += resolved.filter((s) => s.id).length;
    totals.missing += resolved.filter((s) => !s.id && s.url).length;
    totals.unresolved += resolved.filter((s) => !s.url).length;
    if (!apply) continue;
    const byKey = new Map(resolved.map((s) => [s.key, s]));
    const stories = row.stories.map((s) => ({ ...s, ...(byKey.get(s.key)?.url ? { url: byKey.get(s.key)!.url! } : {}) }));
    // The worker may refresh this row concurrently. Only update our original snapshot.
    const result = await db
      .update(topics)
      .set({ pageStories: stories })
      .where(
        and(
          eq(topics.id, row.id),
          sql`JSON_CONTAINS(${topics.pageStories}, ${JSON.stringify(row.stories)}) AND JSON_CONTAINS(${JSON.stringify(row.stories)}, ${topics.pageStories})`,
        ),
      );
    if (!(result as unknown as [{ affectedRows: number }])[0].affectedRows) continue;
    totals.inserted += await indexTopicStories(db, row.media, stories);
  }
  console.log(JSON.stringify({ apply, ...totals }));
} finally {
  await close();
}
