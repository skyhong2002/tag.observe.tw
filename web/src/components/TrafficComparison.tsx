'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { localMediaIcon, mediaIconClass } from '@/lib/media-icons';
import { trafficNumber } from '@/lib/media-traffic.mts';
import { type ComparisonData, type ComparisonOutlet, collectionPoint, shortMonth } from '@/lib/traffic-comparison.mts';

const control = 'min-h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700';
type Sort = 'traffic' | 'articles' | 'name';

export default function TrafficComparison({ data, initial }: { data: ComparisonData; initial: Record<string, string | undefined> }) {
  const [trafficMonth, setTrafficMonth] = useState(
    data.trafficMonths.includes(initial.month ?? '') ? initial.month! : data.trafficMonths.at(-1)!,
  );
  const crawlMonth = data.crawlMonths.at(-1) ?? null;
  const [query, setQuery] = useState(initial.q ?? '');
  const [sort, setSort] = useState<Sort>(['traffic', 'articles', 'name'].includes(initial.sort ?? '') ? (initial.sort as Sort) : 'traffic');
  const [ascending, setAscending] = useState(initial.dir === 'asc');
  const [page, setPage] = useState(0);
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
  const pageCount = Math.max(1, Math.ceil(filtered.length / 40));
  const currentPage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(currentPage * 40, (currentPage + 1) * 40);
  useEffect(() => {
    const params = new URLSearchParams({ month: trafficMonth, sort, dir: ascending ? 'asc' : 'desc' });
    if (query) params.set('q', query);
    window.history.replaceState(null, '', `/media/sources/?${params}`);
  }, [trafficMonth, sort, ascending, query]);
  const chooseSort = (value: Sort) => {
    setPage(0);
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
            setPage(0);
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
            onChange={(e) => {
              setTrafficMonth(e.target.value);
              setPage(0);
            }}
          >
            {data.trafficMonths.toReversed().map((month) => (
              <option key={month} value={month}>
                {shortMonth(month)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400" role="status">
        {crawlMonth ? `本站收錄：${shortMonth(crawlMonth)} 發布、截至目前已抓取的文章，非媒體完整發稿量。` : '目前無法取得本站收錄量。'}{' '}
        Similarweb：{shortMonth(trafficMonth)} 月流量原表值。缺資料顯示「—」。
      </p>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full table-fixed text-sm tabular-nums">
          <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              {(
                [
                  { key: 'name', label: '媒體', sub: '' },
                  { key: 'articles', label: '本站收錄', sub: crawlMonth ? `${shortMonth(crawlMonth)} · 篇` : '篇' },
                  { key: 'traffic', label: 'Similarweb', sub: `${shortMonth(trafficMonth)} · 原表值` },
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
            {shown.map((outlet) => {
              const point = trafficAt(outlet),
                count = articlesAt(outlet);
              const icon = outlet.media ? localMediaIcon(outlet.media) : null;
              const identity = (
                <>
                  {icon ? (
                    <Image
                      src={icon}
                      alt=""
                      width={24}
                      height={24}
                      unoptimized
                      className={`h-6 w-6 shrink-0 rounded-sm object-contain ${mediaIconClass(outlet.media!)}`}
                    />
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
                      {outlet.sourceKind === 'discovery' ? '文章發現來源' : outlet.domain}
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
                      <Link
                        href={`/media/${encodeURIComponent(outlet.media)}/`}
                        title={outlet.name}
                        className="flex items-center gap-2 hover:underline"
                      >
                        {identity}
                      </Link>
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
                    {trafficNumber(point?.traffic ?? null)}
                    {(point?.adjusted || point?.ambiguous) && (
                      <span className="block text-[10px] text-zinc-500">{point.adjusted ? '人工調整' : '待核對'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <p className="p-8 text-center text-sm text-zinc-500">沒有符合條件的媒體。</p>}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>{filtered.length} 家 · 每頁 40 家</span>
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
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
            className="min-h-9 disabled:opacity-30"
          >
            下一頁
          </button>
        </div>
      </div>
    </section>
  );
}
