<!--
round: r10 (last stage-1 round; the new set never scored ≥9, so no council round)
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = baseline (ffd6a5aa), B = reference, C = new (web c2f179db)
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
Maintainer notes: C issue 2 is the media icons clipped inside their own cell (the table itself measured 1246/1246 px at
1440); C issue 3 is the inventory (/similarity/daily/ redirects). Not changed: the run stops at its round cap.
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：7 / 10
一句話總評：資料很完整，桌面版的骨架也成熟；但手機上的寬表格會被截斷、各種狀態頁太簡陋（事件頁載入錯誤時甚至顯示成 404），還有幾處空白占位與內部編號露出來，整體不夠精緻。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7 | home desktop 首屏是一團關鍵字＋人物插畫，中間放 LOGO，下面接著「熱門關鍵字／焦點事件／藍綠溫差」三欄，但沒有任何一句話說明網站在做什麼；ranking desktop 的文字雲有數百個 8–10px 的小字，搶走了排行表的注意力；event desktop 的事件卡依序是名次、藍綠條、各家標題，主次是對的。 |
| 字體排印 | 7 | journalist desktop、topic desktop 的表格與後設資訊大多只有 11–12px，長時間比對很吃力；article desktop 的正文欄只有約 700px 寬，行長還可以，但「本文共827字」緊貼在正文上方，而且用 1 天、31 天這類不一致的數字表達；ranking desktop 文字雲的最小字級幾乎無法閱讀。 |
| 色彩 | 7 | 橘色品牌加上綠營、藍營語意色，整體有系統；但 tag desktop 與 tag mobile 的「關鍵字變化」時間軸用藍色長條，容易和藍營的語意色混淆；tag mobile 的「3天」選中狀態是黑底，其他頁的選中狀態都是橘底；ranking-dark、media-outlet-dark 的深色外觀有成立，橘色字在黑底上有個性。 |
| 間距與版面 | 6.5 | article desktop 是單欄，右側留下約 700px 空白，延伸閱讀全部堆在正文下方；ranking-error desktop 的錯誤區塊從 x≈380 開始，和導覽列 x≈157 的左緣沒有對齊；similarity-daily desktop 的表格右側「採用／引用他…」欄位在 1060px 處被截斷。 |
| 一致性 | 6.5 | 時間篩選的寫法每頁不同：search 用「1 天／31 天」、media-outlet 用「全部／1天」、tag 用「1天」黑底；錯誤頁主按鈕在 ranking-error 是黑色，其他主要 CTA 都是橘色；my-saved-out 只有行內「登入」連結，沒有按鈕。 |
| 資訊密度 | 7.5 | ranking desktop 表格含首次出現、單日高峰、一起出現、媒體等欄位，資訊量很大；journalist desktop 一屏約 60 位記者，但條狀圖和數字都太小，掃讀困難。 |
| 導覽 | 7 | 桌面頂部導覽清楚，目前所在頁有橘底標示；event mobile 的日期列第一格被截成「/09」；my-saved mobile 的分頁「設定」被擠到第二行；ranking mobile 的藍營、綠營篩選排在第 4 列，很難找到。 |
| 狀態與回饋 | 5 | eve-error mobile 載入失敗時卻顯示「404 找不到這個頁面」，會誤導使用者；event-empty mobile 只有一句「今天沒有事件資料。」，日期導覽是空框，但上方仍顯示藍綠比例；search-none 只有一行「過去 31 天沒有符合…」，沒有下一步；my-saved-empty 也只有一行字；event-loading 的骨架是清單樣式，和實際的卡片版面不符。 |
| 響應式 | 5.5 | ranking mobile 的表格右側「變動」欄被截斷，紅色三角形卡在邊緣；journalist mobile 只看得到記者與刊登媒體，篇數等核心數字被擠到畫面外；similarity-daily mobile 的表格也被截斷（「同署名跨站 %」只露出一半）；home mobile 與 event mobile 的卡片裡有空白的走勢圖框，只看到一個小符號。 |
| 文案 | 6.5 | my-following desktop 與 mobile 的追蹤事件只寫「事件 #4128」，是內部編號；ranking-error 寫「錯誤代碼 3772224109」，沒有說明這組號碼要怎麼用；similarity 只寫「相似度門檻 0.65」，沒有解釋；article 的「本文共827字」和「全文約 893 字」兩個數字互相矛盾。 |
| 無障礙 | 6.5 | 灰色小字（11px 的後設資訊、表格數值）在淺色模式對比偏低；藍綠條大多有「綠營 27%」等文字輔助，但 home mobile 與 event mobile 的小藍綠條沒有文字，只能靠顏色辨識；mobile 的 chip 大致有 32px 高。 |
| 信任與清楚 | 7.5 | 每頁都有「本頁的資料來源與計算方式」；media-outlet 的側欄列出 Similarweb 來源與更新日期；新聞列一律顯示原始網址；但 ranking 沒有說明爆發力、分數、變動是什麼意思；similarity-daily 與 similarity-reposts 兩個狀態的畫面完全相同，看不出每日相似統計在哪裡。 |

