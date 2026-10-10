import { parseArgs } from 'node:util';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { createDb } from '../app/src/db/client.ts';
import { articleCitations, articles } from '../app/src/db/schema.ts';
import { extractAttributions, normalizeAttributions } from '../app/src/similarity/attribution.ts';

// Drops stored citations that only matched inside a foreign namesake
// (香港經濟日報, 明鏡週刊, 每日鏡報, 好萊塢報導者). Each citation is re-checked
// against its own stored evidence; provider credits are left alone.
// The similarity index copies citations into article_citations only once, so
// rows whose article no longer cites the source are deleted there too.
// Dry-run by default; the optimistic predicate skips rows the crawler changed.
const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });
const affected = ['udnmoney', 'mirror', 'mirrordaily', 'reporter'];
const { db, close } = createDb();
let changed = 0;
try {
  const rows = await db
    .select({ id: articles.id, media: articles.media, attributions: articles.attributions })
    .from(articles)
    .where(sql`JSON_OVERLAPS(JSON_EXTRACT(${articles.attributions}, '$[*].media'), ${JSON.stringify(affected)})`);
  for (const row of rows) {
    if (!row.attributions) continue;
    const kept = row.attributions.filter(
      (a) =>
        !affected.includes(a.media) ||
        a.evidence.startsWith('內容提供者') ||
        extractAttributions(a.evidence, row.media).some((b) => b.media === a.media),
    );
    if (kept.length === row.attributions.length) continue;
    if (values.apply) {
      const [result] = await db
        .update(articles)
        .set({ attributions: kept })
        .where(and(eq(articles.id, row.id), sql`${articles.attributions} <=> ${JSON.stringify(row.attributions)}`));
      if (!result.affectedRows) continue;
    }
    changed++;
    const removed = row.attributions.filter((a) => !kept.includes(a));
    console.log(JSON.stringify({ id: row.id, media: row.media, removed: removed.map((a) => `${a.media}: ${a.evidence.slice(0, 40)}`) }));
  }
  const citations = await db
    .select({
      articleId: articleCitations.articleId,
      source: articleCitations.source,
      attributions: articles.attributions,
      media: articles.media,
    })
    .from(articleCitations)
    .innerJoin(articles, eq(articles.id, articleCitations.articleId))
    .where(inArray(articleCitations.source, affected));
  let stale = 0;
  for (const row of citations) {
    if (normalizeAttributions(row.attributions ?? [], row.media).some((a) => a.media === row.source)) continue;
    if (values.apply)
      await db.delete(articleCitations).where(and(eq(articleCitations.articleId, row.articleId), eq(articleCitations.source, row.source)));
    stale++;
    console.log(JSON.stringify({ staleCitation: row.articleId, media: row.media, source: row.source }));
  }
  console.log(JSON.stringify({ applied: values.apply, changed, stale }));
} finally {
  await close();
}
