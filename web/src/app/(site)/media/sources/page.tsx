import Link from 'next/link';
import MediaTabs from '@/components/MediaTabs';
import { API_ORIGIN } from '@/lib/api';
import {
  monthLabel,
  referenceFor,
  selectTrafficSources,
  type TrafficSort,
  trafficGrowth,
  trafficNumber,
  trafficSorts,
} from '@/lib/media-traffic.mts';
import catalog from '../../../../../../app/data/media-catalog.json';
import traffic from '../../../../../../app/data/media-traffic.json';
import baseline from '../../../../../../app/data/traffic-baseline.json';

export const metadata = {
  title: '媒體來源與流量',
  description: '依人工整理的來源試算表，查看各月份新聞媒體流量、原始分類及本站採用的分類依據。',
};

type Params = { month?: string; scope?: string; classification?: string; q?: string; sort?: string; dir?: string };
type RawParams = { [Key in keyof Params]?: string | string[] };
type MediaStatus = { media: string; status: 'ok' | 'stale' | 'failing' | 'disabled'; last24h: number };
const statusLabels = { ok: '近期有更新', stale: '無近期文章', failing: '抓取失敗', disabled: '停用' };
const sortLabels = { traffic: '流量', growth: '月增減', name: '媒體', rank: '原表名次' };
const fieldClass = 'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';
const linkClass = 'underline decoration-zinc-400 underline-offset-4 hover:decoration-current';
const barColors: Record<string, string> = { 藍: 'bg-blue-500', 綠: 'bg-emerald-600' };

