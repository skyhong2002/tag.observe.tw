'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './WordCloudView.module.css';

// Draws word clouds laid out on the server (WordCloud) and opens a card with a
// word's numbers on hover or focus; clicking follows the word's link.

export type CloudTone = 'brand' | 'strong' | 'muted' | 'stone';
export interface CloudCard {
  badge?: { text: string; tone: 'brand' | 'soft' | 'muted' };
  rows: Array<[string, string]>;
}
export interface CloudWordInfo {
  label: string;
  href: string;
  ariaLabel: string;
  tone?: CloudTone;
  fontWeight?: number;
  card?: CloudCard;
}
export interface PlacedBox {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}
export interface CloudCanvasLayout {
  width: number;
  height: number;
  words: PlacedBox[];
  className: string;
}

const tones: Record<CloudTone, string> = {
  brand: 'fill-brand-700 dark:fill-brand-400',
  strong: 'fill-zinc-800 dark:fill-zinc-200',
  muted: 'fill-zinc-700 dark:fill-zinc-300',
  stone: 'fill-stone-600 dark:fill-stone-400',
};
const badges = {
  brand: 'bg-brand-700 text-white dark:bg-brand-600',
  soft: 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300',
  muted: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function Canvas({
  layout,
  info,
  label,
  title,
}: {
  layout: CloudCanvasLayout;
  info: Record<string, CloudWordInfo>;
  label: string;
  title: string;
}) {
  const [active, setActive] = useState<PlacedBox | null>(null);
  const { width, height, words, className } = layout;
  const card = active ? info[active.label]?.card : undefined;
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  return (
    <div className={`relative ${className}`} onPointerLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-label={label} className="block w-full">
        <title>{title}</title>
        {words.map((word) => {
          const w = info[word.label];
          if (!w) return null;
          return (
            <Link
              key={word.label}
              href={w.href}
              aria-label={w.ariaLabel}
              className={styles.word}
              onPointerEnter={() => setActive(word)}
              onFocus={() => setActive(word)}
              onBlur={() => setActive(null)}
            >
              <rect x={word.x - 1} y={word.y - 1} width={word.width + 2} height={word.height + 2} rx="3" />
              <text
                x={word.x + 2}
                y={word.y + word.fontSize * 1.25}
                fontSize={word.fontSize}
                fontWeight={w.fontWeight ?? 600}
                textLength={word.width - 4}
                lengthAdjust="spacingAndGlyphs"
                className={tones[w.tone ?? 'strong']}
              >
                {word.label}
              </text>
            </Link>
          );
        })}
      </svg>
      {active && card && (
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
            {active.label}
            {card.badge && (
              <span className={`ml-2 rounded px-1.5 py-px text-[11px] font-medium ${badges[card.badge.tone]}`}>{card.badge.text}</span>
            )}
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums text-zinc-600 dark:text-zinc-400">
            {card.rows.map(([term, value]) => (
              <div key={term} className="contents">
                <dt>{term}</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

export default function WordCloudView({
  canvases,
  info,
  label,
  title,
}: {
  canvases: CloudCanvasLayout[];
  info: Record<string, CloudWordInfo>;
  label: string;
  title: string;
}) {
  return canvases.map((layout) => (
    <Canvas key={`${layout.width}x${layout.height}`} layout={layout} info={info} label={label} title={title} />
  ));
}
