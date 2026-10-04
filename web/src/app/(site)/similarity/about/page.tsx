import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import MethodLink from '@/components/MethodLink';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { pageMetadata } from '@/lib/seo';
import { fetchSimilarity, periodQuery, type SimilarityData } from '@/lib/similarity';
import { table } from '@/lib/table-styles';
import { number, periodLabel, taipei } from '../format';
import { type SimilarityQuery, similarityPeriod, similarityThreshold } from '../query';
import SimilarityTabs from '../SimilarityTabs';

export const metadata = pageMetadata(
  '/similarity/about/',
  '內文擷取狀態',
  '查看新聞內文的擷取與比對狀態，了解相似度分析的資料涵蓋、更新情況與限制。',
);

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
          <h1 className="text-2xl font-semibold tracking-tight">擷取狀態</h1>
          {data ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {periodLabel(data)} · 更新於 {taipei(data.generatedAt)}（台北） · <MethodLink />
            </p>
          ) : (
            <p role="status" className="mt-1 text-sm text-zinc-500">
              暫時無法取得本期統計，請稍後
              <Link href={`/similarity/about/?${params}`} className={linkStyle}>
                重新載入
              </Link>
              。
            </p>
          )}
        </div>
      </header>
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
        <p className="mt-1 text-xs text-zinc-600">點欄名可排序。</p>
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
