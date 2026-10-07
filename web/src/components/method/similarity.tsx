import Link from 'next/link';
import { CampBasis } from './events';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 新聞關係圖 (/similarity/), 每日趨勢 (/similarity/daily/) and 擷取狀態
// (/similarity/about/). Comparison rules: app/src/similarity/compute.ts
// (200 characters, 100 shared 5-character shingles, a consecutive passage,
// 7-day window, thresholds 0.5–1); the default 0.65 is in app/src/v1/similarity.ts;
// the index runs every 10 minutes (app/src/worker.ts). Groups are for browsing;
// only direct measured pairs form undirected similarity edges. Citation arrows
// run credited outlet → citing outlet; main links are
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
        <dt className={methodTerm}>分組與稿源線索</dt>
        <dd>
          相近報導連成同組供瀏覽，但連線與證據只使用直接比對過的兩篇文章。甲與乙相近、乙與丙相近，不推定甲與丙相近。展示代表只用於排序，不代表稿源。
          配對依序區分為已註明來源（彼此引用或共同明示來源）、同署名跨站、未辨識稿源；分數不因分類改變。相同署名不保證同一人；引用與署名都不能證明授權。
        </dd>
        <dt className={methodTerm}>來源／引用</dt>
        <dd>
          「來源」是文章標示的內容提供者；「引用」是內文明確引述或標示的其他媒體報導，附上原文證據。來源／引用統計合計這兩種關係；機構來源與被引用媒體都不等於具名作者。
        </dd>
        <dt className={methodTerm}>箭頭與線條</dt>
        <dd>
          紫色箭頭由明示來源指向引用方；橘色箭頭表示未辨識稿源配對的較早刊登方指向較晚刊登方，不代表原創或改寫；青綠色無箭頭線表示同署名跨站刊登。同一分鐘、時間未確認或只共同引用第三方時不畫箭頭。線粗細代表配對數或引用篇數。
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
            各媒體同署名跨站、已註明來源、未辨識稿源的篇數，皆依文章去重；同一篇文章若與不同文章形成不同類別配對，可出現在多欄，因此不可直接相加。引用與被引用另計。主要關係對象依直接配對數或引用篇數列出。
          </dd>
          <dt className={methodTerm}>新聞對照</dt>
          <dd>
            選定媒體後可查看直接文字比對與明示引用證據。每組直接配對附相似度與來源線索，完整分組可能包含圖上未顯示的媒體；最早刊登不代表原創或稿源。
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
            <dt className={methodTerm}>較早刊登</dt>
            <dd>沒有同署名或明示稿源線索的直接相似配對中，標示刊登較早的篇數；不代表原創。</dd>
            <dt className={methodTerm}>較晚刊登</dt>
            <dd>沒有同署名或明示稿源線索的直接相似配對中，標示刊登較晚的篇數；不代表跟稿。同一分鐘或時間未確認的配對不計先後。</dd>
            <dt className={methodTerm}>採用／引用他媒</dt>
            <dd>這家媒體文章內文明示採用／引用其他媒體的次數。</dd>
            <dt className={methodTerm}>被引用</dt>
            <dd>其他媒體文章內文明示引用這家媒體的次數。</dd>
            <dt className={methodTerm}>百分比</dt>
            <dd>較早刊登、較晚刊登與採用／引用他媒旁的百分比，是佔這家媒體比對篇數的比例；各媒體表為期間合計。</dd>
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
