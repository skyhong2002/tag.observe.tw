<!--
round: r1
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = new (web 78adcff6), B = baseline (ffd6a5aa), C = reference
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：7.5 / 10
一句話總評：資訊扎實、交代清楚的媒體比較工具。空資料、錯誤、登入前這些狀態都有說明和下一步，手機排行也改成卡片。主要扣分在只靠顏色區分藍綠、首頁主視覺太鬧，以及幾張寬表格在手機上仍要橫向捲動。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7.5 | event_desktop：頁首寫「61 件事，依全天熱度排序」，下面依序是日期列、事件卡（圖、名次、標題、標籤、藍綠條、各家標題對照），右欄是「今天 61 件事」清單，主次清楚。home_desktop：前 380 px 全是文字雲加 logo，品牌字「新文易數」夾在中間，首頁頂部導覽列沒有 logo，第一眼不容易看懂這個網站是做什麼的。 |
| 字體排印 | 7 | article_desktop：標題粗黑，摘要和內文行高寬鬆，中英混排（Kimberly Powell、NVIDIA）處理得當。article_mobile：標題斷成「AI 教父婚外情連環／爆 黃仁勳辭輝達 CEO」，在詞中間斷行。ranking_desktop：文字雲最小的字約 10 px，幾乎讀不出來。 |
| 色彩 | 7.5 | 全站用一個橘紅主色，藍綠固定是 #0a7d4f 綠、#1f4fe0 藍，整體有系統。home-dark_desktop、media-outlet-dark_desktop：深色外觀把主色換成較亮的橘，卡片底色有層次，不是單純反白。ranking-dark_mobile：卡片在深底上仍分得清楚。 |
| 間距與版面 | 7 | home_desktop：三欄（熱門關鍵字／焦點事件／藍綠溫差）對齊工整。ranking_desktop：表格從 y≈880 才出現，前面被文字雲佔掉約 450 px。media-outlet_desktop：右欄的媒體資料、寫法、流量三張卡排得整齊。 |
| 一致性 | 7 | 期間膠囊（24 小時／3 天／7 天）、分頁籤、「本頁的資料來源與計算方式 ⓘ」在 ranking、journalist、similarity、search 用法一致。my-saved-out、my-saved-empty、search-none、event-empty 的空狀態卡都是「標題＋說明＋主要按鈕＋次要按鈕」同一套。eve-error_desktop：在事件頁出錯時，導覽列的「事件」沒有高亮。 |
| 資訊密度 | 7.5 | journalist_desktop：一屏約 27 列記者，帶刊登媒體、篇數、迷你長條，很好掃讀。event_desktop：每張事件卡含 4–5 則各家標題和網址，研究者夠用。ranking_desktop：文字雲 300 多個詞，太密反而沒有用。 |
| 導覽 | 7 | 桌機頂部導覽有分組和目前位置高亮（ranking_desktop 的「關鍵字」）。手機用漢堡選單加搜尋圖示。my-following_mobile：五個分頁擠在同一列可以點。media-outlet_desktop：有麵包屑「媒體 / 聯合新聞網」。首頁手機頂部沒有 logo、只有搜尋框，返回首頁的線索較弱。 |
| 狀態與回饋 | 8.5 | event-empty_desktop：「今天還沒有整理出事件」，說明原因，並給「看前一天（11/12）的事件」「看關鍵字排行」兩個按鈕。eve-error_desktop、ranking-error_desktop：給重新載入、看事件表／回首頁，再附上回報方式和代碼。search-none_desktop：說明搜尋範圍並給三個出口。my-saved-out_desktop：有卡片和「用 Google 帳號登入」按鈕。event-loading_desktop：骨架和實際的卡片版面一致。similarity-daily 與 similarity-reposts 兩張截圖完全相同，看不出「每日相似」的狀態。 |
| 響應式 | 7.5 | ranking_mobile：寬表格改成卡片（名次、關鍵字、分數·篇數·家數、走勢、爆發力），手機上很好讀。media_mobile、similarity-daily_mobile、journalist_mobile：仍是橫捲表格，「左右滑動看更多欄 →」提示壓在「比對篇數」欄名上，媒體名被截成「PChome Onli…」「NOWnews今…」。 |
| 文案 | 7.5 | 用語自然，符合台灣習慣：「近一個月」「看今天的事件」「相似不等於抄襲」。ranking_desktop 表頭下有一行定義「爆發力 分數加上近 48 小時的升幅…」。「相近，對方較早／相近，本篇較早」（journalist-person）較拗口。 |
| 無障礙 | 6.5 | home_desktop：焦點事件列表的藍綠小條（約 64 px）沒有數字或文字，只靠顏色，圖例放在列表下方。search_desktop：首頁卡片裡的藍綠條同樣問題。ranking_desktop：上升箭頭「▲」用紅色、文字小。主要事件卡的大比例條有「綠營 28%」字樣，這點不錯。 |
| 信任與清楚 | 8.5 | 幾乎每頁都有「本頁的資料來源與計算方式」。ranking_desktop：標出「11/13 08:00 時段・85 家媒體・12,333 篇・更新於 11/13 08:10」。media-outlet_desktop：收錄起日、最新報導、Similarweb 來源月份都有。journalist-person_desktop：說明「這一頁由各媒體公開刊出的署名自動整理」與移除方式。新聞列都印出原始網址和外連圖示。 |

