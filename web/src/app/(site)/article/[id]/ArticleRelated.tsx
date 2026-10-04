import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import { taipei } from '@/lib/api';
import { readingTitle } from '@/lib/reading.mts';
import type { ArticleRelated as Related, RelatedArticle } from '@/lib/related';

const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';
const chip =
  'rounded-full bg-zinc-100 px-3 py-1.5 text-zinc-600 hover:text-brand-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-brand-400';

function RelatedList({ id, title, items }: { id: string; title: string; items: RelatedArticle[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-sm font-medium">
        {title}
      </h3>
      <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((item) => (
          <li key={item.id} className="py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <MediaHoverLink media={item.media} className={`${linkStyle} font-medium`}>
                {item.mediaTitle}
              </MediaHoverLink>
              <time dateTime={item.publishedAt}>{taipei(item.publishedAt)}</time>
            </div>
            <p className="mt-1 break-words text-[15px] leading-7">
              <Link href={`/article/${item.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                {readingTitle(item.title).title}
              </Link>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">共同關鍵字：{item.sharedTags.map((tag) => `#${tag}`).join(' ')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 延伸閱讀: events, body matches (passed in as `similar`), other coverage of the
 * subject at other outlets and at this outlet, and the subject's keywords.
 */
export default function ArticleRelated({
  data,
  tags,
  mediaTitle,
  similar,
}: {
  data: Related | null;
  /** The article's own tags, shown plainly when `data` is unavailable. */
  tags: string[];
  mediaTitle: string;
  similar: React.ReactNode;
}) {
  const days = data?.windowDays ?? 3;
  const nothingRelated = data && !data.events.length && !data.otherMedia.length && !data.sameMedia.length;
  return (
    <section aria-labelledby="related-heading" className="space-y-7">
      <div>
        <h2 id="related-heading" className="text-base font-semibold">
          延伸閱讀
        </h2>
        <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          刊登前後 {days} 天內同一題的其他報導：依共同關鍵字的稀有程度與標題相近程度排序，標題幾乎相同的轉載只列一篇。
        </p>
      </div>
      {data && data.events.length > 0 && (
        <section aria-labelledby="related-events">
          <h3 id="related-events" className="text-sm font-medium">
            所屬事件
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {data.events.map((event) => (
              <li key={event.id} className="border-l-2 border-brand-500 pl-3">
                <Link href={`/eve/${event.id}/`} className={`${linkStyle} leading-7`}>
                  {readingTitle(event.title).title}
                </Link>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {taipei(event.firstTime)} – {taipei(event.lastTime)} · 共同關鍵字 {event.sharedTags.map((tag) => `#${tag}`).join(' ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {similar}
      <RelatedList id="related-other" title="其他媒體的相關報導" items={data?.otherMedia ?? []} />
      <RelatedList id="related-same" title={`${mediaTitle}的其他相關報導`} items={data?.sameMedia ?? []} />
      {!data && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          暫時無法取得延伸閱讀，請稍後重新整理。
        </p>
      )}
      {nothingRelated && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          {data.tags.length ? `前後 ${days} 天內沒有找到同一題的其他報導。` : '這篇沒有關鍵字，無法找出同一題的其他報導。'}
        </p>
      )}
      {(data?.tags.length ?? tags.length) > 0 && (
        <nav aria-labelledby="related-tags">
          <h3 id="related-tags" className="mb-2 text-sm font-medium">
            相關關鍵字
          </h3>
          <ul className="flex flex-wrap gap-2 text-sm">
            {(data?.tags ?? tags.map((tag) => ({ tag, articles: 0, media: 0 }))).map((entry) => (
              <li key={entry.tag}>
                <Link href={`/tag/${encodeURIComponent(entry.tag)}/`} className={`inline-block ${chip}`}>
                  #{entry.tag}
                  {entry.articles > 1 && (
                    <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                      {entry.media} 家 · {entry.articles} 篇
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {data && data.tags.some((entry) => entry.articles > 1) && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">數字為前後 {days} 天內使用這個關鍵字的媒體與報導數。</p>
          )}
        </nav>
      )}
    </section>
  );
}
