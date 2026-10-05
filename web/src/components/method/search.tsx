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
        <p>列出本站收錄的所有媒體文章，依刊登時間由新到舊，每頁 30 篇，最多往前 31 天。要找特定字詞，用搜尋新聞。</p>
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
          16 家。「偏藍」「偏綠」標記依刊登媒體的分類，不判斷單篇立場。
        </dd>
        {!listing && (
          <>
            <dt className={methodTerm}>相關焦點事件</dt>
            <dd>目前事件表前 30 件中，主要標籤、標籤或列出的標題含搜尋字詞的事件，最多 3 件。</dd>
          </>
        )}
        <dt className={methodTerm}>時間後的 *</dt>
        <dd>來源沒有提供發布時間，顯示的是本站首次看到這篇文章的時間。</dd>
      </dl>
      {camp && <CampBasis />}
    </>
  );
}
