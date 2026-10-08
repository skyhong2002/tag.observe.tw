import Link from 'next/link';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 事件表 (/event/: by day, or one hour with ?at= / ?view=hour) and one event (/eve/[id]/).
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
        小時的文章重新產生：先清洗標籤，再依標籤共現分群，最後把文章掛進事件。標題取自註明的媒體。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>清洗標籤</dt>
        <dd>
          分類詞（地方、生活）、單獨年份、以 新聞／要聞／匯流／總覽 結尾的欄目詞不參與分群。某媒體 24 小時內至少 8 篇、且 80%
          以上文章都帶的標籤視為該媒體的模板詞（如每篇都蓋 國防部、國軍 的媒體），只從該媒體的文章移除；只來自單一媒體且達 8
          篇的標籤視為站台欄目詞。較長標籤包含較短標籤、且 30%
          以上文章同時帶著較短那個時，併入較短標籤（名古屋亞運→亞運）。另有一份人工維護的泛用詞名單（台灣、民進黨、主席等）永不用來連結事件。
        </dd>
        <dt className={methodTerm}>分群</dt>
        <dd>
          取爆發力前 300
          的標籤。一個標籤出現在另一個標籤過半數的文章裡，就視為同一件事，並沿此關係一路合併。被多個彼此不相干的熱門標籤同時連到的標籤（亞運、川普、台股
          這類傘狀詞）只留在跟它寫在一起最多的那一群，不讓它把不同的事串成一件。至少兩個標籤才成一件事。
        </dd>
        <dt className={methodTerm}>文章歸屬</dt>
        <dd>
          文章要同時帶有該事件至少 2 個標籤才算這件事的報導。每件事選被最多報導帶著的 3
          個主要標籤，報導分布與標題對照都依主要標籤計算。若某件事一半以上的報導已經屬於其他事件（兩位政治人物同一天出現在兩場造勢），視為重複，不另列。
        </dd>
      </dl>
      {table && (
        <dl className={methodList}>
          <dt className={methodTerm}>爆發力</dt>
          <dd>
            一件事的爆發力取它所有標籤中最高的標籤爆發力（見
            <Link href="/ranking/" className={inlineLink}>
              關鍵字排行
            </Link>
            的指標；歷史不足的標籤改用分數），每小時事件表依此排名，爆發力條以本小時第 1 名為滿格；每日事件表的「全天熱度」條以當天第 1
            名為滿格。
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
            每件事列出的報導，依它所帶事件標籤的爆發力加總排序（除以標籤數的對數，壓低一篇掛幾十個名字的週報），先每家媒體取一則，最多 6
            則，且限帶有主要標籤的報導。頭條的藍綠對照取其中第一則藍營與第一則綠營報導並排，底線標出兩則標題用字不同的地方（逐字比對）。
          </dd>
        </dl>
      )}
      {table && (
        <>
          <h3 className={methodHeading}>每日與每小時</h3>
          <dl className={methodList}>
            <dt className={methodTerm}>每日（預設）</dt>
            <dd>
              事件表預設顯示一整天（台北時間）：列出當天任一小時上過事件表的事件，依「全天熱度」排序，也就是這件事當天每個上榜小時的爆發力加總，上榜越久、越高越前面。分群每小時重算，同一件事常被拆成幾條事件串；當天兩條事件串第一個主要標籤相同、主要標籤至少
              2 個相同（只有 1
              個主要標籤時則該標籤相同），或代表標題是同一篇報導時，併為一件事，熱度相加，其餘事件串列在「同一件事的其他發展」。名次是這件事當天在每小時事件表上的最佳名次（點名次可看那個小時的事件表），上榜小時與時段只計當天；名次走勢畫當天
              00 時到 23 時各小時的名次。標題取自它當天名次最好的小時。藍綠比例在過去的日子以當天計，今天以過去 24 小時計。
            </dd>
            <dt className={methodTerm}>每小時</dt>
            <dd>切到「每小時」可看單一小時的事件表，依該小時的爆發力排序，並顯示與前一小時相比的名次變化。</dd>
          </dl>
        </>
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
