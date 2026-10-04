import Link from 'next/link';
import { CampBadge } from '@/components/CampBar';
import { eventAnchor, eventHeadline } from '@/components/EventCard';
import { taipeiHour } from '@/lib/api';
import type { EventItem } from '@/lib/pages';

// Pieces shared by the hourly event table and the day archive: the hour
// picker, the camp blind-spot panel and the sidebar index.

const atLink = (iso: string) => `/event/?at=${encodeURIComponent(iso)}`;
const hh = (iso: string) => taipeiHour(iso).slice(-5);

/** Hour picker with a bar per snapshot: taller when that hour's top event
 *  burst harder, so the busy part of the day stands out. */
export function HourTimeline({
  hours,
  dayStats = [],
  current,
}: {
  hours: string[];
  dayStats?: Array<{ hour: string; top: number; count: number }>;
  current?: string;
}) {
  if (hours.length < 2) return null;
  const stats = new Map(dayStats.map((s) => [s.hour, s]));
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
        const here = h === current;
        return (
          <li key={h}>
            <Link
              href={atLink(h)}
              aria-current={here ? 'page' : undefined}
              title={s ? `第 1 名爆發力 ${s.top.toFixed(1)} · ${s.count} 件事` : undefined}
              className={`flex w-11 flex-col items-center gap-1 rounded px-1 pt-1 pb-0.5 text-xs tabular-nums ${
                here
                  ? 'bg-brand-700 text-white dark:bg-brand-600'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="flex h-6 w-full items-end justify-center" aria-hidden>
                <span
                  className={`w-4 rounded-sm ${here ? 'bg-white/80' : 'bg-brand-300 dark:bg-brand-800'}`}
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

/** Ground.news-style blind spot feed, folded into the hour (or day): the
 *  events one camp is barely on, then the ones a camp is pushing far harder
 *  than usual. `scope` names the period, `basis` the window the split is
 *  judged against. */
export function CampGap({ events, scope = '本小時', basis = '過去 24 小時' }: { events: EventItem[]; scope?: string; basis?: string }) {
  const pick = (camp: 'blue' | 'green') =>
    events
      .filter((e) => e.coverage && (e.coverage.blindspot.includes(camp === 'blue' ? 'green' : 'blue') || e.coverage.tilt === camp))
      .sort((a, b) => {
        const spot = (e: EventItem) => (e.coverage?.blindspot.length ? 1 : 0);
        return spot(b) - spot(a) || Math.abs(b.coverage?.lean ?? 0) - Math.abs(a.coverage?.lean ?? 0);
      })
      // A day can hold two threads under one headline; list the story once.
      .filter((e, i, list) => list.findIndex((o) => eventHeadline(o) === eventHeadline(e)) === i)
      .slice(0, 4);
  const cols = [
    { camp: 'blue' as const, title: '藍營在推、綠營少報', items: pick('blue') },
    { camp: 'green' as const, title: '綠營在推、藍營少報', items: pick('green') },
  ];
  if (cols.every((c) => c.items.length === 0))
    return (
      <p className="rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {scope} {events.length} 件事的藍綠報導比例都在平常範圍內，沒有盲點。
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
        相對於{basis}的整體比例，哪一邊的媒體特別在寫、哪一邊幾乎沒報。「盲點」表示那一營的讀者看不到這件事。
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {cols.map((col) => (
          <div key={col.camp} className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-900">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${col.camp === 'blue' ? 'bg-blue-600' : 'bg-emerald-600'}`} aria-hidden />
              {col.title}
            </h3>
            {col.items.length === 0 ? (
              <p className="text-xs text-zinc-500">{scope}沒有。</p>
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

export function EventIndex({ events, scope = '本小時' }: { events: EventItem[]; scope?: string }) {
  return (
    <nav aria-label="事件索引" className="rounded-xl border border-zinc-200 p-3 text-sm sm:col-span-2 dark:border-zinc-800">
      <h2 className="font-semibold">
        {scope} {events.length} 件事
      </h2>
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
