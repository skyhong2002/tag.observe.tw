import Link from 'next/link';
import { inlineLink, methodHeading } from './method/styles';

// 資料來源與計算方式, one block per part of the site. The /method/ page shows them
// all; the footer shows only the blocks for the page being read (FooterMethod).
// Larger areas live in ./method/<area>.tsx and are re-exported here.

export { ArticleMethod } from './method/article';
export { CampBasis, EventMethod, EventThreadMethod } from './method/events';
export { HomeMethod } from './method/home';
export { JournalistMethod } from './method/journalists';
export { RankingMethod, TagMethod } from './method/ranking';
export { SearchMethod } from './method/search';
export { methodHeading } from './method/styles';
export { TopicMethod } from './method/topics';

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
      <MediaCardMethod />
    </>
  );
}

/** The hover card on every outlet name (MediaHoverLink). */
export function MediaCardMethod() {
  return (
    <>
      <h3 className={methodHeading}>媒體摘要卡</h3>
      <p>
        滑鼠停留在媒體名稱上（手機點一下）會顯示媒體摘要：藍綠分類，本站過去 24 小時與 7 天收錄的篇數，以及近 24
        小時熱門關鍵字。熱門關鍵字統計這家媒體文章的標籤與標題關鍵詞，排除新聞分類詞，每篇每詞計一次，最多取最新 2,000
        篇；透過彙整來源收錄的不列關鍵字。
      </p>
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
        頁從署名整理出人名與筆名（排除媒體、部門、通訊社、職稱與責任編輯），列出各自的刊登媒體，並對照與他站相似的文章誰先誰後；較晚刊登只是閱讀線索，不是抄襲判定，同名不同人不會分開。
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
