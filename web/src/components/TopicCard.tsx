import Link from 'next/link';
import MediaIcon from '@/components/MediaIcon';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import { taipei } from '@/lib/api';
import { isAllowedImage } from '@/lib/images';
import type { Topic, TopicCoverage } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';

export const topicHref = (media: string, id: string) => `/topic/${encodeURIComponent(media)}/#topic-${id}`;

/** One outlet topic. Cover only when the outlet gave one: a logo in its place
 *  makes rows look broken, so those topics render as a compact text row. The
 *  card is the anchor target from the feed, highlighted via :target. */
export default function TopicCard({
  topic,
  media,
  mediaTitle,
  showMedia = false,
  href,
}: {
  topic: Topic & { coverage?: TopicCoverage | null };
  media: string;
  mediaTitle: string;
  showMedia?: boolean;
  href?: string;
}) {
  const image = isAllowedImage(topic.image) ? topic.image : null;
  const title = topic.title ?? '（未命名專題）';
  const titleNode = href ? (
    <Link href={href} className="hover:underline">
      {title}
    </Link>
  ) : (
    <a href={topic.url ?? undefined} target="_blank" rel="noopener noreferrer" className="hover:underline">
      {title}
    </a>
  );
  return (
    <li
      id={`topic-${topic.id}`}
      className="flex scroll-mt-20 gap-3 rounded-lg border border-transparent py-3 target:-mx-3 target:border-brand-400 target:bg-brand-50 target:px-3 dark:target:border-brand-700 dark:target:bg-brand-950/40"
    >
      {image && (
        <Link
          href={href ?? topic.url ?? '#'}
          className="aspect-video w-28 shrink-0 self-start overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800"
          tabIndex={-1}
          aria-hidden
        >
          <SafeImage src={image} alt="" width={224} height={126} className="h-full w-full object-cover" />
        </Link>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-medium leading-snug">{titleNode}</h3>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          {showMedia && (
            <Link href={`/topic/${encodeURIComponent(media)}/`} className="flex items-center gap-1 hover:underline">
              <MediaIcon media={media} title={mediaTitle} />
              {mediaTitle}
            </Link>
          )}
          {showMedia && <span aria-hidden>·</span>}
          {topic.time && !topic.backlog ? `首次發現 ${taipei(topic.time)}` : '開始追蹤前已上架'}
          <SourceLink url={topic.url} label="原站專題" className="!min-h-5 shrink-0" />
        </span>
        {topic.coverage && <Coverage c={topic.coverage} />}
      </div>
    </li>
  );
}

/** Recent stories from every crawled outlet that carry the topic's tags:
 *  what the rest of the press is saying about the same thing. */
export function Coverage({ c }: { c: TopicCoverage }) {
  return (
    <div className="mt-0.5 space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
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
