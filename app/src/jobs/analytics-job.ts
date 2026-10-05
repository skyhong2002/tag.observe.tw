// Pull GA4 and Search Console aggregates into site_metrics for the public
// 網站觀測 page (/observe/) and the home page's 讀者關注 panel. Each hourly run
// re-reads a trailing window (GA keeps processing for ~3 days, GSC lags 2–3
// days) and replaces those days, so late data and vanished keys settle.
// runRealtimeJob adds the last 30 minutes from GA's Realtime API every few minutes.
import { and, between, count, eq, sql } from 'drizzle-orm';
import { type GoogleConfig, type GoogleFetch, googleClient } from '../analytics/google.ts';
import type { Db } from '../db/client.ts';
import { jobRuns, siteMetrics } from '../db/schema.ts';

export const SITE_HOST = 'tag.observe.tw';
const BACKFILL_DAYS = 90;
const GA_REFRESH_DAYS = 7;
const GSC_REFRESH_DAYS = 10;
const TRACKED_EVENTS = ['open_original', 'select_content', 'rss_click', 'app_installed'];
const VITALS = ['LCP', 'INP', 'CLS'];
const RATINGS = ['good', 'needs-improvement', 'poor'];

export type MetricRow = typeof siteMetrics.$inferInsert;

const taipeiDay = (d: Date) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
const gaDay = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

