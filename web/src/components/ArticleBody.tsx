import SourceLink from '@/components/SourceLink';
import { readingExcerpt } from '@/lib/reading.mts';

/** Displays only a short opening, with a link to the original article. */
export default function ArticleBody({
  body,
  sourceUrl,
  label = '文章節錄',
  repeats,
}: {
  body: string;
  sourceUrl: string;
  label?: '文章節錄' | '文章摘要';
  /** Text already shown above (the outlet's summary): an opening that only repeats it is not printed again. */
  repeats?: string | null;
}) {
  const excerpt = readingExcerpt(body);
  const plain = (text: string) => text.replace(/\s+/g, '').replace(/\.\.\.$/, '');
  const same = !!repeats && plain(repeats).slice(0, 40) !== '' && plain(excerpt).startsWith(plain(repeats).slice(0, 40));
  return (
    <section aria-label={label}>
      {same ? (
        <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">正文開頭和上面的摘要相同，本站只顯示開頭；全文請到原站閱讀。</p>
      ) : (
        <p className="whitespace-pre-wrap break-words text-[1.125rem] leading-[1.95] text-zinc-800 dark:text-zinc-200">{excerpt}</p>
      )}
      <div className="mt-3">
        <SourceLink url={sourceUrl} label="原站文章" showUrl />
      </div>
    </section>
  );
}
