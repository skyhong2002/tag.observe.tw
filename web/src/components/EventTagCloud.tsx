'use client';

import Link from 'next/link';
import { useState } from 'react';
import { taipeiHour } from '@/lib/api';
import type { TagStat } from '@/lib/event-thread.mts';
import { layoutWordCloud, type PlacedWord } from '@/lib/word-cloud.mts';

// Every tag an event carried, as a word cloud sized by peak score. Hovering
// or focusing a word opens a small card with the numbers the old list showed
// (peak, when, how many hours); clicking goes to the tag page.

const canvases = {
  compact: { width: 300, height: 230, sizes: { min: 12, max: 30 } },
  wide: { width: 760, height: 360, sizes: { min: 13, max: 64, budget: 0.7 } },
};

function Cloud({ stats, canvas, className, hours }: { stats: TagStat[]; canvas: keyof typeof canvases; className: string; hours: number }) {
  const [active, setActive] = useState<PlacedWord | null>(null);
  const { width, height, sizes } = canvases[canvas];
  const byTag = new Map(stats.map((s) => [s.tag, s]));
  // A major tag that never made an hour's top list still belongs in the cloud, at the smallest size.
  const words = layoutWordCloud(
    stats.map((s) => ({ label: s.tag, count: Math.max(s.peak, 0.5) })),
    width,
    height,
    sizes,
  );
  if (!words.length) return null;
  const stat = active ? byTag.get(active.label) : undefined;
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  return (
    <div className={`relative ${className}`} onPointerLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-label="事件標籤文字雲，字越大最高分越高" className="block w-full">
        <title>事件標籤文字雲；字越大，該標籤在這件事裡的最高分越高</title>
        {words.map((word) => {
          const s = byTag.get(word.label);
          const major = s?.major ?? false;
          return (
            <Link
              key={word.label}
              href={`/tag/${encodeURIComponent(word.label)}/`}
              aria-label={`${word.label}，最高 ${s?.peak.toFixed(1) ?? '—'} 分，出現 ${s?.hours ?? 0} 小時`}
              className="group outline-none"
              onPointerEnter={() => setActive(word)}
              onFocus={() => setActive(word)}
              onBlur={() => setActive(null)}
            >
              <rect
                x={word.x - 1}
                y={word.y - 1}
                width={word.width + 2}
                height={word.height + 2}
                rx="3"
                className="fill-transparent group-hover:fill-zinc-100 group-focus:fill-zinc-100 dark:group-hover:fill-zinc-800 dark:group-focus:fill-zinc-800"
              />
              <text
                x={word.x + 2}
                y={word.y + word.fontSize * 1.25}
                fontSize={word.fontSize}
                fontWeight={major ? 700 : 500}
                textLength={word.width - 4}
                lengthAdjust="spacingAndGlyphs"
                className={major ? 'fill-brand-700 dark:fill-brand-400' : 'fill-zinc-700 dark:fill-zinc-300'}
              >
                {word.label}
              </text>
            </Link>
          );
        })}
      </svg>
      {active && stat && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            left: pct(active.x + active.width / 2, width),
            top: pct(active.y + active.height, height),
            marginTop: 4,
          }}
        >
          <p className="text-sm font-semibold">
            {stat.tag}
            <span
              className={`ml-2 rounded px-1.5 py-px text-[11px] font-medium ${
                stat.major ? 'bg-brand-700 text-white dark:bg-brand-600' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {stat.major ? '主要標籤' : '相關標籤'}
            </span>
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums text-zinc-600 dark:text-zinc-400">
            <dt>最高分</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">
              {stat.peak > 0 ? `${stat.peak.toFixed(1)}（${taipeiHour(stat.peakAt)}）` : '未進入任何小時的前 12 名'}
            </dd>
            <dt>出現</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">
              {stat.hours} / {hours} 小時
            </dd>
          </dl>
          <p className="mt-1 text-brand-700 dark:text-brand-400">點選查看標籤頁 →</p>
        </div>
      )}
    </div>
  );
}

export default function EventTagCloud({ stats, hours }: { stats: TagStat[]; hours: number }) {
  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <Cloud stats={stats} canvas="compact" className="mx-auto w-full max-w-[360px] md:hidden" hours={hours} />
      <Cloud stats={stats} canvas="wide" className="hidden w-full md:block" hours={hours} />
    </div>
  );
}
