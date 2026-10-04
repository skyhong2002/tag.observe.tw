'use client';

import { Children, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

// One line of same-size items: as many as the width allows, then "+N". The
// rest open in a floating panel so expanding never pushes the layout down.

const MORE = 32; // room kept for the "+N" button, px

export default function FitRow({ children, label }: { children: ReactNode; label: string }) {
  const items = Children.toArray(children);
  const row = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(items.length);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const width = el.parentElement?.clientWidth ?? 0;
      if (!first || !width) return;
      const each = first.offsetWidth;
      if (each * items.length <= width) setFit(items.length);
      else setFit(Math.max(1, Math.floor((width - MORE) / each)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const rest = items.length - fit;
  return (
    <div ref={box} className="relative flex min-w-0 flex-1 items-center">
      <div ref={row} className="flex min-w-0 items-center overflow-hidden">
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: children keep their own keys; position is the identity here
          <span key={i} className={`shrink-0 ${i >= fit ? 'hidden' : ''}`}>
            {item}
          </span>
        ))}
      </div>
      {rest > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${label}：另外 ${rest} 家`}
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 cursor-pointer rounded px-1 tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            +{rest}
          </button>
          {open && (
            <div className="absolute left-0 top-full z-30 mt-1 flex w-max max-w-72 flex-wrap rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {items.slice(fit)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
