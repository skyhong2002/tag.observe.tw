'use client';
import { useEffect, useMemo, useState } from 'react';
import FilterButtons from '@/components/FilterButtons';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import SortIndicator from '@/components/SortIndicator';
import TabButtons from '@/components/TabButtons';
import TableScroller from '@/components/TableScroller';
import TrendChart, { type TrendScale } from '@/components/TrendChart';
import { fetchDaily, type SimilarityDaily } from '@/lib/similarity';
import { table } from '@/lib/table-styles';

const RANGES = [30, 90, 365] as const;
const DAY = 24 * 3600e3;
const number = (value: number) => value.toLocaleString('zh-TW');
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';
// Orange = similarity and violet = citation, as on the graph; teal for the identical subset (validated for CVD in both modes).
const SERIES = [
  { key: 'pairs', name: '相似配對', color: '#ea580c', dashed: false },
  { key: 'identical', name: '內文相同', color: '#0d9488', dashed: true },
  { key: 'citations', name: '來源／引用', color: '#8b5cf6', dashed: false },
] as const;
// Per-outlet counts, colored as on the graph: orange earlier → later, teal shared bylines, violet citations.
// Each is counted on the outlet's own articles or citations, so several outlets add up without double counting.
const OUTLET_SERIES = [
  { key: 'copied', name: '較早刊登', color: '#ea580c', dashed: false },
  { key: 'copying', name: '較晚刊登', color: '#ea580c', dashed: true },
  { key: 'sameByline', name: '同署名跨站', color: '#0d9488', dashed: false },
  { key: 'citing', name: '採用／引用他媒', color: '#8b5cf6', dashed: false },
] as const;
/** Ticked outlets named above the chart; the rest are counted. */
const SHOWN = 12;

/** Today's date in Asia/Taipei as YYYY-MM-DD. */
const taipeiToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

type Outlet = SimilarityDaily['media'][number];

type Metric = 'sameByline' | 'attributed' | 'unattributed' | 'articles' | 'copied' | 'copying' | 'citing' | 'cited';
type SortKey = 'name' | Metric | `${Metric}Share`;
const columns: Array<{ key: 'name' | Metric; label: string; share?: boolean }> = [
  { key: 'name', label: '媒體' },
  { key: 'articles', label: '比對篇數' },
  { key: 'sameByline', label: '同署名跨站', share: true },
  { key: 'attributed', label: '已註明來源', share: true },
  { key: 'unattributed', label: '未辨識稿源', share: true },
  { key: 'copied', label: '較早刊登', share: true },
  { key: 'copying', label: '較晚刊登', share: true },
  { key: 'citing', label: '採用／引用他媒', share: true },
  { key: 'cited', label: '被採用／引用' },
];
interface Row {
  media: string;
  name: string;
  articles: number;
  sameByline: number;
  attributed: number;
  unattributed: number;
  copied: number;
  copying: number;
  citing: number;
  cited: number;
}
/** Share of the outlet's compared articles; null without any. */
const share = (row: Row, key: Metric) => (row.articles > 0 ? row[key] / row.articles : null);

/** A count with its share of the outlet's compared articles. */
function Share({ row, metric }: { row: Row; metric: Metric }) {
  const value = row[metric],
    ratio = share(row, metric);
  if (!value) return <span className="text-zinc-600 dark:text-zinc-400">0</span>;
  return (
    <>
      {number(value)}
      {ratio !== null && <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-400">{Math.round(ratio * 100)}%</span>}
    </>
  );
}

/** Table rows totalled over the period, in the table's sort order; the outlet charts follow it too. */
function useOutletRows(data: SimilarityDaily | null) {
  const [sort, setSort] = useState<SortKey>('articles');
  const [descending, setDescending] = useState(true);
  const rows = useMemo(() => {
    const list: Row[] = (data?.media ?? []).map((m) => ({
      media: m.media,
      name: m.name,
      articles: sum(m.articles),
      sameByline: sum(m.sameByline ?? []),
      attributed: sum(m.attributed ?? []),
      unattributed: sum(m.unattributed ?? []),
      copied: sum(m.copied),
      copying: sum(m.copying),
      citing: sum(m.citing),
      cited: sum(m.cited),
    }));
    const value = (row: Row): number => {
      if (sort === 'name') return 0;
      if (sort.endsWith('Share')) return share(row, sort.slice(0, -5) as Metric) ?? -1;
      return row[sort as Metric];
    };
    return list.sort((a, b) => {
      const order = sort === 'name' ? a.name.localeCompare(b.name, 'zh-Hant') : value(a) - value(b);
      return (descending ? -order : order) || b.articles - a.articles || a.media.localeCompare(b.media);
    });
  }, [data, sort, descending]);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(key !== 'name');
    }
  };
  return { rows, sort, descending, sortBy };
}

