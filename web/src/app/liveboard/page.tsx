import type { Metadata, Viewport } from 'next';
import { API_ORIGIN, fetchMedia, fetchRanking, fetchTagAvatars, fetchTagVisuals, type MediaInfo, type RankingEntry } from '@/lib/api';
import type { LiveFeed } from '@/lib/liveboard.mts';
import { type EventsSnapshot, fetchEvents } from '@/lib/pages';
import { pageMetadata } from '@/lib/seo.mts';
import BoardSwitch from './BoardSwitch';
import type { MediaTotals } from './LiveBoard';
import type { Pictures } from './SimpleBoard';
import { DEFAULTS, firstCloud, QUERY_KEYS, settingsFromQuery } from './settings';

// A chrome-less, always-on screen (a wall tablet): it renders the current
// snapshot here, then LiveBoard polls /api/v1/liveboard and friends. The
// simple board (SimpleBoard) is the home page's cloud alone, playing hour by hour.
export const revalidate = 30;
export const metadata: Metadata = {
  ...pageMetadata('/liveboard/', '即時看板', '新文易數的常駐即時看板：新進新聞、新事件、各家標題對照與轉載比對輪流顯示。', true),
  robots: { index: false, follow: false },
  // Its own web app: installed, it opens the board full screen (see manifest.webmanifest/route.ts).
  manifest: '/liveboard/manifest.webmanifest',
  appleWebApp: { capable: true, title: '即時看板', statusBarStyle: 'black-translucent' },
};
// viewport-fit=cover lets the board reach under the notch; it pads by the safe-area insets.
export const viewport: Viewport = { themeColor: '#09090b', viewportFit: 'cover' };

async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

async function mediaTotals() {
  const res = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(8000) });
  return res.ok ? ((await res.json()) as { totals: MediaTotals }).totals : null;
}

/** The simple board's first lens, the pictures it draws tags as, and the day's article count. */
async function simpleData() {
  // The lens a new device opens on.
  const first = firstCloud(DEFAULTS.lenses);
  const [ranking, avatars, visuals, totals] = await Promise.all([
    optional(() => fetchRanking(first.category, first.order, 88, false, false, first.order === 'growth' ? { gate: 'all' } : {})),
    optional(fetchTagAvatars),
    optional(fetchTagVisuals),
    optional(mediaTotals),
  ]);
  // Every tag with a picture is drawn as it, as on the home page's cloud.
  const pictures: Pictures = {};
  for (const [tag, v] of Object.entries(visuals ?? {}))
    if (v.image) pictures[tag] = { image: v.image, ...(v.aspect && v.aspect !== 1 ? { aspect: v.aspect } : {}) };
    else if (v.emoji) pictures[tag] = { emoji: v.emoji };
  for (const [tag, url] of Object.entries(avatars ?? {})) pictures[tag] = { image: url };
  return { initial: ranking ? { lens: first.key, ranking } : null, pictures, today: totals?.today ?? null };
}

async function fullData() {
  const [events, ranking, media, feed, totals] = await Promise.all([
    optional(() => fetchEvents(12)),
    optional(() => fetchRanking('all', 'burst', 20, false, false, true)),
    optional(fetchMedia),
    optional(async () => {
      const res = await fetch(`${API_ORIGIN}/api/v1/liveboard`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      return res.ok ? ((await res.json()) as LiveFeed) : null;
    }),
    optional(mediaTotals),
  ]);
  return {
    initialEvents: (events as EventsSnapshot | null) ?? null,
    initialRanking: (ranking?.entries as RankingEntry[] | undefined) ?? [],
    media: (media as MediaInfo | null) ?? {},
    initialFeed: feed,
    initialTotals: totals,
  };
}

// Which board shows is a setting (settings.ts) kept in the browser or the
// reader's account, so unless the query names one the page loads both and
// BoardSwitch picks.
export default async function LiveboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = Object.fromEntries(
    QUERY_KEYS.flatMap((key) => {
      const v = raw[key];
      const value = Array.isArray(v) ? v[0] : v;
      return value ? [[key, value]] : [];
    }),
  );
  const forced = query.mode || query.simple ? settingsFromQuery(query, DEFAULTS).mode : null;
  const [full, simple] = await Promise.all([forced === 'simple' ? null : fullData(), forced === 'full' ? null : simpleData()]);
  return <BoardSwitch query={query} forced={forced} full={full} simple={simple} />;
}