要保留的優點：
- event desktop 的事件卡：同一事件的藍綠比例條、媒體 icon 列、「藍營／綠營」標題對照，再加上原始網址，是本站最核心的價值呈現。
- eve desktop 的時間變化圖與關鍵字甘特時間軸，能讓人一眼看懂事件怎麼發展。
- media-outlet 側欄的「媒體資料／寫法／網站流量來源／媒體關係」，來源與日期都有標示。
- journalist-person 的內文差異比對（紅色刪除、綠色新增），對媒體識讀很有說服力。
- 每頁底部一致的「本頁的資料來源與計算方式」摺疊區，以及頁尾的即時收錄數。

最重要的五個問題（由嚴重到輕微）：
1. [狀態與回饋] [eve-error] [mobile] 單一事件載入失敗卻顯示「404 找不到這個頁面」 —— 使用者會以為事件被刪除或網址錯了，不會想到重試 —— 改成「暫時無法載入」，並提供重新載入與回事件表兩個動作。
2. [響應式] [ranking] [mobile] 排行表右側的「變動」欄與三角形被截斷（另見 journalist mobile 篇數欄看不到、similarity-daily mobile 欄位被截） —— 手機上看不到最關鍵的數字 —— 手機改用卡片列表，名次、關鍵字、爆發力、變動放在同一張卡。
3. [狀態與回饋] [event-empty、search-none、my-saved-empty] [兩者] 空狀態只有一行字，沒有原因說明，也沒有下一步 —— 使用者走進死路 —— 補上原因說明，加上「看前一天」「看熱門關鍵字」等 CTA。
4. [響應式] [home、event] [mobile] 卡片裡有空白的走勢圖框與殘缺的小符號，event mobile 的日期列第一格被截成「/09」 —— 看起來像壞掉 —— 沒有資料時隱藏走勢圖，日期列改成可完整捲動的格子。
5. [文案] [my-following] [兩者] 追蹤清單的事件只寫「事件 #4128」，ranking-error 只寫「錯誤代碼 …」 —— 內部編號外露，使用者無法辨識 —— 改用事件主要標籤當名稱，錯誤代碼附上回報方式。

