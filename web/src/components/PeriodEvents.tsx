import Link from 'next/link';
import { CampBadge, FullBar, SplitBar } from '@/components/CampBar';
import SafeImage from '@/components/SafeImage';
import type { MediaInfo } from '@/lib/api';
import { cleanEventHeadline, clipHeadline, selectEventCover, selectEventLead } from '@/lib/event-presentation.mts';
import { isAllowedImage } from '@/lib/images';
import type { EventNews, PeriodThread } from '@/lib/pages';

// 最新文章's lead: the main event threads of the chosen period, heaviest first,
// so the stream below opens with what it is mostly about. The first thread
// gets a cover, its tags and how other outlets headlined it; the rest are
// compact cards. Each says how widely it ran (outlets, reports, hours on the
// table) and whether one camp sat it out.

export const threadHref = (t: PeriodThread) => `/eve/${t.id}/`;

export function threadHeadline(t: PeriodThread, max?: number): string {
  const lead = selectEventLead(t.news, t.majorTags);
  return lead ? clipHeadline(cleanEventHeadline(lead.title), max) : t.majorTags.slice(0, 3).join('、');
}

/** Hours on the table, as days once it ran past two. */
const onTable = (hours: number) => (hours >= 48 ? `在榜約 ${Math.round(hours / 24)} 天` : `在榜 ${hours} 小時`);

function Reach({ t, bar = true }: { t: PeriodThread; bar?: boolean }) {
  const c = t.coverage;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
      {c && c.outlets.length > 0 && (
        <span>
          {c.outlets.length} 家 · {c.articles.toLocaleString()} 篇
        </span>
      )}
      <span>{onTable(t.hours)}</span>
      {c && bar && <SplitBar c={c} width="w-16" />}
      {c && <CampBadge c={c} />}
    </span>
  );
}

function Cover({ t, className, sizes }: { t: PeriodThread; className: string; sizes: string }) {
  const img = selectEventCover(t.news, selectEventLead(t.news, t.majorTags), isAllowedImage);
  if (!img) return null;
  return (
    <span className={`block flex-none overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${className}`}>
      <SafeImage src={img.image} alt="" width={640} height={360} sizes={sizes} className="h-full w-full object-cover" />
    </span>
  );
}

/** How other outlets headlined it: up to three reports besides the lead, one
 *  per camp first. Plain text, since the whole card is the thread's link. */
function Angles({ t, media }: { t: PeriodThread; media: MediaInfo }) {
  const lead = selectEventLead(t.news, t.majorTags);
  const others = t.news.filter((n) => n !== lead);
  const picked: EventNews[] = [];
  for (const camp of ['green', 'blue', 'other'] as const) {
    const n = others.find((o) => o.camp === camp);
    if (n) picked.push(n);
  }
  for (const n of others) if (picked.length < 3 && !picked.includes(n)) picked.push(n);
  if (picked.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1 border-t border-zinc-200 pt-2 text-sm dark:border-zinc-800">
      {picked.slice(0, 3).map((n) => (
        <li key={n.url} className="flex min-w-0 items-baseline gap-2">
          <span className={`shrink-0 text-xs font-medium ${n.camp ? CAMP_TEXT[n.camp] : 'text-zinc-500'}`}>
            {media[n.media]?.title ?? n.media}
          </span>
          <span className="truncate text-zinc-700 dark:text-zinc-300">{clipHeadline(cleanEventHeadline(n.title))}</span>
        </li>
      ))}
    </ul>
  );
}

const CAMP_TEXT = {
  blue: 'text-blue-700 dark:text-blue-300',
  green: 'text-emerald-700 dark:text-emerald-300',
  other: 'text-zinc-500 dark:text-zinc-400',
} as const;

export default function PeriodEvents({ threads, days, media }: { threads: PeriodThread[]; days: number; media: MediaInfo }) {
  if (threads.length === 0) return null;
  const [lead, ...rest] = threads;
  return (
    <section className="space-y-3" aria-labelledby="period-events">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="period-events" className="text-lg font-semibold tracking-tight">
          過去 {days} 天的主要事件
        </h2>
        <Link href="/event/" className="text-sm text-brand-700 hover:underline dark:text-brand-400">
          {days === 1 ? '今天的事件排行' : '每日事件表'} →
        </Link>
      </div>
      <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <li className="md:col-span-2 lg:col-span-3">
          <Link
            href={threadHref(lead)}
            className="group grid overflow-hidden rounded-xl border border-zinc-300 bg-white hover:border-brand-700 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500"
          >
            <Cover t={lead} className="aspect-video md:aspect-auto md:h-full" sizes="(max-width: 768px) 100vw, 480px" />
            <span className="flex min-w-0 flex-col justify-center gap-2 p-4">
              <span className="text-xs font-medium text-brand-700 dark:text-brand-400">最受關注</span>
              <span className="text-xl font-semibold leading-snug group-hover:underline">{threadHeadline(lead)}</span>
              <span className="text-xs text-zinc-500">
                {lead.majorTags
                  .slice(0, 5)
                  .map((tag) => `#${tag}`)
                  .join(' ')}
              </span>
              {lead.coverage && <FullBar c={lead.coverage} />}
              <Reach t={lead} bar={false} />
              <Angles t={lead} media={media} />
            </span>
          </Link>
        </li>
        {rest.map((t, i) => (
          // Phones get the lead and three more, so the stream is not six screens down.
          <li key={t.id} className={i >= 3 ? 'hidden md:block' : undefined}>
            <Link
              href={threadHref(t)}
              className="group flex h-full gap-3 rounded-xl border border-zinc-300 bg-white p-3 hover:border-brand-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500"
            >
              <Cover t={t} className="aspect-square w-16 rounded-lg sm:w-20" sizes="80px" />
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="line-clamp-2 font-medium leading-snug group-hover:underline">{threadHeadline(t)}</span>
                <Reach t={t} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
