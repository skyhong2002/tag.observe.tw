// One-off (idempotent): fill articles.url_key and merge rows that normalize
// to the same (media, url_key). The survivor is the fetched/tagged row, else
// the oldest; the others' tags move to it and they are deleted.
import { eq, inArray, isNull, sql } from 'drizzle-orm';
import { urlKey } from '../app/src/crawl/text.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles, articleTags } from '../app/src/db/schema.ts';

const { db, close } = createDb();
try {
  const rows = await db
    .select({
      id: articles.id,
      media: articles.media,
      url: articles.url,
      urlKey: articles.urlKey,
      fetchedAt: articles.fetchedAt,
      tags: articles.tags,
    })
    .from(articles);
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.media}\u0000${urlKey(r.url)}`;
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  }
  let merged = 0,
    filled = 0;
  for (const [k, g] of groups) {
    const key = k.split('\u0000')[1];
    g.sort((a, b) => Number(!!b.fetchedAt) - Number(!!a.fetchedAt) || b.tags.length - a.tags.length || a.id - b.id);
    const [keep, ...drop] = g;
    if (drop.length) {
      const ids = drop.map((d) => d.id);
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`INSERT IGNORE INTO article_tags (article_id, tag, published_at) SELECT ${keep.id}, tag, published_at FROM article_tags WHERE article_id IN (${sql.join(
            ids.map((i) => sql`${i}`),
            sql`, `,
          )})`,
        );
        await tx.delete(articleTags).where(inArray(articleTags.articleId, ids));
        await tx.delete(articles).where(inArray(articles.id, ids));
        if (!keep.tags.length) {
          const donor = drop.find((d) => d.tags.length);
          if (donor) await tx.update(articles).set({ tags: donor.tags }).where(eq(articles.id, keep.id));
        }
      });
      merged += drop.length;
    }
    if (keep.urlKey !== key) {
      await db.update(articles).set({ urlKey: key }).where(eq(articles.id, keep.id));
      filled++;
    }
  }
  const [left] = await db.select({ n: sql<number>`COUNT(*)` }).from(articles).where(isNull(articles.urlKey));
  console.log(JSON.stringify({ rows: rows.length, merged, filled, stillNull: Number(left.n) }));
} finally {
  await close();
}
