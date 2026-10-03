'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: '首頁' },
  { href: '/ranking/', label: '排行榜' },
  { href: '/similarity/', label: '內文相似度' },
  { href: '/event/', label: '事件表' },
  { href: '/topic/', label: '議題表' },
  { href: '/media/', label: '媒體' },
];

export default function SiteNavigation() {
  const pathname = usePathname();
  return (
    <nav className="grid w-full grid-cols-3 gap-1 text-sm sm:flex lg:w-auto" aria-label="主要導覽">
      {links.map(({ href, label }) => {
        const exact = pathname === href || `${pathname}/` === href;
        const current = exact || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? (exact ? 'page' : 'location') : undefined}
            className={`flex min-h-10 items-center justify-center whitespace-nowrap rounded-md px-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              current
                ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
