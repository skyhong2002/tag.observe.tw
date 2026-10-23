import Link from 'next/link';
import FilterChips from '@/components/FilterChips';
import MediaIcons from '@/components/MediaIcons';
import MethodLink from '@/components/MethodLink';
import NewKeywordCloud from '@/components/NewKeywordCloud';
import PendingLabel from '@/components/PendingLabel';
import { TabRow } from '@/components/SectionTabs';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { fetchMedia, fetchNewKeywords, type NewKeywordSort, taipeiClock, taipeiDate } from '@/lib/api';
import { pageMetadata } from '@/lib/seo.mts';
import { table } from '@/lib/table-styles';

export const revalidate = 300;

type Search = { days?: string; min?: string; sort?: string; dir?: string; limit?: string };
const DAYS = [7, 30, 90] as const;
const MINS = [3, 10, 30] as const;
const SORTS: NewKeywordSort[] = ['first', 'count', 'peak', 'last'];
const PAGE = 100;
/** Words in the cloud: the period's keywords with the most articles. */
const CLOUD_WORDS = 300;
const MAX_ROWS = 500;

function query(sp: Search) {
  const days = DAYS.find((d) => String(d) === sp.days) ?? 30;
  const min = MINS.find((m) => String(m) === sp.min) ?? 3;
  const sort = SORTS.find((s) => s === sp.sort) ?? 'first';
  const dir: 'asc' | 'desc' = sp.dir === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(MAX_ROWS, Math.max(PAGE, Math.floor(Number(sp.limit) / PAGE) * PAGE || PAGE));
  return { days, min, sort, dir, limit };
}

export async function generateMetadata() {
  return pageMetadata('/ranking/new/', '新出現的關鍵字', '依第一篇報導的時間列出最近才出現在新聞裡的關鍵字，含累計篇數與報導最多的一天。');
}

