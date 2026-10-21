import type { DomainTraffic, LiveTraffic } from './live.ts';
import type { RadarDomain, RadarSnapshot } from './radar.ts';

// traffic.observe.tw (its own repo and database, docs/similarweb-requests.md)
// takes over every data.similarweb.com request on this machine once
// TAG_TRAFFIC_SERVICE_URL is set: the media-traffic job then hands it tag's
// outlet list and mirrors back what it has stored, and /internal/similarweb
// forwards blog's lookups there. Unset, tag calls Similarweb itself as before.

export interface TrafficService {
  url: string;
  token: string;
}
export function trafficService(env: Record<string, string | undefined> = process.env): TrafficService | null {
  const url = env.TAG_TRAFFIC_SERVICE_URL?.replace(/\/+$/, '');
  const token = env.TAG_TRAFFIC_SERVICE_TOKEN;
  if (!url || !token) return null;
  // Loopback only: the token must never leave the machine.
  if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(url)) throw Error('TAG_TRAFFIC_SERVICE_URL must be http://127.0.0.1:<port>');
  return { url, token };
}

interface ServiceTraffic {
  lastRun: { startedAt: string; refused: boolean; note: string | null } | null;
  domains: DomainTraffic[];
  state: Record<string, { lastAttemptAt: string | null; lastSuccessAt: string | null; failures: number }>;
}

async function call<T>(service: TrafficService, method: string, path: string, body: unknown, request: typeof fetch): Promise<T> {
  const response = await request(`${service.url}${path}`, {
    method,
    headers: { authorization: `Bearer ${service.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!response.ok) throw Error(`traffic service ${method} ${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Registers tag's outlets (refreshed weekly, as tag did) and returns the
 * service's stored months and profiles as a snapshot in the shape the
 * media-traffic job writes, so pages and history work unchanged.
 */
export async function syncFromService(
  domains: string[],
  previous: LiveTraffic,
  service: TrafficService,
  { request = fetch, now = new Date() }: { request?: typeof fetch; now?: Date } = {},
): Promise<LiveTraffic & { updated: number }> {
  await call(service, 'PUT', '/internal/v1/watch', { domains, refreshDays: 7 }, request);
  const data = await call<ServiceTraffic>(service, 'POST', '/internal/v1/traffic', { domains }, request);
  const before = new Map(previous.domains.map((row) => [row.domain, row.fetchedAt]));
  const failedAt: Record<string, string> = {};
  for (const [domain, s] of Object.entries(data.state)) if (s.failures > 0 && s.lastAttemptAt) failedAt[domain] = s.lastAttemptAt;
  return {
    version: 1,
    source: 'similarweb-extension',
    checkedAt: data.lastRun?.startedAt ?? now.toISOString(),
    status: data.lastRun?.refused ? 'blocked' : 'ok',
    error: data.lastRun?.refused ? data.lastRun.note : null,
    domains: data.domains,
    failedAt,
    updated: data.domains.filter((row) => (before.get(row.domain) ?? '') < row.fetchedAt).length,
  };
}

interface ServiceRadar {
  lastRun: { startedAt: string; finishedAt: string | null; ok: number; failed: number; blocked: boolean; note: string | null } | null;
  domains: Record<string, Array<RadarDomain & { bucketLowerBound: number | null }>>;
}

/**
 * The latest Radar period per outlet from the service (it fetches daily for
 * every watched domain); the snapshot keeps outlets the service has nothing for yet.
 */
export async function syncRadarFromService(
  domains: string[],
  previous: RadarSnapshot,
  service: TrafficService,
  { request = fetch, now = new Date() }: { request?: typeof fetch; now?: Date } = {},
): Promise<RadarSnapshot> {
  const data = await call<ServiceRadar>(service, 'POST', '/internal/v1/radar', { domains }, request);
  const rows = new Map(previous.domains.map((row) => [row.domain, row]));
  for (const periods of Object.values(data.domains)) {
    const latest = periods.at(-1);
    if (latest) {
      const { domain, fetchedAt, dateStart, dateEnd, rank, bucket, bucketLowerBound } = latest;
      rows.set(domain, { domain, fetchedAt, dateStart, dateEnd, rank, bucket, bucketLowerBound });
    }
  }
  const run = data.lastRun;
  return {
    ...previous,
    checkedAt: run?.startedAt ?? now.toISOString(),
    status: run?.blocked ? 'blocked' : rows.size ? (run?.failed ? 'partial' : 'ok') : 'failed',
    error: run?.blocked || run?.failed ? (run.note ?? null) : null,
    domains: [...rows.values()],
  };
}
