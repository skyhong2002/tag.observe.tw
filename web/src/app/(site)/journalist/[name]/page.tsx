import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AuthorCredits from '@/components/AuthorCredits';
import FilterChips from '@/components/FilterChips';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaSidebar from '@/components/MediaSidebar';
import MethodLink from '@/components/MethodLink';
import FollowButton from '@/components/reader/FollowButton';
import SourceLink from '@/components/SourceLink';
import { BodyChanges, DiffText, invertDiff, invertSegments } from '@/components/VersionDiff';
import { taipei } from '@/lib/api';
import { CONTENT_STATUS } from '@/lib/article-content';
import { clipHeadline } from '@/lib/event-presentation.mts';
import {
  DETAIL_HOURS,
  fetchJournalist,
  type JournalistDetail,
  type JournalistPair,
  journalistHref,
  relationLabel,
  removalRequestHref,
} from '@/lib/journalists';
import { readingTitle } from '@/lib/reading.mts';
import { decodeRouteParam, pageMetadata } from '@/lib/seo.mts';

export const revalidate = 300;
const number = (value: number) => value.toLocaleString('zh-TW');
const percent = (value: number) => `${(value * 100).toFixed(0)}%`;
const periodLabel = (value: number) => (value < 48 ? `${value} 小時` : `${value / 24} 天`);
const parseHours = (value: string | undefined) => ((DETAIL_HOURS as readonly number[]).includes(Number(value)) ? Number(value) : 168);
const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';
// A prolific byline can have hundreds of similar pairs, each with a full diff;
// rendering them all made pages 200,000px tall. Show the newest first.
const SIMILAR_SHOWN = 20;
const ARTICLES_SHOWN = 100;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeRouteParam(name);
  return pageMetadata(
    `/journalist/${encodeURIComponent(decoded)}/`,
    `${decoded} 的報導`,
    `${decoded} 署名的文章：刊登媒體、常寫主題，以及與其他媒體內文相近的文章對照。`,
  );
}

