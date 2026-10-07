import Link from 'next/link';
import MediaIcon from '@/components/MediaIcon';
import { relationshipQuery } from '@/lib/relationship-query.mts';
import { pageMetadata } from '@/lib/seo.mts';
import { fetchSimilarity, periodQuery } from '@/lib/similarity';
import { sourceRanking } from '@/lib/source-ranking.mts';
import { similarityPeriod, similarityThreshold } from '../query';
import SimilarityTabs from '../SimilarityTabs';

export const revalidate = 60;
export const metadata = pageMetadata(
  '/similarity/sources/',
  '來源排行',
  '探索新聞明示的來源／引用，查看被註明篇數、註明來源的媒體與原文證據。',
);
export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams,
    period = similarityPeriod(sp),
    threshold = similarityThreshold(sp);
  const params = relationshipQuery(sp);
  for (const [key, value] of periodQuery(period, threshold)) params.set(key, value);
  const data = await fetchSimilarity(period, threshold).catch(() => null);
  const rows = data
    ? sourceRanking(data).filter(
        (node) =>
          (!sp.country || node.countryCode === sp.country) &&
          (!sp.sourceQ || node.name.toLocaleLowerCase().includes(sp.sourceQ.toLocaleLowerCase())),
      )
    : [];
  const countries = data ? [...new Map(sourceRanking(data).map((node) => [node.countryCode, node.country])).entries()] : [];
  const detailQuery = new URLSearchParams(periodQuery(period, threshold));
  detailQuery.set('direction', 'incoming');
  return (
    <div className="space-y-5 pb-8">
      <SimilarityTabs current="sources" query={params.toString()} />

      <nav aria-label="來源排行期間" className="flex flex-wrap gap-2 text-xs">
        {[24, 48, 72, 168].map((hours) => (
          <Link
            key={hours}
            href={`/similarity/sources/?${new URLSearchParams({ ...Object.fromEntries(params), from: '', to: '', hours: String(hours), ...(sp.sourceQ ? { sourceQ: sp.sourceQ } : {}), ...(sp.country ? { country: sp.country } : {}) })}`}
            aria-current={data?.hours === hours ? 'page' : undefined}
            className="rounded-full border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
          >
            {hours < 48 ? `${hours} 小時` : `${hours / 24} 天`}
          </Link>
        ))}
      </nav>
      <form
        action="/similarity/sources/"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        {[...params].map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <label className="text-xs text-zinc-500">
          搜尋來源
          <input
            name="sourceQ"
            defaultValue={sp.sourceQ}
            placeholder="媒體、通訊社或機構"
            className="mt-1 block rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
        </label>
        <label className="text-xs text-zinc-500">
          來源所屬地區
          <select
            name="country"
            defaultValue={sp.country ?? ''}
            className="mt-1 block rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          >
            <option value="">全部地區</option>
            {countries.map(([code, country]) => (
              <option key={code} value={code}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-lg bg-brand-700 px-4 text-sm text-white">
          查詢
        </button>
      </form>
      {!data ? (
        <p role="status" className="py-8 text-zinc-500">
          暫時無法取得來源／引用資料，請稍後重新整理。
        </p>
      ) : (
        <>
          <p role="status" className="text-xs text-zinc-500">
            符合 {rows.length} 個來源 · 依被註明篇數排序
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  {['來源', '所屬地區', '被註明篇數', '註明來源的媒體數', '查看'].map((label) => (
                    <th key={label} className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((node) => {
                  const graph = new URLSearchParams(params);
                  graph.set('node', node.id);
                  graph.set('mode', 'citation');
                  graph.set('direction', 'incoming');
                  graph.set('view', 'evidence');
                  graph.set('limit', '0');
                  graph.delete('source');
                  graph.delete('target');
                  graph.delete('edgeKind');
                  graph.delete('edgeRelation');
                  graph.delete('edgeDirected');
                  graph.delete('relation');
                  graph.delete('q');
                  graph.delete('page');
                  return (
                    <tr key={node.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="px-4 py-3">
                        <Link
                          href={`/media/${encodeURIComponent(node.id)}/references/?${detailQuery}`}
                          className="flex items-center gap-2 font-medium text-brand-700 hover:underline dark:text-brand-400"
                        >
                          <MediaIcon media={node.id} size={16} />
                          {node.name}
                        </Link>
                        {node.external && <p className="mt-1 text-xs text-zinc-500">本期僅有來源／引用資料</p>}
                      </td>
                      <td className="px-4 py-3">{node.country}</td>
                      <td className="px-4 py-3 tabular-nums">{node.incoming.toLocaleString('zh-TW')}</td>
                      <td className="px-4 py-3 tabular-nums">{node.citingMedia.length}</td>
                      <td className="px-4 py-3">
                        <Link href={`/similarity/?${graph}#graph-browser`} className="text-brand-700 hover:underline dark:text-brand-400">
                          關係圖 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <p className="p-8 text-center text-zinc-500">這段期間沒有符合篩選的明示來源或引用。</p>}
          </div>
        </>
      )}
    </div>
  );
}
