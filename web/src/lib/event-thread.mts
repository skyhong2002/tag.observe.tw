// Pure shaping for the event thread page (/eve/:id). The API gives one row per
// snapshot hour (rank, score, weighted tags, headline picks) and one coverage
// bundle (every report carrying the thread's major tags, by outlet). These
// helpers fold them into what the page shows: a ranked tag list across the
// whole run, a per-outlet row set, and headlines bucketed by hour and camp.

export type Camp = 'blue' | 'green' | 'other';
export const CAMP_ORDER: Camp[] = ['blue', 'green', 'other'];

export interface ThreadHour {
  hourStart: string;
  rank: number;
  score: number;
  major: string[];
  tags: Array<[string, number]>;
}

export interface TagStat {
  tag: string;
  /** Highest hourly burst score the tag reached inside this thread. */
  peak: number;
  peakAt: string;
  /** Snapshot hours in which the tag was among the event's top tags. */
  hours: number;
  /** The thread (or any of its hours) treated the tag as a major tag. */
  major: boolean;
}

/** Every tag the event ever carried, strongest first. Major tags of the
 *  thread are included even when they never made an hour's top list. */
export function tagStats(hours: readonly ThreadHour[], threadMajor: readonly string[] = []): TagStat[] {
  const out = new Map<string, TagStat>();
  const majors = new Set(threadMajor.filter((t) => t.trim()));
  for (const h of hours) {
    for (const m of h.major) if (m.trim()) majors.add(m);
    for (const [tag, score] of h.tags) {
      if (!tag.trim()) continue;
      const cur = out.get(tag);
      if (!cur) out.set(tag, { tag, peak: score, peakAt: h.hourStart, hours: 1, major: false });
      else {
        cur.hours += 1;
        if (score > cur.peak) {
          cur.peak = score;
          cur.peakAt = h.hourStart;
        }
      }
    }
  }
  for (const m of majors) {
    const cur = out.get(m);
    if (cur) cur.major = true;
    else out.set(m, { tag: m, peak: 0, peakAt: hours[0]?.hourStart ?? '', hours: 0, major: true });
  }
  return [...out.values()].sort((a, b) => b.peak - a.peak || b.hours - a.hours || a.tag.localeCompare(b.tag, 'zh-Hant'));
}

/** Best rank and how many hours the thread sat at it. */
export function bestRank(hours: readonly ThreadHour[]): { rank: number; hours: number } | null {
  if (hours.length === 0) return null;
  const rank = Math.min(...hours.map((h) => h.rank));
  return { rank, hours: hours.filter((h) => h.rank === rank).length };
}

export interface CoverageArticle {
  id: number;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  hits: number;
  /** The outlet's own summary; absent from older API responses. */
  description?: string | null;
}
export interface CoverageOutlet {
  media: string;
  title: string;
  icon: string | null;
  camp: Camp;
  articles: CoverageArticle[];
}

export interface OutletRow {
  media: string;
  title: string;
  camp: Camp;
  articles: number;
  first: string;
  last: string;
  latest: CoverageArticle;
}

/** One row per outlet with the numbers the coverage table sorts on. */
export function outletRows(byOutlet: readonly CoverageOutlet[]): OutletRow[] {
  return byOutlet
    .filter((o) => o.articles.length > 0)
    .map((o) => {
      const times = o.articles.map((a) => a.publishedAt).sort();
      const latest = o.articles.reduce((m, a) => (a.publishedAt > m.publishedAt ? a : m), o.articles[0]);
      return {
        media: o.media,
        title: o.title,
        camp: o.camp,
        articles: o.articles.length,
        first: times[0],
        last: times[times.length - 1],
        latest,
      };
    });
}

export type OutletSort = 'title' | 'camp' | 'articles' | 'first' | 'last';
export const OUTLET_SORTS: readonly OutletSort[] = ['title', 'camp', 'articles', 'first', 'last'];
const CAMP_RANK: Record<Camp, number> = { blue: 0, green: 1, other: 2 };

/** Sort rows by one column; ties fall back to article count then name, so the
 *  order is stable whichever column is chosen. */
export function sortOutletRows(rows: readonly OutletRow[], sort: OutletSort, dir: 'asc' | 'desc', collator: Intl.Collator): OutletRow[] {
  const key = (r: OutletRow): number | string =>
    sort === 'title'
      ? r.title
      : sort === 'camp'
        ? CAMP_RANK[r.camp]
        : sort === 'articles'
          ? r.articles
          : sort === 'first'
            ? r.first
            : r.last;
  return [...rows].sort((a, b) => {
    const x = key(a),
      y = key(b);
    const order =
      typeof x === 'string' && typeof y === 'string'
        ? sort === 'title'
          ? collator.compare(x, y)
          : x.localeCompare(y)
        : Number(x) - Number(y);
    return (dir === 'asc' ? order : -order) || b.articles - a.articles || collator.compare(a.title, b.title);
  });
}

