'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const links = [
  { href: '/', label: '首頁' },
  { href: '/ranking/', label: '關鍵字' },
  { href: '/similarity/', label: '新聞關係圖' },
  { href: '/journalist/', label: '記者' },
  { href: '/event/', label: '事件表' },
  { href: '/topic/', label: '議題表' },
  { href: '/feature/', label: '專題' },
  { href: '/media/', label: '媒體' },
];

export default function SiteNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resize = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    desktop.addEventListener('change', resize);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      desktop.removeEventListener('change', resize);
    };
  }, [open]);
  return (
    <div ref={container}>
      <button
        ref={toggle}
        type="button"
        aria-label={open ? '關閉導覽選單' : '開啟導覽選單'}
        aria-expanded={open}
        aria-controls="site-navigation"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d={open ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
        </svg>
      </button>
      <nav
        id="site-navigation"
        className={`${open ? 'grid' : 'hidden'} absolute inset-x-0 top-full grid-cols-2 gap-1 border-b border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:flex lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:dark:bg-transparent`}
        aria-label="主要導覽"
      >
        {links.map(({ href, label }) => {
          const exact = pathname === href || `${pathname}/` === href;
          const current = exact || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
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
    </div>
  );
}
