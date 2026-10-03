import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
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
        <p className="mt-1 text-sm text-zinc-600">各媒體最新推出的專題／議題頁</p>
      </div>
      {!data ? (
        <p className="text-zinc-600">議題資料目前無法取得。</p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="依媒體瀏覽">
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
                  <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                    {t.mediaTitle}
                    <span aria-hidden>·</span>
                    {t.time && !t.backlog ? taipei(t.time) : '開始追蹤前已上架'}
                  </span>
                  <SourceLink url={t.url} label="原站專題" />
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