const checkbox = 'size-4 shrink-0 accent-brand-700 dark:accent-brand-500';

function OutletTable({
  rows: sorted,
  sort,
  descending,
  sortBy,
  picked,
  ticked,
  onTick,
  onTickAll,
}: ReturnType<typeof useOutletRows> & {
  picked: 'all' | 'some' | 'none';
  ticked: (media: string) => boolean;
  onTick: (media: string) => void;
  onTickAll: () => void;
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  // Outlets with nothing in the period made the table a long tail of zeros.
  const active = (row: Row) => row.articles + row.copied + row.copying + row.citing + row.cited > 0;
  const empty = sorted.filter((row) => !active(row)).length;
  const rows = showEmpty ? sorted : sorted.filter(active);
  const cell = table.num;
  const muted = (value: number) => (value ? '' : 'text-zinc-600 dark:text-zinc-400');
  return (
    <TableScroller
      label="各媒體每日比對表格，可左右捲動"
      footer={
        empty > 0 && (
          <button
            type="button"
            onClick={() => setShowEmpty(!showEmpty)}
            className="px-3 py-2 text-xs text-brand-700 hover:underline dark:text-brand-400"
          >
            {showEmpty ? `收起 ${empty} 家沒有資料的媒體` : `另有 ${empty} 家這段期間沒有資料，顯示`}
          </button>
        )
      }
    >
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">期間內各媒體的比對篇數、較早與較晚刊登的篇數、引用與被採用／引用</caption>
        <thead className="text-left text-xs text-zinc-500 dark:text-zinc-400">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {columns.map((column) => {
              const shareKey = `${column.key}Share` as SortKey;
              const active = sort === column.key || (column.share && sort === shareKey);
              const numeric = column.key !== 'name';
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}
                  className={`${numeric ? cell : table.leadHead} font-medium`}
                >
                  <span className={`inline-flex items-center gap-1 whitespace-nowrap ${numeric ? 'w-full justify-end' : ''}`}>
                    {!numeric && (
                      <input
                        type="checkbox"
                        aria-label="全選媒體"
                        title={picked === 'all' ? '取消全部勾選' : '全部勾選'}
                        checked={picked === 'all'}
                        ref={(el) => {
                          if (el) el.indeterminate = picked === 'some';
                        }}
                        onChange={onTickAll}
                        className={`${checkbox} mr-1.5`}
                      />
                    )}
                    <button
                      type="button"
                      title={column.share ? '依篇數排序' : undefined}
                      onClick={() => sortBy(column.key)}
                      className={`inline-flex items-center gap-1 hover:text-brand-700 dark:hover:text-brand-400 ${
                        sort === column.key ? 'text-brand-800 dark:text-brand-300' : ''
                      }`}
                    >
                      {column.label}
                      <SortIndicator active={sort === column.key} descending={descending} />
                    </button>
                    {column.share && (
                      <button
                        type="button"
                        title="依比例排序"
                        aria-label={`${column.label}比例排序`}
                        onClick={() => sortBy(shareKey)}
                        className={`inline-flex items-center gap-0.5 rounded px-1 hover:text-brand-700 dark:hover:text-brand-400 ${
                          sort === shareKey ? 'text-brand-800 dark:text-brand-300' : 'text-zinc-400 dark:text-zinc-400'
                        }`}
                      >
                        %
                        <SortIndicator active={sort === shareKey} descending={descending} />
                      </button>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {rows.map((row) => (
            <tr key={row.media} className={table.row}>
              <th scope="row" className={`${table.lead} text-left font-normal`}>
                <div className={`${table.leadBox} flex items-center gap-2.5`}>
                  <input
                    type="checkbox"
                    aria-label={`畫出${row.name}`}
                    checked={ticked(row.media)}
                    onChange={() => onTick(row.media)}
                    className={checkbox}
                  />
                  <MediaHoverLink media={row.media} title={row.name} className={`${linkStyle} flex min-w-0 items-center gap-1.5`}>
                    <span className={table.leadText}>{row.name}</span>
                  </MediaHoverLink>
                </div>
              </th>
              <td className={`${cell} ${muted(row.articles)}`}>{number(row.articles)}</td>
              {(['sameByline', 'attributed', 'unattributed', 'copied', 'copying', 'citing'] as const).map((metric) => (
                <td key={metric} className={cell}>
                  <Share row={row} metric={metric} />
                </td>
              ))}
              <td className={`${cell} ${muted(row.cited)}`}>{number(row.cited)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">這段期間沒有媒體資料。</p>}
    </TableScroller>
  );
}

export default function DailyTrend({ threshold }: { threshold: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [state, setState] = useState<{ key: string; data: SimilarityDaily | null; error: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const to = taipeiToday(),
    from = shiftDay(to, 1 - range);
  const key = `${from}/${to}/${threshold}/${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    // A stalled API would otherwise leave the loading text up for good.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30_000);
    fetchDaily(from, to, threshold, controller.signal)
      .then((data) => setState({ key, data, error: false }))
      .catch(() => {
        if (timedOut || !controller.signal.aborted) setState({ key, data: null, error: true });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [from, to, threshold, key]);
  const current = state?.key === key ? state : null;
  const data = current?.data ?? null;
  // The chart drops leading days without any activity. Bodies were kept for
  // only a few outlets before late 2026-09, so "data since" is the first day
  // reaching a tenth of the busiest day rather than the first stray article.
  const start = data ? data.days.findIndex((_, i) => SERIES.some((s) => data.totals[s.key][i] > 0) || data.totals.articles[i] > 0) : -1;
  const peak = data ? Math.max(0, ...data.totals.articles) : 0;
  const since = data && peak > 0 ? data.days[data.totals.articles.findIndex((n) => n >= peak / 10)] : null;
  const sparse = data && since ? data.totals.articles.some((n, i) => n > 0 && data.days[i] < since) : false;
  const outlets = useOutletRows(data);
  // Nothing ticked shows the site-wide total; ticked outlets kept across periods are added up.
  const [picks, setPicks] = useState<ReadonlySet<string>>(new Set());
  const chosen = useMemo(() => (data ? data.media.filter((m) => picks.has(m.media)) : []), [data, picks]);
  const picked = !chosen.length ? 'none' : chosen.length === data?.media.length ? 'all' : 'some';
  const tick = (media: string) => {
    const next = new Set(picks);
    if (next.has(media)) next.delete(media);
    else next.add(media);
    setPicks(next);
  };
  const tickAll = () => setPicks(picked === 'all' ? new Set() : new Set(data?.media.map((m) => m.media)));
  const [scale, setScale] = useState<TrendScale>('share');
  // Shares of the sparse early days swing wildly, so the share chart starts at 資料自.
  const first = scale === 'share' && data && since ? data.days.indexOf(since) : start;
  const days = useMemo(() => (data && first >= 0 ? data.days.slice(first) : []), [data, first]);
  const chart = useMemo(() => {
    if (!data || first < 0) return null;
    if (!chosen.length)
      return {
        lines: SERIES.map((s) => ({ ...s, values: data.totals[s.key].slice(first) })),
        bars: data.totals.articles.slice(first),
      };
    const addUp = (pick: (m: Outlet) => number[] | undefined) =>
      days.map((_, i) => chosen.reduce((n, m) => n + (pick(m)?.[first + i] ?? 0), 0));
    return { lines: OUTLET_SERIES.map((s) => ({ ...s, values: addUp((m) => m[s.key]) })), bars: addUp((m) => m.articles) };
  }, [data, first, days, chosen]);
  const totals = !data
    ? []
    : !chosen.length
      ? [
          { label: '比對篇數', value: sum(data.totals.articles) },
          { label: '相似配對', value: sum(data.totals.pairs) },
          { label: '內文相同', value: sum(data.totals.identical) },
          { label: '來源／引用', value: sum(data.totals.citations) },
        ]
      : [
          { label: '比對篇數', value: sum(chosen.map((m) => sum(m.articles))) },
          ...OUTLET_SERIES.map((s) => ({ label: s.name, value: sum(chosen.map((m) => sum(m[s.key] ?? []))) })),
        ];
  const articles = totals[0]?.value ?? 0;
  return (
    <div className="space-y-4">
      <FilterButtons
        label="期間"
        showLabel
        options={RANGES.map((value) => [value, `最近 ${value} 天`] as const)}
        value={range}
        onChange={setRange}
      >
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {from} 至 {to}（台北時間），門檻 {Math.round(threshold * 100)}%
        </span>
      </FilterButtons>
      {!current ? (
        <p role="status" className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          載入每日統計中…
        </p>
      ) : !data ? (
        <p role="alert" className="py-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
          暫時無法取得每日統計。
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="ml-2 rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            重試
          </button>
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-7 gap-y-3 text-xs text-zinc-500 dark:text-zinc-400">
            {totals.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {number(item.value)}
                  {scale === 'share' && item !== totals[0] && articles > 0 && (
                    <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {Math.round((item.value / articles) * 100)}%
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <TabButtons
              label="圖的單位"
              options={[
                ['share', '比例'],
                ['count', '篇數'],
              ]}
              value={scale}
              onChange={setScale}
            />
            {chosen.slice(0, SHOWN).map((m) => (
              <button
                key={m.media}
                type="button"
                onClick={() => tick(m.media)}
                aria-label={`取消勾選${m.name}`}
                title="取消勾選"
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pr-2.5 pl-1.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <MediaIcon media={m.media} title={m.name} size={16} />
                {m.name}
                <span aria-hidden="true" className="text-zinc-400">
                  ×
                </span>
              </button>
            ))}
            {chosen.length > SHOWN && <span className="text-xs text-zinc-500 dark:text-zinc-400">等 {chosen.length} 家</span>}
            {picked !== 'none' && (
              <button type="button" onClick={() => setPicks(new Set())} className={`${linkStyle} text-xs`}>
                看全站
              </button>
            )}
          </div>
          {chart && (
            <TrendChart
              days={days}
              lines={chart.lines}
              bars={chart.bars}
              scale={scale}
              unit={chosen.length ? '篇／次' : '配對／篇'}
              label={
                chosen.length
                  ? `已勾選 ${chosen.length} 家媒體每日較早刊登、較晚刊登、同署名跨站、採用／引用他媒與比對篇數`
                  : '每日相似配對、內文相同、來源／引用與比對篇數'
              }
            />
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {since ? `資料自 ${since} 起${sparse ? '（更早只有少數媒體的零星文章）' : ''}` : '這段期間還沒有比對資料'}
          </p>
          <section aria-labelledby="daily-outlets-heading">
            <h3 id="daily-outlets-heading" className="mb-1 text-sm font-semibold">
              各媒體
            </h3>
            <p className="mb-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">期間合計。勾選媒體，上方的圖就只算這幾家。</p>
            <OutletTable {...outlets} picked={picked} ticked={(media) => picks.has(media)} onTick={tick} onTickAll={tickAll} />
          </section>
        </>
      )}
    </div>
  );
}
