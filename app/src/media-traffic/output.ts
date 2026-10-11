import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { gte, sql } from 'drizzle-orm';
import names from '../../data/media-names.json' with { type: 'json' };
import trafficHosts from '../../data/media-traffic-hosts.json' with { type: 'json' };
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import { parseFeed } from '../crawl/feed.ts';
import { fetchText } from '../crawl/fetch.ts';
import { excludedMedia } from '../crawl/registry.ts';
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';
import { trafficDomain } from './live.ts';

/**
 * How much each outlet publishes on the host its traffic is measured on, so
 * visits per article divide like by like. Two counts, both lower bounds:
 * - its Google News sitemap: articles per Taipei day by <news:publication_date>
 *   (Google caps such a sitemap at 1,000 URLs and two days, so busy sites can be cut short);
 * - our own collection over the past 7 days, split by whether the article URL
 *   is on that host (an outlet we read through LINE TODAY or YouTube is not).
 */
export interface MediaOutput {
  media: string;
  host: string;
  /** News sitemaps read on the last successful check. */
  sitemaps: string[];
  /** Taipei date → articles published that day per the sitemaps; a day is only stored once it is over. */
  days: Record<string, number>;
  /** A sitemap held Google's 1,000-URL maximum: its days may be undercounted. */
  capped: boolean;
  /** Our articles over the past 7 days, and how many of them are on `host` or its subdomains. */
  articles7d: number;
  onHost7d: number;
  checkedAt: string;
}
export interface OutputSnapshot {
  version: 1;
  checkedAt: string | null;
  status: 'pending' | 'ok' | 'partial' | 'failed';
  error: string | null;
  media: MediaOutput[];
}
export const outputFile = () => process.env.TAG_MEDIA_OUTPUT_FILE || join(homedir(), '.local/share/tag-analysis/media-output.json');
export const emptyOutput = (): OutputSnapshot => ({ version: 1, checkedAt: null, status: 'pending', error: null, media: [] });
const KEEP_DAYS = 21;
const SITEMAP_CAP = 1000;

export async function readOutput(file = outputFile()): Promise<OutputSnapshot> {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.version !== 1 || !Array.isArray(data.media)) throw Error('Invalid media output snapshot');
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyOutput();
    throw error;
  }
}
export async function writeOutput(data: OutputSnapshot, file = outputFile()) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmp, file);
}

