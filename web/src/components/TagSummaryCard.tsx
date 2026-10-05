import Link from 'next/link';
import Sparkline from '@/components/Sparkline';
import type { SeriesPoint, TagStatus } from '@/lib/api';

// Shown on 搜尋 when the query is also a tag: how many reports carry it, where
// it stands in the keyword ranking and its last three days, with the way to
// its tag page, which tracks the tag over time rather than listing matches.

export default function TagSummaryCard({
  tag,
  tagged,
  span,
  status,
  points,
}: {
  tag: string;
  /** Reports tagged with it in the search's period. */
  tagged: number;
  span: string;
  status: TagStatus | null;
  points: SeriesPoint[] | null;
}) {
  const href = `/tag/${encodeURIComponent(tag)}/`;
  const r = status?.ranking;
  const values = (points ?? []).map((p) => p.hourlyCount ?? p.count);
  return (
    <section
      aria-label={`#${tag} 標籤`}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-lg font-semibold">
          <span className="text-zinc-500">#</span>
          {tag}
          <span className="ml-2 align-middle text-xs font-normal text-zinc-500">也是一個關鍵字標籤</span>
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {span}有 <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">{tagged.toLocaleString()}</strong> 篇標成這個標籤 ·{' '}
          {r ? (
            <>
              關鍵字排行第 <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">{r.position}</strong> 名
              {r.new && <span className="ml-1 text-brand-700 dark:text-brand-400">新上榜</span>}
            </>
          ) : (
            '目前不在排行榜上'
          )}
        </p>
      </div>
      {values.some((v) => v) && (
        <div className="space-y-0.5">
          <Sparkline values={values} className="h-10 w-40" />
          <p className="text-[11px] text-zinc-500">過去 3 天每小時篇數</p>
        </div>
      )}
      <Link
        href={href}
        className="ml-auto rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        看 #{tag} 的趨勢 →
      </Link>
    </section>
  );
}
