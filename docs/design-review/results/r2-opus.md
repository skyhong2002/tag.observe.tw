<!--
round: r2
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = reference, B = baseline (ffd6a5aa), C = new (web d57f64b3)
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：8 / 10
一句話總評：成熟的國際新聞聚合與偏向比較產品。層級清楚、元件一致，但頁面類型少，在地化與資料深度不如另外兩組。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8.5 | ground-news-story desktop：事件標題最大，下方緊接左／中／右的偏向分布與報導來源數，主次清楚。google-news-tw desktop：頭條、來源、時間依序排列，一眼看得懂。 |
| 字體排印 | 8 | google-news-tw desktop／mobile：中文標題字級與行高穩定，來源與時間用小一級的灰字。ground-news-home mobile：英文長標題換行自然，不過卡片內小字偏小。 |
| 色彩 | 8 | ground-news-home desktop：偏向色條是整個產品的識別，語意固定。google-news-tw 以中性色為主、強調色克制。verity-home 配色較平淡、沒有記憶點。 |
| 間距與版面 | 8 | google-news-tw desktop：左側欄、主欄、右側欄的格線整齊。ground-news-story desktop：主欄加來源側欄，1440 寬用得充分。verity-home desktop 留白偏多。 |
| 一致性 | 8.5 | ground-news-home 與 ground-news-story 的卡片、偏向色條、標籤樣式一致。google-news-tw 的卡片圓角與分隔統一。 |
| 資訊密度 | 7.5 | ground-news-home desktop：一屏約 6–8 則新聞，附偏向數據。verity-home desktop：大卡片使一屏內容偏少。 |
| 導覽 | 8 | google-news-tw mobile：頂部分類分頁可橫向滑動。ground-news-home mobile：底部有分類入口，目前位置有標示。 |
| 狀態與回饋 | 6 | 只提供有資料的狀態，沒有載入、空資料、錯誤的截圖可評，依可見部分給分。 |
| 響應式 | 8.5 | ground-news-story mobile：偏向條與來源列表改成單欄、不溢出。google-news-tw mobile：卡片與縮圖比例在手機上重新安排過，不是單純縮小。 |
| 文案 | 8 | google-news-tw：「完整報導」等用語自然。Ground News 為英文介面，不符合本站的台灣讀者情境，但用語本身精準。 |
| 無障礙 | 7.5 | ground-news-story：偏向色條同時有 Left／Center／Right 文字與百分比，不只靠顏色。google-news-tw 部分灰色小字對比偏低。 |
| 信任與清楚 | 7.5 | ground-news-story：列出各來源與偏向評等依據的入口。google-news-tw 的來源與時間清楚，但沒有說明排序與收錄方式。 |

要保留的優點：
- ground-news-story 的偏向分布條同時有文字標籤和百分比，是陣營資訊的好範例。
- google-news-tw 每則新聞的「來源 · 時間」排列規則一致，掃讀快。
- ground-news-home 的卡片、色條、標籤是同一套系統，各頁一致。
- 手機版有針對單欄重新編排，不是單純縮放桌面版。

最重要的五個問題（由嚴重到輕微）：
1. [信任與清楚] [google-news-tw] [兩者] 沒有說明排序依據與收錄範圍 —— 讀者無法判斷「頭條」是怎麼選出來的 —— 在區塊標題旁加上簡短的計算說明。
2. [資訊密度] [verity-home] [desktop] 大卡片與大量留白，一屏只有少數幾則 —— 長時間比對資料的使用者效率低 —— 提供緊湊列表模式。
3. [無障礙] [google-news-tw] [mobile] 來源與時間的灰色小字對比不足 —— 戶外閱讀不易辨識 —— 提高次要文字的對比。
4. [色彩] [verity-home] [兩者] 配色接近預設樣式，品牌辨識弱 —— 和其他新聞站難以區分 —— 建立一組有個性的強調色。
5. [文案] [ground-news-home] [兩者] 全英文介面，偏向分類（Left／Right）不對應台灣的藍綠語境 —— 不能直接套用 —— 只參考它的結構，不參考它的用語。

