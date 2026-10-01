// Weekly: look for a working listing for every disabled source (robots.txt
// sitemaps, common feed paths, homepage article links). Results are recorded
// in source_probes and logged at warn level when something usable turns up;
// enabling a source stays a reviewed change (overrides.ts + crawl-disabled.json).
import disabled from '../../data/crawl-disabled.json' with { type: 'json' };
import specs from '../../data/crawl-sources.json' with { type: 'json' };
import { parseFeed } from '../crawl/feed.ts';
import { fetchText } from '../crawl/fetch.ts';
import { discoverLinks } from '../crawl/html-list.ts';
import { overrides } from '../crawl/sources/overrides.ts';
import type { Db } from '../db/client.ts';
import { sourceProbes } from '../db/schema.ts';

const FEED_PATHS = ['/feed', '/rss', '/rss.xml', '/feed/', '/news-sitemap.xml', '/sitemap_news.xml', '/sitemap.xml'];
const RECENT_MS = 14 * 86400e3;
export interface ProbeResult {
  media: string;
  kind: 'feed' | 'discover' | 'none';
  url: string | null;
  recentItems: number;
  detail?: string;
}

export function originFor(media: string): string | null {
  const url =
    overrides[media]?.list?.urls?.[0]?.url ??
    (specs as unknown as Record<string, { index?: { urls?: Array<{ url: string }> } }>)[media]?.index?.urls?.[0]?.url;
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

export async function probeSource(media: string, fetch = fetchText): Promise<ProbeResult> {
  const origin = originFor(media);
  if (!origin) return { media, kind: 'none', url: null, recentItems: 0, detail: 'no known origin' };
  const candidates = new Set<string>();
  try {
    const robots = await fetch(`${origin}/robots.txt`, { timeout: 15000, retries: 0 });
    for (const m of robots.body.matchAll(/^sitemap:\s*(\S+)/gim)) candidates.add(m[1]);
  } catch {
    /* no robots.txt */
  }
  for (const p of FEED_PATHS) candidates.add(origin + p);
  let best: ProbeResult = { media, kind: 'none', url: null, recentItems: 0 };
  for (const url of [...candidates].slice(0, 10)) {
    try {
      const res = await fetch(url, { timeout: 15000, retries: 0 });
      if (res.status !== 200) continue;
      const feed = parseFeed(res.body);
      const recent = feed.items.filter((i) => i.publishedAt && Date.now() - i.publishedAt.getTime() < RECENT_MS).length;
      if (recent > best.recentItems) best = { media, kind: 'feed', url, recentItems: recent };
    } catch {
      /* try next */
    }
  }
  if (best.recentItems >= 5) return best;
  try {
    const home = await fetch(`${origin}/`, { timeout: 15000, retries: 0 });
    if (home.status === 200) {
      const links = discoverLinks(home.body, home.url || origin, /\/(\d{4,}|\d{4}\/\d{1,2}\/)/);
      if (links.length >= 10)
        return {
          media,
          kind: 'discover',
          url: origin + '/',
          recentItems: links.length,
          detail: 'homepage article links (review a URL pattern before enabling)',
        };
    }
  } catch {
    /* unreachable */
  }
  return best.recentItems ? best : { ...best, detail: 'no feed with recent items, no article links on homepage' };
}

export async function runProbeJob(
  db: Db,
  { log = (_o: object, _m: string) => {}, warn = (_o: object, _m: string) => {}, fetch = fetchText } = {},
) {
  const media = [
    ...new Set([
      ...(disabled as { media: string[] }).media,
      ...(process.env.CRAWL_DISABLED ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  ];
  const results: ProbeResult[] = [];
  for (const m of media) {
    const r = await probeSource(m, fetch);
    results.push(r);
    await db
      .insert(sourceProbes)
      .values({ media: m, checkedAt: new Date(), kind: r.kind, url: r.url, recentItems: r.recentItems, detail: r.detail ?? null });
    if (r.kind !== 'none')
      warn({ media: m, kind: r.kind, url: r.url, recentItems: r.recentItems }, 'disabled crawl source has a usable listing');
  }
  const found = results.filter((r) => r.kind !== 'none').map((r) => r.media);
  log({ probed: media.length, found }, 'source probe finished');
  return { probed: media.length, found };
}
