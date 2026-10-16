import Link from 'next/link';
import { sectionOf } from '@/lib/site-nav';

// Tabs switch what you are looking at: a sibling page, or another mode or
// view of the same list (熱門排行／正在發酵, 每日／每小時). Narrowing values
// (period, category, status) are FilterChips, so the two never look alike.

// Shared with TabButtons, the same tabs for switches that do not change the URL.
// Rows wrap rather than scroll, so every tab stays visible on a phone.
export const tabRowClass = 'inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-900';
export const tabClass = (current: boolean) =>
  `flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${current ? 'bg-white font-medium text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`;

/** A row of tabs. In-page switches pass `scroll={false}` to keep the reader's place. */
export function TabRow({
  label,
  tabs,
  scroll = true,
  className = '',
}: {
  label: string;
  tabs: Array<{ href: string; label: string; current?: boolean }>;
  scroll?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={`${tabRowClass} ${className}`}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          scroll={scroll}
          aria-current={tab.current ? 'page' : undefined}
          className={tabClass(!!tab.current)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** The tabs of the section `here` belongs to, from site-nav; sits above the page's h1.
 *  `query` carries what the sibling pages share (period, threshold) across. */
export default function SectionTabs({ here, query = '', className }: { here: string; query?: string; className?: string }) {
  const section = sectionOf(here);
  if (!section) return null;
  return (
    <TabRow
      label={section.label}
      className={className}
      tabs={section.tabs.map((tab) => ({ href: query ? `${tab.href}?${query}` : tab.href, label: tab.label, current: tab.href === here }))}
    />
  );
}
