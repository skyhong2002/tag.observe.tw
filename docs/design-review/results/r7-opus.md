<!--
round: r7
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = reference, B = baseline (ffd6a5aa), C = new (web 574df115)
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
Maintainer notes: C issue 1 (similarity-daily = similarity-reposts) is the inventory: /similarity/daily/ redirects to
/similarity/reposts/; states.md is kept unchanged for the whole run so every round shoots the same states.
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：7.5 / 10
一句話總評：這是成熟的國際新聞比較產品，視覺很有個性，陣營條也清楚。但付費牆、強迫登入和手機版溢出拉低了信任與響應式的表現。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8.5 | ground-news-home desktop 的大圖頭條直接疊上「Left 29% / Center 27% / Right 44%」三段陣營條，左欄 Daily Briefing、右欄 Blindspot，主次一眼就分得出來。google-news-tw desktop 的「焦點提要／焦點新聞／更多新聞／您的主題」分區清楚。 |
| 字體排印 | 8 | ground-news 用粗黑無襯線標題，配小字的「46% Right coverage: 11 sources」，層次分明。verity-home desktop 標題用無襯線、導語用襯線斜體，個性強。google-news-tw desktop 的來源名與「1 小時前」字級約 10 px，偏小。 |
| 色彩 | 8.5 | ground-news 以米灰底、黑字、深紅與深藍陣營色構成，品牌感很強。verity-home 只用黃色作 Home 的重點色。google-news-tw 是 Google 藍加白卡，乾淨但沒有個性。 |
| 間距與版面 | 7.5 | ground-news-home desktop 的三欄格線對齊整齊。ground-news-story desktop 左欄「Top NVIDIA News」只有三張卡，下方約 400 px 空白，右欄則很長，左右失衡。verity-home desktop 左側圖示軌道與主欄之間留白過大。 |
| 一致性 | 8 | ground-news 的陣營條在大圖、列表、Blindspot 卡上都是同一套元件。各站內部的按鈕與標籤一致。verity 的分類列與左側圖示導覽是兩套導覽語言。 |
| 資訊密度 | 7.5 | ground-news-home desktop 一屏可以看到約 12 則附覆蓋率的新聞。verity-home desktop 每則都配一張約 360×205 的大圖，一屏只看得到 2 則。 |
| 導覽 | 7.5 | ground-news-home mobile 有底部分頁（News／For You／Search／Blindspot／Local）和可橫滑的話題 chips。verity-home desktop 頂部分類列在右緣被截成「Social iss」，沒有捲動提示。 |
| 狀態與回饋 | 6.5 | 參考組沒有載入、錯誤或空狀態可看。ground-news-home desktop 的 My News Bias 用「?」佔位並附「See the demo」，算是登入前的引導。ground-news-story desktop 的 Factuality／Ownership 只顯示鎖頭和「Upgrade」。 |
| 響應式 | 6.5 | google-news-tw mobile 的內容超出右緣：「瀏覽更多頭」「王念好追平」「微軟365、Outlook等服務當機數以」都被切掉，左側又留了約 95 px 空白，看起來是桌面版版面直接縮小。ground-news-home mobile 與 verity-home mobile 的單欄重排都合理。 |
| 文案 | 8 | ground-news 的「Coverage: 5 sources」「Stories disproportionately covered by one side」用詞精準。google-news-tw 的繁中用語自然。ground-news-story 的「We rank NVIDIA as Unknown factuality」把企業當媒體評等，讀起來很怪。 |
| 無障礙 | 7 | ground-news 的陣營條同時有文字百分比，不只靠顏色。verity-home desktop 左側圖示標籤只有約 8 px 大寫字。google-news-tw desktop 的灰色時間字對比偏低。 |
| 信任與清楚 | 7 | ground-news-home desktop 有「Learn more about political bias in news coverage」連結。ground-news-story desktop／mobile 的事實查核與所有權資料都鎖在付費方案後面，「unknown」評等也沒有說明原因。 |

