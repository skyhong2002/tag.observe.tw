// Port of legacy maint/events.php (clustering) + api/relation24.php (equal=1).
// Pure functions over in-memory article rows; no DB access.

import { isTagNoise } from '../tag-noise.ts';
import type { BurstEntry } from './ranking-compute.ts';

export interface ArticleRow {
  id: number;
  media: string;
  publishedAt: Date;
  url: string;
  title: string;
  image: string | null;
  tags: string[];
}
export interface EventCluster {
  rank: number;
  score: number;
  tags: Array<[string, number]>;
  major: string[];
  news: ArticleRow[];
  majorNews: ArticleRow[];
  /** Articles in the window carrying at least two of the event's tags. */
  articles: number;
  memberIds: number[];
}

const clean = (t: string) => t.trim();

/** A tag carried by at least `min` articles, all from the same outlet. */
export const SITE_TAG_MIN = 8;
export function siteTags(rows: ArticleRow[], min = SITE_TAG_MIN): Set<string> {
  const media = new Map<string, { n: number; media: string | null }>();
  for (const r of rows)
    for (const t of new Set(r.tags.map(clean))) {
      const m = media.get(t);
      if (!m) media.set(t, { n: 1, media: r.media });
      else {
        m.n++;
        if (m.media !== r.media) m.media = null;
      }
    }
  return new Set([...media].filter(([, m]) => m.media !== null && m.n >= min).map(([t]) => t));
}

// relation24.php: co-occurring tags in the last 24h. A tag T' is "equal" to T
// when it appears in > 50% of T's articles (both counts over the same window).
/** Near-synonym tags: a longer tag that contains a shorter one (名古屋亞運 ⊃
 *  亞運, 美沙冬替代療法 ⊃ 美沙冬) and whose articles often carry the shorter
 *  one too. Outlets pick one form or the other, so the share is well under
 *  the 50% "equal" rule (名古屋亞運: 30 of 85 on 2026-10-05), yet each form
 *  seeded its own cluster and the Asian Games closing became two events.
 *  The canonical form is the longest qualifying shorter tag (日本麥當勞 →
 *  麥當勞, not 日本); tags on the no-equal list never absorb others. */
export const ALIAS_MIN_SHARE = 0.3;
export function aliasTags(
  co: CoOccurrence,
  tags: readonly string[],
  { minShare = ALIAS_MIN_SHARE, blocked = new Set<string>() }: { minShare?: number; blocked?: ReadonlySet<string> } = {},
): Map<string, string> {
  const out = new Map<string, string>();
  const byLength = tags.filter((t) => co.count(t) > 0).sort((a, b) => a.length - b.length);
  for (const long of byLength) {
    let best: string | null = null;
    for (const short of byLength) {
      if (short === long || short.length >= long.length || blocked.has(short) || !long.includes(short)) continue;
      if (co.shared(long, short) >= minShare * co.count(long) && (!best || short.length > best.length)) best = short;
    }
    if (best) out.set(long, out.get(best) ?? best);
  }
  return out;
}

export class CoOccurrence {
  private byTag = new Map<string, Set<number>>();
  private byArticle = new Map<number, string[]>();
  /** Outlet brand and section labels (東網, Rti, 盤中速報): every article
   *  carrying the tag comes from one outlet. They co-occur 100% with
   *  whatever that outlet writes about, so they must not join a cluster. */
  readonly siteTags: Set<string>;
  constructor(rows: ArticleRow[], { siteTagMin = SITE_TAG_MIN } = {}) {
    this.siteTags = siteTags(rows, siteTagMin);
    for (const r of rows) {
      const tags = [...new Set(r.tags.map(clean).filter((t) => Buffer.byteLength(t) > 1 && !isTagNoise(t) && !this.siteTags.has(t)))];
      this.byArticle.set(r.id, tags);
      for (const t of tags) {
        let s = this.byTag.get(t);
        if (!s) {
          s = new Set();
          this.byTag.set(t, s);
        }
        s.add(r.id);
      }
    }
  }
  count(tag: string) {
    return this.byTag.get(tag)?.size ?? 0;
  }
  /** Whether two tags are written about together on their own: `minShare`
   *  of the rarer tag's articles carry both. */
  together(a: string, b: string, minShare = HUB_MIN_SHARE) {
    const n = this.shared(a, b);
    return n > 0 && n >= minShare * Math.min(this.count(a), this.count(b));
  }
  /** Articles carrying both tags. */
  shared(a: string, b: string) {
    const [small, large] = [this.byTag.get(a), this.byTag.get(b)].sort((x, y) => (x?.size ?? 0) - (y?.size ?? 0));
    if (!small || !large) return 0;
    let n = 0;
    for (const id of small) if (large.has(id)) n++;
    return n;
  }
  relation(tag: string, limit = 100): Map<string, number> {
    const ids = this.byTag.get(tag);
    const c = new Map<string, number>();
    if (!ids) return c;
    for (const id of ids)
      for (const t of this.byArticle.get(id) ?? []) if (t !== tag && t !== 'google編輯嚴選') c.set(t, (c.get(t) ?? 0) + 1);
    return new Map(
      [...c]
        .filter(([, n]) => n > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit),
    );
  }
  equal(tag: string): Map<string, number> {
    const n = this.count(tag);
    const out = new Map<string, number>();
    if (!n) return out;
    for (const [t, times] of this.relation(tag)) if (times > n * 0.5) out.set(t, times);
    return out;
  }
  // events.php equ(): transitive closure of equal().
  closure(tag: string, noEqual: ReadonlySet<string>, cap = 50): Map<string, number> {
    const seen = new Map<string, number>();
    const stack = [tag];
    while (stack.length && seen.size < cap) {
      const t = stack.pop() as string;
      for (const [u, times] of this.equal(t)) {
        if (!seen.has(u) && !noEqual.has(u)) {
          seen.set(u, times);
          stack.push(u);
        }
      }
    }
    seen.delete(tag);
    return seen;
  }
}

