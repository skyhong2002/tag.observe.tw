import Link from 'next/link';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 新聞總覽 (the home page, web/src/app/page.tsx). Its panels come from
// web/src/lib/demo.ts: the event table's first 24 events (12 stories, 3 per
// 藍綠溫差 column), the news ranking by 爆發力 (8 shown), journalists of the
// past 48 hours (6 shown) and the similarity graph of the past 24 hours at
// 0.65 (outlets with at least 20 analysed articles, 5 per column). 同題不同標
// pairs are chosen in lib/compare-data.ts and lib/headline-compare.mts;
// topic coverage (近 3 天, capped at 500) in app/src/jobs/topic-related.ts.

/** Values from the page's own data; without them (the /method/ page) the text stays general. */
export function HomeMethod({
  basisCount,
  journalistHours,
  graphHours,
}: {
  basisCount?: number;
  journalistHours?: number;
  graphHours?: number;
}) {
  return (
    <>
      <h3 className={methodHeading}>新聞總覽</h3>
      <p>
        頁首的新聞量分布為過去 24
        小時新聞類媒體有標籤的文章數，依媒體所屬陣營加總，並非逐篇判斷立場。展開後列出各段包含的媒體，淡色表示該媒體過去 24 小時沒有文章。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>焦點事件</dt>
        <dd>
          本小時事件表的前 12
          件（同一事件串只列一次），依事件表名次排列。首頁卡片的標籤優先顯示該標題用到的關鍵字；標題一個都沒用到時，改顯示事件的主要關鍵字。上榜時間、「新上榜」、↑↓
          與名次走勢的意思同事件表（見下方「事件表」）。
        </dd>
        <dt className={methodTerm}>報導分布</dt>
        <dd>
          藍綠分布以整個事件分群計算，並非單篇新聞的報導分布：數的是過去 24
          小時寫過該事件主要關鍵字的媒體家數。只有差距明顯時才標示：「盲點」表示其中一營幾乎沒有報導，「重點」表示其中一營報導得比平常多很多；門檻見下方「事件表」的重點與盲點。
        </dd>
        <dt className={methodTerm}>關鍵字升溫榜</dt>
        <dd>
          新聞類
          <Link href="/ranking/?category=news" className={inlineLink}>
            關鍵字排行
          </Link>
          依爆發力的前 8 名。爆發力＝分數＋Σ（現在分數 − N 小時前分數）× 權重（N 為 3、6、12、24、48
          小時），缺少可比較的歷史時顯示「歷史不足」。▲▼ 是依分數的名次與 24 小時前相比，「新」表示 24
          小時前不在榜上，「－」為名次不變或沒有可比較的快照。小圖是最近 48 小時每小時新聞篇數的 24 小時移動平均。
        </dd>
        <dt className={methodTerm}>記者動態</dt>
        <dd>
          過去 {journalistHours ?? 48} 小時署名文章最多的 6 位記者，圖示為刊登篇數最多的前三家媒體。「相近
          N」是其中內文與其他媒體文章相近（相似度 65% 以上）的篇數；算法見
          <Link href="/journalist/" className={inlineLink}>
            記者
          </Link>
          頁的說明。
        </dd>
        <dt className={methodTerm}>藍綠溫差</dt>
        <dd>
          目前事件表前 24 件、各自過去 24
          小時的報導中，哪一邊的媒體特別在寫、哪一邊幾乎沒報（以同期藍綠各自的發稿家數為基準）。每欄列出該營重點或對方盲點的事件，盲點在前，其餘依偏離基準的程度排序，最多
          3 件。
        </dd>
        <dt className={methodTerm}>同題不同標</dt>
        <dd>
          政治事件精選：從事件表前 30
          件中，挑主要標籤、標籤或標題提到政黨、立法院、行政院、總統、市長、選舉、兩岸、國防部等政治詞的事件（主要標籤提到的優先，其餘依名次），各找一則藍營與一則綠營媒體的標題並排：兩則刊登相隔
          12 小時內，標題彼此相近，也與事件的代表標題相近。最多列 3 件。底線標出兩則標題用字不同的地方（逐字比對）。
        </dd>
        <dt className={methodTerm}>新聞關係圖</dt>
        <dd>
          取
          <Link href="/similarity/" className={inlineLink}>
            新聞關係圖
          </Link>
          過去 {graphHours ?? 24} 小時的比對結果，四欄都是篇數、各取前 5 家。「相近」以正文片段重疊度計算，門檻
          0.65；同一組相近報導中最早刊出的算「先發」，其餘算「跟進」。「引用」為文中明示引用其他媒體的紀錄：被引用的來源可能是本站未收錄的外媒（如通訊社），引用他家的只計本站收錄的媒體。括號內是該媒體這類連線最多的對象。
        </dd>
        <dt className={methodTerm}>最近更新的議題</dt>
        <dd>
          各媒體官方
          <Link href="/topic/" className={inlineLink}>
            議題
          </Link>
          入口中最近更新的 5 則，每家媒體只取最新一則（最後更新的定義見議題表）。「近 3 天 N 篇相關」是本站近 3
          天從各家媒體收錄、帶有這個議題全部對應標籤的報導數，最多計 500 篇，達上限時標「+」。
        </dd>
        <dt className={methodTerm}>讀者關注</dt>
        <dd>
          近 7 天本站讀者瀏覽最多的事件、標籤、議題、專題與文章頁，依 Google Analytics 每小時更新；不是媒體報導量。定義見
          <Link href="/observe/" className={inlineLink}>
            網站觀測
          </Link>
          。
        </dd>
      </dl>
      <p id="basis">
        {basisCount != null ? `升溫榜與「${basisCount} 家」篇數的媒體範圍：` : '升溫榜與篇數的媒體範圍：'}
        這是「新聞」類別中符合收錄條件的固定名單，並非預先設定家數，也不是依媒體品質或公信力評選。
      </p>
      <p>
        本版名單選取已啟用、非僅供探索的來源：在名單凍結前至少 72 小時已成功取得非空新聞列表，且凍結前最近 3
        小時內也有成功紀錄。固定同一批媒體，讓不同時間的議題熱度能在相同範圍內比較。當天未發稿的媒體仍保留，新來源待下一版基準再納入。
      </p>
      <p>篇數只計算這批媒體過去 24 小時已收錄的報導，不是全站總量；抓取失敗或補抓仍可能影響數字。</p>
    </>
  );
}
