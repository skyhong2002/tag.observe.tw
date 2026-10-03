import Link from 'next/link';

export default function MediaTabs({ current }: { current: 'media' | 'sources' }) {
  return (
    <nav aria-label="媒體資料" className="mb-5 inline-flex max-w-full gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
      {[
        { key: 'media', href: '/media/', label: '收錄概況' },
        { key: 'sources', href: '/media/sources/', label: '流量與收錄比較' },
      ].map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? 'page' : undefined}
          className={`flex min-h-9 items-center rounded-md px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${current === tab.key ? 'bg-white font-medium text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
