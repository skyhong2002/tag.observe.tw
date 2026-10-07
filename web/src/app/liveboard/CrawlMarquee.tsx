'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import type { LiveActivity } from '@/lib/liveboard.mts';
import { crawlMarqueeRows, startMarquee } from '@/lib/liveboard-marquee.mts';
import styles from './liveboard.module.css';

const STAGE_LABEL: Record<string, string> = { index: '巡查', article: '內文', topic: '議題' };

export default function CrawlMarquee({ crawls }: { crawls: LiveActivity['crawls'] }) {
  const next = useMemo(() => crawlMarqueeRows(crawls), [crawls]);
  const latest = useRef(next);
  latest.current = next;
  const [rows, setRows] = useState(next);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const width = useRef(0);

  // Freeze each lap's content. Polling never changes a moving track's width.
  // An empty track can start immediately when the first crawl arrives.
  useEffect(() => {
    if (!rows.length && next.length) setRows(next);
  }, [rows.length, next]);

  useLayoutEffect(() => {
    const box = viewport.current;
    const copy = group.current;
    if (!box || !copy) return;
    const measure = () => {
      box.style.setProperty('--marquee-viewport', `${box.clientWidth}px`);
      width.current = copy.getBoundingClientRect().width;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(copy);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reset = () => {
      if (motion.matches && track.current) track.current.style.transform = '';
    };
    reset();
    motion.addEventListener('change', reset);
    const stop = startMarquee({
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
      width: () => width.current,
      active: () => !document.hidden && !motion.matches,
      draw: (offset) => {
        if (track.current) track.current.style.transform = `translateX(${-offset}px)`;
      },
      onCycle: () => setRows(latest.current),
    });
    return () => {
      stop();
      motion.removeEventListener('change', reset);
    };
  }, []);

  const items = rows.map((c) => (
    <span key={`${c.media}:${c.stage}`} className="inline-flex shrink-0 items-center gap-1.5 pr-5">
      {c.running && <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${styles.pulse}`} aria-hidden />}
      <MediaIcon rem media={c.media} title={c.mediaTitle} size={14} />
      <span className={c.failed ? 'text-rose-400' : 'text-zinc-300'}>{c.mediaTitle}</span>
      <span className="text-zinc-500">{STAGE_LABEL[c.stage] ?? c.stage}</span>
      {c.failed ? <span className="text-rose-400">失敗</span> : c.inserted > 0 && <span className="text-brand-400">+{c.inserted}</span>}
    </span>
  ));

  return (
    <div ref={viewport} className="relative min-w-0 flex-1 overflow-hidden" data-crawl-marquee>
      <div ref={track} className={`flex w-max ${styles.marquee}`}>
        <div ref={group} className={styles.marqueeGroup} data-crawl-marquee-group>
          {items}
        </div>
        <div className={styles.marqueeGroup} aria-hidden>
          {items}
        </div>
      </div>
    </div>
  );
}
