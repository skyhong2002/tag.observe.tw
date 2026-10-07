import Link from 'next/link';
import { taipei } from '@/lib/api';
import { fetchJournalists, INDEX_HOURS } from '@/lib/journalists';
import JournalistTable from './JournalistTable';

const number = (value: number) => value.toLocaleString('zh-TW');

export default async function JournalistOverview({
  hours = 48,
  initialQuery = '',
  initialMedia = '',
}: {
  hours?: number;
  initialQuery?: string;
  initialMedia?: string;
}) {
  hours = (INDEX_HOURS as readonly number[]).includes(hours) ? hours : 48;
  const data = await fetchJournalists(hours);
  const periodLabel = (value: number) => (value < 48 ? `${value} 小時` : `${value / 24} 天`);
  return (
    <div className="space-y-4 pb-4">
      <header className="mb-4 border-b border-zinc-300 pb-4 dark:border-zinc-700">
        <nav aria-label="期間" className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">期間</span>
          {INDEX_HOURS.map((value) => (
            <Link
              key={value}
              href={`/byline/?${new URLSearchParams({ hours: String(value), ...(initialQuery ? { q: initialQuery } : {}), ...(initialMedia ? { media: initialMedia } : {}) })}`}
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
      </header>
      {data ? (
        <>
          <dl className="mb-4 flex flex-wrap gap-x-7 gap-y-3 text-xs text-zinc-500 dark:text-zinc-400">
            <div>
              <dt>個人／筆名署名</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {number(data.totals.journalists)}
              </dd>
            </div>
            <div>
              <dt>有人名署名的文章</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {number(data.totals.articles)}
                <span className="ml-1 text-[11px] font-normal">／{number(data.totals.credited)} 篇有署名欄位</span>
              </dd>
            </div>
            <div>
              <dt>相似度索引已比對</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {number(data.index.analyzed)}
                <span className="ml-1 text-[11px] font-normal">篇，{taipei(data.index.from)} 之後刊登</span>
              </dd>
            </div>
          </dl>
          <JournalistTable
            key={`${hours}:${initialQuery}:${initialMedia}`}
            rows={data.journalists}
            initialQuery={initialQuery}
            initialMedia={initialMedia}
          />
        </>
      ) : (
        <p role="status" className="py-8 text-sm text-zinc-600 dark:text-zinc-400">
          暫時無法取得記者資料，請稍後重新整理。這不代表沒有具名文章。
        </p>
      )}
    </div>
  );
}
