import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { TrafficFetchError, trafficDomain } from './live.ts';

export interface RadarDomain {
  domain: string;
  fetchedAt: string;
  dateStart: string;
  dateEnd: string;
  rank: number | null;
  bucket: number | null;
  bucketLowerBound?: number | null;
}
export interface RadarSnapshot {
  version: 1;
  source: 'cloudflare-radar';
  scope: 'global';
  checkedAt: string | null;
  status: 'unconfigured' | 'pending' | 'ok' | 'partial' | 'blocked' | 'failed';
  error: string | null;
  domains: RadarDomain[];
}
export const radarToken = () => process.env.CLOUDFLARE_RADAR_API_TOKEN?.trim();
export const radarFile = () => process.env.TAG_MEDIA_RADAR_FILE || join(homedir(), '.local/share/tag-analysis/media-radar.json');
export const emptyRadar = (): RadarSnapshot => ({
  version: 1,
  source: 'cloudflare-radar',
  scope: 'global',
  checkedAt: null,
  status: radarToken() ? 'pending' : 'unconfigured',
  error: null,
  domains: [],
});
const isTime = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const validDomain = (row: RadarDomain) =>
  trafficDomain(row.domain) === row.domain &&
  isTime(row.fetchedAt) &&
  isTime(row.dateStart) &&
  isTime(row.dateEnd) &&
  Date.parse(row.dateStart) <= Date.parse(row.dateEnd) &&
  (row.rank === null || (positiveInteger(row.rank) && row.rank <= 100)) &&
  (row.bucket === null || positiveInteger(row.bucket)) &&
  (row.bucketLowerBound == null || (positiveInteger(row.bucketLowerBound) && row.bucket === null));

export async function readRadar(file = radarFile()): Promise<RadarSnapshot> {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (
      data.version !== 1 ||
      data.source !== 'cloudflare-radar' ||
      data.scope !== 'global' ||
      !['unconfigured', 'pending', 'ok', 'partial', 'blocked', 'failed'].includes(data.status) ||
      !(data.checkedAt === null || isTime(data.checkedAt)) ||
      !(data.error === null || typeof data.error === 'string') ||
      !Array.isArray(data.domains) ||
      !data.domains.every((row: RadarDomain) => row && validDomain(row))
    )
      throw Error('Invalid Radar snapshot');
    // Configuration reflects this process, while successful previous values survive.
    if (!radarToken()) return { ...data, status: 'unconfigured' };
    if (data.status === 'unconfigured') return { ...data, status: 'pending' };
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyRadar();
    throw error;
  }
}
export async function writeRadar(data: RadarSnapshot, file = radarFile()) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
}

/** Official domain details endpoint: ordered top 100, otherwise ranking buckets. */
export async function fetchRadarDomain(domain: string, token: string, request = fetch, now = new Date()): Promise<RadarDomain> {
  if (trafficDomain(domain) !== domain) throw Error('Invalid domain');
  if (!token.trim()) throw Error('Radar token is not configured');
  const response = await request(
    `https://api.cloudflare.com/client/v4/radar/ranking/domain/${encodeURIComponent(domain)}?rankingType=POPULAR&format=JSON`,
    {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    },
  );
  if (!response.ok) throw new TrafficFetchError(response.status, `Cloudflare Radar HTTP ${response.status}`);
  const data = await response.json();
  if (data.success !== true || !data.result?.details_0) throw Error('Invalid Radar response');
  const details = data.result.details_0;
  const range = data.result.meta?.dateRange?.[0];
  const rank = details.rank ?? null;
  const bucket =
    details.bucket == null
      ? null
      : typeof details.bucket === 'string' && /^\d+$/.test(details.bucket)
        ? Number(details.bucket)
        : typeof details.bucket === 'string' && /^>\d+$/.test(details.bucket)
          ? null
          : NaN;
  const bucketLowerBound = typeof details.bucket === 'string' && /^>\d+$/.test(details.bucket) ? Number(details.bucket.slice(1)) : null;
  const row = {
    domain,
    fetchedAt: now.toISOString(),
    dateStart: range?.startTime,
    dateEnd: range?.endTime,
    rank,
    bucket,
    bucketLowerBound,
  };
  if (!validDomain(row) || Date.parse(row.dateEnd) > now.getTime()) throw Error('Invalid Radar ranking or reporting period');
  return row;
}

export async function refreshRadar(
  domains: string[],
  previous: RadarSnapshot,
  {
    token = radarToken(),
    request = fetch,
    now = new Date(),
    delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = {},
): Promise<RadarSnapshot> {
  if (!token) return { ...previous, status: 'unconfigured', error: null };
  const entries = new Map(previous.domains.map((row) => [row.domain, row]));
  let successes = 0;
  let failures = 0;
  let consecutiveFailures = 0;
  let blocked = false;
  let error: string | null = null;
  const deadline = Date.now() + 5 * 60_000;
  // Missing domains first, then the oldest: a run cut short by the time limit
  // leaves the freshest rows for later, so successive daily runs cover the whole list.
  const fetched = (domain: string) => Date.parse(entries.get(domain)?.fetchedAt ?? '') || 0;
  const unique = [...new Set(domains)].sort((a, b) => fetched(a) - fetched(b));
  for (const [index, domain] of unique.entries()) {
    if (Date.now() >= deadline) {
      failures++;
      error = 'Cloudflare Radar batch time limit reached';
      break;
    }
    try {
      entries.set(domain, await fetchRadarDomain(domain, token, request, now));
      successes++;
      consecutiveFailures = 0;
    } catch (failure) {
      failures++;
      consecutiveFailures++;
      // Do not expose response bodies, request headers or token-bearing errors.
      error = failure instanceof TrafficFetchError ? failure.message : 'Cloudflare Radar data unavailable or invalid';
      if (failure instanceof TrafficFetchError && [401, 403, 429].includes(failure.status)) {
        blocked = true;
        break;
      }
      if (consecutiveFailures >= 3) break;
    }
    if (index < unique.length - 1) await delay(1000);
  }
  return {
    ...previous,
    checkedAt: now.toISOString(),
    status: blocked ? 'blocked' : failures ? (successes ? 'partial' : 'failed') : successes ? 'ok' : 'failed',
    error,
    domains: [...entries.values()],
  };
}
