import Link from 'next/link';
import TableScroller from '@/components/TableScroller';
import type { FlowColumn, FlowRow } from '@/lib/keyword-flow.mts';
import { table } from '@/lib/table-styles';

// Keywords left to right: one row per keyword, one column per hour or day.
// Consecutive columns join into one bar, so a keyword that carried the story
// for a stretch reads as a single link across the axis; the bar's start is
// marked where the keyword first came in.

const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}/`;

export default function KeywordFlow({
  columns,
  rows,
  dense = false,
  unit,
  label,
}: {
  columns: FlowColumn[];
  rows: FlowRow[];
  /** Narrow columns for an hourly axis. */
  dense?: boolean;
  /** What a cell's raw value is, for the tooltip ("分數", "名次分"). */
  unit: string;
  label: string;
}) {
  if (columns.length < 2 || rows.length === 0) return null;
  // Hourly axes are long and scroll; a few days or one day's hours share the width.
  const width = dense ? 'min-w-5 w-5' : 'min-w-10';
  // Dense axes label every third hour and each day's start, so labels never collide.
  const shown = (c: FlowColumn) => !dense || c.label.includes('/') || Number(c.label) % 3 === 0;
  return (
    <TableScroller card startAtEnd label={`${label}，可左右捲動`}>
      <table className={`${dense ? 'w-max' : 'w-full'} border-separate border-spacing-0 text-xs`}>
        <caption className="sr-only">{label}</caption>
        <thead className="text-zinc-500">
          <tr className="bg-(--table-head-bg)">
            <th scope="col" className={`${table.leadHead} w-28 !py-1.5 text-left font-medium`}>
              關鍵字
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`${width} px-0 py-1.5 font-normal tabular-nums whitespace-nowrap ${dense ? 'overflow-visible text-left' : 'text-center'} ${
                  c.label.includes('/') && dense ? 'text-zinc-800 dark:text-zinc-200' : ''
                }`}
                title={c.title}
              >
                {!shown(c) ? (
                  <span className="sr-only">{c.title}</span>
                ) : c.href ? (
                  <Link href={c.href} className="hover:text-brand-700 hover:underline dark:hover:text-brand-400">
                    {c.label}
                  </Link>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tag} className={table.row}>
              <th scope="row" className={`${table.lead} !py-0.5 text-left font-normal whitespace-nowrap`}>
                <Link
                  href={tagHref(r.tag)}
                  className={`hover:underline ${r.major ? 'font-medium text-brand-700 dark:text-brand-400' : 'text-zinc-700 dark:text-zinc-300'}`}
                >
                  {r.tag}
                </Link>
              </th>
              {r.cells.map((v, i) => {
                const col = columns[i];
                if (v === null) return <td key={col.key} className="px-0 py-0.5" />;
                const joinLeft = i > 0 && r.cells[i - 1] !== null;
                const joinRight = i < r.cells.length - 1 && r.cells[i + 1] !== null;
                const raw = r.raw[i] ?? 0;
                return (
                  <td key={col.key} className="px-0 py-0.5" title={`${r.tag} · ${col.title} · ${unit} ${raw.toFixed(raw >= 10 ? 0 : 1)}`}>
                    <span
                      className={`relative block h-3.5 ${joinLeft ? '' : 'ml-0.5 rounded-l-full'} ${joinRight ? '' : 'mr-0.5 rounded-r-full'} ${
                        r.major ? 'bg-brand-600 dark:bg-brand-500' : 'bg-sky-600 dark:bg-sky-500'
                      }`}
                      style={{ opacity: v }}
                    >
                      {i === r.first && i > 0 && (
                        <span className="absolute -left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-zinc-900 ring-2 ring-white dark:bg-zinc-100 dark:ring-zinc-900" />
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroller>
  );
}

/** One line under the chart saying how to read it. */
export function KeywordFlowLegend({ children, major = true }: { children?: React.ReactNode; major?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-zinc-900 ring-2 ring-white dark:bg-zinc-100 dark:ring-zinc-900" aria-hidden />
        關鍵字加入的時間
      </span>
      {major && (
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-6 rounded-full bg-brand-600 dark:bg-brand-500" aria-hidden />
          主要關鍵字
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-6 rounded-full bg-sky-600 opacity-40 dark:bg-sky-500" aria-hidden />
        <span className="h-2.5 w-6 rounded-full bg-sky-600 dark:bg-sky-500" aria-hidden />
        顏色越深越熱
      </span>
      {children}
    </p>
  );
}
