import type { TopicKind } from '@/lib/pages';
import { methodHeading, methodList, methodTerm } from './styles';

// 議題表 and 專題: the indexes (/topic/, /feature/) and one outlet's list
// (/topic/[media]/, /feature/[media]/). 已停更 is 90 days without a story
// (app/src/crawl/topic-kind.ts ENDED_DAYS); the topics job runs hourly at :50;
// an outlet's check is late after 3 hours without success (topicSourceChecks).

const nounOf = (kind?: TopicKind) => (kind === 'feature' ? '專題' : kind === 'topic' ? '議題' : '議題或專題');

function KindRule() {
  return (
    <p>
      各家用詞不一（專題、專輯、策展…），本站依有沒有持續新增報導來分類，不照媒體的命名：持續新增報導的新聞串是議題（90
      天沒有新報導標為已停更），一次性的新聞包是專題。
    </p>
  );
}

function CheckStatus({ noun }: { noun: string }) {
  return (
    <>
      <dt className={methodTerm}>更新狀態</dt>
      <dd>
        「更新正常」：最近一次檢查成功，且 3 小時內有成功更新；「更新延遲」：超過 3
        小時沒有成功更新；「部分入口未更新」：有些入口這次沒抓到；「本次未能更新，保留先前資料」：這次檢查失敗，{noun}清單沿用上次的結果。
      </dd>
    </>
  );
}

// Without a kind (the /method/ page) it speaks of both; the counts come from the
// page's own data when the footer shows it there. `outlet` is one outlet's page,
// which has neither the keyword chips nor the per-outlet sidebar.
export function TopicMethod({
  kind,
  mediaCount,
  tagCount,
  outlet = false,
}: {
  kind?: TopicKind;
  mediaCount?: number | null;
  tagCount?: number;
  outlet?: boolean;
}) {
  const noun = nounOf(kind);
  if (outlet) return <TopicOutletMethod kind={kind} />;
  return (
    <>
      <h3 className={methodHeading}>{noun}</h3>
      <p>
        {mediaCount != null ? `${mediaCount} 家媒體官方${noun}入口的最新動態，` : `追蹤媒體官方${noun}入口，`}
        每小時檢查。新聞索引累計原站頁面實際列出的文章，不限報導日期；原站以標籤自動彙整或人工編選都可收錄。下方另列近 3
        天各家媒體的相關報導。來源持續擴充中，未列出的媒體不代表沒有{noun}。
      </p>
      <p>
        依最後更新排序：最後更新是{noun}
        頁上最新一則報導的時間；沒有報導日期的，用本站首次發現時間（不等於媒體上架時間）。本站開始追蹤前就已上架、又沒有報導日期可查的
        {noun}，更新時間不明，不列入上方清單（各媒體頁列在最後）；已上架的{noun}有新報導時照樣排到前面。
      </p>
      <KindRule />
      <p>
        關鍵字：從{noun}的名稱比對站內近 7 天常用的標籤，標籤須構成名稱的主要部分（「懶人包」「專題」這類包裝用語不算）。上方列出本頁{noun}
        中最常見的
        {tagCount ? ` ${tagCount} 個` : '關鍵字'}
        ，依帶有這個關鍵字的媒體家數排序；點選關鍵字或搜尋名稱時，也只列出各媒體同類型的{noun}
        。議題搜尋含已停更項目；議題的熱門關鍵字統計不含已停更項目。
      </p>
      <p>
        點選關鍵字後依各家開始做這個關鍵字的時間排序，最早的在前，並標出比最早一家晚幾天（以台灣日期計）。開始時間取媒體議題或專題頁上所列最早一則報導與本站首次發現兩者中較早的；本站開始追蹤前就已上架、又沒有報導日期可查的，標「追蹤前已上架」排在最後。一家有多個時以最早的為準，名稱全部列出。同一關鍵字隔年再出現（如每年的金馬）時，前面各家最後一則報導之後超過
        90 天才開始的，另算一輪重新比較先後。 進行中／已停更與最後更新日期只適用於議題。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>依媒體瀏覽</dt>
        <dd>
          媒體名稱後的數字是本站累計追蹤到這家媒體的{noun}
          數（含已停更）。綠點表示來源更新正常；黃點表示尚未檢查、最近一次檢查失敗或部分入口未更新，或超過 3
          小時沒有成功更新。「更新狀態詳情」列出各家最近一次檢查的時間與抓到的筆數。
        </dd>
        <CheckStatus noun={noun} />
      </dl>
    </>
  );
}

/** One outlet's 議題 or 專題 (/topic/[media]/, /feature/[media]/). */
function TopicOutletMethod({ kind }: { kind?: TopicKind }) {
  const noun = nounOf(kind);
  return (
    <>
      <h3 className={methodHeading}>單一媒體的{noun}</h3>
      <p>
        列出這家媒體官方入口上的{noun}，每小時檢查。每個{noun}
        下方是本站近 3 天從各家媒體抓到的相關報導：這家媒體把什麼做成{noun}，其他家又怎麼報。
      </p>
      <p>
        依最後更新排列：最後更新是{noun}
        頁上最新一則報導的時間；沒有報導日期的，用本站首次發現時間（不等於媒體上架時間）。
        {kind === 'feature'
          ? '專題沒有停更之分；本站開始追蹤前就已上架、專題頁上也沒有報導日期可查的，列在最後「更新時間不明」。'
          : kind === 'topic'
            ? '「近期更新」是 90 天內有新報導的議題，「已停更」是超過 90 天沒有新報導的議題；本站開始追蹤前就已上架、議題頁上也沒有報導日期可查的，列在最後「更新時間不明」。'
            : '議題分成近期更新（90 天內有新報導）與已停更（超過 90 天沒有新報導）；專題沒有停更之分。本站開始追蹤前就已上架、頁上也沒有報導日期可查的，列在最後「更新時間不明」。'}
      </p>
      <KindRule />
      <dl className={methodList}>
        <dt className={methodTerm}>累計追蹤</dt>
        <dd>本站收錄到這家媒體的{noun}總數，含已停更。</dd>
        <dt className={methodTerm}>對應站內標籤</dt>
        <dd>
          名稱比對得到站內標籤的{noun}數：標籤須構成名稱的主要部分；名稱比對不到時，改用這家媒體在{noun}
          頁上自己的報導共同帶的標籤。下方的相關報導依這些標籤比對。
        </dd>
        <CheckStatus noun={noun} />
      </dl>
    </>
  );
}
