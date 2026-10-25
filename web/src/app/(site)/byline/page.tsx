import Link from 'next/link';
import BylineKinds from '@/components/BylineKinds';
import FilterChips from '@/components/FilterChips';
import MediaIcon from '@/components/MediaIcon';
import TableScroller from '@/components/TableScroller';
import { taipei } from '@/lib/api';
import { BYLINE_HOURS, bylineHours, bylineHref, CREDIT_KINDS, fetchBylines, periodLabel } from '@/lib/bylines';
import { pageMetadata } from '@/lib/seo.mts';
import { table } from '@/lib/table-styles';
import JournalistOverview from '../journalist/JournalistOverview';
import BylineFilters from './BylineFilters';

export const metadata = pageMetadata(
  '/byline/',
  '新聞署名',
  '探索個人、筆名、編輯部、團隊與機構署名，查看文章、刊登媒體與原文標示的角色。',
);
export const revalidate = 120;
type Query = { kind?: string; hours?: string; q?: string; media?: string; page?: string };
export default async function BylineIndexPage({ searchParams }: { searchParams: Promise<Query> }) {
  const sp = await searchParams;
  const selectedHours = bylineHours(sp.hours);
  const kind = sp.kind === 'all' ? undefined : (CREDIT_KINDS.find((value) => value === sp.kind) ?? 'person');
  const hours = kind === 'person' ? Math.min(selectedHours, 168) : selectedHours;
  if (kind === 'person')
    return (
      <div className="space-y-4 pb-4">
        <BylineKinds current="person" hours={hours} q={sp.q} media={sp.media} />
        <JournalistOverview hours={hours} initialQuery={sp.q?.trim().slice(0, 120)} initialMedia={sp.media} />
      </div>
    );
  const query = {
    hours: String(hours),
    kind: kind ?? 'all',
    q: sp.q?.trim().slice(0, 120),
    media: sp.media,
    page: /^\d+$/.test(sp.page ?? '') ? sp.page : '0',
  };
  const result = await fetchBylines('', { ...query, kind });
  const data = result && result !== 'missing' ? result : null;
  const href = (patch: Partial<Query>) => {
    const params = new URLSearchParams(
      Object.entries({ ...query, page: undefined, ...patch }).filter((entry): entry is [string, string] => !!entry[1]),
    );
    return `/byline/?${params}`;
  };
  return (
    <div className="space-y-5 pb-8">
      <BylineKinds current={kind ?? 'all'} hours={hours} q={query.q} media={query.media} />
      <FilterChips
        label="期間"
        showLabel
        items={BYLINE_HOURS.map((value) => ({ href: href({ hours: String(value) }), label: periodLabel(value), current: value === hours }))}
      />
      <BylineFilters
        key={`${hours}:${query.kind}:${query.q ?? ''}:${query.media ?? ''}`}
        hours={hours}
        kind={query.kind}
        q={query.q}
        media={query.media}
        outlets={data?.outlets ?? []}
        clearHref={href({ q: undefined, media: undefined })}
      />
      {!data ? (
        <p role="status" className="py-8 text-zinc-500 dark:text-zinc-400">
          暫時無法取得署名資料，請稍後重新整理。
        </p>
      ) : (
        <>
          <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">
            符合 {data.total.toLocaleString('zh-TW')} 個署名 · 本期 {data.credited.toLocaleString('zh-TW')} 篇可辨識署名文章 ·{' '}
            {taipei(data.generatedAt)} 更新
          </p>
          <TableScroller label="署名表格，可左右捲動">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm [&_td]:py-1 [&_th]:py-1">
              <thead className="text-xs text-zinc-500 dark:text-zinc-400">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  {['署名', '刊登媒體', '篇數'].map((label) => (
                    <th
                      key={label}
                      className={`${label === '篇數' ? table.num : label === '署名' ? table.leadHead : table.cell} font-medium`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.bylines.map((entry) => (
                  <tr key={entry.key} className={table.row}>
                    <td className={table.lead}>
                      <div className={table.leadBox}>
                        <Link
                          href={bylineHref(entry.key, hours)}
                          className="block truncate font-medium hover:text-brand-700 hover:underline dark:hover:text-brand-400"
                        >
                          {entry.name}
                        </Link>
                      </div>
                    </td>
                    <td className={table.cell}>
                      {entry.outlets.slice(0, 2).map((outlet) => (
                        <Link
                          key={outlet.media}
                          href={`/media/${encodeURIComponent(outlet.media)}/?hours=${Math.min(hours, 168)}`}
                          className="mr-3 inline-flex items-center gap-1 whitespace-nowrap text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                        >
                          <MediaIcon media={outlet.media} title={outlet.name} size={14} />
                          {outlet.name} <span className="text-zinc-500 dark:text-zinc-400">{outlet.count}</span>
                        </Link>
                      ))}
                      {entry.outlets.length > 2 && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">另 {entry.outlets.length - 2} 家</span>
                      )}
                    </td>
                    <td className={table.num}>{entry.articles.toLocaleString('zh-TW')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.bylines.length && <p className="p-8 text-center text-zinc-500 dark:text-zinc-400">這段期間沒有符合篩選的署名。</p>}
          </TableScroller>
          <nav aria-label="署名分頁" className="flex justify-between text-sm">
            {data.page > 0 ? (
              <Link href={href({ page: String(data.page - 1) })} className="py-2 text-brand-700 dark:text-brand-400">
                ← 上一頁
              </Link>
            ) : (
              <span />
            )}
            <span className="py-2 text-zinc-500 dark:text-zinc-400">第 {data.page + 1} 頁</span>
            {(data.page + 1) * data.pageSize < data.total ? (
              <Link href={href({ page: String(data.page + 1) })} className="py-2 text-brand-700 dark:text-brand-400">
                下一頁 →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </div>
  );
}
