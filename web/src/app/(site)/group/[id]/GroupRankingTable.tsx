'use client';

import Link from 'next/link';
import { useState } from 'react';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import type { TagGroupRanking } from '@/lib/api';
import { table } from '@/lib/table-styles';

type Row = TagGroupRanking['ranking'][number];
type SortKey = 'recent' | 'previous' | 'change';

const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}/`;
const change = (r: Row) => r.recent - r.previous;

/** A group's busiest tags (docs/tag-groups.md): reports in the last `days`
 *  against the `days` before, sortable, one line per row. */
export default function GroupRankingTable({
  rows,
  days,
  subgroupLabel,
}: {
  rows: Row[];
  days: number;
  subgroupLabel: Record<number, string>;
}) {
  const [sort, setSort] = useState<SortKey>('recent');
  const [descending, setDescending] = useState(true);
  const value = (r: Row) => (sort === 'recent' ? r.recent : sort === 'previous' ? r.previous : change(r));
  const sorted = [...rows].sort((a, b) => (descending ? value(b) - value(a) : value(a) - value(b)) || b.recent - a.recent);
  const rank = new Map(rows.map((r, i) => [r.tag, i + 1]));
  const withSubgroups = Object.keys(subgroupLabel).length > 0;
  const sortBy = (key: SortKey) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(true);
    }
  };
  const head = (key: SortKey, label: string) => (
    <th aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'} className={`${table.num} !py-1.5 font-medium`}>
      <button
        type="button"
        onClick={() => sortBy(key)}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-brand-700 ${sort === key ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <SortIndicator active={sort === key} descending={descending} />
      </button>
    </th>
  );
  return (
    <TableScroller card label="群組標籤比較，可左右捲動">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-600 dark:text-zinc-400">
          <tr className="bg-(--table-head-bg)">
            <th className={`${table.leadHead} !py-1.5 font-medium`}>標籤</th>
            <th className={`${table.num} !py-1.5 font-medium`}>名次</th>
            {head('recent', `近 ${days} 天篇數`)}
            {head('previous', `前 ${days} 天`)}
            {head('change', '增減')}
            {withSubgroups && <th className={`${table.cell} !py-1.5 font-medium whitespace-nowrap`}>子群組</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((r) => {
            const delta = change(r);
            return (
              <tr key={r.tag} className={`${table.row} whitespace-nowrap`}>
                <th scope="row" className={`${table.lead} !py-1.5 text-left font-normal`}>
                  <div className={table.leadBox}>
                    <Link href={tagHref(r.tag)} className={`${table.leadText} block hover:underline`}>
                      {r.tag}
                    </Link>
                  </div>
                </th>
                <td className={`${table.num} !py-1.5 text-zinc-500`}>{rank.get(r.tag)}</td>
                <td className={`${table.num} !py-1.5 font-medium`}>{r.recent.toLocaleString('zh-TW')}</td>
                <td className={`${table.num} !py-1.5 text-zinc-500`}>{r.previous.toLocaleString('zh-TW')}</td>
                <td
                  className={`${table.num} !py-1.5 ${delta > 0 ? 'text-red-700 dark:text-red-400' : delta < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}`}
                >
                  {delta > 0 ? `+${delta.toLocaleString('zh-TW')}` : delta.toLocaleString('zh-TW')}
                </td>
                {withSubgroups && (
                  <td className={`${table.cell} !py-1.5 text-xs text-zinc-600 dark:text-zinc-400`}>
                    {r.groups
                      .map((g) => subgroupLabel[g])
                      .filter(Boolean)
                      .join('、')}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroller>
  );
}
