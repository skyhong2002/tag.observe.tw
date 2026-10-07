import Link from 'next/link';
import { notFound } from 'next/navigation';
import AuthorCredits from '@/components/AuthorCredits';
import SourceLink from '@/components/SourceLink';
import { taipei } from '@/lib/api';
import { BYLINE_HOURS, type BylineDetail, bylineHours, bylineHref, CREDIT_LABELS, fetchBylines, periodLabel } from '@/lib/bylines';
import { graphHref } from '@/lib/relationship-query.mts';
import { decodeRouteParam } from '@/lib/seo.mts';

export const revalidate = 120;
type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ hours?: string; page?: string; media?: string }> };
export async function generateMetadata({ params }: Props) {
  const key = decodeRouteParam((await params).key);
  return { title: `${key.split(':').at(-1)} 的署名文章`, robots: { index: false, follow: true } };
}
export default async function BylinePage({ params, searchParams }: Props) {
  const key = decodeRouteParam((await params).key),
    sp = await searchParams,
    hours = bylineHours(sp.hours);
  const data = await fetchBylines<BylineDetail>(`/${encodeURIComponent(key)}`, { hours: String(hours), page: sp.page, media: sp.media });
  if (data === 'missing') notFound();
  if (!data)
    return (
      <p role="status" className="py-8 text-zinc-500">
        暫時無法取得署名文章，請稍後重新整理。
      </p>
    );
  const { byline } = data;
  const href = (page: number, media = sp.media) =>
    `/byline/${encodeURIComponent(key)}/?${new URLSearchParams({ hours: String(hours), page: String(page), ...(media ? { media } : {}) })}`;
  return (
    <div className="space-y-5 pb-8">
      <nav aria-label="麵包屑" className="text-xs text-zinc-500">
        <Link href={`/byline/?hours=${hours}&kind=${byline.kind}`} className="hover:underline">
          署名 · {CREDIT_LABELS[byline.kind]}
        </Link>
        <span className="mx-2">/</span>
        {byline.name}
      </nav>
      <Link
        href={`/article/query/?credit=${encodeURIComponent(byline.name)}&days=${Math.min(hours / 24, 31)}`}
        className="inline-block text-sm text-brand-700 hover:underline dark:text-brand-400"
      >
        交叉查詢原文署名與來源 →
      </Link>
      <header className="space-y-3 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{byline.name}</h1>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800">{CREDIT_LABELS[byline.kind]}</span>
        </div>
        <p className="text-sm text-zinc-500">
          本期 {byline.articles.toLocaleString('zh-TW')} 篇署名文章 · {byline.outlets.length} 家刊登媒體
          {byline.roles.length > 0 && ` · 原文角色：${byline.roles.join('、')}`}
        </p>

        <nav aria-label="署名統計期間" className="flex flex-wrap gap-2 text-xs">
          {BYLINE_HOURS.map((value) => (
            <Link
              key={value}
              href={bylineHref(key, value)}
              aria-current={value === hours ? 'page' : undefined}
              className={`rounded-full border px-3 py-1.5 ${value === hours ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-zinc-300 dark:border-zinc-700'}`}
            >
              {periodLabel(value)}
            </Link>
          ))}
        </nav>
        {byline.organization && (
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              className="text-brand-700 hover:underline dark:text-brand-400"
              href={`/media/${encodeURIComponent(byline.organization)}/?hours=${Math.min(hours, 168)}`}
            >
              機構與引用資料 →
            </Link>
            <Link
              className="text-brand-700 hover:underline dark:text-brand-400"
              href={graphHref({ hours: Math.min(hours, 168), node: byline.organization, mode: 'citation', view: 'evidence' })}
            >
              在關係圖查看 →
            </Link>
          </div>
        )}
        {byline.kind === 'person' &&
          (byline.roles.length === 0 || byline.roles.some((role) => /記者|編譯|翻譯|撰文|撰稿|整理|作者|文字|圖文/.test(role))) && (
            <Link
              href={`/journalist/${encodeURIComponent(byline.name)}/?hours=${hours}&threshold=0.65`}
              className="inline-block text-sm text-brand-700 hover:underline dark:text-brand-400"
            >
              跨媒體相似報導統計 →
            </Link>
          )}
      </header>
      <nav aria-label="刊登媒體篩選" className="flex flex-wrap gap-2 text-xs">
        <Link
          href={href(0, '')}
          aria-current={!sp.media ? 'page' : undefined}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
        >
          全部媒體
        </Link>
        {byline.outlets.map((outlet) => (
          <Link
            key={outlet.media}
            href={href(0, outlet.media)}
            aria-current={sp.media === outlet.media ? 'page' : undefined}
            className={`rounded border px-3 py-2 ${sp.media === outlet.media ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-zinc-300 dark:border-zinc-700'}`}
          >
            {outlet.name} {outlet.count}
          </Link>
        ))}
      </nav>
      <p role="status" className="text-xs text-zinc-500">
        符合 {data.total.toLocaleString('zh-TW')} 篇 · 依刊登時間排序
      </p>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {data.articles.map((article) => (
          <li key={article.id} className="space-y-2 py-4">
            <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
              <Link
                href={`/media/${article.media}/?hours=${Math.min(hours, 168)}`}
                className="text-brand-700 hover:underline dark:text-brand-400"
              >
                {article.mediaTitle}
              </Link>
              <time dateTime={article.publishedAt}>{taipei(article.publishedAt)}</time>
            </div>
            <h2 className="text-base font-medium leading-7">
              <Link href={`/article/${article.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                {article.title}
              </Link>
            </h2>
            <p className="text-xs text-zinc-500">原文署名：{article.credits.join('、')}</p>
            <div className="text-xs">
              <AuthorCredits credits={article.credits} media={article.media} hours={hours} />
            </div>
            {article.attributions.length > 0 && (
              <p className="text-xs text-zinc-500">
                明示引用：
                {article.attributions.map((source) => (
                  <Link
                    key={source.media}
                    href={`/media/${encodeURIComponent(source.media)}/?hours=${Math.min(hours, 168)}`}
                    className="mr-3 text-brand-700 hover:underline dark:text-brand-400"
                  >
                    {source.name}
                  </Link>
                ))}
              </p>
            )}
            <SourceLink url={article.url} className="!min-h-6 !text-xs" />
          </li>
        ))}
      </ul>
      {!data.articles.length && <p className="py-8 text-center text-zinc-500">這一頁沒有文章。</p>}
      <nav aria-label="署名文章分頁" className="flex justify-between text-sm">
        {data.page > 0 ? (
          <Link href={href(data.page - 1)} className="py-2 text-brand-700 dark:text-brand-400">
            ← 上一頁
          </Link>
        ) : (
          <span />
        )}
        <span className="py-2 text-zinc-500">第 {data.page + 1} 頁</span>
        {(data.page + 1) * data.pageSize < data.total ? (
          <Link href={href(data.page + 1)} className="py-2 text-brand-700 dark:text-brand-400">
            下一頁 →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
