'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * A one-line row that may scroll sideways on a phone (FilterChips scrollOnPhone):
 * an arrow over its faded right edge while more of it is hidden, gone once the
 * reader reaches the end or when everything fits.
 */
export default function RowScrollHint({ children, className = '' }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const row = box.current?.firstElementChild as HTMLElement | null;
    if (!row) return;
    const update = () => setMore(row.scrollWidth - row.clientWidth - row.scrollLeft > 4);
    update();
    row.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => {
      row.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);
  return (
    <div ref={box} className={`relative ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 -right-1 -translate-y-1/2 pb-1 text-base font-semibold text-brand-700 transition-opacity sm:hidden dark:text-brand-400 ${more ? 'opacity-100' : 'opacity-0'}`}
      >
        →
      </span>
    </div>
  );
}
