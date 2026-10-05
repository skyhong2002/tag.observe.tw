import Link from 'next/link';
import ArticleThumbnail from '@/components/ArticleThumbnail';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import PendingLabel from '@/components/PendingLabel';
import { threadHeadline, threadHref } from '@/components/PeriodEvents';
import SourceLink from '@/components/SourceLink';
import { type MediaInfo, taipei } from '@/lib/api';
import { matchThread, sectionByTime, taipeiClock } from '@/lib/article-listing.mts';
import { CAMPS, type Camp, type Facets, type Hit, RANGES, type SearchResult } from '@/lib/article-search';
import { clipHeadline } from '@/lib/event-presentation.mts';
import type { PeriodThread } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';

// The article listing shared by 搜尋新聞 and 最新文章: range chips, the camp and
// outlet facets of the whole match (a side column on wide screens), the page
// of articles in time sections, and the cursor pager.

export type ListingLink = (patch: Partial<Record<'days' | 'camp' | 'cursor', string | null>>) => string;

const chip = (on: boolean) =>
  `whitespace-nowrap rounded-full px-3 py-1 ${on ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`;

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: split parts have no identity
          <mark key={i} className="rounded-sm bg-amber-100 px-0.5 text-inherit dark:bg-amber-900/60">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function RangeChips({
  days,
  defaultDays,
  link,
  children,
}: {
  days: number;
  /** The range the page shows without a `days` parameter. */
  defaultDays: number;
  link: ListingLink;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {RANGES.map((r) => (
        <Link
          key={r.days}
          href={link({ days: r.days === defaultDays ? null : String(r.days), cursor: null })}
          scroll={false}
          className={chip(r.days === days)}
        >
          {r.label}
        </Link>
      ))}
      {children}
    </div>
  );
}

const OUTLETS = 10;

/** The camp split and outlet list of every article matched, not only this
 *  page. Narrow enough for the listing's side column. */