要保留的優點：
- event-empty、eve-error、ranking-error、search-none、my-saved-empty 這套空／錯誤狀態卡：說明原因，並給一個主要、一個次要出口。
- ranking_mobile 的卡片式排行：名次、詞、分數·篇數·家數、走勢、爆發力與變動一列看完。
- event_desktop 事件卡裡「藍營／綠營」兩欄標題對照，以及下方附原始網址的各家標題。
- media-outlet_desktop 右欄「媒體資料」把收錄範圍、開始收錄、最新報導、流量資料日期全部列出。
- journalist-person_desktop 的逐字差異比對，以及「相似不等於抄襲 ⓘ」這類防誤讀的提示。
- 深色外觀（home-dark、media-outlet-dark、ranking-dark）把主色提亮、卡片分層，品牌感有延續到深色。

最重要的五個問題（由嚴重到輕微）：
1. [無障礙] [home_desktop] [兩者] 焦點事件列表每列的小藍綠比例條沒有數字或文字，只靠綠／灰／藍三色，圖例放在整個列表下方（y≈1092） —— 這是網站最核心的陣營判斷，色弱讀者和截圖轉貼時會失去意義 —— 小條旁加「綠 23%／藍 20%」短標，或滑過或點擊時顯示數字；另見 search_desktop 主要事件卡、home_mobile。
2. [資訊層級] [home_desktop] [兩者] 首頁頂部導覽列沒有 logo，前 380 px 被文字雲、企業 logo、人像插畫佔滿，「同一件事，各家怎麼說」只是中間的小字 —— 新訪客第一眼看不出這是比較各家報導的工具，品牌也和企業 logo 混在一起 —— 把文字雲收斂到一半高度，標語放大並放在固定位置，頂部導覽補上 logo；另見 home_mobile（頂部只有搜尋框）。
3. [響應式] [similarity-daily_mobile] [mobile] 各媒體表在手機仍橫捲，「左右滑動看更多欄 →」膠囊壓在「比對篇數」欄名和第二欄數字上，媒體名被截成「PChome Onli…」 —— 手機讀者看不到百分比欄，提示還遮住資料 —— 比照 ranking_mobile 改成卡片，或把提示移到表格上方；另見 journalist_mobile、media_mobile。
4. [資訊密度] [ranking_desktop] [desktop] 關鍵字排行頁的文字雲塞了 300 多個詞，最小約 10 px，表格要到 y≈880 才出現 —— 想看排名的人得先捲過一大片讀不出來的字，文字雲也和下面的表格重複 —— 文字雲限前 40–60 詞、壓縮高度，或改成可收合；另見 ranking-blue_desktop、ranking-dark_desktop。
5. [字體排印] [article_mobile] [mobile] 文章標題斷成「AI 教父婚外情連環／爆 黃仁勳辭輝達 CEO」，在「連環爆」中間斷行 —— 標題是文章頁最顯眼的元素，詞被切開會讀錯 —— 標題用 `text-wrap: balance`、`word-break: keep-all`，或在空白處優先斷行。

