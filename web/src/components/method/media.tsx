import Link from 'next/link';
import { type ComparisonData, shortMonth, sourceStatusLabels } from '@/lib/traffic-comparison.mts';
import { CampBasis } from './events';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 媒體 (/media/), one outlet (/media/[media]/), Similar Web (/media/sources/)
// and 爬蟲資訊 (/media/crawlers/). Statuses and counts come from
// app/src/v1/media-stats.ts (stale after 6 h for news, 24 h otherwise; failing
// when every index run of the last 3 h failed); news outlets are crawled every
// 9 minutes, the rest hourly. The outlet page asks the similarity index for the
// cloud's period at 0.65 (media/[media]/page.tsx). Monthly counts for Similar
// Web: app/src/v1/media-traffic-comparison.ts and lib/traffic-comparison.mts.

/** 收錄概況 (/media/). `camp: false` leaves out the camp basis where another block already states it. */
export function MediaOverviewMethod({ camp = true }: { camp?: boolean }) {
  return (
    <>
      <h3 className={methodHeading}>媒體與文章數</h3>
      <p>
        「收錄概況」列出所有已登錄媒體與文章發現來源，包含尚未啟用抓取與僅作為引用來源的媒體；新聞類媒體每 9
        分鐘、其他媒體每小時抓取一次，每輪從最久沒抓的媒體開始，剛抓過的先跳過。「今日」從台北時間 00:00
        起算。文章數以發布時間計；列表沒有提供發布時間的文章，會在抓取內文後才計入，在那之前列為「發布時間待確認」。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>國家／地區</dt>
        <dd>依媒體營運或在地發行版本標示，不是新聞發生地或母公司國籍；跨國團隊與待確認項目另行標示。</dd>
        <dt className={methodTerm}>發現來源</dt>
        <dd>「發現來源」的篇數是經該平台發現的原媒體文章；上方全站文章總數、有發稿的媒體與有標籤的文章只按原媒體計算，不重複加總。</dd>
        <dt className={methodTerm}>24 小時</dt>
        <dd>長條以目前列表中 24 小時篇數最多的媒體為滿格。</dd>
        <dt className={methodTerm}>7 天</dt>
        <dd>7 天欄下方註明「M/D 起抓取」的媒體，是新系統開始抓它還不滿一週，數字只涵蓋那幾天，不能和其他媒體直接比較。</dd>
        <dt className={methodTerm}>標籤率</dt>
        <dd>24 小時內的文章中帶有標籤的比例。</dd>
        <dt className={methodTerm}>狀態</dt>
        <dd>
          正常＝最近有新文章；無近期文章＝新聞類 6 小時、其他 24 小時內沒有新文章（來源可能暫停發稿）；抓取失敗＝近 3
          小時的抓取全部失敗；未啟用＝尚未啟用定期抓取、已停用或僅作為引用來源。各媒體頁標頭的狀態依同一規則，寫作持續收錄、近期無新文章、暫時無法更新、已停止收錄。
        </dd>
        <dt className={methodTerm}>藍綠</dt>
        <dd>「偏藍」「偏綠」標示與「藍營傾向」「綠營傾向」篩選，和首頁新聞量、事件頁的藍綠對照用同一份分類。</dd>
      </dl>
      {camp && <CampBasis />}
    </>
  );
}

/** One outlet's page (/media/[media]/). */
export function MediaMethod() {
  return (
    <>
      <h3 className={methodHeading}>媒體頁</h3>
      <p>
        各媒體頁的收錄量為本站抓取的報導，非媒體全部發稿量；標頭的今日收錄、近 24 小時、近 7
        天與狀態，和「收錄概況」依同一規則計算。「報導關鍵字」統計期間內文章的標籤與標題關鍵詞，排除新聞分類詞，每篇每詞計一次，最多取最新
        2,000 篇；字越大，出現在越多篇報導。「媒體關係」取自新聞關係圖同一期間的比對結果（相似度門檻
        0.65），依文章去重計數：同組指直接比對的內文相近報導，不以刊登先後推定來源；引用指內文明示引用的媒體。沒有列出關係，不代表沒有相關新聞，只是比對未達門檻。報導關鍵字與媒體關係依文章列表選的期間計算，選「全部」時為近
        7 天。
      </p>
      <p>Google 新聞、動態網等發現來源的頁面，列出經該來源發現的文章，依原始刊登媒體收錄；點選標題可在本站閱讀，刊登時間保留原文日期。</p>
    </>
  );
}

