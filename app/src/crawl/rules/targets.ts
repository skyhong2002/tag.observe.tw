import { and, desc, eq, gte, inArray, isNotNull, like, or, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { articles, crawlRuns } from '../../db/schema.ts';
import { allSources, disabled, excludedMedia } from '../registry.ts';
import { crawlTimestamp } from '../schedule.ts';
import type { SourceSpec } from '../sources.ts';
import { urlKey } from '../text.ts';
import { type Attempt, activeRevision, type RuleTrigger, readRuleFile } from './store.ts';
import type { ArticleRef, Collected, RuleTarget } from './validate.ts';

// Which outlets need generated crawl rules (docs/generated-crawl-rules.md).
// Plain code over crawl statistics: the model never sees the database.

const DAY = 86400e3;
const HOUR = 3600e3;
/** A failed attempt waits this long before the outlet is tried again. */
export const COOLDOWN_DAYS: Record<RuleTrigger, number> = { listing: 14, body: 14, tags: 30, 'new-source': 30 };
/** The model found the pages plainly lack what was asked (video stories, no printed tags). */
export const UNFIXABLE_DAYS = 60;
/** The hand-written listing still worked; the outlet had only gone quiet. */
export const QUIET_DAYS = 2;
/** Fresh rules get this long to show up in the statistics before they count as broken. */
const SETTLE_MS = 4 * DAY;
// A quiet listing, missing bodies and missing tags come before listings whose
// every run failed: those are mostly outlets that block us or are down, which
// no rule fixes (the first live day: 6 of 6 such targets failed).
const ORDER = ['listing', 'body', 'tags', 'listing-failing', 'new-source'] as const;

export type Signal = { media: string; trigger: RuleTrigger; reason: string; failing?: boolean };

/** Listings that brought no new article for five typical gaps (at least two days), or whose index runs all failed
 * for 12 hours. Measured on crawled_at, when the crawler first stored an article: outlets that print only a date
 * keep their publication times at midnight and would look quiet by published_at. */
export async function listingSignals(db: Db, now: Date): Promise<Signal[]> {
  const [quiet, failing] = await Promise.all([
    db
      .select({
        media: articles.media,
        prior: sql<number>`SUM(${articles.crawledAt} < ${new Date(now.getTime() - 2 * DAY)})`,
        last: sql<Date | string | null>`MAX(${articles.crawledAt})`,
      })
      .from(articles)
      .where(and(eq(articles.source, 'own'), gte(articles.crawledAt, new Date(now.getTime() - 30 * DAY))))
      .groupBy(articles.media),
    db
      .select({ media: crawlRuns.media, runs: sql<number>`COUNT(*)`, failed: sql<number>`SUM(${crawlRuns.status} = 'failed')` })
      .from(crawlRuns)
      .where(and(eq(crawlRuns.stage, 'index'), gte(crawlRuns.startedAt, new Date(now.getTime() - 12 * HOUR))))
      .groupBy(crawlRuns.media),
  ]);
  const out: Signal[] = [];
  for (const row of failing)
    if (Number(row.runs) >= 3 && Number(row.failed) === Number(row.runs))
      out.push({ media: row.media, trigger: 'listing', failing: true, reason: `近 12 小時 ${row.runs} 次列表抓取全部失敗` });
  for (const row of quiet) {
    const prior = Number(row.prior);
    const last = crawlTimestamp(row.last);
    if (prior < 10 || !last || out.some((s) => s.media === row.media)) continue;
    const gap = (28 * DAY) / prior;
    const silent = now.getTime() - last.getTime();
    if (silent >= Math.max(2 * DAY, 5 * gap))
      out.push({
        media: row.media,
        trigger: 'listing',
        reason: `過去 28 天收錄 ${prior} 篇，但已經 ${Math.round(silent / HOUR)} 小時沒有收錄新文章`,
      });
  }
  return out;
}

/** Recent articles whose body the rules miss (missing/short, not paywalls or errors), or that carry no keyword tags. */
export async function articleSignals(db: Db, now: Date): Promise<Signal[]> {
  const rows = await db
    .select({
      media: articles.media,
      n: sql<number>`COUNT(*)`,
      badBody: sql<number>`SUM(${articles.bodyStatus} IN ('missing', 'short'))`,
      okBody: sql<number>`SUM(${articles.bodyStatus} = 'ok')`,
      noTags: sql<number>`SUM(${articles.bodyStatus} = 'ok' AND ${articles.fetchStatus} IN ('notags', 'title'))`,
    })
    .from(articles)
    .where(
      and(eq(articles.source, 'own'), gte(articles.publishedAt, new Date(now.getTime() - 4 * DAY)), isNotNull(articles.contentFetchedAt)),
    )
    .groupBy(articles.media);
  const out: Signal[] = [];
  for (const row of rows) {
    const [n, bad, ok, noTags] = [row.n, row.badBody, row.okBody, row.noTags].map(Number);
    if (n < 8) continue;
    if (bad / n >= 0.5) out.push({ media: row.media, trigger: 'body', reason: `近 4 天 ${n} 篇中 ${bad} 篇抽不到完整內文` });
    else if (ok >= 8 && noTags / ok >= 0.6)
      out.push({ media: row.media, trigger: 'tags', reason: `近 4 天內文正常的 ${ok} 篇中 ${noTags} 篇沒有關鍵字標籤` });
  }
  return out;
}

/** Catalog sources that never passed the audit (group off), not removed or disabled. */
export function newSourceSignals(sources: SourceSpec[] = allSources()): Signal[] {
  const off = disabled();
  return sources
    .filter((s) => s.group === 'off' && !s.discovery && !off.has(s.media) && !excludedMedia.has(s.media) && s.list.autoDiscover?.homeUrl)
    .map((s) => ({ media: s.media, trigger: 'new-source' as const, reason: '目錄裡的來源，通用探索沒能驗證到近期文章' }));
}

// Hosts many outlets publish on. Site rules apply per host, so a rule written
// for one outlet there would change every other outlet's articles too.
const PLATFORMS = [
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'threads.net',
  'tiktok.com',
  'line.me',
  'google.com',
  'yahoo.com',
  'msn.com',
  'medium.com',
  'substack.com',
  'blogspot.com',
  'wordpress.com',
  'pixnet.net',
  'vocus.cc',
  'matters.town',
  'github.io',
  'spotify.com',
  'soundcloud.com',
  'apple.com',
];
const onPlatform = (host: string) => PLATFORMS.some((p) => host === p || host.endsWith(`.${p}`));
/** The sources configured on each host. */
export function hostOwners(sources: SourceSpec[] = allSources()): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  for (const spec of sources)
    for (const host of configuredHosts(spec)) owners.set(host, new Set([...(owners.get(host) ?? []), spec.media]));
  return owners;
}
/** The hosts host rules may name for this outlet: never a shared platform or a host configured for another source. */
export const ownHosts = (hosts: string[], media: string, owners: Map<string, Set<string>>) =>
  hosts.filter((h) => !onPlatform(h) && [...(owners.get(h) ?? [media])].every((m) => m === media));

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};
export function configuredHosts(spec: SourceSpec): string[] {
  const urls = [
    ...spec.list.urls.map((u) => u.url),
    spec.list.autoDiscover?.homeUrl,
    ...(spec.list.autoDiscover?.feedUrls ?? []),
    ...(spec.list.autoDiscover?.articleHosts ?? []).map((h) => `https://${h}/`),
  ];
  return [...new Set(urls.map((u) => (u ? hostOf(u) : null)).filter((h): h is string => !!h))];
}

