import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import TopicCheckStatus from '@/components/TopicCheckStatus';
import { taipei } from '@/lib/api';
import { isAllowedImage } from '@/lib/images';
import { type FeedTopic, fetchTopics, type TopicCoverage } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';
export const revalidate = 300;
export const metadata = { title: '議題表' };

export default async function TopicPage() {
  const data = await fetchTopics();
  // Older API builds have no merged feed; fall back to each outlet's latest.
  const feed: FeedTopic[] =
    data?.feed ??
    (data?.media ?? []).flatMap((m) => (m.latest ? [{ ...m.latest, media: m.media, mediaTitle: m.title, icon: m.icon }] : []));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">議題表</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {data
            ? `目前已接入 ${data.media.length} 家媒體的官方專題／議題入口，每小時檢查更新。`
            : '追蹤媒體官方專題／議題入口，每小時檢查更新。'}
        </p>
        <p className="mt-1 text-xs text-zinc-500">來源持續擴充中；未列出的媒體不代表沒有專題。</p>
      </div>
      {!data ? (
        <p className="text-zinc-600">議題資料目前無法取得。</p>
      ) : (
        <>
          <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <summary className="cursor-pointer text-sm">依媒體瀏覽（{data.media.length} 家）</summary>
            <nav className="mt-3 flex flex-wrap gap-2" aria-label="依媒體瀏覽">
              {data.media.map((m) => (
                <Link
                  key={m.media}
                  href={`/topic/${m.media}`}
                  className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm hover:border-brand-400 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {m.icon && <SafeImage src={m.icon} alt="" width={14} height={14} className="rounded-sm" />}
                  {m.title}
                </Link>
              ))}
            </nav>
          </details>
          <details className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800">
            <summary className="cursor-pointer">來源更新狀態（{data.media.length} 家媒體）</summary>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.media.map((m) => (
                <li key={m.media} className="flex flex-wrap gap-x-2 gap-y-1">
                  <a href={m.link} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                    {m.title} ↗
                  </a>
                  <TopicCheckStatus check={m.check} />
                </li>
              ))}
            </ul>
          </details>
          <p className="text-xs text-zinc-500">依本站首次發現時間排序，不等於媒體上架時間；首次納入的既有專題會另行標示。</p>
          <ul className="grid gap-x-6 lg:grid-cols-2">
            {feed.map((t) => (
              <li key={t.id} className="flex gap-3 border-b border-zinc-300 py-3 dark:border-zinc-800">
                <Link
                  href={`/topic/${encodeURIComponent(t.media)}/#topic-${t.id}`}
                  className="flex aspect-video w-28 shrink-0 items-center justify-center self-start overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800"
                >
                  <SafeImage
                    src={isAllowedImage(t.image) ? t.image : t.mediaImage}
                    alt=""
                    width={224}
                    height={126}
                    className="h-full w-full object-cover"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/topic/${encodeURIComponent(t.media)}/#topic-${t.id}`} className="line-clamp-2 font-medium hover:underline">
                    {t.title}
                  </Link>
                  <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-600">
                    {t.mediaTitle}
                    <span aria-hidden>·</span>
                    {t.time && !t.backlog ? `首次發現 ${taipei(t.time)}` : '開始追蹤前已上架'}
                    <SourceLink url={t.url} label="原站專題" className="!min-h-5 shrink-0" />
                  </span>
                  {t.coverage && <Coverage c={t.coverage} />}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Coverage({ c }: { c: TopicCoverage }) {
  return (
    <div className="mt-1 space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5 text-zinc-600">
        {c.tags.map((tag) => (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300"
          >
            {tag}
          </Link>
        ))}
        <span>
          近 3 天 {c.count}
          {c.capped ? '+' : ''} 篇 · {c.mediaCount} 家媒體
        </span>
      </div>
      <ul className="space-y-0.5">
        {c.latest.slice(0, 2).map((a) => (
          <li key={a.url} className="flex gap-1.5">
            <Link href={articleHref(a)} className="line-clamp-1 flex-1 text-zinc-700 hover:underline dark:text-zinc-400">
              {a.title}
            </Link>
            <span className="shrink-0 text-zinc-500">{a.mediaTitle}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
