import Link from 'next/link';
import { REPOSITORY_URL, SIMILARITY_CAVEAT } from '@/lib/journalists';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 記者 (/journalist/) and one person's page (/journalist/[name]/). The window
// (7 days), the 200-character minimum and the Dice score are in
// app/src/similarity/compute.ts; the pages ask for pairs at 0.65
// (web/src/lib/journalists.ts); the index job runs every 10 minutes
// (app/src/worker.ts); 早／晚 needs a gap of a minute (app/src/journalists/aggregate.ts).

export function JournalistMethod() {
  return (
    <>
      <h3 className={methodHeading}>記者</h3>
      <p>
        記者頁從文章署名整理出人名與筆名，不含媒體、部門、通訊社、職稱與責任編輯；可看每個人在哪些媒體刊登、寫了幾篇，以及文章與其他媒體內文相近時的刊登先後。較晚刊登只是閱讀線索，不是抄襲判定。
      </p>
      <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        這些頁面由公開署名自動整理，不是本人建立的檔案。本人不希望出現在記者頁，可在
        <a
          href={`${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('記者頁移除請求')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-700 hover:underline dark:text-brand-400"
        >
          GitHub 提出移除請求
        </a>
        ，或由個人頁的「關於這一頁」直接送出。Issue 是公開的，請勿填寫名字以外的個資；送出後約 15 分鐘內下架。
      </p>
      <p>{SIMILARITY_CAVEAT}</p>
      <p>
        內文相近取自
        <Link href="/similarity/" className={inlineLink}>
          新聞關係圖
        </Link>
        的相似度索引：每篇有正文的文章（正規化後至少 200 字元）與前後 7 天內其他媒體的文章逐篇比對，以不重複的五字片段計算 Dice
        係數，記者頁列出索引中相似度 65% 以上的全部配對。索引每 10 分鐘處理新抓到的正文；標為「內容」的轉載站不列入比對。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>篇數與配對</dt>
        <dd>
          統計欄位以所選期間內此人署名的文章計數，同篇在每欄只計一次；不同欄可能重疊，不可相加。同署名配對兩端若都在期間內，兩篇都計入。文章對照仍以組呈現，一組是兩篇文章的直接比對。
        </dd>
        <dt className={methodTerm}>已比對</dt>
        <dd>相似度索引已比對的篇數。</dd>
        <dt className={methodTerm}>未見相近</dt>
        <dd>
          已完成比對，但沒有達到所選相似度門檻的他站文章。同署名配對兩端皆排除；尚未比對的文章不算。未收錄的來源、比對時間範圍與門檻都會影響結果，不能據此確認原創。
        </dd>
        <dt className={methodTerm}>首見報導</dt>
        <dd>
          首見篇數＝已比對文章集合，扣除「內文明示引用其他媒體」、「存在至少早一分鐘刊登的相近文章」及「刊登時間未確認」三類文章的聯集，同篇只扣一次。相近門檻為
          65%，比對前後 7
          天其他媒體文章；較早版本包含同署名及已註明來源配對。相差不到一分鐘視為同時刊登，可同時計入。配對任一端時間未確認時，該配對涉及的本人文章先排除。首見比例＝首見篇數
          ÷ 本期總篇數。
        </dd>
        <dt className={methodTerm}>排序與顯示</dt>
        <dd>
          預設顯示記者、刊登媒體、篇數、首見報導、內文相近與引用；「詳細欄位」可展開其餘統計，「進階篩選」可設定關係、篇數與比例範圍。每格同列顯示篇數與百分比。切換「篇數／百分比
          %」後點欄名排序，再點一次切換升冪／降冪；百分比排序套用於已比對至引用各欄。從姓名、媒體或總篇數切換百分比時，預設依首見報導比例降冪排列。刊登媒體只顯示前兩家，完整資料可見提示或個人頁。
        </dd>
        <dt className={methodTerm}>比例與篩選</dt>
        <dd>
          記者表各欄百分比均以該記者所選期間的總篇數為分母；未見相近不是原創率。可按篇數或比例排序，並交叉篩選刊登媒體、關係類型、最低篇數、已比對比例與指定欄位的比例範圍。關係按鈕表示該欄至少一篇；媒體篩選不會把統計縮限到單一媒體。尚未比對的文章不屬於未見相近。
        </dd>
        <dt className={methodTerm}>內文相近</dt>
        <dd>有至少一篇他站相近文章的署名篇數；同一新聞稿、通訊社稿、授權轉載與引用都會相近。</dd>
        <dt className={methodTerm}>對方較早</dt>
        <dd>他站相近文章比此人文章早至少一分鐘刊登的署名篇數；刊登時間以各站標示為準，不含同署名跨站或已註明來源。</dd>
        <dt className={methodTerm}>本篇較早</dt>
        <dd>此人文章比他站相近文章早至少一分鐘刊登的署名篇數，同樣不含同署名跨站或已註明來源。相差不到一分鐘算同時刊登，兩欄都不計。</dd>
        <dt className={methodTerm}>同署名</dt>
        <dd>有他站相近文章也署同一名字的署名篇數，可能是同稿跨站刊登；同名不保證同一人。</dd>
        <dt className={methodTerm}>已註明來源</dt>
        <dd>排除同署名後，有彼此明示引用或共同明示來源之相似配對的署名篇數，不計入較早／較晚。</dd>
        <dt className={methodTerm}>引用</dt>
        <dd>內文明示引用其他媒體的篇數。</dd>
        <dt className={methodTerm}>有正文</dt>
        <dd>站內可閱讀正文的篇數（正文在刊登後 7 天內可於站內閱讀）；平均字元是這些正文的平均字元數。</dd>
        <dt className={methodTerm}>未納入比對</dt>
        <dd>有正文但不在相似度索引裡：還在等下一輪比對（即「尚待比對」），或刊登媒體是標為「內容」的轉載站。</dd>
        <dt className={methodTerm}>常寫主題</dt>
        <dd>這段期間此人文章最常帶的標籤，最多 30 個，數字為篇數。</dd>
      </dl>
    </>
  );
}
