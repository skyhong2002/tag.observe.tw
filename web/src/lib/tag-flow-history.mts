export interface TagFlow {
  tag: string;
  hours: number;
  sampled: boolean;
  from: string;
  to: string;
  span: 'day' | 'hour';
  hasMore: boolean;
  points: Array<{ t: string; count: number; tags: Array<[string, number]> }>;
}

const HOUR = 3600e3;
export const KEYWORD_GROUP_SIZE = 12;

/** Keep the relative order of shared leading terms, while making older topics visible. */
export function settledKeywordOrder(previous: readonly string[], ranked: readonly string[], limit: number) {
  const leading = new Set(ranked.slice(0, limit));
  const kept = previous.filter((tag) => leading.has(tag));
  const keptSet = new Set(kept);
  return [...kept, ...ranked.filter((tag) => !keptSet.has(tag))];
}

/** Prepending disjoint windows must not count the shared boundary twice. */
export function prependTagFlow(current: TagFlow, older: TagFlow): TagFlow {
  if (
    older.tag !== current.tag ||
    older.span !== current.span ||
    older.to !== current.from ||
    Date.parse(older.from) >= Date.parse(current.from)
  ) {
    throw new Error('Invalid history window');
  }
  const points = new Map([...older.points, ...current.points].map((point) => [point.t, point]));
  return {
    ...current,
    from: older.from,
    hasMore: older.hasMore,
    sampled: current.sampled || older.sampled,
    points: [...points.values()].sort((a, b) => Date.parse(a.t) - Date.parse(b.t)),
  };
}

export function tagFlowTimeline(data: TagFlow) {
  const step = data.span === 'day' ? 24 * HOUR : HOUR;
  const start = data.span === 'day' ? Math.floor((Date.parse(data.from) + 8 * HOUR) / step) * step - 8 * HOUR : Date.parse(data.from);
  const byTime = new Map(data.points.map((point) => [Date.parse(point.t), point]));
  const columns = [];
  for (let at = start; at < Date.parse(data.to); at += step) {
    const local = new Date(at + 8 * HOUR);
    const day = local.toISOString().slice(0, 10);
    const hour = String(local.getUTCHours()).padStart(2, '0');
    const date = `${local.getUTCMonth() + 1}/${local.getUTCDate()}`;
    columns.push({
      key: new Date(at).toISOString(),
      label: data.span === 'day' || local.getUTCHours() === 0 ? date : hour,
      title: data.span === 'day' ? day : `${day} ${hour}:00`,
      href: data.span === 'day' ? `/event/?day=${day}` : `/event/?at=${encodeURIComponent(new Date(at).toISOString())}`,
      tags: new Map(byTime.get(at)?.tags ?? []),
    });
  }
  return columns;
}

/** Only rank terms in the dates currently on screen; history shouldn't displace them. */
export function visibleFlowKeywords(columns: ReturnType<typeof tagFlowTimeline>, start: number, end: number, search: string) {
  const terms = new Map<string, number>();
  const needle = search.trim().toLocaleLowerCase();
  for (const column of columns.slice(start, end)) {
    for (const [tag, count] of column.tags) {
      if (!needle || tag.toLocaleLowerCase().includes(needle)) terms.set(tag, (terms.get(tag) ?? 0) + count);
    }
  }
  return [...terms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant-TW')).map(([tag]) => tag);
}

export function flowVisibleRange(left: number, width: number, columnWidth: number, count: number) {
  const start = Math.max(0, Math.min(count - 1, Math.floor((left - 48) / columnWidth)));
  const end = Math.min(count, Math.max(start + 1, Math.ceil((left + width - 128 - 48) / columnWidth)));
  return { start, end };
}
