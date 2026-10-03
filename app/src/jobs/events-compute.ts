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
}

const clean = (t: string) => t.trim();

// relation24.php: co-occurring tags in the last 24h. A tag T' is "equal" to T
// when it appears in > 50% of T's articles (both counts over the same window).
export class CoOccurrence {
  private byTag = new Map<string, Set<number>>();
  private byArticle = new Map<number, string[]>();
  constructor(rows: ArticleRow[]) {
    for (const r of rows) {
      const tags = [...new Set(r.tags.map(clean).filter((t) => Buffer.byteLength(t) > 1 && !isTagNoise(t)))];
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

export function clusterEvents(
  entries: BurstEntry[],
  rows: ArticleRow[],
  noEqualList: readonly string[],
  { maxTags = 300, now = new Date() } = {},
): EventCluster[] {
  const noEqual = new Set(noEqualList);
  const co = new CoOccurrence(rows);
  const order = entries
    .filter((e) => !isTagNoise(e.tag))
    .slice(0, maxTags)
    .map((e) => e.tag);
  // With insufficient history, use current score for grouping, not a fabricated burst.
  const burst = new Map(entries.map((e) => [e.tag, e.burst ?? e.normalized]));
  const closures = new Map(order.map((t) => [t, co.closure(t, noEqual)]));
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
    // news: for the top 5 tags, newest 6 articles per tag, first unseen URL each.
    const news: ArticleRow[] = [];
    const seenUrl = new Set<string>();
    for (const [t] of tags.slice(0, 5)) {
      for (const r of (byTag.get(t) ?? [])
        .slice()
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, 6)) {
        if (!seenUrl.has(r.url)) {
          seenUrl.add(r.url);
          news.push(r);
          break;
        }
      }
    }
    // major: up to 3 tags, preferring ones with >=3 equals, then 1-2, then 0, then non-positive burst.
    const size = (t: string) => co.closure(t, noEqual).size;
    const major: string[] = [];
    const tiers: Array<(t: string, b: number) => boolean> = [
      (t, b) => size(t) >= 3 && b > 0,
      (t, b) => size(t) < 3 && size(t) > 0 && b > 0,
      (t, b) => size(t) === 0 && b > 0,
      (_t, b) => b <= 0,
    ];
    for (const tier of tiers)
      for (const [t, b] of tags) {
        if (major.length >= 3) break;
        if (!major.includes(t) && tier(t, b)) major.push(t);
      }
    // major_news: articles in the last 24h matching any major tag, scored hits/log(tagCount+2), top 5.
    const scored = new Map<number, { row: ArticleRow; s: number }>();
    for (const m of major)
      for (const r of byTag.get(m) ?? []) {
        if (r.publishedAt < dayAgo) continue;
        const hits = major.filter((x) => r.tags.includes(x)).length;
        scored.set(r.id, { row: r, s: hits / Math.log(r.tags.length + 2) });
      }
    const majorNews = [...scored.values()]
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.row);
    out.push({ rank: 0, score: tags[0]?.[1] ?? 0, tags, major, news, majorNews });
  }
  out.sort((a, b) => b.score - a.score);
  out.forEach((e, i) => {
    e.rank = i + 1;
  });
  return out;
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
export function matchThread(major: string[], threads: ThreadState[]): ThreadState | null {
  for (const th of threads) {
    const hits = major.filter((m) => th.allTags.map(clean).includes(clean(m))).length;
    if (hits >= 2) return th;
  }
  return null;
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