## 組 B
總分：6.5 / 10
一句話總評：資料豐富、品牌鮮明，但空資料、錯誤、登入前等狀態大多只有一行字或錯置的頁面，排行頁文字雲過密，篩選與用語也不一致。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 6.5 | home desktop／mobile：首屏是關鍵字文字雲加上「新文易數／同一件事，各家怎麼說」，但沒有任何一句說明網站在做什麼、下一步去哪，第一次來的人只看到一堆橘字。event desktop：第 1 名事件的排名列下方有一個空的灰色方塊（約 x=512, y=396），干擾標題的層級。 |
| 字體排印 | 7 | eve desktop：事件標題、摘要、來源的層級清楚，中英混排（NVIDIA、Kimberly Powell）正常。ranking desktop：文字雲最小一級的字約 9–10px，大量詞擠在一起，很難辨讀。 |
| 色彩 | 7 | 橘色品牌一致，綠營、藍營各用綠、藍色條。home-dark desktop：深色背景配亮橘可以成立。tag desktop：時間區間的選中狀態是黑色「3 天」，其他頁的選中狀態都是橘色，系統不一致。 |
| 間距與版面 | 7 | event desktop：主欄加「今天 61 件事」側欄，有善用寬螢幕。search-none desktop：結果框只佔左側約 800px，下方大片留白。my-saved-empty desktop：只有一行字，整頁空蕩。 |
| 一致性 | 6 | 時間篩選的寫法：search 是「1 天／3 天／7 天／31 天」，tag 是黑底「1 天／3 天／7 天」。錯誤頁的按鈕：ranking-error 用黑色「重新載入」，其他主要按鈕都是橘色。media desktop：四排篩選 chip 都沒有列名稱。 |
| 資訊密度 | 6.5 | ranking desktop：文字雲約 400 個詞，佔掉首屏，表格要往下捲到約 y=850 才出現。media desktop：表格欄位多但仍能掃讀。event desktop：一張事件卡同時塞了媒體圖示列、對照、三則連結，略顯擁擠。 |
| 導覽 | 7 | 桌面頂部九個主選單，目前頁會反白（event、ranking、media）。event mobile：日期條左側被切掉（「週一 /09」只露出一半）。event-empty desktop：日期條只剩左右箭頭、沒有日期，無法回到前幾天。 |
| 狀態與回饋 | 4.5 | eve-error desktop：資料載入錯誤卻顯示「404 找不到這個頁面」，訊息錯誤。event-empty desktop：只有「今天沒有事件資料。」一行，同時仍顯示 24 小時藍綠條與「藍綠家數比約 50：50」，互相矛盾。search-none：只有一句「過去 31 天沒有符合…」，沒有建議。my-saved-out：只有文字連結「登入」。ranking-error：外露「錯誤代碼 3772224109」。event-loading desktop：骨架是單欄列表，和實際的卡片加側欄版型不同。 |
| 響應式 | 6.5 | ranking mobile：篩選 chip 換行成 6 排，文字雲又佔約一屏半，表格被推得很遠。event mobile：日期條左緣被截斷。my-saved-out mobile：分頁的「設定」被擠到第二行。媒體表在手機可橫捲，但沒有提示。 |
| 文案 | 6.5 | media desktop：「新聞 (Only) 2」「財經 (其他)」「泛白」等內部分類名外露。tag desktop：「相似 191 篇 · 66 群（已比對 1238／1311 篇）」很難理解。my-following：事件只寫「事件 #4128」，看不出是哪件事。event 的日期選擇器是「11/13/2026」美式格式。 |
| 無障礙 | 6 | search desktop：主要事件卡的藍綠只有一條細色條、沒有數字（例如「黃仁勳下台懶人包」卡），只靠顏色傳達。event desktop：「其他 76%」色條兩端的綠、藍細段沒有標示。ranking desktop：文字雲最小字與淺色 chip 對比偏低。 |
| 信任與清楚 | 7 | 幾乎每頁都有「本頁的資料來源與計算方式」，頁尾有收錄量與更新時間。ranking desktop：「爆發力／分數／變動」沒有就地說明。新聞列有原始網址與外連圖示，值得肯定。 |