要保留的優點：
- ground-news 的三段式陣營條（紅／白／藍＋百分比文字），從大圖到列表都用同一套。
- ground-news-home desktop 用 Blindspot 欄專門呈現「只有單邊在報」的新聞，比較角度鮮明。
- google-news-tw desktop 把同一事件的多家來源收成一組，再加「瀏覽更多頭條新聞和觀點」入口。
- verity-home desktop 的爭議預測卡（UNLIKELY ↔ LIKELY 色條），把判斷視覺化。
- ground-news-home mobile 的底部分頁讓主要功能一指可達。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [google-news-tw] [mobile] 主欄超出 390 寬視窗，標題與「瀏覽更多頭條」按鈕在右緣被截斷，左側卻留空約 95 px。—— 手機讀者看不完標題，也點不到按鈕。—— 建議手機改單欄滿版，移除桌面版左側留白。
2. [信任與清楚] [ground-news-story] [兩者] Factuality 與 Ownership 都鎖在「Upgrade」後面，NVIDIA 的評等寫「unknown」卻沒有原因。—— 這類判斷沒有依據就難以信任。—— 建議至少公開評等依據摘要，付費只限進階資料。
3. [間距與版面] [ground-news-story] [desktop] 左欄只有三張新聞卡，下方約 400 px 空白，右欄則延續到底。—— 1440 寬螢幕沒有善用，看起來像內容缺漏。—— 建議左欄補足更多新聞或改兩欄平衡。
4. [導覽] [verity-home] [desktop] 頂部分類列在右緣截成「Social iss」，沒有箭頭或漸層提示；左側圖示軌道的標籤只有約 8 px。—— 使用者不知道還有更多分類。—— 建議加上捲動提示並放大軌道標籤。
5. [資訊密度] [verity-home] [兩者] 每則新聞都配大圖，desktop 一屏只看得到 2 則。—— 想比對多則新聞的讀者效率低。—— 建議提供精簡列表模式。

