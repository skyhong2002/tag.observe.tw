import Link from 'next/link';
import { CAMP_FILL, CAMP_LABEL } from '@/components/CampBar';
import ExpandRows from '@/components/ExpandRows';
import MediaHoverLink from '@/components/MediaHoverLink';
import { taipei } from '@/lib/api';
import { CAMP_ORDER, type OutletRow, type OutletSort, sortOutletRows } from '@/lib/event-thread.mts';
import { articleHref } from '@/lib/reading.mts';
import { CAMP_TEXT, CampDot } from './sections';

const card = 'rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900';

/** Per-outlet counts, sortable through the URL like the /media tables. */
export default function OutletTable({
  rows,
  sort,
  dir,
  hrefs,
  initial = 5,
}: {
  rows: OutletRow[];
  sort: OutletSort;
  dir: 'asc' | 'desc';
  /** Link for each column header: toggles direction on the active column, default direction elsewhere. */
  hrefs: Record<OutletSort, string>;
  initial?: number;
}) {
  const collator = new Intl.Collator('zh-Hant-TW-u-co-stroke');
  const sorted = sortOutletRows(rows, sort, dir, collator);
  const shown = sorted.slice(0, initial);
  const rest = sorted.slice(initial);
  const max = Math.max(1, ...rows.map((r) => r.articles));
  const total = rows.reduce((n, r) => n + r.articles, 0);
  const Th = ({ col, label, className = '' }: { col: OutletSort; label: string; className?: string }) => (
    <th
      className={`px-3 py-2 font-medium ${className}`}
      aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <Link
        href={hrefs[col]}
        scroll={false}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-brand-700 ${sort === col ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <span aria-hidden className={sort === col ? '' : 'invisible'}>
          {dir === 'asc' ? '▲' : '▼'}
        </span>
      </Link>
    </th>
  );
  const row = (r: OutletRow) => (
    <tr key={r.media} className="group hover:bg-brand-50/60 dark:hover:bg-zinc-800/60">
      <td className="sticky left-0 z-10 bg-white px-3 py-2 group-hover:bg-brand-50 dark:bg-zinc-900 dark:group-hover:bg-zinc-800">
        <MediaHoverLink media={r.media} icon={16} className="flex items-center gap-2 font-medium hover:underline">
          <span className="whitespace-nowrap">{r.title}</span>
        </MediaHoverLink>
      </td>
      <td className={`whitespace-nowrap px-3 py-2 text-xs ${CAMP_TEXT[r.camp]}`}>
        <span className="inline-flex items-center gap-1">
          <CampDot camp={r.camp} />
          {CAMP_LABEL[r.camp]}
        </span>
      </td>
      <td className="px-3 py-2" title={`${r.title}：${r.articles} 篇，佔 ${Math.round((r.articles / Math.max(total, 1)) * 100)}%`}>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1" aria-hidden>
            <div className={`h-2 rounded-r ${CAMP_FILL[r.camp]}`} style={{ width: `${Math.max(1.5, (r.articles / max) * 100)}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums">{r.articles}</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{taipei(r.first)}</td>
      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{taipei(r.last)}</td>
      <td className="max-w-[24rem] px-3 py-2">
        <Link href={articleHref(r.latest)} className="line-clamp-1 hover:underline" title={r.latest.title}>
          {r.latest.title}
        </Link>
      </td>
    </tr>
  );
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
          <tr>
            <Th col="title" label="媒體" className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-950" />
            <Th col="camp" label="傾向" />
            <Th col="articles" label="篇數" className="w-[26%] min-w-40" />
            <Th col="first" label="最早報導" />
            <Th col="last" label="最新報導" />
            <th className="px-3 py-2 font-medium">最新標題</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {shown.map(row)}
          {rest.length > 0 && <ExpandRows rest={rest.map(row)} hidden={rest.length} shown={initial} colSpan={6} />}
        </tbody>
        <tfoot className="border-t border-zinc-300 bg-zinc-50 font-medium dark:border-zinc-700 dark:bg-zinc-950">
          <tr>
            <th scope="row" className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left font-medium dark:bg-zinc-950">
              合計 {rows.length} 家
            </th>
            <td className="px-3 py-2 text-xs">
              {CAMP_ORDER.map((c) => {
                const n = rows.filter((r) => r.camp === c).length;
                return n ? (
                  <span key={c} className={`mr-2 whitespace-nowrap ${CAMP_TEXT[c]}`}>
                    {CAMP_LABEL[c]} {n}
                  </span>
                ) : null;
              })}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{total}</td>
            <td className="px-3 py-2 text-xs">
              {CAMP_ORDER.map((c) => {
                const n = rows.filter((r) => r.camp === c).reduce((s, r) => s + r.articles, 0);
                return n ? (
                  <span key={c} className={`mr-2 whitespace-nowrap ${CAMP_TEXT[c]}`}>
                    {CAMP_LABEL[c]} {n} 篇
                  </span>
                ) : null;
              })}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
