import { and, desc, eq, or } from 'drizzle-orm';
import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import newsCatalog from '../../data/news-source-catalog.json' with { type: 'json' };
import { allSources, excludedMedia } from '../crawl/registry.ts';
import type { SourceSpec } from '../crawl/sources.ts';
import { urlKey } from '../crawl/text.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTagEdits, articleTagLog } from '../db/schema.ts';

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

/** One article for the admin page, with who last edited its tags by hand. */
export async function articleDetail(db: Db, id: number) {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const [article] = await db
    .select({
      id: articles.id,
      media: articles.media,
      url: articles.url,
      title: articles.title,
      tags: articles.tags,
      fetchStatus: articles.fetchStatus,
      fetchedAt: articles.fetchedAt,
      publishedAt: articles.publishedAt,
      editedAt: articleTagEdits.editedAt,
      editedBy: articleTagEdits.email,
    })
    .from(articles)
    .leftJoin(articleTagEdits, eq(articleTagEdits.articleId, articles.id))
    .where(eq(articles.id, id));
  if (!article) return null;
  const log = await db
    .select({
      id: articleTagLog.id,
      tag: articleTagLog.tag,
      action: articleTagLog.action,
      email: articleTagLog.email,
      at: articleTagLog.at,
    })
    .from(articleTagLog)
    .where(eq(articleTagLog.articleId, id))
    .orderBy(desc(articleTagLog.id))
    .limit(30);
  return { ...article, log };
}

/** `origin` is this site: its /article/<id>/ pages name the article directly. */
export async function lookupUrl(db: Db, url: string, origin?: string) {
  const own = origin && hostOf(url) === hostOf(origin) ? /^\/article\/(\d+)/.exec(new URL(url).pathname) : null;
  if (own) {
    const article = await articleDetail(db, Number(own[1]));
    return { candidates: article ? [outletSummary(article.media)] : [], article };
  }
  const candidates = hostCandidates(url);
  const specs = allSources().filter((s) => !s.discovery && (!candidates.length || candidates.includes(s.media)));
  const keys = specs.map((s) => and(eq(articles.media, s.media), eq(articles.urlKey, urlKey(url, s.list.articleId))));
  const [found] = keys.length
    ? await db
        .select({ id: articles.id })
        .from(articles)
        .where(or(...keys))
        .limit(1)
    : [];
  const detail = found ? await articleDetail(db, found.id) : null;
  const media = detail ? [detail.media, ...candidates.filter((m) => m !== detail.media)] : candidates;
  return { candidates: media.map(outletSummary), article: detail };
}

export const outletSummary = (media: string) => ({ media, title: info[media]?.title ?? media });
