import Link from 'next/link';
import { fetchMedia, type MediaInfo, taipeiHour } from '@/lib/api';
import { cleanEventHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import { fetchEventDay } from '@/lib/pages';

export const revalidate = 300;
export const metadata = { title: '事件存檔' };

const weekday = (day: string) => '日一二三四五六'[new Date(`${day}T00:00:00Z`).getUTCDay()];

export default async function EventArchivePage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const q = (await searchParams).day;
  const day = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : undefined;
  const [data, media] = await Promise.all([fetchEventDay(day), fetchMedia().catch((): MediaInfo => ({}))]);
  if (!data)
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">事件存檔</h1>
        <p className="text-sm text-zinc-600">事件資料暫時無法取得，請稍後重新整理。</p>
      </div>
    );
  const i = data.days.indexOf(data.day);
  const prev = i > 0 ? data.days[i - 1] : i === -1 ? data.days.filter((d) => d < data.day).at(-1) : undefined;
  const next = i >= 0 && i < data.days.length - 1 ? data.days[i + 1] : undefined;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-zinc-600">
          <Link href="/event/" className="hover:underline">
            事件表
          </Link>{' '}
          / 存檔
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {data.day}（{weekday(data.day)}）的事件
        </h1>
        <p className="mt-1 text-sm text-zinc-600">這一天出現在事件表上的 {data.threads.length} 則事件，依最高爆發力排序。</p>
      </div>
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {prev && (
          <Link href={`/event/archive/?day=${prev}`} className="rounded-md bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
            ← 前一天
          </Link>
        )}
        {next && (
          <Link href={`/event/archive/?day=${next}`} className="rounded-md bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
            後一天 →
          </Link>
        )}
        <span className="ml-2 flex flex-wrap gap-1">
          {data.days.map((d) => (
            <Link
              key={d}
              href={`/event/archive/?day=${d}`}
              className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${d === data.day ? 'bg-sky-600 text-white' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
            >
              {d.slice(5).replace('-', '/')}
            </Link>
          ))}
        </span>
      </nav>
      {data.threads.length === 0 ? (
        <p className="text-sm text-zinc-600">這一天沒有事件資料。</p>
      ) : (
        <ol className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {data.threads.map((t) => {
            const lead = selectEventLead(t.news, t.majorTags);
            return (
              <li key={t.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link href={`/eve/${t.id}/`} className="font-semibold leading-snug hover:underline">
                    {lead ? cleanEventHeadline(lead.title) : t.majorTags.join('、')}
                  </Link>
                  {lead && <span className="text-xs text-zinc-600">{media[lead.media]?.title ?? lead.media}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600">
                  {t.majorTags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tag/${encodeURIComponent(tag)}`}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {tag}
                    </Link>
                  ))}
                  <span className="tabular-nums">
                    {taipeiHour(t.firstTime)} 至 {taipeiHour(t.lastTime)} · {t.hours} 小時 · 最高分 {t.maxScore.toFixed(1)}
                    {t.bestRank ? ` · 最高第 ${t.bestRank} 名` : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
