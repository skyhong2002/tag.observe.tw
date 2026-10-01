import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });
export const httpRequests = new Counter({
  name: 'tag_http_requests_total',
  help: 'HTTP requests by route outcome',
  labelNames: ['route', 'outcome'] as const,
  registers: [registry],
});
export const httpDuration = new Histogram({
  name: 'tag_http_request_seconds',
  help: 'HTTP request duration',
  labelNames: ['route', 'outcome'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8],
  registers: [registry],
});
export const sourceQueries = new Counter({
  name: 'tag_source_queries_total',
  help: 'Legacy source reads',
  labelNames: ['transport', 'result'] as const,
  registers: [registry],
});
export const jobRuns = new Counter({
  name: 'tag_job_runs_total',
  help: 'Background job runs',
  labelNames: ['job', 'status'] as const,
  registers: [registry],
});
export const jobDuration = new Histogram({
  name: 'tag_job_seconds',
  help: 'Background job duration',
  labelNames: ['job'] as const,
  buckets: [1, 5, 15, 30, 60, 120, 300],
  registers: [registry],
});
export const snapshotAge = new Gauge({
  name: 'tag_ranking_snapshot_age_seconds',
  help: 'Age of newest ranking snapshot',
  labelNames: ['category'] as const,
  registers: [registry],
});
export const snapshotArticles = new Gauge({
  name: 'tag_ranking_articles',
  help: 'Articles in newest ranking snapshot',
  labelNames: ['category'] as const,
  registers: [registry],
});

export async function metricsText() {
  return registry.metrics();
}
export const metricsContentType = registry.contentType;
