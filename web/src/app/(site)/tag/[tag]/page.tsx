import type { Metadata } from 'next';
import Link from 'next/link';
import RankingBasisNote from '@/components/RankingBasisNote';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import TagChart from '@/components/TagChart';
import { fetchMedia, fetchTagArticles, fetchTagSeries, taipei } from '@/lib/api';
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
  const [series, list, media] = await Promise.all([
    fetchTagSeries(tag, 'all', hours),
    fetchTagArticles(tag, Math.max(48, hours)),
    fetchMedia(),
  ]);
  const byMedia = new Map<string, number>();
  for (const a of list.articles) byMedia.set(a.mediaTitle, (byMedia.get(a.mediaTitle) ?? 0) + 1);
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
                  <SourceLink url={a.url} className="ml-2" />
                  <p className="mt-1 text-xs text-zinc-600">
                    {a.mediaTitle} · {taipei(a.publishedAt)}
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
        <aside className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-600">媒體分布</h2>
          <ul className="rounded-xl border border-zinc-300 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900">
            {[...byMedia.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([m, n]) => (
                <li key={m} className="flex justify-between px-3 py-1.5">
                  <span>{m}</span>
                  <span className="tabular-nums text-zinc-600">{n}</span>
                </li>
              ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}
