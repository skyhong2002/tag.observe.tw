'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { trafficGrowth, trafficNumber } from '@/lib/media-traffic.mts';
import {
  type ComparisonData,
  type ComparisonOutlet,
  collectionPoint,
  rankValues,
  shortMonth,
  taipeiMonth,
} from '@/lib/traffic-comparison.mts';

const TrafficTrend = dynamic(() => import('./TrafficTrend'), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center text-sm text-zinc-500">載入跨月趨勢…</div>,
});
const colors = ['#ea783b', '#608bf1', '#ae83eb', '#28a99a'];
const control = 'min-h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700';
const number = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-TW'));
type Sort = 'traffic' | 'articles' | 'growth' | 'name';

function Sparkline({ outlet, months }: { outlet: ComparisonOutlet; months: string[] }) {
  const values = months.map((m) => outlet.traffic.find((p) => p.month === m)?.traffic ?? null);
  const known = values.filter((n): n is number => n !== null);
  if (!known.length) return <span className="text-zinc-500">—</span>;
  const min = Math.min(...known),
    span = Math.max(...known) - min || 1;
  const points = values.map((v, i) => (v === null ? null : [3 + (i * 90) / Math.max(1, values.length - 1), 25 - ((v - min) / span) * 20]));
  let path = '',
    gap = true;
  for (const p of points) {
    if (!p) {
      gap = true;
      continue;
    }
    path += `${gap ? 'M' : 'L'}${p[0]},${p[1]} `;
    gap = false;
  }
  return (
    <svg viewBox="0 0 96 30" className="h-7 w-24 text-zinc-500 dark:text-zinc-400" role="img" aria-label={`${outlet.name}流量趨勢`}>
      <title>{months.map((m, i) => `${shortMonth(m)}: ${trafficNumber(values[i])}`).join('；')}</title>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {points.map((p, i) => p && <circle key={months[i]} cx={p[0]} cy={p[1]} r="1.6" fill="currentColor" />)}
    </svg>
  );
}

