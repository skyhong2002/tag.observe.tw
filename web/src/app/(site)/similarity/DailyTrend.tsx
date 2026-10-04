'use client';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useMemo, useRef, useState } from 'react';
import MediaHoverLink from '@/components/MediaHoverLink';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { fetchDaily, type SimilarityDaily } from '@/lib/similarity';
import { table } from '@/lib/table-styles';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const RANGES = [30, 90, 365] as const;
const DAY = 24 * 3600e3;
const number = (value: number) => value.toLocaleString('zh-TW');
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';
// Orange = similarity and violet = citation, as on the graph; teal for the identical subset (validated for CVD in both modes).
const SERIES = [
  { key: 'pairs', name: '相似配對', color: '#ea580c', dashed: false },
  { key: 'identical', name: '內文相同', color: '#0d9488', dashed: true },
  { key: 'citations', name: '明示引用', color: '#8b5cf6', dashed: false },
] as const;

/** Today's date in Asia/Taipei as YYYY-MM-DD. */
const taipeiToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function TrendChart({ data, start }: { data: SimilarityDaily; start: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = useDark();
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const ink = dark ? '#a1a1aa' : '#71717a',
      grid = dark ? '#27272a' : '#f4f4f5',
      surface = dark ? '#18181b' : '#ffffff';
    const days = data.days.slice(start);
    const pick = (values: number[]) => values.slice(start);
    const axis = (i: number) => ({
      type: 'category',
      gridIndex: i,
      data: days.map(shortDay),
      boundaryGap: true,
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { show: i === 1, color: ink, hideOverlap: true },
    });
    const yAxis = (i: number, name: string) => ({
      type: 'value',
      gridIndex: i,
      min: 0,
      minInterval: 1,
      name,
      nameTextStyle: { color: ink, align: 'left' },
      axisLabel: { color: ink },
      splitLine: { lineStyle: { color: grid } },
    });
    chart.setOption({
      animation: false,
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: {
        trigger: 'axis',
        backgroundColor: surface,
        borderColor: grid,
        textStyle: { color: dark ? '#e4e4e7' : '#27272a' },
        formatter: (items: Array<{ seriesName: string; value: number; marker: string; dataIndex: number }>) =>
          [days[items[0]?.dataIndex ?? 0], ...items.map((it) => `${it.marker}${it.seriesName}　${number(Number(it.value))}`)].join('<br/>'),
      },
      legend: { top: 0, left: 0, textStyle: { color: ink }, data: [...SERIES.map((s) => s.name), '比對篇數'] },
      grid: [
        { left: 48, right: 24, top: 64, height: '46%' },
        { left: 48, right: 24, top: '72%', bottom: 26 },
      ],
      xAxis: [axis(0), axis(1)],
      yAxis: [yAxis(0, '配對／篇'), yAxis(1, '比對篇數')],
      series: [
        ...SERIES.map((s) => ({
          name: s.name,
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'none',
          color: s.color,
          lineStyle: { width: 2, type: s.dashed ? 'dashed' : 'solid' },
          emphasis: { focus: 'series' },
          data: pick(data.totals[s.key]),
        })),
        {
          name: '比對篇數',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 14,
          color: dark ? '#71717a' : '#a1a1aa',
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: pick(data.totals.articles),
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [data, start, dark]);
  return <div ref={ref} className="h-96 w-full" role="img" aria-label="每日相似配對、內文相同、明示引用與比對篇數" />;
}

type Metric = 'articles' | 'copied' | 'copying' | 'citing' | 'cited';
type SortKey = 'name' | Metric | `${Metric}Share`;
const columns: Array<{ key: 'name' | Metric; label: string; title?: string; share?: boolean }> = [
  { key: 'name', label: '媒體' },
  { key: 'articles', label: '比對篇數', title: '期間內相似度索引已比對的文章數' },
  {
    key: 'copied',
    label: '被跟進',
    title: '這家媒體先刊出，之後有其他媒體刊出相似內容的篇數（文章去重）；百分比為佔比對篇數的比例；同時刊登的不計方向',
    share: true,
  },
  {
    key: 'copying',
    label: '跟進他媒',
    title: '這家媒體刊出時已有其他媒體相似文章的篇數（文章去重）；百分比為佔比對篇數的比例；同時刊登的不計方向',
    share: true,
  },
  { key: 'citing', label: '引用他媒', title: '這家媒體文章內文明示引用其他媒體的次數；百分比為佔比對篇數的比例', share: true },
  { key: 'cited', label: '被引用', title: '其他媒體文章內文明示引用這家媒體的次數' },
];
interface Row {
  media: string;
  name: string;
  articles: number;
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
  if (!value) return <span className="text-zinc-300 dark:text-zinc-700">0</span>;
  return (
    <>
      {number(value)}
      {ratio !== null && <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-400">{Math.round(ratio * 100)}%</span>}
    </>
  );
}

function OutletTable({ data }: { data: SimilarityDaily }) {
  const [sort, setSort] = useState<SortKey>('articles');
  const [descending, setDescending] = useState(true);
  const rows = useMemo(() => {
    const list: Row[] = data.media.map((m) => ({
      media: m.media,
      name: m.name,
      articles: sum(m.articles),
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
  const cell = table.num;
  const muted = (value: number) => (value ? '' : 'text-zinc-300 dark:text-zinc-700');
  return (
    <TableScroller label="各媒體每日比對表格，可左右捲動">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">期間內各媒體的比對篇數、被跟進與跟進他媒的篇數、引用與被引用</caption>
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
                    <button
                      type="button"
                      title={column.share ? `${column.title}。依篇數排序` : column.title}
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
                        title={`${column.label}佔比對篇數的比例。依比例排序`}
                        aria-label={`${column.label}比例排序`}
                        onClick={() => sortBy(shareKey)}
                        className={`inline-flex items-center gap-0.5 rounded px-1 hover:text-brand-700 dark:hover:text-brand-400 ${
                          sort === shareKey ? 'text-brand-800 dark:text-brand-300' : 'text-zinc-400 dark:text-zinc-500'
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
                <div className={table.leadBox}>
                  <MediaHoverLink media={row.media} title={row.name} className={`${linkStyle} flex items-center gap-1.5`}>
                    <span className={table.leadText}>{row.name}</span>
                  </MediaHoverLink>
                </div>
              </th>
              <td className={`${cell} ${muted(row.articles)}`}>{number(row.articles)}</td>
              {(['copied', 'copying', 'citing'] as const).map((metric) => (
                <td key={metric} className={cell}>
                  <Share row={row} metric={metric} />
                </td>
              ))}
              <td className={`${cell} ${muted(row.cited)}`}>{number(row.cited)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="py-8 text-center text-sm text-zinc-500">這段期間沒有媒體資料。</p>}
    </TableScroller>
  );
}

export default function DailyTrend({ threshold }: { threshold: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [state, setState] = useState<{ key: string; data: SimilarityDaily | null; error: boolean } | null>(null);
  const to = taipeiToday(),
    from = shiftDay(to, 1 - range);
  const key = `${from}/${to}/${threshold}`;
  useEffect(() => {
    const controller = new AbortController();
    fetchDaily(from, to, threshold, controller.signal)
      .then((data) => setState({ key, data, error: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, data: null, error: true });
      });
    return () => controller.abort();
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
  const totals = data
    ? [
        { label: '比對篇數', value: sum(data.totals.articles) },
        { label: '相似配對', value: sum(data.totals.pairs) },
        { label: '內文相同', value: sum(data.totals.identical) },
        { label: '明示引用', value: sum(data.totals.citations) },
      ]
    : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">期間</span>
        {RANGES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === range}
            onClick={() => setRange(value)}
            className={`rounded-full border px-3 py-1 ${
              value === range
                ? 'border-brand-600 bg-brand-50 font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                : 'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900'
            }`}
          >
            最近 {value} 天
          </button>
        ))}
        <span className="text-zinc-500 dark:text-zinc-400">
          {from} 至 {to}（台北時間），門檻 {Math.round(threshold * 100)}%
        </span>
      </div>
      {!current ? (
        <p role="status" className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          載入每日統計中…
        </p>
      ) : !data ? (
        <p role="alert" className="py-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
          暫時無法取得每日統計，請稍後重新整理。
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-7 gap-y-3 text-xs text-zinc-500 dark:text-zinc-400">
            {totals.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{number(item.value)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {since ? `資料自 ${since} 起${sparse ? '（更早只有少數媒體的零星文章）' : ''}；` : '這段期間還沒有比對資料；'}
            相似配對算在較晚刊登那篇的日期、引用算在引用文章的刊登日（台北時間）；每篇文章與前後 7 天內其他媒體的文章比對，索引每 10
            分鐘更新，當天數字仍會增加。
          </p>
          {start >= 0 && <TrendChart data={data} start={start} />}
          <section aria-labelledby="daily-outlets-heading">
            <h3 id="daily-outlets-heading" className="mb-1 text-sm font-semibold">
              各媒體
            </h3>
            <p className="mb-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              期間合計，依文章去重。被跟進：這家媒體先刊出，之後有其他媒體刊出相似內容；跟進他媒：刊出時已有其他媒體的相似文章。百分比是佔比對篇數的比例，點欄名依篇數排序、點
              % 依比例排序；同時刊登的配對不計方向。只被引用、沒有收錄內文的媒體比對篇數為 0。
            </p>
            <OutletTable data={data} />
          </section>
        </>
      )}
    </div>
  );
}
