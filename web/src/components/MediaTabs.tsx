import Link from 'next/link';

export default function MediaTabs({ current }: { current: 'media' | 'sources' }) {
  return (
    <nav aria-label="媒體資料" className="mb-6 flex gap-5 border-b border-zinc-300 text-sm dark:border-zinc-700">
      {[
        { key: 'media', href: '/media/', label: '收錄與文章數' },
        { key: 'sources', href: '/media/sources/', label: '媒體來源與流量' },
      ].map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? 'page' : undefined}
          className={`border-b-2 pb-3 ${current === tab.key ? 'border-current font-semibold' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
