'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

type ScrollX = 'none' | 'start' | 'middle' | 'end';

/**
 * Horizontal scroll container for wide tables. Marks where the table is
 * scrolled to (data-scroll-x) so the sticky lead column can cast a shadow and
 * the right edge fades while more columns are hidden. `card` draws the usual
 * rounded border and switches the colour tokens to the card tone.
 *
 * The header row follows the page down a long table. CSS sticky cannot do it
 * (a sideways scroller is a vertical scroll container too), so the header is
 * translated by a scroll-driven animation on the page's own scroll timeline:
 * the compositor moves it, so it keeps up with however fast the page scrolls.
 * Script only measures where the table sits; browsers without scroll timelines
 * fall back to moving the header on scroll events. */
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
  useEffect(() => {
    const head = ref.current?.querySelector('thead');
    const tableEl = head?.closest('table');
    if (!head || !tableEl) return;
    const timeline = CSS.supports('animation-timeline: scroll()');
    const offset = () => document.querySelector('[data-site-header]')?.getBoundingClientRect().height ?? 0;
    let start = 0;
    let travel = 0;
    const measure = () => {
      start = tableEl.getBoundingClientRect().top + window.scrollY - offset();
      travel = Math.max(0, tableEl.offsetHeight - head.offsetHeight);
      head.style.setProperty('--head-start', `${start}px`);
      head.style.setProperty('--head-end', `${start + travel}px`);
      head.style.setProperty('--head-travel', `${travel}px`);
    };
    const follow = () => {
      head.style.transform = `translateY(${Math.min(Math.max(0, window.scrollY - start), travel)}px)`;
    };
    measure();
    head.classList.add(timeline ? 'table-head-follow' : 'table-head-shift');
    const observer = new ResizeObserver(() => {
      measure();
      if (!timeline) follow();
    });
    observer.observe(tableEl);
    observer.observe(document.body);
    if (!timeline) {
      follow();
      window.addEventListener('scroll', follow, { passive: true });
    }
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', follow);
      head.classList.remove('table-head-follow', 'table-head-shift');
      head.style.transform = '';
    };
  }, []);
  const more = scroll === 'start' || scroll === 'middle';
  return (
    <div
      className={`table-frame relative ${card ? 'table-card overflow-hidden rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900' : ''} ${className}`}
    >
      {/* Phones: a row of its own above the header, so the hint never covers a column name. It
          renders until the table is measured: on a phone almost every wide table overflows. */}
      <div
        aria-hidden="true"
        className={`${scroll === undefined || more ? 'flex' : 'hidden'} h-7 items-center justify-end gap-1 border-b border-zinc-200 bg-(--table-head-bg) px-3 text-xs text-brand-800 sm:hidden dark:border-zinc-800 dark:text-brand-300`}
      >
        {scroll === 'middle' ? '還有更多欄，繼續往左滑' : '左右滑動看更多欄'}
        <span aria-hidden="true">→</span>
      </div>
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
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-(--table-bg) transition-opacity ${more ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* While columns are hidden to the right, say so: a tap or click scrolls one screen on. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => ref.current?.scrollBy({ left: ref.current.clientWidth * 0.8, behavior: 'smooth' })}
        className={`absolute top-1.5 right-1.5 z-30 hidden items-center gap-1 rounded-full sm:inline-flex border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 shadow-sm transition-opacity hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900 ${more ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        更多欄位
        <span aria-hidden="true">→</span>
      </button>
      {footer}
    </div>
  );
}
