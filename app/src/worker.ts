import { createServer } from 'node:http';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { googleConfigFromEnv } from './analytics/google.ts';
import { keepGeneratedRulesFresh } from './crawl/rules/state.ts';
import { createDb } from './db/client.ts';
import { runAnalyticsJob, runRealtimeJob } from './jobs/analytics-job.ts';
import { runCrawlHealthJob } from './jobs/crawl-health-job.ts';
import { crawlArticles, crawlGroup, crawlMedia } from './jobs/crawl-job.ts';
import { runCrawlRulesJob } from './jobs/crawl-rules-job.ts';
import { runEventsJob } from './jobs/events-job.ts';
import { runMediaOutputJob } from './jobs/media-output-job.ts';
import { runMediaRadarJob } from './jobs/media-radar-job.ts';
import { runMediaTrafficJob } from './jobs/media-traffic-job.ts';
import { runProbeJob } from './jobs/probe-job.ts';
import { runRankingJob } from './jobs/ranking-job.ts';
import { runRetentionJob } from './jobs/retention-job.ts';
import { runRobotsJob } from './jobs/robots-job.ts';
import { runSimilarityJob } from './jobs/similarity-job.ts';
import { runTagAvatarsInChild } from './jobs/tag-avatars-job.ts';
import { runTagGroupsJob } from './jobs/tag-groups-job.ts';
import { runTagHistoryJob } from './jobs/tag-history-job.ts';
import { runTagStatsJob } from './jobs/tag-stats-job.ts';
import { runTagVisualsJob } from './jobs/tag-visuals-job.ts';
import { runTopicsJob } from './jobs/topics-job.ts';
import { runWritingJob, runWritingPeopleJob } from './jobs/writing-job.ts';
import { LEGACY_OWNERSHIP_POLICY } from './legacy/ownership-policy.ts';
import { keepMediaCategoriesFresh } from './media-categories.ts';
import { radarConfigured } from './media-traffic/radar.ts';
import { jobDuration, jobRuns as jobRunsMetric, metricsContentType, metricsText, snapshotAge, snapshotArticles } from './metrics.ts';
import { archiveStoreFromEnv } from './nearline/store.ts';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:16379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const { db, close: closeDb } = createDb();
const queue = new Queue('tag-jobs', { connection });
// Admins edit media labels at /admin/media/; ranking, events and tag stats read them.
const labels = keepMediaCategoriesFresh(db, { warn: (err) => log.warn({ err: (err as Error).message }, 'media labels refresh failed') });
await labels.ready;
// Generated crawl rules live in files (crawl/rules/store.ts); every crawl reads the active ones.
const generatedRules = keepGeneratedRulesFresh({
  warn: (err) =>
    log.warn({ err: (err as Error).message, media: (err as { media?: string }).media }, 'generated crawl rules refresh failed'),
});
await generatedRules.ready;
const intervalMinutes = Number(process.env.RANKING_INTERVAL_MINUTES || 10);
await queue.upsertJobScheduler(
  'ranking-every',
  { every: intervalMinutes * 60e3 },
  { name: 'ranking', data: {}, opts: { removeOnComplete: 100, removeOnFail: 100 } },
);

