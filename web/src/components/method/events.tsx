import Link from 'next/link';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 事件表 (/event/), its day archive (/event/archive/) and one event (/eve/[id]/).
// Thresholds and cadences come from app/src/v1/event-feed.ts (重點, 盲點),
// app/src/v1/coverage.ts (one event's 盲點), app/src/worker.ts (events at :04
// and :34) and app/src/jobs/events-*.ts (clustering, threads, links).

export type EventMethodPage = 'table' | 'archive' | 'thread';

/** The one statement of where 藍營／綠營 come from, for every page that shows them. */
export function CampBasis() {
  return (
    <p>
      藍綠以媒體為單位，不判斷單篇立場。本站基準名單的 29 家媒體依 Gene Hong 維護的流量試算表（見
      <Link href="/media/sources/" className={inlineLink}>
        「媒體流量與收錄比較」
      </Link>
      的「原始流量表單」）人工標記的分類標為藍營或綠營，標「多元」「內容」的不歸藍綠；其他既有媒體沿用原設定，新加入來源未另行標記政治傾向。各媒體的分類可在
      <Link href="/media/" className={inlineLink}>
        媒體來源
      </Link>
      依傾向篩選。「其他」表示未列藍綠，不代表中立。
    </p>
  );
}

/** Without `page` (the /method/ page) every part is shown. */
export function EventMethod({ page }: { page?: EventMethodPage }) {
  const all = !page;
  const table = all || page === 'table' || page === 'archive';
  return (
    <>
      <h3 className={methodHeading}>事件表</h3>
      <p>
        事件每半小時（每小時 04 分與 34 分）以過去 24
        小時的文章重新依標籤共現分群：一個標籤出現在另一個標籤過半數的文章裡，就視為同一件事，至少兩個標籤才成一件事；每件事最多選 3
        個主要標籤，報導分布與標題對照都依主要標籤計算。標題取自註明的媒體。
      </p>
      {table && (
        <dl className={methodList}>
          <dt className={methodTerm}>爆發力</dt>
          <dd>
            一件事的爆發力取它所有標籤中最高的標籤爆發力（見
            <Link href="/ranking/" className={inlineLink}>
              關鍵字排行
            </Link>
            的指標；歷史不足的標籤改用分數），事件表依此排名。爆發力條以本小時第 1 名為滿格。
          </dd>
          <dt className={methodTerm}>名次變動</dt>
          <dd>
            「新上榜」表示前一小時的事件表上沒有這件事，↑↓
            為與前一小時相比的名次變化；先比對是否為同一事件串，否則看主要標籤是否大致相同（共有至少一半，或第一個主要標籤相同）。「上榜 N
            小時」是這件事到這個小時為止上過事件表的小時數。
          </dd>
          <dt className={methodTerm}>名次走勢</dt>
          <dd>小圖是這件事在最近 24 個事件表小時的名次，第 1 名在最上面，沒上榜的小時留空；滑鼠停留可看逐小時名次。</dd>
          <dt className={methodTerm}>時段列</dt>
          <dd>
            事件表上方每個時段的長條高度是該小時第 1
            名的爆發力，在當天最低與最高之間拉開比例（最低約四分之一格，最高滿格），讓忙碌的時段看得出來。
          </dd>
          <dt className={methodTerm}>標題</dt>
          <dd>
            每件事列出的報導，優先取近 24
            小時帶有最多主要標籤、標籤又較集中的文章。頭條的藍綠對照取其中第一則藍營與第一則綠營報導並排，底線標出兩則標題用字不同的地方（逐字比對）。
          </dd>
        </dl>
      )}
      {(all || page === 'archive') && (
        <p>
          存檔：一天的存檔列出當天任一小時上過事件表的事件，依事件期間的最高爆發力排序，爆發力條以當天第 1
          名為滿格；名次是這件事在每小時事件表上的最佳名次，時間是它在事件表上的起訖，名次走勢從它第一次上榜的小時畫起。藍綠比例在過去的日子以當天（台北時間）計，今天以過去
          24 小時計。
        </p>
      )}
      {table && (
        <>
          <h3 className={methodHeading}>藍綠</h3>
          <dl className={methodList}>
            <dt className={methodTerm}>藍綠條</dt>
            <dd>
              每件事的藍綠條是過去 24
              小時寫過該事件主要標籤的媒體家數，依綠營、其他、藍營三段排列；判斷重點與盲點時只看藍綠兩營，不含未列藍綠的媒體。
            </dd>
            <dt className={methodTerm}>整體條</dt>
            <dd>
              事件表上方的整體條是同一期間各陣營的文章篇數比例（「其他」只計排行用的新聞媒體）；旁邊的「藍綠家數比」是同一期間有發稿的藍營與綠營媒體家數，是判斷重點的基準。
            </dd>
            <dt className={methodTerm}>重點</dt>
            <dd>
              藍綠合計至少 5 家媒體報導，且兩營家數比偏離基準約 1.7 倍以上（|log₂((藍家數 + 0.5) ÷ 基準藍家數 × 基準綠家數 ÷ (綠家數 +
              0.5))| ≥ 0.8）時，標為「藍營重點」或「綠營重點」；滑鼠停留在標示上可看各營家數。
            </dd>
            <dt className={methodTerm}>盲點</dt>
            <dd>
              事件表、存檔與首頁：一營至多 1 家報導、另一營至少 4
              家時，標為「盲點」，表示那一營的讀者幾乎看不到這件事。單一事件頁的標準不同：整段期間一營完全沒有報導、另一營有報導，才標盲點。
            </dd>
            <dt className={methodTerm}>藍綠溫差</dt>
            <dd>
              每欄列出該營重點或對方盲點的事件，盲點在前，其餘依偏離基準的程度排序，同一標題只列一次，最多 4
              件。沒有任何事件達到重點或盲點時，即為「平常範圍」。
            </dd>
          </dl>
        </>
      )}
      {all && <EventThreadMethod />}
      <CampBasis />
    </>
  );
}

