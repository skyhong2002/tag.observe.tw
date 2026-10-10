import { and, eq, or } from 'drizzle-orm';
import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import newsCatalog from '../../data/news-source-catalog.json' with { type: 'json' };
import { allSources, excludedMedia } from '../crawl/registry.ts';
import type { SourceSpec } from '../crawl/sources.ts';
import { urlKey } from '../crawl/text.ts';
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';

// Which outlet does a news page belong to? The /admin/media/ bookmarklet sends
// whatever page the admin is reading. An article we already hold settles it;
// otherwise the page's host is matched against every host an outlet is known
// by (feeds, listing pages, website, favicon), subdomains included.

const info = favicons as unknown as Record<string, { icon: string | null; title: string | null }>;

export const hostOf = (raw: string | null | undefined) => {
  try {
    const u = new URL(raw ?? '');
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '').toLowerCase() : null;
  } catch {
    return null;
  }
};

export function outletHosts(sources: SourceSpec[] = allSources()) {
  const hosts = new Map<string, Set<string>>();
  const add = (media: string, raw: string | null | undefined) => {
    const host = hostOf(raw);
    if (host) hosts.set(media, (hosts.get(media) ?? new Set()).add(host));
  };
  for (const s of sources) {
    if (s.discovery) continue;
    for (const { url } of s.list.urls) add(s.media, url);
    add(s.media, s.list.autoDiscover?.homeUrl);
  }
  for (const s of newsCatalog.sources as Array<{ media: string; websiteUrl?: string | null }>) add(s.media, s.websiteUrl);
  for (const [media, v] of Object.entries(info)) add(media, v.icon);
  // Shared feed or CDN hosts (feedburner, YouTube, Google) name no outlet.
  const owners = new Map<string, number>();
  for (const set of hosts.values()) for (const h of set) owners.set(h, (owners.get(h) ?? 0) + 1);
  for (const [media, set] of hosts) {
    for (const h of set) if ((owners.get(h) ?? 0) > 2) set.delete(h);
    if (excludedMedia.has(media) || !set.size) hosts.delete(media);
  }
  return hosts;
}

/** Outlets whose known hosts match the page: exact host first, then outlets
 *  that own a parent domain (house.ettoday.net → ettoday). */
export function hostCandidates(url: string, hosts = outletHosts()): string[] {
  const page = hostOf(url);
  if (!page) return [];
  const scored: Array<[string, number]> = [];
  for (const [media, set] of hosts) {
    let best = 0;
    for (const h of set) {
      if (h === page) best = Math.max(best, 2 + h.length);
      else if (page.endsWith(`.${h}`)) best = Math.max(best, h.length);
    }
    if (best) scored.push([media, best]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([media]) => media);
}

export async function lookupUrl(db: Db, url: string) {
  const candidates = hostCandidates(url);
  const specs = allSources().filter((s) => !s.discovery && (!candidates.length || candidates.includes(s.media)));
  const keys = specs.map((s) => and(eq(articles.media, s.media), eq(articles.urlKey, urlKey(url, s.list.articleId))));
  const [article] = keys.length
    ? await db
        .select({
          id: articles.id,
          media: articles.media,
          title: articles.title,
          tags: articles.tags,
          fetchStatus: articles.fetchStatus,
          fetchedAt: articles.fetchedAt,
          publishedAt: articles.publishedAt,
        })
        .from(articles)
        .where(or(...keys))
        .limit(1)
    : [];
  const media = article ? [article.media, ...candidates.filter((m) => m !== article.media)] : candidates;
  return { candidates: media.map(outletSummary), article: article ?? null };
}

export const outletSummary = (media: string) => ({ media, title: info[media]?.title ?? media });
