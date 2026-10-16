import Link from 'next/link';

/** Values that narrow the list you are on (period, category, threshold), as round chips;
 *  switching to another page, mode or view is a TabRow. `showLabel` prints the label when a page has several rows. */
export default function FilterChips({
  label,
  items,
  showLabel = false,
  className = '',
}: {
  label: string;
  items: Array<{ href: string; label: string; current?: boolean }>;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={`flex flex-wrap items-center gap-1.5 text-sm ${className}`}>
      {showLabel && <span className="mr-1 text-xs text-zinc-500 dark:text-zinc-400">{label}</span>}
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.current ? 'page' : undefined}
          className={`whitespace-nowrap rounded-full px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${item.current ? 'bg-brand-700 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