## 組 B
總分：7 / 10
一句話總評：參考組（Ground News、Google 新聞、Verity）的視覺成熟度高，陣營色條也很醒目；但各站之間在手機溢出、付費牆擋住資料、浮動列遮住內容這幾點上各有明顯缺口。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | ground-news-home desktop：頭條大圖上直接疊 Left 29%／Center 27%／Right 44% 條，右欄是 Blindspot，一眼看懂賣點；verity-home desktop 以大圖卡片為主，卡片下方有摘要問句。 |
| 字體排印 | 8 | verity-home mobile 的標題用無襯線粗體，摘要用襯線體，層次清楚；google-news-tw desktop 的中文字級偏小，但行高舒適；ground-news-home 的標題文字壓在照片上，還加了底線，可讀性較差。 |
| 色彩 | 7.5 | Ground News 用紅、白、藍陣營條，配卡其色頂欄，品牌辨識強；Google 新聞是標準 Material 藍；Verity 以灰白為主，只有黃色 Home 圖示點綴，個性較弱。 |
| 間距與版面 | 7.5 | ground-news-home desktop 三欄格線整齊；verity-home desktop 的分類 tab 在右側被截成「Social iss」；ground-news-story desktop 下半部有大片空白。 |
| 一致性 | 7.5 | 各站內部元件一致（Ground News 的 Follow／Upgrade 按鈕、Google 新聞的「瀏覽更多頭條」膠囊鈕），但看不到跨頁狀態，難以完整判斷。 |
| 資訊密度 | 7.5 | ground-news-home desktop 一屏約 15 則，每則都有來源數與陣營覆蓋率；verity-home 的大圖卡片一屏只有 2–3 則，密度偏低。 |
| 導覽 | 7.5 | Ground News 與 Verity 的手機都有底部分頁列（News／For You／Search／Blindspot／Local）；Google 新聞的頂部分頁在手機被截斷（「追蹤中｜台…」）。 |
| 狀態與回饋 | 6 | 只看到有資料的狀態；ground-news-story 對 NVIDIA 寫「bias rating of unknown」，Factuality 與 Ownership 被付費牆鎖住，只顯示 Upgrade。 |
| 響應式 | 6 | google-news-tw mobile 的卡片右側溢出，「瀏覽更多頭…」「亞冠賽》張仁瑋開轟、王念好追平」被切掉；ground-news 與 verity mobile 的底部列出現在畫面中段，遮住標題（Verity 的「Ban on Trans Ath ↑ s」被回頂按鈕蓋住）。 |
| 文案 | 7.5 | Ground News 的「46% Right coverage: 11 sources」精準；Google 新聞「1 小時前」自然；Ground News 的付費導向文案（Reveal … by upgrading）很搶戲。 |
| 無障礙 | 7 | Ground News 的陣營條附有百分比文字；ground-news-story 灰色的 Factuality 標題對比很低；Verity 的媒體 icon 疊在一起，沒有文字標示。 |
| 信任與清楚 | 7 | Ground News 有「methodology here」連結與每則的來源數；但 ground-news-story 的評等是 unknown 而且鎖在付費牆後；Google 新聞完全不交代收錄範圍與排序依據。 |

要保留的優點：
- ground-news-home 頭條大圖上直接疊陣營覆蓋條，並附百分比文字。
- Ground News 的 Blindspot 模組：把「只被一方報導」的新聞獨立成欄位，概念清楚。
- verity-home 每張卡片下方用一句問題式摘要，降低理解門檻。
- Google 新聞每則都有「瀏覽更多頭條和觀點」，把同一事件的多家報導聚在一起。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [google-news-tw] [mobile] 卡片內容右側溢出被截斷 —— 標題與按鈕讀不完整 —— 卡片寬度改為 100% 並限制圖片寬度。
2. [信任與清楚] [ground-news-story] [兩者] 媒體評等是 unknown，Factuality 與 Ownership 被付費牆鎖住 —— 核心判斷依據看不到 —— 至少公開評等來源與部分資料。
3. [響應式] [verity-home、ground-news-home] [mobile] 浮動底部列與回頂按鈕蓋住標題 —— 閱讀被打斷 —— 為內容預留底部安全距離。
4. [間距與版面] [verity-home] [desktop] 分類 tab 在右側被截成「Social iss」 —— 看起來壞掉，也看不到其他分類 —— 加上溢出漸層或「更多」選單。
5. [色彩] [verity-home] [兩者] 灰白配色、icon 疊圖缺乏層次，品牌個性弱 —— 不易建立辨識度 —— 強化品牌色與媒體標籤。

