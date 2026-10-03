import { and, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import type { Db } from '../db/client.ts';
import { articles, articleTags } from '../db/schema.ts';
import { isTagNoise } from '../tag-noise.ts';

export interface RelatedTag {
  tag: string;
  /** Articles in the window carrying both tags. */
  count: number;
  /** Share of the ranked tag's articles that also carry this tag (0–1). */
  share: number;
}

/**
 * Tags that appear on the same articles as each ranked tag, within the
 * ranking window and the category's media. Lets readers see which entries
 * belong to the same story without opening each tag.
 */
export async function loadRelatedTags(
  db: Db,
  tags: string[],
  media: string[],
  from: Date,
  to: Date,
  perTag = 5,
): Promise<Map<string, RelatedTag[]>> {
  const out = new Map<string, RelatedTag[]>(tags.map((tag) => [tag, []]));
  if (!tags.length || !media.length) return out;
  const other = alias(articleTags, 'other');
  const exactTag = sql<string>`${articleTags.tag} COLLATE utf8mb4_bin`;
  const exactOther = sql<string>`${other.tag} COLLATE utf8mb4_bin`;
  const rows = await db
    .select({ tag: exactTag, other: exactOther, count: sql<number>`COUNT(DISTINCT ${articleTags.articleId})` })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .innerJoin(other, and(eq(other.articleId, articleTags.articleId), ne(other.tag, articleTags.tag)))
    .where(
      and(
        inArray(articleTags.tag, tags),
        inArray(articles.media, media),
        gte(articleTags.publishedAt, from),
        lt(articleTags.publishedAt, to),
      ),
    )
    .groupBy(exactTag, exactOther);
  const totals = await db
    .select({ tag: exactTag, count: sql<number>`COUNT(DISTINCT ${articleTags.articleId})` })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(
      and(
        inArray(articleTags.tag, tags),
        inArray(articles.media, media),
        gte(articleTags.publishedAt, from),
        lt(articleTags.publishedAt, to),
      ),
    )
    .groupBy(exactTag);
  const total = new Map(totals.map((r) => [r.tag, Number(r.count)]));
  const pairs = new Map<string, RelatedTag[]>();
  for (const r of rows) {
    if (!out.has(r.tag) || isTagNoise(r.other) || r.other.toLowerCase() === r.tag.toLowerCase()) continue;
    const count = Number(r.count);
    const list = pairs.get(r.tag) ?? [];
    list.push({ tag: r.other, count, share: Math.min(1, count / Math.max(1, total.get(r.tag) ?? count)) });
    pairs.set(r.tag, list);
  }
  for (const [tag, list] of pairs) {
    list.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hant-TW'));
    out.set(tag, list.slice(0, perTag));
  }
  return out;
}
