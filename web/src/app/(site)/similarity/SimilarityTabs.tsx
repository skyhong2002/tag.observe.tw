import Link from 'next/link';

/** Sub-pages of the relationship graph; the period and threshold carry across. */
export default function SimilarityTabs({ current, query }: { current: 'graph' | 'sources' | 'daily' | 'about'; query: string }) {
  return (
    <nav
      aria-label="新聞關係圖"
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-900"
    >
      {[
        { key: 'graph', href: '/similarity/', label: '關係探索' },
        { key: 'sources', href: '/similarity/sources/', label: '來源排行' },
        { key: 'daily', href: '/similarity/daily/', label: '每日趨勢' },
        { key: 'about', href: '/similarity/about/', label: '擷取狀態' },
      ].map((tab) => (
        <Link
          key={tab.key}
          href={query ? `${tab.href}?${query}` : tab.href}
          aria-current={current === tab.key ? 'page' : undefined}
          className={`flex min-h-9 items-center whitespace-nowrap rounded-md px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${current === tab.key ? 'bg-white font-medium text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
