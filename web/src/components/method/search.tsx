import { CampBasis } from './events';
import { methodHeading, methodList, methodTerm } from './styles';

// 搜尋新聞 (/search/) and 最新文章 (/article/), over /api/v1/articles
// (app/src/v1/articles.ts): title or summary containing the words, or an
// identical tag; at most 31 days back. The listing is the same query without words.

/** `camp: false` leaves out the camp basis where another block already states it;
 *  `listing` describes 最新文章, the same list without a search term. */
export function SearchMethod({ camp = true, listing = false }: { camp?: boolean; listing?: boolean }) {
  return (
    <>
      <h3 className={methodHeading}>{listing ? '最新文章' : '搜尋新聞'}</h3>
      {listing ? (
        <p>
          列出本站收錄的所有媒體文章，依刊登時間由新到舊，每頁 30 篇，最多往前 31 天；過去 1 天依小時分段，7 天與 31
          天依日期分段。刊登時間還沒確認的文章（只知道本站何時看到）暫不列出，抓到原文確認時間後才會出現在對應的位置。要找特定字詞，用搜尋新聞。
        </p>
      ) : (
        <p>
          搜尋本站收錄的所有媒體文章，比對標題、摘要與標籤，最多往前 31
          天：標題或摘要包含搜尋字詞，或文章有一個與搜尋字詞完全相同的標籤，就算符合；不搜尋正文。結果依刊登時間由新到舊，每頁 30 篇。
        </p>
      )}
      <dl className={methodList}>
        <dt className={methodTerm}>藍綠分布</dt>
        <dd>
          分布條、篇數與媒體清單描述所選期間的全部符合文章，不只是這一頁；選了單一傾向時，分布條仍顯示全部結果，下方只列該傾向的文章。媒體清單列出篇數最多的
          10 家（手機上 5 家）。「偏藍」「偏綠」標記依刊登媒體的分類，不判斷單篇立場。
        </dd>
        {listing && (
          <>
            <dt className={methodTerm}>主要事件</dt>
            <dd>
              所選期間內事件表上的事件串，依每小時爆發力分數的總和排序：在榜越久、名次越前面的越重。同一則新聞被拆成不同事件串時（主要標籤過半重疊，或第一個標籤相同）只留較重的一個。媒體家數、篇數與藍綠比例都以整段期間計算；事件表約從
              2026 年 9 月底開始累積，所以 31 天目前與 7 天差不多。
            </dd>
            <dt className={methodTerm}>相關事件</dt>
            <dd>
              文章的標籤含有某件主要事件的兩個主要標籤（事件只有一個主要標籤時則是那一個），就標上該事件；同時符合多件時標較重的那件。這是依標籤比對，不是人工歸類。
            </dd>
          </>
        )}
        {!listing && (
          <>
            <dt className={methodTerm}>標籤摘要</dt>
            <dd>搜尋字詞剛好也是標籤時，列出所選期間帶有這個標籤的篇數、目前的關鍵字排行名次與最近 3 天每小時篇數，並連到標籤頁。</dd>
            <dt className={methodTerm}>相關焦點事件</dt>
            <dd>目前事件表前 30 件中，主要標籤、標籤或列出的標題含搜尋字詞的事件，最多 3 件。</dd>
          </>
        )}
        {!listing && (
          <>
            <dt className={methodTerm}>時間後的 *</dt>
            <dd>來源沒有提供發布時間，顯示的是本站首次看到這篇文章的時間。</dd>
          </>
        )}
      </dl>
      {camp && <CampBasis />}
    </>
  );
}