/** Canonical form of a page path GA or GSC reports, or null for paths we do not publish. */
export function sitePath(raw: string): string | null {
  let path = raw;
  if (/^https?:\/\//.test(path)) {
    const url = new URL(path);
    if (url.hostname !== SITE_HOST) return null;
    path = url.pathname;
  }
  path = path.split(/[?#]/)[0];
  if (!path.startsWith('/') || path.startsWith('//') || path.length > 200) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (/[\x00-\x1f\\]/.test(decoded) || decoded.split('/').some((s) => s === '..' || s === '.')) return null;
  // Search pages echo what the reader typed; keep only the bare path.
  if (decoded.startsWith('/search/')) return '/search/';
  if (!decoded.endsWith('/') && !/\.[a-z]+$/.test(decoded)) decoded += '/';
  return decoded;
}

export const cleanTitle = (title: string) =>
  title
    .replace(/\s*[·|–-]\s*新文易數\s*$/, '')
    .trim()
    .slice(0, 255);

/** Sum views per (day, path) across encodings and titles; users take the max (a lower bound, never double-counted). */
export function pageRows(rows: Array<{ day: string; path: string; title: string; views: number; users: number }>): MetricRow[] {
  const pages = new Map<string, { day: string; path: string; views: number; users: number; titles: Map<string, number> }>();
  for (const r of rows) {
    const path = sitePath(r.path);
    if (!path) continue;
    const id = `${r.day} ${path}`;
    const p = pages.get(id) ?? { day: r.day, path, views: 0, users: 0, titles: new Map() };
    p.views += r.views;
    p.users = Math.max(p.users, r.users);
    if (path !== '/search/' && r.title && r.title !== '(not set)') p.titles.set(r.title, (p.titles.get(r.title) ?? 0) + r.views);
    pages.set(id, p);
  }
  return [...pages.values()].flatMap((p) => {
    const top = [...p.titles].sort((a, b) => b[1] - a[1])[0]?.[0];
    const label = top ? cleanTitle(top) : null;
    return [
      { day: p.day, source: 'ga', metric: 'page_views', key: p.path, value: p.views, label },
      { day: p.day, source: 'ga', metric: 'page_users', key: p.path, value: p.users, label: null },
    ];
  });
}

export async function fetchGa(google: GoogleFetch, propertyId: string, start: string, end: string): Promise<MetricRow[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}`;
  const host = { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: SITE_HOST } } };
  const report = async (dimensions: string[], metrics: string[], filter?: object) => {
    const r = await google(`${url}:runReport`, {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: ['date', ...dimensions].map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      dimensionFilter: filter ? { andGroup: { expressions: [host, filter] } } : host,
      limit: 100000,
    });
    if ((r.rowCount ?? 0) > 100000) throw Error('GA report truncated');
    return ((r.rows ?? []) as Array<{ dimensionValues: { value: string }[]; metricValues: { value: string }[] }>).map((row) => ({
      day: gaDay(row.dimensionValues[0].value),
      dims: row.dimensionValues.slice(1).map((d) => d.value),
      values: row.metricValues.map((m) => Number(m.value)),
    }));
  };
  const out: MetricRow[] = [];
  for (const r of await report([], ['screenPageViews', 'sessions', 'activeUsers']))
    ['views', 'sessions', 'users'].forEach((metric, i) => {
      out.push({ day: r.day, source: 'ga', metric, key: '', value: r.values[i] });
    });
  const pages = await report(['pagePath', 'pageTitle'], ['screenPageViews', 'activeUsers']);
  out.push(...pageRows(pages.map((r) => ({ day: r.day, path: r.dims[0], title: r.dims[1], views: r.values[0], users: r.values[1] }))));
  for (const [metric, dimension] of [
    ['channel', 'sessionDefaultChannelGroup'],
    ['device', 'deviceCategory'],
  ])
    for (const r of await report([dimension], ['sessions']))
      out.push({ day: r.day, source: 'ga', metric, key: r.dims[0].slice(0, 255), value: r.values[0] });
  const events = { filter: { fieldName: 'eventName', inListFilter: { values: TRACKED_EVENTS } } };
  for (const r of await report(['eventName'], ['eventCount'], events))
    out.push({ day: r.day, source: 'ga', metric: 'event', key: r.dims[0], value: r.values[0] });
  // Web Vitals ratings need the event-scoped custom dimensions registered in GA (docs/analytics.md).
  const meta = await google(`${url}/metadata`);
  const dims = new Set((meta.dimensions ?? []).map((d: { apiName: string }) => d.apiName));
  if (dims.has('customEvent:metric_name') && dims.has('customEvent:metric_rating')) {
    const vitals = { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'web_vital' } } };
    for (const r of await report(['customEvent:metric_name', 'customEvent:metric_rating'], ['eventCount'], vitals))
      if (VITALS.includes(r.dims[0]) && RATINGS.includes(r.dims[1]))
        out.push({ day: r.day, source: 'ga', metric: 'vital', key: `${r.dims[0]}:${r.dims[1]}`, value: r.values[0] });
  }
  return out;
}

export async function fetchGsc(google: GoogleFetch, siteUrl: string, start: string, end: string): Promise<MetricRow[]> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const query = async (dimensions: string[]) => {
    const rows: Array<{ keys: string[]; clicks: number; impressions: number; position: number }> = [];
    for (let startRow = 0; ; startRow += 25000) {
      const r = await google(url, { startDate: start, endDate: end, type: 'web', dataState: 'all', dimensions, rowLimit: 25000, startRow });
      rows.push(...(r.rows ?? []));
      if ((r.rows ?? []).length < 25000) return rows;
    }
  };
  const out: MetricRow[] = [];
  for (const r of await query(['date'])) {
    const day = r.keys[0];
    out.push(
      { day, source: 'gsc', metric: 'clicks', key: '', value: r.clicks },
      { day, source: 'gsc', metric: 'impressions', key: '', value: r.impressions },
      { day, source: 'gsc', metric: 'position', key: '', value: r.position },
    );
  }
  // Pages only, never queries: search terms stay out of the public data.
  const pages = new Map<string, { day: string; path: string; clicks: number; impressions: number }>();
  for (const r of await query(['date', 'page'])) {
    const path = sitePath(r.keys[1]);
    if (!path) continue;
    const p = pages.get(`${r.keys[0]} ${path}`) ?? { day: r.keys[0], path, clicks: 0, impressions: 0 };
    p.clicks += r.clicks;
    p.impressions += r.impressions;
    pages.set(`${r.keys[0]} ${path}`, p);
  }
  for (const p of pages.values())
    out.push(
      { day: p.day, source: 'gsc', metric: 'page_clicks', key: p.path, value: p.clicks },
      { day: p.day, source: 'gsc', metric: 'page_impressions', key: p.path, value: p.impressions },
    );
  return out;
}

/** GA Realtime: active users and views over the last 30 minutes, views per minute (no pages: titles can carry search terms). */
export async function fetchRealtime(google: GoogleFetch, propertyId: string, now: Date): Promise<MetricRow[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`;
  const value = (row: { metricValues: { value: string }[] } | undefined, i: number) => Number(row?.metricValues[i].value ?? 0);
  const [total, minutes] = await Promise.all([
    google(url, { metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }] }),
    google(url, { dimensions: [{ name: 'minutesAgo' }], metrics: [{ name: 'screenPageViews' }] }),
  ]);
  const day = taipeiDay(now);
  const out: MetricRow[] = [
    { day, source: 'rt', metric: 'fetched_at', key: '', value: now.getTime() },
    { day, source: 'rt', metric: 'active_users', key: '', value: value(total.rows?.[0], 0) },
    { day, source: 'rt', metric: 'views', key: '', value: value(total.rows?.[0], 1) },
  ];
  for (const row of minutes.rows ?? []) {
    const ago = Number(row.dimensionValues[0].value);
    if (Number.isInteger(ago) && ago >= 0 && ago < 30)
      out.push({ day, source: 'rt', metric: 'minute_views', key: String(ago).padStart(2, '0'), value: value(row, 0) });
  }
  return out;
}