export default async function NewKeywords({ searchParams }: { searchParams: Promise<Search> }) {
  const { days, min, sort, dir, limit } = query(await searchParams);
  const [data, cloud, media] = await Promise.all([
    fetchNewKeywords(days, min, sort, dir, limit, true).catch(() => null),
    fetchNewKeywords(days, min, 'count', 'desc', CLOUD_WORDS, true).catch(() => null),
    fetchMedia(),
  ]);
  // Rendered at most every 5 minutes (revalidate); "still reported" is judged against that time.
  const renderedAt = Date.now();
  const href = (patch: Partial<Record<keyof Search, string | number | undefined>>) => {
    const next = { days, min, sort, dir, limit: undefined as number | undefined, ...patch };
    const params = new URLSearchParams();
    if (next.days !== 30) params.set('days', String(next.days));
    if (next.min !== 3) params.set('min', String(next.min));
    if (next.sort !== 'first' || next.dir !== 'desc') {
      params.set('sort', String(next.sort));
      params.set('dir', String(next.dir));
    }
    if (next.limit) params.set('limit', String(next.limit));
    const qs = params.toString();
    return `/ranking/new/${qs ? `?${qs}` : ''}`;
  };
  const Th = ({ col, label, className = '' }: { col: NewKeywordSort; label: string; className?: string }) => (
    <th
      className={`whitespace-nowrap ${table.cell} ${className}`}
      aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <Link
        href={href({ sort: col, dir: sort === col && dir === 'desc' ? 'asc' : 'desc' })}
        scroll={false}
        className={`inline-flex items-center gap-0.5 hover:text-brand-700 ${sort === col ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <SortIndicator active={sort === col} descending={dir === 'desc'} />
      </Link>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">新出現的關鍵字</h1>
          <p className="mt-1 text-sm text-zinc-600">第一篇帶這個關鍵字的報導在最近 {days} 天內刊登，查遍本站全部收錄的報導</p>
        </div>
        <MethodLink className="text-sm" />
      </div>
      <TabRow
        label="排行模式"
        tabs={[
          { href: '/ranking/', label: '熱門排行' },
          { href: '/ranking/?order=growth', label: '正在發酵' },
          { href: '/ranking/new/', label: '新出現', current: true },
        ]}
      />
      <FilterChips
        label="首次出現"
        showLabel
        items={DAYS.map((d) => ({ href: href({ days: d }), label: `${d} 天內`, current: d === days }))}
      />
      <FilterChips
        label="累計篇數"
        showLabel
        items={MINS.map((m) => ({ href: href({ min: m }), label: `${m} 篇以上`, current: m === min }))}
      />
      {cloud && <NewKeywordCloud keywords={cloud.keywords} now={renderedAt} />}
      {!data ? (
        <p role="status" className="text-sm text-zinc-600">
          資料暫時無法讀取，請稍後再試。
        </p>
      ) : (
        <>
          <p role="status" className="text-sm text-zinc-600">
            符合條件 {data.total.toLocaleString()} 個關鍵字
          </p>
          {data.keywords.length > 0 && (
            <TableScroller
              card
              label="新出現的關鍵字表格，可左右捲動"
              footer={
                data.total > data.keywords.length &&
                limit < MAX_ROWS && (
                  <div className="border-t border-zinc-300 p-3 text-center text-sm dark:border-zinc-800">
                    <Link
                      href={href({ limit: limit + PAGE })}
                      scroll={false}
                      className="text-brand-700 hover:underline dark:text-brand-400"
                    >
                      <PendingLabel>顯示更多</PendingLabel>
                    </Link>
                  </div>
                )
              }
            >
              <table className="w-full min-w-[68rem] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-950">
                  <tr>
                    <th className={`hidden w-12 text-right sm:table-cell ${table.cell}`}>#</th>
                    <th className={`whitespace-nowrap ${table.cell} ${table.leadHead}`}>關鍵字</th>
                    <Th col="first" label="首次出現" className="w-40" />
                    <Th col="count" label="累計篇數" className="w-24 text-right" />
                    <Th col="peak" label="單日高峰" className="w-40" />
                    <Th col="last" label="最近出現" className="w-32" />
                    <th className={`w-[22rem] whitespace-nowrap ${table.cell}`}>媒體</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.keywords.map((k, i) => (
                    <tr key={k.tag} className={table.row}>
                      <td className={`hidden text-zinc-500 sm:table-cell ${table.num}`}>{i + 1}</td>
                      <td className={table.lead}>
                        <div className={`${table.leadBox} whitespace-nowrap`}>
                          <Link
                            href={`/tag/${encodeURIComponent(k.tag)}`}
                            className={`${table.leadText} font-medium text-brand-700 hover:underline dark:text-brand-400`}
                          >
                            {k.tag}
                          </Link>
                        </div>
                      </td>
                      <td className={`whitespace-nowrap tabular-nums ${table.cell}`}>
                        {taipeiDate(k.firstAt)}
                        <span className="ml-1.5 text-xs text-zinc-500">{taipeiClock(k.firstAt)}</span>
                      </td>
                      <td className={table.num}>{k.articleCount.toLocaleString()}</td>
                      <td
                        className={`whitespace-nowrap tabular-nums ${table.cell}`}
                        title={k.peakDay ? `報導最多的一天（台北時間）：${k.peakDay}，${k.peakCount} 篇` : '還沒逐日計算'}
                      >
                        {k.peakDay ? (
                          <>
                            {k.peakDay}
                            <span className="ml-1.5 text-xs text-zinc-500">{k.peakCount} 篇</span>
                          </>
                        ) : (
                          <span className="text-zinc-400">計算中</span>
                        )}
                      </td>
                      <td className={`whitespace-nowrap tabular-nums text-zinc-600 ${table.cell}`}>
                        {k.lastAt ? taipeiDate(k.lastAt) : <span className="text-zinc-400">—</span>}
                      </td>
                      <td className={`max-w-0 ${table.cell}`}>
                        <MediaIcons media={k.media ?? {}} info={media} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroller>
          )}
        </>
      )}
    </div>
  );
}
