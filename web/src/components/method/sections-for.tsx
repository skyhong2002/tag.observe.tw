import { METHOD_HREF } from '@/lib/site-nav';
import {
  ArticleMethod,
  CrawlerMethod,
  EventMethod,
  GroupMethod,
  JournalistMethod,
  MediaCardMethod,
  MediaMethod,
  MediaOverviewMethod,
  ObserveMethod,
  PictureMethod,
  RankingMethod,
  SearchMethod,
  SimilarityMethod,
  SourceMethod,
  TopicMethod,
  TrafficCollectionMethod,
  WritingMethod,
} from '../MethodNotes';

// The footer's blocks for one page, picked on the server by the @notes slot
// (app/(site)/@notes) so the method write-up never ships as client JavaScript.
// Which method blocks explain which pages; anything unlisted gets 資料來源.
export function sectionsFor(pathname: string) {
  // The full write-up hides the footer block altogether (FooterMethodGate).
  if (pathname === METHOD_HREF || `${pathname}/` === METHOD_HREF) return null;
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
  if (/^\/group(\/|$)/.test(pathname)) return <GroupMethod />;
  if (/^\/admin\/(avatars|tag-visuals)(\/|$)/.test(pathname)) return <PictureMethod />;
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
        <WritingMethod brief />
        <SourceMethod />
      </>
    );
  }
  if (/^\/writing(\/|$)/.test(pathname)) {
    return (
      <>
        <WritingMethod />
        <MediaCardMethod />
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
    const page = /^\/similarity\/reposts(\/|$)/.test(pathname)
      ? 'reposts'
      : /^\/similarity\/about(\/|$)/.test(pathname)
        ? 'status'
        : 'graph';
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
  // 流量與排名: @notes/media/traffic renders its block with the sheet and fetch status.
  if (/^\/media\/traffic(\/|$)/.test(pathname)) return null;
  if (/^\/crawlers\/traffic(\/|$)/.test(pathname)) return <TrafficCollectionMethod />;
  if (/^\/crawlers(\/|$)/.test(pathname)) {
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
        <WritingMethod brief />
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
        <EventMethod page="table" />
        <MediaCardMethod />
      </>
    );
  }
  // One event's page: @notes/eve/[id] renders its blocks with the event's own tags.
  if (/^\/eve(\/|$)/.test(pathname)) return null;
  return <SourceMethod />;
}
