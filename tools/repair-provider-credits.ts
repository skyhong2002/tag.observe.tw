import { parseArgs } from 'node:util';
import { and, eq, sql } from 'drizzle-orm';
import { normalizeAuthorCredits } from '../app/src/crawl/byline.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles } from '../app/src/db/schema.ts';
import { normalizeAttributions } from '../app/src/similarity/attribution.ts';

// Dry-run by default; preserves body text and unrelated citations. Optimistic
// predicates avoid overwriting credits updated by the crawler during the scan.
const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });
const { db, close } = createDb();
let changed = 0;
try {
  const rows = await db
    .select({
      id: articles.id,
      media: articles.media,
      authors: articles.authors,
      creator: articles.creator,
      attributions: articles.attributions,
    })
    .from(articles)
    .where(sql`${articles.attributions} LIKE '%內容提供者%' OR ${articles.authors} LIKE '%記者%' OR ${articles.creator} LIKE '%記者%'`);
  for (const row of rows) {
    const authors = row.authors === null ? null : normalizeAuthorCredits(row.authors);
    const creator = row.creator ? normalizeAuthorCredits([row.creator])[0] : row.creator;
    const attributions = row.attributions === null ? null : normalizeAttributions(row.attributions, row.media);
    if (
      JSON.stringify(authors) === JSON.stringify(row.authors) &&
      creator === row.creator &&
      JSON.stringify(attributions) === JSON.stringify(row.attributions)
    )
      continue;
    if (values.apply) {
      const [result] = await db
        .update(articles)
        .set({ authors, creator, attributions })
        .where(
          and(
            eq(articles.id, row.id),
            sql`${articles.authors} <=> ${row.authors === null ? null : JSON.stringify(row.authors)}`,
            sql`${articles.creator} <=> ${row.creator}`,
            sql`${articles.attributions} <=> ${row.attributions === null ? null : JSON.stringify(row.attributions)}`,
          ),
        );
      if (!result.affectedRows) continue;
    }
    changed++;
    console.log(
      JSON.stringify({
        id: row.id,
        media: row.media,
        authors,
        removedCitations: (row.attributions?.length ?? 0) - (attributions?.length ?? 0),
      }),
    );
  }
  console.log(JSON.stringify({ applied: values.apply, changed }));
} finally {
  await close();
}
