'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import MethodLink from '@/components/MethodLink';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import {
  groupJournalists,
  type Metric,
  matchesFilters,
  metricCount,
  metricShare,
  metrics,
  type SortKey,
  sortValue,
} from '@/lib/journalist-table.mts';
import { type JournalistSummary, journalistHref } from '@/lib/journalists';
import { table } from '@/lib/table-styles';

const columns: Array<{ key: SortKey; label: string; title?: string; numeric: boolean }> = [
  { key: 'name', label: '記者', numeric: false },
  { key: 'media', label: '刊登媒體', title: '依刊登媒體數排序', numeric: false },
  { key: 'articles', label: '篇數', numeric: true },
  ...metrics.map((metric) => ({ ...metric, numeric: true })),
];
const control = 'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';
const chip = (active: boolean) =>
  `rounded-full px-3 py-1 ${active ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`;
const percent = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`);
function MetricCell({ row, metric }: { row: JournalistSummary; metric: Metric }) {
  const count = metricCount(row, metric);
  const share = metricShare(row, metric);
  return (
    <td className={`${table.num} min-w-28`} title={`${count === null ? '未知' : `${count} 篇`} / 全部 ${row.articles} 篇`}>
      <div className="relative flex items-baseline justify-end gap-2 whitespace-nowrap">
        <span className={count === 0 ? 'text-zinc-400' : ''}>{count === null ? '—' : number(count)}</span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{percent(share)}</span>
        <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-px bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
          <span
            className="block h-px bg-zinc-400 dark:bg-zinc-500"
            style={{ width: `${Math.min(100, Math.max(0, (share ?? 0) * 100))}%` }}
          />
        </span>
      </div>
    </td>
  );
}
const PAGE = 150;
const number = (value: number) => value.toLocaleString('zh-TW');

export default function JournalistTable({ rows }: { rows: JournalistSummary[] }) {
  const [view, setView] = useState<'list' | 'tree'>('list');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('articles');
  const [descending, setDescending] = useState(true);
  const [media, setMedia] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [sortMode, setSortMode] = useState<'count' | 'share'>('count');
  const [relation, setRelation] = useState<Metric | ''>('');
  const [minArticles, setMinArticles] = useState(0);
  const [minCoverage, setMinCoverage] = useState(0);
  const [metric, setMetric] = useState<Metric>('unmatched');
  const [minShare, setMinShare] = useState('');
  const [maxShare, setMaxShare] = useState('');
  const resetFilters = () => {
    setQuery('');
    setMedia('');
    setRelation('');
    setMinArticles(0);
    setMinCoverage(0);
    setMinShare('');
    setMaxShare('');
    setShown(PAGE);
  };
  const outlets = useMemo(() => {
    const names = new Map<string, { name: string; count: number }>();
    for (const row of rows)
      for (const outlet of row.media) names.set(outlet.media, { name: outlet.name, count: (names.get(outlet.media)?.count ?? 0) + 1 });
    return [...names].sort((a, b) => b[1].count - a[1].count);
  }, [rows]);
  const filtered = useMemo(() => {
    return rows
      .filter((row) => matchesFilters(row, { query, media, relation, minArticles, minCoverage, metric, minShare, maxShare }))
      .sort((a, b) => {
        const order =
          sort === 'name' ? a.name.localeCompare(b.name, 'zh-Hant') : sortValue(a, sort, sortMode) - sortValue(b, sort, sortMode);
        return (descending ? -order : order) || b.articles - a.articles || a.name.localeCompare(b.name, 'zh-Hant');
      });
  }, [rows, query, media, relation, minArticles, minCoverage, metric, minShare, maxShare, sort, descending, sortMode]);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(key !== 'name');
    }
    setShown(PAGE);
  };
  const visible = filtered.slice(0, shown);
  const groups = useMemo(() => groupJournalists(filtered), [filtered]);
  const hasMore = view === 'list' ? filtered.length > shown : groups.some((group) => expanded.has(group.id) && group.rows.length > shown);
  const toggleGroup = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const cell = table.num;
  const renderRow = (row: JournalistSummary) => (
    <tr key={row.name} className={table.row}>
      <td className={table.lead}>
        <div className={`${table.leadBox} ${view === 'tree' ? 'border-l border-zinc-300 pl-4 dark:border-zinc-700' : ''}`}>
          <Link
            href={journalistHref(row.name)}
            className="block truncate font-medium hover:text-brand-700 hover:underline dark:hover:text-brand-400"
            title={row.name}
          >
            {row.name}
          </Link>
        </div>
      </td>
      <td className={table.cell}>
        <ul
          title={row.media.map((outlet) => `${outlet.name} ${outlet.count} 篇`).join('、')}
          className="flex max-w-64 items-center gap-x-2 overflow-hidden whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400"
        >
          {row.media.slice(0, 2).map((outlet) => (
            <li key={outlet.media} className="flex min-w-0 items-center gap-1 whitespace-nowrap">
              <MediaIcon media={outlet.media} title={outlet.name} size={14} />
              <span className="truncate">{outlet.name}</span>
              <span className="tabular-nums text-zinc-400">{outlet.count}</span>
            </li>
          ))}
          {row.media.length > 2 && <li className="shrink-0 text-zinc-400">+{row.media.length - 2}</li>}
        </ul>
      </td>
      <td className={cell}>{number(row.articles)}</td>
      {metrics.map(({ key }) => (
        <MetricCell key={key} row={row} metric={key} />
      ))}
    </tr>
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500 dark:text-zinc-400">搜尋名字</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PAGE);
            }}
            placeholder="例如 周辰陽"
            className="w-44 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500 dark:text-zinc-400">媒體</span>
          <select
            value={media}
            onChange={(event) => {
              setMedia(event.target.value);
              setShown(PAGE);
            }}
            className="max-w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">全部媒體</option>
            {outlets.map(([key, outlet]) => (
              <option key={key} value={key}>
                {outlet.name}（{outlet.count} 人）
              </option>
            ))}
          </select>
        </label>
        <p role="status" className="py-2 text-zinc-500 dark:text-zinc-400">
          符合 {number(filtered.length)} 人
        </p>
        <fieldset className="flex gap-1 py-1" aria-label="顯示方式">
          <button type="button" className={chip(view === 'list')} aria-pressed={view === 'list'} onClick={() => setView('list')}>
            列表
          </button>
          <button type="button" className={chip(view === 'tree')} aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
            媒體樹狀
          </button>
        </fieldset>
        {view === 'tree' && (
          <button type="button" className="py-2 underline underline-offset-4" onClick={() => setExpanded(new Set())}>
            全部收合
          </button>
        )}
        <MethodLink className="py-2" />
      </div>
      <section className="mb-3 flex flex-wrap gap-2 text-xs" aria-label="關係篩選">
        <button
          type="button"
          className={chip(!relation)}
          aria-pressed={!relation}
          onClick={() => {
            setRelation('');
            setShown(PAGE);
          }}
        >
          全部關係
        </button>
        {metrics
          .filter(({ key }) => key !== 'compared')
          .map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={chip(relation === key)}
              aria-pressed={relation === key}
              onClick={() => {
                setRelation(relation === key ? '' : key);
                setShown(PAGE);
              }}
            >
              {label}
            </button>
          ))}
      </section>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          排序依據
          <select
            className={control}
            value={sortMode}
            onChange={(e) => {
              setSortMode(e.target.value as 'count' | 'share');
              setShown(PAGE);
            }}
          >
            <option value="count">篇數</option>
            <option value="share">比例</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          最低篇數
          <input
            className={`${control} w-24`}
            type="number"
            min="0"
            step="1"
            value={minArticles}
            onChange={(e) => {
              setMinArticles(Math.max(0, Number(e.target.value)));
              setShown(PAGE);
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          最低已比對比例
          <select
            className={control}
            value={minCoverage}
            onChange={(e) => {
              setMinCoverage(Number(e.target.value));
              setShown(PAGE);
            }}
          >
            {[0, 50, 80, 100].map((value) => (
              <option key={value} value={value}>
                {value ? `${value}%` : '不限'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          比例篩選欄位
          <select
            className={control}
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as Metric);
              setShown(PAGE);
            }}
          >
            {metrics.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          最低比例（%）
          <input
            className={`${control} w-28`}
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="不限"
            value={minShare}
            onChange={(e) => {
              setMinShare(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          最高比例（%）
          <input
            className={`${control} w-28`}
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="不限"
            value={maxShare}
            onChange={(e) => {
              setMaxShare(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
        <button type="button" className="py-2 underline underline-offset-4" onClick={resetFilters}>
          清除篩選
        </button>
      </div>
      <p className="mb-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        每格顯示篇數與占該記者總篇數的比例。點欄名排序；比例排序套用於已比對至引用各欄。各欄可能重疊，不可相加。媒體篩選只選出曾在該媒體刊登的記者，統計仍包含其全部刊登媒體。
      </p>
      <p className="mb-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        未見相近：已完成比對，但在目前收錄範圍與相似度門檻下未發現相近文章；不包含尚未比對的文章，也不代表已確認原創。
      </p>
      {view === 'tree' && (
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          以各記者篇數最多的刊登媒體分組，每人只出現一次。媒體按名稱排列，展開後的記者沿用目前欄位排序；各欄仍計此人全部媒體的文章。
        </p>
      )}
      <TableScroller label="記者表格，可左右捲動">
        <table className="w-full min-w-[80rem] border-collapse text-sm [&_td]:py-1 [&_th]:py-1">
          <thead className="text-left text-xs text-zinc-500 dark:text-zinc-400">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort === column.key ? (descending ? 'descending' : 'ascending') : 'none'}
                  className={`${column.numeric ? cell : column.key === 'name' ? table.leadHead : table.cell} font-medium`}
                >
                  <button
                    type="button"
                    title={column.title}
                    onClick={() => sortBy(column.key)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-brand-700 dark:hover:text-brand-400 ${
                      column.numeric ? 'w-full justify-end' : ''
                    } ${sort === column.key ? 'text-brand-800 dark:text-brand-300' : ''}`}
                  >
                    {column.label}
                    <SortIndicator active={sort === column.key} descending={descending} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {view === 'list'
              ? visible.map(renderRow)
              : groups.map((group) => (
                  <Fragment key={group.id}>
                    <tr className="bg-zinc-50 dark:bg-zinc-900">
                      <th colSpan={columns.length} scope="rowgroup" className="px-2 text-left text-xs font-medium sm:px-3">
                        <button
                          type="button"
                          aria-expanded={expanded.has(group.id)}
                          onClick={() => toggleGroup(group.id)}
                          className="sticky left-2 inline-flex items-center gap-2 py-1"
                        >
                          <span aria-hidden="true">{expanded.has(group.id) ? '▾' : '▸'}</span>
                          <MediaIcon media={group.id} title={group.name} size={14} />
                          {group.name}
                          <span className="font-normal text-zinc-500">{group.rows.length} 位記者</span>
                        </button>
                      </th>
                    </tr>
                    {expanded.has(group.id) && group.rows.slice(0, shown).map(renderRow)}
                  </Fragment>
                ))}
          </tbody>
        </table>
      </TableScroller>
      {hasMore && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShown((value) => value + PAGE)}
            className="rounded border border-zinc-300 px-4 py-2 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {view === 'list' ? `顯示更多（還有 ${number(filtered.length - shown)} 人）` : '顯示更多記者'}
          </button>
        </div>
      )}
      {!filtered.length && <p className="py-8 text-center text-sm text-zinc-500">沒有符合的記者。</p>}
    </div>
  );
}
