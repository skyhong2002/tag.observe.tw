'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import SiteNavigation from './SiteNavigation';
import SiteSearch from './SiteSearch';
import ThemeToggle from './ThemeToggle';
import Wordmark from './Wordmark';

export default function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  function closeSearch() {
    setSearchOpen(false);
    searchToggle.current?.focus();
  }
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-300 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 lg:gap-3">
        <Link href="/" className={`${searchOpen ? 'hidden lg:block' : ''} shrink-0`} aria-label="新文易數 首頁">
          <Wordmark className="h-6 w-auto" />
        </Link>
        <div className="order-3 lg:order-none">
          <SiteNavigation />
        </div>
        <div className={`ml-auto flex min-w-0 items-center gap-1 lg:w-44 lg:flex-none ${searchOpen ? 'flex-1' : ''}`}>
          <button
            ref={searchToggle}
            type="button"
            aria-label={searchOpen ? '關閉新聞搜尋' : '搜尋新聞'}
            aria-expanded={searchOpen}
            aria-controls="header-search"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            className="flex h-10 w-8 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              {searchOpen ? (
                <path d="m6 6 12 12M6 18 18 6" />
              ) : (
                <>
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 5 5" />
                </>
              )}
            </svg>
          </button>
          <div id="header-search" className={`${searchOpen ? 'block' : 'hidden'} min-w-0 flex-1 lg:block`}>
            <SiteSearch inputRef={searchInput} onEscape={closeSearch} />
          </div>
        </div>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
