import SourceLink from '@/components/SourceLink';
import { readingExcerpt } from '@/lib/reading.mts';

/** Shows only the opening lines of a stored body; the full text stays with the publisher. */
export default function ArticleBody({ body, sourceUrl }: { body: string; sourceUrl: string }) {
  const excerpt = readingExcerpt(body);
  return (
    <section aria-label="文章開頭節錄">
      <div className="mb-6 flex items-center justify-between gap-3 border-y border-zinc-200 py-3 dark:border-zinc-800">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">開頭節錄</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">全文請至原站閱讀</span>
      </div>
      <div className="relative">
        <p
          data-article-excerpt
          className="line-clamp-4 whitespace-pre-wrap break-words text-[1.125rem] leading-[1.95] text-zinc-800 dark:text-zinc-200"
        >
          {excerpt}
        </p>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-50 to-transparent dark:from-zinc-950"
        />
      </div>
      <div className="mt-5">
        <SourceLink url={sourceUrl} label="前往原站閱讀全文" />
      </div>
    </section>
  );
}
