import SourceLink from '@/components/SourceLink';
import { readingExcerpt } from '@/lib/reading.mts';

/** Displays only a short opening, with a link to the original article. */
export default function ArticleBody({
  body,
  sourceUrl,
  label = '文章節錄',
}: {
  body: string;
  sourceUrl: string;
  label?: '文章節錄' | '文章摘要';
}) {
  return (
    <section aria-label={label}>
      <p className="whitespace-pre-wrap break-words text-[1.125rem] leading-[1.95] text-zinc-800 dark:text-zinc-200">
        {readingExcerpt(body)}
      </p>
      <div className="mt-3">
        <SourceLink url={sourceUrl} label="原站文章" showUrl />
      </div>
    </section>
  );
}
