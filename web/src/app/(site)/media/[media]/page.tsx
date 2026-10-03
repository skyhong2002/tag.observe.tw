import Link from 'next/link';
import { notFound } from 'next/navigation';
import SafeImage from '@/components/SafeImage';
import { API_ORIGIN, taipei } from '@/lib/api';
export const revalidate = 120;
interface Article {
  id: number;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  tags: string[];
}
interface MediaView {
  media: string;
  title: string;
  icon: string | null;
  hours: number;
  articleCount: number;
  topTags: Array<{ tag: string; count: number }>;
  articles: Article[];
}
export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ media: string }>;
  searchParams: Promise<{ hours?: string | string[] }>;
}) {
  const { media } = await params;
  const query = await searchParams;
  const requested = Array.isArray(query.hours) ? query.hours[0] : query.hours;
  const explicitWindow = !!requested?.trim() && Number.isFinite(Number(requested)) && Number(requested) > 0;
  let hours = explicitWindow ? Math.min(168, Math.max(1, Math.trunc(Number(requested)))) : 24;
  const load = (window: number) =>
    fetch(`${API_ORIGIN}/api/v1/media/${encodeURIComponent(media)}?hours=${window}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
  const res = await load(hours);
  if (res?.status === 404) notFound();
  if (!res?.ok) return <p className="text-zinc-600">暫時無法取得媒體資料，請稍後再試。</p>;
  let data = (await res.json()) as MediaView;
  let expanded = false;
  // Slow-publishing outlets can have recent stories outside a 24-hour window.
  // Only broaden the initial view; always respect an explicit time selection.
  if (!explicitWindow && !data.articles.length) {
    const wider = await load(168);
    if (wider?.ok) {
      const candidate = (await wider.json()) as MediaView;
      if (candidate.articles.length) {
        data = candidate;
        hours = 168;
        expanded = true;
      }
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          {data.icon && <SafeImage src={data.icon} alt="" width={24} height={24} className="rounded" />}
          <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
        </div>
        <nav className="flex gap-1 text-sm" aria-label="報導時間範圍">
          {[24, 72, 168].map((h) => (
            <Link
              key={h}
              href={`/media/${media}/?hours=${h}`}
              aria-current={h === hours ? 'page' : undefined}
              className={`rounded-md px-3 py-1 ${h === hours ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
            >
              {h === 24 ? '1 天' : `${h / 24} 天`}
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-sm text-zinc-600">
        近 {hours % 24 === 0 ? `${hours / 24} 天` : `${hours} 小時`}收錄 {data.articleCount} 篇
      </p>
      <Link
        href={`/media/${encodeURIComponent(media)}/articles/`}
        className="inline-block text-sm text-brand-700 hover:underline dark:text-brand-400"
      >
        查看全文資料庫：保存正文、署名與引用來源 →
      </Link>
      {expanded && (
        <p className="rounded-lg border border-zinc-300 bg-zinc-100/60 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          最近 24 小時沒有收錄到文章，已顯示近 7 天的報導。
        </p>
      )}
      <section className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {!data.articles.length && (
            <li className="space-y-3 p-6 text-sm text-zinc-600">
              <p>這個時間範圍內尚無收錄文章。</p>
              {hours < 168 ? (
                <Link
                  href={`/media/${encodeURIComponent(media)}/?hours=168`}
                  className="inline-block text-brand-700 hover:underline dark:text-brand-400"
                >
                  查看近 7 天報導 →
                </Link>
              ) : (
                <Link href="/media/" className="inline-block text-brand-700 hover:underline dark:text-brand-400">
                  查看媒體收錄狀態 →
                </Link>
              )}
            </li>
          )}
          {data.articles.map((a) => (
            <li key={a.id} className="flex gap-3 p-3">
              {a.image && /^https?:\/\//.test(a.image) && (
                <SafeImage
                  src={a.image}
                  alt=""
                  width={96}
                  height={64}
                  className="h-16 w-24 flex-none rounded-md object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <a href={a.url} target="_blank" rel="noopener" className="line-clamp-2 font-medium hover:underline">
                  {a.title}
                </a>
                <p className="mt-1 text-xs text-zinc-600">{taipei(a.publishedAt)}</p>
                <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                  {a.tags.slice(0, 8).map((t) => (
                    <Link key={t} href={`/tag/${encodeURIComponent(t)}/`} className="mr-1.5 hover:text-brand-700">
                      #{t}
                    </Link>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <aside className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-600">熱門標籤</h2>
          {!data.topTags.length && <p className="text-sm text-zinc-600">這個時間範圍內尚無標籤資料。</p>}
          {data.topTags.length > 0 && (
            <ul className="rounded-xl border border-zinc-300 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900">
              {data.topTags.slice(0, 30).map((t) => (
                <li key={t.tag} className="flex justify-between px-3 py-1.5">
                  <Link href={`/tag/${encodeURIComponent(t.tag)}/`} className="hover:underline">
                    {t.tag}
                  </Link>
                  <span className="tabular-nums text-zinc-600">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </div>
  );
}
