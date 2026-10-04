import Link from 'next/link';
import type { ReactNode } from 'react';
import MediaHoverLink from '@/components/MediaHoverLink';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import Sparkline from '@/components/Sparkline';
import type { MediaInfo } from '@/lib/api';
import { cleanEventHeadline, selectEventCover, selectEventLead } from '@/lib/event-presentation.mts';
import { isAllowedImage } from '@/lib/images';
import type { EventCoverage, EventItem, EventNews } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';

// One event of the hourly table, in three weights: `hero` for the top of the
// page, `card` for the next tier, and `row` for the long tail. All three lead
// with the same signals (score vs the top event, movement since last hour,
// which outlets are on it) so the page reads like a front page
// rather than thirty equal boxes.

export type EventTier = 'hero' | 'card' | 'row';

export const eventAnchor = (rank: number) => `event-${rank}`;
export const eventHref = (e: EventItem) => (e.relatedEventPk ? `/eve/${e.relatedEventPk}/` : null);

export function eventHeadline(e: EventItem): string {
  const lead = selectEventLead(e.news, e.major);
  return lead ? cleanEventHeadline(lead.title) : e.major.join('、');
}

/** The lead article's photo, else the first one any report offers. */
function cover(e: EventItem): EventNews | null {
  return selectEventCover(e.news, selectEventLead(e.news, e.major), isAllowedImage);
}

