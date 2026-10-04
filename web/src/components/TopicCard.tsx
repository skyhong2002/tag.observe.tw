import Link from 'next/link';
import type { ReactNode } from 'react';
import MediaIcon from '@/components/MediaIcon';
import SourceLink from '@/components/SourceLink';
import TopicCover from '@/components/TopicCover';
import { taipei } from '@/lib/api';
import { isAllowedImage } from '@/lib/images';
import type { Topic, TopicCoverage, TopicKind } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';

// Story dates can be years old, so with the year and without the time.
const taipeiDate = (iso: string) => new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
export const kindNoun = (kind: TopicKind) => (kind === 'feature' ? '專題' : '議題');
/** The outlet's 議題 or 專題 page. */
export const topicMediaHref = (media: string, kind: TopicKind = 'topic') =>
  `/${kind === 'feature' ? 'feature' : 'topic'}/${encodeURIComponent(media)}/`;
export const topicHref = (media: string, id: string, kind: TopicKind = 'topic') => `${topicMediaHref(media, kind)}#topic-${id}`;

/** One outlet topic. Cover only when the outlet gave one: a logo in its place
 *  makes rows look broken, so those topics render as a compact text row. The
 *  card is the anchor target from the feed, highlighted via :target. */
export default function TopicCard({
  topic,
  media,
  mediaTitle,
  showMedia = false,
  href,
  kind = 'topic',
  nested,
}: {
  topic: Topic & { coverage?: TopicCoverage | null };
  media: string;
  mediaTitle: string;
  showMedia?: boolean;
  href?: string;
  kind?: TopicKind;
  /** Child topics, indented under this one. */
  nested?: ReactNode;
}) {
  const image = isAllowedImage(topic.image) ? topic.image : null;
  const noun = kindNoun(kind);
  const title = topic.title ?? `（未命名${noun}）`;
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
      <TopicCover src={image} href={href ?? topic.url ?? '#'} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-medium leading-snug">
          {titleNode}
          {topic.sponsored && (
            <span
              title="媒體標示為廣告或品牌合作"
              className="ml-1.5 inline-block rounded border border-zinc-300 px-1 align-[0.1em] text-[10px] font-normal leading-4 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
            >
              合作
            </span>
          )}
        </h3>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          {showMedia && (
            <Link href={topicMediaHref(media, kind)} className="flex items-center gap-1 hover:underline">
              <MediaIcon media={media} title={mediaTitle} />
              {mediaTitle}
            </Link>
          )}
          {showMedia && <span aria-hidden>·</span>}
          {topic.time && !topic.backlog ? `首次發現 ${taipei(topic.time)}` : '開始追蹤前已上架'}
          {topic.storyLastAt && (
            <>
              <span aria-hidden>·</span>
              {`最後更新 ${taipeiDate(topic.storyLastAt)}`}
            </>
          )}
          <SourceLink url={topic.url} label={`原站${noun}`} className="!min-h-5 shrink-0" />
        </span>
        {topic.coverage && <Coverage c={topic.coverage} />}
        {nested}
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
