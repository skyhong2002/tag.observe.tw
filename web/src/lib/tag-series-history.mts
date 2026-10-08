export interface SeriesPoint {
  t: string;
  score: number | null;
  count: number | null;
  hourlyCount: number | null;
  average24h: number | null;
  rank: number | null;
}

export interface TagSeries {
  tag: string;
  category: string;
  hours: number;
  from: string;
  to: string;
  hasMore: boolean;
  basis: { id: string; media: string[]; coverageFrom: string; validFrom: string };
  points: SeriesPoint[];
}

/** Adjacent complete-hour windows retain their independently warmed-up averages. */
export function prependTagSeries(current: TagSeries, older: TagSeries): TagSeries {
  if (
    older.tag !== current.tag ||
    older.category !== current.category ||
    older.basis.id !== current.basis.id ||
    older.to !== current.from ||
    Date.parse(older.from) >= Date.parse(current.from)
  ) {
    throw new Error('Invalid trend history window');
  }
  return { ...current, from: older.from, hasMore: older.hasMore, points: [...older.points, ...current.points] };
}

export function trendRange(start: number, size: number, count: number) {
  const first = Math.max(0, Math.min(Math.round(start), Math.max(0, count - size)));
  return { start: first, end: Math.min(count - 1, first + size - 1) };
}
