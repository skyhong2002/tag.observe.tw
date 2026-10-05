import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import PendingLabel from '@/components/PendingLabel';
import SourceLink from '@/components/SourceLink';
import { type MediaInfo, taipei } from '@/lib/api';
import { CAMPS, type Camp, type Facets, RANGES, type SearchResult } from '@/lib/article-search';
import { articleHref } from '@/lib/reading.mts';

// The article listing shared by 搜尋新聞 and 文章: range chips, the camp and
// outlet facets of the whole match, the page of articles, and the cursor pager.

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

export function RangeChips({ days, link, children }: { days: number; link: ListingLink; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {RANGES.map((r) => (
        <Link
          key={r.days}
          href={link({ days: r.days === 31 ? null : String(r.days), cursor: null })}
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

/** The camp split and outlet list of every article matched, not only this page. */
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
  return (
    <section
      className="space-y-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="文章的媒體分布"
    >
      <p className="text-sm">
        {subject}過去 {days} 天共 <strong className="tabular-nums">{facets.total.toLocaleString()}</strong> 篇，來自 {facets.media.length}{' '}
        家媒體
      </p>
      <div className="flex h-7 w-full gap-px overflow-hidden rounded text-[11px] font-medium">
        {CAMPS.filter((c) => facets.camps[c.key] > 0).map((c) => {
          const n = facets.camps[c.key];
          const pct = Math.round((n / facets.total) * 100);
          return (
            <Link
              key={c.key}
              href={link({ camp: camp === c.key ? null : c.key, cursor: null })}
              scroll={false}
              title={`${c.label} ${n.toLocaleString()} 篇（${pct}%）`}
              className={`flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap ${c.bar} ${camp && camp !== c.key ? 'opacity-40' : ''}`}
              style={{ flexGrow: n, flexBasis: 0 }}
            >
              {c.label} {pct}%
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link href={link({ camp: null, cursor: null })} scroll={false} className={chip(!camp)}>
          全部 {facets.total.toLocaleString()}
        </Link>
        {CAMPS.map((c) => (
          <Link key={c.key} href={link({ camp: c.key, cursor: null })} scroll={false} className={chip(camp === c.key)}>
            {c.label} {facets.camps[c.key].toLocaleString()}
          </Link>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-zinc-600">
        {facets.media.slice(0, 16).map((m) => (
          <li key={m.media} className="flex items-center gap-1">
            <MediaIcon media={m.media} title={media[m.media]?.title} />
            <Link href={`/media/${encodeURIComponent(m.media)}/`} className="hover:underline">
              {media[m.media]?.title ?? m.media}
            </Link>
            <span className="tabular-nums text-zinc-500">{m.count.toLocaleString()}</span>
          </li>
        ))}
        {facets.media.length > 16 && <li className="text-zinc-500">另 {facets.media.length - 16} 家</li>}
      </ul>
    </section>
  );
}

export function ArticleList({ page, q = '', empty }: { page: SearchResult; q?: string; empty: string }) {
  if (page.articles.length === 0)
    return <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">{empty}</p>;
  return (
    <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {page.articles.map((a) => {
        const badge = CAMPS.find((c) => c.key === a.camp);
        return (
          <li key={a.id} className="p-3">
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-600">
              <MediaHoverLink media={a.media} className="hover:underline">
                {a.mediaTitle}
              </MediaHoverLink>
              {badge?.badge && (
                <span className={`rounded px-1 text-[10px] font-medium ring-1 ring-inset ${badge.badge}`}>
                  {a.camp === 'blue' ? '偏藍' : '偏綠'}
                </span>
              )}
              <span>·</span>
              <span>
                {taipei(a.publishedAt)}
                {a.datePending && ' *'}
              </span>
            </p>
            <Link href={articleHref(a)} className="mt-1 line-clamp-2 font-medium hover:underline">
              <Highlight text={a.title} q={q} />
            </Link>
            <SourceLink url={a.url} className="ml-2" />
            {a.description && (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                <Highlight text={a.description} q={q} />
              </p>
            )}
            {a.tags.length > 0 && (
              <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                {a.tags.slice(0, 8).map((t) => (
                  <Link
                    key={t}
                    href={`/tag/${encodeURIComponent(t)}/`}
                    className={`mr-1.5 hover:text-brand-700 ${t === q ? 'font-medium text-brand-700 dark:text-brand-400' : ''}`}
                  >
                    #{t}
                  </Link>
                ))}
              </p>
            )}
          </li>
        );
      })}
    </ul>
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
