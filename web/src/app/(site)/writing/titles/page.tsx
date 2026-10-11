import Link from 'next/link';
import MethodLink from '@/components/MethodLink';
import { pageMetadata } from '@/lib/seo.mts';
import { fetchWritingArticles, fetchWritingOverview, share, TITLE_TAG_LABEL, TITLE_TAGS, type TitleTag } from '@/lib/writing';
import OutletTable from '../OutletTable';
import WritingList from '../WritingList';
import WritingTabs, { DayPicker, writingDays } from '../WritingTabs';

export const revalidate = 300;
export const metadata = pageMetadata(
  '/writing/titles/',
  '標題用詞 · 看寫法',
  '各家媒體標題使用懸念詞（「1事」「原因曝」）、情緒反應詞與攻擊性動詞的比例。',
);

type Query = { days?: string; tag?: string; media?: string; before?: string };

export default async function WritingTitlesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const days = writingDays(query.days);
  const tag: TitleTag = (TITLE_TAGS as readonly string[]).includes(query.tag ?? '') ? (query.tag as TitleTag) : '懸念';
  const media = query.media?.slice(0, 32);
  const [overview, list] = await Promise.all([
    fetchWritingOverview(days),
    fetchWritingArticles({ tag, media, days, limit: 30, before: query.before }),
  ]);
  const keep = { days: days === 30 ? undefined : String(days) };
  const href = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ...keep, ...extra }).filter((e): e is [string, string] => !!e[1]));
    return `/writing/titles/${q.size ? `?${q}` : ''}#articles`;
  };
  const totals = overview?.totals;
  const mediaName = overview?.media.find((m) => m.media === media)?.name ?? media;
  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <WritingTabs current="titles" days={days} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">標題用詞</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            標題裡固定的幾類用詞：不說重點的懸念詞、強調情緒反應的詞、攻擊性動詞。依詞表比對，一篇可以同時屬於幾類；不判斷內容是否誇大。
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <DayPicker days={days} path="/writing/titles/" params={{ tag: tag === '懸念' ? undefined : tag, media }} />
            <MethodLink />
          </p>
        </div>
      </header>

      {!overview || !totals ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">暫時無法取得統計，請稍後重新整理。</p>
      ) : (
        <>
          <section aria-label="總覽" className="grid gap-3 sm:grid-cols-3">
            {TITLE_TAGS.map((t) => (
              <Link
                key={t}
                href={href({ tag: t, media })}
                aria-current={t === tag ? 'true' : undefined}
                className={`rounded-lg border p-4 hover:border-brand-500 ${t === tag ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/20' : 'border-zinc-200 dark:border-zinc-800'}`}
              >
                <p className="text-sm font-medium">{TITLE_TAG_LABEL[t].label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{share(totals.titleTags[t], totals.articles)}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{TITLE_TAG_LABEL[t].hint}</p>
              </Link>
            ))}
          </section>
          <section aria-labelledby="outlets" className="space-y-3">
            <h2 id="outlets" className="text-lg font-semibold">
              各媒體
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              分母是各家近 {days} 天已分析的文章；分析不到 100 篇的媒體與轉載站不列入。
            </p>
            <OutletTable
              caption="各媒體標題用詞的比例"
              path="/writing/titles/"
              query={Object.fromEntries(Object.entries(keep).filter((e): e is [string, string] => !!e[1]))}
              rows={overview.media.map((m) => ({ media: m.media, name: m.name, articles: m.articles, values: m.titleTags }))}
              columns={TITLE_TAGS.map((t) => ({
                key: t,
                label: TITLE_TAG_LABEL[t].label,
                hint: TITLE_TAG_LABEL[t].hint,
                filter: { tag: t },
              }))}
            />
          </section>
        </>
      )}

      <section aria-labelledby="articles" className="space-y-2">
        <h2 id="articles" className="scroll-mt-24 text-lg font-semibold">
          標題含「{TITLE_TAG_LABEL[tag].label}」用詞的報導
        </h2>
        {media && (
          <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">媒體：{mediaName}</span>
            <Link href={href({ tag: tag === '懸念' ? undefined : tag })} className="text-brand-700 hover:underline dark:text-brand-400">
              清除條件
            </Link>
          </p>
        )}
        <WritingList articles={list?.articles ?? []} evidence={false} />
        {list?.next && (
          <p className="pt-2 text-sm">
            <Link href={href({ tag, media, before: String(list.next) })} className="text-brand-700 hover:underline dark:text-brand-400">
              更早的報導 →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
