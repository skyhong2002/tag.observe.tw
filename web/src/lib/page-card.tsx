import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import Wordmark from '@/components/Wordmark';
import { API_ORIGIN } from './api';

// Light share cards for the site's section pages (header and footer links):
// the real wordmark, the page name, and either a small live snapshot of the
// page's data or a one-line description. Same server-only font as
// share-card.tsx; every fetch is optional, so a card still renders when the API
// is down.

export const CARD_SIZE = { width: 1200, height: 630 };
export const C = {
  bg: '#fafaf9',
  panel: '#ffffff',
  line: '#e4e4e7',
  text: '#18181b',
  muted: '#52525b',
  dim: '#a1a1aa',
  brand: '#c2410c',
  brandSoft: '#fff7ed',
  blue: '#2563eb',
  green: '#059669',
  other: '#a1a1aa',
};

export async function cardJson<T>(path: string, revalidate = 900): Promise<T | null> {
  try {
    const res = await fetch(`${API_ORIGIN}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(15000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const clip = (s: string, n: number) =>
  Array.from(s).length > n
    ? `${Array.from(s)
        .slice(0, n - 1)
        .join('')}…`
    : s;
export const taipeiDay = (offsetDays = 0) => new Date(Date.now() + 8 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
const stamp = (d: Date) =>
  `${d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })}`;

/** A figure with its label above, for a card's side column. */
export function Figure({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 18 }}>
      <span style={{ fontSize: 22, color: C.muted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontSize: 50, color: C.text }}>{value == null ? '—' : value.toLocaleString()}</span>
        <span style={{ fontSize: 22, color: C.muted, marginLeft: 6 }}>{unit}</span>
      </div>
    </div>
  );
}

/** Shown in place of a list when the API did not answer. */
export function Empty() {
  return <div style={{ display: 'flex', flex: 1, alignItems: 'center', fontSize: 26, color: C.dim }}>資料更新中，打開頁面看最新內容</div>;
}

/** One line of a list: a lead (rank, outlet, number) then the text, clipped to fit. */
export function Row({ lead, text, tail, chars = 30 }: { lead: string; text: string; tail?: string; chars?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 22, color: C.brand, width: 170, flexShrink: 0 }}>{clip(lead, 8)}</span>
      <span style={{ fontSize: 26, color: C.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{clip(text, chars)}</span>
      {tail && <span style={{ fontSize: 22, color: C.muted, marginLeft: 12 }}>{tail}</span>}
    </div>
  );
}

/** Horizontal bars, longest first, each labelled with its value. */
export function Bars({ items, unit }: { items: Array<{ label: string; value: number }>; unit: string }) {
  if (!items.length) return <Empty />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
      {items.map((i, n) => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 24, color: C.text, width: 200, flexShrink: 0 }}>{clip(i.label, 8)}</span>
          <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                height: 24,
                // Room is left for the value beside the longest bar.
                width: `${Math.max(2, (i.value / max) * 78)}%`,
                background: n < 3 ? C.brand : '#fdba74',
                borderRadius: 6,
              }}
            />
            <span style={{ fontSize: 22, color: C.muted, marginLeft: 10, whiteSpace: 'nowrap' }}>
              {i.value.toLocaleString()}
              {unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Blue / other / green share of something, as one bar. */
export function CampSplit({ camps }: { camps: { blue: number; green: number; other: number } }) {
  const total = camps.blue + camps.green + camps.other;
  if (!total) return null;
  return (
    <div style={{ display: 'flex', height: 12, width: 220, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', width: `${(camps.green / total) * 100}%`, background: C.green }} />
      <div style={{ display: 'flex', width: `${(camps.other / total) * 100}%`, background: C.other }} />
      <div style={{ display: 'flex', width: `${(camps.blue / total) * 100}%`, background: C.blue }} />
    </div>
  );
}

let font: Promise<Buffer> | undefined;
/**
 * The card frame: wordmark and update time, the page name and a line about it,
 * then `children` (the live snapshot) or, for pages without one, more room for
 * the description.
 */
export async function pageCard({
  path,
  title,
  description,
  children,
  cacheSeconds = 1800,
}: {
  path: string;
  title: string;
  description: string;
  children?: ReactNode;
  cacheSeconds?: number;
}) {
  font ??= readFile(join(process.cwd(), 'assets/NotoSansTC-Share.woff'));
  const data = await font;
  const live = Boolean(children);
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: C.bg,
        color: C.text,
        padding: '40px 56px 34px',
        fontFamily: 'Noto Sans TC',
        fontWeight: 700,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', color: C.text }}>
          <Wordmark height={46} />
        </div>
        {live && <span style={{ fontSize: 24, color: C.muted }}>{stamp(new Date())} 更新</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: live ? 22 : 90 }}>
        <span style={{ fontSize: live ? 54 : 96, color: C.text }}>{title}</span>
      </div>
      <div style={{ display: 'flex', fontSize: live ? 24 : 34, color: C.muted, marginTop: live ? 4 : 18, lineHeight: 1.5 }}>
        {description}
      </div>
      {live ? (
        <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, marginTop: 20, minHeight: 0 }}>{children}</div>
      ) : (
        <div style={{ display: 'flex', flex: 1 }} />
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: `6px solid ${C.brand}`,
          paddingTop: 14,
          marginTop: 18,
          fontSize: 22,
          color: C.muted,
        }}
      >
        <span>同一件事，各家怎麼說</span>
        <span style={{ color: C.text }}>tag.observe.tw{path}</span>
      </div>
    </div>,
    {
      ...CARD_SIZE,
      fonts: [{ name: 'Noto Sans TC', data, weight: 700, style: 'normal' }],
      headers: { 'Cache-Control': `public, max-age=${Math.min(900, cacheSeconds)}, s-maxage=${cacheSeconds}` },
    },
  );
}
