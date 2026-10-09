'use client';

import { useEffect, useState } from 'react';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import { mediaNames } from '@/lib/media-names.mts';
import { trafficNumber } from '@/lib/media-traffic.mts';
import { type ComparisonData, type ComparisonOutlet, collectionPoint, shortMonth } from '@/lib/traffic-comparison.mts';

const control = 'min-h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700';
type Sort = 'traffic' | 'articles' | 'name';
const liveLabels = {
  pending: '尚未抓取',
  ok: '抓取完成',
  partial: '部分網域未能更新',
  blocked: '來源拒絕連線',
  failed: '暫時無法取得資料',
};

function TrafficHistory({ outlet, months }: { outlet: ComparisonOutlet; months: string[] }) {
  const values = months.map((month) => outlet.traffic.find((point) => point.month === month)?.traffic ?? null);
  const known = values.filter((value): value is number => value !== null);
  if (!known.length) return <span className="text-zinc-500">—</span>;
  const min = Math.min(...known);
  const span = Math.max(...known) - min || 1;
  const points = values.map((value, index) =>
    value === null ? null : [3 + (index * 42) / Math.max(1, values.length - 1), 17 - ((value - min) / span) * 12],
  );
  let path = '';
  let gap = true;
  for (const point of points) {
    if (!point) {
      gap = true;
      continue;
    }
    path += `${gap ? 'M' : 'L'}${point[0]},${point[1]} `;
    gap = false;
  }
  const label = months.map((month, index) => `${shortMonth(month)}：${trafficNumber(values[index])}`).join('；');
  return (
    <div className="flex min-w-0 flex-col items-end gap-0.5" title={label}>
      <svg viewBox="0 0 48 20" className="h-5 w-12 text-brand-600 dark:text-brand-400" role="img" aria-label={`近三月流量：${label}`}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
        {points.map((point, index) => point && <circle key={months[index]} cx={point[0]} cy={point[1]} r="1.5" fill="currentColor" />)}
      </svg>
      <div className="flex max-w-full flex-wrap justify-end gap-x-2 text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
        {values.map((value, index) => (
          <span key={months[index]} className="whitespace-nowrap">
            {months[index].slice(4)}月 {trafficNumber(value)}
          </span>
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default function TrafficComparison({ data, initial }: { data: ComparisonData; initial: Record<string, string | undefined> }) {
  const [trafficMonth, setTrafficMonth] = useState(
    data.trafficMonths.includes(initial.month ?? '') ? initial.month! : (data.trafficMonths.at(-1) ?? ''),
  );
  const crawlMonth = data.crawlMonths.at(-1) ?? null;
  const [query, setQuery] = useState(initial.q ?? '');
  const [sort, setSort] = useState<Sort>(
    ['traffic', 'articles', 'name'].includes(initial.sort ?? '') ? (initial.sort as Sort) : 'articles',
  );
  const [ascending, setAscending] = useState(initial.dir === 'asc');
  const recentTrafficMonths = data.trafficMonths.filter((month) => month <= trafficMonth).slice(-3);
  const automatic = data.trafficSource === 'similarweb-extension';
  const trafficAt = (outlet: ComparisonOutlet) => outlet.traffic.find((p) => p.month === trafficMonth);
  const articlesAt = (outlet: ComparisonOutlet) => (crawlMonth ? collectionPoint(outlet, crawlMonth).articles : null);
  const needle = query.trim().toLocaleLowerCase();
  const filtered = data.outlets.filter((o) => `${o.name} ${o.domain ?? ''} ${o.media ?? ''}`.toLocaleLowerCase().includes(needle));
  const metric = (o: ComparisonOutlet): number | string | null =>
    sort === 'name' ? o.name : sort === 'articles' ? articlesAt(o) : (trafficAt(o)?.traffic ?? null);
  filtered.sort((a, b) => {
    const x = metric(a),
      y = metric(b);
    if (x == null || y == null) return x == null && y == null ? a.name.localeCompare(b.name, 'zh-Hant') : x == null ? 1 : -1;
    return (ascending ? 1 : -1) * (typeof x === 'string' ? x.localeCompare(y as string, 'zh-Hant') : x - (y as number));
  });
  useEffect(() => {
    const params = new URLSearchParams({ sort, dir: ascending ? 'asc' : 'desc' });
    if (!automatic) params.set('source', 'reference');
    if (trafficMonth && trafficMonth !== data.trafficMonths.at(-1)) params.set('month', trafficMonth);
    if (query) params.set('q', query);
    window.history.replaceState(null, '', `/media/sources/?${params}`);
  }, [trafficMonth, sort, ascending, query, data.trafficMonths, automatic]);
  const chooseSort = (value: Sort) => {
    setAscending(sort === value ? !ascending : value === 'name');
    setSort(value);
  };

  return (
    <section aria-label="媒體流量與收錄清單" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          aria-label="搜尋媒體或網域"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="搜尋媒體或網域"
          className={`${control} w-44 max-w-full`}
        />
        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          流量月份
          <select
            aria-label="流量月份"
            className={control}
            value={trafficMonth}
            disabled={!data.trafficMonths.length}
            onChange={(e) => {
              setTrafficMonth(e.target.value);
            }}
          >
            {!data.trafficMonths.length && <option value="">尚無資料</option>}
            {data.trafficMonths.toReversed().map((month) => (
              <option key={month} value={month}>
                {shortMonth(month)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!crawlMonth && (
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400" role="status">
          目前無法取得本站收錄量。
        </p>
      )}
      {automatic && (
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400" role="status">
          每日自動更新 Similarweb 網域月訪問量估算；{data.liveTrafficStatus ? liveLabels[data.liveTrafficStatus] : '尚未抓取'}
          {data.liveTrafficError?.match(/HTTP \d+/)?.[0] ? `（${data.liveTrafficError.match(/HTTP \d+/)?.[0]}）` : ''}。
          {data.liveTrafficStatus && !['ok', 'pending'].includes(data.liveTrafficStatus) && '已有數值保留上次成功資料；缺資料顯示「—」。'}
          {!data.trafficMonths.length && '目前尚未取得流量數字。'}
        </p>
      )}
      {recentTrafficMonths.length > 0 && (
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400" role="status">
          Similarweb 流量由左至右為 {recentTrafficMonths.map(shortMonth).join('、')}；
          {automatic ? '單位為估算訪問次數，' : '單位依整理表原表值，'}排序依 {shortMonth(trafficMonth)}。
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full table-fixed text-sm tabular-nums">
          <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              {(
                [
                  { key: 'name', label: '媒體', sub: '' },
                  { key: 'articles', label: '本站收錄', sub: crawlMonth ? `${shortMonth(crawlMonth)} · 篇` : '篇' },
                  {
                    key: 'traffic',
                    label: automatic ? '估算月訪問量' : 'Similarweb 流量',
                    sub: automatic ? '訪問次數 · 全網域' : '原表值',
                  },
                ] as const
              ).map(({ key, label, sub }) => (
                <th
                  scope="col"
                  key={key}
                  aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}
                  className={`px-2 py-2 sm:px-4 ${key === 'name' ? 'w-[44%] text-left sm:w-1/2' : 'text-right'}`}
                >
                  <button type="button" onClick={() => chooseSort(key)} className="min-h-8 font-medium">
                    {label} <span aria-hidden="true">{sort === key ? (ascending ? '↑' : '↓') : '↕'}</span>
                    {sub && <span className="block text-[10px] font-normal">{sub}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((outlet) => {
              const point = trafficAt(outlet),
                count = articlesAt(outlet);
              const identity = (
                <>
                  {outlet.media ? (
                    <MediaIcon media={outlet.media} title={outlet.name} size={24} />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800"
                    >
                      {outlet.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{outlet.name}</span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {outlet.domain ??
                        (outlet.media && mediaNames[outlet.media]?.status === 'historical' ? '歷史來源・原網域已停用' : '網域待確認')}
                      {outlet.sourceKind === 'discovery' && ' · 文章發現來源'}
                    </span>
                  </span>
                </>
              );
              return (
                <tr
                  key={outlet.key}
                  data-media={outlet.key}
                  className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                >
                  <td className="px-2 py-2 sm:px-4">
                    {outlet.media ? (
                      <MediaHoverLink
                        media={outlet.media}
                        title={outlet.name}
                        icon={false}
                        className="flex items-center gap-2 hover:underline"
                      >
                        {identity}
                      </MediaHoverLink>
                    ) : (
                      <div className="flex items-center gap-2" title={outlet.name}>
                        {identity}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right sm:px-4">{count == null ? '—' : count.toLocaleString('zh-TW')}</td>
                  <td
                    className="px-2 py-2 text-right sm:px-4"
                    title={point?.adjusted ? `原表人工調整值 ${trafficNumber(point.rawTraffic)}` : undefined}
                  >
                    <div className="flex justify-end">
                      <TrafficHistory outlet={outlet} months={recentTrafficMonths} />
                    </div>
                    {outlet.trafficFetchedAt && (
                      <span className="block text-[10px] text-zinc-500">{outlet.trafficFetchedAt.slice(0, 10)} 更新</span>
                    )}
                    {(point?.adjusted || point?.ambiguous) && (
                      <span className="block text-[10px] text-zinc-500">{point.adjusted ? '人工調整' : '待核對'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <p className="p-8 text-center text-sm text-zinc-500">沒有符合條件的媒體。</p>}
      </div>
    </section>
  );
}
