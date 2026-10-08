import { CampBasis } from '@/components/method/events';
import { methodHeading, methodList, methodTerm } from '@/components/method/styles';

export default function HeadlineComparisonNotes() {
  return (
    <>
      <h3 className={methodHeading}>標題比較</h3>
      <dl className={methodList}>
        <dt className={methodTerm}>資料來源</dt>
        <dd>
          顯示事件資料目前回傳的全部標題，依事件關鍵字收錄，可能包含不同進展；資料來源單次最多提供 400 則。
          未取得報導資料時，改顯示事件快照保留的標題；快照沒有提供發稿時間。
        </dd>
        <dt className={methodTerm}>每家一則</dt>
        <dd>
          每家媒體先顯示一則，優先呈現貼近事件進展、用字不同的標題；同一家媒體的其他報導可在該則下方展開，依發稿時間由新到舊排列。
          標題依文字差異與事件相關度排序，並非觀點或真偽評分。
        </dd>
        <dt className={methodTerm}>文字高亮</dt>
        <dd>
          以完整詞組比較跨媒體用字，只高亮少量較具辨識度的獨有詞句，排除新聞前綴、一般用語、短碎詞及整段長句。
          每則最多兩處，高亮文字不超過標題四分之一；同一家媒體重複使用的詞句，不算跨媒體共通用字。
          預設顯示與展開後的標題採相同的比較範圍。文字差異只表示用字不同，請自行判讀報導角度。
        </dd>
      </dl>
      <h3 className={methodHeading}>媒體傾向分類</h3>
      <CampBasis />
    </>
  );
}