## 組 B
總分：6.5 / 10
一句話總評：骨架和 A 組相同、內容一樣豐富，但有幾處看得出來的毛病：事件列多出空白的迷你走勢框、HTML 實體字元外露、暫時性錯誤顯示成 404。空狀態多半只有一行灰字，手機排行仍是被截斷的寬表格。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7 | event_desktop：結構和 A 相同（頁首說明、日期列、事件卡、右欄清單），但第 1 名事件卡在名次列和標題之間多了一個灰色空框（y≈400–420），把標題往下推。home_desktop：首頁主視覺同樣是 380 px 的文字雲。 |
| 字體排印 | 7 | article_desktop、article_mobile 和 A 相同，手機標題同樣斷成「連環／爆」。tag_desktop：說明文字裡出現 `&#10;` 原始碼字元（y≈2000 附近）。 |
| 色彩 | 7 | 主色、藍綠語意色、深色外觀（home-dark_desktop、media-outlet-dark_desktop）和 A 相同，成立。ranking-error_desktop：「重新載入」改成黑色按鈕，和全站橘色主按鈕不一致。 |
| 間距與版面 | 6.5 | home_desktop（y≈1110 起）：每列事件的「上榜」時間旁多了一個淡灰長框，裡面只有一小撇藍線，看起來像沒載完的圖。event_desktop：第 2 名事件卡右上同樣有空框。event-empty_desktop：日期列只剩「‹ ›」兩個箭頭和一個空白長框。 |
| 一致性 | 6 | 錯誤頁：ranking-error 是「重新載入」黑色按鈕加錯誤代碼，eve-error 卻顯示 404 頁面，同類狀態兩種處理。search_desktop 的期間是「1 天／3 天／7 天／31 天」，其他頁是「24 小時／7 天／30 天」，用詞不統一。my-following_mobile：分頁的「設定」被擠到第二行。 |
| 資訊密度 | 7 | journalist_desktop、media-outlet_desktop 和 A 相同，資訊量足。ranking_mobile：每列只剩名次、關鍵字、爆發力，看不到篇數、家數和走勢，資訊太少。 |
| 導覽 | 6.5 | 桌機導覽與目前位置高亮正常（ranking_desktop）。eve-error_desktop：錯誤時只給一個搜尋框和六張入口卡，沒有「回到剛才的事件」或重試。my-following_mobile：分頁換行，「設定」單獨落到第二列。 |
| 狀態與回饋 | 5.5 | eve-error_desktop、eve-error_mobile：事件載入失敗卻顯示「404 找不到這個頁面」，誤導成網址錯誤。event-empty_desktop：只有一行「今天沒有事件資料。」，上方仍是空的日期列。search-none_desktop：只有「過去 31 天沒有符合『zzqxv』的文章。」，沒有建議。my-saved-empty_desktop：一行灰字，沒有按鈕。my-saved-out_desktop：登入只是內文裡的底線文字。ranking-error_desktop：有重新載入，但只有「錯誤代碼 3772224109」，不知道要拿代碼做什麼。 |
| 響應式 | 6 | ranking_mobile：寬表格直接縮進手機，「變動」欄在右緣被切掉，上升箭頭只露出半個（▲被截）。media_mobile、similarity-daily_mobile：同樣橫捲，媒體篩選膠囊換成多行堆疊，佔掉大半屏。 |
| 文案 | 6 | tag_desktop：外露 `&#10;`。eve-error_desktop：「網址可能打錯了」用在伺服器暫時錯誤上，說法不對。search_desktop：「1 天」「31 天」不如「24 小時」「近一個月」自然。 |
| 無障礙 | 6 | 藍綠小條只靠顏色的問題和 A 相同（home_desktop 事件列）。ranking_mobile：被截斷的上升箭頭只剩淡粉色碎片，看不出漲跌。多出的空走勢框可能讓讀屏器讀到無意義的圖。 |
| 信任與清楚 | 8 | 「本頁的資料來源與計算方式」、更新時間、原始網址都和 A 一樣齊全（ranking_desktop、media-outlet_desktop、journalist-person_desktop）。ranking_desktop：表格上方少了爆發力／分數／變動的定義行，讀者看不懂「爆發力 34.8」。 |

