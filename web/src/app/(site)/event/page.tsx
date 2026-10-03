import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import { fetchMedia, type MediaInfo, taipei, taipeiHour } from '@/lib/api';
import { cleanEventHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import { type EventNews, fetchEvents } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';

function eventHeadline(news: EventNews[], major: string[]): string | null {
  const lead = selectEventLead(news, major);
  return lead ? cleanEventHeadline(lead.title) : null;
}

export const revalidate = 120;
export const metadata = { title: '事件表' };

const atLink = (iso: string) => `/event/?at=${encodeURIComponent(iso)}`;
const hh = (iso: string) => taipeiHour(iso).slice(-5);
const taipeiDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);

export default async function EventPage({ searchParams }: { searchParams: Promise<{ limit?: string; at?: string }> }) {
  const sp = await searchParams;
  const limit = Math.min(30, Math.max(5, Number(sp.limit) || 30));
  const at = sp.at && !Number.isNaN(Date.parse(sp.at)) ? sp.at : undefined;
  const [data, media] = await Promise.all([fetchEvents(limit, at), fetchMedia().catch((): MediaInfo => ({}))]);
  const archived = !!data?.next;
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
        <p className="mt-1 text-sm text-zinc-600">
          {data
            ? `${taipeiHour(data.hour)} 時段最重要的 ${data.events.length} 件事 · 依標籤共現分群${data.stale ? '（分群排程延遲，顯示上次結果）' : ''}`
            : '事件資料暫時無法取得，請稍後重新整理。'}
        </p>
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
          {data.dayHours && data.dayHours.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {data.dayHours.map((h) => (
                <Link
                  key={h}
                  href={atLink(h)}
                  className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${h === data.hour ? 'bg-sky-600 text-white' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
                >
                  {hh(h)}
                </Link>
              ))}
            </div>
          )}
        </nav>
      )}
      {data && (
        <ol className="grid gap-4 md:grid-cols-2">
          {data.events.map((e) => (
            <li key={e.rank} className="flex flex-col rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-lg font-semibold tabular-nums text-zinc-500">{e.rank}</span>
                <span className="text-sm text-zinc-600">爆發力 {Number(e.score).toFixed(1)}</span>
                {e.relatedEventPk && (
                  <a href={`/eve/${e.relatedEventPk}/`} className="ml-auto text-xs text-brand-700 hover:underline dark:text-brand-400">
                    各媒體標題對照 #{e.relatedEventPk} →
                  </a>
                )}
              </div>
              {eventHeadline(e.news, e.major) && (
                <h2 className="mb-2 text-base font-semibold leading-snug">
                  {e.relatedEventPk ? (
                    <Link href={`/eve/${e.relatedEventPk}/`} className="hover:underline">
                      {eventHeadline(e.news, e.major)}
                    </Link>
                  ) : (
                    eventHeadline(e.news, e.major)
                  )}
                </h2>
              )}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {e.major.map((t) => (
                  <Link
                    key={t}
                    href={`/tag/${encodeURIComponent(t)}`}
                    className="rounded-full bg-brand-700 px-2.5 py-0.5 text-xs font-medium text-white"
                  >
                    {t}
                  </Link>
                ))}
                {e.tags
                  .filter((t) => !e.major.includes(t.tag))
                  .slice(0, 6)
                  .map((t) => (
                    <Link
                      key={t.tag}
                      href={`/tag/${encodeURIComponent(t.tag)}`}
                      className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {t.tag}
                    </Link>
                  ))}
              </div>
              <ul className="mt-auto space-y-2">
                {e.news.map((n, i) => (
                  <li key={n.url + String(i)} className="flex gap-3">
                    {n.image && /^https?:\/\//.test(n.image) && (
                      <Link href={articleHref(n)} tabIndex={-1} aria-label={`閱讀：${n.title}`} className="flex-none">
                        <SafeImage
                          src={n.image}
                          alt=""
                          width={80}
                          height={54}
                          className="h-14 w-20 flex-none rounded-md object-cover"
                          loading="lazy"
                        />
                      </Link>
                    )}
                    <div className="min-w-0">
                      <Link href={articleHref(n)} className="line-clamp-2 text-sm hover:underline">
                        {n.title}
                      </Link>
                      <SourceLink url={n.url} className="ml-2" />
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-600">
                        {media[n.media]?.icon && (
                          <SafeImage src={media[n.media].icon} alt="" width={12} height={12} className="rounded-sm" loading="lazy" />
                        )}
                        <MediaHoverLink media={n.media} className="hover:underline">
                          {media[n.media]?.title ?? n.media}
                        </MediaHoverLink>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {data && <p className="text-xs text-zinc-600">計算時間 {data.builtAt ? taipei(data.builtAt) : '—'}。每半小時依標籤共現重新分群。</p>}
    </div>
  );
}
