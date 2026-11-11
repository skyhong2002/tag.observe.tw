import { methodHeading, methodList, methodTerm } from './styles';

export function ObservationMethod() {
  return (
    <>
      <h3 className={methodHeading}>長期觀察</h3>
      <dl className={methodList}>
        <dt className={methodTerm}>固定條件</dt>
        <dd>
          主標籤必須出現；設定搭配詞時，同篇還須有任一搭配詞。逐字比對現存文章標籤，不推測別名，不使用 AI 歸類。條件保存在網址，最多 30
          組觀察清單保存在此瀏覽器，沒有帳號同步。重開儲存的觀察顯示最近 180 天，每次最多查詢 366 天。
        </dd>
        <dt className={methodTerm}>報導與來源</dt>
        <dd>
          包含歷史匯入資料。同一文章編號只計一次，不同編號的轉載稿仍各自計數。標籤缺漏、不同寫法或收錄不足都可能造成空白期；零篇不能當作媒體未報導的證據。
        </dd>
        <dt className={methodTerm}>獨立事件</dt>
        <dd>
          同一小時的主要標籤須符合條件才列入，保留各段原有事件編號，不將整段事件的全部文章併入篇數。事件快照始於
          2026-09-28，較早的文章可能只有統計、沒有事件段落。事件連結開啟完整歷程。
        </dd>
        <dt className={methodTerm}>日期回看</dt>
        <dd>
          依刊登日期、現存標籤與事件快照重建，不是當時已收錄內容的完整封存。後來補收或標籤修正可能改變舊日期的數字。回看日之後的統計留空，部分週或月只計算至回看日。
        </dd>
        <dt className={methodTerm}>查詢界線</dt>
        <dd>
          最多 25,000 篇報導、20,000 個候選事件串及 1,000 個符合事件串；超限或查詢失敗顯示無法取得，不以截斷統計或零筆代替。快取最長 60 秒。
        </dd>
      </dl>
    </>
  );
}
