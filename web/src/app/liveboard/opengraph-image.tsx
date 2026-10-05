import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { API_ORIGIN } from '@/lib/api';
import { cleanEventHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import type { LiveFeed } from '@/lib/liveboard.mts';
import type { EventsSnapshot } from '@/lib/pages';

// The /liveboard/ share card: the board itself in miniature, dark, with the
// figures and top story at render time. Rebuilt every 15 minutes; when the API
// is down it still renders the frame. Same server-only font as share-card.tsx.

export const alt = '新文易數即時看板：新進新聞、事件、標題對照與轉載比對即時輪播';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 900;

const C = {
  bg: '#09090b',
  panel: '#18181b',
  line: '#27272a',
  text: '#f4f4f5',
  muted: '#a1a1aa',
  dim: '#71717a',
  brand: '#f97316',
  brandDeep: '#c2410c',
  blue: '#3b82f6',
  green: '#10b981',
  other: '#71717a',
};

async function json<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_ORIGIN}${path}`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) =>
  Array.from(s).length > n
    ? `${Array.from(s)
        .slice(0, n - 1)
        .join('')}…`
    : s;
const hhmm = (d: Date) => d.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' });
const day = (d: Date) => d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' });

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 20, color: C.dim }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontSize: 46, color: C.text }}>{value}</span>
        <span style={{ fontSize: 20, color: C.muted, marginLeft: 6 }}>{unit}</span>
      </div>
    </div>
  );
}

// The site's own wordmark (public/brand/wordmark.svg, the same paths as
// components/Wordmark.tsx), as an image so the glyphs and half-orange dot match
// the header exactly; its ink is set for the dark card.
const WORDMARK_HEIGHT = 52;
let wordmark: Promise<string> | undefined;
const loadWordmark = async () =>
  `data:image/svg+xml;base64,${Buffer.from(
    (await readFile(join(process.cwd(), 'public/brand/wordmark.svg'), 'utf8')).replaceAll('currentColor', C.text),
  ).toString('base64')}`;

let font: Promise<Buffer> | undefined;
export default async function Image() {
  font ??= readFile(join(process.cwd(), 'assets/NotoSansTC-Share.woff'));
  wordmark ??= loadWordmark();
  const [data, logo, feed, events, ranking, media] = await Promise.all([
    font,
    wordmark,
    json<LiveFeed>('/api/v1/liveboard'),
    json<EventsSnapshot>('/api/v1/events?limit=1'),
    json<{ entries: Array<{ tag: string }> }>('/api/v1/ranking?category=all&order=burst&limit=6'),
    json<{ totals: { today: number } }>('/api/v1/media-stats'),
  ]);
  const now = new Date();
  const top = events?.events[0];
  const lead = top ? selectEventLead(top.news, top.major) : null;
  const headline = top ? clip(cleanEventHeadline(lead?.title ?? top.major.join('、')), 44) : '同一件事，各家怎麼說';
  const stats = feed?.stats;
  const lastHour = stats ? stats.last60m.reduce((n, b) => n + b.blue + b.green + b.other, 0) : null;
  const bars = stats?.hourly24 ?? [];
  const max = Math.max(1, ...bars.map((b) => b.blue + b.green + b.other));
  const keywords = ranking?.entries.slice(0, 6).map((e) => e.tag) ?? [];

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: C.bg,
        color: C.text,
        padding: '40px 52px 36px',
        fontFamily: 'Noto Sans TC',
        fontWeight: 700,
      }}
    >
      {/* Header: brand, LIVE, time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={logo} width={WORDMARK_HEIGHT * 4.36} height={WORDMARK_HEIGHT} alt="新文易數" />
          <span style={{ fontSize: 30, color: C.muted, marginLeft: 22 }}>即時看板</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#dc2626',
              borderRadius: 8,
              padding: '4px 14px',
              fontSize: 22,
              letterSpacing: 3,
            }}
          >
            <span style={{ display: 'flex', width: 10, height: 10, borderRadius: 5, background: '#fff', marginRight: 10 }} />
            LIVE
          </div>
          <span style={{ fontSize: 30, marginLeft: 18 }}>
            {day(now)} {hhmm(now)}
          </span>
        </div>
      </div>

      {/* Body: top story and figures */}
      <div style={{ display: 'flex', flex: 1, marginTop: 26 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            background: C.panel,
            borderRadius: 24,
            border: `1px solid ${C.line}`,
            padding: '26px 30px',
          }}
        >
          <div style={{ display: 'flex' }}>
            <span style={{ background: C.brandDeep, borderRadius: 8, padding: '4px 14px', fontSize: 22 }}>
              {top ? `熱門事件 第 ${top.rank} 名` : '新聞即時輪播'}
            </span>
          </div>
          <div style={{ display: 'flex', fontSize: Array.from(headline).length > 30 ? 40 : 48, lineHeight: 1.35, marginTop: 18, flex: 1 }}>
            {headline}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {(top?.major ?? ['新事件', '標題對照', '轉載比對']).slice(0, 4).map((t) => (
              <span key={t} style={{ fontSize: 24, color: '#fdba74', marginRight: 22 }}>
                #{t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: 300, marginLeft: 24, justifyContent: 'space-between' }}>
          <Stat label="今日收錄" value={media?.totals.today ? media.totals.today.toLocaleString() : '—'} unit="篇" />
          <Stat label="近 1 小時" value={lastHour ? lastHour.toLocaleString() : '—'} unit={`篇 · ${stats?.activeMedia1h ?? '—'} 家`} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 20, color: C.dim }}>竄升關鍵字</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 4 }}>
              {keywords.map((k, i) => (
                <span key={k} style={{ fontSize: 24, color: i < 2 ? C.brand : C.text, marginRight: 16 }}>
                  {clip(k, 6)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 24h per-camp bars, oldest left */}
      <div style={{ display: 'flex', alignItems: 'flex-end', height: 70, marginTop: 22 }}>
        {bars.map((b, i) => {
          const h = (n: number) => Math.round((n / max) * 66);
          return (
            <div
              key={b.t}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                flex: 1,
                height: 70,
                marginRight: i === bars.length - 1 ? 0 : 3,
              }}
            >
              <div style={{ display: 'flex', height: h(b.other), background: C.other, borderRadius: '4px 4px 0 0' }} />
              <div style={{ display: 'flex', height: h(b.green), background: C.green }} />
              <div style={{ display: 'flex', height: h(b.blue), background: C.blue }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: C.dim, marginTop: 10 }}>
        <span>24 小時發稿量 · 藍營／綠營／其他</span>
        <span style={{ color: C.muted }}>tag.observe.tw/liveboard</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: 'Noto Sans TC', data, weight: 700, style: 'normal' }],
      headers: { 'Cache-Control': 'public, max-age=900, s-maxage=900' },
    },
  );
}