// A tag that several unrelated stories each call "equal" is an umbrella
// (亞運, 川普, 台股) rather than part of one story: through it, golf and a
// tennis row became one event on 2026-10-03. Each hour, the ranked tags that
// reach a tag through their closure are grouped by whether they co-occur on
// their own. With two or more groups, the tag stays with the group it is
// written about most with, and is cut from the others' closures, so it can
// no longer bridge them.
const HUB_MIN_SHARE = 0.2;
/** Tags of the event an article must carry to count as part of it. */
export const MIN_SHARED_TAGS = 2;
/** Headlines kept per event. */
export const NEWS_LIMIT = 6;
/** Share of an event's articles already in higher-ranked events that makes it a duplicate. */
export const DUPLICATE_SHARE = 0.5;
/** Hub tag → the ranked tags still allowed to reach it. */
export function hubTags(
  co: CoOccurrence,
  order: readonly string[],
  closures: ReadonlyMap<string, ReadonlyMap<string, number>>,
): Map<string, Set<string>> {
  const callers = new Map<string, string[]>();
  for (const t of order) for (const u of closures.get(t)?.keys() ?? []) callers.set(u, [...(callers.get(u) ?? []), t]);
  const hubs = new Map<string, Set<string>>();
  for (const [u, kids] of callers) {
    if (kids.length < 2) continue;
    const groups: string[][] = [];
    for (const k of kids) {
      const linked = groups.filter((g) => g.some((x) => co.together(x, k)));
      for (const g of linked) groups.splice(groups.indexOf(g), 1);
      groups.push([k, ...linked.flat()]);
    }
    if (groups.length < 2) continue;
    const weight = (g: string[]) => g.reduce((n, k) => n + co.shared(k, u), 0);
    const home = groups.reduce((best, g) => (weight(g) > weight(best) ? g : best));
    hubs.set(u, new Set(home));
  }
  return hubs;
}

