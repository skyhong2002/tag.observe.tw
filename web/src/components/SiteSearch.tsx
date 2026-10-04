'use client';

import { useEffect, useRef, useState } from 'react';

export default function SiteSearch() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={container}>
      <button
        ref={toggle}
        type="button"
        aria-label={open ? '關閉新聞搜尋' : '搜尋新聞'}
        aria-expanded={open}
        aria-controls="site-search"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-brand-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
      </button>
      <search
        id="site-search"
        aria-label="新聞搜尋"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <form action="/search/" className="mx-auto flex max-w-xl items-center gap-2">
          <input
            ref={input}
            name="q"
            type="search"
            aria-label="搜尋所有新聞的標題、摘要與標籤"
            placeholder="搜尋新聞"
            maxLength={60}
            required
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-zinc-900 focus-visible:outline-brand-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button type="submit" className="shrink-0 rounded-md bg-brand-700 px-4 py-2 text-sm text-white hover:bg-brand-800">
            搜尋
          </button>
        </form>
      </search>
    </div>
  );
}