function PairRow({ pair }: { pair: JournalistPair }) {
  const other = readingTitle(pair.other.title);
  // Read every difference against this journalist's own story in the card heading:
  // red is only in the own story, green only in the other one. Order of
  // publication stays in the relation label, not in the colours.
  const flip = pair.diff?.earlier === 'other';
  const title = pair.diff?.title && (flip ? invertSegments(pair.diff.title) : pair.diff.title);
  const body = pair.diff?.body && (flip ? invertDiff(pair.diff.body) : pair.diff.body);
  const sameTitle = !!title && title.every(([op]) => op === 0);
  const sameBody = pair.kind === 'identical' || !!body?.identical;
  const facts = [
    relationLabel(pair),
    `相似 ${percent(pair.score)}`,
    sameTitle && sameBody ? '標題、內文相同' : sameTitle ? '標題相同' : sameBody ? '內文相同' : '',
    pair.otherCitesOwn ? `對方註明引用${pair.own.mediaTitle}` : '',
    pair.ownCitesOther ? `本篇註明引用${pair.other.mediaTitle}` : '',
  ].filter(Boolean);
  return (
    <li id={`pair-${pair.own.id}-${pair.other.id}`} className="scroll-mt-20 space-y-1 py-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
        <MediaHoverLink media={pair.other.media} className={`${linkStyle} text-sm font-medium`}>
          {pair.other.mediaTitle}
        </MediaHoverLink>
        <time dateTime={pair.other.publishedAt} className="tabular-nums">
          {taipei(pair.other.publishedAt)}
        </time>
        {pair.other.authors.length > 0 && <AuthorCredits credits={pair.other.authors} media={pair.other.media} />}
        <span>· {facts.join(' · ')}</span>
      </p>
      {!sameTitle && (
        <p className="text-sm leading-7">
          <Link href={`/article/${pair.other.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
            {title ? <DiffText segments={title} /> : other.title}
          </Link>
        </p>
      )}
      {body ? (
        <BodyChanges diff={body} label="內文與本篇不同" removed="本篇有、對方無" added="對方多" />
      ) : (
        pair.evidence &&
        !sameBody && (
          <details className="text-xs">
            <summary className="cursor-pointer py-1 text-zinc-500 dark:text-zinc-400">共同片段</summary>
            <p className="break-words leading-6 text-zinc-600 dark:text-zinc-400">{pair.evidence}</p>
          </details>
        )
      )}
    </li>
  );
}

function SimilarSection({ data, all, allHref }: { data: JournalistDetail; all: boolean; allHref: string }) {
  const groups = new Map<number, JournalistPair[]>();
  for (const pair of data.pairs) (groups.get(pair.own.id) ?? groups.set(pair.own.id, []).get(pair.own.id)!).push(pair);
  // Newest first. Ranking by how many counterparts were earlier would read as a suspicion score.
  const ordered = [...groups.values()].sort((a, b) => Date.parse(b[0].own.publishedAt) - Date.parse(a[0].own.publishedAt));
  const shown = all ? ordered : ordered.slice(0, SIMILAR_SHOWN);
  return (
    <section aria-labelledby="similar-heading" className="mb-6">
      <h2 id="similar-heading" className="text-base font-semibold">
        與其他媒體內文相近的文章
        <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
          <span className="whitespace-nowrap">{number(data.stats.similar.articles)} 篇有相近文章，</span>
          <span className="whitespace-nowrap">共 {number(data.stats.similar.pairs)} 組</span>
        </span>
      </h2>
      <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
        {data.index.pending > 0 && (
          <span className="mr-3 text-zinc-500 dark:text-zinc-400">另有 {number(data.index.pending)} 篇尚待比對</span>
        )}
        <MethodLink>相似不等於抄襲</MethodLink>
      </p>
      {!ordered.length && <p className="py-6 text-sm text-zinc-500 dark:text-zinc-400">這段期間內沒有找到與他站內文相近的文章。</p>}
      <ul className="mt-3 space-y-4">
        {shown.map((pairs) => {
          const own = pairs[0].own;
          const headline = readingTitle(own.title);
          return (
            <li key={own.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                <MediaHoverLink media={own.media} className={`${linkStyle} font-medium`}>
                  {own.mediaTitle}
                </MediaHoverLink>
                <time dateTime={own.publishedAt}>{taipei(own.publishedAt)}</time>
                <span>{pairs.length} 篇內文相近</span>
              </p>
              <h3 className="mt-1 text-[15px] font-medium leading-6">
                <Link href={`/article/${own.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                  {clipHeadline(headline.title)}
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
      {shown.length < ordered.length && (
        <p className="mt-3 text-sm">
          <Link href={allHref} className={linkStyle}>
            顯示其餘 {number(ordered.length - shown.length)} 篇的相近文章
          </Link>
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">目前列出最新 {number(shown.length)} 篇</span>
        </p>
      )}
    </section>
  );
}

export default async function JournalistPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ hours?: string; all?: string }>;
}) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const query = await searchParams;
  const hours = parseHours(query.hours);
  const all = query.all === '1';
  const data = await fetchJournalist(name, hours);
  if (data === 'missing') notFound();
  if (!data) return <p className="py-8 text-sm text-zinc-600 dark:text-zinc-400">暫時無法取得這位記者的資料，請稍後重新整理。</p>;
  const { stats } = data;
  const periodHref = (value: number) => (value === 168 ? journalistHref(data.name) : `${journalistHref(data.name)}?hours=${value}`);
  const allHref = (anchor: string) => `${journalistHref(data.name)}?${hours === 168 ? '' : `hours=${hours}&`}all=1#${anchor}`;
  const articles = all ? data.articles : data.articles.slice(0, ARTICLES_SHOWN);
  const summary = [
    { label: '署名文章', value: number(stats.articles), unit: '篇' },
    { label: '有正文', value: number(stats.withBody), unit: '篇' },
    { label: '平均字元', value: stats.averageChars === null ? '—' : number(stats.averageChars), unit: '' },
    { label: '明示引用', value: number(stats.cited), unit: '篇' },
    { label: '相近，對方較早', value: number(stats.similar.later), unit: '篇' },
    { label: '相近，本篇較早', value: number(stats.similar.earlier), unit: '篇' },
  ];
  return (
    <div className="pb-4">
      <nav aria-label="麵包屑" className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/byline/?kind=person" className="hover:text-brand-700 dark:hover:text-brand-400">
          署名
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        {data.name}
      </nav>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-zinc-300 pb-4 dark:border-zinc-700">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <FollowButton kind="journalist" target={data.name} />
          </div>
          <Link
            href={`/byline/${encodeURIComponent(`person:${data.name}`)}/?hours=${hours}`}
            className="mt-2 inline-block text-sm text-brand-700 hover:underline dark:text-brand-400"
          >
            署名文章與原文角色 →
          </Link>
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
          <FilterChips
            label="期間"
            showLabel
            className="mt-3"
            items={DETAIL_HOURS.map((value) => ({ href: periodHref(value), label: periodLabel(value), current: value === hours }))}
          />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-right">
          {summary.map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                {item.value}
                {item.unit && <span className="ml-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">{item.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </header>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-6">
        <MediaSidebar label="主題與比對篇數">
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
          <section aria-label="比對篇數" className="rounded-lg border border-zinc-200 p-3 text-xs leading-5 dark:border-zinc-800">
            <h2 className="mb-2 text-sm font-semibold">比對篇數</h2>
            <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-y-1.5">
              <dt className="text-zinc-500 dark:text-zinc-400">已比對</dt>
              <dd>{number(data.index.compared)} 篇</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">未見相近</dt>
              <dd title="已比對但未發現達門檻的相近文章，不代表已確認原創">{number(data.index.unmatched)} 篇</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">尚待比對</dt>
              <dd>{number(data.index.pending)} 篇</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">同署名跨站</dt>
              <dd>{number(stats.similar.sameAuthor)} 篇</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">已註明來源</dt>
              <dd>{number(stats.similar.attributed ?? 0)} 篇</dd>
            </dl>
            <p className="mt-2">
              <MethodLink />
            </p>
          </section>
          <section aria-label="關於這一頁" className="rounded-lg border border-zinc-200 p-3 text-xs leading-5 dark:border-zinc-800">
            <h2 className="mb-2 text-sm font-semibold">關於這一頁</h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              這一頁由各媒體公開刊出的署名自動整理，不是本人建立或認可的個人檔案。若您是本人，不希望出現在記者頁，請
              <a href={removalRequestHref(data.name)} target="_blank" rel="noopener noreferrer" className={linkStyle}>
                提出移除請求
              </a>
              。這會開啟一則公開的 GitHub issue，請勿填寫名字以外的個資；送出後約 15
              分鐘內這一頁下架，之後不再從署名產生，原文與原站連結不受影響。
            </p>
          </section>
        </MediaSidebar>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <SimilarSection data={data} all={all} allHref={allHref('similar-heading')} />
          <section aria-labelledby="articles-heading">
            <h2 id="articles-heading" className="border-b border-zinc-200 pb-1.5 text-base font-semibold dark:border-zinc-800">
              署名文章
              <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">{number(data.articles.length)} 篇，最新在前</span>
            </h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {articles.map((article) => {
                const headline = readingTitle(article.title);
                const readable = article.bodyChars > 0;
                return (
                  <li key={article.id} id={`article-${article.id}`} className="scroll-mt-32 py-2.5">
                    <h3 className="text-[15px] font-medium leading-6">
                      <Link href={`/article/${article.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                        {headline.section && (
                          <span className="mr-1.5 text-xs font-normal text-brand-700 dark:text-brand-400">{headline.section}</span>
                        )}
                        {clipHeadline(headline.title)}
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
                        <a href="#similar-heading" className="hover:underline">
                          {article.matches} 篇他站內文相近
                        </a>
                      )}
                      {!article.compared && readable && <span>未納入比對</span>}
                      <SourceLink url={article.url} className="!min-h-5 !text-[11px]" />
                    </div>
                  </li>
                );
              })}
            </ul>
            {articles.length < data.articles.length && (
              <p className="mt-3 text-sm">
                <Link href={allHref('articles-heading')} className={linkStyle}>
                  顯示其餘 {number(data.articles.length - articles.length)} 篇署名文章
                </Link>
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">目前列出最新 {number(articles.length)} 篇</span>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
