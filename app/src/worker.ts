import { createServer } from 'node:http';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { googleConfigFromEnv } from './analytics/google.ts';
import { createDb } from './db/client.ts';
import { runAnalyticsJob, runRealtimeJob } from './jobs/analytics-job.ts';
import { runCrawlHealthJob } from './jobs/crawl-health-job.ts';
import { crawlArticles, crawlGroup } from './jobs/crawl-job.ts';
import { runEventsJob } from './jobs/events-job.ts';
import { runProbeJob } from './jobs/probe-job.ts';
import { runRankingJob } from './jobs/ranking-job.ts';
import { runRetentionJob } from './jobs/retention-job.ts';
import { runSimilarityJob } from './jobs/similarity-job.ts';
import { runTagStatsJob } from './jobs/tag-stats-job.ts';
import { runTopicsJob } from './jobs/topics-job.ts';
import { LEGACY_OWNERSHIP_POLICY } from './legacy/ownership-policy.ts';
import { jobDuration, jobRuns as jobRunsMetric, metricsContentType, metricsText, snapshotAge, snapshotArticles } from './metrics.ts';
import { archiveStoreFromEnv } from './nearline/store.ts';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:16379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const { db, close: closeDb } = createDb();
const queue = new Queue('tag-jobs', { connection });
const intervalMinutes = Number(process.env.RANKING_INTERVAL_MINUTES || 10);
await queue.upsertJobScheduler(
  'ranking-every',
  { every: intervalMinutes * 60e3 },
  { name: 'ranking', data: {}, opts: { removeOnComplete: 100, removeOnFail: 100 } },
);

const crawlEnabled = process.env.CRAWL_ENABLED !== '0';
if (crawlEnabled) {
  await queue.upsertJobScheduler(
    'crawl-news',
    { every: Number(process.env.CRAWL_NEWS_MINUTES || 9) * 60e3 },
    { name: 'crawl-index', data: { group: 'news' }, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );
  await queue.upsertJobScheduler(
    'crawl-hourly',
    { every: Number(process.env.CRAWL_HOURLY_MINUTES || 60) * 60e3 },
    { name: 'crawl-index', data: { group: 'hourly' }, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );
  await queue.upsertJobScheduler(
    'crawl-articles',
    { every: Number(process.env.CRAWL_ARTICLES_MINUTES || 19) * 60e3 },
    { name: 'crawl-articles', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );
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
// Compare newly fetched bodies with every other outlet's articles (jobs/similarity-job.ts).
await queue.upsertJobScheduler(
  'similarity-index',
  { every: Number(process.env.SIMILARITY_INDEX_MINUTES || 10) * 60e3 },
  { name: 'similarity', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
);
await queue.upsertJobScheduler(
  'crawl-health',
  { every: 15 * 60e3 },
  { name: 'crawl-health', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);

await queue.upsertJobScheduler(
  'retention-daily',
  { pattern: process.env.RETENTION_CRON || '15 4 * * *' },
  { name: 'retention', data: {}, opts: { removeOnComplete: 20, removeOnFail: 20 } },
);
await queue.upsertJobScheduler(
  'source-probe-weekly',
  { pattern: process.env.PROBE_CRON || '30 5 * * 1' },
  { name: 'source-probe', data: {}, opts: { removeOnComplete: 10, removeOnFail: 10 } },
);

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
  'source-probe',
  'analytics',
  'analytics-live',
  'crawl-health',
  'topics',
  'tag-stats',
  'similarity',
  'crawl-index',
  'crawl-articles',
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
      if (job.name === 'similarity') {
        const r = await runSimilarityJob(db, { log: (o, m) => log.info(o, m) });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        return r;
      }
      if (job.name === 'crawl-index') {
        const r = await crawlGroup(db, job.data.group, { log });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        log.info({ job: job.name, ...r }, 'crawl index group finished');
        return r;
      }
      if (job.name === 'crawl-articles') {
        const r = await crawlArticles(db, { log });
        jobRunsMetric.inc({ job: job.name, status: 'ok' });
        log.info({ job: job.name, ...r }, 'crawl articles finished');
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
    const deadline = setTimeout(() => process.exit(1), 15000).unref();
    await worker.close();
    await queue.close();
    await connection.quit();

    await closeDb();
    server.close();
    clearTimeout(deadline);
  });
