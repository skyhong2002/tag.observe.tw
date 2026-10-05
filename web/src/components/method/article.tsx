import Link from 'next/link';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// One article (/article/[id]/). Bodies are public for 7 days after publication
// (app/src/v1/article-content.ts); a body under 200 characters is 'short' and
// only 'ok' bodies are compared (app/src/crawl/article-content.ts,
// app/src/jobs/similarity-job.ts, app/src/similarity/compute.ts MIN_BODY).
// 延伸閱讀: ±3 days, 8 other-outlet stories (2 per outlet), 5 from the same
// outlet, 3 events (app/src/v1/article-related.ts). 他站相似報導: ±7 days at
// 0.65 (web/src/lib/similarity.ts), indexed every 10 minutes (app/src/worker.ts).

export function ArticleMethod() {
  return (
    <>
      <h3 className={methodHeading}>單篇文章</h3>
      <p>文章頁只顯示內文或摘要的開頭約 150 字，以及收錄配圖。節錄下方顯示原站完整網址，可開啟原站文章，閱讀全文、其他圖片與影音。</p>
      <dl className={methodList}>
        <dt className={methodTerm}>內文狀態</dt>
        <dd>
          「內文較短」表示擷取到的文字不足 200
          字，可能不完整，且不納入全文相似度比對，只有完整正文才比對。「原站僅提供摘要」表示來源提供的是節錄，本站不當成完整正文。
        </dd>
        <dt className={methodTerm}>發現來源</dt>
        <dd>「由某來源發現」標示本站經由哪個彙整來源（例如 Google 新聞）找到這篇文章，連結指向該來源上的頁面。</dd>
        <dt className={methodTerm}>文中引用來源</dt>
        <dd>內文明示提到的其他媒體，附上提到它的原文片段。文章提及的來源，不代表原始作者。</dd>
        <dt className={methodTerm}>延伸閱讀</dt>
        <dd>
          刊登前後 3 天內同一題的其他報導：依共同關鍵字的稀有程度與標題相近程度排序，標題幾乎相同的轉載只列一篇。至少共有 3 個關鍵字，或共有
          1、2 個關鍵字且標題夠相近，才列入；其他媒體每家最多 2 篇、共 8 篇，同一媒體最多 5
          篇，已列在「他站相似報導」的不重複列出。「所屬事件」是刊登前後一天內、主要標籤與本篇關鍵字重疊（至少 2
          個，或重疊的關鍵字夠少見）的事件，最多 3 件。相關關鍵字後的數字為前後 3 天內使用這個關鍵字的媒體與報導數。
        </dd>
        <dt className={methodTerm}>他站相似報導</dt>
        <dd>
          與前後 7 天內其他媒體文章的內文比對（
          <Link href="/similarity/" className={inlineLink}>
            新聞關係圖
          </Link>
          的相似度索引，正規化內文的五字片段），列出相似度 65% 以上的文章；索引每 10
          分鐘處理新抓到的正文。「內文相同」表示正規化後全文一致；相差不到一分鐘算同時刊登。
        </dd>
      </dl>
      <p>相似不等於抄襲：同一份新聞稿、通訊社稿、授權轉載與註明引用都會讓內文相近；刊登時間以各站標示為準，與寫稿先後無關。</p>
    </>
  );
}