要保留的優點：
- event_desktop 的事件卡結構：藍綠兩欄標題對照、附網址的各家標題、「各媒體標題對照 →」。
- media-outlet_desktop 右欄的媒體資料、寫法、網站流量來源三張卡，收錄範圍和資料日期清楚。
- journalist-person_desktop 的逐字差異比對，以及「關於這一頁」的移除說明。
- 深色外觀（home-dark、media-outlet-dark）的主色和層次。
- ranking-error_desktop 至少保留「重新載入」「回首頁」兩個按鈕。

最重要的五個問題（由嚴重到輕微）：
1. [狀態與回饋] [eve-error] [兩者] 單一事件頁載入失敗，畫面卻是「404 找不到這個頁面／網址可能打錯了」 —— 讀者會以為事件被刪除或連結失效，不會重試，也可能不再回來 —— 區分「暫時無法取得」與「不存在」，前者給重新載入、看事件表與回報方式。
2. [文案] [tag] [兩者] 標籤頁內文出現 `&#10;` HTML 實體字元（tag_desktop y≈2000） —— 系統字串外露，直接傷害資料網站的可信度 —— 輸出前把實體解碼，或在顯示層換成換行。
3. [間距與版面] [event] [desktop] 事件卡和首頁事件列多出淡灰空框，裡面只有一小撇藍線（event_desktop 第 1 名卡 y≈400、第 2 名卡右上），看起來像壞掉的圖 —— 出現在最重要的頁面，讓整站看起來沒做完，也把標題往下推 —— 資料不足時不畫這個走勢框，或給固定高度和完整的走勢線；另見 home_desktop、event-hour_desktop。
4. [響應式] [ranking_mobile] [mobile] 關鍵字排行在手機是被截斷的寬表格，「變動」欄切在右緣，箭頭只剩半個，篇數、家數、走勢都看不到 —— 手機是主要使用情境，排行是核心頁 —— 改成卡片式列表（名次、詞、篇數·家數、走勢、爆發力與變動）；另見 ranking-blue_mobile、ranking-dark_mobile。
5. [狀態與回饋] [search-none] [兩者] 搜尋無結果、還沒有收藏、今天沒有事件都只有一行灰字，沒有原因也沒有下一步（search-none_desktop、my-saved-empty_desktop、event-empty_desktop 還剩一個空的日期列） —— 使用者走進死巷 —— 補上搜尋範圍說明、改寫建議，以及「看熱門關鍵字」「看前一天事件」等按鈕；另見 my-saved-out_desktop（登入只是內文連結）。

