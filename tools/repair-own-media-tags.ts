// Dry run by default. Example: node --env-file=.env tools/repair-own-media-tags.ts --media worldjournal --apply
import { parseArgs } from 'node:util';
import { and, eq, gt } from 'drizzle-orm';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles, articleTags } from '../app/src/db/schema.ts';
import { isOwnMediaTag } from '../app/src/media-tags.ts';

const { values } = parseArgs({
  options: { media: { type: 'string' }, all: { type: 'boolean', default: false }, apply: { type: 'boolean', default: false } },
});
const source = values.media ? sourceByMedia(values.media) : undefined;
if ((!source && !values.all) || (values.media && values.all)) throw new Error('Choose --all or --media with a known source');
const { db, close } = createDb();
try {
  let changed = 0;
  let cursor = 0;
  const byMedia: Record<string, number> = {};
  for (;;) {
    const rows = await db
      .select({ id: articles.id, media: articles.media, tags: articles.tags })
      .from(articles)
      .where(and(gt(articles.id, cursor), source ? eq(articles.media, source.media) : undefined))
      .orderBy(articles.id)
      .limit(1000);
    if (!rows.length) break;
    cursor = rows.at(-1)!.id;
    for (const row of rows) {
      const removed = row.tags.filter((tag) => isOwnMediaTag(tag, row.media));
      if (!removed.length) continue;
      const tags = row.tags.filter((tag) => !isOwnMediaTag(tag, row.media));
      if (values.apply) {
        const updated = await db.transaction(async (tx) => {
          const [result] = await tx
            .update(articles)
            .set({ tags })
            .where(and(eq(articles.id, row.id), eq(articles.tags, row.tags)));
          if (!result.affectedRows) return false;
          for (const tag of removed)
            await tx.delete(articleTags).where(and(eq(articleTags.articleId, row.id), eq(articleTags.tag, tag.trim())));
          return true;
        });
        if (!updated) continue;
      }
      changed++;
      byMedia[row.media] = (byMedia[row.media] ?? 0) + 1;
      console.log(JSON.stringify({ id: row.id, media: row.media, removed }));
    }
  }
  console.log(JSON.stringify({ applied: values.apply, media: source?.media ?? 'all', changed, byMedia }));
} finally {
  await close();
}
