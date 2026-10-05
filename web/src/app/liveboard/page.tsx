import type { Metadata, Viewport } from 'next';
import { API_ORIGIN, fetchMedia, fetchRanking, type MediaInfo, type RankingEntry } from '@/lib/api';
import type { LiveFeed } from '@/lib/liveboard.mts';
import { type EventsSnapshot, fetchEvents } from '@/lib/pages';
import { pageMetadata } from '@/lib/seo.mts';
import LiveBoard, { type MediaTotals } from './LiveBoard';

// A chrome-less, always-on screen (a wall tablet): it renders the current
// snapshot here, then LiveBoard polls /api/v1/liveboard and friends.
export const revalidate = 30;
export const metadata: Metadata = {
  ...pageMetadata('/liveboard/', '即時看板', '新文易數的常駐即時看板：新進新聞、新事件、各家標題對照與轉載比對輪流顯示。', true),
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#09090b' };

async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

export default async function LiveboardPage() {
  const [events, ranking, media, feed, totals] = await Promise.all([
    optional(() => fetchEvents(12)),
    optional(() => fetchRanking('all', 'burst', 20, true)),
    optional(fetchMedia),
    optional(async () => {
      const res = await fetch(`${API_ORIGIN}/api/v1/liveboard`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      return res.ok ? ((await res.json()) as LiveFeed) : null;
    }),
    optional(async () => {
      const res = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(8000) });
      return res.ok ? ((await res.json()) as { totals: MediaTotals }).totals : null;
    }),
  ]);
  return (
    <LiveBoard
      initialEvents={(events as EventsSnapshot | null) ?? null}
      initialRanking={(ranking?.entries as RankingEntry[] | undefined) ?? []}
      media={(media as MediaInfo | null) ?? {}}
      initialFeed={feed}
      initialTotals={totals}
    />
  );
}
