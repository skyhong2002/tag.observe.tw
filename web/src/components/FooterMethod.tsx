import Link from 'next/link';
import { METHOD_HREF } from '@/lib/site-nav';
import FooterMethodGate from './FooterMethodGate';

const inlineLink = 'text-brand-700 underline underline-offset-2 dark:text-brand-400';

// The footer's collapsible 資料來源與計算方式: the blocks for this page and its own
// notes, both from the @notes slot (method/sections-for.tsx), then a link to the
// full write-up. Hidden on that page itself.
export default function FooterMethod({ notes }: { notes?: React.ReactNode }) {
  return (
    <FooterMethodGate>
      <details className="group border-t border-zinc-200 dark:border-zinc-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-brand-700 dark:hover:text-brand-400 [&::-webkit-details-marker]:hidden">
          <span>
            本頁的資料來源與計算方式
            <span className="ml-1 text-xs font-normal text-brand-700 dark:text-brand-400" aria-hidden="true">
              ⓘ
            </span>
          </span>
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
        <div id="method" className="max-w-3xl scroll-mt-32 space-y-2.5 pb-5 text-[13px] leading-[1.9]">
          {notes}
          <p>
            <Link prefetch={false} href={METHOD_HREF} className={inlineLink}>
              完整的資料來源與計算方式 →
            </Link>
          </p>
        </div>
      </details>
    </FooterMethodGate>
  );
}