/** What the footer states about each source's latest fetch; omitted where the page data is unavailable. */
export type MediaSourcesStatus = Pick<
  ComparisonData,
  | 'crawlMonths'
  | 'trafficMonths'
  | 'referenceMonths'
  | 'liveTrafficStatus'
  | 'liveTrafficCheckedAt'
  | 'liveTrafficError'
  | 'radarStatus'
  | 'radarCheckedAt'
  | 'radarError'
>;

const httpCode = (error: string | null) => error?.match(/HTTP \d+/)?.[0];
function fetchState(status: keyof typeof sourceStatusLabels | null, checkedAt: string | null, error: string | null) {
  const code = httpCode(error);
  return `${status ? sourceStatusLabels[status] : '尚未抓取'}${code ? `（${code}）` : ''}${checkedAt ? `，最近檢查 ${checkedAt.slice(0, 10)}` : ''}${
    status && !['ok', 'pending'].includes(status) ? '；已有數值保留上次成功資料' : ''
  }。`;
}
const recent = (months: string[]) => months.slice(-3).map(shortMonth).join('、');

/** Similar Web (/media/sources/). `retrievedAt` comes from the traffic sheet's
 *  import (app/data/media-traffic.json) and `status` from the page's own load,
 *  both passed in by the server so the client-side footer never bundles them. */