export default function TrafficComparison({ data, initial }: { data: ComparisonData; initial: Record<string, string | undefined> }) {
  const [trafficMonth, setTrafficMonth] = useState(
    data.trafficMonths.includes(initial.month ?? '') ? initial.month! : data.trafficMonths.at(-1)!,
  );
  const [crawlMonth, setCrawlMonth] = useState(
    data.crawlMonths.includes(initial.crawlMonth ?? '') ? initial.crawlMonth! : (data.crawlMonths.at(-1) ?? data.months.at(-1)!),
  );
  const [from, setFrom] = useState(data.months.includes(initial.from ?? '') ? initial.from! : data.months[0]);
  const [to, setTo] = useState(data.months.includes(initial.to ?? '') ? initial.to! : data.months.at(-1)!);
  const [query, setQuery] = useState(initial.q ?? '');
  const [scope, setScope] = useState(initial.scope === 'all' ? 'all' : 'traffic');
  const [sort, setSort] = useState<Sort>(
    ['traffic', 'articles', 'growth', 'name'].includes(initial.sort ?? '') ? (initial.sort as Sort) : 'traffic',
  );
  const [ascending, setAscending] = useState(initial.dir === 'asc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>(() => {
    const supplied = [...new Set((initial.media ?? '').split(','))].filter((key) => data.outlets.some((o) => o.key === key));
    return initial.media !== undefined
      ? supplied.slice(0, 4)
      : ['udn', 'ltn', 'ettoday'].filter((key) => data.outlets.some((o) => o.key === key));
  });
  const months = useMemo(
    () => data.months.filter((m) => m >= (from < to ? from : to) && m <= (from < to ? to : from)),
    [data.months, from, to],
  );
  const chartOutlets = useMemo(() => selected.flatMap((key) => data.outlets.filter((o) => o.key === key)), [data.outlets, selected]);
  const trafficAt = (outlet: ComparisonOutlet) => outlet.traffic.find((p) => p.month === trafficMonth);
  const trafficRanks = rankValues(data.outlets, (o) => trafficAt(o)?.traffic ?? null);
  const articleRanks = rankValues(data.outlets, (o) => collectionPoint(o, crawlMonth).articles);
  const needle = query.trim().toLocaleLowerCase();
  const filtered = data.outlets.filter(
    (o) =>
      (scope === 'all' || trafficAt(o)?.rawTraffic != null) &&
      `${o.name} ${o.domain ?? ''} ${o.media ?? ''}`.toLocaleLowerCase().includes(needle),
  );
  const metric = (o: ComparisonOutlet): number | string | null =>
    sort === 'name' ? o.name : sort === 'articles' ? collectionPoint(o, crawlMonth).articles : (trafficAt(o)?.[sort] ?? null);
  filtered.sort((a, b) => {
    const x = metric(a),
      y = metric(b);
    if (x == null || y == null) return x == null && y == null ? a.name.localeCompare(b.name, 'zh-Hant') : x == null ? 1 : -1;
    return (ascending ? 1 : -1) * (typeof x === 'string' ? x.localeCompare(y as string, 'zh-Hant') : x - (y as number));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 40)),
    currentPage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(currentPage * 40, (currentPage + 1) * 40);
  const totalArticles = data.generatedAt
    ? data.outlets.filter((o) => o.sourceKind === 'publisher').reduce((sum, o) => sum + (collectionPoint(o, crawlMonth).articles ?? 0), 0)
    : null;
  const collectionDate = data.collectionStartedAt
    ? new Date(data.collectionStartedAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    : null;
  const historicalMonth = data.collectionStartedAt && crawlMonth < taipeiMonth(data.collectionStartedAt);
  const currentMonth = data.generatedAt ? taipeiMonth(data.generatedAt) : null;
  useEffect(() => {
    const params = new URLSearchParams({
      month: trafficMonth,
      crawlMonth,
      from,
      to,
      scope,
      sort,
      dir: ascending ? 'asc' : 'desc',
      media: selected.join(','),
    });
    if (query) params.set('q', query);
    window.history.replaceState(null, '', `/media/sources/?${params}`);
  }, [trafficMonth, crawlMonth, from, to, scope, sort, ascending, selected, query]);
  const chooseSort = (value: Sort) => {
    setPage(0);
    setAscending(sort === value ? !ascending : value === 'name');
    setSort(value);
  };
  const toggle = (key: string) =>
    setSelected((prior) => (prior.includes(key) ? prior.filter((k) => k !== key) : prior.length < 4 ? [...prior, key] : prior));

  return (
    <div className="space-y-5">
      <section aria-label="比較月份" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Similarweb 流量月份
            <select
              aria-label="流量月份"
              className={control}
              value={trafficMonth}
              onChange={(e) => {
                setTrafficMonth(e.target.value);
                setPage(0);
              }}
            >
              {data.trafficMonths.toReversed().map((m) => (
                <option key={m} value={m}>
                  {shortMonth(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            本站收錄月份
            <select
              aria-label="收錄月份"
              className={control}
              value={crawlMonth}
              onChange={(e) => {
                setCrawlMonth(e.target.value);
                setPage(0);
              }}
              disabled={!data.generatedAt}
            >
              {(data.crawlMonths.length ? data.crawlMonths : [crawlMonth]).toReversed().map((m) => (
                <option key={m} value={m}>
                  {shortMonth(m)}
                  {m === currentMonth ? '（至今）' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!data.crawlMonths.includes(trafficMonth)}
            onClick={() => {
              setCrawlMonth(trafficMonth);
              setPage(0);
            }}
            className="min-h-9 text-xs text-brand-700 underline underline-offset-4 disabled:opacity-40 dark:text-brand-400"
          >
            對齊月份
          </button>
          <div className="ml-auto flex gap-6 text-right">
            <div>
              <p className="text-[11px] text-zinc-500">流量歷史</p>
              <p className="text-xl font-semibold tabular-nums">
                {data.trafficMonths.length}
                <span className="ml-1 text-xs font-normal">個月</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">{shortMonth(crawlMonth)} 已收錄</p>
              <p className="text-xl font-semibold tabular-nums">
                {number(totalArticles)}
                <span className="ml-1 text-xs font-normal">篇</span>
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400" role="status">
          {!data.generatedAt ? (
            '目前無法取得收錄統計；仍可查看流量歷史。'
          ) : (
            <>
              {trafficMonth !== crawlMonth && (
                <>
                  目前比較不同期間：流量 {shortMonth(trafficMonth)}，收錄 {shortMonth(crawlMonth)}。{' '}
                </>
              )}
              {historicalMonth ? (
                '所選收錄月份早於爬蟲開始時間，僅顯示後來補收的文章。'
              ) : (
                <>新爬蟲自 {collectionDate} 起累積紀錄，開始當月與本月為部分期間。</>
              )}
            </>
          )}
        </p>
      </section>

      <section aria-label="跨月趨勢" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">跨月趨勢</h2>
            <p className="mt-1 text-xs text-zinc-500">上下兩圖使用相同月份與媒體配色，分別呈現流量及收錄篇數。</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="sr-only" htmlFor="trend-from">
              趨勢起月
            </label>
            <select
              id="trend-from"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (e.target.value > to) setTo(e.target.value);
              }}
              className={control}
            >
              {data.months.map((m) => (
                <option key={m} value={m}>
                  {shortMonth(m)}
                </option>
              ))}
            </select>
            <span>至</span>
            <label className="sr-only" htmlFor="trend-to">
              趨勢迄月
            </label>
            <select
              id="trend-to"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                if (e.target.value < from) setFrom(e.target.value);
              }}
              className={control}
            >
              {data.months.map((m) => (
                <option key={m} value={m}>
                  {shortMonth(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chartOutlets.map((o, i) => (
            <button
              type="button"
              key={o.key}
              onClick={() => toggle(o.key)}
              aria-label={`移除 ${o.name} 趨勢`}
              className="inline-flex min-h-8 items-center gap-2 rounded-full border border-zinc-200 px-3 text-xs dark:border-zinc-700"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i] }} />
              {o.name}
              <span aria-hidden="true" className="text-zinc-500">
                ×
              </span>
            </button>
          ))}
          <label className="sr-only" htmlFor="add-trend">
            加入比較媒體
          </label>
          <select
            id="add-trend"
            value=""
            disabled={selected.length >= 4}
            className={`${control} max-w-[180px] text-xs disabled:opacity-50`}
            onChange={(e) => toggle(e.target.value)}
          >
            <option value="">{selected.length >= 4 ? '已選 4 家，移除後可再加入' : '＋ 加入媒體（最多 4 家）'}</option>
            {data.outlets
              .filter((o) => !selected.includes(o.key))
              .toSorted((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
              .map((o) => (
                <option key={o.key} value={o.key}>
                  {o.name}
                </option>
              ))}
          </select>
        </div>
        {chartOutlets.length ? (
          <TrafficTrend months={months} outlets={chartOutlets} />
        ) : (
          <p className="py-16 text-center text-sm text-zinc-500">從上方選單或下方表格勾選媒體，查看趨勢。</p>
        )}
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          流量資料目前至 {shortMonth(data.trafficMonths.at(-1)!)}；收錄前的月份僅有補收資料，無紀錄的月份保留空白。
        </p>
        <details className="mt-2 text-xs">
          <summary className="w-fit cursor-pointer py-1 text-zinc-500">查看逐月數字</summary>
          <div className="mt-2 max-w-full overflow-x-auto">
            <table className="w-full whitespace-nowrap text-right tabular-nums">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 text-left">月份</th>
                  {chartOutlets.map((o) => (
                    <th key={o.key} className="px-3 py-2 font-medium">
                      {o.name}
                      <span className="block text-[10px] font-normal text-zinc-500">流量原表值 ／ 收錄篇數</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m} className="border-b border-zinc-100 dark:border-zinc-900">
                    <th className="py-2 text-left font-normal">{shortMonth(m)}</th>
                    {chartOutlets.map((o) => (
                      <td key={o.key} className="px-3 py-2">
                        {trafficNumber(o.traffic.find((p) => p.month === m)?.traffic ?? null)} ／ {number(collectionPoint(o, m).articles)}
                        {collectionPoint(o, m).historical && collectionPoint(o, m).articles !== null ? '（補收）' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section aria-label="媒體比較表">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            媒體比較 <span className="ml-1 text-xs font-normal text-zinc-500">{filtered.length} 家</span>
          </h2>
          <div className="flex max-w-full flex-wrap gap-2">
            <input
              aria-label="搜尋媒體或網域"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="搜尋媒體或網域"
              className={`${control} w-48 max-w-full`}
            />
            <select
              aria-label="比較範圍"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setPage(0);
              }}
              className={control}
            >
              <option value="traffic">有流量紀錄</option>
              <option value="all">全部媒體</option>
            </select>
          </div>
        </div>
        <section
          className="max-w-full overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
          aria-label="可橫向捲動的媒體比較表"
        >
          <table className="w-full min-w-[720px] whitespace-nowrap text-sm tabular-nums">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th scope="col" className="w-10 px-3 py-3">
                  <span className="sr-only">選取趨勢</span>
                  <span aria-hidden="true">比較</span>
                </th>
                {(
                  [
                    { key: 'name', label: '媒體', sub: '' },
                    { key: 'traffic', label: 'Similarweb 流量', sub: `${shortMonth(trafficMonth)} · 原表值` },
                    { key: 'growth', label: '流量月增減', sub: '' },
                    { key: 'articles', label: '本站收錄', sub: `${shortMonth(crawlMonth)} · 篇` },
                  ] as const
                ).map(({ key, label, sub }) => (
                  <th
                    scope="col"
                    key={key}
                    aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}
                    className={`px-3 py-2 ${key === 'name' ? 'text-left' : 'text-right'}`}
                  >
                    <button type="button" onClick={() => chooseSort(key)} className="min-h-8 font-medium">
                      {label} <span aria-hidden="true">{sort === key ? (ascending ? '↑' : '↓') : '↕'}</span>
                      {sub && <span className="block text-[10px] font-normal">{sub}</span>}
                    </button>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  流量趨勢
                  <span className="block text-[10px] font-normal">
                    {shortMonth(months[0])}–{shortMonth(months.at(-1)!)}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((outlet) => {
                const point = trafficAt(outlet),
                  collected = collectionPoint(outlet, crawlMonth),
                  chosen = selected.indexOf(outlet.key);
                return (
                  <tr
                    key={outlet.key}
                    data-media={outlet.key}
                    className={`border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${chosen >= 0 ? 'bg-orange-50/40 dark:bg-orange-950/10' : ''}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`比較 ${outlet.name}`}
                        checked={chosen >= 0}
                        disabled={chosen < 0 && selected.length >= 4}
                        onChange={() => toggle(outlet.key)}
                        className="h-4 w-4 accent-orange-600"
                      />
                    </td>
                    <td className="max-w-64 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {outlet.media ? (
                          <Link href={`/media/${encodeURIComponent(outlet.media)}/`} className="truncate font-medium hover:underline">
                            {outlet.name}
                          </Link>
                        ) : (
                          <span className="truncate font-medium">{outlet.name}</span>
                        )}
                        {outlet.sourceKind === 'discovery' && (
                          <span className="rounded bg-zinc-100 px-1 text-[10px] text-zinc-500 dark:bg-zinc-800">發現來源</span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-zinc-500">{outlet.domain ?? (outlet.media ? '' : '尚未對應本站媒體')}</div>
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      title={
                        point?.adjusted
                          ? `原表人工調整值 ${trafficNumber(point.rawTraffic)}，不納入比較`
                          : point?.ambiguous
                            ? '原表有多筆不同數值，待核對'
                            : undefined
                      }
                    >
                      {trafficNumber(point?.traffic ?? null)}
                      {point?.adjusted ? (
                        <span className="ml-1 text-[10px] text-zinc-500">調整值</span>
                      ) : point?.ambiguous ? (
                        <span className="ml-1 text-[10px] text-zinc-500">待核對</span>
                      ) : (
                        trafficRanks.has(outlet.key) && (
                          <span className="ml-2 text-[10px] text-zinc-500">#{trafficRanks.get(outlet.key)}</span>
                        )
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{trafficGrowth(point?.growth ?? null)}</td>
                    <td
                      className="px-3 py-2 text-right"
                      title={
                        collected.historical
                          ? '早於開始收錄的月份，僅計已補收文章，無紀錄不等於零發稿'
                          : '本站已收錄篇數，並非該媒體全部發稿量'
                      }
                    >
                      {number(collected.articles)}
                      {collected.articles !== null && (
                        <span className="ml-2 text-[10px] text-zinc-500">
                          {collected.historical ? '補收' : `#${articleRanks.get(outlet.key)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Sparkline outlet={outlet} months={months} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && <p className="p-8 text-center text-sm text-zinc-500">沒有符合條件的媒體，請調整搜尋或比較範圍。</p>}
        </section>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span>每頁 40 家 · 勾選媒體加入趨勢，上限 4 家</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className="min-h-9 disabled:opacity-30"
            >
              上一頁
            </button>
            <span>
              {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage + 1 >= pageCount}
              onClick={() => setPage(currentPage + 1)}
              className="min-h-9 disabled:opacity-30"
            >
              下一頁
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