/** Replace the realtime rows; not logged to job_runs (it runs every few minutes). */
export async function runRealtimeJob(db: Db, config: GoogleConfig, { now = () => new Date(), google = googleClient(config) } = {}) {
  const rows = await fetchRealtime(google, config.propertyId, now());
  await db.transaction(async (tx) => {
    await tx.delete(siteMetrics).where(eq(siteMetrics.source, 'rt'));
    await tx.insert(siteMetrics).values(rows);
  });
  return { activeUsers: rows[1].value, views: rows[2].value };
}

async function replaceDays(db: Db, source: string, start: string, end: string, rows: MetricRow[]) {
  await db.transaction(async (tx) => {
    await tx.delete(siteMetrics).where(and(eq(siteMetrics.source, source), between(siteMetrics.day, start, end)));
    for (let i = 0; i < rows.length; i += 500) await tx.insert(siteMetrics).values(rows.slice(i, i + 500));
  });
}

export async function runAnalyticsJob(
  db: Db,
  config: GoogleConfig,
  { now = () => new Date(), log = (_o: object, _m: string) => {}, google = googleClient(config) } = {},
) {
  const started = now();
  const [run] = await db.insert(jobRuns).values({ name: 'analytics', startedAt: started, status: 'running' }).$returningId();
  try {
    const today = taipeiDay(started);
    const summary: Record<string, { start: string; end: string; rows: number }> = {};
    for (const [source, refresh] of [
      ['ga', GA_REFRESH_DAYS],
      ['gsc', GSC_REFRESH_DAYS],
    ] as const) {
      const [{ n }] = await db.select({ n: count() }).from(siteMetrics).where(eq(siteMetrics.source, source));
      const start = shiftDay(today, -(n ? refresh : BACKFILL_DAYS));
      const rows =
        source === 'ga' ? await fetchGa(google, config.propertyId, start, today) : await fetchGsc(google, config.siteUrl, start, today);
      await replaceDays(db, source, start, today, rows);
      summary[source] = { start, end: today, rows: rows.length };
    }
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'ok', detail: JSON.stringify(summary) })
      .where(eq(jobRuns.id, run.id));
    log(summary, 'analytics job finished');
    return summary;
  } catch (error) {
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
      .where(eq(jobRuns.id, run.id));
    throw error;
  }
}

/** Last successful run, for the page's 更新於 line. */
export async function lastAnalyticsRun(db: Db) {
  const [row] = await db
    .select({ finishedAt: jobRuns.finishedAt })
    .from(jobRuns)
    .where(and(eq(jobRuns.name, 'analytics'), eq(jobRuns.status, 'ok')))
    .orderBy(sql`${jobRuns.startedAt} DESC`)
    .limit(1);
  return row?.finishedAt ?? null;
}
