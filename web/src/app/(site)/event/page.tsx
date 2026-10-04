import Link from 'next/link';
import { BaselineBar } from '@/components/CampBar';
import EventCard, { type EventTier } from '@/components/EventCard';
import { CampGap, EventIndex, HourTimeline } from '@/components/EventOverview';
import MediaSidebar from '@/components/MediaSidebar';
import MethodLink from '@/components/MethodLink';
import { fetchMedia, type MediaInfo, taipei, taipeiHour } from '@/lib/api';
import { fetchEvents } from '@/lib/pages';
import { canonicalQuery, pageMetadata } from '@/lib/seo.mts';

export const revalidate = 120;
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ at?: string }> }) {
  const raw = (await searchParams).at;
  const value =
    typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) && /^\d{4}-\d{2}-\d{2}T/.test(raw) ? new Date(raw).toISOString() : undefined;
  return pageMetadata(
    canonicalQuery('/event/', { at: value }),
    value ? `${value} · 事件表` : '事件表',
    '依新聞標籤共現整理熱門事件，並排比較各家媒體的報導標題與刊登時間。',
  );
}

const atLink = (iso: string) => `/event/?at=${encodeURIComponent(iso)}`;
const taipeiDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);

// Front-page weighting: a few big stories, a tier of cards, then a dense list.
const HERO = 3,
  CARDS = 9;
const tierOf = (rank: number): EventTier => (rank <= HERO ? 'hero' : rank <= CARDS ? 'card' : 'row');

export default async function EventPage({ searchParams }: { searchParams: Promise<{ limit?: string; at?: string }> }) {
  const sp = await searchParams;
  const limit = Math.min(30, Math.max(5, Number(sp.limit) || 30));
  const at = sp.at && !Number.isNaN(Date.parse(sp.at)) ? sp.at : undefined;
  const [data, media] = await Promise.all([fetchEvents(limit, at), fetchMedia().catch((): MediaInfo => ({}))]);
  const archived = !!data?.next;
  const max = Math.max(0, ...(data?.events ?? []).map((e) => e.score));
  const tiers = (['hero', 'card', 'row'] as const).map((t) => ({
    tier: t,
    items: (data?.events ?? []).filter((e) => tierOf(e.rank) === t),
  }));
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">事件表</h1>
          <a
            href="/feeds/events.xml"
            className="rounded-md bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            title="新事件出現時，用 RSS 閱讀器收到通知"
          >
            RSS 訂閱
          </a>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {data
            ? `${taipeiHour(data.hour)} 時段最重要的 ${data.events.length} 件事${data.stale ? '（分群排程延遲，顯示上次結果）' : ''}`
            : '事件資料暫時無法取得，請稍後重新整理。'}
          {data && <MethodLink className="ml-2 text-xs" />}
        </p>
        {data?.baseline && (
          <div className="mt-2">
            <BaselineBar b={data.baseline} />
          </div>
        )}
      </div>
      {data && (
        <nav className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-2">
            {data.prev ? (
              <Link href={atLink(data.prev)} className="rounded-md bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                ← 前一小時
              </Link>
            ) : (
              <span className="rounded-md px-3 py-1 text-zinc-500">← 前一小時</span>
            )}
            {data.next ? (
              <Link href={atLink(data.next)} className="rounded-md bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                後一小時 →
              </Link>
            ) : (
              <span className="rounded-md px-3 py-1 text-zinc-500">後一小時 →</span>
            )}
            {archived && (
              <Link href="/event/" className="rounded-md bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900">
                回到最新
              </Link>
            )}
            <Link href={`/event/archive/?day=${taipeiDay(data.hour)}`} className="ml-auto text-sky-700 hover:underline dark:text-sky-400">
              {taipeiDay(data.hour)} 全部事件 →
            </Link>
          </div>
          <HourTimeline hours={data.dayHours ?? []} dayStats={data.dayStats} current={data.hour} />
        </nav>
      )}
      {data && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
          <MediaSidebar label={`事件索引（${data.events.length} 件）`}>
            <div className="lg:sticky lg:top-4">
              <EventIndex events={data.events} />
            </div>
          </MediaSidebar>
          <div className="mt-5 min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:mt-0">
            <CampGap events={data.events} />
            {tiers.map(({ tier, items }) =>
              items.length === 0 ? null : tier === 'hero' ? (
                <ol key={tier} className="space-y-4" aria-label="頭條">
                  {items.map((e) => (
                    <EventCard key={e.rank} e={e} tier={tier} max={max} media={media} />
                  ))}
                </ol>
              ) : tier === 'card' ? (
                <ol key={tier} className="grid gap-4 md:grid-cols-2" aria-label="重要事件">
                  {items.map((e) => (
                    <EventCard key={e.rank} e={e} tier={tier} max={max} media={media} />
                  ))}
                </ol>
              ) : (
                <section key={tier} aria-labelledby="more-heading">
                  <h2
                    id="more-heading"
                    className="flex items-baseline gap-2 border-b border-zinc-300 pb-1 font-semibold dark:border-zinc-800"
                  >
                    其他事件
                    <span className="text-xs font-normal text-zinc-500">
                      第 {items[0].rank} 到 {items[items.length - 1].rank} 名
                    </span>
                  </h2>
                  <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {items.map((e) => (
                      <EventCard key={e.rank} e={e} tier={tier} max={max} media={media} />
                    ))}
                  </ol>
                </section>
              ),
            )}
          </div>
        </div>
      )}
      {data && <p className="text-xs text-zinc-600 dark:text-zinc-400">計算時間 {data.builtAt ? taipei(data.builtAt) : '—'}</p>}
    </div>
  );
}