/** Default direction when a column is first clicked: names ascend, the
 *  earliest report ascends, everything else descends. */
export const defaultDir = (sort: OutletSort): 'asc' | 'desc' => (sort === 'title' || sort === 'camp' || sort === 'first' ? 'asc' : 'desc');

export interface TimedArticle extends CoverageArticle {
  outlet: CoverageOutlet;
}

const HOUR = 3600e3;
export const hourKey = (iso: string) => Math.floor(Date.parse(iso) / HOUR);
export const hourIso = (key: number) => new Date(key * HOUR).toISOString();

/** Every report in time order, tagged with its outlet. */
export function flattenArticles(byOutlet: readonly CoverageOutlet[], order: 'asc' | 'desc' = 'asc'): TimedArticle[] {
  const rows = byOutlet.flatMap((o) => o.articles.map((a) => ({ ...a, outlet: o })));
  rows.sort((a, b) => (order === 'asc' ? a.publishedAt.localeCompare(b.publishedAt) : b.publishedAt.localeCompare(a.publishedAt)));
  return rows;
}

export interface HourGroup {
  key: number;
  items: TimedArticle[];
  byCamp: Record<Camp, TimedArticle[]>;
}

/** Reports grouped by publication hour, in the order given, each hour also
 *  split by camp for the side-by-side view. */
export function groupByHour(rows: readonly TimedArticle[]): HourGroup[] {
  const groups: HourGroup[] = [];
  for (const r of rows) {
    const key = hourKey(r.publishedAt);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, items: [], byCamp: { blue: [], green: [], other: [] } };
      groups.push(g);
    }
    g.items.push(r);
    g.byCamp[r.outlet.camp].push(r);
  }
  return groups;
}

const DAY = 24 * HOUR,
  TPE = 8 * HOUR;
/** Days since the epoch, counted in Taipei time. */
export const dayKey = (iso: string) => Math.floor((Date.parse(iso) + TPE) / DAY);
/** The Taipei date of a dayKey, YYYY-MM-DD. */
export const dayIso = (key: number) => new Date(key * DAY).toISOString().slice(0, 10);

/** Reports grouped by publication day (Taipei), like groupByHour. */
export function groupByDay(rows: readonly TimedArticle[]): HourGroup[] {
  const groups: HourGroup[] = [];
  for (const r of rows) {
    const key = dayKey(r.publishedAt);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, items: [], byCamp: { blue: [], green: [], other: [] } };
      groups.push(g);
    }
    g.items.push(r);
    g.byCamp[r.outlet.camp].push(r);
  }
  return groups;
}

export interface ThreadDay {
  /** Taipei date, YYYY-MM-DD. */
  day: string;
  /** Hours on the table that day. */
  hours: number;
  bestRank: number;
  /** The first hour the thread held its best rank that day. */
  bestAt: string;
  peak: number;
  /** The day's most frequent major tags, then its other highest-scoring tags. */
  major: string[];
  tags: Array<[string, number]>;
}

/** One row per Taipei day of a thread's hours, newest first. */
export function threadDays(hours: readonly ThreadHour[]): ThreadDay[] {
  const byDay = new Map<number, ThreadHour[]>();
  for (const h of hours) byDay.set(dayKey(h.hourStart), [...(byDay.get(dayKey(h.hourStart)) ?? []), h]);
  return [...byDay]
    .sort((a, b) => b[0] - a[0])
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.hourStart.localeCompare(b.hourStart));
      const bestRank = Math.min(...sorted.map((h) => h.rank));
      const majorCount = new Map<string, number>();
      const tagMax = new Map<string, number>();
      for (const h of sorted) {
        for (const m of h.major) majorCount.set(m, (majorCount.get(m) ?? 0) + 1);
        for (const [t, v] of h.tags) tagMax.set(t, Math.max(tagMax.get(t) ?? 0, v));
      }
      const major = [...majorCount]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t);
      return {
        day: dayIso(key),
        hours: sorted.length,
        bestRank,
        bestAt: (sorted.find((h) => h.rank === bestRank) as ThreadHour).hourStart,
        peak: Math.max(...sorted.map((h) => h.score)),
        major,
        tags: [...tagMax].filter(([t]) => !major.includes(t)).sort((a, b) => b[1] - a[1]),
      };
    });
}

/** One chart point per Taipei day instead of per hour: reports summed, each
 *  tag's score and the event-table rank at their best of the day. `t` is the
 *  day's midnight in Taipei. */
export function dailySeries<
  P extends {
    t: string;
    blue: number;
    green: number;
    other: number;
    tags: Record<string, { score: number | null; rank: number | null }> | null;
  },
