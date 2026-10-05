// Repair one outlet's stored titles using its current crawl rule.
// Dry run: node --env-file=.env tools/repair-title-suffixes.ts --media worldjournal
// Add --apply to write. Other article fields remain unchanged.
import { parseArgs } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { stripTitleSuffix } from '../app/src/crawl/text.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles } from '../app/src/db/schema.ts';

const { values } = parseArgs({ options: { media: { type: 'string' }, apply: { type: 'boolean', default: false } } });
const source = values.media ? sourceByMedia(values.media) : undefined;
if (!source?.titleSuffix) throw new Error('--media must name a source with a titleSuffix rule');
const { db, close } = createDb();
try {
  const rows = await db.select({ id: articles.id, title: articles.title }).from(articles).where(eq(articles.media, source.media));
  let changed = 0;
  for (const row of rows) {
    const title = stripTitleSuffix(row.title, source.titleSuffix);
    if (!title || title === row.title) continue;
    if (values.apply) {
      const [result] = await db
        .update(articles)
        .set({ title })
        .where(and(eq(articles.id, row.id), eq(articles.media, source.media), eq(articles.title, row.title)));
      if (!result.affectedRows) continue;
    }
    changed++;
    console.log(JSON.stringify({ id: row.id, before: row.title, after: title }));
  }
  console.log(JSON.stringify({ applied: values.apply, media: source.media, changed }));
} finally {
  await close();
}
