import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AuthorCredits from '@/components/AuthorCredits';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaSidebar from '@/components/MediaSidebar';
import SourceLink from '@/components/SourceLink';
import { taipei } from '@/lib/api';
import { CONTENT_STATUS } from '@/lib/article-content';
import {
  DETAIL_HOURS,
  fetchJournalist,
  type JournalistDetail,
  type JournalistPair,
  journalistHref,
  relationLabel,
} from '@/lib/journalists';
import { readingTitle } from '@/lib/reading.mts';

export const revalidate = 300;
const number = (value: number) => value.toLocaleString('zh-TW');
const percent = (value: number) => `${(value * 100).toFixed(0)}%`;
const periodLabel = (value: number) => (value < 48 ? `${value} 小時` : `${value / 24} 天`);
const parseHours = (value: string | undefined) => ((DETAIL_HOURS as readonly number[]).includes(Number(value)) ? Number(value) : 168);
const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return { title: `${decoded} 的報導`, description: `${decoded} 署名的文章：刊登媒體、常寫主題，以及與其他媒體內文相似、刊登先後的對照。` };
}

function relationTone(pair: JournalistPair) {
  if (pair.sameAuthor) return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  if (pair.relation === 'later') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  if (pair.relation === 'earlier') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function PairRow({ pair }: { pair: JournalistPair }) {
  const other = readingTitle(pair.other.title);
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={`rounded-full px-2 py-0.5 ${relationTone(pair)}`}>{relationLabel(pair)}</span>
        <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
          相似 {percent(pair.score)}
          {pair.kind === 'identical' ? '，內文相同' : ''}
        </span>
        {pair.otherCitesOwn && <span className="text-violet-700 dark:text-violet-400">對方註明引用{pair.own.mediaTitle}</span>}
        {pair.ownCitesOther && <span className="text-violet-700 dark:text-violet-400">本篇註明引用{pair.other.mediaTitle}</span>}
      </div>
      <p className="mt-1 text-sm leading-6">
        <MediaHoverLink media={pair.other.media} className={`${linkStyle} mr-1.5 text-xs font-medium`}>
          {pair.other.mediaTitle}
        </MediaHoverLink>
        <Link href={`/article/${pair.other.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
          {other.title}
        </Link>
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <time dateTime={pair.other.publishedAt}>{taipei(pair.other.publishedAt)}</time>
        {pair.other.authors.length > 0 && <AuthorCredits credits={pair.other.authors} className="max-w-72 truncate" />}
        <SourceLink url={pair.other.url} className="!min-h-5 !text-[11px]" />
      </p>
      {pair.evidence && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer py-1 text-zinc-500 dark:text-zinc-400">共同片段</summary>
          <p className="break-words leading-6 text-zinc-600 dark:text-zinc-400">{pair.evidence}</p>
        </details>
      )}
    </li>
  );
}

function SimilarSection({ data }: { data: JournalistDetail }) {
  const groups = new Map<number, JournalistPair[]>();
  for (const pair of data.pairs) (groups.get(pair.own.id) ?? groups.set(pair.own.id, []).get(pair.own.id)!).push(pair);
  const ordered = [...groups.values()].sort(
    (a, b) =>
      b.filter((p) => p.relation === 'later' && !p.sameAuthor).length - a.filter((p) => p.relation === 'later' && !p.sameAuthor).length ||
      Date.parse(b[0].own.publishedAt) - Date.parse(a[0].own.publishedAt),
  );
  return (
    <section aria-labelledby="similar-heading" className="mb-6">
      <h2 id="similar-heading" className="text-base font-semibold">
        與其他媒體內文相似的文章
        <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {number(data.stats.similar.articles)} 篇有相似文章，共 {number(data.stats.similar.pairs)} 組
        </span>
      </h2>
      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        只拿此人有正文的文章，與前後 48 小時內至少共用一個標籤的他站文章比對（Dice ≥ {percent(data.threshold)}）。
        標籤只用來挑候選，相似與否由內文決定；沒有標籤的文章不會有候選。
      </p>
      {!ordered.length && <p className="py-6 text-sm text-zinc-500 dark:text-zinc-400">這段期間內沒有找到與他站高度相似的文章。</p>}
      <ul className="mt-3 space-y-4">
        {ordered.map((pairs) => {
          const own = pairs[0].own;
          const headline = readingTitle(own.title);
          const later = pairs.filter((p) => p.relation === 'later' && !p.sameAuthor).length;
          return (
            <li key={own.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                <MediaHoverLink media={own.media} className={`${linkStyle} font-medium`}>
                  {own.mediaTitle}
                </MediaHoverLink>
                <time dateTime={own.publishedAt}>{taipei(own.publishedAt)}</time>
                <span>
                  {pairs.length} 篇相似{later ? `，其中 ${later} 篇比本篇早刊登` : ''}
                </span>
              </p>
              <h3 className="mt-1 text-[15px] font-medium leading-6">
                <Link href={`/article/${own.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                  {headline.title}
                </Link>
              </h3>
              <ul className="mt-1 divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
                {pairs.map((pair) => (
                  <PairRow key={`${pair.own.id}-${pair.other.id}`} pair={pair} />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function JournalistPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ hours?: string }>;
}) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const hours = parseHours((await searchParams).hours);
  const data = await fetchJournalist(name, hours);
  if (data === 'missing') notFound();
  if (!data) return <p className="py-8 text-sm text-zinc-600 dark:text-zinc-400">暫時無法取得這位記者的資料，請稍後重新整理。</p>;
  const { stats } = data;
  const periodHref = (value: number) => (value === 168 ? journalistHref(data.name) : `${journalistHref(data.name)}?hours=${value}`);
  const summary = [
    { label: '署名文章', value: number(stats.articles), unit: '篇' },
    { label: '有正文', value: number(stats.withBody), unit: '篇' },
    { label: '平均字元', value: stats.averageChars === null ? '—' : number(stats.averageChars), unit: '' },
    { label: '明示引用', value: number(stats.cited), unit: '篇' },
    { label: '相似且較晚', value: number(stats.similar.later), unit: '組' },
    { label: '相似且較早', value: number(stats.similar.earlier), unit: '組' },
  ];
  return (
    <div className="pb-4">
      <nav aria-label="麵包屑" className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/journalist/" className="hover:text-brand-700 dark:hover:text-brand-400">
          記者
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        {data.name}
      </nav>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-zinc-300 pb-4 dark:border-zinc-700">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {data.media.map((outlet) => (
              <li key={outlet.media} className="flex items-center gap-1.5">
                <MediaHoverLink media={outlet.media} className={linkStyle}>
                  {outlet.name}
                </MediaHoverLink>
                <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{number(outlet.count)} 篇</span>
              </li>
            ))}
          </ul>
          <nav aria-label="期間" className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">期間</span>
            {DETAIL_HOURS.map((value) => (
              <Link
                key={value}
                href={periodHref(value)}
                aria-current={value === hours ? 'page' : undefined}
                className={`rounded-full border px-3 py-1 ${
                  value === hours
                    ? 'border-brand-600 bg-brand-50 font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                    : 'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900'
                }`}
              >
                {periodLabel(value)}
              </Link>
            ))}
          </nav>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-right">
          {summary.map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                {item.value}
                {item.unit && <span className="ml-1 text-[10px] font-normal text-zinc-500">{item.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </header>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-6">
        <MediaSidebar label="主題與比對範圍">
          <section aria-label="常寫主題" className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800">
            <h2 className="mb-2 text-sm font-semibold">常寫主題</h2>
            {stats.tags.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {stats.tags.map((item) => (
                  <li key={item.tag}>
                    <Link
                      href={`/tag/${encodeURIComponent(item.tag)}/`}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 hover:bg-brand-50 hover:text-brand-800 dark:bg-zinc-800 dark:hover:bg-brand-950 dark:hover:text-brand-300"
                    >
                      {item.tag}
                      <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{item.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400">這段期間的文章沒有標籤。</p>
            )}
          </section>
          <section aria-label="比對範圍" className="rounded-lg border border-zinc-200 p-3 text-xs leading-5 dark:border-zinc-800">
            <h2 className="mb-2 text-sm font-semibold">比對範圍</h2>
            <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-y-1.5">
              <dt className="text-zinc-500 dark:text-zinc-400">納入比對</dt>
              <dd>
                {number(data.sample.focus)} 篇{data.sample.focusTruncated ? `（上限 ${data.sample.focusLimit}，只取最新）` : ''}
              </dd>
              <dt className="text-zinc-500 dark:text-zinc-400">他站候選</dt>
              <dd>
                {number(data.sample.candidates)} 篇{data.sample.candidatesTruncated ? `（上限 ${data.sample.candidateLimit}）` : ''}
              </dd>
              <dt className="text-zinc-500 dark:text-zinc-400">同署名跨站</dt>
              <dd>{number(stats.similar.sameAuthor)} 組</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">方法</dt>
              <dd>
                {data.method}，門檻 {percent(data.threshold)}
              </dd>
            </dl>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              較晚刊登是閱讀線索，不是抄襲判定：共同新聞稿、通訊社稿與授權轉載都會造成重疊；刊登時間以各站標示為準。 同名不同人不會分開。
            </p>
          </section>
        </MediaSidebar>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <SimilarSection data={data} />
          <section aria-labelledby="articles-heading">
            <h2 id="articles-heading" className="border-b border-zinc-200 pb-1.5 text-base font-semibold dark:border-zinc-800">
              署名文章
              <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">{number(data.articles.length)} 篇，最新在前</span>
            </h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.articles.map((article) => {
                const headline = readingTitle(article.title);
                const readable = article.bodyChars > 0;
                return (
                  <li key={article.id} id={`article-${article.id}`} className="scroll-mt-32 py-2.5">
                    <h3 className="text-[15px] font-medium leading-6">
                      <Link href={`/article/${article.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                        {headline.section && (
                          <span className="mr-1.5 text-xs font-normal text-brand-700 dark:text-brand-400">{headline.section}</span>
                        )}
                        {headline.title}
                      </Link>
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                      <MediaHoverLink media={article.media} className={`${linkStyle} font-medium`}>
                        {article.mediaTitle}
                      </MediaHoverLink>
                      <time dateTime={article.publishedAt}>{taipei(article.publishedAt)}</time>
                      <span title="站方署名欄位原文" className="max-w-72 truncate">
                        署名：{article.byline.join('、')}
                      </span>
                      {article.coauthors.length > 0 && (
                        <span>
                          共同署名：
                          {article.coauthors.map((other, index) => (
                            <span key={other}>
                              {index > 0 && '、'}
                              <Link href={journalistHref(other)} className="hover:underline">
                                {other}
                              </Link>
                            </span>
                          ))}
                        </span>
                      )}
                      <span className={readable ? '' : 'text-amber-700 dark:text-amber-400'}>
                        {readable ? `${number(article.bodyChars)} 字元` : CONTENT_STATUS[article.bodyStatus].label}
                      </span>
                      {article.attributions.length > 0 && (
                        <span className="text-violet-700 dark:text-violet-400">
                          引用 {article.attributions.map((source) => source.name).join('、')}
                        </span>
                      )}
                      {article.matches > 0 && (
                        <a href="#similar-heading" className="text-amber-700 hover:underline dark:text-amber-400">
                          {article.matches} 篇他站相似
                        </a>
                      )}
                      {!article.compared && readable && <span>未納入比對</span>}
                      <SourceLink url={article.url} className="!min-h-5 !text-[11px]" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
