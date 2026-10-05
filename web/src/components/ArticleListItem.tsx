import Link from 'next/link';
import ArticleThumbnail from '@/components/ArticleThumbnail';
import AuthorCredits from '@/components/AuthorCredits';
import DiscoverySources from '@/components/DiscoverySources';
import MediaHoverLink from '@/components/MediaHoverLink';
import SourceLink from '@/components/SourceLink';
import { taipei } from '@/lib/api';
import type { DiscoverySource } from '@/lib/article-content';
import { clipHeadline } from '@/lib/event-presentation.mts';
import { readingTitle } from '@/lib/reading.mts';

interface ListArticle {
  id?: number | null;
  title: string;
  url: string | null;
  image: string | null;
  description?: string | null;
  tags: string[];
  authors: string[];
  publishedAt: string | null;
  publishedDate?: string;
  media?: string;
  mediaTitle?: string;
  discoverySources?: DiscoverySource[];
}

/** Shared by publisher feeds and the publisher's topic/feature membership lists. */
export default function ArticleListItem({
  article,
  href,
  showMedia = false,
}: {
  article: ListArticle;
  href: string | null;
  showMedia?: boolean;
}) {
  const headline = readingTitle(article.title);
  const title = (
    <>
      {headline.section && <span className="mr-1.5 text-xs font-normal text-brand-700 dark:text-brand-400">{headline.section}</span>}
      {clipHeadline(headline.title)}
    </>
  );
  return (
    <li id={article.id ? `article-${article.id}` : undefined} className="scroll-mt-32 py-2.5">
      <article className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium leading-6">
            {href ? (
              <Link href={href} className="hover:text-brand-700 dark:hover:text-brand-400">
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          {article.description && (
            <p className="mt-1 hidden text-xs leading-5 text-zinc-500 group-data-[summaries=true]/list:line-clamp-2 dark:text-zinc-400">
              {article.description}
            </p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            {showMedia && article.media && (
              <MediaHoverLink media={article.media} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                {article.mediaTitle}
              </MediaHoverLink>
            )}
            {article.publishedAt ? (
              <time dateTime={article.publishedDate ?? article.publishedAt}>{article.publishedDate ?? taipei(article.publishedAt)}</time>
            ) : (
              <span>報導日期不明</span>
            )}
            <AuthorCredits credits={article.authors} media={article.media} className="max-w-40 truncate" />
            <SourceLink url={article.url} showUrl className="!min-h-5 !text-[11px]" />
          </div>
          {article.tags.length > 0 && (
            <ul aria-label="關鍵字" className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] leading-5">
              {article.tags.slice(0, 6).map((tag) => (
                <li key={tag}>
                  <Link
                    href={`/tag/${encodeURIComponent(tag)}/`}
                    className="text-zinc-500 hover:text-brand-700 hover:underline dark:text-zinc-400 dark:hover:text-brand-400"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <DiscoverySources sources={article.discoverySources} />
        </div>
        {href && <ArticleThumbnail src={article.image} href={href} title={headline.title} />}
      </article>
    </li>
  );
}