## 組 C
總分：8 / 10
一句話總評：資料深度和 A 相同，但手機版的寬表格都改成卡片，空狀態、錯誤、登入前的狀態都有說明與下一步，文案也更白話；剩下的問題是桌面字級偏小與部分表格溢出。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | home desktop 與 mobile 在首屏關鍵字雲下方加了一句說明：「新文易數收集台灣與部分國際新聞媒體的公開報導，把同一件事放在一起…」，接著是「看今天的事件 →」與「資料怎麼來」；ranking desktop 改用較少、較大字的文字雲，排行表上方也加了爆發力、分數、變動的定義。 |
| 字體排印 | 7.5 | event-hour mobile 與 eve mobile 的標題斷行比 A 自然（「黃仁勳閃辭輝達！／下一步去哪？」）；journalist desktop、topic desktop 的表格仍是 11–12px 小字；article desktop 標示「全文約 893 字（含標點）」，數字一致。 |
| 色彩 | 8 | tag desktop 與 mobile 的「關鍵字變化」時間軸改成灰階，只有主關鍵字用橘色，不再和藍營混淆；選中的 chip 一律是橘底（tag mobile 的「3 天」）；ranking-dark、eve-dark 的深色外觀用橘色強調，有個性。 |
| 間距與版面 | 7.5 | article desktop 改成雙欄，正文左、延伸閱讀右，善用了 1440 寬度；ranking-error desktop 的錯誤區塊和導覽列左緣對齊；ranking desktop 的媒體欄 icon 在 1120px 右緣仍被截掉一半；my-saved desktop 右側的說明卡和主卡片頂端沒有對齊。 |
| 一致性 | 8 | 時間篩選統一成「24 小時／3 天／7 天／近一個月／不限期間」（search、tag、media-outlet）；錯誤頁、空狀態、登入前的主按鈕都是橘色膠囊；my 系列頁都有同一張「這幾頁怎麼用」說明卡。 |
| 資訊密度 | 7.5 | ranking mobile 每張卡含名次、走勢、分數、篇數、家數、爆發力、變動，資訊不少又好掃讀；similarity-daily desktop 一次顯示全部欄位，連「被採用／引用」也在；手機卡片化以後，一屏的筆數比 A 少。 |
| 導覽 | 8 | ranking mobile 的篩選 chip 改成單列橫向捲動，有「→」提示，藍營、綠營提前到第 2、3 個；my-saved mobile 的五個分頁一列放得下；event mobile 的日期列沒有被截斷的格子；my-following 的事件改寫成「黃仁勳、NVIDIA、輝達 事件 #4128」。 |
| 狀態與回饋 | 8.5 | eve-error mobile 寫「事件頁暫時無法載入」，提供「重新載入」「看事件表」，並說明怎麼回報；event-empty 是「今天還沒有整理出事件」，附原因說明與「看前一天（11/12）的事件」「看關鍵字排行」；search-none 列出搜尋範圍提示與三個 CTA；event-loading 的骨架和卡片版面一致；my-saved-out 有卡片與「用 Google 帳號登入」按鈕。 |
| 響應式 | 8 | ranking、journalist、similarity-daily 的 mobile 都從寬表格改成卡片，並加上「排序」下拉；home mobile 與 event mobile 移除了空白走勢框，改成「綠 33%・藍 27%」文字；my-saved mobile 的說明卡接在內容下方，讓頁面變長不少。 |
| 文案 | 8 | similarity 寫「相似度門檻 0.65（內文約 65% 相同才算相似）」；article 寫「正文開頭和上面的摘要相同，本站只顯示開頭；全文請到原站閱讀」；tag 寫「升溫量 -1.2（比前幾天降溫）」「至少 3 家媒體跟進（多家跟進）」；錯誤頁寫「附上這串編號能更快找到原因」。 |
| 無障礙 | 7 | 藍綠比例條大多附文字百分比（home mobile、event mobile、search mobile），不只靠顏色；桌面 11px 灰字的對比仍然偏低（journalist desktop、topic desktop）；mobile 的按鈕、chip 約 36–40px 高。 |
| 信任與清楚 | 8 | ranking 表頭上方有指標定義；tag 有「191 篇內文高度相似，分成 66 組（已比對 94% 的報導）」；media-outlet 側欄標示 Similarweb 2026/10 與更新日；similarity-daily 與 similarity-reposts 兩張截圖完全相同，看不出每日相似統計的獨立視圖。 |

要保留的優點：
- home 首屏加入一句話說明與「看今天的事件／資料怎麼來」，第一次來的人就知道網站在做什麼。
- ranking、journalist、similarity-daily 的手機卡片化與「排序」下拉，解決了寬表格在手機上的問題。
- eve-error、event-empty、search-none、my-saved-out、my-saved-empty 都用同一套「原因＋下一步」狀態卡。
- tag 的關鍵字時間軸改成灰階加橘色，不再和藍營語意色衝突。
- article desktop 雙欄，延伸閱讀放在右欄，並坦白說明只顯示開頭。
- 指標文案白話化（相似度門檻、升溫量、多家跟進）。

