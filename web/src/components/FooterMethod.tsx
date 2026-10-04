'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { METHOD_HREF } from '@/lib/site-nav';
import { EventMethod, MediaMethod, RankingMethod, SimilarityMethod, SourceMethod, TopicMethod } from './MethodNotes';

const inlineLink = 'text-brand-700 underline underline-offset-2 dark:text-brand-400';

// Which method blocks explain which pages; anything unlisted gets 資料來源.
function sectionsFor(pathname: string) {
  if (pathname === '/') return <EventMethod />;
  if (/^\/(ranking|tag)\//.test(pathname)) return <RankingMethod />;
  if (/^\/(similarity|journalist)\//.test(pathname)) return <SimilarityMethod />;
  if (pathname.startsWith('/media/')) {
    return (
      <>
        <SourceMethod />
        <MediaMethod />
      </>
    );
  }
  // The /topic/ and /feature/ indexes get TopicMethod with their counts from @notes.
  if (pathname === '/topic' || pathname === '/feature' || pathname === '/topic/' || pathname === '/feature/') return null;
  if (pathname.startsWith('/topic/')) return <TopicMethod kind="topic" />;
  if (pathname.startsWith('/feature/')) return <TopicMethod kind="feature" />;
  if (/^\/(event|eve)\//.test(pathname)) return <EventMethod />;
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
