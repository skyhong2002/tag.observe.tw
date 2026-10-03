import type { Metadata } from 'next';
import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import RankingBasisNote from '@/components/RankingBasisNote';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import TagChart from '@/components/TagChart';
import TagStatusPanel from '@/components/TagStatusPanel';
import { type Camp, fetchMedia, fetchTagArticles, fetchTagSeries, fetchTagStatus, taipei } from '@/lib/api';
import { articleHref } from '@/lib/reading.mts';

export const revalidate = 60;
type Params = { tag: string };
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const tag = decodeURIComponent((await params).tag);
  return {
    title: tag,
    alternates: {
      types: { 'application/rss+xml': [{ url: `/feeds/tag/${encodeURIComponent(tag)}.xml`, title: `新文易數｜${tag}` }] },
    },
  };
}

export default async function TagPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ hours?: string }> }) {
  const tag = decodeURIComponent((await params).tag);
  const hours = Math.min(336, Math.max(6, Number((await searchParams).hours) || 72));
  const [series, list, media, status] = await Promise.all([
    fetchTagSeries(tag, 'all', hours),
    fetchTagArticles(tag, Math.max(48, hours)),
    fetchMedia(),
    fetchTagStatus(tag).catch(() => null),
  ]);
  const byMedia = new Map<string, { title: string; count: number; camp: Camp }>();
  for (const a of list.articles)
    byMedia.set(a.media, { title: a.mediaTitle, camp: media[a.media]?.camp ?? 'other', count: (byMedia.get(a.media)?.count ?? 0) + 1 });
  const campTotals = { blue: 0, green: 0, other: 0 };
  for (const { count, camp } of byMedia.values()) campTotals[camp] += count;
  const campDot = { blue: 'bg-blue-600', green: 'bg-emerald-600', other: 'bg-zinc-400' } as const;
  const campLabel = { blue: '藍營傾向', green: '綠營傾向', other: '其他' } as const;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="text-zinc-500">#</span>
          {tag}
        </h1>
        <div className="flex gap-1 text-sm">
          {[24, 72, 168].map((h) => (
            <Link
              key={h}
              href={`/tag/${encodeURIComponent(tag)}?hours=${h}`}
              className={`rounded-md px-3 py-1 ${h === hours ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
            >
              {h / 24} 天
            </Link>
          ))}
          <a
            href={`https://www.google.com/search?tbm=nws&q=${encodeURIComponent(tag)}`}
            className="rounded-md bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google 新聞 ↗
          </a>
          <a
            href={`/feeds/tag/${encodeURIComponent(tag)}.xml`}
            className="rounded-md bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            title="用 RSS 閱讀器訂閱"
          >
            RSS
          </a>
        </div>
      </div>
      {status && <TagStatusPanel status={status} />}
      <section className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-medium text-zinc-600">每小時新聞數量與 24 小時移動平均（固定基準媒體）</h2>
        <RankingBasisNote basis={series.basis} media={media} />
        <TagChart points={series.points} />
        <p className="mt-2 text-xs text-zinc-500">
          平均線＝當小時及前 23 小時基準媒體收錄篇數總和 ÷ 24；收錄開始後沒有報導的小時以 0 計，開始前留白。只顯示完整小時。
        </p>
      </section>
      <section className="grid gap-6 md:grid-cols-[1fr_16rem]">
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-600">
            最近 {Math.max(48, hours)} 小時的報導（{list.articles.length}）
          </h2>
          {list.articles.length === 0 && <p className="text-sm text-zinc-600">沒有找到報導。</p>}
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {list.articles.map((a) => (
              <li key={a.id} className="flex gap-3 p-3">
                {a.image && /^https?:\/\//.test(a.image) && (
                  <Link href={articleHref(a)} tabIndex={-1} aria-label={`閱讀：${a.title}`} className="flex-none">
                    <SafeImage
                      src={a.image}
                      alt=""
                      width={96}
                      height={64}
                      className="h-16 w-24 flex-none rounded-md object-cover"
                      loading="lazy"
                      unoptimized={false}
                    />
                  </Link>
                )}
                <div className="min-w-0 flex-1">
                  <Link href={articleHref(a)} className="line-clamp-2 font-medium hover:underline">
                    {a.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-600">
                    <span className="inline-flex max-w-full items-center gap-1">
                      <MediaHoverLink media={a.media} icon={12} className="min-w-0 hover:underline">
                        {a.mediaTitle}
                      </MediaHoverLink>
                      <SourceLink url={a.url} className="ml-1 !min-h-5 shrink-0" />
                    </span>
                    <span aria-hidden>·</span>
                    <span>{taipei(a.publishedAt)}</span>
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                    {a.tags
                      .filter((t) => t !== tag)
                      .slice(0, 8)
                      .map((t) => (
                        <Link key={t} href={`/tag/${encodeURIComponent(t)}`} className="mr-1.5 hover:text-brand-700">
                          #{t}
                        </Link>
                      ))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <aside className="space-y-4">
          {status && status.threads.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-600">相關事件</h2>
              <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {status.threads.map((t) => (
                  <li key={t.id} className="px-3 py-2">
                    <Link href={`/eve/${t.id}/`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                      {t.maxTag ?? t.majorTags[0] ?? `事件 ${t.id}`}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      {t.majorTags
                        .filter((x) => x !== t.maxTag)
                        .slice(0, 4)
                        .join('、')}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {taipei(t.firstTime)} 起 · 在榜 {t.hours} 小時
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-600">媒體分布</h2>
            {list.articles.length > 0 && (
              <div className="space-y-1 text-xs text-zinc-600">
                <div className="flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
                  {(['blue', 'green', 'other'] as const).map((c) =>
                    campTotals[c] ? (
                      <span key={c} className={campDot[c]} style={{ width: `${(campTotals[c] / list.articles.length) * 100}%` }} />
                    ) : null,
                  )}
                </div>
                <p className="flex flex-wrap gap-x-3">
                  {(['blue', 'green', 'other'] as const).map((c) => (
                    <span key={c} className="inline-flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${campDot[c]}`} aria-hidden />
                      {campLabel[c]} {campTotals[c]}
                    </span>
                  ))}
                </p>
              </div>
            )}
            <ul className="rounded-xl border border-zinc-300 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900">
              {[...byMedia.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .map(([m, { title, count, camp }]) => (
                  <li key={m} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${campDot[camp]}`} title={campLabel[camp]} aria-hidden />
                      <MediaHoverLink media={m} icon={14} className="min-w-0 hover:underline">
                        {title}
                      </MediaHoverLink>
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-600">{count}</span>
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
