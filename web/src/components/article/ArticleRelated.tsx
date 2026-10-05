import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import MethodLink from '@/components/MethodLink';
import { taipei } from '@/lib/api';
import { readingTitle } from '@/lib/reading.mts';
import type { ArticleRelated as Related, RelatedArticle } from '@/lib/related';

const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';

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
 * subject at other outlets and at this outlet.
 */
export default function ArticleRelated({
  data,
  mediaTitle,
  similar,
}: {
  data: Related | null;
  mediaTitle: string;
  similar: React.ReactNode;
}) {
  const days = data?.windowDays ?? 3;
  const nothingRelated = data && !data.events.length && !data.otherMedia.length && !data.sameMedia.length;
  return (
    <section aria-labelledby="related-heading" className="space-y-7">
      {/* How stories are picked and ranked is in the footer's 資料來源與計算方式 (ArticleMethod). */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="related-heading" className="text-base font-semibold">
          延伸閱讀
        </h2>
        <MethodLink className="text-xs" />
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
    </section>
  );
}