async function collectionStatus() {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/media-stats`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return (await response.json()) as { generatedAt: string; media: MediaStatus[] };
  } catch {
    return null;
  }
}

export default async function MediaSourcesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params: Params = Object.fromEntries(
    Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const snapshot = traffic.snapshots.find((item) => item.month === params.month) ?? traffic.snapshots[0];
  const scope = params.scope === 'all' ? 'all' : 'reference';
  const classification = params.classification ?? '';
  const query = params.q ?? '';
  const sort: TrafficSort = trafficSorts.includes(params.sort as TrafficSort) ? (params.sort as TrafficSort) : 'traffic';
  const ascending = params.dir === 'asc';
  const rows = selectTrafficSources(snapshot.sources, baseline.sources, { scope, classification, query, sort, ascending });
  const chartRows = [...rows]
    .filter((row) => row.traffic != null)
    .sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0))
    .slice(0, 10);
  const maximum = Math.max(1, ...chartRows.map((row) => row.traffic ?? 0));
  const classifications = [...new Set(snapshot.sources.map((row) => row.classification ?? '未標記'))].sort();
  const status = await collectionStatus();
  const statuses = new Map(status?.media.map((row) => [row.media, row]));
  const updated = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium' }).format(new Date(traffic.retrievedAt));
  const currentCamp = (media: string) =>
    catalog.categories.blue.includes(media) ? '藍營傾向' : catalog.categories.green.includes(media) ? '綠營傾向' : '未列藍綠';
  const sourceLink = (row: number) =>
    `${traffic.sourceUrl}#range=${encodeURIComponent(`'${snapshot.month}'!A${row}:${snapshot.trafficColumn}${row}`)}`;
  const sortLink = (key: TrafficSort) => {
    const next = new URLSearchParams({ month: snapshot.month, scope, classification, q: query, sort: key });
    next.set('dir', sort === key ? (ascending ? 'desc' : 'asc') : key === 'name' || key === 'rank' ? 'asc' : 'desc');
    return `/media/sources/?${next}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <MediaTabs current="sources" />
        <p className="mb-2 text-xs tracking-widest text-zinc-500">資料來源 · 分類依據</p>
        <h1 className="text-3xl font-semibold tracking-tight">媒體來源與流量</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-400">
          查看人工整理的 Similarweb 流量與媒體分類。流量依來源試算表呈現；藍綠是表內人工分類，不是 Similarweb 的政治傾向評分。
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
          <span>本站匯入：{updated}</span>
          <a href={traffic.sourceUrl} className={linkClass} target="_blank" rel="noreferrer">
            開啟原始試算表 ↗
          </a>
          <a href="#classification-method" className={linkClass}>
            分類與資料說明
          </a>
        </div>
      </div>

      <form
        action="/media/sources/"
        method="get"
        className="grid gap-4 rounded-xl border border-zinc-300 bg-zinc-50 p-5 sm:grid-cols-2 lg:grid-cols-5 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <div>
          <label htmlFor="traffic-month" className="text-xs font-medium">
            資料月份
          </label>
          <select id="traffic-month" name="month" defaultValue={snapshot.month} className={fieldClass}>
            {traffic.snapshots.map((item) => (
              <option key={item.month} value={item.month}>
                {monthLabel(item.month)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="traffic-scope" className="text-xs font-medium">
            比較範圍
          </label>
          <select id="traffic-scope" name="scope" defaultValue={scope} className={fieldClass}>
            <option value="reference">本站基準 29 家</option>
            <option value="all">原表全部新聞來源</option>
          </select>
        </div>
        <div>
          <label htmlFor="traffic-classification" className="text-xs font-medium">
            原表分類
          </label>
          <select id="traffic-classification" name="classification" defaultValue={classification} className={fieldClass}>
            <option value="">全部分類</option>
            {classifications.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="traffic-query" className="text-xs font-medium">
            搜尋媒體或網域
          </label>
          <input id="traffic-query" name="q" type="search" defaultValue={query} placeholder="例如：UDN、udn.com" className={fieldClass} />
        </div>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={ascending ? 'asc' : 'desc'} />
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            套用
          </button>
          <Link href="/media/sources/" className="py-2 text-sm text-zinc-500 underline underline-offset-4">
            重設
          </Link>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: '資料月份', value: monthLabel(snapshot.month), note: `原始工作表：${snapshot.month}` },
          {
            label: '目前篩選',
            value: `${rows.length} 家`,
            note: scope === 'reference' ? '固定以目前 29 家名單對照歷月資料' : '原表主題欄包含「新聞」的來源',
          },
          { label: '有流量數值', value: `${rows.filter((row) => row.traffic != null).length} 家`, note: '缺值顯示 —，不以零補值' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-700">
            <p className="text-xs text-zinc-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</p>
            <p className="mt-2 text-xs text-zinc-500">{item.note}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="traffic-chart-heading" className="rounded-xl border border-zinc-300 p-5 sm:p-6 dark:border-zinc-700">
        <h2 id="traffic-chart-heading" className="text-lg font-semibold">
          {monthLabel(snapshot.month)} · 流量比較
        </h2>
        <p className="mt-2 text-xs leading-6 text-zinc-500">
          目前篩選中流量最高的 {chartRows.length} 家。單位：原表數值（來源欄位未註明單位）；長條不代表市占率。
        </p>
        {chartRows.length ? (
          <ol className="mt-5 space-y-3">
            {chartRows.map((row) => (
              <li
                key={row.row}
                className="grid grid-cols-[7rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-xs sm:grid-cols-[10rem_minmax(0,1fr)_7rem] sm:text-sm"
              >
                <span className="truncate" title={row.name}>
                  {row.name}
                  <span className="ml-1 text-xs text-zinc-500">{row.classification ?? '未標記'}</span>
                </span>
                <div className="h-3 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
                  <div
                    className={`h-full rounded-sm ${barColors[row.classification ?? ''] ?? 'bg-zinc-400'}`}
                    style={{ width: `${Math.max(0, ((row.traffic ?? 0) / maximum) * 100)}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">{trafficNumber(row.traffic)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-8 text-sm text-zinc-500">目前條件沒有可比較的流量數值。</p>
        )}
      </section>

      <section aria-labelledby="traffic-table-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="traffic-table-heading" className="text-lg font-semibold">
            來源明細 <span className="text-sm font-normal text-zinc-500">{rows.length} 家</span>
          </h2>
          <p className="text-xs text-zinc-500">點欄位名稱排序；本站分類與收錄狀態為目前設定。</p>
        </div>
        <p className="mb-3 text-xs text-zinc-500 sm:hidden">左右滑動表格，可查看流量、本站分類與收錄狀態。</p>
        {!status && (
          <p role="status" className="mb-3 text-sm text-amber-700 dark:text-amber-400">
            目前無法取得即時收錄狀態，來源與流量資料仍可查看。
          </p>
        )}
        <section
          className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-700"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus and scroll the table on narrow screens.
          tabIndex={0}
          aria-label="媒體來源明細，可左右捲動"
        >
          <table className="w-full min-w-[960px] text-left text-sm">
            <caption className="sr-only">{monthLabel(snapshot.month)} 媒體來源、流量及分類依據</caption>
            <thead className="bg-zinc-50 text-xs dark:bg-zinc-900">
              <tr>
                {(['rank', 'name'] as const).map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className="px-4 py-3"
                    aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}
                  >
                    <Link href={sortLink(key)}>
                      {sortLabels[key]} {sort === key ? (ascending ? '↑' : '↓') : '↕'}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3">
                  原表分類
                </th>
                {(['traffic', 'growth'] as const).map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className="px-4 py-3 text-right"
                    aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}
                  >
                    <Link href={sortLink(key)}>
                      {sortLabels[key]} {sort === key ? (ascending ? '↑' : '↓') : '↕'}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3">
                  本站目前分類
                </th>
                <th scope="col" className="px-4 py-3">
                  本站收錄狀態
                </th>
                <th scope="col" className="px-4 py-3">
                  來源與註記
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => {
                const reference = referenceFor(row, baseline.sources);
                const media = reference ? statuses.get(reference.media) : null;
                return (
                  <tr key={row.row} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-4 tabular-nums text-zinc-500">{trafficNumber(row.rank)}</td>
                    <th scope="row" className="px-4 py-4 font-medium">
                      {reference ? (
                        <Link href={`/media/${reference.media}/`} className={linkClass}>
                          {row.name}
                        </Link>
                      ) : (
                        row.name
                      )}
                      <div className="mt-1 text-xs font-normal text-zinc-500">{row.domain ?? '原表未填網域'}</div>
                    </th>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded px-2 py-1 text-xs ${row.classification === '藍' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : row.classification === '綠' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                      >
                        {row.classification ?? '未標記'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{trafficNumber(row.traffic)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{trafficGrowth(row.growth)}</td>
                    <td className="px-4 py-4 text-xs">
                      {reference ? (
                        <>
                          {currentCamp(reference.media)}
                          <div className="mt-1 text-zinc-500">依 {baseline.retrievedAt} 採用的試算表分類</div>
                        </>
                      ) : (
                        '未對應本站來源'
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      {media ? (
                        <>
                          {statusLabels[media.status]}
                          <div className="mt-1 text-zinc-500">近 24 小時 {media.last24h.toLocaleString('zh-TW')} 篇</div>
                        </>
                      ) : reference ? (
                        status ? (
                          '未列入收錄清單'
                        ) : (
                          '暫無法取得'
                        )
                      ) : (
                        '未對應本站來源'
                      )}
                    </td>
                    <td className="max-w-52 px-4 py-4 text-xs">
                      <a href={sourceLink(row.row)} className={linkClass} target="_blank" rel="noreferrer">
                        原表第 {row.row} 列 ↗
                      </a>
                      {row.notes.length > 0 && (
                        <details className="mt-2 text-zinc-500">
                          <summary className="cursor-pointer">原表註記</summary>
                          <ul className="mt-2 space-y-2 break-words">
                            {row.notes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    沒有符合條件的來源，請調整分類或搜尋字詞。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        {status && (
          <p className="mt-2 text-xs text-zinc-500">
            收錄狀態更新：
            {new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short' }).format(
              new Date(status.generatedAt),
            )}
            （台北時間）
          </p>
        )}
      </section>

      <section
        id="classification-method"
        className="space-y-4 border-t border-zinc-300 pt-6 text-sm leading-7 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">分類與資料說明</h2>
        <p>
          流量來自人工整理的 Similarweb
          來源試算表；「藍」「綠」「多元」「內容」等標記是表內人工分類。「多元」不等於中立；「內容」不代表內容農場。本站分類以媒體為單位，不判斷單篇新聞立場。
        </p>
        <p>
          本站於 {baseline.retrievedAt} 依試算表更新基準名單的 {baseline.sources.length}{' '}
          家媒體；其餘媒體沿用既有設定。「未列藍綠」不代表中立。歷月原表分類與本站目前分類分欄呈現，切換月份不會改變全站採用的分類。
        </p>
        <p>
          第一版收錄 2026 年 1–8 月的新聞來源。原表的空白、公式錯誤與未提供數值都顯示為
          —；月增減沿用原表「成長」欄。原表名次不會因本站篩選而重排。未對應本站來源只表示尚未建立對照，不代表本站沒有收錄。
        </p>
        <p>
          流量保留原表結果，部分列含人工倍數調整，請展開「原表註記」查看。原表「流量」欄未明示單位，因此本頁不推定為人數或瀏覽次數。網域、子網域與新聞平台可能重疊，數值不可直接視為全台市占或去重訪客。
        </p>
        <p>
          「本站基準 29 家」是比較名單，並非 29
          家都已收錄。爬蟲流量覆蓋率另有固定範圍、精度與排除規則；本頁呈現試算表原始精度，不更換既有覆蓋率分母。試算表由人工維護，本站經匯入與核對後更新快照，並非即時同步。
        </p>
      </section>
    </div>
  );
}
