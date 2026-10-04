import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import { taipei } from '@/lib/api';
import { clipHeadline } from '@/lib/event-presentation.mts';
import { describeGap } from '@/lib/journalists';
import { readingTitle } from '@/lib/reading.mts';
import type { ArticleSimilarity } from '@/lib/similarity';

const percent = (value: number) => `${Math.round(value * 100)}%`;
const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';
// Order of publication is context, not a verdict: one neutral tone for both directions.
const tone = 'rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

function order(ownAt: string, otherAt: string): string {
  const minutes = Math.round((Date.parse(otherAt) - Date.parse(ownAt)) / 60_000);
  if (!Number.isFinite(minutes)) return '刊登先後不明';
  if (Math.abs(minutes) < 1) return '一分鐘內同時刊登';
  return minutes > 0 ? `本篇早 ${describeGap(minutes)} 刊登` : `對方早 ${describeGap(minutes)} 刊登`;
}

/** Stored matches of this article at other outlets, from the similarity index. */
export default function ArticleSimilar({ data, publishedAt }: { data: ArticleSimilarity | null; publishedAt: string }) {
  const windowDays = data?.windowDays ?? 7;
  let status: string | null = null;
  if (!data) status = '暫時無法取得相似報導，請稍後重新整理。';
  else if (!data.indexedAt) status = '尚待比對（每 10 分鐘更新）';
  else if (data.chars === null) status = '內文太短，未納入比對';
  else if (!data.matches.length) status = `前後 ${windowDays} 天內沒有其他媒體的相似內文`;
  return (
    <section aria-labelledby="similar-heading">
      <h3 id="similar-heading" className="mb-1 text-sm font-medium">
        他站相似報導
        {data && data.matches.length > 0 && (
          <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">{data.matches.length} 篇</span>
        )}
      </h3>
      <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
        與前後 {windowDays} 天內其他媒體文章的內文比對，相似度 ≥ {percent(data?.threshold ?? 0.65)}
        。相似不等於抄襲：同一份新聞稿、通訊社稿、授權轉載與註明引用都會讓內文相近；刊登時間以各站標示為準，與寫稿先後無關。
      </p>
      {status ? (
        <p role="status" className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {status}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          {data!.matches.map((match) => {
            const other = match.article;
            const headline = readingTitle(other.title);
            return (
              <li key={other.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <MediaHoverLink media={other.media} className={`${linkStyle} font-medium`}>
                    {other.mediaTitle}
                  </MediaHoverLink>
                  <time dateTime={other.publishedAt}>{taipei(other.publishedAt)}</time>
                  <span className={tone}>{order(publishedAt, other.publishedAt)}</span>
                  <span className="tabular-nums">相似 {percent(match.score)}</span>
                  {match.kind === 'identical' && <span className={tone}>內文相同</span>}
                </div>
                <p className="mt-1 break-words text-[15px] leading-7">
                  <Link href={`/article/${other.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                    {clipHeadline(headline.title)}
                  </Link>
                </p>
                {match.evidence && (
                  <details className="mt-0.5 text-xs">
                    <summary className="cursor-pointer py-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
                      共同片段
                    </summary>
                    <p className="break-words border-l-2 border-zinc-200 pl-3 leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                      {match.evidence}
                    </p>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs">
        <Link href="/similarity/" className={linkStyle}>
          看各媒體的相似與引用
        </Link>
      </p>
    </section>
  );
}