export function clusterEvents(
  entries: BurstEntry[],
  rows: ArticleRow[],
  noEqualList: readonly string[],
  {
    maxTags = 300,
    now = new Date(),
    hubs: detectHubs = true,
    minShared = MIN_SHARED_TAGS,
    newsLimit = NEWS_LIMIT,
    siteTagMin = SITE_TAG_MIN,
    duplicateShare = DUPLICATE_SHARE,
    aliases: mergeAliases = true,
  } = {},
): EventCluster[] {
  const noEqual = new Set(noEqualList);
  const ranked0 = entries.filter((e) => !isTagNoise(e.tag)).slice(0, maxTags);
  // Fold near-synonyms into their shorter form before anything else sees them.
  const alias = mergeAliases
    ? aliasTags(
        new CoOccurrence(rows, { siteTagMin }),
        ranked0.map((e) => e.tag),
      )
    : new Map<string, string>();
  const canon = (t: string) => alias.get(clean(t)) ?? clean(t);
  if (alias.size) rows = rows.map((r) => ({ ...r, tags: [...new Set(r.tags.map(canon))] }));
  const co = new CoOccurrence(rows, { siteTagMin });
  const burst = new Map<string, number>();
  const order: string[] = [];
  for (const e of ranked0) {
    const t = canon(e.tag);
    // With insufficient history, use current score for grouping, not a fabricated burst.
    const b = e.burst ?? e.normalized;
    burst.set(t, Math.max(burst.get(t) ?? Number.NEGATIVE_INFINITY, b));
    if (!order.includes(t)) order.push(t);
  }
  // Each ranked tag's closure skips the hubs whose home group it is not in.
  const ranked = order.filter((t) => !noEqual.has(t));
  const hubs = detectHubs ? hubTags(co, ranked, new Map(ranked.map((t) => [t, co.closure(t, noEqual)]))) : new Map<string, Set<string>>();
  const blockedFor = (t: string) => {
    const out = new Set(noEqual);
    for (const [u, home] of hubs) if (u !== t && !home.has(t)) out.add(u);
    return out;
  };
  const blocked = new Map(order.map((t) => [t, blockedFor(t)]));
  const closures = new Map(order.map((t) => [t, co.closure(t, blocked.get(t) as Set<string>)]));
  // tagmap: for each tag, the highest-ranked earlier tag it is equal to.
  const position = new Map(order.map((t, i) => [t, i]));
  const tagmap = new Map<string, number>();
  for (const [t, eq] of closures)
    for (const u of eq.keys()) {
      const i = position.get(u);
      if (i !== undefined && i < (position.get(t) as number)) tagmap.set(t, Math.max(tagmap.get(t) ?? -1, i));
    }
  // Seed one event per ranked tag (skipping no_equal), pulling in its closure and dependants.
  let clusters: string[][] = [];
  order.forEach((t, i) => {
    if (noEqual.has(t)) return;
    const ev = [t];
    for (const u of closures.get(t)?.keys() ?? []) if (!ev.includes(u) && !noEqual.has(u)) ev.push(u);
    for (const [u, idx] of tagmap) if (idx === i && !ev.includes(u) && !noEqual.has(u)) ev.push(u);
    clusters.push(ev);
  });
  // Merge clusters sharing any tag until stable (events.php while loop).
  for (;;) {
    const before = clusters.length;
    const merged: string[][] = [];
    for (const ev of clusters) {
      const target = merged.find((m) => m.some((t) => ev.includes(t)));
      if (target) {
        for (const t of ev) if (!target.includes(t)) target.push(t);
      } else merged.push([...ev]);
    }
    clusters = merged;
    if (clusters.length === before) break;
  }
  const byTag = new Map<string, ArticleRow[]>();
  for (const r of rows)
    for (const t of r.tags) {
      const l = byTag.get(t) ?? [];
      l.push(r);
      byTag.set(t, l);
    }
  const dayAgo = new Date(now.getTime() - 86400e3);
  const out: EventCluster[] = [];
  for (const ev of clusters) {
    if (ev.length <= 1) continue;
    const tags = ev.map((t) => [t, burst.get(t) ?? 0] as [string, number]).sort((a, b) => b[1] - a[1]);
    // An article belongs to the event when it carries at least `minShared` of
    // its tags. One tag was enough before, and 蕭美琴's church visit, 彰化's
    // 競選總部 and 劉喬安's 毒品 case all sat in the 沈伯洋 rally on 2026-10-05.
    const evTags = new Set(ev);
    const members: Array<{ row: ArticleRow; hits: number; weight: number }> = [];
    const seenId = new Set<number>();
    for (const t of ev)
      for (const r of byTag.get(t) ?? []) {
        if (seenId.has(r.id) || r.publishedAt < dayAgo) continue;
        seenId.add(r.id);
        const carried = [...new Set(r.tags.map(clean))].filter((x) => evTags.has(x));
        if (carried.length < minShared) continue;
        // Divided by log(tag count) as events.php scored major_news: a weekly
        // digest tagged with thirty names is not the best headline for any of them.
        members.push({
          row: r,
          hits: carried.length,
          weight: carried.reduce((n, x) => n + Math.max(0, burst.get(x) ?? 0), 0) / Math.log(r.tags.length + 2),
        });
      }
    // news: the articles most about the event (burst mass of the tags they
    // carry, then recency), one per outlet first so the list reads like a
    // press review rather than six copies of one wire story.
    const byWeight = (a: (typeof members)[number], b: (typeof members)[number]) =>
      b.weight - a.weight || b.row.publishedAt.getTime() - a.row.publishedAt.getTime();
    const ranked = members.slice().sort(byWeight);
    const news: ArticleRow[] = [];
    const seenUrl = new Set<string>();
    const seenMedia = new Set<string>();
    for (const pass of [true, false])
      for (const { row: r } of ranked) {
        if (news.length >= newsLimit) break;
        if (seenUrl.has(r.url) || (pass && seenMedia.has(r.media))) continue;
        seenUrl.add(r.url);
        seenMedia.add(r.media);
        news.push(r);
      }
    if (news.length === 0) {
      // Nothing carries two tags (only possible with a tiny window): fall back
      // to the newest article of each leading tag, as events.php did.
      for (const [t] of tags.slice(0, 5)) {
        const r = (byTag.get(t) ?? []).slice().sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())[0];
        if (r && !seenUrl.has(r.url)) {
          seenUrl.add(r.url);
          news.push(r);
        }
      }
    }
    // major: the three tags carried by the most member articles. events.php
    // preferred tags with three or more equals, which here picks the small
    // tags swallowed by a big story (童子瑋, 陳以信 for the 沈伯洋 rally) over
    // the story itself.
    const coverage = new Map<string, number>();
    for (const { row } of members)
      for (const x of new Set(row.tags.map(clean))) if (evTags.has(x)) coverage.set(x, (coverage.get(x) ?? 0) + 1);
    const major = tags
      .map(([t, b]) => ({ t, b, n: coverage.get(t) ?? 0 }))
      .sort((a, c) => c.n - a.n || c.b - a.b)
      .slice(0, 3)
      .map((x) => x.t);
    // major_news: the same ranking, restricted to articles carrying a major tag.
    const majorNews: ArticleRow[] = [];
    const seenMajorUrl = new Set<string>();
    const seenMajorMedia = new Set<string>();
    for (const pass of [true, false])
      for (const { row: r } of ranked) {
        if (majorNews.length >= newsLimit) break;
        if (seenMajorUrl.has(r.url) || (pass && seenMajorMedia.has(r.media)) || !r.tags.some((x) => major.includes(clean(x)))) continue;
        seenMajorUrl.add(r.url);
        seenMajorMedia.add(r.media);
        majorNews.push(r);
      }
    out.push({
      rank: 0,
      score: tags[0]?.[1] ?? 0,
      tags,
      major,
      news,
      majorNews,
      articles: members.length,
      memberIds: members.map((m) => m.row.id),
    });
  }
  out.sort((a, b) => b.score - a.score);
  // A cluster whose articles mostly sit in other events is the same day seen
  // through other names: 韓國瑜/侯友宜 on 2026-10-05 was the 李四川 and 江啟臣
  // rallies they both attended, 59% of it listed elsewhere. Rank does not
  // matter (at 08:34 it outscored 江啟臣 and only the 李四川 share counted), so
  // events are tested from the lowest score up against every other survivor.
  const dropped = new Set<EventCluster>();
  for (const e of out.slice().reverse()) {
    if (e.memberIds.length === 0) continue;
    const elsewhere = new Set<number>();
    for (const o of out) if (o !== e && !dropped.has(o)) for (const id of o.memberIds) elsewhere.add(id);
    const inside = e.memberIds.filter((id) => elsewhere.has(id)).length;
    if (inside / e.memberIds.length >= duplicateShare) dropped.add(e);
  }
  const kept = out.filter((e) => !dropped.has(e));
  kept.forEach((e, i) => {
    e.rank = i + 1;
  });
  return kept;
}