// Deploys restart this process. Crawl jobs stop dispatching new sources once
// `shutdown` is aborted and return what they finished, and a fresh worker
// enqueues an immediate run for each group so the sources still due are taken
// up within seconds instead of at the next scheduled tick.
const shutdown = new AbortController();
const crawlEnabled = process.env.CRAWL_ENABLED !== '0';
if (crawlEnabled) {
  await queue.upsertJobScheduler(
    'crawl-news',
    { every: Number(process.env.CRAWL_NEWS_MINUTES || 9) * 60e3 },
    { name: 'crawl-index', data: { group: 'news' }, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );
  // The hourly group's period (CRAWL_HOURLY_MINUTES) is enforced by crawlGroup's
  // due filter; runs start twice as often so a source is never left waiting a
  // whole extra period after being skipped or after a restart.
  await queue.upsertJobScheduler(
    'crawl-hourly',
    { every: Number(process.env.CRAWL_HOURLY_RUN_MINUTES || 30) * 60e3 },
    { name: 'crawl-index', data: { group: 'hourly' }, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );
  await queue.upsertJobScheduler(
    'crawl-articles',
    { every: Number(process.env.CRAWL_ARTICLES_MINUTES || 19) * 60e3 },
    { name: 'crawl-articles', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );
  for (const group of ['news', 'hourly'])
    await queue.add('crawl-index', { group }, { jobId: `crawl-index-boot-${group}-${Date.now()}`, removeOnComplete: 50, removeOnFail: 50 });
} else {
  for (const id of ['crawl-news', 'crawl-hourly', 'crawl-articles']) await queue.removeJobScheduler(id);
}
await queue.upsertJobScheduler(
  'events-hourly',
  { pattern: process.env.EVENTS_CRON || '4,34 * * * *' },
  { name: 'events', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
);
await queue.upsertJobScheduler(
  'topics-hourly',
  { pattern: process.env.TOPICS_CRON || '50 * * * *' },
  { name: 'topics', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
);
await queue.upsertJobScheduler(
  'tag-stats-hourly',
  { pattern: process.env.TAG_STATS_CRON || '53 * * * *' },
  { name: 'tag-stats', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
);
// Each ranking keyword's first article and busiest day (jobs/tag-history-job.ts).
await queue.upsertJobScheduler(
  'tag-history-hourly',
  { pattern: process.env.TAG_HISTORY_CRON || '57 * * * *' },
  { name: 'tag-history', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
);
// Compare newly fetched bodies with every other outlet's articles (jobs/similarity-job.ts).
await queue.upsertJobScheduler(
  'similarity-index',
  { every: Number(process.env.SIMILARITY_INDEX_MINUTES || 10) * 60e3 },
  { name: 'similarity', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
);
// How each article was written (jobs/writing-job.ts, /writing/): new bodies,
// then once a day the roles of bare poster names.
await queue.upsertJobScheduler(
  'writing-signals',
  { every: Number(process.env.WRITING_MINUTES || 10) * 60e3 },
  { name: 'writing', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
);
await queue.upsertJobScheduler(
  'writing-people-daily',
  { pattern: process.env.WRITING_PEOPLE_CRON || '25 3 * * *' },
  { name: 'writing-people', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
await queue.upsertJobScheduler(
  'crawl-health',
  { every: 15 * 60e3 },
  { name: 'crawl-health', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
await queue.upsertJobScheduler(
  'media-traffic-daily',
  { pattern: process.env.MEDIA_TRAFFIC_CRON || '35 * * * *' },
  { name: 'media-traffic', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
// Every 6 hours so yesterday is read several times (busy sites fill a news sitemap's 1,000 URLs in under two days).
await queue.upsertJobScheduler(
  'media-output',
  { pattern: process.env.MEDIA_OUTPUT_CRON || '50 */6 * * *' },
  { name: 'media-output', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
if (radarConfigured()) {
  await queue.upsertJobScheduler(
    'media-radar-daily',
    // traffic.observe.tw runs Radar from 03:35 (Taipei) for ~1000 domains, so mirror after it is done.
    { pattern: process.env.MEDIA_RADAR_CRON || (process.env.TAG_TRAFFIC_SERVICE_URL ? '15 5 * * *' : '45 3 * * *') },
    { name: 'media-radar', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
  );
} else await queue.removeJobScheduler('media-radar-daily');

await queue.upsertJobScheduler(
  'retention-daily',
  { pattern: process.env.RETENTION_CRON || '15 4 * * *' },
  { name: 'retention', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
// Sketch avatars for new person tags; capped at a few minutes (jobs/tag-avatars-job.ts).
await queue.upsertJobScheduler(
  'tag-avatars-daily',
  { pattern: process.env.TAG_AVATARS_CRON || '40 4 * * *' },
  { name: 'tag-avatars', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
// Every hour, the home cloud's new rising words: sketches first, then the other
// tags' pictures, so a word that just started rising is drawn within the hour.
await queue.upsertJobScheduler(
  'tag-avatars-hourly',
  { pattern: process.env.TAG_AVATARS_HOURLY_CRON || '20 * * * *' },
  { name: 'tag-avatars', data: { rising: true }, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
await queue.upsertJobScheduler(
  'tag-visuals-hourly',
  { pattern: process.env.TAG_VISUALS_HOURLY_CRON || '27 * * * *' },
  { name: 'tag-visuals', data: { rising: true }, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
// Tag groups after the avatars, which match new person tags first (jobs/tag-groups-job.ts).
await queue.upsertJobScheduler(
  'tag-groups-daily',
  { pattern: process.env.TAG_GROUPS_CRON || '55 4 * * *' },
  { name: 'tag-groups', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
// Pictures for non-person tags, after tag groups looked up their Wikidata items (jobs/tag-visuals-job.ts).
await queue.upsertJobScheduler(
  'tag-visuals-daily',
  { pattern: process.env.TAG_VISUALS_CRON || '10 5 * * *' },
  { name: 'tag-visuals', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
// Each outlet's robots.txt, recorded for /admin/media/ (not obeyed).
await queue.upsertJobScheduler(
  'robots-daily',
  { pattern: process.env.ROBOTS_CRON || '40 4 * * *' },
  { name: 'robots', data: {}, opts: { removeOnComplete: 10, removeOnFail: 10 } },
);
await queue.upsertJobScheduler(
  'source-probe-weekly',
  { pattern: process.env.PROBE_CRON || '30 5 * * 1' },
  { name: 'source-probe', data: {}, opts: { removeOnComplete: 10, removeOnFail: 10 } },
);

// Generated crawl rules (docs/generated-crawl-rules.md) on their own queue:
// one generation can take many minutes and must not hold a crawl slot.
const aiQueue = new Queue('tag-ai-jobs', { connection });
if (process.env.TAG_AI_RULES_ENABLED === '1')
  await aiQueue.upsertJobScheduler(
    'crawl-rules-every',
    { every: Number(process.env.TAG_AI_RULES_MINUTES || 30) * 60e3 },
    { name: 'crawl-rules', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );
else await aiQueue.removeJobScheduler('crawl-rules-every');

// GA4 / Search Console aggregates for /observe/ hourly, GA Realtime every few
// minutes; skipped where the read-only service account is not configured (docs/analytics.md).
const google = googleConfigFromEnv();
await queue.removeJobScheduler('analytics-daily');
if (google) {
  await queue.upsertJobScheduler(
    'analytics-hourly',
    { pattern: process.env.ANALYTICS_CRON || '20 * * * *' },
    { name: 'analytics', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
  );
  await queue.upsertJobScheduler(
    'analytics-live',
    { every: Number(process.env.ANALYTICS_LIVE_MINUTES || 2) * 60e3 },
    { name: 'analytics-live', data: {}, opts: { removeOnComplete: 10, removeOnFail: 10 } },
  );
} else for (const id of ['analytics-hourly', 'analytics-live']) await queue.removeJobScheduler(id);

// Export zero-valued series from startup so the alert queries have data after a restart,
// instead of going NoData until the first job of each kind completes.
for (const job of [
  'ranking',
  'events',
  'retention',
  'tag-avatars',
  'tag-avatar-photo',
  'tag-groups',
  'tag-visuals',
  'source-probe',
  'robots',
  'analytics',
  'analytics-live',
  'crawl-health',
  'media-traffic',
  'media-radar',
  'media-output',
  'topics',
  'tag-stats',
  'tag-history',
  'similarity',
  'writing',
  'writing-people',
  'crawl-index',
  'crawl-articles',
  'crawl-media',
  'crawl-rules',
])
  for (const status of ['ok', 'failed']) jobRunsMetric.inc({ job, status }, 0);

const worker = new Worker(
  'tag-jobs',
  async (job) => {
    const end = jobDuration.startTimer({ job: job.name });
    try {
      if (job.name === 'ranking') {
        const result = await runRankingJob({ db, log: (o, m) => log.info(o, m) });
        for (const [category, r] of Object.entries(result.results)) {
          snapshotAge.set({ category }, 0);
          snapshotArticles.set({ category }, r.articles);
        }
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        log.info({ job: job.name, ...result, results: undefined, categories: Object.keys(result.results).length }, 'ranking job finished');
        return result;
      }
      if (job.name === 'events') {
        const r = await runEventsJob({ db, log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'retention') {
        const r = await runRetentionJob(db, {
          archiveStore: archiveStoreFromEnv(),
          contentBatch: Number(process.env.TAG_CONTENT_ARCHIVE_BATCH ?? 5000),
          log: (o, m) => log.info(o, m),
        });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      // An admin's photo for a person tag (docs/tag-avatars.md), from /admin/avatars/.
      if (job.name === 'tag-avatar-photo') {
        const r = await runTagAvatarsInChild({
          signal: shutdown.signal,
          photo: job.data as { tag: string; image: string; email: string; userId?: number },
        });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        // The photo itself is not kept with the finished job.
        await job.updateData({ ...(job.data as object), image: null });
        return r;
      }
      if (job.name === 'tag-avatars') {
        const r = await runTagAvatarsInChild({ signal: shutdown.signal, rising: !!job.data?.rising });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'tag-groups') {
        const r = await runTagGroupsJob(db, { log: (o, m) => log.warn(o, m), signal: shutdown.signal });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'tag-visuals') {
        const r = await runTagVisualsJob(db, {
          log: (o, m) => log.warn(o, m),
          signal: shutdown.signal,
          ...(job.data?.rising ? { risingOnly: true, budgetMs: 4 * 60e3 } : {}),
        });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'source-probe') {
        const r = await runProbeJob(db, { log: (o, m) => log.info(o, m), warn: (o, m) => log.warn(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'analytics') {
        if (!google) throw Error('Google analytics access is not configured');
        const r = await runAnalyticsJob(db, google, { log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'analytics-live') {
        if (!google) throw Error('Google analytics access is not configured');
        const r = await runRealtimeJob(db, google);
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'crawl-health') return runCrawlHealthJob(db, { log: (o, m) => log.info(o, m) });
      if (job.name === 'media-traffic') {
        const r = await runMediaTrafficJob(undefined, db);
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'media-output') {
        const r = await runMediaOutputJob(db);
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'media-radar') {
        const r = await runMediaRadarJob(undefined, db);
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'topics') {
        const r = await runTopicsJob(db, { log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'tag-stats') {
        const r = await runTagStatsJob(db, { log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'tag-history') {
        const r = await runTagHistoryJob(db, { log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'similarity') {
        const r = await runSimilarityJob(db, { log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'writing') {
        const r = await runWritingJob(db, { log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'writing-people') {
        const r = await runWritingPeopleJob(db, { log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'robots') {
        const r = await runRobotsJob(db, { log: (o, m) => log.warn(o, m), signal: shutdown.signal });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        log.info({ job: job.name, ...r }, 'robots job finished');
        return r;
      }
      if (job.name === 'crawl-index') {
        const r = await crawlGroup(db, job.data.group, { log, signal: shutdown.signal });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        log.info({ job: job.name, ...r }, 'crawl index group finished');
        return r;
      }
      if (job.name === 'crawl-articles') {
        const r = await crawlArticles(db, { log, signal: shutdown.signal });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        log.info({ job: job.name, ...r }, 'crawl articles finished');
        return r;
      }
      if (job.name === 'crawl-media') {
        const r = await crawlMedia(db, job.data, { log, signal: shutdown.signal });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        log.info({ job: job.name, ...r, errors: r.errors?.length }, 'crawl media finished');
        return r;
      }
      throw Error('Unknown job ' + job.name);
    } catch (error) {
      jobRunsMetric.inc({ job: job.name, status: 'failed' });
      log.error({ job: job.name, err: (error as Error).message }, 'job failed');
      throw error;
    } finally {
      end();
    }
  },
  { connection, concurrency: 2, lockDuration: 900e3 },
);
worker.on('ready', () => log.info({ redis: redisUrl, intervalMinutes }, 'worker ready'));
const aiWorker = new Worker(
  'tag-ai-jobs',
  async (job) => {
    const end = jobDuration.startTimer({ job: job.name });
    try {
      if (job.name !== 'crawl-rules') throw Error('Unknown job ' + job.name);
      const r = await runCrawlRulesJob(db, { log: (o, m) => log.info(o, m), signal: shutdown.signal });
      jobRunsMetric.inc({ job: job.name, status: 'ok' });
      log.info({ job: job.name, ...r }, 'crawl rules job finished');
      return r;
    } catch (error) {
      jobRunsMetric.inc({ job: job.name, status: 'failed' });
      log.error({ job: job.name, err: (error as Error).message }, 'job failed');
      throw error;
    } finally {
      end();
    }
  },
  { connection, concurrency: 1, lockDuration: 1800e3 },
);

const metricsPort = Number(process.env.WORKER_METRICS_PORT || 18133);
const server = createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('content-type', metricsContentType);
    res.end(await metricsText());
    return;
  }
  if (req.url === '/health') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', legacyOwnershipPolicy: LEGACY_OWNERSHIP_POLICY }));
    return;
  }
  res.statusCode = 404;
  res.end();
}).listen(metricsPort, '127.0.0.1');

let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    shutdown.abort();
    log.info({ signal }, 'worker stopping; crawl jobs finish in-flight sources only');
    const deadline = setTimeout(() => {
      log.error('worker shutdown deadline reached; exiting with active jobs');
      process.exit(1);
    }, 40000).unref();
    await Promise.all([worker.close(), aiWorker.close()]);
    labels.stop();
    generatedRules.stop();
    await queue.close();
    await aiQueue.close();
    await connection.quit();

    await closeDb();
    server.close();
    clearTimeout(deadline);
  });