/** Movement since the previous snapshot and how long the thread has run. */
export function Movement({ e, className = '' }: { e: EventItem; className?: string }) {
  const parts: Array<{ text: string; tone: string; label: string }> = [];
  if (e.prevRank === null) parts.push({ text: '新上榜', tone: 'bg-brand-700 text-white dark:bg-brand-500', label: '本小時新上榜' });
  else if (typeof e.prevRank === 'number' && e.prevRank !== e.rank) {
    const up = e.prevRank > e.rank;
    const n = Math.abs(e.prevRank - e.rank);
    parts.push({
      text: `${up ? '↑' : '↓'}${n}`,
      tone: up ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500',
      label: `較前一小時${up ? '上升' : '下降'} ${n} 名`,
    });
  }
  if (e.hours && e.hours >= 2) parts.push({ text: `持續 ${e.hours} 小時`, tone: 'text-zinc-500', label: `已連續 ${e.hours} 小時上榜` });
  if (parts.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs tabular-nums ${className}`}>
      {parts.map((p) => (
        <span key={p.text} className={`rounded px-1 py-px ${p.tone}`} title={p.label}>
          {p.text}
        </span>
      ))}
    </span>
  );
}

/** The thread's rank over the last 24 snapshot hours (or whatever `span` the
 *  trail covers), #1 at the top. Only worth drawing once there are two hours
 *  to connect. */
export function RankTrail({ e, className = 'h-6 w-20', span = '最近 24 小時' }: { e: EventItem; className?: string; span?: string }) {
  const trail = e.rankTrail ?? [];
  const seen = trail.filter((r): r is number => r !== null);
  if (seen.length < 2) return null;
  const best = Math.min(...seen);
  return (
    <span
      role="img"
      className="inline-flex items-center rounded bg-zinc-100 px-0.5 dark:bg-zinc-800"
      title={`${span}名次：${trail.map((r) => (r === null ? '－' : r)).join(' ')}；最高第 ${best} 名`}
      aria-label={`${span}名次走勢，最高第 ${best} 名`}
    >
      <Sparkline values={trail} rank color="#0284c7" className={className} />
    </span>
  );
}

/** Score as a bar relative to the hour's top event, so gaps are visible. */
export function ScoreBar({ score, max, width = 'w-16' }: { score: number; max: number; width?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((score / max) * 100)) : 0;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400" title={`爆發力 ${score.toFixed(1)}`}>
      <span className="sr-only">爆發力</span>
      <span className={`${width} h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800`} aria-hidden>
        <span className="block h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">{score.toFixed(1)}</span>
    </span>
  );
}

/** Sources in snapshot order, without grouping outlets by political classification. */
export function OutletStrip({
  c,
  media,
  max = 8,
  compact = false,
}: {
  c: EventCoverage;
  media: MediaInfo;
  max?: number;
  compact?: boolean;
}) {
  if (!c || c.outlets.length === 0) return null;
  const shown = c.outlets.slice(0, max);
  const rest = c.outlets.length - shown.length;
  const outlet = (o: EventCoverage['outlets'][number]) => (
    <MediaHoverLink
      key={o.media}
      media={o.media}
      title={media[o.media]?.title ?? o.media}
      icon={compact ? 16 : 20}
      className="inline-flex min-h-7 min-w-7 items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <span className="sr-only">{media[o.media]?.title ?? o.media}</span>
    </MediaHoverLink>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400" data-outlet-strip="">
      <div className="flex flex-wrap items-center gap-0.5">{shown.map(outlet)}</div>
      {rest > 0 && (
        <details className="open:basis-full">
          <summary className="cursor-pointer rounded px-1 py-1 tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800">
            +其他 {rest} 家
          </summary>
          <div className="mt-1 flex max-w-full flex-wrap gap-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {c.outlets.slice(max).map(outlet)}
          </div>
        </details>
      )}
      <span className="tabular-nums">
        {c.outlets.length} 家 · {c.articles} 篇
      </span>
    </div>
  );
}

function Tags({ e, limit, size = 'text-xs' }: { e: EventItem; limit: number; size?: string }) {
  const others = e.tags.filter((t) => !e.major.includes(t.tag)).slice(0, Math.max(0, limit - e.major.length));
  return (
    <div className={`flex flex-wrap gap-1 ${size}`}>
      {e.major.map((t) => (
        <Link key={t} href={`/tag/${encodeURIComponent(t)}`} className="rounded-full bg-brand-700 px-2 py-0.5 font-medium text-white">
          {t}
        </Link>
      ))}
      {others.map((t) => (
        <Link
          key={t.tag}
          href={`/tag/${encodeURIComponent(t.tag)}`}
          className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {t.tag}
        </Link>
      ))}
    </div>
  );
}

/** Headlines from other outlets, without the repeated press photo. `skip`
 *  holds what the card already shows (cover). */
function Headlines({
  e,
  media,
  limit,
  skip = [],
}: {
  e: EventItem;
  media: MediaInfo;
  limit: number;
  skip?: Array<EventNews | null | undefined>;
}) {
  const list = e.news
    .filter((n) => !skip.includes(n))
    .filter((n, i, news) => news.findIndex((other) => other.media === n.media) === i)
    .slice(0, limit);
  if (list.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {list.map((n, i) => (
        <li key={n.url + String(i)} className="flex items-start gap-1.5">
          <MediaHoverLink media={n.media} icon={14} className="mt-0.5 shrink-0">
            <span className="sr-only">{media[n.media]?.title ?? n.media}</span>
          </MediaHoverLink>
          <Link href={articleHref(n)} className="line-clamp-1 min-w-0 flex-1 hover:underline">
            {n.title}
          </Link>
          <SourceLink url={n.url} iconOnly className="!min-h-5 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

function Compare({ e, className = '' }: { e: EventItem; className?: string }) {
  const href = eventHref(e);
  if (!href) return null;
  return (
    <a href={href} className={`text-xs text-brand-700 hover:underline dark:text-brand-400 ${className}`}>
      各媒體標題對照 →
    </a>
  );
}

function Title({ e, className }: { e: EventItem; className: string }) {
  const href = eventHref(e);
  const text = eventHeadline(e);
  return (
    <h2 className={className}>
      {href ? (
        <Link href={href} className="hover:underline">
          {text}
        </Link>
      ) : (
        text
      )}
    </h2>
  );
}

export default function EventCard({
  e,
  tier,
  max,
  media,
  meta,
  trailSpan,
}: {
  e: EventItem;
  tier: EventTier;
  max: number;
  media: MediaInfo;
  /** Extra signals next to the movement badges (the archive's best rank and run). */
  meta?: ReactNode;
  trailSpan?: string;
}) {
  const img = cover(e);
  const rank = <span className="text-lg font-semibold tabular-nums text-zinc-500">{e.rank}</span>;
  if (tier === 'row') {
    return (
      <li
        id={eventAnchor(e.rank)}
        className="grid scroll-mt-20 grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-1 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
      >
        <span className="text-base font-semibold tabular-nums text-zinc-500">{e.rank}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Title e={e} className="font-medium leading-snug" />
            <Movement e={e} />
            {meta}
            <RankTrail e={e} className="h-5 w-16" span={trailSpan} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ScoreBar score={e.score} max={max} width="w-12" />
            <Tags e={e} limit={3} size="text-[11px]" />
          </div>
        </div>
        <div className="col-start-2 flex flex-col gap-0.5 sm:col-start-3 sm:max-w-64 sm:items-end">
          {e.coverage && <OutletStrip c={e.coverage} media={media} max={4} compact />}
          <Compare e={e} />
        </div>
      </li>
    );
  }
  if (tier === 'hero') {
    return (
      <li
        id={eventAnchor(e.rank)}
        className="grid scroll-mt-20 gap-4 rounded-xl border border-zinc-300 bg-white p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] dark:border-zinc-800 dark:bg-zinc-900"
      >
        {img && (
          <Link
            href={articleHref(img)}
            tabIndex={-1}
            aria-hidden
            className="aspect-video overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
          >
            <SafeImage src={img.image as string} alt="" width={640} height={360} className="h-full w-full object-cover" />
          </Link>
        )}
        <div className={`flex min-w-0 flex-col gap-2 ${img ? '' : 'md:col-span-2'}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {rank}
            <ScoreBar score={e.score} max={max} width="w-24" />
            <Movement e={e} />
            {meta}
            <RankTrail e={e} className="h-7 w-24" span={trailSpan} />
            <Compare e={e} className="ml-auto" />
          </div>
          <Title e={e} className="text-xl font-semibold leading-snug" />
          <Tags e={e} limit={7} />
          {e.coverage && <OutletStrip c={e.coverage} media={media} max={8} />}
          <Headlines e={e} media={media} limit={3} skip={[img]} />
        </div>
      </li>
    );
  }
  return (
    <li
      id={eventAnchor(e.rank)}
      className="flex scroll-mt-20 flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {rank}
        <ScoreBar score={e.score} max={max} width="w-16" />
        <Movement e={e} />
        {meta}
        <RankTrail e={e} span={trailSpan} />
        <Compare e={e} className="ml-auto" />
      </div>
      <div className="flex gap-3">
        {img && (
          <Link
            href={articleHref(img)}
            tabIndex={-1}
            aria-hidden
            className="aspect-video w-28 shrink-0 self-start overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800"
          >
            <SafeImage src={img.image as string} alt="" width={224} height={126} className="h-full w-full object-cover" />
          </Link>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Title e={e} className="font-semibold leading-snug" />
          <Tags e={e} limit={5} />
        </div>
      </div>
      {e.coverage && <OutletStrip c={e.coverage} media={media} max={8} />}
      <Headlines e={e} media={media} limit={3} skip={[img]} />
    </li>
  );
}
