import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { fetchSimilarity, periodQuery, type SimilarityData } from '@/lib/similarity';
import { table } from '@/lib/table-styles';
import { number, periodLabel, taipei } from '../format';
import { type SimilarityQuery, similarityPeriod, similarityThreshold } from '../query';
import SimilarityTabs from '../SimilarityTabs';

export const metadata = { title: '資料說明 · 新聞關係圖', description: '新聞關係圖的資料範圍、歸源規則、相似度計算與各媒體擷取狀態。' };

const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';

export default async function SimilarityAboutPage({
  searchParams,
}: {
  searchParams: Promise<SimilarityQuery & { sort?: string; dir?: string }>;
}) {
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
      {data && <CoverageTable rows={data.coverage} params={params} sort={query.sort} dir={query.dir} />}
    </div>
  );
}

type CoverageRow = SimilarityData['coverage'][number];
const share = (row: CoverageRow) => (row.total ? row.usable / row.total : -1);
// Every column header sorts, as on /media: numbers start descending, the name ascending.
const collator = new Intl.Collator('zh-Hant-TW-u-co-stroke');
const SORTS = {
  name: (row: CoverageRow) => row.name,
  total: (row: CoverageRow) => row.total,
  usable: (row: CoverageRow) => row.usable,
  share,
  indexed: (row: CoverageRow) => row.indexed,
  missing: (row: CoverageRow) => row.missing,
  pending: (row: CoverageRow) => row.pending,
} satisfies Record<string, (row: CoverageRow) => number | string>;
type SortKey = keyof typeof SORTS;
const cell = table.num;
const count = (value: number) => <span className={value ? '' : 'text-zinc-400 dark:text-zinc-600'}>{number(value)}</span>;
const percent = (value: number) => (value < 0 ? '—' : `${Math.round(value * 100)}%`);

function CoverageTable({ rows, params, sort: rawSort, dir: rawDir }: { rows: CoverageRow[]; params: string; sort?: string; dir?: string }) {
  const sort: SortKey = rawSort && rawSort in SORTS ? (rawSort as SortKey) : 'total';
  const dir = rawDir === 'asc' || rawDir === 'desc' ? rawDir : sort === 'name' ? 'asc' : 'desc';
  const sorted = [...rows].sort((a, b) => {
    const x = SORTS[sort](a),
      y = SORTS[sort](b);
    const order = typeof x === 'string' ? collator.compare(x, y as string) : x - (y as number);
    return (dir === 'asc' ? order : -order) || b.total - a.total || collator.compare(a.name, b.name);
  });
  const counted = rows.filter((row) => !row.excludedFromStatistics);
  const sum = (key: 'total' | 'usable' | 'indexed' | 'missing' | 'pending') => counted.reduce((total, row) => total + row[key], 0);
  const sortLink = (col: SortKey) => {
    const next = new URLSearchParams(params);
    const nextDir = sort === col ? (dir === 'asc' ? 'desc' : 'asc') : col === 'name' ? 'asc' : 'desc';
    if (col !== 'total' || nextDir !== 'desc') {
      next.set('sort', col);
      next.set('dir', nextDir);
    }
    return `/similarity/about/?${next}#coverage-title`;
  };
  const Th = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th className={`${table.cell} ${className}`} aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link
        href={sortLink(col)}
        scroll={false}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-brand-700 ${sort === col ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <SortIndicator active={sort === col} descending={dir === 'desc'} />
      </Link>
    </th>
  );
  return (
    <section className="space-y-3" aria-labelledby="coverage-title">
      <div>
        <h2 id="coverage-title" className="scroll-mt-20 text-base font-semibold">
          各媒體擷取狀態
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          可比較是取得完整內文、長度足以比對的文章；缺漏是抓取失敗或內文過短，待抓是尚未處理。蕃新聞的聯播內容不納入統計。點欄名可排序。
        </p>
      </div>
      <TableScroller card label="各媒體擷取狀態表格，可左右捲動">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-950">
            <tr>
              <Th col="name" label="媒體" className={table.leadHead} />
              <Th col="total" label="本期文章" className="text-right" />
              <Th col="usable" label="可比較" className="text-right" />
              <Th col="share" label="可比較比例" className="w-[28%] min-w-40" />
              <Th col="indexed" label="已比對" className="text-right" />
              <Th col="missing" label="缺漏" className="text-right" />
              <Th col="pending" label="待抓" className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sorted.map((row) => {
              const value = share(row);
              const low = value >= 0 && value < 0.8;
              return (
                <tr key={row.media} className={`${table.row} ${row.excludedFromStatistics ? 'text-zinc-500' : ''}`}>
                  <td className={table.lead}>
                    <MediaHoverLink
                      media={row.media}
                      icon={false}
                      title={row.name}
                      className={`${table.leadBox} flex flex-wrap items-center gap-x-2 gap-y-1 font-medium hover:underline`}
                    >
                      <span className="flex min-w-0 max-w-full items-center gap-2">
                        <MediaIcon media={row.media} size={16} />
                        <span className={table.leadText}>{row.name}</span>
                      </span>
                      {row.excludedFromStatistics && (
                        <span
                          className={`${table.leadExtra} shrink-0 whitespace-nowrap rounded bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700`}
                        >
                          排除統計
                        </span>
                      )}
                    </MediaHoverLink>
                  </td>
                  <td className={cell}>{count(row.total)}</td>
                  <td className={cell}>{count(row.usable)}</td>
                  <td className={table.cell} title={`${row.name}：可比較 ${number(row.usable)}／${number(row.total)} 篇`}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1" aria-hidden>
                        {value > 0 && (
                          <div
                            className={`h-2 rounded-r ${low ? 'bg-amber-500' : 'bg-brand-700 dark:bg-brand-600'}`}
                            style={{ width: `${Math.max(1.5, value * 100)}%` }}
                          />
                        )}
                      </div>
                      <span className={`w-11 text-right tabular-nums ${low ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                        {percent(value)}
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
              <th scope="row" className={`${table.leadHead} text-left font-medium`}>
                <div className={`${table.leadBox} truncate`} title="合計（不含排除統計）">
                  合計（不含排除統計）
                </div>
              </th>
              <td className={cell}>{number(sum('total'))}</td>
              <td className={cell}>{number(sum('usable'))}</td>
              <td className={table.num}>{percent(sum('total') ? sum('usable') / sum('total') : -1)}</td>
              <td className={cell}>{number(sum('indexed'))}</td>
              <td className={cell}>{number(sum('missing'))}</td>
              <td className={cell}>{number(sum('pending'))}</td>
            </tr>
          </tfoot>
        </table>
      </TableScroller>
    </section>
  );
}
