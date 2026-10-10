import Link from 'next/link';
import { inlineLink, methodHeading } from './method/styles';

// 資料來源與計算方式, one block per part of the site. The /method/ page shows them
// all; the footer shows only the blocks for the page being read (FooterMethod).
// Larger areas live in ./method/<area>.tsx and are re-exported here.

export { ArticleMethod } from './method/article';
export { CampBasis, EventMethod, EventThreadMethod } from './method/events';
export { HomeMethod } from './method/home';
export { JournalistMethod } from './method/journalists';
export { CrawlerMethod, MediaMethod, MediaOverviewMethod, MediaSourcesMethod } from './method/media';
export { ObserveMethod } from './method/observe';
export { RankingMethod, TagMethod } from './method/ranking';
export { SearchMethod } from './method/search';
export { SimilarityMethod } from './method/similarity';
export { methodHeading } from './method/styles';
export { TopicMethod } from './method/topics';

export function SourceMethod() {
  return (
    <>
      <h3 className={methodHeading}>資料來源</h3>
      <p>
        新聞媒體每 9
        分鐘、其他媒體每小時抓取一次新文章（每輪從最久沒抓的媒體開始），保存標題、摘要、連結、圖片網址、標籤與署名；正文在刊登後 7
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
        滑鼠停留在媒體名稱上（手機點一下，再點一下進入媒體頁）會顯示媒體摘要；摘要只供瀏覽，不會擋住下方的連結，滑鼠移開就關閉。內容包括藍綠分類，本站過去
        24 小時與 7 天收錄的篇數，以及近 24
        小時熱門關鍵字。熱門關鍵字統計這家媒體文章的標籤與標題關鍵詞，排除新聞分類詞，每篇每詞計一次，最多取最新 2,000
        篇；透過彙整來源收錄的不列關鍵字。
      </p>
    </>
  );
}
