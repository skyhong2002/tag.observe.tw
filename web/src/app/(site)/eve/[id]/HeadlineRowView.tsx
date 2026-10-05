'use client';

import Link from 'next/link';
import { CampDot } from '@/components/EventCampDot';
import MediaHoverLink from '@/components/MediaHoverLink';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import { taipei } from '@/lib/api';
import type { Camp } from '@/lib/event-thread.mts';
import { articleHref } from '@/lib/reading.mts';

export interface HeadlineArticle {
  id: number;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  description?: string | null;
  outlet: { media: string; title: string; camp: Camp };
}
const clock = (iso: string) => taipei(iso).slice(-5);

function Thumb({ a }: { a: { id: number; title: string; image: string | null } }) {
  if (!a.image || !/^https?:\/\//.test(a.image)) return null;
  return (
    <Link href={articleHref(a)} tabIndex={-1} aria-label={`閱讀：${a.title}`} className="flex-none">
      <SafeImage src={a.image} alt="" width={96} height={64} className="h-14 w-20 rounded object-cover" loading="lazy" />
    </Link>
  );
}

export default function HeadlineRowView({
  a,
  showCamp = true,
  time = true,
  showOutlet = true,
  compact = false,
}: {
  a: HeadlineArticle;
  showCamp?: boolean;
  time?: boolean;
  showOutlet?: boolean;
  /** Title and outlet only, for the folded list of loosely related reports. */
  compact?: boolean;
}) {
  return (
    <li className={`flex gap-2 ${showOutlet && !compact ? 'py-2' : 'py-1.5'}`}>
      {time && <span className="w-11 flex-none pt-0.5 text-xs tabular-nums text-zinc-500">{clock(a.publishedAt)}</span>}
      {!compact && <Thumb a={a} />}
      <div className="min-w-0 flex-1">
        <Link href={articleHref(a)} className={`leading-snug hover:underline ${compact ? '' : 'font-medium'}`}>
          {a.title}
        </Link>
        {!compact && a.description && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">{a.description}</p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-zinc-600 dark:text-zinc-400">
          {showOutlet && (
            <span className="flex items-center gap-1.5">
              {showCamp && <CampDot camp={a.outlet.camp} />}
              <MediaHoverLink media={a.outlet.media} icon={12} className="hover:underline">
                {a.outlet.title}
              </MediaHoverLink>
              {!time && <span className="tabular-nums">{clock(a.publishedAt)}</span>}
            </span>
          )}
          <SourceLink url={a.url} showUrl className="!min-h-5 !text-[11px]" />
        </div>
      </div>
    </li>
  );
}
