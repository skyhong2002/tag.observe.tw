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
  /** Last failed attempt per domain, so domains without Similarweb data rotate to the back. */
  failedAt?: Record<string, string>;
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
/**
 * CloudFront answers 403 unless the request looks like the extension's own call:
 * a browser user agent plus the extension origin and version headers (verified 2026-10-10).
 */
export const extensionHeaders = {
  accept: 'application/json',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  origin: 'chrome-extension://hoklmmgfnpapgjgcpechhaamimifchmp',
  'x-extension-version': '6.12.0',
};
/** The public endpoint used by the Similarweb extension. No account cookies. */
export async function fetchDomainTraffic(domain: string, request = fetch, now = new Date()): Promise<DomainTraffic> {
  if (trafficDomain(domain) !== domain) throw Error('Invalid domain');
  const response = await request(`https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(domain)}`, {
    headers: extensionHeaders,
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
const day = 24 * 60 * 60_000;
/**
 * Similarweb rate-limits bursts (403 after ~20 requests), so each run only fetches what is due:
 * domains never fetched first, then the oldest; fresh successes and recent misses are skipped.
 * Frequent scheduled runs fill the whole list gradually instead of one large daily burst.
 */
export function dueDomains(domains: string[], previous: LiveTraffic, now = new Date(), freshDays = 7) {
  const fetched = new Map(previous.domains.map((row) => [row.domain, Date.parse(row.fetchedAt)]));
  const failed = previous.failedAt ?? {};
  const last = (domain: string) => Math.max(fetched.get(domain) ?? 0, Date.parse(failed[domain] ?? '') || 0);
  return [...new Set(domains)]
    .filter(
      (domain) =>
        now.getTime() - (fetched.get(domain) ?? 0) >= freshDays * day && now.getTime() - (Date.parse(failed[domain] ?? '') || 0) >= day,
    )
    .sort((a, b) => last(a) - last(b));
}
export async function refreshTraffic(
  domains: string[],
  previous: LiveTraffic,
  {
    request = fetch,
    now = new Date(),
    pauseMs = 3000,
    delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = {},
): Promise<LiveTraffic & { updated: number; remaining: number }> {
  const entries = new Map(previous.domains.map((row) => [row.domain, row]));
  const failedAt = { ...previous.failedAt };
  let successes = 0;
  let failures = 0;
  let blocked = false;
  let error: string | null = null;
  let consecutiveFailures = 0;
  const deadline = Date.now() + 5 * 60_000;
  const due = dueDomains(domains, previous, now);
  let attempted = 0;
  for (const [index, domain] of due.entries()) {
    if (Date.now() >= deadline) {
      error = 'Similarweb batch time limit reached';
      break;
    }
    attempted++;
    try {
      entries.set(domain, await fetchDomainTraffic(domain, request, now));
      delete failedAt[domain];
      successes++;
      consecutiveFailures = 0;
    } catch (failure) {
      // Stop a denied/rate-limited batch instead of hammering the provider; the next run resumes here.
      if (failure instanceof TrafficFetchError && [401, 403, 429].includes(failure.status)) {
        attempted--;
        blocked = true;
        error = failure.message;
        break;
      }
      failures++;
      failedAt[domain] = now.toISOString();
      error = failure instanceof TrafficFetchError ? failure.message : 'Similarweb data unavailable or invalid';
      // Missing data for one small site is normal; repeated HTTP/network errors mean the provider is down.
      if (failure instanceof TrafficFetchError || !(failure instanceof Error) || failure.name !== 'Error') consecutiveFailures++;
      if (consecutiveFailures >= 3) break;
    }
    if (index < due.length - 1) await delay(pauseMs);
  }
  return {
    ...previous,
    checkedAt: now.toISOString(),
    status: blocked ? 'blocked' : failures ? (successes ? 'partial' : 'failed') : 'ok',
    error: blocked || failures ? error : null,
    domains: [...entries.values()],
    failedAt,
    updated: successes,
    remaining: due.length - attempted,
  };
}
