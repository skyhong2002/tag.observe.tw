'use client';

import Link from 'next/link';
import { useState } from 'react';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import type { ThreadHour } from '@/lib/event-thread.mts';
import { table } from '@/lib/table-styles';

type SortKey = 'time' | 'rank' | 'score';
// Newest first, best rank first, highest score first.
const FIRST_DESCENDING: Record<SortKey, boolean> = { time: true, rank: false, score: true };
const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}/`;
const atLink = (iso: string) => `/event/?at=${encodeURIComponent(iso)}`;
const chip = 'whitespace-nowrap rounded-full px-2 py-0.5 text-xs';

/** Hour by hour: rank, score, and the hour's own top tags, so a reader can see
 *  which angle carried the story at each point. One line per hour; phones
 *  scroll the tag columns sideways like the other data tables. */
export default function HourTable({
  hours,
  maxScore,
}: {
  /** `label` is the hour formatted on the server; the browser's date formatting can differ and break hydration. */
  hours: Array<ThreadHour & { label: string }>;
  maxScore: number;
}) {
  const [sort, setSort] = useState<SortKey>('time');
  const [descending, setDescending] = useState(true);
  const value = (h: ThreadHour) => (sort === 'time' ? Date.parse(h.hourStart) : sort === 'rank' ? h.rank : h.score);
  const rows = [...hours].sort(
    (a, b) => (descending ? value(b) - value(a) : value(a) - value(b)) || b.hourStart.localeCompare(a.hourStart),
  );
  const sortBy = (key: SortKey) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(FIRST_DESCENDING[key]);
    }
  };
  const head = (key: SortKey, label: string, className: string) => (
    <th aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'} className={`${className} !py-1.5 font-medium`}>
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
    <TableScroller card label="每小時名次與標籤，可左右捲動">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-600 dark:text-zinc-400">
          <tr className="bg-(--table-head-bg)">
            {head('time', '時間', table.leadHead)}
            {head('rank', '名次', table.num)}
            {head('score', '分數', table.cell)}
            <th className={`${table.cell} !py-1.5 font-medium whitespace-nowrap`}>主要標籤</th>
            <th className={`${table.cell} !py-1.5 font-medium whitespace-nowrap`}>其他高分標籤</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((h) => {
            const others = h.tags.filter(([t]) => !h.major.includes(t)).slice(0, 6);
            return (
              <tr key={h.hourStart} className={`${table.row} whitespace-nowrap`}>
                <th scope="row" className={`${table.lead} !py-1.5 text-left font-normal tabular-nums`}>
                  <Link href={atLink(h.hourStart)} className="hover:underline" title="看這個小時的整張事件表">
                    {h.label}
                  </Link>
                </th>
                <td className={`${table.num} !py-1.5 font-medium ${h.rank === 1 ? 'text-brand-700 dark:text-brand-400' : ''}`}>{h.rank}</td>
                <td className={`${table.cell} !py-1.5`}>
                  <span className="inline-flex items-center gap-1.5 tabular-nums text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-200 sm:w-16 dark:bg-zinc-800" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-brand-600 dark:bg-brand-500"
                        style={{ width: `${Math.max(3, (h.score / Math.max(maxScore, 1e-9)) * 100)}%` }}
                      />
                    </span>
                    {h.score.toFixed(1)}
                  </span>
                </td>
                <td className={`${table.cell} !py-1.5`}>
                  <span className="flex gap-1">
                    {h.major.map((m) => (
                      <Link key={m} href={tagHref(m)} className={`${chip} bg-brand-700 font-medium text-white dark:bg-brand-600`}>
                        {m}
                      </Link>
                    ))}
                  </span>
                </td>
                <td className={`${table.cell} !py-1.5`}>
                  <span className="flex gap-1">
                    {others.map(([t, s]) => (
                      <Link
                        key={t}
                        href={tagHref(t)}
                        className={`${chip} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`}
                        title={`分數 ${s.toFixed(1)}`}
                      >
                        {t}
                        <span className="ml-1 tabular-nums text-zinc-500">{s.toFixed(0)}</span>
                      </Link>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroller>
  );
}
