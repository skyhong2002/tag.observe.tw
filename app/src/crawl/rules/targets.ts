import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { articles, crawlRuns } from '../../db/schema.ts';
import { allSources, disabled, excludedMedia } from '../registry.ts';
import { crawlTimestamp } from '../schedule.ts';
import type { SourceSpec } from '../sources.ts';
import { type Attempt, activeRevision, type RuleTrigger, readRuleFile } from './store.ts';
import type { ArticleRef, RuleTarget } from './validate.ts';

// Which outlets need generated crawl rules (docs/generated-crawl-rules.md).
// Plain code over crawl statistics: the model never sees the database.

const DAY = 86400e3;
const HOUR = 3600e3;
/** A failed attempt waits this long before the outlet is tried again. */
export const COOLDOWN_DAYS: Record<RuleTrigger, number> = { listing: 14, body: 14, tags: 30, 'new-source': 30 };
/** The model found the pages plainly lack what was asked (video stories, no printed tags). */
export const UNFIXABLE_DAYS = 60;
/** Fresh rules get this long to show up in the statistics before they count as broken. */
const SETTLE_MS = 4 * DAY;
const ORDER: RuleTrigger[] = ['listing', 'body', 'tags', 'new-source'];

export type Signal = { media: string; trigger: RuleTrigger; reason: string };
const real = sql`NOT (${articles.fetchedAt} IS NULL AND ${articles.publishedAt} = ${articles.crawledAt})`;

/** Listings that went quiet for five typical gaps (at least two days), or whose index runs all failed for 12 hours. */
export async function listingSignals(db: Db, now: Date): Promise<Signal[]> {
  const [quiet, failing] = await Promise.all([
    db
      .select({
        media: articles.media,
        prior: sql<number>`SUM(${articles.publishedAt} < ${new Date(now.getTime() - 2 * DAY)})`,
        last: sql<Date | string | null>`MAX(${articles.publishedAt})`,
      })
      .from(articles)
      .where(and(eq(articles.source, 'own'), gte(articles.publishedAt, new Date(now.getTime() - 30 * DAY)), real))
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
      out.push({ media: row.media, trigger: 'listing', reason: `近 12 小時 ${row.runs} 次列表抓取全部失敗` });
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
        reason: `過去 28 天有 ${prior} 篇，但已經 ${Math.round(silent / HOUR)} 小時沒有新文章`,
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
  const rank = (s: Signal) => (regenerating.has(s.media) ? -1 : ORDER.indexOf(s.trigger));
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
    const cooldown = last?.reason?.startsWith('unfixable') ? UNFIXABLE_DAYS : COOLDOWN_DAYS[signal.trigger];
    if (!only && last && now.getTime() - Date.parse(last.at) < cooldown * DAY) continue;
    const built = await buildTarget(db, spec, signal, now, owners);
    if (usable(built)) picked.push(built);
  }
  return picked;
}
