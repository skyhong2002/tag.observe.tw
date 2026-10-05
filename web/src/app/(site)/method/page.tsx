import Link from 'next/link';
import {
  ArticleMethod,
  CrawlerMethod,
  EventMethod,
  HomeMethod,
  JournalistMethod,
  MediaMethod,
  MediaOverviewMethod,
  MediaSourcesMethod,
  ObserveMethod,
  RankingMethod,
  SearchMethod,
  SimilarityMethod,
  SourceMethod,
  TagMethod,
  TopicMethod,
} from '@/components/MethodNotes';
import { pageMetadata } from '@/lib/seo.mts';
import traffic from '../../../../../app/data/media-traffic.json';
import MethodToc from './MethodToc';

// Every method block in one place, grouped by the page it explains; the footer
// shows only the blocks for the page at hand. The camp basis is stated once, in
// the event group, so the other blocks leave it out here.

export const metadata = pageMetadata(
  '/method/',
  '資料來源與計算方式',
  '了解新文易數的新聞來源、標籤排行、爆發力、事件分群、媒體分類與內文相似度計算方法。',
  true,
);

const GROUPS: Array<{ id: string; title: string; pages?: Array<[string, string]>; body: React.ReactNode }> = [
  { id: 'source', title: '資料來源（全站）', pages: [['/media/', '媒體']], body: <SourceMethod /> },
  { id: 'home', title: '首頁', pages: [['/', '首頁']], body: <HomeMethod /> },
  {
    id: 'event',
    title: '事件表與單一事件',
    pages: [
      ['/event/', '事件表'],
      ['/event/archive/', '存檔'],
    ],
    body: <EventMethod />,
  },
  {
    id: 'ranking',
    title: '關鍵字排行與關鍵字頁',
    pages: [['/ranking/', '關鍵字排行']],
    body: (
      <>
        <RankingMethod />
        <TagMethod camp={false} />
      </>
    ),
  },
  { id: 'search', title: '搜尋', body: <SearchMethod camp={false} /> },
  { id: 'observe', title: '網站觀測', pages: [['/observe/', '網站觀測']], body: <ObserveMethod /> },
  { id: 'article', title: '單篇文章', body: <ArticleMethod /> },
  {
    id: 'similarity',
    title: '新聞關係圖',
    pages: [
      ['/similarity/', '關係圖'],
      ['/similarity/daily/', '每日趨勢'],
      ['/similarity/about/', '擷取狀態'],
    ],
    body: <SimilarityMethod camp={false} />,
  },
  { id: 'journalist', title: '記者', pages: [['/journalist/', '記者']], body: <JournalistMethod /> },
  {
    id: 'topic',
    title: '議題表與專題',
    pages: [
      ['/topic/', '議題表'],
      ['/feature/', '專題'],
    ],
    body: (
      <>
        <TopicMethod />
        <TopicMethod outlet />
      </>
    ),
  },
  {
    id: 'media',
    title: '媒體',
    pages: [
      ['/media/', '收錄概況'],
      ['/media/sources/', 'Similar Web'],
      ['/media/crawlers/', '爬蟲資訊'],
    ],
    body: (
      <>
        <MediaOverviewMethod camp={false} />
        <MediaMethod />
        <MediaSourcesMethod retrievedAt={traffic.retrievedAt} camp={false} />
        <CrawlerMethod />
      </>
    ),
  },
];

const link = 'text-brand-700 hover:underline dark:text-brand-400';

export default function MethodPage() {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,48rem)_13rem] lg:justify-between lg:gap-12">
      <article className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">資料來源與計算方式</h1>
        {/* Narrow screens: the groups up top. Wide screens use the side outline instead. */}
        <nav aria-label="目錄" className="mt-5 rounded-lg border border-zinc-200 p-4 text-sm lg:hidden dark:border-zinc-800">
          <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">目錄</h2>
          <ol className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {GROUPS.map((group) => (
              <li key={group.id}>
                <a href={`#${group.id}`} className={link}>
                  {group.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={group.id} className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <h2 id={group.id} className="scroll-mt-24 text-lg font-semibold tracking-tight">
                {group.title}
              </h2>
              {group.pages && (
                <p className="flex flex-wrap gap-x-3 text-xs">
                  {group.pages.map(([href, label]) => (
                    <Link key={href} href={href} className={link}>
                      {label} →
                    </Link>
                  ))}
                </p>
              )}
            </div>
            <div className="mt-4 space-y-3 text-sm leading-[1.9] text-zinc-700 dark:text-zinc-300 [&_h3]:scroll-mt-24 [&_h3]:pt-4 [&_h3]:text-[15px] [&_h3]:first:pt-0">
              {group.body}
            </div>
          </section>
        ))}
      </article>
      <MethodToc groups={GROUPS.map(({ id, title }) => ({ id, title }))} />
    </div>
  );
}
