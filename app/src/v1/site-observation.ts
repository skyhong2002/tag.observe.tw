// Public GA4 / Search Console aggregates for /observe/ and the home page's
// 讀者關注 panel, read from site_metrics (jobs/analytics-job.ts).
import { and, between, eq, inArray, min, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { siteMetrics } from '../db/schema.ts';
import { lastAnalyticsRun } from '../jobs/analytics-job.ts';

export const OBSERVATION_DAYS = [7, 28, 90] as const;
// Content a reader came for, as opposed to index and navigation pages.
const CONTENT = /^\/(eve|tag|topic|feature|article|journalist|media)\/(?!(?:sources|crawlers)\/$)[^/]+\/(?:[^/]+\/)?$/;
const KINDS: Record<string, string> = {
  eve: 'event',
  tag: 'tag',
  topic: 'topic',
  feature: 'feature',
  article: 'article',
  journalist: 'journalist',
  media: 'media',
};

export function pageKind(path: string) {
  return CONTENT.test(path) ? (KINDS[path.split('/')[1]] ?? 'page') : 'page';
}

// GA Realtime rows older than this mean the live job has stopped; show nothing rather than stale "now".
const LIVE_STALE_MS = 15 * 60e3;

/** The last 30 minutes from the analytics-live job, oldest minute first; null when missing or stale. */
export async function liveObservation(db: Db, now = new Date()) {
  const rows = await db
    .select({ metric: siteMetrics.metric, key: siteMetrics.key, value: siteMetrics.value })
    .from(siteMetrics)
    .where(eq(siteMetrics.source, 'rt'));
  const get = (metric: string) => rows.find((r) => r.metric === metric && r.key === '')?.value;
  const fetchedAt = get('fetched_at');
  if (!fetchedAt || now.getTime() - fetchedAt > LIVE_STALE_MS) return null;
  const perMinute = Array.from({ length: 30 }, (_, i) => {
    const ago = String(29 - i).padStart(2, '0');
    return rows.find((r) => r.metric === 'minute_views' && r.key === ago)?.value ?? 0;
  });
  return { fetchedAt: new Date(fetchedAt).toISOString(), activeUsers: get('active_users') ?? 0, views: get('views') ?? 0, perMinute };
}

const taipeiDay = (d: Date) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
const round = (n: number, digits = 0) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Every day from start to end, so charts show quiet days as zero instead of skipping them. */
export function dayRange(start: string, end: string) {
  const days: string[] = [];
  for (let d = start; d <= end; d = shiftDay(d, 1)) days.push(d);
  return days;
}

export async function siteObservation(db: Db, days: number, now = new Date()) {
  const end = taipeiDay(now);
  const start = shiftDay(end, 1 - days);
  const [first] = await db
    .select({ ga: sql<string | null>`MIN(CASE WHEN ${siteMetrics.source} = 'ga' THEN ${siteMetrics.day} END)`, any: min(siteMetrics.day) })
    .from(siteMetrics);
  const [updatedAt, live] = await Promise.all([lastAnalyticsRun(db), liveObservation(db, now)]);
  if (!first?.any)
    return { updatedAt, live, days, start, end, trackingSince: null, traffic: null, pages: [], content: [], search: null, vitals: null };
  const inRange = between(siteMetrics.day, start, end);
  const totals = await db
    .select({ day: siteMetrics.day, source: siteMetrics.source, metric: siteMetrics.metric, value: siteMetrics.value })
    .from(siteMetrics)
    .where(
      and(
        inRange,
        eq(siteMetrics.key, ''),
        inArray(siteMetrics.metric, ['views', 'sessions', 'users', 'clicks', 'impressions', 'position']),
      ),
    );
  const byDay = (source: string) => {
    const map = new Map<string, Record<string, number>>();
    for (const r of totals.filter((r) => r.source === source)) map.set(r.day, { ...map.get(r.day), [r.metric]: r.value });
    return map;
  };
  const breakdown = async (metric: string) =>
    (
      await db
        .select({ name: siteMetrics.key, value: sql<number>`SUM(${siteMetrics.value})` })
        .from(siteMetrics)
        .where(and(inRange, eq(siteMetrics.source, 'ga'), eq(siteMetrics.metric, metric)))
        .groupBy(siteMetrics.key)
        .orderBy(sql`2 DESC`)
    ).map((r) => ({ name: r.name, value: Number(r.value) }));
  const topPages = async (source: string, metric: string, content: boolean, limit: number) =>
    db
      .select({
        path: siteMetrics.key,
        value: sql<number>`SUM(${siteMetrics.value})`,
        title: sql<
          string | null
        >`SUBSTRING_INDEX(GROUP_CONCAT(${siteMetrics.label} ORDER BY ${siteMetrics.day} DESC SEPARATOR '\n'), '\n', 1)`,
      })
      .from(siteMetrics)
      .where(
        and(
          inRange,
          eq(siteMetrics.source, source),
          eq(siteMetrics.metric, metric),
          content ? sql`${siteMetrics.key} REGEXP ${CONTENT.source}` : undefined,
        ),
      )
      .groupBy(siteMetrics.key)
      .orderBy(sql`2 DESC`, siteMetrics.key)
      .limit(limit);
  const titled = (rows: Awaited<ReturnType<typeof topPages>>) =>
    rows.map((r) => ({
      path: r.path,
      kind: pageKind(r.path),
      title: r.title || (r.path.startsWith('/tag/') ? r.path.slice(5, -1) : r.path),
      views: Number(r.value),
    }));

  let traffic = null;
  if (first.ga && first.ga <= end) {
    const ga = byDay('ga');
    const daily = dayRange(first.ga > start ? first.ga : start, end).map((date) => ({
      date,
      views: ga.get(date)?.views ?? 0,
      sessions: ga.get(date)?.sessions ?? 0,
      users: ga.get(date)?.users ?? 0,
    }));
    const [channels, devices, events] = await Promise.all([breakdown('channel'), breakdown('device'), breakdown('event')]);
    traffic = {
      daily,
      views: daily.reduce((n, d) => n + d.views, 0),
      sessions: daily.reduce((n, d) => n + d.sessions, 0),
      channels,
      devices,
      events,
    };
  }

  const gsc = byDay('gsc');
  let search = null;
  if (gsc.size) {
    const daily = [...gsc]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, clicks: v.clicks ?? 0, impressions: v.impressions ?? 0, position: round(v.position ?? 0, 1) }));
    const clicks = daily.reduce((n, d) => n + d.clicks, 0);
    const impressions = daily.reduce((n, d) => n + d.impressions, 0);
    const pages = await topPages('gsc', 'page_clicks', false, 10);
    const impressionsByPage = new Map(
      (
        await db
          .select({ path: siteMetrics.key, value: sql<number>`SUM(${siteMetrics.value})` })
          .from(siteMetrics)
          .where(
            and(
              inRange,
              eq(siteMetrics.source, 'gsc'),
              eq(siteMetrics.metric, 'page_impressions'),
              pages.length
                ? inArray(
                    siteMetrics.key,
                    pages.map((p) => p.path),
                  )
                : sql`FALSE`,
            ),
          )
          .groupBy(siteMetrics.key)
      ).map((r) => [r.path, Number(r.value)]),
    );
    search = {
      daily,
      clicks,
      impressions,
      // Impression-weighted, as GSC's own overview computes it.
      position: impressions ? round(daily.reduce((n, d) => n + d.position * d.impressions, 0) / impressions, 1) : null,
      pages: titled(pages).map(({ views, ...p }) => ({ ...p, clicks: views, impressions: impressionsByPage.get(p.path) ?? 0 })),
    };
  }

  const vitalRows = await breakdown('vital');
  const vitals = vitalRows.length
    ? ['LCP', 'INP', 'CLS'].map((name) => {
        const of = (rating: string) => vitalRows.find((r) => r.name === `${name}:${rating}`)?.value ?? 0;
        return { name, good: of('good'), needsImprovement: of('needs-improvement'), poor: of('poor') };
      })
    : null;

  const [pages, content] = await Promise.all([topPages('ga', 'page_views', false, 20), topPages('ga', 'page_views', true, 10)]);
  return {
    updatedAt,
    live,
    days,
    start,
    end,
    trackingSince: first.ga,
    traffic,
    pages: titled(pages),
    content: titled(content),
    search,
    vitals,
  };
}

export function registerSiteObservation(app: FastifyInstance, db: Db) {
  app.get<{ Querystring: { days?: string } }>('/api/v1/site-observation', async (request, reply) => {
    const days = Number(request.query.days ?? 28);
    if (!(OBSERVATION_DAYS as readonly number[]).includes(days)) return reply.code(400).send({ error: 'days must be 7, 28 or 90' });
    reply.header('cache-control', 'public, max-age=60');
    return siteObservation(db, days);
  });
}