>(points: readonly P[], ranks: ReadonlyArray<number | null>) {
  const days: Array<{ key: number; point: P; rank: number | null }> = [];
  points.forEach((p, i) => {
    const key = dayKey(p.t);
    let d = days.at(-1);
    if (!d || d.key !== key) {
      d = {
        key,
        point: { ...p, t: new Date(key * DAY - TPE).toISOString(), blue: 0, green: 0, other: 0, tags: null },
        rank: null,
      };
      days.push(d);
    }
    d.point.blue += p.blue;
    d.point.green += p.green;
    d.point.other += p.other;
    for (const [tag, v] of Object.entries(p.tags ?? {})) {
      const tags = (d.point.tags ??= {});
      const cur = tags[tag];
      if (!cur || (v.score ?? -Infinity) > (cur.score ?? -Infinity)) tags[tag] = { score: v.score, rank: null };
    }
    const r = ranks[i] ?? null;
    if (r !== null) d.rank = d.rank === null ? r : Math.min(d.rank, r);
  });
  return { points: days.map((d) => d.point), ranks: days.map((d) => d.rank) };
}

/** The first report of each camp, for "who broke it". */
export function firstReports(byOutlet: readonly CoverageOutlet[]): Array<{ camp: Camp; outlet: CoverageOutlet; article: CoverageArticle }> {
  const first = new Map<Camp, { outlet: CoverageOutlet; article: CoverageArticle }>();
  for (const o of byOutlet)
    for (const a of o.articles) {
      const cur = first.get(o.camp);
      if (!cur || a.publishedAt < cur.article.publishedAt) first.set(o.camp, { outlet: o, article: a });
    }
  return CAMP_ORDER.flatMap((camp) => {
    const f = first.get(camp);
    return f ? [{ camp, ...f }] : [];
  });
}

/** Fewest major tags a report needs to count as covering the event. A
 *  thread's major tags are broad (台股, 台積電 …), so with several of them a
 *  report naming only one is usually a different story; it still counts when
 *  too few reports name two. */
export function relevanceFloor(byOutlet: readonly CoverageOutlet[], majorTags: number, enough = 8): 1 | 2 {
  if (majorTags < 2) return 1;
  let strong = 0;
  for (const o of byOutlet) for (const a of o.articles) if (a.hits >= 2) strong += 1;
  return strong >= enough ? 2 : 1;
}

/** Coverage split at the floor: reports on the event, and reports that only
 *  share one tag with it. Outlets left with no reports are dropped. */
export function splitByRelevance(byOutlet: readonly CoverageOutlet[], floor: number): { core: CoverageOutlet[]; fringe: CoverageOutlet[] } {
  const part = (keep: (a: CoverageArticle) => boolean) =>
    byOutlet.map((o) => ({ ...o, articles: o.articles.filter(keep) })).filter((o) => o.articles.length > 0);
  return { core: part((a) => a.hits >= floor), fringe: part((a) => a.hits < floor) };
}

const bigrams = (title: string) => {
  const chars = [...title.replace(/[\s\p{P}\p{S}]/gu, '')];
  return new Set(chars.slice(1).map((c, i) => chars[i] + c));
};
/** Dice similarity of two titles' character pairs; reworded wire copy scores high. */
export function titleSimilarity(a: string, b: string): number {
  const x = bigrams(a),
    y = bigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const g of x) if (y.has(g)) shared += 1;
  return (2 * shared) / (x.size + y.size);
}

/** A handful of reports to read first: the ones naming most of the event's
 *  tags, with a summary and a photo, newest first among equals; one per
 *  outlet, no two near-identical headlines, and no camp taking more than
 *  half, so the picks show the range of coverage rather than one wire story. */
export function leadStories(byOutlet: readonly CoverageOutlet[], n = 6): TimedArticle[] {
  const rows = byOutlet.flatMap((o) => o.articles.map((a) => ({ ...a, outlet: o })));
  rows.sort(
    (a, b) =>
      b.hits - a.hits ||
      Number(Boolean(b.description)) - Number(Boolean(a.description)) ||
      Number(Boolean(b.image)) - Number(Boolean(a.image)) ||
      b.publishedAt.localeCompare(a.publishedAt),
  );
  const campCap = Math.ceil(n / 2);
  const picks: TimedArticle[] = [];
  const outlets = new Set<string>();
  const camps: Record<Camp, number> = { blue: 0, green: 0, other: 0 };
  for (const relaxed of [false, true]) {
    for (const r of rows) {
      if (picks.length >= n) break;
      if (picks.includes(r) || outlets.has(r.outlet.media)) continue;
      if (!relaxed && camps[r.outlet.camp] >= campCap) continue;
      if (picks.some((p) => titleSimilarity(p.title, r.title) >= 0.5)) continue;
      picks.push(r);
      outlets.add(r.outlet.media);
      camps[r.outlet.camp] += 1;
    }
  }
  return picks;
}
