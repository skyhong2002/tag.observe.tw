// Port of maint/chart.php: per hour, count each tag's mentions over the trailing
// window (24h for news, 7d otherwise) across the category's media, keep tags
// that appear in >=2 media at least twice (level 2) / >=3 media with one >=3
// (level 3), and maintain first/last hour, hours_count, max_hour/max_count.
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articles, jobRuns, tagStats } from '../db/schema.ts';
import { hourStart, RANKING_CATEGORIES } from './ranking-job.ts';

export function qualifyTags(rows: Array<{ media: string; tags: string[] }>, category: string) {
  const perTag = new Map<string, { count: number; media: Map<string, number> }>();
  for (const r of rows)
    for (const t of new Set(r.tags)) {
      const e = perTag.get(t) ?? { count: 0, media: new Map() };
      e.count++;
      e.media.set(r.media, (e.media.get(r.media) ?? 0) + 1);
      perTag.set(t, e);
    }
  const level2: Array<[string, number]> = [],
    level3: Array<[string, number]> = [];
  for (const [tag, e] of perTag) {
    const c1 = [...e.media.values()].filter((n) => n >= 1).length,
      c2 = [...e.media.values()].filter((n) => n >= 2).length,
      c3 = [...e.media.values()].filter((n) => n >= 3).length;
    if (category === 'news') {
      if (c2 >= 2) level2.push([tag, e.count]);
      if (c2 >= 2 && c3 >= 1 && c1 >= 3) level3.push([tag, e.count]);
    } else {
      if (c1 >= 2) level2.push([tag, e.count]);
      if (c1 >= 2 && c2 >= 1) level3.push([tag, e.count]);
    }
  }
  return { level2, level3 };
}

export async function runTagStatsJob(
  db: Db,
  { now = () => new Date(), log = (_o: object, _m: string) => {}, categories = ['news', '3c', 'women', 'finance', 'game', 'health'] } = {},
) {
  const started = now();
  const hour = hourStart(started);
  const [run] = await db.insert(jobRuns).values({ name: 'tag-stats', startedAt: started, status: 'running' }).$returningId();
  try {
    const summary: Record<string, { level2: number; level3: number }> = {};
    for (const category of categories) {
      const spec = RANKING_CATEGORIES[category];
      if (!spec) continue;
      const windowHours = category === 'news' ? 24 : 24 * 7;
      const rows = await db
        .select({ media: articles.media, tags: articles.tags })
        .from(articles)
        .where(
          and(
            eq(articles.source, 'own'),
            gte(articles.publishedAt, new Date(hour.getTime() - windowHours * 3600e3)),
            lt(articles.publishedAt, hour),
            sql`${articles.media} IN (${sql.join(
              spec.media.map((m) => sql`${m}`),
              sql`, `,
            )})`,
            sql`JSON_LENGTH(${articles.tags}) > 0`,
          ),
        );
      const { level2, level3 } = qualifyTags(rows, category);
      for (const [level, list] of [
        [2, level2],
        [3, level3],
      ] as const) {
        for (let i = 0; i < list.length; i += 300) {
          await db
            .insert(tagStats)
            .values(
              list.slice(i, i + 300).map(([tag, count]) => ({
                tag: tag.slice(0, 60),
                category,
                level,
                firstHour: hour,
                lastHour: hour,
                hoursCount: 1,
                maxHour: hour,
                maxCount: count,
                updatedAt: started,
              })),
            )
            .onDuplicateKeyUpdate({
              set: {
                hoursCount: sql`IF(last_hour < VALUES(last_hour), hours_count + 1, hours_count)`,
                maxHour: sql`IF(VALUES(max_count) > max_count, VALUES(max_hour), max_hour)`,
                maxCount: sql`GREATEST(max_count, VALUES(max_count))`,
                lastHour: sql`GREATEST(last_hour, VALUES(last_hour))`,
                updatedAt: started,
              },
            });
        }
      }
      summary[category] = { level2: level2.length, level3: level3.length };
    }
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'ok', detail: JSON.stringify({ hour, summary }) })
      .where(eq(jobRuns.id, run.id));
    log({ hour, ...summary }, 'tag stats job finished');
    return summary;
  } catch (error) {
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
      .where(eq(jobRuns.id, run.id));
    throw error;
  }
}