const skip = (media: string) => excludedMedia.has(media) || ['google_news', 'dongtaiwang'].includes(media);
/** The host each publisher's traffic is measured on: the reviewed article host, else the catalog's website, else media-names. */
export function publisherHosts(): Array<{ media: string; host: string }> {
  const out = new Map<string, string>();
  for (const source of catalog.sources) {
    const host = source.websiteUrl && trafficDomain(source.websiteUrl);
    if (!skip(source.media) && host) out.set(source.media, host);
  }
  for (const [media, entry] of Object.entries(names.media) as Array<[string, { status?: string; sourceUrl?: string }]>) {
    const host = entry.sourceUrl && trafficDomain(entry.sourceUrl);
    if (!skip(media) && !out.has(media) && host && ['verified', 'retained'].includes(entry.status ?? '')) out.set(media, host);
  }
  for (const [media, entry] of Object.entries(trafficHosts.hosts)) if (!skip(media)) out.set(media, entry.host);
  return [...out].map(([media, host]) => ({ media, host }));
}
/** `host` is the measured host or one of its subdomains (Similarweb counts subdomains in a parent). */
export const onHost = (host: string, measured: string) => {
  const bare = host.toLowerCase().replace(/^www\./, '');
  return bare === measured || bare.endsWith(`.${measured}`);
};
export const taipeiDate = (date: Date) => new Date(date.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
/** Named like a news sitemap (path only: the host itself is often news.*), and not gzipped. */
const newsLike = (url: string) => {
  const path = URL.canParse(url) ? new URL(url).pathname : '';
  return /news|google/i.test(path) && !/\.gz$/i.test(path);
};

type Fetch = (url: string) => Promise<string | null>;
const fetchBody: Fetch = async (url) => {
  const res = await fetchText(url, { timeout: 20_000, retries: 0 });
  return res.status === 200 ? res.body : null;
};
/** News sitemaps for a host: robots.txt entries named like news sitemaps, plus news children of its sitemap indexes. */
export async function findNewsSitemaps(host: string, get: Fetch = fetchBody): Promise<string[]> {
  const robots = await get(`https://${host}/robots.txt`).catch(() => null);
  const listed = [...(robots ?? '').matchAll(/^\s*sitemap:\s*(\S+)/gim)]
    .map((m) => m[1])
    .filter((url) => {
      const h = trafficDomain(url);
      return h !== null && onHost(h, host);
    });
  const found = new Set(listed.filter(newsLike));
  if (!found.size)
    for (const url of listed.slice(0, 3)) {
      const parsed = parseFeed((await get(url).catch(() => null)) ?? '');
      if (parsed.kind === 'sitemapindex') for (const child of parsed.children ?? []) if (newsLike(child)) found.add(child);
    }
  return [...found].slice(0, 5);
}
/** Articles per Taipei day in the given sitemaps (one level of sitemap index followed). */
export async function countSitemaps(urls: string[], get: Fetch = fetchBody) {
  const days: Record<string, number> = {};
  const seen = new Set<string>();
  let capped = false;
  let read = 0;
  const queue = [...urls];
  while (queue.length && seen.size < 10) {
    const url = queue.shift() as string;
    if (seen.has(url)) continue;
    seen.add(url);
    const parsed = parseFeed((await get(url).catch(() => null)) ?? '');
    if (parsed.kind === 'sitemapindex') queue.push(...(parsed.children ?? []).filter((c) => !/\.gz(?:$|\?)/i.test(c)).slice(0, 5));
    if (parsed.kind !== 'sitemap') continue;
    read++;
    if (parsed.items.length >= SITEMAP_CAP) capped = true;
    const urlsSeen = new Set<string>();
    for (const item of parsed.items) {
      if (!item.publishedAt || urlsSeen.has(item.url)) continue;
      urlsSeen.add(item.url);
      const day = taipeiDate(item.publishedAt);
      days[day] = (days[day] ?? 0) + 1;
    }
  }
  return { days, capped, read };
}
/**
 * Adds yesterday's count from a fresh read. Today is not over, and the sitemap's
 * two-day window starts partway through the day before yesterday, so only
 * yesterday is complete. A day read twice keeps the larger count; old days drop off.
 */
export function mergeDays(previous: Record<string, number>, next: Record<string, number>, now: Date) {
  const yesterday = taipeiDate(new Date(now.getTime() - 86400e3));
  const oldest = taipeiDate(new Date(now.getTime() - KEEP_DAYS * 86400e3));
  const out: Record<string, number> = {};
  for (const [day, n] of Object.entries(previous)) if (day >= oldest && day <= yesterday) out[day] = n;
  if (next[yesterday] != null) out[yesterday] = Math.max(out[yesterday] ?? 0, next[yesterday]);
  return out;
}
/** Our articles over the past 7 days per media and URL host. */
export async function articleHosts(db: Db, now = new Date()) {
  const host = sql<string>`SUBSTRING_INDEX(SUBSTRING_INDEX(${articles.url}, '/', 3), '/', -1)`;
  const rows = await db
    .select({ media: articles.media, host, n: sql<number>`COUNT(*)` })
    .from(articles)
    .where(gte(articles.publishedAt, new Date(now.getTime() - 7 * 86400e3)))
    .groupBy(articles.media, host);
  const out = new Map<string, Array<{ host: string; n: number }>>();
  for (const row of rows) out.set(row.media, [...(out.get(row.media) ?? []), { host: row.host, n: Number(row.n) }]);
  return out;
}

export async function refreshOutput(
  targets: Array<{ media: string; host: string }>,
  previous: OutputSnapshot,
  hosts: Map<string, Array<{ host: string; n: number }>>,
  { get = fetchBody, now = new Date(), concurrency = 4, deadlineMs = 15 * 60_000 } = {},
): Promise<OutputSnapshot> {
  const before = new Map(previous.media.map((row) => [row.media, row]));
  const deadline = Date.now() + deadlineMs;
  const result: MediaOutput[] = [];
  let failures = 0;
  let error: string | null = null;
  const queue = [...targets];
  const work = async () => {
    for (let target = queue.shift(); target; target = queue.shift()) {
      const old = before.get(target.media);
      const ours = hosts.get(target.media) ?? [];
      const counts = {
        articles7d: ours.reduce((sum, row) => sum + row.n, 0),
        onHost7d: ours.filter((row) => onHost(row.host, target.host)).reduce((sum, row) => sum + row.n, 0),
      };
      const kept = old?.host === target.host ? old : undefined;
      if (Date.now() >= deadline) {
        result.push({ ...(kept ?? { sitemaps: [], days: {}, capped: false, checkedAt: now.toISOString() }), ...target, ...counts });
        error = 'Sitemap batch time limit reached';
        failures++;
        continue;
      }
      try {
        const sitemaps = await findNewsSitemaps(target.host, get);
        const counted = sitemaps.length ? await countSitemaps(sitemaps, get) : { days: {}, capped: false, read: 0 };
        result.push({
          ...target,
          sitemaps: counted.read ? sitemaps : [],
          days: mergeDays(kept?.days ?? {}, counted.days, now),
          capped: counted.capped,
          ...counts,
          checkedAt: now.toISOString(),
        });
      } catch {
        failures++;
        error = 'Sitemap unavailable or invalid';
        result.push({ ...(kept ?? { sitemaps: [], days: {}, capped: false, checkedAt: now.toISOString() }), ...target, ...counts });
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, work));
  result.sort((a, b) => a.media.localeCompare(b.media));
  return {
    version: 1,
    checkedAt: now.toISOString(),
    status: failures ? (failures < targets.length ? 'partial' : 'failed') : 'ok',
    error,
    media: result,
  };
}
