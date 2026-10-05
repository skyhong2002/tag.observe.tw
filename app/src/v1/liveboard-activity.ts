import { desc, inArray, sql } from 'drizzle-orm';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { crawlRuns, jobRuns } from '../db/schema.ts';

// What the workers are doing, for the /liveboard/ header: crawl runs from the
// last few minutes and the next scheduled jobs. The schedules mirror the
// upsertJobScheduler calls in app/src/worker.ts (same env overrides and
// defaults). BullMQ keeps a per-scheduler offset for `every`, so those are
// projected from the job's last recorded start when there is one, else from
// multiples of the period; cron patterns run in the host's Asia/Taipei time.

const mediaInfo = catalog as unknown as Record<string, { title: string | null }>;
const MINUTE = 60e3;
const TAIPEI = 8 * 60 * MINUTE;
const RECENT_MS = 10 * MINUTE;

type Schedule = { job: string; label: string } & ({ every: number } | { cron: string });
export function jobSchedules(env: Record<string, string | undefined> = process.env): Schedule[] {
  const minutes = (name: string, fallback: number) => Number(env[name] || fallback) * MINUTE;
  const crawl = env.CRAWL_ENABLED !== '0';
  // Same condition as googleConfigFromEnv (app/src/analytics/google.ts).
  const analytics = Boolean(env.GOOGLE_APPLICATION_CREDENTIALS && env.GA4_PROPERTY_ID && env.GSC_SITE_URL);
  return [
    { job: 'ranking', label: '關鍵字排行', every: minutes('RANKING_INTERVAL_MINUTES', 10) },
    ...(crawl
      ? [
          { job: 'crawl-news', label: '新聞來源巡查', every: minutes('CRAWL_NEWS_MINUTES', 9) },
          { job: 'crawl-hourly', label: '每小時來源巡查', every: minutes('CRAWL_HOURLY_RUN_MINUTES', 30) },
          { job: 'crawl-articles', label: '抓取內文', every: minutes('CRAWL_ARTICLES_MINUTES', 19) },
        ]
      : []),
    { job: 'events', label: '事件分群', cron: env.EVENTS_CRON || '4,34 * * * *' },
    { job: 'topics', label: '議題專題巡查', cron: env.TOPICS_CRON || '50 * * * *' },
    { job: 'tag-stats', label: '標籤統計', cron: env.TAG_STATS_CRON || '53 * * * *' },
    { job: 'similarity', label: '轉載比對', every: minutes('SIMILARITY_INDEX_MINUTES', 10) },
    { job: 'crawl-health', label: '爬蟲健康檢查', every: 15 * MINUTE },
    { job: 'retention', label: '資料保留整理', cron: env.RETENTION_CRON || '15 4 * * *' },
    { job: 'source-probe', label: '來源探測', cron: env.PROBE_CRON || '30 5 * * 1' },
    ...(analytics
      ? [
          { job: 'analytics', label: '流量統計', cron: env.ANALYTICS_CRON || '20 * * * *' },
          { job: 'analytics-live', label: '即時讀者', every: minutes('ANALYTICS_LIVE_MINUTES', 2) },
        ]
      : []),
  ];
}

/** Whether one cron field (`*`, `5`, `4,34`, `1-5`, `*\/10`) admits `value`. */
function fieldMatches(field: string, value: number): boolean {
  return field.split(',').some((part) => {
    const [range, stepText] = part.split('/');
    const step = stepText ? Number(stepText) : 1;
    if (range === '*') return value % step === 0;
    const [lo, hi] = range.split('-').map(Number);
    if (hi === undefined) return stepText ? value >= lo && (value - lo) % step === 0 : value === lo;
    return value >= lo && value <= hi && (value - lo) % step === 0;
  });
}

/** The first minute after `from` that a five-field cron pattern matches, in Taipei time; null within 8 days. */
export function nextCron(pattern: string, from: number): number | null {
  const [m, h, dom, mon, dow] = pattern.trim().split(/\s+/);
  let at = Math.floor(from / MINUTE) * MINUTE + MINUTE;
  for (let i = 0; i < 8 * 24 * 60; i++, at += MINUTE) {
    const t = new Date(at + TAIPEI);
    if (
      fieldMatches(m, t.getUTCMinutes()) &&
      fieldMatches(h, t.getUTCHours()) &&
      fieldMatches(dom, t.getUTCDate()) &&
      fieldMatches(mon, t.getUTCMonth() + 1) &&
      fieldMatches(dow, t.getUTCDay())
    )
      return at;
  }
  return null;
}

export function nextRun(s: Schedule, from: number, lastStart?: number): number | null {
  if (!('every' in s)) return nextCron(s.cron, from);
  if (lastStart !== undefined && from - lastStart < 3 * s.every)
    return lastStart + Math.max(1, Math.ceil((from - lastStart) / s.every)) * s.every;
  return Math.floor(from / s.every) * s.every + s.every;
}

export interface LiveActivity {
  crawls: Array<{ media: string; mediaTitle: string; stage: string; at: string; running: boolean; inserted: number; failed: boolean }>;
  running: Array<{ job: string; since: string }>;
  upcoming: Array<{ job: string; label: string; at: string }>;
}

export async function loadActivity(db: Db, now: number): Promise<LiveActivity> {
  // Newest runs by primary key: started_at has no index.
  const schedules = jobSchedules();
  const [crawls, jobs, lastStarts] = await Promise.all([
    db
      .select({
        media: crawlRuns.media,
        stage: crawlRuns.stage,
        startedAt: crawlRuns.startedAt,
        finishedAt: crawlRuns.finishedAt,
        status: crawlRuns.status,
        inserted: crawlRuns.inserted,
      })
      .from(crawlRuns)
      .orderBy(desc(crawlRuns.id))
      .limit(300),
    db
      .select({ name: jobRuns.name, startedAt: jobRuns.startedAt })
      .from(jobRuns)
      .where(inArray(jobRuns.status, ['running']))
      .orderBy(desc(jobRuns.id))
      .limit(10),
    db
      .select({ name: jobRuns.name, last: sql<string>`MAX(${jobRuns.startedAt})` })
      .from(jobRuns)
      .where(
        inArray(
          jobRuns.name,
          schedules.map((s) => s.job),
        ),
      )
      .groupBy(jobRuns.name),
  ]);
  const last = new Map(lastStarts.map((r) => [r.name, Date.parse(`${r.last}Z`.replace(' ', 'T'))]));
  const upcoming = schedules
    .map((s) => ({ job: s.job, label: s.label, at: nextRun(s, now, last.get(s.job)) }))
    .filter((u): u is { job: string; label: string; at: number } => u.at !== null)
    .sort((a, b) => a.at - b.at)
    .slice(0, 8);
  return {
    crawls: crawls
      .filter((c) => now - c.startedAt.getTime() < RECENT_MS)
      .map((c) => ({
        media: c.media,
        mediaTitle: mediaInfo[c.media]?.title ?? c.media,
        stage: c.stage,
        at: (c.finishedAt ?? c.startedAt).toISOString(),
        running: c.finishedAt === null,
        inserted: c.inserted,
        failed: c.status === 'failed',
      }))
      .slice(0, 40),
    // A run left `running` for hours is a crashed job, not a live one.
    running: jobs.filter((j) => now - j.startedAt.getTime() < 60 * MINUTE).map((j) => ({ job: j.name, since: j.startedAt.toISOString() })),
    upcoming: upcoming.map((u) => ({ ...u, at: new Date(u.at).toISOString() })),
  };
}
