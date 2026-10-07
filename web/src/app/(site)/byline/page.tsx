import Link from 'next/link';
import SectionTabs from '@/components/SectionTabs';
import { taipei } from '@/lib/api';
import { BYLINE_HOURS, bylineHours, bylineHref, CREDIT_KINDS, CREDIT_LABELS, fetchBylines, periodLabel } from '@/lib/bylines';
import { pageMetadata } from '@/lib/seo.mts';

export const metadata = pageMetadata(
  '/byline/',
  '新聞署名',
  '探索個人、筆名、編輯部、團隊與機構署名，查看文章、刊登媒體與原文標示的角色。',
);
export const revalidate = 120;
type Query = { kind?: string; hours?: string; q?: string; media?: string; page?: string };
export default async function BylineIndexPage({ searchParams }: { searchParams: Promise<Query> }) {
  const sp = await searchParams;
  const hours = bylineHours(sp.hours);
  const kind = CREDIT_KINDS.find((value) => value === sp.kind);
  const query = {
    hours: String(hours),
    kind,
    q: sp.q?.trim().slice(0, 120),
    media: sp.media,
    page: /^\d+$/.test(sp.page ?? '') ? sp.page : '0',
  };
  const result = await fetchBylines('', query);
  const data = result && result !== 'missing' ? result : null;
  const href = (patch: Partial<Query>) => {
    const params = new URLSearchParams(
      Object.entries({ ...query, page: undefined, ...patch }).filter((entry): entry is [string, string] => !!entry[1]),
    );
    return `/byline/?${params}`;
  };
  return (
    <div className="space-y-5 pb-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">新聞署名</h1>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          從文章署名找人、團隊與機構。個人與筆名依公開署名整理，同名不一定是同一人；編輯部與團隊依刊登媒體分開。
        </p>
      </header>
      <SectionTabs
        label="署名類型"
        tabs={[
          {
            href: href({ kind: undefined }),
            label: `全部${
              data
                ? ` ${Object.values(data.counts)
                    .reduce((a, b) => a + b, 0)
                    .toLocaleString('zh-TW')}`
                : ''
            }`,
            current: !kind,
          },
          ...CREDIT_KINDS.map((value) => ({
            href: href({ kind: value }),
            label: `${CREDIT_LABELS[value]}${data ? ` ${data.counts[value].toLocaleString('zh-TW')}` : ''}`,
            current: kind === value,
          })),
        ]}
      />
      <nav aria-label="署名統計期間" className="flex flex-wrap gap-2 text-xs">
        {BYLINE_HOURS.map((value) => (
          <Link
            key={value}
            href={href({ hours: String(value) })}
            aria-current={value === hours ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 ${value === hours ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300' : 'border-zinc-300 dark:border-zinc-700'}`}
          >
            {periodLabel(value)}
          </Link>
        ))}
      </nav>
      <form action="/byline/" className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <input type="hidden" name="hours" value={hours} />
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label className="text-xs text-zinc-500">
          搜尋署名
          <input
            name="q"
            defaultValue={query.q}
            maxLength={120}
            placeholder="姓名、筆名或團隊名稱"
            className="mt-1 block w-64 max-w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
        </label>
        <label className="text-xs text-zinc-500">
          刊登媒體
          <select
            name="media"
            defaultValue={query.media ?? ''}
            className="mt-1 block max-w-64 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          >
            <option value="">全部媒體</option>
            {data?.outlets.map((outlet) => (
              <option key={outlet.media} value={outlet.media}>
                {outlet.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white">
          查詢
        </button>
        {(query.q || query.media) && (
          <Link href={href({ q: undefined, media: undefined })} className="py-2 text-sm text-brand-700 dark:text-brand-400">
            清除篩選
          </Link>
        )}
      </form>
      {!data ? (
        <p role="status" className="py-8 text-zinc-500">
          暫時無法取得署名資料，請稍後重新整理。
        </p>
      ) : (
        <>
          <p role="status" className="text-xs text-zinc-500">
            符合 {data.total.toLocaleString('zh-TW')} 個署名 · 本期 {data.credited.toLocaleString('zh-TW')} 篇可辨識署名文章 ·{' '}
            {taipei(data.generatedAt)} 更新
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  {['署名', '類型／原文角色', '刊登媒體', '署名篇數'].map((label) => (
                    <th key={label} className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.bylines.map((entry) => (
                  <tr key={entry.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3">
                      <Link href={bylineHref(entry.key, hours)} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                        {entry.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span>{CREDIT_LABELS[entry.kind]}</span>
                      {entry.roles.length > 0 && <p className="mt-1 text-xs text-zinc-500">{entry.roles.join('、')}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {entry.outlets.slice(0, 2).map((outlet) => (
                        <Link
                          key={outlet.media}
                          href={`/media/${encodeURIComponent(outlet.media)}/?hours=${Math.min(hours, 168)}`}
                          className="mr-3 inline-block text-xs hover:underline"
                        >
                          {outlet.name} <span className="text-zinc-500">{outlet.count}</span>
                        </Link>
                      ))}
                      {entry.outlets.length > 2 && <span className="text-xs text-zinc-500">另 {entry.outlets.length - 2} 家</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{entry.articles.toLocaleString('zh-TW')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.bylines.length && <p className="p-8 text-center text-zinc-500">這段期間沒有符合篩選的署名。</p>}
          </div>
          <nav aria-label="署名分頁" className="flex justify-between text-sm">
            {data.page > 0 ? (
              <Link href={href({ page: String(data.page - 1) })} className="py-2 text-brand-700 dark:text-brand-400">
                ← 上一頁
              </Link>
            ) : (
              <span />
            )}
            <span className="py-2 text-zinc-500">第 {data.page + 1} 頁</span>
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
      <p className="text-xs leading-6 text-zinc-500">
        分類由原文署名自動整理；無法確認的署名保留在「待辨識」。角色只採用明確標示，各角色可在不同文章出現。同篇多人共同署名會分別計入，篇數不可直接相加。
      </p>
      <Link
        href={`/journalist/?hours=${Math.min(hours, 168)}`}
        className="inline-block text-sm text-brand-700 hover:underline dark:text-brand-400"
      >
        個人署名的相似報導統計 →
      </Link>
    </div>
  );
}
