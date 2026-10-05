import Link from 'next/link';
import { BaselineBar } from '@/components/CampBar';
import EventCard, { type EventTier } from '@/components/EventCard';
import { CampGap, EventIndex, HourTimeline } from '@/components/EventOverview';
import MediaSidebar from '@/components/MediaSidebar';
import MethodLink from '@/components/MethodLink';
import { fetchMedia, type MediaInfo, taipeiHour } from '@/lib/api';
import { type ArchivedThread, type EventItem, fetchEventDay } from '@/lib/pages';
import { archiveDay, canonicalQuery, pageMetadata } from '@/lib/seo.mts';

export const revalidate = 300;
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const value = archiveDay((await searchParams).day);
  const data = await fetchEventDay(value);
  return {
    ...pageMetadata(
      canonicalQuery('/event/archive/', { day: value }),
      value ? `${value} · 事件存檔` : '事件存檔',
      data?.threads.length
        ? `${data.day} 共 ${data.threads.length} 件新聞事件，回顧事件發展、各媒體報導與當時熱門關鍵字。`
        : '回顧曾登上事件表的新聞，查看事件發展、各媒體報導與當時熱門關鍵字。',
    ),
    ...(!data?.threads.length ? { robots: { index: false, follow: true } } : {}),
  };
}

// One day of the event table, laid out like the hourly page: every thread that
// was on the table that day, ranked by its best burst, in the same three
// weights, with the camp blind spots and an hour strip back into the table.

const weekday = (day: string) => '日一二三四五六'[new Date(`${day}T00:00:00Z`).getUTCDay()];
const dayLink = (day: string) => `/event/archive/?day=${day}`;
const atLink = (iso: string) => `/event/?at=${encodeURIComponent(iso)}`;
const hh = (iso: string) => taipeiHour(iso).slice(-5);
const taipeiDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);
const mmdd = (day: string) => day.slice(5).replace('-', '/');
/** Clock time, with the date when it falls on another day. */
const when = (iso: string, day: string) => (taipeiDay(iso) === day ? hh(iso) : `${mmdd(taipeiDay(iso))} ${hh(iso)}`);

/** The rank line from the thread's first hour on the table, so a run that
 *  began late in the 24h window fills the chart instead of hugging one end. */
const trimTrail = (trail: Array<number | null> | null | undefined) => {
  const start = trail?.findIndex((r) => r !== null) ?? -1;
  return trail && start > 0 ? trail.slice(start) : trail;
};
/** What the rank line covers, as clock times. */
function trailSpan(t: ArchivedThread, day: string) {
  const trail = trimTrail(t.rankTrail);
  if (!t.trailEnd || !trail?.length) return '最近 24 小時';
  const start = new Date(Date.parse(t.trailEnd) - (trail.length - 1) * 3600e3).toISOString();
  return `${when(start, day)} 至 ${when(t.trailEnd, day)} `;
}

const HERO = 3,
  CARDS = 9;
const tierOf = (rank: number): EventTier => (rank <= HERO ? 'hero' : rank <= CARDS ? 'card' : 'row');

/** A thread in the shape of an hourly event, so the table's cards render it. */
const asEvent = (t: ArchivedThread, rank: number): EventItem => ({
  rank,
  score: t.maxScore,
  major: t.majorTags,
  tags: t.majorTags.map((tag) => ({ tag, burst: null })),
  news: t.news,
  relatedEventPk: String(t.id),
  hours: t.hours,
  rankTrail: trimTrail(t.rankTrail),
  firstTime: t.firstTime,
  coverage: t.coverage,
});

