// Keyword flow: which keywords carried a period, column by column (hour or
// day), so a reader sees from left to right when each one came in and how long
// it stayed. Pure shaping; components/KeywordFlow.tsx draws it.

export interface FlowColumn {
  key: string;
  /** Short axis label ("08", "10/7"). */
  label: string;
  /** Longer label for the tooltip. */
  title: string;
  href?: string;
}
export interface FlowRow {
  tag: string;
  /** One of the event's main keywords. */
  major: boolean;
  /** Column the keyword first shows up in. */
  first: number;
  /** 0–1 strength per column; null where the keyword is absent. */
  cells: Array<number | null>;
  /** Raw value per column, for the tooltip. */
  raw: Array<number | null>;
}

/** Keep the `limit` strongest keywords (main ones always), ordered by when
 *  they first appear and then by strength; strength is scaled to the
 *  strongest cell so the darkest block is the period's peak. */
export function keywordFlow(
  columns: FlowColumn[],
  values: ReadonlyArray<ReadonlyMap<string, number>>,
  { limit = 24, major = [] as readonly string[] } = {},
): { columns: FlowColumn[]; rows: FlowRow[] } {
  const tags = new Map<string, { sum: number; first: number }>();
  values.forEach((col, i) => {
    for (const [tag, v] of col) {
      const t = tags.get(tag);
      if (t) t.sum += v;
      else tags.set(tag, { sum: v, first: i });
    }
  });
  const keep = [...tags]
    .sort((a, b) => Number(major.includes(b[0])) - Number(major.includes(a[0])) || b[1].sum - a[1].sum)
    .slice(0, limit)
    .sort((a, b) => a[1].first - b[1].first || b[1].sum - a[1].sum);
  const peak = Math.max(1e-9, ...values.flatMap((col) => [...col.values()]));
  return {
    columns,
    rows: keep.map(([tag, t]) => {
      const raw = values.map((col) => col.get(tag) ?? null);
      return {
        tag,
        major: major.includes(tag),
        first: t.first,
        raw,
        cells: raw.map((v) => (v === null ? null : Math.max(0.12, Math.sqrt(Math.max(0, v) / peak)))),
      };
    }),
  };
}

const HOUR = 3600e3,
  TPE = 8 * HOUR;
const pad = (n: number) => String(n).padStart(2, '0');
const weekday = (d: Date) => '日一二三四五六'[d.getUTCDay()];

/** The day table's flow: for each snapshot hour, the keywords of the stories
 *  ranked in the top `top` then (from each story's hourly rank line, 00–23),
 *  stronger the higher they ranked. A new column of keywords is a new story. */
export function dayKeywordFlow(
  day: string,
  dayHours: readonly string[],
  stories: ReadonlyArray<{ major: readonly string[]; trail: ReadonlyArray<number | null> | null | undefined }>,
  { top = 8, perStory = 3, limit = 24 } = {},
) {
  const start = Date.parse(`${day}T00:00:00+08:00`);
  const columns: FlowColumn[] = [];
  const values: Array<Map<string, number>> = [];
  for (const iso of dayHours) {
    const i = Math.round((Date.parse(iso) - start) / HOUR);
    if (i < 0 || i >= 24) continue;
    const col = new Map<string, number>();
    for (const s of stories) {
      const rank = s.trail?.[i];
      if (rank == null || rank > top) continue;
      const v = (top + 1 - rank) / top;
      for (const tag of s.major.slice(0, perStory)) col.set(tag, Math.max(col.get(tag) ?? 0, v));
    }
    columns.push({ key: iso, label: pad(i), title: `${pad(i)}:00`, href: `/event/?at=${encodeURIComponent(iso)}` });
    values.push(col);
  }
  return keywordFlow(columns, values, { limit });
}

/** One event's flow from its snapshot hours: each hour's scored tags, by hour
 *  or merged per Taipei day (a tag's best score that day). */
export function threadKeywordFlow(
  hours: ReadonlyArray<{ hourStart: string; tags: ReadonlyArray<readonly [string, number]> }>,
  major: readonly string[],
  span: 'day' | 'hour',
  limit = 20,
) {
  const sorted = [...hours].sort((a, b) => Date.parse(a.hourStart) - Date.parse(b.hourStart));
  const columns: FlowColumn[] = [];
  const values: Array<Map<string, number>> = [];
  for (const h of sorted) {
    const d = new Date(Date.parse(h.hourStart) + TPE);
    const md = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    const key = span === 'day' ? d.toISOString().slice(0, 10) : new Date(h.hourStart).toISOString();
    if (columns.at(-1)?.key !== key) {
      columns.push(
        span === 'day'
          ? { key, label: md, title: `${md}（${weekday(d)}）`, href: `/event/?day=${key}` }
          : {
              key,
              // Mark where each day starts on an hourly axis.
              label: d.getUTCHours() === 0 || (columns.length === 0 && d.getUTCHours() < 21) ? md : pad(d.getUTCHours()),
              title: `${md} ${pad(d.getUTCHours())}:00`,
              href: `/event/?at=${encodeURIComponent(key)}`,
            },
      );
      values.push(new Map());
    }
    const col = values[values.length - 1];
    for (const [tag, score] of h.tags) if (score > 0) col.set(tag, Math.max(col.get(tag) ?? 0, score));
  }
  return keywordFlow(columns, values, { limit, major });
}
