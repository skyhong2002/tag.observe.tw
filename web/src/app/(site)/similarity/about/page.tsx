import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import { fetchSimilarity, periodQuery, type SimilarityData } from '@/lib/similarity';
import { number, periodLabel, taipei } from '../format';
import { type SimilarityQuery, similarityPeriod, similarityThreshold } from '../query';
import SimilarityTabs from '../SimilarityTabs';

export const metadata = { title: '資料說明 · 新聞關係圖', description: '新聞關係圖的資料範圍、歸源規則、相似度計算與各媒體擷取狀態。' };

const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';

export default async function SimilarityAboutPage({ searchParams }: { searchParams: Promise<SimilarityQuery> }) {
  const query = await searchParams;
  const period = similarityPeriod(query);
  const threshold = similarityThreshold(query);
  const params = periodQuery(period, threshold).toString();
  const data = await fetchSimilarity(period, threshold).catch(() => null);
  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <SimilarityTabs current="about" query={params} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">資料說明</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">新聞關係圖的資料範圍、歸源規則與各媒體擷取狀態。</p>
        </div>
      </header>
      <section className="max-w-3xl space-y-4 text-sm leading-7">
        {data ? (
          <p>
            更新於 {taipei(data.generatedAt)}（台北）。{periodLabel(data)}期間內有 {number(data.index.available)} 篇可用內文，已比對{' '}
            {number(data.index.analyzed)} 篇{data.index.pending > 0 ? `（尚待比對 ${number(data.index.pending)} 篇）` : ''}
            。每篇與前後 {data.index.windowDays} 天內其他媒體的全部文章比對，期間內共 {number(data.index.pairs)} 組相似配對、
            {number(data.index.groups)} 組同題報導、{number(data.index.citations)}{' '}
            則明示引用；相似配對只計入兩篇都在期間內刊登的組合。資料每 10 分鐘更新，配對永久保存。
          </p>
        ) : (
          <p role="status" className="text-zinc-500">
            暫時無法取得本期統計，請稍後
            <Link href={`/similarity/about/?${params}`} className={linkStyle}>
              重新載入
            </Link>
            。
          </p>
        )}
        <p>
          圖示大小依本期已比對的新聞篇數調整，不是網站流量或總發稿量；線條越粗代表關係文章越多。橘色箭頭由同組報導指向最早刊登的媒體，紫色箭頭指向文中明示引用的媒體。各媒體的篇數涵蓋本期全部關係，不隨篩選改變；圖上連線與文章只呈現目前篩選的媒體。媒體依連線強度自動分群，分群不代表立場或所有權。
        </p>
        <p>
          內文相近的報導連成同一組，全組最早刊登的一篇作為來源，其他文章都直接指向它。這是依刊登時間歸源的規則，不等於查證原創或抄襲；相近內文也可能來自通訊社稿或授權轉載。
        </p>
        <p>
          <span className="text-blue-700 dark:text-blue-400">藍字</span>／<span className="text-green-700 dark:text-green-400">綠字</span>
          沿用網站媒體資料的既有藍／綠標註，未標註者使用一般字色。
        </p>
        <h2 className="pt-2 text-base font-semibold">相似度如何計算</h2>
        <p>
          內文做 NFKC 正規化並移除標點、空白，以五字片段計算 Dice 相似度。至少 200 個字元、100
          個共同片段及連續相同文字才列為候選。正規化全文相等才標為內文相同；相似度不使用標題或刊登時間；完成分組後才以最早刊登時間指定同組來源。目前門檻為{' '}
          {threshold}，可在關係圖的「進階」調整。
        </p>
      </section>
      {data && <CoverageTable rows={data.coverage} />}
    </div>
  );
}

const cell = 'px-3 py-1.5 text-right tabular-nums';
const count = (value: number) => <span className={value ? '' : 'text-zinc-300 dark:text-zinc-700'}>{number(value)}</span>;

function CoverageTable({ rows }: { rows: SimilarityData['coverage'] }) {
  const sum = (key: 'total' | 'usable' | 'indexed' | 'missing' | 'pending') =>
    rows.filter((row) => !row.excludedFromStatistics).reduce((total, row) => total + row[key], 0);
  return (
    <section className="max-w-4xl space-y-2" aria-labelledby="coverage-title">
      <h2 id="coverage-title" className="text-base font-semibold">
        各媒體擷取狀態
      </h2>
      <p className="text-xs text-zinc-500">
        可比較是取得完整內文、長度足以比對的文章；缺漏是抓取失敗或內文過短，待抓是尚未處理。蕃新聞的聯播內容不納入統計。
      </p>
      <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-800">
        <table className="w-full whitespace-nowrap text-xs">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                媒體
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                本期文章
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                可比較
              </th>
              <th scope="col" className="w-40 px-3 py-2 text-left font-medium">
                可比較比例
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                已比對
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                缺漏
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                待抓
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row) => {
              const share = row.total ? row.usable / row.total : 0;
              return (
                <tr
                  key={row.media}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${row.excludedFromStatistics ? 'text-zinc-400' : ''}`}
                >
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <MediaHoverLink media={row.media} className={linkStyle}>
                      {row.name}
                    </MediaHoverLink>
                    {row.excludedFromStatistics && (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">排除統計</span>
                    )}
                  </th>
                  <td className={cell}>{count(row.total)}</td>
                  <td className={cell}>{count(row.usable)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
                        <div
                          className={`h-full rounded-full ${share < 0.8 ? 'bg-amber-500' : 'bg-brand-600 dark:bg-brand-500'}`}
                          style={{ width: `${Math.round(share * 100)}%` }}
                        />
                      </div>
                      <span
                        className={`w-9 text-right tabular-nums ${share < 0.8 && row.total ? 'text-amber-700 dark:text-amber-400' : ''}`}
                      >
                        {row.total ? `${Math.round(share * 100)}%` : '—'}
                      </span>
                    </div>
                  </td>
                  <td className={cell}>{count(row.indexed)}</td>
                  <td className={cell}>{count(row.missing)}</td>
                  <td className={cell}>{count(row.pending)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-zinc-300 bg-zinc-50 font-medium dark:border-zinc-700 dark:bg-zinc-950">
            <tr>
              <th scope="row" className="px-3 py-2 text-left font-medium">
                合計（不含排除統計）
              </th>
              <td className={cell}>{number(sum('total'))}</td>
              <td className={cell}>{number(sum('usable'))}</td>
              <td className="px-3 py-2 tabular-nums">{sum('total') ? `${Math.round((sum('usable') / sum('total')) * 100)}%` : '—'}</td>
              <td className={cell}>{number(sum('indexed'))}</td>
              <td className={cell}>{number(sum('missing'))}</td>
              <td className={cell}>{number(sum('pending'))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
