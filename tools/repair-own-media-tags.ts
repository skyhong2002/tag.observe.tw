// Dry run by default. Example: node --env-file=.env tools/repair-own-media-tags.ts --media worldjournal --apply
import { parseArgs } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles, articleTags } from '../app/src/db/schema.ts';
import { isOwnMediaTag } from '../app/src/media-tags.ts';

const { values } = parseArgs({ options: { media: { type: 'string' }, apply: { type: 'boolean', default: false } } });
const source = values.media ? sourceByMedia(values.media) : undefined;
if (!source) throw new Error('--media must name a known source');
const { db, close } = createDb();
try {
  const rows = await db.select({ id: articles.id, tags: articles.tags }).from(articles).where(eq(articles.media, source.media));
  let changed = 0;
  for (const row of rows) {
    const removed = row.tags.filter((tag) => isOwnMediaTag(tag, source.media));
    if (!removed.length) continue;
    const tags = row.tags.filter((tag) => !isOwnMediaTag(tag, source.media));
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
    console.log(JSON.stringify({ id: row.id, removed }));
  }
  console.log(JSON.stringify({ applied: values.apply, media: source.media, changed }));
} finally {
  await close();
}
