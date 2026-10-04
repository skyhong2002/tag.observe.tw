/** Who opened a 議題/專題 for a keyword first, how each packaged it, and who
 *  is still updating: the keyword view of /topic/ and /feature/. */

export interface RaceItem {
  media: string;
  mediaTitle: string;
  kind?: 'topic' | 'feature';
  status?: 'active' | 'ended';
  /** Stored before we tracked the source: `time` is not a start date. */
  backlog?: boolean;
  /** Our first-seen time. */
  time: string | null;
  storyFirstAt?: string | null;
  storyLastAt?: string | null;
}

const DAY = 86400e3;
const ms = (iso: string) => Date.parse(iso);
/** Calendar day in Taipei, as a day number. */
const taipeiDay = (iso: string) => Math.floor((ms(iso) + 8 * 3600e3) / DAY);

/** Best known start: the earlier of the first story on the topic page and our
 *  first sighting. A backlog row's sighting is only when we started watching,
 *  so without a first story its start is unknown (null). */
export function topicStart(t: Pick<RaceItem, 'backlog' | 'time' | 'storyFirstAt'>): string | null {
  const dates = [t.storyFirstAt, t.backlog ? null : t.time].filter((d): d is string => !!d && !Number.isNaN(ms(d)));
  return dates.length ? dates.reduce((a, b) => (ms(b) < ms(a) ? b : a)) : null;
}

export interface OutletRace<T extends RaceItem> {
  media: string;
  mediaTitle: string;
  /** Earliest known start among the outlet's items in this round; null when none is known. */
  start: string | null;
  /** Taipei calendar days after the round's first outlet (0 = same day); null when unknown. */
  gapDays: number | null;
  /** The outlet's matching items, earliest start first, unknown starts last. */
  items: Array<T & { start: string | null }>;
}

export interface RaceRound<T extends RaceItem> {
  start: string | null;
  /** Latest story (or start) among the round's items. */
  end: string | null;
  outlets: Array<OutletRace<T>>;
}

/** A keyword can come back years later (川習會 in 2017 and 2026, 金馬 every
 *  year): an item starting more than this after everything before it went
 *  quiet opens a new round, timed on its own. Same span as 已停更. */
export const ROUND_GAP_DAYS = 90;

const byStart = (a: string | null, b: string | null) => (a && b ? ms(a) - ms(b) : a ? -1 : b ? 1 : 0);
const later = (a: string, b: string | null | undefined) => (b && !Number.isNaN(ms(b)) && ms(b) > ms(a) ? b : a);

/** Items in rounds (oldest first), each grouped per outlet with outlets ordered
 *  by their earliest start; an outlet appears once per round. Items with no
 *  known start come last, as a group of their own (start null, input order). */
export function raceRounds<T extends RaceItem>(items: T[]): Array<RaceRound<T>> {
  const all = items.map((t) => ({ ...t, start: topicStart(t) }));
  const groups: Array<{ start: string | null; end: string | null; items: typeof all }> = [];
  for (const t of all.filter((t) => t.start).sort((a, b) => byStart(a.start, b.start))) {
    const start = t.start as string;
    const cur = groups.at(-1);
    if (cur?.end && ms(start) - ms(cur.end) <= ROUND_GAP_DAYS * DAY) {
      cur.items.push(t);
      cur.end = later(later(cur.end, start), t.storyLastAt);
    } else groups.push({ start, end: later(start, t.storyLastAt), items: [t] });
  }
  const undated = all.filter((t) => !t.start);
  if (undated.length) groups.push({ start: null, end: null, items: undated });
  return groups.map((g) => {
    const by = new Map<string, OutletRace<T>>();
    for (const t of g.items) {
      const o = by.get(t.media) ?? { media: t.media, mediaTitle: t.mediaTitle, start: null, gapDays: null, items: [] };
      o.items.push(t);
      by.set(t.media, o);
    }
    const outlets = [...by.values()];
    for (const o of outlets) o.start = o.items[0].start;
    outlets.sort((a, b) => byStart(a.start, b.start));
    for (const o of outlets) o.gapDays = g.start && o.start ? taipeiDay(o.start) - taipeiDay(g.start) : null;
    return { start: g.start, end: g.end, outlets };
  });
}

export interface RaceSummary {
  outlets: number;
  /** Outlets with at least one 議題 / 專題 (one with both counts in each). */
  topicOutlets: number;
  featureOutlets: number;
  bothOutlets: number;
  /** Among outlets with a 議題: any of them still updating, or all 已停更. */
  activeOutlets: number;
  endedOutlets: number;
}

/** Per outlet, across all rounds. */
export function raceSummary(items: RaceItem[]): RaceSummary {
  const by = new Map<string, RaceItem[]>();
  for (const t of items) by.set(t.media, [...(by.get(t.media) ?? []), t]);
  const s: RaceSummary = { outlets: by.size, topicOutlets: 0, featureOutlets: 0, bothOutlets: 0, activeOutlets: 0, endedOutlets: 0 };
  for (const list of by.values()) {
    const topics = list.filter((t) => (t.kind ?? 'topic') === 'topic');
    const feature = list.some((t) => t.kind === 'feature');
    if (topics.length) s.topicOutlets++;
    if (feature) s.featureOutlets++;
    if (topics.length && feature) s.bothOutlets++;
    if (topics.some((t) => t.status !== 'ended')) s.activeOutlets++;
    else if (topics.length) s.endedOutlets++;
  }
  return s;
}

/** 「7 家：5 家做成議題、2 家做成專題」 */
export function kindLine(s: RaceSummary): string {
  if (!s.featureOutlets) return `${s.outlets} 家都做成議題`;
  if (!s.topicOutlets) return `${s.outlets} 家都做成專題`;
  return `${s.outlets} 家：${s.topicOutlets} 家做成議題、${s.featureOutlets} 家做成專題${s.bothOutlets ? `（${s.bothOutlets} 家兩種都有）` : ''}`;
}

/** 「議題中 3 家仍在更新、2 家已停更」; null without any 議題. */
export function statusLine(s: RaceSummary): string | null {
  if (!s.topicOutlets) return null;
  const parts = [s.activeOutlets && `${s.activeOutlets} 家仍在更新`, s.endedOutlets && `${s.endedOutlets} 家已停更`].filter(Boolean);
  return `議題中 ${parts.join('、')}`;
}

/** 「最早」, 「同一天」, 「+3 天」 */
export const gapLabel = (gapDays: number | null, index: number) =>
  gapDays == null ? null : index === 0 ? '最早' : gapDays === 0 ? '同一天' : `+${gapDays} 天`;
