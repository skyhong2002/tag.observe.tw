// One-off (idempotent) cleanup for the 2026-09-29 crawl data-quality fixes.
// Dry run by default; pass --apply to write.
//   1. cti: duplicate of ctitv (same site, full sitemap); drop its rows.
//   2. Rows a source's `include` rule now rejects (channel, author, account
//      pages; foodnext homepage columns).
//   3. Rows that share an `articleId` (taisounds category variants,
//      theinitium -zh-hans copies): keep the oldest id, drop the rest.
//   4. Strip `titleSuffix` from stored titles.
//   5. Re-queue recent rows whose publish time is still the crawl time, or
//      whose fetch failed, so the fixed extractor and 429 handling rerun.
import { inArray, sql } from 'drizzle-orm';
import { allSources } from '../app/src/crawl/registry.ts';
import { stripTitleSuffix, urlKey } from '../app/src/crawl/text.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles, articleTags } from '../app/src/db/schema.ts';

const apply = process.argv.includes('--apply');
const { db, close } = createDb();
const drop = new Set<number>();
const report: Record<string, number> = {};
const count = (k: string, n = 1) => {
  report[k] = (report[k] ?? 0) + n;
};
try {
  const cti = await db.select({ id: articles.id }).from(articles).where(sql`${articles.media} = 'cti'`);
  for (const r of cti) drop.add(r.id);
  count('cti rows', cti.length);

  const titleFixes: Array<{ id: number; title: string }> = [];
  const keyFixes: Array<{ id: number; urlKey: string }> = [];
  for (const spec of allSources()) {
    const include = spec.list.include ?? (spec.media === 'foodnext' ? spec.list.discover?.pattern : undefined);
    if (!include && !spec.list.articleId && !spec.titleSuffix) continue;
    const rows = await db
      .select({ id: articles.id, url: articles.url, title: articles.title, urlKey: articles.urlKey })
      .from(articles)
      .where(sql`${articles.media} = ${spec.media} AND ${articles.source} = 'own'`)
      .orderBy(articles.id);
    const firstByKey = new Map<string, number>();
    for (const r of rows) {
      let path = '';
      try {
        const u = new URL(r.url);
        path = u.pathname + u.search;
      } catch {}
      if (include && !new RegExp(include).test(path)) {
        drop.add(r.id);
        count(`${spec.media}: not an article`);
        continue;
      }
      if (spec.list.articleId) {
        const key = urlKey(r.url, spec.list.articleId);
        if (firstByKey.has(key)) {
          drop.add(r.id);
          count(`${spec.media}: duplicate`);
          continue;
        }
        firstByKey.set(key, r.id);
        if (key !== r.urlKey) keyFixes.push({ id: r.id, urlKey: key });
      }
      const title = stripTitleSuffix(r.title, spec.titleSuffix);
      if (title !== r.title) {
        titleFixes.push({ id: r.id, title });
        count(`${spec.media}: title suffix`);
      }
    }
  }

  // Only rows runArticles will pick up again: sources with a tag stage, untagged or undated rows.
  const enabled = new Set(
    allSources()
      .filter((s) => s.article.enabled)
      .map((s) => s.media),
  );
  const candidates = (await db.execute(sql`
    SELECT id, media, JSON_LENGTH(tags) AS tagCount, published_at = crawled_at AS undated FROM articles
    WHERE source = 'own' AND media <> 'cti' AND published_at >= UTC_TIMESTAMP() - INTERVAL 72 HOUR AND fetched_at IS NOT NULL
      AND (published_at = crawled_at OR fetch_status IN ('error', 'failed') OR title = '')`)) as unknown as [
    Array<{ id: number; media: string; tagCount: number; undated: number }>,
  ];
  const requeue = candidates[0]
    .filter((r) => !drop.has(r.id) && (enabled.has(r.media) || Number(r.tagCount) === 0 || r.undated))
    .map((r) => r.id);
  for (const id of requeue) count(`re-queue: ${candidates[0].find((r) => r.id === id)?.media}`);
  console.log(JSON.stringify({ apply, dropTotal: drop.size, ...report }, null, 1));
  if (!apply) process.exit(0);

  const ids = [...drop];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    await db.delete(articleTags).where(inArray(articleTags.articleId, chunk));
    await db.delete(articles).where(inArray(articles.id, chunk));
  }
  // Survivors' keys change only after their duplicates are gone (unique (media, url_key)).
  for (const k of keyFixes) if (!drop.has(k.id)) await db.update(articles).set({ urlKey: k.urlKey }).where(sql`${articles.id} = ${k.id}`);
  for (const t of titleFixes) if (!drop.has(t.id)) await db.update(articles).set({ title: t.title }).where(sql`${articles.id} = ${t.id}`);
  for (let i = 0; i < requeue.length; i += 500)
    await db
      .update(articles)
      .set({ fetchedAt: null, fetchStatus: null })
      .where(inArray(articles.id, requeue.slice(i, i + 500)));
  console.log('applied');
} finally {
  await close();
}