// events_history.php: attach each event (>=2 major) to a thread active within
// the last 6 hours when >=2 of its major tags are among the thread's `all`
// tags; otherwise open a new thread.
export interface ThreadState {
  id: number;
  lastTime: Date;
  allTags: string[];
  history: Record<string, Record<string, number>>;
}
/** The thread sharing the most major tags (at least two). Ties go to the
 *  thread active most recently, then the older one: taking the first match
 *  by id let a mixed event hop between two threads hour to hour. */
export function matchThread(major: string[], threads: ThreadState[]): ThreadState | null {
  let best: ThreadState | null = null,
    bestHits = 1;
  for (const th of threads) {
    const all = th.allTags.map(clean);
    const hits = major.filter((m) => all.includes(clean(m))).length;
    if (hits > bestHits || (hits === bestHits && best && th.lastTime > best.lastTime)) {
      best = th;
      bestHits = hits;
    }
  }
  return best;
}
export function threadUpdate(
  th: { history: Record<string, Record<string, number>> },
  hourKey: string,
  major: string[],
  tags: Array<[string, number]>,
) {
  const scores = Object.fromEntries(major.map((m) => [m, tags.find(([t]) => t === m)?.[1] ?? 0]));
  const history = { ...th.history, [hourKey]: scores };
  // all: up to 4 distinct major tags from the last 24 hourly entries, newest first.
  const hours = Object.keys(history).sort().reverse().slice(0, 24);
  const all: string[] = [];
  for (const h of hours) for (const t of Object.keys(history[h])) if (!all.includes(t) && all.length < 4) all.push(t);
  let maxTag: string | null = null,
    maxScore = 0;
  const majorCount = new Map<string, number>();
  for (const h of Object.keys(history))
    for (const [t, s] of Object.entries(history[h])) {
      if (s > maxScore && Buffer.byteLength(t) > 1) {
        maxScore = s;
        maxTag = t;
      }
      majorCount.set(t, (majorCount.get(t) ?? 0) + 1);
    }
  const majorTags = [...majorCount]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
  return { history, allTags: all, hours: Object.keys(history).length, maxTag, maxScore, majorTags };
}
