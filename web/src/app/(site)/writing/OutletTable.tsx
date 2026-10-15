'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import MediaHoverLink from '@/components/MediaHoverLink';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { table } from '@/lib/table-styles';

export interface OutletRow {
  media: string;
  name: string;
  articles: number;
  values: Record<string, number>;
}
export interface OutletColumn {
  key: string;
  label: string;
  hint?: string;
  /** Share of the outlet's analysed articles, or of the column given here. */
  of?: string;
  /** Query added to the cell's link, e.g. { role: '醫療健康' }. */
  filter?: Record<string, string>;
}

const pct = (part: number, whole: number) => (whole ? part / whole : -1);

/** Outlets with shares per column, sortable; a column's link filters the list below. */
export default function OutletTable({
  rows,
  columns,
  caption,
  path,
  query,
}: {
  rows: OutletRow[];
  columns: OutletColumn[];
  caption: string;
  /** Cells link to path with query plus media (and the column's filter). */
  path: string;
  query: Record<string, string>;
}) {
  const hrefFor = (media: string, filter?: Record<string, string>) =>
    `${path}?${new URLSearchParams({ ...query, ...filter, media })}#articles`;
  const [sort, setSort] = useState<string>(columns[0].key);
  const [descending, setDescending] = useState(true);
  const whole = (row: OutletRow, column: OutletColumn) => (column.of ? row.values[column.of] : row.articles);
  const sorted = useMemo(() => {
    const value = (row: OutletRow) => {
      if (sort === 'articles') return row.articles;
      const column = columns.find((c) => c.key === sort);
      return column ? pct(row.values[column.key] ?? 0, whole(row, column)) : 0;
    };
    return [...rows].sort((a, b) => {
      const order = sort === 'name' ? a.name.localeCompare(b.name, 'zh-Hant') : value(a) - value(b);
      return (descending ? -order : order) || b.articles - a.articles;
    });
  }, [rows, columns, sort, descending]);
  const sortBy = (key: string) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(key !== 'name');
    }
  };
  const head = (key: string, label: string, hint?: string, numeric = true) => (
    <th
      key={key}
      scope="col"
      aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}
      className={`${numeric ? table.num : table.leadHead} font-medium`}
    >
      <button
        type="button"
        title={hint}
        onClick={() => sortBy(key)}
        className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-brand-700 dark:hover:text-brand-400 ${sort === key ? 'text-brand-800 dark:text-brand-300' : ''}`}
      >
        {label}
        <SortIndicator active={sort === key} descending={descending} />
      </button>
    </th>
  );
  return (
    <TableScroller label={`${caption}，可左右捲動`}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-left text-xs text-zinc-500 dark:text-zinc-400">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {head('name', '媒體', undefined, false)}
            {head('articles', '分析篇數', '有取得內文、已分析的文章')}
            {columns.map((c) => head(c.key, c.label, c.hint))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {sorted.map((row) => (
            <tr key={row.media} className={table.row}>
              <th scope="row" className={`${table.lead} text-left font-normal`}>
                <div className={table.leadBox}>
                  <MediaHoverLink media={row.media} title={row.name} className="text-brand-700 hover:underline dark:text-brand-400">
                    <span className={table.leadText}>{row.name}</span>
                  </MediaHoverLink>
                </div>
              </th>
              <td className={table.num}>{row.articles.toLocaleString('zh-TW')}</td>
              {columns.map((c) => {
                const n = row.values[c.key] ?? 0;
                const share = pct(n, whole(row, c));
                return (
                  <td key={c.key} className={`${table.num} ${n ? '' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    {n ? (
                      <Link href={hrefFor(row.media, c.filter)} className="hover:underline" title={`${n.toLocaleString('zh-TW')} 篇`}>
                        {(100 * share).toFixed(1)}%
                      </Link>
                    ) : (
                      '0'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">這段期間還沒有足夠的分析資料。</p>}
    </TableScroller>
  );
}
