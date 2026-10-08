import Link from 'next/link';
import { BaselineBar } from '@/components/CampBar';
import EventCard, { type EventTier } from '@/components/EventCard';
import { CampGap, EventIndex, HourTimeline, ViewSwitch } from '@/components/EventOverview';
import MediaSidebar from '@/components/MediaSidebar';
import MethodLink from '@/components/MethodLink';
import type { MediaInfo } from '@/lib/api';
import { cleanEventHeadline, clipHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import { type ArchivedThread, dayStories, dayStoryAsEvent, type EventDay, type EventItem } from '@/lib/pages';

// The event table's default view: one Taipei day, each story ranked by how
// long and how high it ran that day (its hourly scores summed), with the
// threads the hourly clustering re-opened for the same story folded into it.
// The hourly table stays one switch away for anyone following a single hour.

const HOUR = 3600e3;
export const dayHref = (day: string) => `/event/?day=${day}`;
export const hourHref = (iso?: string) => (iso ? `/event/?at=${encodeURIComponent(iso)}` : '/event/?view=hour');
export const taipeiDay = (iso: string) => new Date(Date.parse(iso) + 8 * HOUR).toISOString().slice(0, 10);
const weekday = (day: string) => '日一二三四五六'[new Date(`${day}T00:00:00Z`).getUTCDay()];
const mmdd = (day: string) => day.slice(5).replace('-', '/');
const pad = (n: number) => String(n).padStart(2, '0');
/** Start of hour `i` (0–23) of a Taipei day, as an ISO instant. */
const hourOf = (day: string, i: number) => new Date(Date.parse(`${day}T00:00:00+08:00`) + i * HOUR).toISOString();

const HERO = 3,
  CARDS = 9;
const tierOf = (rank: number): EventTier => (rank <= HERO ? 'hero' : rank <= CARDS ? 'card' : 'row');

/** The story's day at a glance: hours on the table, best rank (linking to that
 *  hour's table) and the clock span it ran. */
function DayRun({ e, t, day }: { e: EventItem; t: ArchivedThread; day: string }) {
  const trail = e.rankTrail ?? [];
  const on = trail.flatMap((r, i) => (r === null ? [] : [i]));
  if (t.hoursOnDay === undefined || on.length === 0) return null;
  const best = Math.min(...on.map((i) => trail[i] as number));
  const bestAt = on.find((i) => trail[i] === best) as number;
  const first = on[0],
    last = on[on.length - 1];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs tabular-nums">
      <Link
        href={hourHref(hourOf(day, bestAt))}
        className={
          best === 1
            ? 'rounded bg-brand-700 px-1 py-px text-white hover:underline dark:bg-brand-500'
            : 'text-zinc-600 hover:underline dark:text-zinc-400'
        }
        title={`${pad(bestAt)}:00 的事件表`}
      >
        {best === 1 ? '登上第 1 名' : `最高第 ${best} 名`}
      </Link>
      <span className="text-zinc-500" title="這一天出現在每小時事件表上的小時數與時段">
        上榜 {on.length} 小時 · {pad(first)}:00{last > first ? `–${pad(last + 1)}:00` : ''}
      </span>
    </span>
  );
}

