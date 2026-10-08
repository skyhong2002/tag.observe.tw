import Link from 'next/link';
import { CampBasis } from './events';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 關鍵字排行 (/ranking/) and one keyword (/tag/[tag]/). The ranking job runs
// every 10 minutes (app/src/worker.ts); scores and 爆發力 are in
// app/src/jobs/ranking-compute.ts; the tag page's chart is the 所有媒體 basis
// (/api/v1/tags/:tag/series, app/src/v1/tag-series.ts), its status panel the
// 新聞媒體 ranking by 爆發力 (app/src/v1/tag-status.ts), 首次上榜／高峰 the
// hourly tag-stats job at :53 (app/src/jobs/tag-stats-job.ts), and the list the
// newest 80 articles of any outlet (web/src/lib/api.ts fetchTagArticles).

export function RankingMethod() {
  return (
    <>
      <h3 className={methodHeading}>關鍵字排行的指標</h3>
      <p>每 10 分鐘以過去 24 小時的文章重算一次。</p>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
        <dt className={methodTerm}>篇數</dt>
        <dd>過去 24 小時帶有這個標籤的文章數。</dd>
        <dt className={methodTerm}>媒體</dt>
        <dd>過去 24 小時用過這個標籤的媒體家數。</dd>
        <dt className={methodTerm}>分數</dt>
        <dd>
          同一家媒體的第 1 篇記 1 分，第 2、3、4 篇依序記 0.5、0.25、0.125
          分（避免單一媒體洗版）；各媒體加總後，除以固定基準名單的媒體數，再乘以
          50。名單內未發稿的媒體也保留在分母；新來源待下一版基準才納入。分數 50 大約等於「基準內每家媒體都報了一篇」。
        </dd>
        <dt className={methodTerm}>爆發力</dt>
        <dd>
          分數＋Σ（現在分數 − N 小時前分數）× 權重；N 為 3、6、12、24、48 小時，權重依序
          0.92、0.84、0.70、0.50、0.25，前後使用同一媒體基準。缺少可比較歷史或舊榜截斷而無法確認分數時顯示「—」，不當成零；持平的話題約等於分數，退燒中的話題會低於分數。排行榜與關鍵字頁上爆發力高於分數時以橘字標示。
        </dd>
        <dt className={methodTerm}>變動</dt>
        <dd>
          依分數的名次與 24 小時前同一基準的快照相比：▲ 為上升、▼ 為下降、＝ 持平。「新」表示 24
          小時前的完整榜單裡沒有這個關鍵字；沒有可比較的快照、基準不同或舊榜截斷時顯示「—」。滑鼠停留在變動上可看兩個時間的名次。
        </dd>
        <dt className={methodTerm}>一起出現</dt>
        <dd>
          同一視窗、同一基準媒體中，和這個關鍵字最常掛在同一篇報導的其他關鍵字，依共同篇數排序取前五個，單行顯示放不下的會省略；滑鼠停留可看完整清單與共同篇數佔比。可用來判斷哪幾個關鍵字其實在講同一件事。
        </dd>
        <dt className={methodTerm}>文字雲</dt>
        <dd>
          排行榜上方的文字雲取目前分類分數最高的 500
          個關鍵字，依版面放得下的數量顯示（電腦約四百個、手機約一百五十個），字越大分數越高；橘字為爆發力高於分數、正在升溫的關鍵字。
        </dd>
        <dt className={methodTerm}>趨勢</dt>
        <dd>
          小圖以每小時等距顯示最近 48 小時新聞篇數的 24 小時移動平均：當小時及前 23 小時收錄篇數加總除以
          24。依「趨勢」排序時比較最新完整小時與 48
          小時前的平均值（篇／小時）；點關鍵字可看每小時篇數與平均線。爆發力仍依上面的加權分數計算。
        </dd>
      </dl>
    </>
  );
}

/** One keyword's page. `basisCount` comes from the page's own request
 *  (@notes/tag/[tag]); without it the text stays general. `camp:
 *  false` leaves out the camp basis where another block already states it. */
