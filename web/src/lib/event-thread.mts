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
