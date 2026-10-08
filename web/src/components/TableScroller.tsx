'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

type ScrollX = 'none' | 'start' | 'middle' | 'end';

/**
 * Horizontal scroll container for wide tables. Marks where the table is
 * scrolled to (data-scroll-x) so the sticky lead column can cast a shadow and
 * the right edge fades while more columns are hidden. `card` draws the usual
 * rounded border and switches the colour tokens to the card tone.
 */
export default function TableScroller({
  children,
  card = false,
  label = '可左右捲動的表格',
  className = '',
  footer,
  startAtEnd = false,
}: {
  children: ReactNode;
  card?: boolean;
  label?: string;
  className?: string;
  /** Rendered inside the card below the scrolling area, e.g. a "show more" link. */
  footer?: ReactNode;
  /** Open scrolled to the right edge, for time axes whose newest columns are last. */
  startAtEnd?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [scroll, setScroll] = useState<ScrollX>();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (startAtEnd) el.scrollLeft = el.scrollWidth;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setScroll(max <= 1 ? 'none' : el.scrollLeft <= 1 ? 'start' : el.scrollLeft >= max - 1 ? 'end' : 'middle');
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [startAtEnd]);
  return (
    <div
      className={`table-frame relative ${card ? 'table-card overflow-hidden rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900' : ''} ${className}`}
    >
      {/* Keyboard users can focus the region to scroll it sideways. */}
      <section
        ref={ref}
        aria-label={label}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable table region needs keyboard access.
        tabIndex={0}
        data-scroll-x={scroll}
        className="table-scroller overflow-x-auto"
      >
        {children}
      </section>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-(--table-bg) transition-opacity ${scroll === 'start' || scroll === 'middle' ? 'opacity-100' : 'opacity-0'}`}
      />
      {footer}
    </div>
  );
}