要保留的優點：
- 「新文·易數」字標加上橘色系，品牌辨識強；home-dark 的深色主題有個性，不是灰階預設。
- eve desktop 的「重點報導」卡片：媒體、陣營點、時間、標題、摘要、原始網址都在，層級清楚。
- event desktop 的「今天 61 件事」側欄索引，方便在長頁面裡跳轉。
- 新聞列印出原始 URL 與外連圖示，離站連結清楚（eve、my-saved）。
- tag desktop 的報導趨勢圖：篇數柱、移動平均、名次三條序列加圖例，資料完整。
- 「本頁的資料來源與計算方式」入口在各頁位置一致。

最重要的五個問題（由嚴重到輕微）：
1. [狀態與回饋] [eve-error] [desktop] 事件載入失敗時顯示「404 找不到這個頁面」 —— 誤導使用者以為網址錯了，不會按重試 —— 改成「事件頁暫時無法載入」，附重新載入與回事件表。
2. [狀態與回饋] [event-empty] [兩者] 空資料只有「今天沒有事件資料。」，日期條沒有日期，上方卻還顯示藍綠比例 —— 使用者卡住，資訊也互相矛盾 —— 說明原因（剛過午夜），提供「看前一天」的按鈕，並隱藏無意義的統計。另見 search-none、my-saved-empty、my-saved-out 都只有一行字。
3. [資訊密度] [ranking] [兩者] 約 400 個詞的文字雲佔掉首屏，最小字幾乎讀不到，表格被推到下方 —— 排行頁的核心是表格 —— 文字雲只保留前 60–80 名、放大字級，並讓表格進到首屏。
4. [無障礙] [search] [desktop] 主要事件小卡只有細色條表示藍綠，沒有數字 —— 色弱者無法判讀，也不知道比例 —— 在色條旁加上「綠 x%・藍 y%」文字。另見 event 的「其他 76%」色條。
5. [一致性] [tag／search／ranking-error] [desktop] 時間篩選與按鈕樣式各頁不同（黑底「3 天」、「31 天」、黑色主要按鈕） —— 降低整體的專業感 —— 統一 chip 的選中色與時間區間的用詞。

