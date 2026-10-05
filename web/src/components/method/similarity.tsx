import Link from 'next/link';
import { CampBasis } from './events';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 新聞關係圖 (/similarity/), 每日趨勢 (/similarity/daily/) and 擷取狀態
// (/similarity/about/). Comparison rules: app/src/similarity/compute.ts
// (200 characters, 100 shared 5-character shingles, a consecutive passage,
// 7-day window, thresholds 0.5–1); the default 0.65 is in app/src/v1/similarity.ts;
// the index runs every 10 minutes (app/src/worker.ts). Groups and their source
// (earliest, then lowest article id): storyGroups in app/src/similarity/store.ts.
// Arrows run source → follower (components/SimilarityGraph.tsx); main links are
// each outlet's strongest two (lib/media-graph.mts mainGraphEdges). Daily
// counts: loadDaily in app/src/v1/similarity.ts.

export type SimilarityMethodPage = 'graph' | 'daily' | 'status';

/** Without `page` (the /method/ page) every part is shown; `camp: false` leaves
 *  out the camp basis where another block already states it. */
export function SimilarityMethod({ page, camp = true }: { page?: SimilarityMethodPage; camp?: boolean }) {
  const all = !page;
  return (
    <>
      <h3 className={methodHeading}>新聞關係圖</h3>
      <p>
        <Link href="/similarity/" className={inlineLink}>
          新聞關係圖
        </Link>
        比對不同媒體文章的內文：每篇可用內文都與前後 7 天內其他媒體的全部文章比對，期間內的相似配對只計入兩篇都在期間內刊登的組合。索引每 10
        分鐘處理新抓到的正文，配對永久保存；標為「內容」的聯播來源（如蕃新聞）不列入比對。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>相似度</dt>
        <dd>
          內文做 NFKC 正規化並移除標點、空白，以五字片段計算 Dice 相似度。至少 200 個字元、100
          個共同片段及連續相同文字才列為候選。正規化全文相等才標為內文相同；相似度不使用標題或刊登時間。門檻可在關係圖的「進階」調整，範圍
          0.5–1，預設 0.65；門檻越高，只留下內文越接近的報導。
        </dd>
        <dt className={methodTerm}>同組與來源</dt>
        <dd>
          內文相近的報導連成同一組（甲與乙相近、乙又與丙相近，三篇就同組），完成分組後才以最早刊登時間指定同組來源：全組最早刊登的一篇。幾篇同時最早刊登時，取本站較早收錄（文章編號較小）的一篇。來源依本期全部相似配對指定，完整分組可能包含未顯示在圖上的媒體；組內其他報導都直接連回來源，即使與來源沒有直接比對分數（經同組配對歸源）。這是依刊登時間歸源的規則，不等於查證原創或抄襲；相近內文也可能來自通訊社稿或授權轉載。
        </dd>
        <dt className={methodTerm}>來源／引用</dt>
        <dd>
          「來源」是文章標示的內容提供者；「引用」是內文明確引述或標示的其他媒體報導，附上原文證據。來源／引用統計合計這兩種關係；機構來源與被引用媒體都不等於具名作者。
        </dd>
        <dt className={methodTerm}>箭頭與線條</dt>
        <dd>
          箭頭依內文流向畫：橘色箭頭由同組最早刊登的媒體指向較晚刊登的媒體，紫色箭頭由內容提供者或被引用的媒體指向採用／引用它的媒體。線條越粗代表關係文章越多。
        </dd>
      </dl>
      {(all || page === 'graph') && (
        <dl className={methodList}>
          <dt className={methodTerm}>圖示</dt>
          <dd>
            圖示大小依本期已比對的新聞篇數調整，不是網站流量或總發稿量。各媒體的篇數涵蓋本期全部關係，不隨篩選改變；圖上連線與文章只呈現目前篩選的媒體。媒體依連線強度自動分群，分群不代表立場或所有權。
          </dd>
          <dt className={methodTerm}>主要連線</dt>
          <dd>總覽只畫每家媒體最強的兩條連線（各家所選的聯集），選定的媒體則畫出它的全部連線；「顯示全部連線」畫出篩選後的所有連線。</dd>
          <dt className={methodTerm}>篩選</dt>
          <dd>
            顯示媒體數依本期納入分析篇數取前幾家。選了媒體 tag 時，圖上另含所選分類的直接關係對象，這些對象不計入分類媒體數；tag
            選單只列出目前有關係資料的 tag。藍字／綠字與「只看藍」「只看綠」沿用網站媒體資料的藍綠分類，未標註者使用一般字色。
          </dd>
          <dt className={methodTerm}>媒體比較</dt>
          <dd>
            從各家媒體出發，比較相近報導、來源／引用往來與實際新聞。分析篇數為本期已完成比對的內文；同組最早、同組較晚、採用／引用與被採用／引用皆依各欄文章去重，涵蓋本期與所有媒體的關係，不隨圖上篩選改變；主要關係對象只列圖上媒體。同組最早是該組最早刊出的那篇，同組較晚是同組已有更早刊出的報導。主要關係對象依關係篇數列出前三項；依同組最早、同組較晚、採用／引用他媒或被他媒採用／引用排序時，只列該類關係的對象，滑過可看關係類型。同組最早僅依刊登時間判定，不代表原創。
          </dd>
          <dt className={methodTerm}>新聞對照</dt>
          <dd>
            選定一家媒體時，上方四個數字是本期與所有媒體的關係，依文章去重計數；已比對篇數也是圖示大小的依據。下方文章只列圖上媒體之間的關係，每篇標出同組來源與兩篇的相似度；來源媒體未顯示在圖上時，來源仍保持不變。
          </dd>
        </dl>
      )}
      {(all || page === 'daily') && (
        <>
          <h3 className={methodHeading}>每日趨勢</h3>
          <p>
            每天的比對篇數、相似配對、內文相同與來源／引用，依所選相似度門檻計算。相似配對算在較晚刊登那篇的日期、來源／引用算在採用／引用文章的刊登日（台北時間）；當天數字仍會增加。「資料自」是比對篇數第一次達到期間最多那天十分之一的日子，更早只有少數媒體的零星文章。
          </p>
          <dl className={methodList}>
            <dt className={methodTerm}>比對篇數</dt>
            <dd>期間內相似度索引已比對的文章數；只作為來源／引用對象、沒有收錄內文的媒體為 0。</dd>
            <dt className={methodTerm}>被跟進</dt>
            <dd>這家媒體先刊出，之後有其他媒體刊出相似內容的篇數。</dd>
            <dt className={methodTerm}>跟進他媒</dt>
            <dd>這家媒體刊出時，已有其他媒體相似文章的篇數。被跟進與跟進他媒都依文章去重；同時刊登的配對不計方向。</dd>
            <dt className={methodTerm}>採用／引用他媒</dt>
            <dd>這家媒體文章標示其他媒體為內容提供者，或內文明示引用其他媒體的次數。</dd>
            <dt className={methodTerm}>被採用／引用</dt>
            <dd>其他媒體文章標示這家媒體為內容提供者，或內文明示引用這家媒體的次數。</dd>
            <dt className={methodTerm}>百分比</dt>
            <dd>被跟進、跟進他媒與採用／引用他媒旁的百分比，是佔這家媒體比對篇數的比例；各媒體表為期間合計。</dd>
          </dl>
        </>
      )}
      {(all || page === 'status') && (
        <>
          <h3 className={methodHeading}>擷取狀態</h3>
          <p>
            各媒體本期的文章數與內文狀態。可比較是取得完整內文、長度足以比對的文章；已比對是其中已由相似度索引比對的篇數；缺漏是抓取失敗或內文過短，待抓是尚未處理。可比較比例低於
            80% 的媒體以橘色標示。蕃新聞的聯播內容不納入統計，標為「排除統計」，也不計入合計。
          </p>
        </>
      )}
      {camp && <CampBasis />}
    </>
  );
}
