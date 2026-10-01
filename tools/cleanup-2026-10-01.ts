// One-off (idempotent) cleanup for the 2026-10-01 crawler audit. Dry run by
// default; pass --apply to write. Run tools/cleanup-crawl-quality.ts as well
// for the new articleId rules (ltn, tvbs, ctee, udnmoney).
//   1. overdope: the domain now serves slot-gambling spam; drop every row.
//   2. top1health: its feed dates were unreadable (lowercase, zone-less
//      <pubdate>), so rows carry the crawl time; take the dates from the feed.
//   3. gamer, reporter: page tags are readable now (GNN #hashtags, twreporter
//      page state). Re-fetch recent rows tagged from titles or left untagged.
import { inArray, sql } from 'drizzle-orm';
import { parseFeed } from '../app/src/crawl/feed.ts';
import { fetchText } from '../app/src/crawl/fetch.ts';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles, articleTags } from '../app/src/db/schema.ts';

const apply = process.argv.includes('--apply');
const { db, close } = createDb();
const ids = <T extends { id: number }>(rows: T[]) => rows.map((r) => r.id);
try {
  const spam = ids(await db.select({ id: articles.id }).from(articles).where(sql`${articles.media} = 'overdope'`));

  const t1 = sourceByMedia('top1health');
  const feed = t1 ? parseFeed((await fetchText(t1.list.urls[0].url, { timeout: 30000 })).body).items : [];
  const dated = new Map(feed.filter((i) => i.publishedAt).map((i) => [i.url, i.publishedAt as Date]));
  const undated = await db
    .select({ id: articles.id, url: articles.url })
    .from(articles)
    .where(sql`${articles.media} = 'top1health' AND ${articles.publishedAt} = ${articles.crawledAt}`);
  const redate = undated.filter((r) => dated.has(r.url));

  const retag = ids(
    await db
      .select({ id: articles.id })
      .from(articles)
      .where(
        sql`${articles.media} IN ('gamer', 'reporter') AND ${articles.publishedAt} >= UTC_TIMESTAMP() - INTERVAL 72 HOUR
          AND ${articles.fetchStatus} IN ('title', 'title-none', 'notags')`,
      ),
  );
  console.log(JSON.stringify({ apply, overdopeRows: spam.length, top1healthRedate: redate.length, gamerReporterRetag: retag.length }));
  if (!apply) process.exit(0);

  for (let i = 0; i < spam.length; i += 500) {
    const chunk = spam.slice(i, i + 500);
    await db.delete(articleTags).where(inArray(articleTags.articleId, chunk));
    await db.delete(articles).where(inArray(articles.id, chunk));
  }
  for (const r of redate) {
    const publishedAt = dated.get(r.url) as Date;
    await db.update(articles).set({ publishedAt }).where(sql`${articles.id} = ${r.id}`);
    await db.update(articleTags).set({ publishedAt }).where(sql`${articleTags.articleId} = ${r.id}`);
  }
  if (retag.length) {
    await db.delete(articleTags).where(inArray(articleTags.articleId, retag));
    await db.update(articles).set({ tags: [], fetchedAt: null, fetchStatus: null }).where(inArray(articles.id, retag));
  }
  console.log('applied');
} finally {
  await close();
}