## 組 C
總分：7.5 / 10
一句話總評：版型與資料和 B 同一套，但補齊了空資料、錯誤、登入前的說明與下一步，排行與陣營標示也更好讀；剩下首屏說明不足、手機篩選列與內部術語的問題。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7.5 | home desktop／mobile：文字雲下方加了「四周是今天正在升溫的關鍵字。新文易數收集台灣與部分國際新聞媒體的公開報導…」，並附「看今天的事件 →」「資料怎麼來」，第一次來的人知道這是什麼網站。event desktop：第 1 名事件卡已經沒有空的灰色方塊，標題直接接在排名列之後。 |
| 字體排印 | 7.5 | ranking desktop：文字雲改為較少的詞、字級較大，可以辨讀。eve desktop：標題與摘要的行高舒適。media desktop：表頭與數字欄對齊。卡片 meta 小字仍偏小（例如 search desktop 的「綠 14%・藍 10%」約 10px）。 |
| 色彩 | 7.5 | 時間 chip 的選中狀態統一為橘色（tag desktop「3 天」、search「24 小時」）。ranking-error、eve-error 的主要按鈕改為橘色。home-dark、eve-dark、ranking-dark 的深色主題成立，橘色在黑底上有辨識度。 |
| 間距與版面 | 7.5 | event-empty desktop：空狀態是置中的虛線框，有標題、說明、兩個按鈕，比例合宜。my-saved-out desktop：登入說明改為卡片。search-none desktop：建議框寬約 800px，右側仍有留白。 |
| 一致性 | 7.5 | 時間篩選統一為「24 小時／3 天／7 天／近一個月」（search、search-none、tag）。空狀態、錯誤狀態都採用「標題＋說明＋橘色主要按鈕＋次要按鈕」的同一套結構（event-empty、search-none、my-saved-empty、eve-error、ranking-error）。 |
| 資訊密度 | 7 | ranking desktop：表格約在 y≈690 開始，加上「更多欄位 →」提示，首屏可以看到前幾名。media desktop：篩選列加了列名稱（收錄狀態、媒體標籤、媒體傾向、報導範圍），但仍有五排、約 50 個 chip，把表格往下推。 |
| 導覽 | 7 | 桌面主選單有目前位置的反白。event mobile：日期條左緣仍被截斷（「週一 /09」）。ranking mobile：媒體分類 chip 改成單列橫捲，但右緣只露出半個「非」字，沒有明確的捲動提示。 |
| 狀態與回饋 | 8 | event-empty：「今天還沒有整理出事件」並說明原因，附「看前一天（11/12）的事件」「看關鍵字排行」。search-none：說明只搜標題、摘要、標籤，給兩條建議與三個去處。eve-error：正確顯示載入失敗，附重新載入、看事件表與聯絡方式。event-loading：骨架與實際的卡片加側欄版型一致。my-saved-out：卡片內有「用 Google 帳號登入」按鈕。 |
| 響應式 | 7 | my-saved-out mobile：「我的動態…設定」分頁收在一列。search-none mobile：三個按鈕自動換行，沒有溢出。ranking mobile：表格改為卡片列表，附欄位說明「名次・關鍵字（分數・篇數・媒體家數）」。文字雲在手機仍佔將近一屏。 |
| 文案 | 7 | search-none：「搜尋比對標題、摘要與標籤，不搜內文」清楚、自然。my-following：事件改成「黃仁勳、NVIDIA、輝達 事件 #4128」。但 media 仍有「新聞 (Only) 2」「泛白」「財經 (其他)」，tag 仍有「相似 191 篇・66 群（已比對 1238／1311 篇）」，日期選擇器仍是「11/13/2026」。 |
| 無障礙 | 7 | search desktop／mobile：每張事件小卡的色條旁加了「綠 22%・藍 17%」文字，不再只靠顏色。卡片 meta 小字與淺色 chip（例如 media 的「專題 無近期報導」）對比仍偏低。event desktop：「其他 76%」色條兩端的綠藍細段仍沒有標示。 |
| 信任與清楚 | 8 | ranking desktop：表格上方就地說明「爆發力：分數加上近 48 小時的升幅；橘字表示正在升溫／分數：每家媒體都報一篇約 50 分…／變動：名次和 24 小時前相比」。home 的「資料怎麼來」連結。錯誤頁說明可以到「聯絡與移除請求」並附上編號。 |

要保留的優點：
- 空資料、無結果、未登入、沒有收藏、載入錯誤都採用「標題＋原因＋主要與次要行動」的一致結構（event-empty、search-none、my-saved-out、my-saved-empty、eve-error）。
- ranking desktop 表格上方的指標說明列，直接回答「爆發力是什麼」。
- search 事件小卡在色條旁加上「綠 x%・藍 y%」文字。
- home 文字雲下方的網站說明與「看今天的事件 →」入口。
- event-loading 的骨架與真實版型一致，載入完成時版面不會跳動。
- media desktop 的篩選列加上列名稱，可以分辨每排在篩選什麼。

