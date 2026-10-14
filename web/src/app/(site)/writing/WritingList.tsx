import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import SourceLink from '@/components/SourceLink';
import { taipei } from '@/lib/api';
import { clipHeadline } from '@/lib/event-presentation.mts';
import { readingTitle } from '@/lib/reading.mts';
import { PLATFORM_LABEL, ROLE_LABEL, TITLE_TAG_LABEL, type WritingArticle } from '@/lib/writing';

/** Articles with the clause the label came from; every row prints the original URL. */
export default function WritingList({ articles, evidence = true }: { articles: WritingArticle[]; evidence?: boolean }) {
  if (!articles.length) return <p className="py-6 text-sm text-zinc-500 dark:text-zinc-400">這段期間沒有符合條件的報導。</p>;
  return (
    <ol className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
      {articles.map((a) => {
        const headline = readingTitle(a.title);
        return (
          <li key={a.id} className="py-2.5">
            <h3 className="text-[15px] font-medium leading-6">
              <Link href={`/article/${a.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                {clipHeadline(headline.title)}
              </Link>
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
              <MediaHoverLink media={a.media} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                {a.name}
              </MediaHoverLink>
              <time dateTime={a.publishedAt}>{taipei(a.publishedAt)}</time>
              {a.platform && (
                <span>
                  {a.poster ? (
                    <Link href={`/writing/?poster=${encodeURIComponent(a.poster)}`} className="hover:underline">
                      {a.poster}
                    </Link>
                  ) : null}
                  {(a.roles ?? (a.role ? [a.role] : []))
                    .filter((r) => r !== '未知')
                    .map((r) => (
                      <Link
                        key={r}
                        href={`/writing/?role=${encodeURIComponent(r)}`}
                        className="ml-1 inline-block rounded-full bg-zinc-100 px-2 dark:bg-zinc-800 hover:underline"
                      >
                        {ROLE_LABEL[r]}
                      </Link>
                    ))}{' '}
                  ·{PLATFORM_LABEL[a.platform] ?? a.platform}
                </span>
              )}
              {!evidence && a.titleTags.map((t) => <span key={t}>{TITLE_TAG_LABEL[t].label}</span>)}
              <SourceLink url={a.url} showUrl className="!min-h-5 !text-[11px]" />
            </div>
            {evidence && a.evidence && (
              <p className="mt-1 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-400 dark:text-zinc-400">判斷依據</span>「{a.evidence}」
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
