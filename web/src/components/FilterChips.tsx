import Link from 'next/link';
import RowScrollHint from './RowScrollHint';

/** One filter chip; `muted` greys out a choice that has little or no data. */
export const filterChipClass = (current: boolean, muted = false) =>
  `inline-flex min-h-8 items-center whitespace-nowrap rounded-full px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
    current
      ? 'bg-brand-700 text-white'
      : `bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 ${muted ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`
  }`;
export const filterRowClass = 'flex flex-wrap items-center gap-1.5 text-sm';
export const filterLabelClass = 'mr-1 text-xs text-zinc-600 dark:text-zinc-400';

export type FilterChip = { href: string; label: string; current?: boolean; note?: string };

/** Values that narrow the list you are on (period, category, threshold), as round chips;
 *  switching to another page, mode or view is a TabRow. `showLabel` prints the label when a page has several rows.
 *  A chip's `note` (資料不足) is printed small and greys the chip out. */
export default function FilterChips({
  label,
  items,
  showLabel = false,
  scrollOnPhone = false,
  className = '',
}: {
  label: string;
  items: FilterChip[];
  showLabel?: boolean;
  /** Phones keep the row on one line that scrolls sideways (with a faded edge) instead of wrapping into many lines. */
  scrollOnPhone?: boolean;
  className?: string;
}) {
  const phoneRow = scrollOnPhone
    ? 'max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-3.5rem),transparent_calc(100%-0.5rem))] [scrollbar-width:none]'
    : '';
  const row = (
    <nav aria-label={label} className={`${filterRowClass} ${phoneRow} ${scrollOnPhone ? '' : className}`}>
      {showLabel && <span className={`${filterLabelClass} shrink-0 sm:min-w-14`}>{label}</span>}
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.current ? 'page' : undefined}
          className={`${filterChipClass(Boolean(item.current), Boolean(item.note))} shrink-0`}
        >
          {item.label}
          {item.note && <span className="ml-1.5 text-xs">{item.note}</span>}
        </Link>
      ))}
    </nav>
  );
  if (!scrollOnPhone) return row;
  // On a phone the faded edge alone did not read as "more to the right": an arrow sits over it while it does.
  return <RowScrollHint className={className}>{row}</RowScrollHint>;
}
