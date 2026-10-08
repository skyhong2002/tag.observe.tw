import { and, desc, eq, gte, lt } from 'drizzle-orm';
import noEqual from '../../data/no-equal-tags.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags } from '../db/schema.ts';
import { isOwnMediaTag } from '../media-tags.ts';
import { isTagNoise } from '../tag-noise.ts';

// One keyword's company over time: for each hour, the other tags on the
// reports tagged with it, so the tag page can show which keywords joined the
// story when (the same left-to-right flow as an event page).

const HOUR = 3600e3;
const excluded = new Set([...noEqual.tags, '國際', '生活', '政治', '財經', '兩岸', '社會', '地方', '體育', '娛樂', '科技', '新聞']);
/** Reports read for one window; a keyword that busy is sampled, newest first. */
export const TAG_FLOW_ROWS = 20000;

const usable = (term: string, media: string) =>
  term.length >= 2 &&
  term.length <= 30 &&
  !excluded.has(term) &&
  !isTagNoise(term) &&
  !isOwnMediaTag(term, media) &&
  !/^\d+(?:年|月|日)?$/.test(term);

/** Per hour: reports carrying `tag`, and the other usable tags among them
 *  (counted once per report, keeping those on at least `min` reports). */
export function tagFlowHours(
  tag: string,
  rows: ReadonlyArray<{ id: number; media: string; publishedAt: Date; tags: readonly string[] }>,
  { perHour = 15, min = 2 } = {},
) {
  const hours = new Map<number, { count: number; tags: Map<string, number> }>();
  const seen = new Set<number>();
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const key = Math.floor(r.publishedAt.getTime() / HOUR) * HOUR;
    const h = hours.get(key) ?? { count: 0, tags: new Map() };
    h.count++;
    for (const t of new Set(r.tags.map((x) => x.trim()))) if (t !== tag && usable(t, r.media)) h.tags.set(t, (h.tags.get(t) ?? 0) + 1);
    hours.set(key, h);
  }
  return [...hours]
    .sort((a, b) => a[0] - b[0])
    .map(([t, h]) => ({
      t: new Date(t).toISOString(),
      count: h.count,
      tags: [...h.tags]
        .filter(([, n]) => n >= min)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-TW'))
        .slice(0, perHour) as Array<[string, number]>,
    }));
}

export async function loadTagFlow(db: Db, tag: string, hours: number, now = new Date()) {
  const to = new Date(Math.floor(now.getTime() / HOUR) * HOUR + HOUR);
  const from = new Date(to.getTime() - hours * HOUR);
  const rows = await db
    .select({ id: articles.id, media: articles.media, publishedAt: articleTags.publishedAt, tags: articles.tags })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(and(eq(articleTags.tag, tag), gte(articleTags.publishedAt, from), lt(articleTags.publishedAt, to)))
    .orderBy(desc(articleTags.publishedAt))
    .limit(TAG_FLOW_ROWS);
  return {
    tag,
    hours,
    from: from.toISOString(),
    to: to.toISOString(),
    sampled: rows.length >= TAG_FLOW_ROWS,
    points: tagFlowHours(tag, rows),
  };
}
