// One-off 2026-10-06 (docs/media-inclusion-research-2026-10-06.md): delete
// rows that duplicate another stored row of the same story.
// - cn_nytimes: the simplified edition of a story whose /zh-hant/ twin is stored.
// - xinhuanet: a news.cn document that xinhua also stored under the same URL.
// Rows without a twin stay. Dry run unless --apply.
import { inArray, or, sql } from 'drizzle-orm';
import { createDb } from '../app/src/db/client.ts';
import { articleArchives, articleOrigins, articleSketches, articles, articleTags, similarityPairs } from '../app/src/db/schema.ts';

const apply = process.argv.includes('--apply');
const { db, close } = createDb();
const rows = async (query: ReturnType<typeof sql>) =>
  ((await db.execute(query)) as unknown as [Array<{ id: number; twin: number; url: string }>])[0];
try {
  const nyt = await rows(sql`
    SELECT s.id, t.id AS twin, s.url FROM articles s
    JOIN articles t ON t.media = 'cn_nytimes' AND t.url = CONCAT(s.url, 'zh-hant/')
    WHERE s.media = 'cn_nytimes' AND s.url NOT LIKE '%/zh-hant/%'`);
  const xinhua = await rows(sql`
    SELECT n.id, x.id AS twin, n.url FROM articles n
    JOIN articles x ON x.media = 'xinhua' AND x.url = n.url
    WHERE n.media = 'xinhuanet'`);
  const ids = [...nyt, ...xinhua].map((r) => Number(r.id));
  console.log(JSON.stringify({ apply, cn_nytimes: nyt, xinhuanet: xinhua.length, total: ids.length }, null, 1));
  if (!apply || !ids.length) process.exit(0);
  await db.transaction(async (tx) => {
    // Archived or imported rows carry provenance; never drop them here.
    const kept = await tx
      .select({ id: articleArchives.articleId })
      .from(articleArchives)
      .where(inArray(articleArchives.articleId, ids))
      .union(tx.select({ id: articleOrigins.articleId }).from(articleOrigins).where(inArray(articleOrigins.articleId, ids)));
    if (kept.length) throw Error(`rows with archives or origins: ${kept.map((r) => r.id).join(',')}`);
    await tx.delete(articleTags).where(inArray(articleTags.articleId, ids));
    await tx.delete(articleSketches).where(inArray(articleSketches.articleId, ids));
    await tx.delete(similarityPairs).where(or(inArray(similarityPairs.aId, ids), inArray(similarityPairs.bId, ids)));
    await tx.delete(articles).where(inArray(articles.id, ids));
  });
  console.log('applied');
} finally {
  await close();
}
