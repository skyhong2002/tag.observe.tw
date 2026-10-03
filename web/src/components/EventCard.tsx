import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import type { MediaInfo } from '@/lib/api';
import { cleanEventHeadline, selectEventCover, selectEventLead } from '@/lib/event-presentation.mts';
import { isAllowedImage } from '@/lib/images';
import type { Camp, EventCoverage, EventItem, EventNews } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';

// One event of the hourly table, in three weights: `hero` for the top of the
// page, `card` for the next tier, and `row` for the long tail. All three lead
// with the same signals (score vs the top event, movement since last hour,
// which outlets and camps are on it) so the page reads like a front page
// rather than thirty equal boxes.

export type EventTier = 'hero' | 'card' | 'row';

const CAMP: Record<Camp, { label: string; dot: string }> = {
  blue: { label: '藍營傾向', dot: 'bg-blue-600 dark:bg-blue-500' },
  green: { label: '綠營傾向', dot: 'bg-emerald-600 dark:bg-emerald-500' },
  other: { label: '其他媒體', dot: 'bg-zinc-400 dark:bg-zinc-500' },
};
const CAMP_ORDER: Camp[] = ['blue', 'green', 'other'];

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

/** Who is on the story: outlet marks, camp counts, and the silent camp. */
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
  const campText = CAMP_ORDER.map((k) => `${CAMP[k].label} ${c.camps[k]} 家`).join('、');
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
      <span className="flex items-center gap-0.5" title={shown.map((o) => media[o.media]?.title ?? o.media).join('、')}>
        {shown.map((o) => (
          <MediaIcon key={o.media} media={o.media} title={media[o.media]?.title} size={compact ? 12 : 14} />
        ))}
        {rest > 0 && <span className="ml-0.5 tabular-nums">+{rest}</span>}
      </span>
      <span className="tabular-nums">
        {c.outlets.length} 家{!compact && ` · ${c.articles} 篇`}
      </span>
      <span className="sr-only">{campText}</span>
      <span className="flex items-center gap-1 tabular-nums" title={campText} aria-hidden>
        {CAMP_ORDER.map((k) => (
          <span key={k} className="flex items-center gap-0.5">
            <span className={`h-1.5 w-1.5 rounded-full ${CAMP[k].dot}`} />
            {c.camps[k]}
          </span>
        ))}
      </span>
      {c.blindspot.map((k) => (
        <span key={k} className="rounded bg-amber-100 px-1.5 py-px text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {CAMP[k].label}媒體未報導
        </span>
      ))}
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

/** Headlines from other outlets, without the repeated press photo. */
function Headlines({ e, media, limit, skip }: { e: EventItem; media: MediaInfo; limit: number; skip?: EventNews | null }) {
  const list = e.news.filter((n) => n !== skip).slice(0, limit);
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

export default function EventCard({ e, tier, max, media }: { e: EventItem; tier: EventTier; max: number; media: MediaInfo }) {
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
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ScoreBar score={e.score} max={max} width="w-12" />
            <Tags e={e} limit={3} size="text-[11px]" />
          </div>
        </div>
        <div className="col-start-2 sm:col-start-3 sm:max-w-56 sm:text-right">
          {e.coverage && <OutletStrip c={e.coverage} media={media} max={6} compact />}
          <Compare e={e} className="mt-0.5 inline-block" />
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
            <Compare e={e} className="ml-auto" />
          </div>
          <Title e={e} className="text-xl font-semibold leading-snug" />
          <Tags e={e} limit={7} />
          {e.coverage && <OutletStrip c={e.coverage} media={media} max={12} />}
          <Headlines e={e} media={media} limit={4} skip={img} />
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
      <Headlines e={e} media={media} limit={3} skip={img} />
    </li>
  );
}