// Years and YYYYMMDD dates are shared by every article of a day, not numbers of one.
const DATE_LIKE = /^(?:(?:19|20)\d{2}|(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))$/;
/** The article number in a URL: its longest run of four or more digits that is not a year or a date. */
export const articleNumber = (url: string) => {
  try {
    const u = new URL(url);
    const runs = ((u.pathname + u.search).match(/\d{4,}/g) ?? []).filter((run) => !DATE_LIKE.test(run));
    return runs.sort((a, b) => b.length - a.length)[0] ?? null;
  } catch {
    return null;
  }
};
/** For each given URL the outlet already has: 'same' when stored under the same url_key (as the crawler dedupes),
 * 'shape' when an article with the same number is stored under another URL shape. New URLs are absent. */
export async function collectedUrls(db: Db, spec: SourceSpec, urls: string[]): Promise<Map<string, Collected>> {
  const out = new Map<string, Collected>();
  if (!urls.length) return out;
  const keyOf = new Map(urls.map((url) => [url, urlKey(url, spec.list.articleId)]));
  const exact = new Set(
    (
      await db
        .select({ urlKey: articles.urlKey })
        .from(articles)
        .where(and(eq(articles.media, spec.media), inArray(articles.urlKey, [...new Set(keyOf.values())])))
    ).map((r) => r.urlKey),
  );
  for (const url of urls) if (exact.has(keyOf.get(url) ?? '')) out.set(url, 'same');
  const numbers = [
    ...new Set(
      urls
        .filter((u) => !out.has(u))
        .map(articleNumber)
        .filter((n): n is string => !!n),
    ),
  ];
  if (!numbers.length) return out;
  const stored = await db
    .select({ urlKey: articles.urlKey })
    .from(articles)
    .where(and(eq(articles.media, spec.media), or(...numbers.map((n) => like(articles.urlKey, `%${n}%`)))))
    .limit(500);
  const storedNumbers = new Set(stored.flatMap((r) => ((r.urlKey ?? '').match(/\d{4,}/g) ?? []).filter((run) => !DATE_LIKE.test(run))));
  for (const url of urls) {
    const n = articleNumber(url);
    if (!out.has(url) && n && storedNumbers.has(n)) out.set(url, 'shape');
  }
  return out;
}