/** "10/04 13:00" in Taipei time. */
const hour = (iso: string) => {
  const d = new Date(Date.parse(iso) + 8 * 3600e3).toISOString();
  return `${d.slice(5, 7)}/${d.slice(8, 10)} ${d.slice(11, 16)}`;
};

/** One event's page. The @notes slot passes this event's tags and coverage
 *  window; without them (the /method/ page) the rules are stated generally. */
export function EventThreadMethod({
  majorTags,
  coverage,
}: {
  majorTags?: string[];
  /** The coverage query's window, or null when it failed. */
  coverage?: { from: string; to: string; articles: number } | null;
}) {
  return (
    <>
      <h3 className={methodHeading}>單一事件頁</h3>
      <dl className={methodList}>
        <dt className={methodTerm}>事件與標籤</dt>
        <dd>
          事件表每半小時依標籤共現分群，每件事每小時列出前 12 個標籤與分數；標籤雲合併這則事件整段期間（最近 72
          個上榜小時）的標籤，字越大最高分越高，移到字上可看最高分、出現時間與出現小時數。橘色是主要標籤：這件事各小時最常被選為主要標籤的前
          5 個{majorTags?.length ? `（${majorTags.join('、')}）` : ''}
          。報導分布與標題對照都依主要標籤計算，其餘標籤只出現在標籤雲與每小時列表。「最高分」取各小時最高分與事件紀錄中的較大者。
        </dd>
        <dt className={methodTerm}>時間變化</dt>
        <dd>
          上圖：各主要標籤每小時的分數（與標籤頁相同，採固定媒體基準，歷史不足留白），虛線為這則事件在事件表上的名次（右軸，第 1
          名在最上面，未上榜的小時留空）；下圖：所有媒體帶有任一主要標籤的報導篇數。灰底為這則事件出現在事件表上的時段，前後各多顯示 12
          小時。每小時列表點時間可看當時整張事件表，標籤後的數字是該小時分數。
        </dd>
        <dt className={methodTerm}>各媒體報導量</dt>
        <dd>
          {coverage ? `以主要標籤在 ${hour(coverage.from)} 至 ${hour(coverage.to)} 之間的報導計算` : '以主要標籤在事件期間的報導計算'}
          （從第一次上榜前 6 小時到最後一次上榜後 1 小時，最多 400
          篇）；同一家媒體同標題只算一次。「依媒體家數」每家算一次，「依報導篇數」逐篇計；「各陣營最早報導」是各陣營最早刊登的一則。這一頁的盲點指整段期間一方陣營完全沒有報導、另一方有，比事件表的標準（一營至多
          1 家、另一營至少 4 家）嚴。表格點欄名可排序，預設顯示前 5 家。
        </dd>
        <dt className={methodTerm}>標題對照</dt>
        <dd>
          同一件事，各家怎麼下標。依時間看事件如何展開；藍綠對照把同一小時三類媒體的標題並排；依媒體看每家的完整報導。圖片為各媒體提供的報導圖片，沒有提供者不顯示。沒有報導分布資料時，只保留事件表每小時挑出的代表標題。
        </dd>
        <dt className={methodTerm}>相關事件</dt>
        <dd>
          兩則事件都結束 7 小時以上後比對：較晚開始的一則若在較早一則結束隔天（台北時間）結束前出現，且主要標籤至少 3
          個相同（或包含較早一則的全部主要標籤），就互列為相關事件。「含延續事件共 N 小時」是這些相關事件從最早開始到最晚結束的小時數。
        </dd>
      </dl>
    </>
  );
}
