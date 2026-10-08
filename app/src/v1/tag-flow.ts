import { and, desc, eq, gte, lt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
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
  { perHour = Number.POSITIVE_INFINITY, min = 2 } = {},
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

export function mergeTagFlowDays(points: ReturnType<typeof tagFlowHours>) {
  const days = new Map<number, { count: number; tags: Map<string, number> }>();
  for (const point of points) {
    const key = Math.floor((Date.parse(point.t) + 8 * HOUR) / (24 * HOUR)) * 24 * HOUR - 8 * HOUR;
    const day = days.get(key) ?? { count: 0, tags: new Map<string, number>() };
    day.count += point.count;
    for (const [tag, n] of point.tags) day.tags.set(tag, (day.tags.get(tag) ?? 0) + n);
    days.set(key, day);
  }
  return [...days]
    .sort((a, b) => a[0] - b[0])
    .map(([key, day]) => ({
      t: new Date(key).toISOString(),
      count: day.count,
      tags: [...day.tags].sort((a, b) => b[1] - a[1]) as Array<[string, number]>,
    }));
}

export async function loadTagFlow(
  db: Db,
  tag: string,
  hours: number,
  now = new Date(),
  { until, span = 'hour' }: { until?: Date; span?: 'day' | 'hour' } = {},
) {
  const to = until ?? new Date(Math.floor(now.getTime() / HOUR) * HOUR + HOUR);
  const from = new Date(to.getTime() - hours * HOUR);
  const rows = await db
    .select({ id: articles.id, media: articles.media, publishedAt: articleTags.publishedAt, tags: articles.tags })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(and(eq(articleTags.tag, tag), gte(articleTags.publishedAt, from), lt(articleTags.publishedAt, to)))
    .orderBy(desc(articleTags.publishedAt))
    .limit(TAG_FLOW_ROWS);
  // This index lookup distinguishes an empty fortnight from the end of history.
  const earlier = await db
    .select({ id: articleTags.articleId })
    .from(articleTags)
    .where(and(eq(articleTags.tag, tag), lt(articleTags.publishedAt, from)))
    .limit(1);
  const points = tagFlowHours(tag, rows);
  return {
    tag,
    hours,
    from: from.toISOString(),
    to: to.toISOString(),
    sampled: rows.length >= TAG_FLOW_ROWS,
    span,
    hasMore: earlier.length > 0,
    points: span === 'day' ? mergeTagFlowDays(points) : points,
  };
}

export function registerTagFlow(app: FastifyInstance, db: Db) {
  app.get<{ Params: { tag: string }; Querystring: { hours?: string; until?: string; span?: string } }>(
    '/api/v1/tags/:tag/flow',
    async (request, reply) => {
      const tag = request.params.tag.slice(0, 60);
      const hours = request.query.hours === undefined ? 336 : Number(request.query.hours);
      const span = request.query.span ?? 'hour';
      const until = request.query.until === undefined ? undefined : new Date(request.query.until);
      if (!Number.isInteger(hours) || hours < 1 || hours > 744) return reply.code(400).send({ error: 'bad hours' });
      if (span !== 'day' && span !== 'hour') return reply.code(400).send({ error: 'bad span' });
      if (until && (!Number.isFinite(until.getTime()) || until.getTime() < 0 || until.getTime() > Date.now() + HOUR)) {
        return reply.code(400).send({ error: 'bad until' });
      }
      reply.header('cache-control', 'public, max-age=300');
      return loadTagFlow(db, tag, hours, new Date(), { until, span });
    },
  );
}
