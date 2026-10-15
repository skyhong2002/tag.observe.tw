import Link from 'next/link';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 標籤群組 (/group/, /group/{id}/, the chips on a tag page). Rules:
// app/src/tag-groups/, job: app/src/jobs/tag-groups-job.ts, API:
// app/src/v1/tag-groups.ts, write-up: docs/tag-groups.md. Keep the numbers
// here in step with those files.

export function GroupMethod() {
  return (
    <>
      <h3 className={methodHeading}>標籤群組</h3>
      <p>
        群組沿用舊站（
        <a href="https://tag.analysis.tw/" className={inlineLink}>
          tag.analysis.tw
        </a>
        ）的 28 個身分／類型群組（政治人物、藝人、外國政治人物、電視電影……）與 10
        個主題大類（政治、體育、娛樂……）。一個標籤可以同時在多個群組，例如川普同時在「外國政治人物」與「國際」。群組可以放在同類的另一個群組底下，上層群組的數字與排名包含子群組的標籤。
      </p>
      <p>
        立委、縣市長、縣市議員、內閣、北市府與六都市長候選人是任期名冊，以任期開始的年份命名，例如「2024 立委」「2022
        縣市長」；名單依中選會、立法院、行政院等官方資料整理，含補選、遞補與代理，不自動歸類，也不開放投票。新的任期另開一個名冊。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>怎麼分</dt>
        <dd>
          依序套用：舊站人工標記；人物標籤依 Wikidata 的國籍、職業與政黨；非人物標籤依 Wikidata
          的項目類型（公司、政府機關、電影、政黨、疾病、球隊……），但近期的版別也要對得上，否則列待確認；主題依各媒體把帶這個標籤的報導放在哪個版別，每家媒體一票，至少
          3 家媒體、占三成以上才算。以上都分不出來的，由 AI 依近期標題提出建議，一律列待確認，只供管理員參考，不會出現在讀者的投票裡。
        </dd>
        <dt className={methodTerm}>人工確認</dt>
        <dd>
          管理員可以確認、排除或手動加入；只有自動判斷與確認過的會公開，待確認與排除的不公開，排除的之後自動重跑也不會加回來。每天 04:55
          對本週新聞排行前 500 個標籤重跑一次。
        </dd>
        <dt className={methodTerm}>標籤關係與投稿</dt>
        <dd>
          上位分類表示「屬於哪一類」，可同時有多個分類並往上延伸；相關詞表示有明確關聯，同義或別名表示同一事物的不同名稱。
          報導中一起出現只屬共現統計，不會自動變成分類或同義關係。登入讀者可在標籤的「改關係」頁一題一題回答「是／不是」：題目來自讀者的提案、依資料建議的分類、Wikidata
          列出而且近 14 天標題真的這樣寫的別名，以及近 3
          天常一起出現的詞，每題附上依據；也可以從現有分類或關鍵字挑一個提出新的關係，理由可留空。至少 1
          位其他讀者回答「是」、且「是」比「不是」多就成立（提案者不能投自己的提案）；管理員可以鎖定或撤下。題目不用 AI 產生。
        </dd>
        <dt className={methodTerm}>篇數比較</dt>
        <dd>
          只算這段期間至少一次達到關鍵字排行第一道門檻（24
          小時內至少兩家新聞媒體各標了兩篇以上）的標籤；篇數是標了這個標籤的報導數，和再之前同樣天數相比，▲ 是增加、▼
          是減少、「新」是之前沒有。群組的篇數合計會重複計入同時標了兩個標籤的報導，只適合看同一群組前後的變化。數字每 5 分鐘更新。
        </dd>
      </dl>
      <p>
        標籤本身的來源見
        <Link href="/method/" className={inlineLink}>
          資料來源
        </Link>
        ；分類資料也可從 API <code>/api/v1/tag-groups</code> 取得。
      </p>
    </>
  );
}