## 組 C
總分：7.5 / 10
一句話總評：參考組裡 Ground News 的偏向條和故事頁結構成熟，Verity 版面乾淨，但 Google 新聞手機版明顯溢出。Ground News 把可信度與所有權資料鎖在付費牆後，橫幅和訂閱按鈕也擠壓了首屏。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | ground-news-home_desktop：頭條大圖疊上「Left 29% / Center 27% / Right 44%」偏向條，左欄 Daily Briefing、右欄 Blindspot，主次分明。google-news-tw_desktop：「焦點提要／焦點新聞」標題清楚。ground-news-home_mobile：首屏前 310 px 是推廣橫幅和 Subscribe／Login。 |
| 字體排印 | 8 | ground-news-home_desktop：標題用粗體 sans，層級清楚。verity-home_desktop：標題粗體 sans 配襯線體副標，對比漂亮。google-news-tw_desktop：繁中字級適中、行高舒服。 |
| 色彩 | 8 | Ground News 用米色底，紅／白／藍代表左／中／右，系統一致。Verity 用黃色作為目前所在的圖示底色。白色的 Center 段落在米色底上對比偏低（ground-news-home_desktop 列表小條）。 |
| 間距與版面 | 7.5 | ground-news-home_desktop：三欄格線和分隔線整齊。verity-home_desktop：左側 210 px 圖示欄加中欄卡片，中欄只有約 550 px 寬，1440 寬螢幕留白過多，分類列尾端被截成「Social iss」。 |
| 一致性 | 7 | Ground News 首頁和故事頁共用頁首、趨勢標籤列與偏向條樣式。三個網站各自成套，但 Ground News 故事頁的 Upgrade 黑塊和其餘卡片風格落差大。 |
| 資訊密度 | 7 | ground-news-home_desktop：首屏約 8 則故事加 2 則 Blindspot。verity-home_desktop：首屏只有 1 張大圖卡，密度低。google-news-tw_desktop：首屏約 9 則標題，密度好。 |
| 導覽 | 8 | ground-news-home_mobile、verity-home_mobile：固定的底部分頁列（News／For You／Search／Blindspot／Local），手機效率高。ground-news-home_desktop：趨勢標籤列可一鍵追蹤。google-news-tw_mobile：頁首沒有搜尋和選單。 |
| 狀態與回饋 | 6 | 截圖裡沒有載入、空資料或錯誤狀態。ground-news-story_desktop：Factuality 和 Ownership 只顯示鎖頭和「Upgrade」，沒有給未付費讀者替代資訊。google-news-tw_desktop：「為你精選」只有登入提示。 |
| 響應式 | 6.5 | google-news-tw_mobile：內容從左側約 80 CSS px 開始，右側被截掉（分類列只露「台」、「瀏覽更多頭…」按鈕被切），明顯是桌機版面沒有收好。ground-news-home_mobile、verity-home_mobile：單欄重排合理，趨勢標籤列可以橫捲。 |
| 文案 | 7.5 | ground-news-story_mobile：「If you want to know if NVIDIA is credible… look no further. We rank NVIDIA as Unknown factuality.」是自相矛盾的樣板句。google-news-tw：用「1 小時前」等相對時間，自然。 |
| 無障礙 | 7.5 | ground-news-home_desktop：頭條偏向條有「Left 29%」等文字，不只靠顏色。列表小條只有「46% Right coverage」單一數字，其餘段落只靠色塊。verity-home_mobile：底部分頁列有圖示也有文字。 |
| 信任與清楚 | 7.5 | ground-news-home_desktop：Blindspot 說明附「Learn more about political bias」連結，偏向條附來源數。ground-news-story_desktop：方法論連結齊全，但可信度與所有權鎖在付費牆後，NVIDIA 被標為 unknown。google-news-tw：每則標出來源媒體和時間。 |

要保留的優點：
- ground-news-home_desktop 頭條大圖上的「Left／Center／Right＋百分比」偏向條，語意色和文字並存。
- Ground News 的 Blindspot 欄，以及一句話說明加方法論連結。
- ground-news-home_mobile、verity-home_mobile 的底部分頁列，手機一手可操作。
- google-news-tw_desktop 的焦點新聞群組：一張主圖加 3 則他報標題，最後是「瀏覽更多頭條新聞和觀點」。
- verity-home_desktop 的「Go Deeper」卡，用來源頭像串加數量表示涵蓋媒體。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [google-news-tw_mobile] [mobile] 手機版內容左側空出約 80 CSS px，右側被截斷（分類列只見「台」，「瀏覽更多頭」按鈕被切），頁首沒有搜尋和選單 —— 手機讀者看不完內容也點不到按鈕 —— 修正容器寬度與左側偏移，頁首補上搜尋與選單。
2. [信任與清楚] [ground-news-story] [兩者] 媒體／主題頁的 Factuality、Ownership 都鎖在「Upgrade」後，NVIDIA 的偏向評等是 unknown，文案卻說「look no further」 —— 判斷依據對一般讀者不透明，文字還和事實矛盾 —— 至少公開評等等級和資料來源，unknown 時改寫成「尚未評等」並說明原因。
3. [資訊層級] [ground-news-home] [兩者] 首屏頂部依序是推廣橫幅「See every side… Get Started」、深色工具列和 Subscribe／Login（手機約佔 310 CSS px） —— 新聞內容被推到首屏下半部 —— 合併或可關閉推廣橫幅，手機把訂閱收進選單；另見 ground-news-story_mobile。
4. [無障礙] [ground-news-home_desktop] [desktop] 列表裡的小偏向條只有紅／白／藍色塊，只標一個數字（「46% Right coverage」），白段在米色底上幾乎看不見 —— 色弱讀者分不出左右比例 —— 白段加外框或紋理，三段都附簡短數字。
5. [間距與版面] [verity-home_desktop] [desktop] 1440 寬只用中間約 1020 px，左欄 210 px 只有 4 個圖示，主欄卡片約 550 px 寬，分類列尾端被截成「Social iss」 —— 寬螢幕密度低，分類還被截斷 —— 放寬主欄或改成兩欄卡片，分類列加漸層和捲動提示。

