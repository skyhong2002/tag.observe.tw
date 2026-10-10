'use client';

import { useState } from 'react';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { table } from '@/lib/table-styles';

export type CollectionState = 'ok' | 'nodata' | 'waiting' | 'shared';
/** One publisher domain's fetch state; dates arrive formatted (Asia/Taipei) from the server. */
export interface CollectionRow {
  key: string;
  media: string | null;
  name: string;
  domain: string;
  sharedWith: string | null;
  similarweb: CollectionState;
  /** ISO time for sorting, label for display. */
  similarwebAt: string | null;
  similarwebLabel: string | null;
  profileMonth: string | null;
  radar: CollectionState;
  radarAt: string | null;
  radarLabel: string | null;
  radarPeriod: string | null;
}

const stateText: Record<CollectionState, string> = { ok: '已取得', nodata: '無資料', waiting: '等待抓取', shared: '共用網域' };
const stateTone: Record<CollectionState, string> = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  nodata: 'text-amber-700 dark:text-amber-400',
  waiting: 'text-zinc-500',
  shared: 'text-zinc-500',
};
const stateOrder: Record<CollectionState, number> = { waiting: 0, nodata: 1, ok: 2, shared: 3 };
type Sort = 'name' | 'similarweb' | 'radar';

function State({ state, sharedWith, at }: { state: CollectionState; sharedWith: string | null; at: string | null }) {
  return (
    <span className={stateTone[state]} title={state === 'shared' && sharedWith ? `整個網域的數字列在${sharedWith}` : undefined}>
      {stateText[state]}
      {at && <span className="ml-1.5 text-zinc-500">{at}</span>}
    </span>
  );
}

export default function TrafficCollectionTable({ rows }: { rows: CollectionRow[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('similarweb');
  const [descending, setDescending] = useState(false);
  const needle = query.trim().toLocaleLowerCase();
  const shown = rows.filter((row) => `${row.name} ${row.domain} ${row.media ?? ''}`.toLocaleLowerCase().includes(needle));
  // Default: what still needs fetching first, then the oldest successes.
  const key = (row: CollectionRow): [number, string] =>
    sort === 'name'
      ? [0, row.name]
      : sort === 'similarweb'
        ? [stateOrder[row.similarweb], row.similarwebAt ?? '']
        : [stateOrder[row.radar], row.radarAt ?? ''];
  shown.sort((a, b) => {
    const [x1, x2] = key(a);
    const [y1, y2] = key(b);
    const order = x1 - y1 || x2.localeCompare(y2, 'zh-Hant') || a.name.localeCompare(b.name, 'zh-Hant');
    return descending ? -order : order;
  });
  const choose = (value: Sort) => {
    setDescending(sort === value ? !descending : false);
    setSort(value);
  };
  const columns: Array<{ key: Sort; label: string; sub: string }> = [
    { key: 'name', label: '媒體', sub: '網域' },
    { key: 'similarweb', label: 'Similarweb', sub: '狀態 · 最近成功 · 國家與導流月份' },
    { key: 'radar', label: 'Cloudflare Radar', sub: '狀態 · 最近成功 · 資料期末' },
  ];
  return (
    <section aria-label="流量資料抓取狀態" className="space-y-3">
      <input
        aria-label="搜尋媒體或網域"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋媒體或網域"
        className="min-h-9 w-44 max-w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
      />
      <TableScroller card label="流量資料抓取狀態表格，可左右捲動">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-xs text-zinc-500 dark:text-zinc-400">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort === column.key ? (descending ? 'descending' : 'ascending') : 'none'}
                  className={column.key === 'name' ? `${table.leadHead} text-left` : `${table.cell} text-left`}
                >
                  <button type="button" onClick={() => choose(column.key)} className="min-h-8 text-left font-medium whitespace-nowrap">
                    {column.label} <SortIndicator active={sort === column.key} descending={descending} />
                    <span className="block text-[10px] font-normal">{column.sub}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const identity = (
                <>
                  {row.media && <MediaIcon media={row.media} title={row.name} size={20} />}
                  <span className="min-w-0">
                    <span className={`${table.leadText} block font-medium`}>{row.name}</span>
                    <span className={`${table.leadExtra} ${table.leadText} block text-[10px] text-zinc-500`}>{row.domain}</span>
                  </span>
                </>
              );
              return (
                <tr key={row.key} className={`${table.row} border-t border-zinc-200 dark:border-zinc-800`}>
                  <td className={`${table.lead} py-1.5`}>
                    <div className={table.leadBox}>
                      {row.media ? (
                        <MediaHoverLink media={row.media} title={row.name} icon={false} className="flex items-center gap-2 hover:underline">
                          {identity}
                        </MediaHoverLink>
                      ) : (
                        <div className="flex items-center gap-2">{identity}</div>
                      )}
                    </div>
                  </td>
                  <td className={`${table.cell} py-1.5 whitespace-nowrap`}>
                    <State state={row.similarweb} sharedWith={row.sharedWith} at={row.similarwebLabel} />
                    {row.profileMonth && <span className="ml-1.5 text-zinc-500">· {row.profileMonth}</span>}
                  </td>
                  <td className={`${table.cell} py-1.5 whitespace-nowrap`}>
                    <State state={row.radar} sharedWith={row.sharedWith} at={row.radarLabel} />
                    {row.radarPeriod && <span className="ml-1.5 text-zinc-500">· {row.radarPeriod}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <p className="p-8 text-center text-sm text-zinc-500">沒有符合條件的網域。</p>}
      </TableScroller>
    </section>
  );
}