export function MediaSourcesMethod({
  retrievedAt,
  status,
  camp = true,
}: {
  retrievedAt?: string;
  status?: MediaSourcesStatus | null;
  camp?: boolean;
}) {
  const crawlMonth = status?.crawlMonths.at(-1);
  return (
    <>
      <h3 className={methodHeading}>媒體流量、排名與收錄比較</h3>
      <p>
        這一頁把本站收錄篇數、Similarweb 自動抓取、Cloudflare Radar 與 GeneHong
        整理表分欄並列；各來源的數值與期間分別保留、分別排序，不合計，皆非精確 page
        views。流量與篇數是不同指標，不能推算成每篇文章的實際閱讀量。
      </p>
      {status && (
        <dl className={methodList}>
          <dt className={methodTerm}>目前狀態</dt>
          <dd>
            <ul className="space-y-1">
              <li>
                Similarweb：{fetchState(status.liveTrafficStatus, status.liveTrafficCheckedAt, status.liveTrafficError)}
                {status.trafficMonths.length ? `最新三個月為 ${recent(status.trafficMonths)}。` : '目前尚未取得流量數字。'}
              </li>
              <li>Cloudflare Radar：{fetchState(status.radarStatus, status.radarCheckedAt, status.radarError)}</li>
              <li>
                GeneHong 整理表：{recent(status.referenceMonths) || '尚無資料'}
                {retrievedAt ? `，匯入日期 ${retrievedAt.slice(0, 10)}` : ''}。
              </li>
              <li>本站收錄：{crawlMonth ? `表格顯示 ${shortMonth(crawlMonth)} 篇數。` : '目前無法取得本站收錄量。'}</li>
            </ul>
          </dd>
        </dl>
      )}
      <dl className={methodList}>
        <dt className={methodTerm}>Similarweb</dt>
        <dd>
          直接抓取 Similarweb 外掛端點的 EstimatedMonthlyVisits，呈現最近三個可取得月份的全網域估算訪問次數，並非即時資料或精確 page
          views。欄內數字是選定月份，下方走勢線是最近三個月（左舊右新），游標移到點上或手機點一下顯示該月數值；切換「月變化」改顯示較上一個月的增減百分比，排序也依此計算。Similarweb
          與 Radar 都只量整個網域：多個媒體共用同一網域時（例如 BBC 中文與
          BBC），數字只列在網址位於網站根目錄的媒體，其他列顯示「—」。每小時分批更新，每個網域約每週重抓；來源限流時停止該批，下一輪接著抓。
        </dd>
        <dt className={methodTerm}>Cloudflare Radar</dt>
        <dd>
          透過官方 API 取得全球熱門網域的最新一期排名，主要依 Cloudflare 1.1.1.1 DNS 的觀測訊號，每日更新。前 100
          名可有精確名次，其餘只有「前 N 名」級距，數字越小越熱門；同級距無法判定先後，排序時以名次或級距上限比較，同級距視為同名。「未入前
          N 名」表示排在該名次之後。排名不是訪問次數、瀏覽量或全台市占，不能換算為 visits 或 page views。欄內保留 API
          資料期間與最近成功更新日期；未設定 API Token 時明確顯示未設定。
        </dd>
        <dt className={methodTerm}>GeneHong</dt>
        <dd>
          保留人工整理表原始值與網域，可另選月份。原表沒有寫單位；2026 年 10 月逐筆比對，2026/07、2026/08 的值就是 Similarweb
          估算月訪問量以百萬為單位、取到小數兩三位，人工調整列除外，更早月份 Similarweb
          已不提供，無法比對。人工調整值的儲存格標「*」，游標移上去可看原值，不當成實際流量或零；同一媒體有多列而無法判定主來源時同樣標「*」並註明待核對。品牌全站與新聞子頻道可能重疊，採主來源，不相加。
        </dd>
        <dt className={methodTerm}>本站收錄</dt>
        <dd>
          依真實發布月份（台北時間）統計目前已收錄紀錄，並非該媒體完整發稿量；表格顯示最近一個月的篇數。本月資料持續累積中，抓取也可能不完整。發現來源以關聯計數，不改文章的原媒體歸屬。
        </dd>
        <dt className={methodTerm}>缺值與失敗</dt>
        <dd>缺值不補零，顯示「—」。自動來源抓取失敗時保留各來源上次成功資料與日期，不用整理表補值。</dd>
      </dl>
      <p>原始整理表另有人工標記的分類欄，本站基準名單媒體的藍綠即依此標記（見下）；這不是 Similarweb 的政治傾向評分，本頁也不呈現分類。</p>
      {camp && <CampBasis />}
    </>
  );
}

/** 爬蟲資訊 (/media/crawlers/). */
export function CrawlerMethod() {
  return (
    <>
      <h3 className={methodHeading}>爬蟲資訊</h3>
      <p>
        「爬蟲資訊」列出各媒體的抓取方式、下載工具與程式碼；收錄篇數見
        <Link href="/media/" className={inlineLink}>
          收錄概況
        </Link>
        。新聞類媒體每 9
        分鐘、其他媒體每小時抓取一次；每輪依上次抓取時間由舊到新排序，距上次不到週期八成的媒體跳過，所以抓取中斷後下一輪會接著沒輪到的媒體繼續。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>抓取方式</dt>
        <dd>
          HTML 解析是下載網頁後擷取內容；JSON 是讀取公開結構化資料。自動探索會依站點選用 RSS、Sitemap 或
          HTML；最近驗證方式不代表每次都採用相同路徑。標籤提示保留完整抓取說明與最近驗證方式。
        </dd>
        <dt className={methodTerm}>內容</dt>
        <dd>正文擷取仍需逐篇驗證；標題、摘要與影片資料依來源提供，並非每篇皆具備。</dd>
        <dt className={methodTerm}>議題／專題</dt>
        <dd>
          列出各家官方入口：議題是持續新增報導的新聞串，專題是一次性的新聞包；各家用詞不一，入口未宣告類型時（自動判定）依報導是否持續增加來分類。數字是累計收錄的議題與專題數；綠點表示最近一次檢查正常，橘點表示有入口未能更新，展開可看各入口的結果。
        </dd>
      </dl>
    </>
  );
}
