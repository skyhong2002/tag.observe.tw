import Link from 'next/link';
import { BaselineBar, CAMP_LABEL, CampBadge, LeanText } from '@/components/CampBar';
import EventCard, { type EventTier, eventAnchor, eventHeadline } from '@/components/EventCard';
import MediaSidebar from '@/components/MediaSidebar';
import { fetchMedia, type MediaInfo, taipei, taipeiHour } from '@/lib/api';
import { type EventItem, type EventsSnapshot, fetchEvents } from '@/lib/pages';

export const revalidate = 120;
export const metadata = { title: '事件表' };

const atLink = (iso: string) => `/event/?at=${encodeURIComponent(iso)}`;
const hh = (iso: string) => taipeiHour(iso).slice(-5);
const taipeiDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);

// Front-page weighting: a few big stories, a tier of cards, then a dense list.
const HERO = 3,
  CARDS = 9;
const tierOf = (rank: number): EventTier => (rank <= HERO ? 'hero' : rank <= CARDS ? 'card' : 'row');

/** Hour picker with a bar per snapshot: taller when that hour's top event
 *  burst harder, so the busy part of the day stands out. */
function HourTimeline({ data }: { data: EventsSnapshot }) {
  const hours = data.dayHours ?? [];
  if (hours.length < 2) return null;
  const stats = new Map((data.dayStats ?? []).map((s) => [s.hour, s]));
  // Top scores within a day sit in a narrow band; stretch that band so the
  // quiet and busy hours actually differ in height.
  const tops = [...stats.values()].map((s) => s.top);
  const lo = Math.min(...tops),
    hi = Math.max(...tops);
  const height = (top: number) => (hi > lo ? 25 + Math.round(((top - lo) / (hi - lo)) * 75) : 60);
  return (
    <ol className="flex flex-wrap gap-1" aria-label="當日各小時">
      {hours.map((h) => {
        const s = stats.get(h);
        const pct = s ? height(s.top) : 8;
        const current = h === data.hour;
        return (
          <li key={h}>
            <Link
              href={atLink(h)}
              aria-current={current ? 'page' : undefined}
              title={s ? `第 1 名爆發力 ${s.top.toFixed(1)} · ${s.count} 件事` : undefined}
              className={`flex w-11 flex-col items-center gap-1 rounded px-1 pt-1 pb-0.5 text-xs tabular-nums ${
                current
                  ? 'bg-brand-700 text-white dark:bg-brand-600'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="flex h-6 w-full items-end justify-center" aria-hidden>
                <span
                  className={`w-4 rounded-sm ${current ? 'bg-white/80' : 'bg-brand-300 dark:bg-brand-800'}`}
                  style={{ height: `${pct}%` }}
                />
              </span>
              {hh(h)}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Ground.news-style blind spot feed, folded into the hour: the events one
 *  camp is barely on, then the ones a camp is pushing far harder than usual. */
function CampGap({ events }: { events: EventItem[] }) {
  const pick = (camp: 'blue' | 'green') =>
    events
      .filter((e) => e.coverage && (e.coverage.blindspot.includes(camp === 'blue' ? 'green' : 'blue') || e.coverage.tilt === camp))
      .sort((a, b) => {
        const spot = (e: EventItem) => (e.coverage?.blindspot.length ? 1 : 0);
        return spot(b) - spot(a) || Math.abs(b.coverage?.lean ?? 0) - Math.abs(a.coverage?.lean ?? 0);
      })
      .slice(0, 4);
  const cols = [
    { camp: 'blue' as const, title: '藍營在推、綠營少報', items: pick('blue') },
    { camp: 'green' as const, title: '綠營在推、藍營少報', items: pick('green') },
  ];
  if (cols.every((c) => c.items.length === 0))
    return (
      <p className="rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        本小時 {events.length} 件事的藍綠報導比例都在平常範圍內，沒有盲點。
      </p>
    );
  return (
    <section
      aria-labelledby="gap-heading"
      className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900 dark:bg-brand-950/20"
    >
      <h2 id="gap-heading" className="font-semibold">
        藍綠溫差
      </h2>
      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
        相對於過去 24 小時的整體比例，哪一邊的媒體特別在寫、哪一邊幾乎沒報。「盲點」表示那一營的讀者看不到這件事。
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {cols.map((col) => (
          <div key={col.camp} className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-900">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${col.camp === 'blue' ? 'bg-blue-600' : 'bg-emerald-600'}`} aria-hidden />
              {col.title}
            </h3>
            {col.items.length === 0 ? (
              <p className="text-xs text-zinc-500">本小時沒有。</p>
            ) : (
              <ol className="space-y-2">
                {col.items.map((e) => (
                  <li key={e.rank} className="flex items-start gap-2">
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-500">{e.rank}</span>
                    <div className="min-w-0 flex-1">
                      <a href={`#${eventAnchor(e.rank)}`} className="line-clamp-1 hover:underline">
                        {eventHeadline(e)}
                      </a>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                        {e.coverage && <CampBadge c={e.coverage} />}
                        <LeanText lean={e.coverage?.lean ?? null} />
                        <span className="tabular-nums">
                          {CAMP_LABEL.blue} {e.coverage?.camps.blue} 家 · {CAMP_LABEL.green} {e.coverage?.camps.green} 家
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Index({ events }: { events: EventItem[] }) {
  return (
    <nav aria-label="事件索引" className="rounded-xl border border-zinc-200 p-3 text-sm sm:col-span-2 dark:border-zinc-800">
      <h2 className="font-semibold">本小時 {events.length} 件事</h2>
      <ol className="mt-2 max-h-[70vh] space-y-0.5 overflow-y-auto">
        {events.map((e) => (
          <li key={e.rank}>
            <a
              href={`#${eventAnchor(e.rank)}`}
              className="flex items-baseline gap-2 rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-500">{e.rank}</span>
              <span className="line-clamp-1 min-w-0 text-xs text-zinc-700 dark:text-zinc-300">{eventHeadline(e)}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

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
            ? `${taipeiHour(data.hour)} 時段最重要的 ${data.events.length} 件事 · 依標籤共現分群${data.stale ? '（分群排程延遲，顯示上次結果）' : ''}`
            : '事件資料暫時無法取得，請稍後重新整理。'}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          爆發力條以本小時第 1 名為滿格。每件事的藍綠比例是過去 24 小時寫過該事件主要標籤的媒體家數，不含未列藍綠的媒體。
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
          <HourTimeline data={data} />
        </nav>
      )}
      {data && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
          <MediaSidebar label={`事件索引（${data.events.length} 件）`}>
            <div className="lg:sticky lg:top-4">
              <Index events={data.events} />
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
      {data && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          計算時間 {data.builtAt ? taipei(data.builtAt) : '—'}。每半小時依標籤共現重新分群。
        </p>
      )}
    </div>
  );
}