```json
{"A": {"overall": 7.5, "scores": {"資訊層級": 7.5, "字體排印": 7, "色彩": 7.5, "間距與版面": 7, "一致性": 7, "資訊密度": 7.5, "導覽": 7, "狀態與回饋": 8.5, "響應式": 7.5, "文案": 7.5, "無障礙": 6.5, "信任與清楚": 8.5}, "issues": ["[無障礙] home_desktop 兩者：焦點事件列表的小藍綠比例條沒有數字，只靠顏色，圖例在列表下方（另見 search_desktop、home_mobile）", "[資訊層級] home_desktop 兩者：頂部導覽沒有 logo，前 380 px 是文字雲加企業 logo，標語太小，第一眼看不出網站用途（另見 home_mobile）", "[響應式] similarity-daily_mobile mobile：寬表格仍橫捲，「左右滑動看更多欄」膠囊壓在欄名和資料上，媒體名被截斷（另見 journalist_mobile、media_mobile）", "[資訊密度] ranking_desktop desktop：文字雲 300 多個詞、最小約 10 px，表格到 y≈880 才出現（另見 ranking-blue、ranking-dark）", "[字體排印] article_mobile mobile：標題斷成「連環／爆」，在詞中間斷行"]}, "B": {"overall": 6.5, "scores": {"資訊層級": 7, "字體排印": 7, "色彩": 7, "間距與版面": 6.5, "一致性": 6, "資訊密度": 7, "導覽": 6.5, "狀態與回饋": 5.5, "響應式": 6, "文案": 6, "無障礙": 6, "信任與清楚": 8}, "issues": ["[狀態與回饋] eve-error 兩者：事件載入失敗顯示成「404 找不到這個頁面」，沒有重試", "[文案] tag 兩者：標籤頁內文外露 `&#10;` HTML 實體字元（tag_desktop y≈2000）", "[間距與版面] event_desktop desktop：事件卡多出淡灰空白走勢框，只有一小撇藍線，把標題推下（另見 home_desktop、event-hour_desktop）", "[響應式] ranking_mobile mobile：寬表格被截斷，「變動」欄和箭頭切在右緣，看不到篇數、家數、走勢（另見 ranking-blue、ranking-dark mobile）", "[狀態與回饋] search-none 兩者：無結果、無收藏、無事件都只有一行灰字，沒有建議與出口（另見 my-saved-empty、event-empty、my-saved-out）"]}, "C": {"overall": 7.5, "scores": {"資訊層級": 8, "字體排印": 8, "色彩": 8, "間距與版面": 7.5, "一致性": 7, "資訊密度": 7, "導覽": 8, "狀態與回饋": 6, "響應式": 6.5, "文案": 7.5, "無障礙": 7.5, "信任與清楚": 7.5}, "issues": ["[響應式] google-news-tw_mobile mobile：內容左偏約 80 px、右側被截斷，分類列和按鈕被切，頁首沒有搜尋與選單", "[信任與清楚] ground-news-story 兩者：Factuality／Ownership 鎖在 Upgrade 後，NVIDIA 評等 unknown，文案還說「look no further」", "[資訊層級] ground-news-home 兩者：推廣橫幅加 Subscribe／Login 佔掉首屏頂部（手機約 310 px）", "[無障礙] ground-news-home_desktop desktop：列表小偏向條只靠色塊，白段在米色底上幾乎看不見，只標一個數字", "[間距與版面] verity-home_desktop desktop：主欄約 550 px 寬、左欄 210 px 只有 4 個圖示，分類列被截成「Social iss」"]}}
```