## 組 B
總分：6.5 / 10
一句話總評：資料很完整，桌面的資料表也強。但多個狀態頁（空資料、錯誤、搜尋無結果、未登入）只有一行字，手機寬表直接截斷，事件卡上還有未渲染的灰色佔位框。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 6.5 | home desktop／mobile 的關鍵字雲下方直接接「焦點事件」，沒有任何一句說明這個網站在做什麼。event desktop 每張卡先放排名、熱度條，再放標題、標籤、陣營條，層級算清楚。 |
| 字體排印 | 7 | event desktop 卡片標題約 15 px 粗體，媒體名、網址在 10 px 左右。article mobile 正文行高舒適。journalist mobile「中廣新…」與「PChome Online…」在表格內被截斷。 |
| 色彩 | 7 | 橘紅主色、綠營綠、藍營藍是一套語意系統。home-dark／ranking-dark／eve-dark 以近黑底配橘色重點，深色外觀成立。tag mobile 的期間選擇用黑底，event／search 用橘底，主色不一致。 |
| 間距與版面 | 6 | article desktop 主欄約 700 px 置中偏左，「延伸閱讀」接在正文下方，右側約 500 px 全空白。ranking-error desktop／eve-error desktop 的內容區縮在中間，左緣沒有和標題、頁尾對齊。 |
| 一致性 | 6 | 期間選擇 tag 用「1 天」黑底、search 用「1 天／31 天」橘底、media-outlet 用「全部／1天」。event-hour mobile 的「看 2026-11-13 整天的事件」是藍色連結，其他頁都是橘色。 |
| 資訊密度 | 7 | journalist desktop 一屏約 50 列記者含 5 項指標，similarity desktop 一屏約 40 家媒體，密而可讀。media mobile 的篩選 chips 佔掉約 13 行，表格要捲過一屏才出現。 |
| 導覽 | 6.5 | 桌面頂部列有 9 個主項，目前位置用橘底標示。event mobile 的日期列左緣切出「一 /09」殘字。ranking mobile 的分類 chips 換了 4 行。 |
| 狀態與回饋 | 4.5 | event-empty 只有「今天沒有事件資料。」，日期列也只剩空的左右箭頭。eve-error 顯示「404 找不到這個頁面」，把載入失敗說成網址錯誤。search-none 只有一句「過去 31 天沒有符合」。my-saved-out 只有一個行內「登入」文字連結。my-saved-empty 也只有一句話，沒有按鈕。 |
| 響應式 | 5 | ranking mobile 的表格把「變動」欄截在右緣，沒有可滑動提示。similarity mobile 的「同署名跨站」欄被切成「6,043 2(」。journalist mobile 的右側篇數欄被切成一條橘線。 |
| 文案 | 6.5 | ranking-error 顯示「錯誤代碼 3772224109」，沒有下一步。article mobile 同時出現「本文共827字」和「全文約 893 字」，兩個字數互相矛盾。topic-story 的麵包屑是「議題 / 三立新聞網 / 議題」，重複又沒寫議題名稱。 |
| 無障礙 | 6 | home mobile 與 event mobile 的事件卡陣營條只有色塊，中間寫「其他 76%」，綠藍兩端沒有數字，只能靠顏色辨識。卡片上的媒體 logo 約 14 px，點擊區偏小。 |
| 信任與清楚 | 7 | 各頁都有「本頁的資料來源與計算方式」，ranking 標明「11/13 08:00 時段・85 家媒體・12,333 篇・更新於 08:10」。journalist-person 寫了「相似不等於抄襲」。similarity-daily 與 similarity-reposts 兩張截圖完全相同（兩者都顯示「轉載統計」），看不到每日相似統計。 |

要保留的優點：
- journalist desktop 的記者總表：一列一人，含刊登媒體 logo、首見報導、內文相近、引用與百分比，可排序，資料感很強。
- journalist-person 兩個尺寸的逐段差異高亮（紅刪綠增），加上「內文與本篇不同 8 處」摘要，比對很直觀。
- eve desktop 的時間變化圖：分數折線加名次虛線，再配每日藍綠堆疊長條。
- 每頁一致放置「本頁的資料來源與計算方式」，頁尾附今日收錄與 24 小時發稿家數。
- home-dark／eve-dark 的深色外觀：近黑底配橘色，照片與圖表在深色下仍清楚。

最重要的五個問題（由嚴重到輕微）：
1. [狀態與回饋] [eve-error] [兩者] 事件頁載入失敗時顯示「404 找不到這個頁面」，沒有重試按鈕。—— 讀者會以為事件被刪除，不會重試。—— 建議區分「暫時載入失敗」和「不存在」，提供重新載入與回事件表。另見 event-empty（只有一句話加空日期列）、search-none、my-saved-empty。
2. [響應式] [ranking] [mobile] 排行表右側的「變動」欄被截斷，沒有可滑動提示。—— 手機讀者看不到排名升降這個核心資訊。—— 建議手機改卡片列，或至少加上滑動提示。另見 similarity-daily mobile、journalist mobile。
3. [一致性／版面] [home、event] [兩者] 事件卡「上榜」那行旁邊有一個淺灰空框，框裡只有一小截藍線（event desktop 第 2 張卡也有），像是沒載入完成的趨勢圖。—— 看起來像壞掉，削弱可信度。—— 建議改成畫好的迷你趨勢線，或直接拿掉。
4. [無障礙] [home、event、event-hour] [兩者] 陣營條只標「其他 76%」，綠營與藍營兩端沒有數字。—— 色弱讀者無法分辨，比例也看不出來。—— 建議在條下補「綠 14%・藍 10%」等文字。
5. [間距與版面] [article] [desktop] 主欄窄，延伸閱讀放在正文下方，右側約 500 px 空白。—— 大螢幕要捲很遠才看得到相關報導。—— 建議把延伸閱讀放進右側欄。

## 組 C
總分：7.5 / 10
一句話總評：保留了 B 的資料深度，又把各種狀態頁、手機寬表與陣營條文字都補齊，是三組中最完整的新文易數版本。剩下的是元件一致性與少數對齊問題。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | home desktop／mobile 在關鍵字雲下方加了一句「四周是今天正在升溫的關鍵字。新文易數收集台灣與部分國際新聞媒體的公開報導，把同一件事放在一起…」，並附「看今天的事件→」「資料怎麼來」。event desktop 第 1 名卡片加大標題。 |
| 字體排印 | 7.5 | article mobile 標題斷成「AI 教父婚外情連環爆／黃仁勳辭輝達 CEO」，斷行合理。topic-story mobile 的標題與日期、作者、網址分行清楚。desktop 多處 meta 仍只有約 10 px，例如 event 卡的網址列。 |
| 色彩 | 7.5 | 陣營色加上文字「綠 33%・藍 27%」後，語意色不再需要大面積色塊。ranking-dark mobile 的卡片迷你趨勢圖在深色下仍清楚。主要按鈕（重新載入、看前一天的事件）統一為橘色。 |
| 間距與版面 | 7 | article desktop 把延伸閱讀移到右側欄，整頁平衡。容器加寬到約 1250 px，更善用 1440 寬螢幕。eve-error、ranking-error desktop 的錯誤區塊仍置中偏右，沒有和左上標題對齊。my-following desktop 的「取消追蹤」被推到約 1250 px 外的右緣，離名稱太遠。 |
| 一致性 | 7 | 期間選擇在 tag、search 都改成「24 小時」加橘色選中，event-hour mobile 的連結也改回橘色。my-saved-out、my-saved-empty、event-empty、search-none 都用同一種虛線框空狀態卡。media-outlet 仍是「全部／24 小時／3 天」，選項和其他頁不完全一樣。 |
| 資訊密度 | 7.5 | ranking mobile 每張卡含分數、篇數、媒體家數、趨勢圖與 24 小時變動，一屏約 13 筆。media mobile 把 chips 收成 4 列可橫滑的篩選，加「其他 20 個標籤」。similarity mobile 改成卡片後，每家約佔 110 px，一屏只看得到 6 家。 |
| 導覽 | 7.5 | event mobile 的日期列不再切字。media mobile 每列篩選右側有橘色「→」提示可以滑動。topic-story 麵包屑改成「議題 / 三立新聞網 / 黑色購物節」。desktop 主導覽仍有 9 項，沒有分組。 |
| 狀態與回饋 | 8 | event-empty 有「今天還沒有整理出事件」、成因說明，加「看前一天（11/12）的事件」「看關鍵字排行」兩個按鈕。eve-error 有「重新載入／看事件表」，並說明可附編號回報。search-none 有搜尋建議和三個下一步按鈕。my-saved-out 有「用 Google 帳號登入」主要按鈕。event-loading 的骨架和實際卡片版型一致。 |
| 響應式 | 7.5 | ranking、journalist、similarity 的 mobile 都改成卡片。media mobile 保留表格，但加了「這張表可以左右滑動 看更多欄」。desktop 寬表加「表格比畫面寬，右邊還有欄位 看更多欄→」。 |
| 文案 | 7.5 | 錯誤頁寫「一直無法載入的話，歡迎到頁尾的『聯絡與移除請求』告訴我們，附上這串編號能更快找到原因」，比裸的錯誤代碼人性化。article 刪掉重複的「本文共827字」，改寫「全文約 893 字（含標點）」。「升溫量 -1.2」「爆發力」等術語仍需要依賴說明。 |
| 無障礙 | 7 | 陣營條旁補上「綠 14%・其他 76%・藍營 10%」文字，不再只靠顏色。ranking-dark mobile 的升降用 ▲▼ 符號加數字。卡片上的媒體 logo 和「＋3」仍只有約 14 px，點擊區偏小。 |
| 信任與清楚 | 7.5 | topic-story 說明「哪些新聞放進這一頁由三立新聞網決定，可能包含原站一併列出的其他新聞」。ranking mobile 列出爆發力、分數、變動的定義。similarity-daily 與 similarity-reposts 兩張截圖完全相同（都顯示「轉載統計」），看不到每日相似統計，需要維護者確認。 |

要保留的優點：
- event-empty、eve-error、ranking-error、search-none、my-saved-out、my-saved-empty 共用同一種空／錯誤狀態卡：標題、原因、主要與次要按鈕。
- ranking mobile 與 ranking-dark mobile 的排行卡：名次、分數・篇數・家數、迷你趨勢、爆發力與 ▲▼ 變動。
- 事件卡與焦點卡陣營條下方的「綠 x%・其他 y%・藍 z%」文字標註。
- home 首屏的一句話網站說明，附「看今天的事件→」「資料怎麼來」。
- article desktop 右側欄的延伸閱讀：所屬事件、他站相似報導、其他媒體相關報導。
- media desktop／mobile 依「媒體傾向、報導範圍、收錄狀態、媒體標籤」分列的篩選。

最重要的五個問題（由嚴重到輕微）：
1. [信任與清楚] [similarity-daily／similarity-reposts] [兩者] 兩個狀態的截圖完全相同，都停在「轉載統計」分頁，看不到每日相似統計。—— 若頁面真的無法直達每日相似，讀者就找不到這個功能。—— 建議先確認網址或分頁狀態能否直接打開「關係探索／每日相似」，並讓分頁狀態反映在網址上。
2. [資訊密度] [similarity-daily] [mobile] 改成卡片後每家約佔 110 px，一屏只看得到 6 家，近 300 家媒體要捲很久。—— 研究者在手機上很難掃讀比較。—— 建議卡片內只放 2–3 個關鍵比例，其他欄收進展開，或提供緊湊模式。
3. [間距與版面] [eve-error、ranking-error] [desktop] 錯誤區塊從約 x=1008 開始，頁首標題與頁尾在 x=852，左緣不一致；my-following desktop 的「取消追蹤」又被推到約 1250 px 外的右緣。—— 版面看起來沒對齊，大螢幕上操作和名稱離得很遠。—— 建議錯誤卡沿用主欄左緣，清單類頁面限制最大寬度。
4. [一致性] [media-outlet] [兩者] 期間選項是「全部／24 小時／3 天／7 天」，tag 是「24 小時／3 天／7 天」，search 是「24 小時／3 天／7 天／近一個月」，同一種控制的選項組各頁不同。—— 讀者每頁都要重新理解。—— 建議統一期間選項集合與預設值。
5. [無障礙] [event、home] [兩者] 卡片上的媒體 logo 列與「+3」「+84」只有約 14 px，相鄰 logo 幾乎沒有間距；desktop 的網址和 meta 字約 10 px。—— 手機上不好點，小字對比也不足。—— 建議 logo 點擊區至少 32 px，meta 字級提高到 12 px 以上。

```json
{"A": {"overall": 7.5, "scores": {"資訊層級": 8.5, "字體排印": 8, "色彩": 8.5, "間距與版面": 7.5, "一致性": 8, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 6.5, "響應式": 6.5, "文案": 8, "無障礙": 7, "信任與清楚": 7}, "issues": ["[響應式] google-news-tw mobile 主欄超出視窗，標題與「瀏覽更多頭條」按鈕被截斷，左側留空約 95 px", "[信任與清楚] ground-news-story 兩者 Factuality／Ownership 鎖在付費牆後，unknown 評等沒有說明原因", "[間距與版面] ground-news-story desktop 左欄只有三張卡，下方約 400 px 空白，與右欄失衡", "[導覽] verity-home desktop 分類列右緣截成「Social iss」沒有捲動提示，左軌道標籤約 8 px", "[資訊密度] verity-home 兩者每則都配大圖，一屏只看得到 2 則"]}, "B": {"overall": 6.5, "scores": {"資訊層級": 6.5, "字體排印": 7, "色彩": 7, "間距與版面": 6, "一致性": 6, "資訊密度": 7, "導覽": 6.5, "狀態與回饋": 4.5, "響應式": 5, "文案": 6.5, "無障礙": 6, "信任與清楚": 7}, "issues": ["[狀態與回饋] eve-error 兩者把載入失敗顯示成 404，沒有重試；event-empty、search-none、my-saved-empty 都只有一句話", "[響應式] ranking mobile 表格「變動」欄被截斷且沒有滑動提示；similarity、journalist mobile 同樣截斷", "[一致性／版面] home、event 兩者事件卡「上榜」旁有淺灰空框加一小截藍線，像沒載入完成", "[無障礙] home、event 陣營條只標「其他 76%」，綠藍兩端沒有數字，只靠顏色", "[間距與版面] article desktop 主欄窄，延伸閱讀在正文下方，右側約 500 px 空白"]}, "C": {"overall": 7.5, "scores": {"資訊層級": 8, "字體排印": 7.5, "色彩": 7.5, "間距與版面": 7, "一致性": 7, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 8, "響應式": 7.5, "文案": 7.5, "無障礙": 7, "信任與清楚": 7.5}, "issues": ["[信任與清楚] similarity-daily 與 similarity-reposts 截圖完全相同，都顯示轉載統計，看不到每日相似", "[資訊密度] similarity-daily mobile 卡片每家約 110 px，一屏只看得到 6 家", "[間距與版面] eve-error、ranking-error desktop 錯誤區塊左緣不對齊；my-following desktop「取消追蹤」離名稱太遠", "[一致性] media-outlet、tag、search 的期間選項組各不相同", "[無障礙] event、home 卡片媒體 logo 與「+N」約 14 px，點擊區小，desktop meta 字約 10 px"]}}
```