/** Best rank and the span on the table: the archive's stand-in for movement. */
function Run({ t, day }: { t: ArchivedThread; day: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums">
      {t.bestRank === 1 ? (
        <span className="rounded bg-brand-700 px-1 py-px text-white dark:bg-brand-500">登上第 1 名</span>
      ) : (
        t.bestRank && <span className="text-zinc-500">最高第 {t.bestRank} 名</span>
      )}
      <span className="text-zinc-500" title={`${taipeiHour(t.firstTime)} 至 ${taipeiHour(t.lastTime)}`}>
        <Link href={atLink(t.firstTime)} className="hover:underline">
          {when(t.firstTime, day)}
        </Link>
        {t.lastTime !== t.firstTime && ` 至 ${when(t.lastTime, day)}`}
      </span>
    </span>
  );
}

export default async function EventArchivePage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const day = archiveDay((await searchParams).day);
  const [data, media] = await Promise.all([fetchEventDay(day), fetchMedia().catch((): MediaInfo => ({}))]);
  if (!data)
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">事件存檔</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">事件資料暫時無法取得，請稍後重新整理。</p>
      </div>
    );
  const i = data.days.indexOf(data.day);
  const prev = i > 0 ? data.days[i - 1] : i === -1 ? data.days.filter((d) => d < data.day).at(-1) : undefined;
  const next = i >= 0 && i < data.days.length - 1 ? data.days[i + 1] : undefined;
  // Today's camp split is the trailing 24h, as on the live table.
  const today = data.day === taipeiDay(new Date().toISOString());
  const basis = today ? '過去 24 小時' : '當天';
  const threads = [...data.threads].sort((a, b) => b.maxScore - a.maxScore);
  const events = threads.map((t, n) => asEvent(t, n + 1));
  const max = Math.max(0, ...events.map((e) => e.score));
  const tiers = (['hero', 'card', 'row'] as const).map((tier) => ({
    tier,
    items: events.filter((e) => tierOf(e.rank) === tier),
  }));
  const card = (e: EventItem, tier: EventTier) => (
    <EventCard
      key={e.rank}
      e={e}
      tier={tier}
      max={max}
      media={media}
      meta={<Run t={threads[e.rank - 1]} day={data.day} />}
      trailSpan={trailSpan(threads[e.rank - 1], data.day)}
    />
  );
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/event/" className="hover:underline">
            事件表
          </Link>{' '}
          / 存檔
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {data.day}（{weekday(data.day)}）的事件
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          這一天出現在事件表上的 {threads.length} 件事
          <MethodLink className="ml-2 text-xs" />
        </p>
        <p className="mt-1 text-xs text-zinc-500">點時間可回到當時的事件表。</p>
        {data.baseline && (
          <div className="mt-2">
            <BaselineBar b={data.baseline} label={`${basis}整體`} />
          </div>
        )}
      </div>
      <nav className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2">
          {prev ? (
            <Link href={dayLink(prev)} className="rounded-md bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
              ← 前一天
            </Link>
          ) : (
            <span className="rounded-md px-3 py-1 text-zinc-500">← 前一天</span>
          )}
          {next ? (
            <Link href={dayLink(next)} className="rounded-md bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
              後一天 →
            </Link>
          ) : (
            <span className="rounded-md px-3 py-1 text-zinc-500">後一天 →</span>
          )}
          <span className="flex flex-wrap gap-1">
            {data.days.map((d) => (
              <Link
                key={d}
                href={dayLink(d)}
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
          <Link href="/event/" className="ml-auto text-sky-700 hover:underline dark:text-sky-400">
            最新事件表 →
          </Link>
        </div>
        <HourTimeline hours={data.dayHours ?? []} dayStats={data.dayStats} />
      </nav>
      {threads.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">這一天沒有事件資料。</p>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
          <MediaSidebar label={`事件索引（${threads.length} 件）`}>
            <div className="lg:sticky lg:top-4">
              <EventIndex events={events} scope="這一天" />
            </div>
          </MediaSidebar>
          <div className="mt-5 min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:mt-0">
            {events.some((e) => e.coverage) && <CampGap events={events} scope="這一天" />}
            {tiers.map(({ tier, items }) =>
              items.length === 0 ? null : tier === 'hero' ? (
                <ol key={tier} className="space-y-4" aria-label="當天頭條">
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
