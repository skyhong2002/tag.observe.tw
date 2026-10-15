import { methodHeading, methodList, methodTerm } from './styles';

// 即時看板 (/liveboard/) and its settings (/liveboard/setting/). The simple
// board (web/src/app/liveboard/SimpleBoard.tsx) plays /api/v1/ranking snapshots;
// its lenses are listed in web/src/app/liveboard/settings.ts.

export function LiveboardMethod() {
  return (
    <>
      <h3 className={methodHeading}>即時看板</h3>
      <p>
        即時看板是給常駐螢幕（牆上的平板、電視）用的全螢幕頁面，有兩種：精簡版只有一個文字雲，完整版輪流顯示新進新聞、新事件、各家標題對照與轉載比對。沒有設定過的裝置開啟精簡版；點看板左上角的新文易數可以進到設定。
      </p>
      <dl className={methodList}>
        <dt className={methodTerm}>鏡頭</dt>
        <dd>
          精簡版一次顯示一個「鏡頭」，每個鏡頭是一份標籤排行，取前 32 個關鍵字（設定裡可調成 12–80
          個），字越大分數越高：綜合（所有媒體，依分數，黑字或深色模式的白字）、正在發酵（所有媒體，依升溫量）、突然爆量（所有媒體，依爆發力）、新聞熱詞（新聞媒體，依分數），以及藍營、綠營、非主流、科技與
          3C、財經各類媒體自己的排行（依分數）。分數、爆發力與升溫量的算法見關鍵字排行。
        </dd>
        <dt className={methodTerm}>回看</dt>
        <dd>
          每個鏡頭先顯示過去的排行，再一格一格播到現在：預設每格 6 小時、往前 4 格（從 1 天前播起），可在設定改成每格 1 小時到 1
          天、最多往前 8 格（最遠 8
          天）。過去的排行是當時那一小時最後算出的快照，不是用現在的資料重算；還沒有資料的時間點會略過。每一格等動畫播完才開始計時，進度條顯示這一格還要停多久。
        </dd>
        <dt className={methodTerm}>跳過</dt>
        <dd>
          不想等一格停完，可以按鍵盤的 → 或 ←（簡報遙控器的翻頁鍵也可以）、在畫面上左右滑動，或點時間軸兩側的 ‹
          ›，換到下一個或上一個時間點；在「現在」再往後就換下一個鏡頭，在第一格再往前就回到上一個鏡頭的「現在」。點時間軸上的時間點會直接跳過去。
        </dd>
        <dt className={methodTerm}>動畫</dt>
        <dd>
          同一個鏡頭裡，留在排行上的詞會留在原位附近變大或變小，掉出去的詞縮小消失，新上榜的詞長出來；離原位太遠的詞改成原地淡出、新位置淡入。換鏡頭時只淡出淡入。
        </dd>
        <dt className={methodTerm}>變化量</dt>
        <dd>
          預設顯示名次變化，可在設定改成分數變化或關閉：換到下一格時，字旁邊（有圖的標在名字旁邊）標出和上一格相比的名次變化（▲ 上升、▼
          下降幾名）或分數變化（百分比）；上一格不在排行前 80 名的詞標「New」，沒有變化的不標。每個鏡頭的第一格不標。
        </dd>
        <dt className={methodTerm}>顏色與圖</dt>
        <dd>
          每個鏡頭的詞用同一個顏色，顏色只用來區分鏡頭，沒有其他意義。人物、國家、地點與品牌等有圖的標籤畫成圖，圖的顏色固定，不跟著鏡頭變。點一個詞會進到它的關鍵字頁。
        </dd>
        <dt className={methodTerm}>設定</dt>
        <dd>
          「畫面大小」縮放精簡版上的所有東西，給不能用瀏覽器縮放的平板與手機用：調小時字變小，搭配更多關鍵字就能放進更多內容。登入時設定存在帳號，在其他裝置登入也適用；未登入時只存在這台裝置的瀏覽器。網址參數（例如
          ?mode=full、?lens=blue,green、?interval=6、?words=48、?scale=80、?change=rank）只影響這次開啟，不會存檔。
        </dd>
      </dl>
    </>
  );
}
