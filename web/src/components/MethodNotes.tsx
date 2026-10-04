import Link from 'next/link';
import type { TopicKind } from '@/lib/pages';

// 資料來源與計算方式, one block per part of the site. The /method/ page shows them
// all; the footer shows only the blocks for the page being read (PageMethod).

export const methodHeading = 'pt-2 text-[13px] font-semibold text-zinc-800 first:pt-0 dark:text-zinc-200';
const methodTerm = 'font-medium text-zinc-800 dark:text-zinc-200';
const inlineLink = 'text-brand-700 underline underline-offset-2 dark:text-brand-400';

export function SourceMethod() {
  return (
    <>
      <h3 className={methodHeading}>資料來源</h3>
      <p>
        新聞媒體每 9 分鐘、其他媒體每小時抓取一次新文章，保存標題、摘要、連結、圖片網址、標籤與署名；正文在刊登後 7
        天內可於站內閱讀。收錄的媒體與抓取狀態見
        <Link href="/media/" className={inlineLink}>
          媒體來源
        </Link>
        。
      </p>
      <p>
        標籤是媒體自己在文章頁標記的關鍵字（news_keywords、keywords、article:tag
        等）。文章頁沒有標記時，才用其他媒體近期用過的標籤比對標題補上。
      </p>
    </>
  );
}

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
          0.92、0.84、0.70、0.50、0.25，前後使用同一媒體基準。缺少可比較歷史或舊榜截斷而無法確認分數時顯示「—」，不當成零；持平的話題約等於分數，退燒中的話題會低於分數。排行榜上爆發力高於分數時以橘字標示。
        </dd>
        <dt className={methodTerm}>變動</dt>
        <dd>
          依分數的名次與 24 小時前同一基準的快照相比：▲ 為上升、▼ 為下降、＝ 持平。「新」表示 24
          小時前的完整榜單裡沒有這個關鍵字；沒有可比較的快照、基準不同或舊榜截斷時顯示「—」。
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
          24。依「趨勢」排序時比較最新完整小時與 48 小時前的平均值；點關鍵字可看每小時篇數與平均線。爆發力仍依上面的加權分數計算。
        </dd>
      </dl>
    </>
  );
}

export function SimilarityMethod() {
  return (
    <>
      <h3 className={methodHeading}>新聞關係圖與記者</h3>
      <p>
        <Link href="/similarity/" className={inlineLink}>
          新聞關係圖
        </Link>
        以正規化內文的五字片段比對不同媒體的文章，相似連線無方向，引用箭頭只反映內文明示提到的來源。
        <Link href="/journalist/" className={inlineLink}>
          記者
        </Link>
        頁從署名整理出人名與筆名（排除媒體、部門、職稱與責任編輯），列出各自的刊登媒體，並對照與他站相似的文章誰先誰後；較晚刊登只是閱讀線索，不是抄襲判定，同名不同人不會分開。
      </p>
    </>
  );
}

export function MediaMethod() {
  return (
    <>
      <h3 className={methodHeading}>媒體頁</h3>
      <p>
        各媒體頁的收錄量為本站抓取的報導，非媒體全部發稿量。「報導關鍵字」統計期間內文章的標籤與標題關鍵詞，排除新聞分類詞，每篇每詞計一次，最多取最新
        2,000
        篇；字越大，出現在越多篇報導。「媒體關係」取自新聞關係圖同一期間的比對結果，依文章去重計數：同組指內文相近的報導，以最早刊登者為來源；引用指內文明示引用的媒體。
      </p>
    </>
  );
}

export function EventMethod() {
  return (
    <>
      <h3 className={methodHeading}>事件、議題與藍綠</h3>
      <p>
        事件每半小時依標籤共現分群，標題取自註明的媒體；議題表與專題每小時檢查各媒體的官方入口：持續新增報導的是議題（90
        天沒有新報導標為已停更），一次性的新聞包是專題，依行為分類而非媒體用詞。
      </p>
      <p>
        本站基準名單的 29
        家媒體依來源試算表人工分類，其他既有媒體沿用原設定，新加入來源未另行標記政治傾向。全部新聞來源、抓取狀態與分類依據可於
        <Link href="/media/sources/#classification-method" className={inlineLink}>
          「媒體流量與收錄比較」
        </Link>
        查看；「其他」表示未列藍綠，不代表中立。
      </p>
    </>
  );
}

// 議題表 and 專題. Without a kind (the /method/ page) it speaks of both; the counts
// come from the page's own data when the footer shows it there.
export function TopicMethod({ kind, mediaCount, tagCount }: { kind?: TopicKind; mediaCount?: number | null; tagCount?: number }) {
  const noun = kind === 'feature' ? '專題' : kind === 'topic' ? '議題' : '議題或專題';
  return (
    <>
      <h3 className={methodHeading}>議題表與專題</h3>
      <p>
        {mediaCount != null ? `${mediaCount} 家媒體官方${noun}入口的最新動態，` : `追蹤媒體官方${noun}入口，`}
        每小時檢查。每個{noun}下方列出本站近 3 天從各家媒體抓到的相關報導。來源持續擴充中，未列出的媒體不代表沒有{noun}。
      </p>
      <p>
        依最後更新排序：最後更新是{noun}
        頁上最新一則報導的時間；沒有報導日期的，用本站首次發現時間（不等於媒體上架時間）。本站開始追蹤前就已上架、又沒有報導日期可查的
        {noun}，更新時間不明，不列入上方清單（各媒體頁列在最後）；已上架的{noun}有新報導時照樣排到前面。
      </p>
      <p>
        各家用詞不一（專題、專輯、策展…），本站依有沒有持續新增報導來分類，不照媒體的命名：持續新增報導的是議題（90
        天沒有新報導標為已停更），一次性的新聞包是專題。
      </p>
      <p>
        關鍵字：從議題與專題的名稱比對站內近 7
        天常用的標籤，標籤須構成名稱的主要部分（「懶人包」「專題」這類包裝用語不算）。上方列出未停更議題與專題中最常見的
        {tagCount ? ` ${tagCount} 個` : '關鍵字'}
        ，依帶有這個關鍵字的媒體家數排序；點選後列出各媒體帶這個關鍵字的議題與專題（含已停更），議題表與專題頁結果相同。
      </p>
      <p>
        點選關鍵字後依各家開始做這個關鍵字的時間排序，最早的在前，並標出比最早一家晚幾天（以台灣日期計）。開始時間取媒體議題或專題頁上所列最早一則報導與本站首次發現兩者中較早的；本站開始追蹤前就已上架、又沒有報導日期可查的，標「追蹤前已上架」排在最後。一家有多個時以最早的為準，名稱全部列出。同一關鍵字隔年再出現（如每年的金馬）時，前面各家最後一則報導之後超過
        90 天才開始的，另算一輪重新比較先後。 進行中／已停更與最後更新日期只適用於議題。
      </p>
    </>
  );
}