export function TagMethod({ basisCount, camp = true }: { basisCount?: number; camp?: boolean }) {
  return (
    <>
      <h3 className={methodHeading}>關鍵字頁</h3>
      <dl className={methodList}>
        <dt className={methodTerm}>排行狀態</dt>
        <dd>
          上方的數字取自
          <Link href="/ranking/?category=news" className={inlineLink}>
            新聞媒體排行榜
          </Link>
          的最新一版：「名次」是依爆發力排列的位置，「變動」則比較依分數的名次與 24 小時前（▲ 上升、▼ 下降、「新」為 24
          小時前不在榜上、「—」為沒有可比較的快照）；爆發力高於分數時以橘字標示。「報導媒體」是基準媒體中過去 24
          小時有報導的家數／基準家數。「一起出現」是同一批基準媒體過去 24 小時最常和這個關鍵字掛在同一篇報導的關鍵字，數字為共同篇數，最多 8
          個。
        </dd>
        <dt className={methodTerm}>首次上榜、高峰</dt>
        <dd>
          本站每小時 53 分統計一次新聞媒體過去 24 小時的標籤：至少 3 家報導、其中至少 2 家各報 2 篇以上、且有一家報 3
          篇以上的標籤列入統計（沒有達到時，改用至少 2 家各報 2
          篇以上的較寬標準）。「首次上榜」是這個關鍵字第一次列入統計的小時；「高峰」是列入統計的小時中，過去 24
          小時篇數最多的一小時，括號內為當時的 24 小時篇數。
        </dd>
        <dt className={methodTerm}>每小時篇數圖</dt>
        <dd>
          採「所有媒體」類別的固定基準媒體{basisCount ? `（${basisCount} 家，名單見下方）` : ''}
          ，期間依所選的 1、3、7 天。灰色長條是每小時篇數；「24 小時移動平均」＝當小時及前 23 小時基準媒體收錄篇數總和 ÷
          24，收錄開始後沒有報導的小時以 0
          計，開始前留白，只顯示完整小時。「名次」是這個關鍵字在「所有媒體」排行每小時快照中依分數的名次（右軸，第 1
          名在最上面，未入榜的小時留空）；「24 小時加權分數」是同一基準的分數，預設隱藏，點圖例可顯示。橫軸標示小時起點，歷史不足處留白。
          可在圖內左右拖曳、用觸控板水平滑動，或拖動下方時間滑桿；往前查閱至左側時，會依所選的 1、3、7 天分段載入更早資料並保留目前時段。
          首次在背景預載一段歷史以便開始滑動；平均線的每段資料都多讀前 23 小時，接縫不會重新歸零。到固定媒體基準的收錄起點後停止載入。
          「更早」往前移一個所選期間，「回到最新」返回最近時段；時間軸取得鍵盤焦點後，左右方向鍵移動四分之一期間，Page Up／Page Down
          移動一個期間。
        </dd>
        <dt className={methodTerm}>關鍵字變化</dt>
        <dd>
          標成這個關鍵字的報導，每小時統計它們還帶了哪些其他標籤，每篇只算一次；排除泛用詞、欄目詞、數字日期與媒體自家名稱，
          保留同一小時至少 2 篇帶到的標籤。預設以台北日期顯示最近 14 天（每天的篇數相加），往左捲動或點「更早」時， 即時讀取前一段 14
          天的資料並保留捲動位置。可切換成每小時，初始期間依上方所選的 1、3、7 天。
          沒有報導的日期也保留，到最早收錄日期後停止載入；每次最多讀取最近 20000 篇，超過時為抽樣。 首次顯示 12
          個關鍵字；滑動時保持列的順序，停下約一秒後，依目前可見日期的共同篇數挑選主要關鍵字，保留共同項目的相對順序。
          點「顯示更多」在下方增加最多 12 個，新增列會短暫標色並捲入視野；點「收合」回到 12 個。搜尋範圍是目前可見日期的關鍵字。
          每列是一個關鍵字，連續出現的欄位連成一條，圓點是已載入期間中第一次出現的位置，顏色越深表示共同篇數越多，
          點日期可查看當天或當小時的事件表。只繪製目前可見的日期欄位，向前查閱時逐段渲染。
        </dd>
        <dt className={methodTerm}>報導列表</dt>
        <dd>
          與上方圖表同一期間內，帶有這個標籤的所有報導，由新到舊，每頁 30
          篇；來自所有收錄媒體，不限基準名單，所以篇數可能和圖表不同。標題或摘要提到這個字、但沒有這個標籤的報導不在列表內，列表上方會標出篇數並連到搜尋。
        </dd>
        <dt className={methodTerm}>藍綠分布與媒體</dt>
        <dd>
          依期間內所有帶這個標籤的報導計算，不只是這一頁；點分布條可只看單一傾向。媒體清單列出篇數最多的 10
          家。「偏藍」「偏綠」標記依刊登媒體的分類，不判斷單篇立場。
        </dd>
        <dt className={methodTerm}>相關事件</dt>
        <dd>最近 72 小時內上過事件表、標籤含這個關鍵字的事件，最多 6 件，最近的在前；「在榜」是這件事上過事件表的小時數。</dd>
      </dl>
      {camp && <CampBasis />}
    </>
  );
}
