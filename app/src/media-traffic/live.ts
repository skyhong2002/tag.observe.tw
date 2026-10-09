import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface VisitMonth {
  month: string;
  visits: number;
}
export interface DomainTraffic {
  domain: string;
  fetchedAt: string;
  monthly: VisitMonth[];
}
export interface LiveTraffic {
  version: 1;
  source: 'similarweb-extension';
  checkedAt: string | null;
  status: 'pending' | 'ok' | 'partial' | 'blocked' | 'failed';
  error: string | null;
  domains: DomainTraffic[];
}
export const emptyTraffic = (): LiveTraffic => ({
  version: 1,
  source: 'similarweb-extension',
  checkedAt: null,
  status: 'pending',
  error: null,
  domains: [],
});
export const trafficFile = () => process.env.TAG_MEDIA_TRAFFIC_FILE || join(homedir(), '.local/share/tag-analysis/media-traffic-live.json');
export function trafficDomain(raw: string): string | null {
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(host)
      ? host
      : null;
  } catch {
    return null;
  }
}
export async function readLiveTraffic(file = trafficFile()): Promise<LiveTraffic> {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.version !== 1 || data.source !== 'similarweb-extension' || !Array.isArray(data.domains))
      throw Error('Invalid traffic snapshot');
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyTraffic();
    throw error;
  }
}
export async function writeLiveTraffic(data: LiveTraffic, file = trafficFile()) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
}
export class TrafficFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
/** The public endpoint used by the Similarweb extension. No account cookies. */
export async function fetchDomainTraffic(domain: string, request = fetch, now = new Date()): Promise<DomainTraffic> {
  if (trafficDomain(domain) !== domain) throw Error('Invalid domain');
  const response = await request(`https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(domain)}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  if (!response.ok) throw new TrafficFetchError(response.status, `Similarweb HTTP ${response.status}`);
  const data = await response.json();
  if (typeof data.SiteName !== 'string' || trafficDomain(data.SiteName) !== domain) throw Error('Similarweb returned a different domain');
  if (!data.EstimatedMonthlyVisits || typeof data.EstimatedMonthlyVisits !== 'object' || Array.isArray(data.EstimatedMonthlyVisits))
    throw Error('Similarweb monthly visits missing');
  const months = new Map<string, number>();
  const current = now.toISOString().slice(0, 7).replace('-', '');
  for (const [date, visits] of Object.entries(data.EstimatedMonthlyVisits)) {
    const match = /^(20\d{2})-(0[1-9]|1[0-2])-01(?:T00:00:00(?:\.000)?Z)?$/.exec(date);
    if (!match || typeof visits !== 'number' || !Number.isFinite(visits) || visits < 0) throw Error('Invalid Similarweb monthly visits');
    const month = match[1] + match[2];
    if (month >= current || months.has(month)) throw Error('Invalid or duplicate Similarweb reporting month');
    months.set(month, visits);
  }
  if (!months.size) throw Error('Similarweb has no monthly visits for this domain');
  return {
    domain,
    fetchedAt: now.toISOString(),
    monthly: [...months]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3)
      .map(([month, visits]) => ({ month, visits })),
  };
}
export async function refreshTraffic(
  domains: string[],
  previous: LiveTraffic,
  { request = fetch, now = new Date(), delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) } = {},
): Promise<LiveTraffic> {
  const entries = new Map(previous.domains.map((row) => [row.domain, row]));
  let successes = 0;
  let failures = 0;
  let blocked = false;
  let error: string | null = null;
  let consecutiveFailures = 0;
  const deadline = Date.now() + 5 * 60_000;
  const unique = [...new Set(domains)];
  for (const [index, domain] of unique.entries()) {
    if (Date.now() >= deadline) {
      failures++;
      error = 'Similarweb batch time limit reached';
      break;
    }
    try {
      entries.set(domain, await fetchDomainTraffic(domain, request, now));
      successes++;
      consecutiveFailures = 0;
    } catch (failure) {
      failures++;
      consecutiveFailures++;
      error = failure instanceof TrafficFetchError ? failure.message : 'Similarweb data unavailable or invalid';
      // Stop a denied/rate-limited batch instead of hammering the provider.
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
