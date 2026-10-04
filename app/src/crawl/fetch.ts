import { execFile } from 'node:child_process';
import { lookup as dnsLookup } from 'node:dns/promises';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { BlockList, isIP } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import iconv from 'iconv-lite';
import { Agent, fetch as undiciFetch } from 'undici';

export const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
export interface FetchResult {
  url: string;
  status: number;
  body: string;
  contentType: string;
  ms: number;
}

// --- SSRF guard -------------------------------------------------------------
// Crawled feeds and sitemaps decide which URLs we fetch next, so every hop
// (including redirects) must resolve only to public addresses, and the socket
// is pinned to the address we checked so DNS rebinding cannot swap it.
const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['64:ff9b::', 96],
] as const)
  blocked.addSubnet(net, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (!version) return false;
  const mapped = version === 6 ? /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address) : null;
  if (mapped) return isPublicAddress(mapped[1]);
  return !blocked.check(address, version === 4 ? 'ipv4' : 'ipv6');
}

export class BlockedUrlError extends Error {
  code = 'EBLOCKED';
}

type Address = { address: string; family: number };
// Every address the name resolves to, all checked public. Multi-address
// publishers (guancha.cn: 15 A records) can have dead members; pinning only
// the first one turned DNS rotation into random timeouts.
export async function resolvePublicAll(url: URL, lookup = dnsLookup): Promise<Address[]> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BlockedUrlError(`Blocked protocol ${url.protocol}`);
  if (url.username || url.password) throw new BlockedUrlError('Blocked credentials in URL');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const literal = isIP(host);
  if (literal) {
    if (!isPublicAddress(host)) throw new BlockedUrlError(`Blocked non-public address ${host}`);
    return [{ address: host, family: literal }];
  }
  if (/(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/i.test(host))
    throw new BlockedUrlError(`Blocked internal hostname ${host}`);
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new BlockedUrlError(`No address for ${host}`);
  const bad = addresses.find((a) => !isPublicAddress(a.address));
  if (bad) throw new BlockedUrlError(`Blocked ${host} -> non-public ${bad.address}`);
  return addresses;
}
export async function resolvePublic(url: URL, lookup = dnsLookup): Promise<Address> {
  return (await resolvePublicAll(url, lookup))[0];
}

type LookupCallback = (err: Error | null, address: string | Address[], family?: number) => void;
export function pinnedAgent(targets: Address[], connectTimeout?: number) {
  // TLS SNI and Host still use the URL hostname; only the socket targets are
  // pinned. Node's autoSelectFamily walks the list, moving on from an address
  // that has not connected within 2 s (one SYN retransmit), so a dead member
  // costs one attempt instead of the whole request timeout.
  const [first] = targets;
  return new Agent({
    connect: {
      autoSelectFamily: true,
      autoSelectFamilyAttemptTimeout: 2000,
      ...(connectTimeout ? { timeout: connectTimeout } : {}),
      lookup: (_host: string, options: { all?: boolean }, callback: LookupCallback) =>
        options?.all ? callback(null, targets) : callback(null, first.address, first.family),
    },
  });
}

// Connect-phase failures, before any request bytes were sent: an unreachable
// member of an address pool, or one that accepts TCP but stalls the TLS
// handshake (both seen on guancha.cn). Resets are not here: they can mean
// rate limiting and are not retried.
const CONNECT_FAILURES = new Set(['UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH']);
export function isConnectFailure(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string; errors?: Array<{ code?: string }> } } | null)?.cause;
  if (!cause) return false;
  if (CONNECT_FAILURES.has(cause.code ?? '')) return true;
  return !!cause.errors?.length && cause.errors.every((e) => CONNECT_FAILURES.has(e.code ?? ''));
}