最重要的五個問題（由嚴重到輕微）：
1. [文案] [media] [兩者] 媒體標籤外露內部分類名，例如「新聞 (Only)」「財經 (其他)」「泛白」「軟體介紹」，數量多又沒有分組 —— 讀者看不懂，也削弱分類的可信度 —— 把標籤名稱改寫成讀者語言，並把冷門的標籤收進「更多」。另見 tag desktop 的「相似 191 篇・66 群（已比對…）」。
2. [資訊密度] [media] [desktop] 五排、約 50 個篩選 chip 把媒體表推到首屏下緣（表格約從 y≈1510 開始） —— 研究者來這頁主要是看表 —— 預設只顯示「傾向」與「範圍」，其他收進「更多篩選」。
3. [導覽] [ranking] [mobile] 媒體分類改成橫捲後，右緣只露出半個「非」字，沒有漸層或箭頭提示 —— 使用者不知道右邊還有「藍營傾向媒體」等重要選項 —— 加上邊緣漸層或「更多」按鈕，並把藍綠兩個選項提到前面。另見 event mobile 日期條左緣被截斷。
4. [無障礙] [event] [desktop] 第 1 名事件卡的「其他 76%」色條，兩端的綠、藍細段沒有文字，卡片 meta 小字約 10px —— 陣營比例仍然只靠顏色 —— 套用 search 小卡的「綠 x%・藍 y%」做法，並把 meta 字級提高到 12px 以上。
5. [響應式] [home] [mobile] 文字雲在手機上佔約 800 CSS px，網站說明與焦點事件被推到第二屏 —— 手機使用者第一眼看不到新聞 —— 手機版把文字雲壓縮成 2–3 行，或改成橫向滑動的關鍵字列。另見 ranking mobile。

```json
{"A": {"overall": 8, "scores": {"資訊層級": 8.5, "字體排印": 8, "色彩": 8, "間距與版面": 8, "一致性": 8.5, "資訊密度": 7.5, "導覽": 8, "狀態與回饋": 6, "響應式": 8.5, "文案": 8, "無障礙": 7.5, "信任與清楚": 7.5}, "issues": ["google-news-tw 兩者：沒有說明排序依據與收錄範圍", "verity-home desktop：大卡片與留白過多，一屏內容少", "google-news-tw mobile：來源、時間的灰色小字對比不足", "verity-home 兩者：配色接近預設，品牌辨識弱", "ground-news-home 兩者：英文 Left/Right 不對應台灣藍綠語境"]}, "B": {"overall": 6.5, "scores": {"資訊層級": 6.5, "字體排印": 7, "色彩": 7, "間距與版面": 7, "一致性": 6, "資訊密度": 6.5, "導覽": 7, "狀態與回饋": 4.5, "響應式": 6.5, "文案": 6.5, "無障礙": 6, "信任與清楚": 7}, "issues": ["eve-error desktop：載入錯誤卻顯示 404 找不到這個頁面", "event-empty 兩者：只有一行字、日期條空白，仍顯示藍綠比例；search-none、my-saved-empty、my-saved-out 也只有一行字", "ranking 兩者：約 400 詞的文字雲佔首屏、最小字難讀，表格被推下去", "search desktop：事件小卡藍綠只靠細色條、沒有數字", "tag/search/ranking-error desktop：時間 chip 用詞與選中色、主要按鈕顏色各頁不一致"]}, "C": {"overall": 7.5, "scores": {"資訊層級": 7.5, "字體排印": 7.5, "色彩": 7.5, "間距與版面": 7.5, "一致性": 7.5, "資訊密度": 7, "導覽": 7, "狀態與回饋": 8, "響應式": 7, "文案": 7, "無障礙": 7, "信任與清楚": 8}, "issues": ["media 兩者：外露「新聞 (Only)」「財經 (其他)」「泛白」等內部分類名；tag 的「相似…群（已比對…）」難懂", "media desktop：五排約 50 個篩選 chip 把表格推到首屏下緣", "ranking mobile：分類 chip 橫捲沒有提示，右緣只露出半個字；event mobile 日期條左緣被截斷", "event desktop：「其他 76%」色條兩端的綠藍沒有文字，meta 小字約 10px", "home mobile：文字雲佔約 800px，說明與焦點事件被推到第二屏"]}}
```