export function ArticleFacets({
  facets,
  subject,
  days,
  camp,
  link,
  media,
}: {
  facets: Facets;
  /** What was matched: 「q」 for a search, 全站 for the plain listing. */
  subject: string;
  days: number;
  camp: Camp | null;
  link: ListingLink;
  media: MediaInfo;
}) {
  if (facets.total <= 0) return null;
  const top = facets.media[0]?.count ?? 1;
  return (
    <section
      className="space-y-4 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="文章的媒體分布"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {subject}過去 {days} 天
        <strong className="mx-1 block text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {facets.total.toLocaleString()} 篇
        </strong>
        來自 {facets.media.length} 家媒體
      </p>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-xs text-zinc-500">
          <span>藍綠分布（點選只看一邊）</span>
          {camp && (
            <Link href={link({ camp: null, cursor: null })} scroll={false} className="text-brand-700 hover:underline dark:text-brand-400">
              看全部
            </Link>
          )}
        </div>
        <div className="flex h-7 w-full gap-px overflow-hidden rounded text-[11px] font-medium">
          {CAMPS.filter((c) => facets.camps[c.key] > 0).map((c) => {
            const n = facets.camps[c.key];
            const pct = Math.round((n / facets.total) * 100);
            return (
              <Link
                key={c.key}
                href={link({ camp: camp === c.key ? null : c.key, cursor: null })}
                scroll={false}
                aria-current={camp === c.key ? 'true' : undefined}
                title={`${c.label} ${n.toLocaleString()} 篇（${pct}%）`}
                className={`flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap ${c.bar} ${camp && camp !== c.key ? 'opacity-30' : ''}`}
                style={{ flexGrow: n, flexBasis: 0 }}
              >
                {pct >= 12 && `${pct}%`}
              </Link>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-3 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
          {CAMPS.map((c) => (
            <li key={c.key}>
              <Link
                href={link({ camp: camp === c.key ? null : c.key, cursor: null })}
                scroll={false}
                className={`hover:underline ${camp === c.key ? 'font-semibold text-zinc-900 dark:text-zinc-100' : ''}`}
              >
                {c.label} {facets.camps[c.key].toLocaleString()}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-zinc-500">發稿最多的媒體</p>
        <ol className="space-y-1 text-xs">
          {facets.media.slice(0, OUTLETS).map((m, i) => (
            // Above the list on phones, so only the first five there.
            <li key={m.media} className={`relative items-center gap-1.5 rounded px-1.5 py-1 ${i >= 5 ? 'hidden lg:flex' : 'flex'}`}>
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded bg-zinc-100 dark:bg-zinc-800"
                style={{ width: `${Math.max(4, (m.count / top) * 100)}%` }}
              />
              <MediaIcon media={m.media} title={media[m.media]?.title} className="relative" />
              <Link href={`/media/${encodeURIComponent(m.media)}/`} className="relative min-w-0 flex-1 truncate hover:underline">
                {media[m.media]?.title ?? m.media}
              </Link>
              <span className="relative tabular-nums text-zinc-500">{m.count.toLocaleString()}</span>
            </li>
          ))}
        </ol>
        {facets.media.length > OUTLETS && <p className="text-xs text-zinc-500">另有 {facets.media.length - OUTLETS} 家</p>}
      </div>
    </section>
  );
}

function ArticleRow({ a, q, thread }: { a: Hit; q: string; thread: PeriodThread | null }) {
  const badge = CAMPS.find((c) => c.key === a.camp);
  const href = articleHref(a);
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          <MediaHoverLink media={a.media} className="font-medium hover:underline">
            {a.mediaTitle}
          </MediaHoverLink>
          {badge?.badge && (
            <span className={`rounded px-1 text-[10px] font-medium ring-1 ring-inset ${badge.badge}`}>
              {a.camp === 'blue' ? '偏藍' : '偏綠'}
            </span>
          )}
          <span aria-hidden>·</span>
          <time dateTime={a.publishedAt} title={taipei(a.publishedAt)} className="tabular-nums">
            {taipeiClock(a.publishedAt)}
            {a.datePending && ' *'}
          </time>
          <SourceLink url={a.url} iconOnly className="!min-h-5" />
        </p>
        <h3 className="mt-1 text-[15px] font-medium leading-6">
          <Link href={href} className="line-clamp-2 hover:text-brand-700 dark:hover:text-brand-400">
            <Highlight text={clipHeadline(a.title)} q={q} />
          </Link>
        </h3>
        {a.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Highlight text={a.description} q={q} />
          </p>
        )}
        {(thread || a.tags.length > 0) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            {thread && (
              <Link
                href={threadHref(thread)}
                className="max-w-full truncate rounded bg-brand-50 px-1.5 py-px font-medium text-brand-800 hover:underline dark:bg-brand-950 dark:text-brand-300"
                title="這篇的關鍵字與這件事件的主要關鍵字相符"
              >
                相關事件：{threadHeadline(thread, 24)}
              </Link>
            )}
            {a.tags.slice(0, thread ? 4 : 6).map((t) => (
              <Link
                key={t}
                href={`/tag/${encodeURIComponent(t)}/`}
                className={`hover:text-brand-700 ${t === q ? 'font-medium text-brand-700 dark:text-brand-400' : ''}`}
              >
                #{t}
              </Link>
            ))}
          </p>
        )}
      </div>
      <ArticleThumbnail src={a.image} href={href} title={a.title} />
    </li>
  );
}

/** One page of articles in hour (one-day listings) or day sections, each
 *  tagged with the period thread it belongs to when there is one. */
export function ArticleList({
  page,
  q = '',
  empty,
  byHour = false,
  threads = [],
}: {
  page: SearchResult;
  q?: string;
  empty: string;
  byHour?: boolean;
  threads?: PeriodThread[];
}) {
  if (page.articles.length === 0)
    return <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">{empty}</p>;
  return (
    <div className="space-y-4">
      {sectionByTime(page.articles, byHour).map((s) => (
        <section key={s.key} aria-label={s.label}>
          <h2 className="sticky top-14 z-10 flex items-center gap-2 bg-zinc-50/95 py-1.5 text-xs font-medium text-zinc-500 backdrop-blur dark:bg-zinc-950/95">
            <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{s.label}</span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden />
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {s.items.map((a) => (
              <ArticleRow key={a.id} a={a} q={q} thread={matchThread(a.tags, threads)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ArticlePager({ page, cursor, link }: { page: SearchResult; cursor: string | null; link: ListingLink }) {
  return (
    <div className="flex justify-between text-sm">
      {cursor ? (
        <Link href={link({ cursor: null })} scroll={false} className="text-brand-700 hover:underline dark:text-brand-400">
          ← 回到最新
        </Link>
      ) : (
        <span />
      )}
      {page.nextCursor && (
        <Link href={link({ cursor: page.nextCursor })} scroll={false} className="text-brand-700 hover:underline dark:text-brand-400">
          <PendingLabel>更早的文章 →</PendingLabel>
        </Link>
      )}
    </div>
  );
}