async function articleRefs(db: Db, media: string, where: ReturnType<typeof sql>, now: Date, limit: number): Promise<ArticleRef[]> {
  const rows = await db
    .select({ url: articles.url, publishedAt: articles.publishedAt })
    .from(articles)
    .where(and(eq(articles.media, media), eq(articles.source, 'own'), gte(articles.publishedAt, new Date(now.getTime() - 4 * DAY)), where))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
  return rows;
}

/** Everything generation needs about one outlet: its hosts, failing and working articles, and broken generated rules. */
export async function buildTarget(db: Db, spec: SourceSpec, signal: Signal, now = new Date(), owners = hostOwners()): Promise<RuleTarget> {
  const active = activeRevision(await readRuleFile(spec.media));
  const recent = await db
    .selectDistinct({ url: articles.url })
    .from(articles)
    .where(and(eq(articles.media, spec.media), eq(articles.source, 'own'), gte(articles.publishedAt, new Date(now.getTime() - 14 * DAY))))
    .limit(200);
  const hosts = [...new Set([...configuredHosts(spec), ...recent.map((r) => hostOf(r.url)).filter((h): h is string => !!h)])];
  const owned = ownHosts(hosts, spec.media, owners);
  const listingHosts = hosts.filter((h) => !onPlatform(h));
  const failing =
    signal.trigger === 'body'
      ? await articleRefs(db, spec.media, sql`${articles.bodyStatus} IN ('missing', 'short')`, now, 6)
      : signal.trigger === 'tags'
        ? await articleRefs(db, spec.media, sql`${articles.bodyStatus} = 'ok' AND ${articles.fetchStatus} IN ('notags', 'title')`, now, 6)
        : [];
  // Articles the rules read fine now; with a tags trigger, ones that already have tags.
  const working =
    signal.trigger === 'body' || signal.trigger === 'tags' || active
      ? await articleRefs(
          db,
          spec.media,
          signal.trigger === 'tags'
            ? sql`${articles.bodyStatus} = 'ok' AND ${articles.fetchStatus} = 'ok'`
            : sql`${articles.bodyStatus} = 'ok'`,
          now,
          2,
        )
      : [];
  return {
    media: spec.media,
    trigger: signal.trigger,
    spec,
    owned,
    listingHosts,
    examples: recent.slice(0, 5).map((r) => r.url),
    collected: (urls) => collectedUrls(db, spec, urls),
    failing,
    working,
    reason: signal.reason,
    ...(active ? { previous: { rules: active.rules, reason: signal.reason } } : {}),
  };
}

/** Host rules need a host the outlet has to itself; a listing fix can use a host shared with a sister outlet.
 * An outlet only on shared platforms (YouTube channels, Yahoo partners) gets no rules. */
export const usable = (target: RuleTarget) =>
  target.trigger === 'listing' || target.trigger === 'new-source' ? target.listingHosts.length > 0 : target.owned.length > 0;

export async function pickTargets(
  db: Db,
  { now = new Date(), attempts = [] as Attempt[], limit = 4, only = null as string[] | null } = {},
): Promise<RuleTarget[]> {
  const sources = new Map(allSources().map((s) => [s.media, s]));
  const owners = hostOwners([...sources.values()]);
  const off = disabled();
  const signals = [...(await listingSignals(db, now)), ...(await articleSignals(db, now)), ...newSourceSignals([...sources.values()])];
  const lastTry = new Map<string, Attempt>();
  for (const attempt of attempts) if (attempt.status !== 'dry-run') lastTry.set(attempt.media, attempt);
  const picked: RuleTarget[] = [];
  const seen = new Set<string>();
  // Outlets whose generated rules broke come first, then by trigger.
  const regenerating = new Set<string>();
  for (const signal of signals) if (activeRevision(await readRuleFile(signal.media))) regenerating.add(signal.media);
  const rank = (s: Signal) => (regenerating.has(s.media) ? -1 : ORDER.indexOf(s.failing ? 'listing-failing' : s.trigger));
  for (const signal of signals.sort((a, b) => rank(a) - rank(b))) {
    if (picked.length >= limit) break;
    if (seen.has(signal.media) || (only && !only.includes(signal.media))) continue;
    seen.add(signal.media);
    const spec = sources.get(signal.media);
    if (!spec || spec.discovery || off.has(spec.media) || excludedMedia.has(spec.media)) continue;
    if (signal.trigger !== 'new-source' && spec.group === 'off') continue;
    const active = activeRevision(await readRuleFile(spec.media));
    if (active && now.getTime() - Date.parse(active.createdAt) < SETTLE_MS) continue;
    const last = lastTry.get(spec.media);
    const cooldown = last?.reason?.startsWith('unfixable')
      ? UNFIXABLE_DAYS
      : last?.reason?.startsWith('quiet')
        ? QUIET_DAYS
        : COOLDOWN_DAYS[signal.trigger];
    if (!only && last && now.getTime() - Date.parse(last.at) < cooldown * DAY) continue;
    const built = await buildTarget(db, spec, signal, now, owners);
    if (usable(built)) picked.push(built);
  }
  return picked;
}