// The abort signal does not interrupt a connect in progress (undici waits for
// its own 10 s connect timeout), so the connect timeout is capped by the time
// left. With several addresses, each pass gets at most 4 s to connect
// (TCP + TLS) and the next pass starts from a later address; at most three
// passes, all within the request's own deadline.
async function openPinned(
  url: URL,
  targets: Address[],
  { timeoutAt, ...init }: Parameters<typeof undiciFetch>[1] & { signal: AbortSignal; timeoutAt: number },
) {
  const passes = Math.min(targets.length, 3);
  for (let pass = 0; ; pass++) {
    const left = Math.max(1, Math.round(timeoutAt - performance.now()));
    const dispatcher = pinnedAgent([...targets.slice(pass), ...targets.slice(0, pass)], targets.length > 1 ? Math.min(4000, left) : left);
    try {
      return { res: await undiciFetch(url, { ...init, dispatcher }), dispatcher };
    } catch (error) {
      await dispatcher.close().catch(() => {});
      if (pass + 1 < passes && !init.signal.aborted && isConnectFailure(error)) continue;
      throw error;
    }
  }
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_HOPS = 5;
const HEADERS = (userAgent: string) => ({
  'user-agent': userAgent,
  accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/json;q=0.9,*/*;q=0.8',
  'accept-language': 'zh-TW,zh;q=0.9,en;q=0.5',
});

function decodeBody(input: Buffer, contentType: string): string {
  // Some sitemaps are served gzip-compressed without content-encoding (.gz).
  const buffer = input.length > 2 && input[0] === 0x1f && input[1] === 0x8b ? gunzipSync(input) : input;
  const declared = /charset=([\w-]+)/i.exec(contentType)?.[1];
  const head = buffer.subarray(0, 4096).toString('latin1');
  const sniffed = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? /<\?xml[^>]+encoding=["']([\w-]+)/i.exec(head)?.[1];
  const charset = (declared ?? sniffed ?? 'utf-8').toLowerCase();
  if (charset === 'utf-8' || charset === 'utf8') return buffer.toString('utf8');
  return iconv.encodingExists(charset) ? iconv.decode(buffer, charset) : buffer.toString('utf8');
}

// Some CDNs (Cloudflare "Just a moment") reject Node's TLS fingerprint but
// accept curl's, as the legacy PHP crawlers did. Fall back to curl on 403.
// Redirects are followed here hop by hop with the same public-address check,
// and each hop is pinned with --resolve.
const execFileAsync = promisify(execFile);
// curl exits for a connection the server dropped or garbled before any HTTP
// status (1: HTTP/0.9 reply, 35: TLS, 52: empty reply, 55/56: send/recv reset).
// Timeouts (28), DNS and address-guard failures are never retried.
const CURL_CONNECTION_FAILURES = new Set([1, 35, 52, 55, 56]);
export async function fetchViaCurl(
  url: string,
  { retries = 0, ...options }: { userAgent?: string; timeout?: number; maxBytes?: number; retries?: number } = {},
): Promise<FetchResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await curlOnce(url, options);
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      if (attempt >= Math.min(retries, 2) || typeof code !== 'number' || !CURL_CONNECTION_FAILURES.has(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
async function curlOnce(
  url: string,
  { userAgent = DEFAULT_UA, timeout = 20000, maxBytes = 8 * 1024 * 1024 }: { userAgent?: string; timeout?: number; maxBytes?: number },
): Promise<FetchResult> {
  const dir = await mkdtemp(join(tmpdir(), 'tag-crawl-'));
  const file = join(dir, 'body');
  const started = performance.now();
  try {
    let current = new URL(url);
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const targets = await resolvePublicAll(current);
      const port = current.port || (current.protocol === 'https:' ? '443' : '80');
      // curl tries each pinned address in turn.
      const pinned = targets.map(({ address }) => (isIP(address) === 6 ? `[${address}]` : address)).join(',');
      const { stdout } = await execFileAsync(
        'curl',
        [
          '-s',
          '--compressed',
          '--proto',
          '=http,https',
          '--resolve',
          `${current.hostname}:${port}:${pinned}`,
          '-A',
          userAgent,
          '-H',
          'accept-language: zh-TW,zh;q=0.9,en;q=0.5',
          '--max-time',
          String(Math.ceil(timeout / 1000)),
          '--max-filesize',
          String(maxBytes),
          '-o',
          file,
          '-w',
          '%{http_code}\t%{content_type}\t%{redirect_url}',
          current.toString(),
        ],
        { timeout: timeout + 5000, maxBuffer: 1024 * 1024 },
      );
      const [statusText, contentType = '', redirect = ''] = stdout.split('\t');
      const status = Number(statusText) || 0;
      if (REDIRECTS.has(status) && redirect) {
        current = new URL(redirect, current);
        continue;
      }
      const raw = await readFile(file).catch(() => Buffer.alloc(0));
      return {
        url: current.toString(),
        status,
        body: decodeBody(raw, contentType),
        contentType,
        ms: Math.round(performance.now() - started),
      };
    }
    throw new BlockedUrlError(`Too many redirects from ${url}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const looksChallenged = (r: FetchResult) =>
  r.status === 403 && /just a moment|cf-chl|challenge-platform|cloudflare/i.test(r.body.slice(0, 4000));

// Cookies set during one request's redirect chain (e.g. bnextmedia's SSO
// bounce: shoppingdesign → sn-myalb.bnextmedia.com.tw → back, which loops
// forever without them). Scoped by Domain attribute or exact host; nothing
// persists beyond the call.
type Jar = Array<{ name: string; value: string; domain: string; hostOnly: boolean }>;
export function storeCookies(jar: Jar, host: string, setCookies: string[]) {
  for (const line of setCookies) {
    const [pair, ...attrs] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const domainAttr = attrs
      .map((a) => a.trim())
      .find((a) => /^domain=/i.test(a))
      ?.slice(7)
      .replace(/^\./, '')
      .toLowerCase();
    // A Domain attribute must cover the setting host.
    const domain = domainAttr && (host === domainAttr || host.endsWith(`.${domainAttr}`)) ? domainAttr : host;
    const i = jar.findIndex((c) => c.name === name && c.domain === domain);
    const cookie = { name, value: pair.slice(eq + 1).trim(), domain, hostOnly: domain === host && !domainAttr };
    if (i >= 0) jar[i] = cookie;
    else jar.push(cookie);
  }
}
export function cookieHeader(jar: Jar, host: string): string {
  return jar
    .filter((c) => (c.hostOnly ? host === c.domain : host === c.domain || host.endsWith(`.${c.domain}`)))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

export interface FetchRequest {
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
}

async function fetchOnce(
  url: string,
  { userAgent, timeout, maxBytes, method = 'GET', body, headers }: { userAgent: string; timeout: number; maxBytes: number } & FetchRequest,
): Promise<FetchResult> {
  const started = performance.now();
  const deadline = AbortSignal.timeout(timeout);
  let current = new URL(url);
  const jar: Jar = [];
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const host = current.hostname.toLowerCase();
    const cookie = cookieHeader(jar, host);
    const { res, dispatcher } = await openPinned(current, await resolvePublicAll(current), {
      method,
      body: method === 'GET' ? undefined : body,
      redirect: 'manual',
      signal: deadline,
      headers: { ...HEADERS(userAgent), ...headers, ...(cookie ? { cookie } : {}) },
      timeoutAt: started + timeout,
    });
    try {
      storeCookies(jar, host, res.headers.getSetCookie());
      const location = res.headers.get('location');
      if (REDIRECTS.has(res.status) && location) {
        await res.body?.cancel();
        current = new URL(location, current);
        // As browsers do: only 307/308 repeat a POST, the others turn into a GET.
        if (res.status !== 307 && res.status !== 308) [method, body] = ['GET', undefined];
        continue;
      }
      const length = Number(res.headers.get('content-length') ?? 0);
      if (length > maxBytes) {
        await res.body?.cancel();
        throw Error('response too large');
      }
      const raw = Buffer.from(await res.arrayBuffer());
      if (raw.length > maxBytes) throw Error('response too large');
      const contentType = res.headers.get('content-type') ?? '';
      return {
        url: current.toString(),
        status: res.status,
        body: decodeBody(raw, contentType),
        contentType,
        ms: Math.round(performance.now() - started),
      };
    } finally {
      await dispatcher.close().catch(() => {});
    }
  }
  throw new BlockedUrlError(`Too many redirects from ${url}`);
}

export async function fetchText(
  url: string,
  {
    userAgent = DEFAULT_UA,
    timeout = 20000,
    maxBytes = 8 * 1024 * 1024,
    retries = 1,
    method,
    body,
    headers,
  }: { userAgent?: string; timeout?: number; maxBytes?: number; retries?: number } & FetchRequest = {},
): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fetchOnce(url, { userAgent, timeout, maxBytes, method, body, headers });
      // The curl fallback only replays plain GETs.
      return looksChallenged(result) && (method ?? 'GET') === 'GET' ? fetchViaCurl(url, { userAgent, timeout, maxBytes }) : result;
    } catch (error) {
      // A blocked destination will not become public on retry.
      if (error instanceof BlockedUrlError) throw error;
      lastError = error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}