最重要的五個問題（由嚴重到輕微）：
1. [字體排印] [journalist、topic、journalist-person] [desktop] 表格與後設資訊多為 11–12px 灰字，條狀圖也很細 —— 給長時間比對資料的研究者用，閱讀負擔很重 —— 正文表格至少 13–14px，加深次要文字的對比。
2. [間距與版面] [ranking] [desktop] 「媒體」欄的 icon 在容器右緣被截掉一半（另見 ranking-blue desktop） —— 看起來像溢出錯誤 —— 限制顯示數量並加「+N」，或讓欄寬自適應。
3. [信任與清楚] [similarity-daily、similarity-reposts] [兩者] 兩個狀態都停在「轉載統計」分頁，畫面完全相同 —— 每日相似統計的入口與差異看不出來 —— 確認分頁狀態是否正確反映在網址與選中樣式。
4. [資訊密度] [my-saved、my-following、my-saved-empty] [mobile] 每頁底部都接一張很長的「這幾頁怎麼用」說明卡 —— 收藏與追蹤的內容被往上擠，下方又被說明卡拉長頁面 —— 手機改成可摺疊，或只在空狀態顯示。
5. [間距與版面] [my-saved] [desktop] 右側說明卡和主卡片頂端沒有對齊，寬螢幕右側仍有大片空白 —— 版面節奏鬆散 —— 統一兩欄的起始線，主欄可再加寬。

```json
{"A": {"overall": 7, "scores": {"資訊層級": 7, "字體排印": 7, "色彩": 7, "間距與版面": 6.5, "一致性": 6.5, "資訊密度": 7.5, "導覽": 7, "狀態與回饋": 5, "響應式": 5.5, "文案": 6.5, "無障礙": 6.5, "信任與清楚": 7.5}, "issues": ["[狀態與回饋] eve-error mobile 載入失敗顯示成 404 找不到頁面", "[響應式] ranking/journalist/similarity-daily mobile 寬表格右側欄位被截斷", "[狀態與回饋] event-empty、search-none、my-saved-empty 只有一行字，沒有原因與下一步", "[響應式] home/event mobile 卡片有空白走勢圖框，日期列首格被截成「/09」", "[文案] my-following 事件只顯示內部編號「事件 #4128」，錯誤頁只給錯誤代碼"]}, "B": {"overall": 7, "scores": {"資訊層級": 8, "字體排印": 8, "色彩": 7.5, "間距與版面": 7.5, "一致性": 7.5, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 6, "響應式": 6, "文案": 7.5, "無障礙": 7, "信任與清楚": 7}, "issues": ["[響應式] google-news-tw mobile 卡片右側溢出被截斷", "[信任與清楚] ground-news-story 評等 unknown 且 Factuality/Ownership 鎖在付費牆後", "[響應式] verity/ground-news mobile 浮動底部列與回頂按鈕遮住標題", "[間距與版面] verity-home desktop 分類 tab 被截成「Social iss」", "[色彩] verity-home 灰白配色與疊圖 icon 缺乏層次與品牌個性"]}, "C": {"overall": 8, "scores": {"資訊層級": 8, "字體排印": 7.5, "色彩": 8, "間距與版面": 7.5, "一致性": 8, "資訊密度": 7.5, "導覽": 8, "狀態與回饋": 8.5, "響應式": 8, "文案": 8, "無障礙": 7, "信任與清楚": 8}, "issues": ["[字體排印] journalist/topic/journalist-person desktop 表格多為 11–12px 灰字", "[間距與版面] ranking desktop 媒體欄 icon 在右緣被截掉一半", "[信任與清楚] similarity-daily 與 similarity-reposts 畫面完全相同，看不出每日統計視圖", "[資訊密度] my 系列 mobile 底部的長說明卡把頁面拉長", "[間距與版面] my-saved desktop 說明卡與主卡片未對齊，右側留白多"]}}
```