/** Other threads of the same story that day, each still one click away. */
function Folded({ threads }: { threads: ArchivedThread[] }) {
  if (threads.length === 0) return null;
  const headline = (t: ArchivedThread) => {
    const lead = selectEventLead(t.news, t.majorTags);
    return lead ? clipHeadline(cleanEventHeadline(lead.title), 40) : t.majorTags.slice(0, 3).join('、');
  };
  return (
    <div className="text-xs text-zinc-600 dark:text-zinc-400">
      <p className="font-medium">同一件事的其他發展</p>
      <ul className="mt-0.5 space-y-0.5">
        {threads.map((t) => (
          <li key={t.id} className="flex min-w-0 items-baseline gap-1.5">
            <span aria-hidden>↳</span>
            <Link href={`/eve/${t.id}/`} className="line-clamp-1 text-zinc-700 hover:underline dark:text-zinc-300">
              {headline(t)}
            </Link>
            {t.hoursOnDay ? <span className="shrink-0 tabular-nums text-zinc-500">{t.hoursOnDay} 小時</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Up to two weeks of days around the shown one, plus a date field for the rest. */
function DayPicker({ data }: { data: EventDay }) {
  const i = data.days.indexOf(data.day);
  const prev = i > 0 ? data.days[i - 1] : i === -1 ? data.days.filter((d) => d < data.day).at(-1) : undefined;
  const next = i >= 0 && i < data.days.length - 1 ? data.days[i + 1] : undefined;
  const end = Math.min(data.days.length, Math.max(i + 1, 0) + 3);
  const shown = data.days.slice(Math.max(0, end - 14), end);
  const step = (day: string | undefined, label: string) =>
    day ? (
      <Link href={dayHref(day)} className="rounded-md bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
        {label}
      </Link>
    ) : (
      <span className="rounded-md px-3 py-1 text-zinc-500">{label}</span>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {step(prev, '← 前一天')}
      {step(next, '後一天 →')}
      <span className="flex flex-wrap gap-1">
        {shown.map((d) => (
          <Link
            key={d}
            href={dayHref(d)}
            aria-current={d === data.day ? 'page' : undefined}
            className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${
              d === data.day
                ? 'bg-brand-700 text-white dark:bg-brand-600'
                : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            {mmdd(d)}（{weekday(d)}）
          </Link>
        ))}
      </span>
      {data.days.length > 0 && (
        <form action="/event/" className="ml-auto flex items-center gap-1 text-xs">
          <label htmlFor="event-day" className="text-zinc-600 dark:text-zinc-400">
            選日期
          </label>
          <input
            id="event-day"
            type="date"
            name="day"
            defaultValue={data.day}
            min={data.days[0]}
            max={data.days.at(-1)}
            className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="submit" className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            前往
          </button>
        </form>
      )}
    </div>
  );
}

export default function EventDayView({ data, media, today }: { data: EventDay; media: MediaInfo; today: boolean }) {
  const stories = dayStories(data.threads);
  const events = stories.map((s, n) => dayStoryAsEvent(s, n + 1));
  const daily = data.threads.some((t) => t.dayRank != null);
  const max = Math.max(0, ...events.map((e) => e.score));
  const scope = today ? '今天' : '這一天';
  const lastHour = data.dayHours?.at(-1);
  const prev = data.days.filter((d) => d < data.day).at(-1);
  const tiers = (['hero', 'card', 'row'] as const).map((tier) => ({
    tier,
    items: events.filter((e) => tierOf(e.rank) === tier),
  }));
  const card = (e: EventItem, tier: EventTier) => {
    const s = stories[e.rank - 1];
    return (
      <EventCard
        key={e.rank}
        e={e}
        tier={tier}
        max={max}
        media={media}
        scoreLabel={daily ? '全天熱度' : undefined}
        meta={<DayRun e={e} t={s.lead} day={data.day} />}
        trailSpan={daily ? `${data.day} 各小時` : undefined}
        footer={<Folded threads={s.folded} />}
      />
    );
  };
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">事件表</h1>
            <ViewSwitch view="day" dayHref={dayHref(data.day)} hourHref={today || !lastHour ? hourHref() : hourHref(lastHour)} />
          </div>
          <a
            href="/feeds/events.xml"
            className="rounded-md bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            title="新事件出現時，用 RSS 閱讀器收到通知"
          >
            RSS 訂閱
          </a>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {data.day}（{weekday(data.day)}）{today ? '今天到目前為止' : '整天'}的 {stories.length} 件事
          {daily && '，依全天熱度排序，同一件事的多條事件串併在一起'}
          <MethodLink className="ml-2 text-xs" />
        </p>
        {data.baseline && (
          <div className="mt-2">
            <BaselineBar b={data.baseline} label={`${today ? '過去 24 小時' : '當天'}整體`} />
          </div>
        )}
      </div>
      <nav
        aria-label="選擇日期"
        className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <DayPicker data={data} />
        {(data.dayHours?.length ?? 0) > 1 && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-zinc-600 select-none hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              看某個小時的事件表（{data.dayHours?.length} 個時段）
            </summary>
            <div className="mt-2">
              <HourTimeline hours={data.dayHours ?? []} dayStats={data.dayStats} />
            </div>
          </details>
        )}
      </nav>
      {today && (data.dayHours?.length ?? 0) < 6 && prev && (
        <p className="rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          今天才過了 {data.dayHours?.length ?? 0} 個小時，事件還在累積。
          <Link href={dayHref(prev)} className="ml-1 text-brand-700 hover:underline dark:text-brand-400">
            看昨天（{mmdd(prev)}）的整理 →
          </Link>
        </p>
      )}
      {events.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{scope}沒有事件資料。</p>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
          <MediaSidebar label={`事件索引（${events.length} 件）`}>
            <div className="lg:sticky lg:top-4">
              <EventIndex events={events} scope={scope} />
            </div>
          </MediaSidebar>
          <div className="mt-5 min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:mt-0">
            {events.some((e) => e.coverage) && <CampGap events={events} scope={scope} />}
            {tiers.map(({ tier, items }) =>
              items.length === 0 ? null : tier === 'hero' ? (
                <ol key={tier} className="space-y-4" aria-label={`${scope}頭條`}>
                  {items.map((e) => card(e, tier))}
                </ol>
              ) : tier === 'card' ? (
                <ol key={tier} className="grid gap-4 md:grid-cols-2" aria-label="重要事件">
                  {items.map((e) => card(e, tier))}
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
                  <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">{items.map((e) => card(e, tier))}</ol>
                </section>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
