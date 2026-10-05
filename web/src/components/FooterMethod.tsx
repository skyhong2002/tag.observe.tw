'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { METHOD_HREF } from '@/lib/site-nav';
import {
  ArticleMethod,
  CrawlerMethod,
  EventMethod,
  JournalistMethod,
  MediaCardMethod,
  MediaMethod,
  MediaOverviewMethod,
  ObserveMethod,
  RankingMethod,
  SearchMethod,
  SimilarityMethod,
  SourceMethod,
  TopicMethod,
} from './MethodNotes';

const inlineLink = 'text-brand-700 underline underline-offset-2 dark:text-brand-400';

// Which method blocks explain which pages; anything unlisted gets 資料來源.
function sectionsFor(pathname: string) {
  // The home page passes its blocks as notes, with its own counts.
  if (pathname === '/') return null;
  if (/^\/ranking(\/|$)/.test(pathname)) {
    return (
      <>
        <RankingMethod />
        <MediaCardMethod />
      </>
    );
  }
  // One keyword's page: @notes/tag/[tag] renders its blocks with the chart's basis.
  if (/^\/tag(\/|$)/.test(pathname)) return null;
  if (/^\/observe(\/|$)/.test(pathname)) return <ObserveMethod />;
  if (/^\/search(\/|$)/.test(pathname)) {
    return (
      <>
        <SearchMethod />
        <MediaCardMethod />
      </>
    );
  }
  // The listing (/article/) shares 搜尋新聞's list; one article has its own block.
  if (pathname === '/article' || pathname === '/article/') return <SearchMethod listing />;
  if (/^\/article(\/|$)/.test(pathname)) {
    return (
      <>
        <ArticleMethod />
        <SourceMethod />
      </>
    );
  }
  // One person's page shows outlet names with the hover card; the index does not.
  if (/^\/journalist\/[^/]+/.test(pathname)) {
    return (
      <>
        <JournalistMethod />
        <MediaCardMethod />
      </>
    );
  }
  if (/^\/journalist(\/|$)/.test(pathname)) return <JournalistMethod />;
  if (/^\/similarity(\/|$)/.test(pathname)) {
    const page = /^\/similarity\/daily(\/|$)/.test(pathname) ? 'daily' : /^\/similarity\/about(\/|$)/.test(pathname) ? 'status' : 'graph';
    return (
      <>
        <SimilarityMethod page={page} />
        <MediaCardMethod />
      </>
    );
  }
  if (pathname === '/media' || pathname === '/media/') {
    return (
      <>
        <MediaOverviewMethod />
        <SourceMethod />
      </>
    );
  }
  // Similar Web: @notes/media/sources renders its block with the traffic sheet's import date.
  if (/^\/media\/sources(\/|$)/.test(pathname)) return null;
  if (/^\/media\/crawlers(\/|$)/.test(pathname)) {
    return (
      <>
        <CrawlerMethod />
        <MediaCardMethod />
      </>
    );
  }
  if (pathname.startsWith('/media/')) {
    return (
      <>
        <MediaMethod />
        <SourceMethod />
      </>
    );
  }
  // The /topic/ and /feature/ indexes get TopicMethod with their counts from @notes.
  if (pathname === '/topic' || pathname === '/feature' || pathname === '/topic/' || pathname === '/feature/') return null;
  if (pathname.startsWith('/topic/')) return <TopicMethod kind="topic" outlet />;
  // One 專題 is read as an article (web/src/components/article/ArticleView.tsx).
  if (/^\/feature\/[^/]+\/[^/]+\/?$/.test(pathname)) {
    return (
      <>
        <ArticleMethod feature />
        <SourceMethod />
      </>
    );
  }
  if (pathname.startsWith('/feature/')) return <TopicMethod kind="feature" outlet />;
  if (/^\/event(\/|$)/.test(pathname)) {
    return (
      <>
        <EventMethod page={/^\/event\/archive(\/|$)/.test(pathname) ? 'archive' : 'table'} />
        <MediaCardMethod />
      </>
    );
  }
  // One event's page: @notes/eve/[id] renders its blocks with the event's own tags.
  if (/^\/eve(\/|$)/.test(pathname)) return null;
  return <SourceMethod />;
}

// The footer's collapsible 資料來源與計算方式: the blocks for this page, the page's
// own notes, then a link to the full write-up. Hidden on that page itself.
export default function FooterMethod({ notes }: { notes?: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === METHOD_HREF || `${pathname}/` === METHOD_HREF) return null;
  return (
    <details className="group border-b border-zinc-200 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[13px] hover:text-zinc-900 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden">
        本頁的資料來源與計算方式
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      {/* The anchor sits inside <details> so /#method opens it (browsers reveal fragment targets). */}
      <div id="method" className="max-w-3xl scroll-mt-32 space-y-2.5 pb-5 leading-[1.9]">
        {sectionsFor(pathname)}
        {notes}
        <p>
          <Link href={METHOD_HREF} className={inlineLink}>
            完整的資料來源與計算方式 →
          </Link>
        </p>
      </div>
    </details>
  );
}
