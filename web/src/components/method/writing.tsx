import Link from 'next/link';
import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 看寫法 (/writing/, /writing/titles/), the 寫法 section of one article and of
// one outlet's sidebar. Rules: app/src/writing/rules.ts (VERSION), names:
// app/src/writing/people.ts, job: app/src/jobs/writing-job.ts, API:
// app/src/v1/writing.ts. Keep the numbers here in step with those files.

/** `brief` leaves out the role list and version history (article and outlet pages). */
export function WritingMethod({ brief = false }: { brief?: boolean }) {
  return (
    <>
      <h3 className={methodHeading}>寫法</h3>
      <p>
        「寫法」只描述文章文字本身寫了什麼，不評斷報導好壞或真假。每篇取得內文的文章在抓到後約 10
        分鐘內分析一次，結果永久保存；內文在快取期滿後會刪除，但分析結果仍留著，長期趨勢才能比較。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>轉述社群貼文</dt>
        <dd>
          內文前 250 字出現「在／於／透過……臉書、粉專、Threads、Instagram、X、YouTube、節目、直播、PTT、Dcard……發文、PO
          文、貼文、分享、表示」等寫法，代表這篇的開頭在轉述某人的貼文或節目發言。只看開頭，所以文中後段才引用的貼文不算。
        </dd>
        <dt className={methodTerm}>發文者身分</dt>
        <dd>
          看「在臉書……」前面、同一個逗號內的頭銜詞，例如「精神科醫師」「台北市長」「前立委」「網友」。句子裡只有名字時（「邱毅今天在臉書……」），改看這個名字在最近一週其他報導前面最常出現的頭銜：至少
          3
          次、同一類過半才採用；文字對不出來時，改用這個關鍵字所在的人物分組（例如「意見領袖」「藝人」）。只有確定是人物的關鍵字（在人物分組裡，或對應到
          Wikidata
          的人）才會這樣補，避免把「深夜」「學生」這類詞當成人名。每天更新一次，都對不出來的列為「身分未標明」。管理員可以修正某個名字的身分，修正會套用到所有提到這個名字的報導，並留下紀錄。
        </dd>
        {!brief && (
          <>
            <dt className={methodTerm}>身分分類</dt>
            <dd>
              依序比對，先符合的優先：網友民眾（網友、民眾、一名男子……）→ 前任公職（前立委、前部長……）→ 氣象 →
              評論名嘴（媒體人、名嘴、作家、主持人、政治工作者……）→ 醫療健康 → 公職政治（現任官員、民代、政黨、政府部會）→
              藝人網紅（藝人、網紅、運動員、星座命理……）→ 專家企業（律師、教授、分析師、董事長……）→
              公司、團體（公司、協會、基金會……）。轉述官員或政黨發文本來就是常見的新聞來源，分類只是讓讀者知道轉述的是誰。
            </dd>
          </>
        )}
        <dt className={methodTerm}>標題用詞</dt>
        <dd>
          依詞表比對標題：懸念（「1事」「原因曝」「回應了」「下場曝」等不說重點的寫法）、反應（「反應驚人」「傻眼」「一面倒」）、攻擊（「怒轟」「狠酸」「開嗆」）。一篇可以同時屬於幾類；詞表比對不理解上下文，例如「轟」也會出現在「轟炸」。
        </dd>
        <dt className={methodTerm}>比例的分母</dt>
        <dd>
          各家已分析的文章（取得完整內文者）。只取得摘要或內文過短的文章不分析，所以不列入分子也不列入分母。整批轉載其他媒體的轉載站不列入跨媒體比較。
        </dd>
        {!brief && (
          <>
            <dt className={methodTerm}>規則版本</dt>
            <dd>
              目前為 writing-v4（2026 年 10 月 11 日起；先前的 v1–v3
              只用了幾小時，會把「深夜」「一事」這類詞當成發文者）。規則調整時會換新版本號，仍保有內文的文章（約 90
              天內）會用新規則重算，更早的文章保留舊版本的結果，所以趨勢圖在換版前後可能出現跳動。
            </dd>
          </>
        )}
      </dl>
      {brief && (
        <p>
          各家比較與完整的分類規則見
          <Link href="/writing/" className={inlineLink}>
            看寫法
          </Link>
          。
        </p>
      )}
    </>
  );
}
