<!--
round: r5
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = reference, B = new (web 819113e5), C = baseline (ffd6a5aa)
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
Maintainer notes: the reviewer reads C (the baseline) as a regression of B ("多處退化"); the direction is the other way.
B issue 3 ("ranking mobile 多欄表只能橫向捲動") does not match the new set: ranking_mobile is the card list since r1.
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：7.5 / 10
一句話總評：參考組是成熟的新聞彙整與偏向比較產品。版面與品牌一致，掃讀成本低；但它比較「各家怎麼說」的深度，以及對方法的交代，都不如它的視覺完成度。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | ground-news-home desktop：頭條大卡配圖，每則新聞都有偏向分布條和來源數，主次明確。google-news-tw desktop：「焦點新聞」叢集把同一事件的多家標題放在一起，標題最先被看到 |
| 字體排印 | 8 | ground-news-story desktop：英文襯線大標配無襯線內文，層級清楚。google-news-tw mobile：中文標題字級與行高舒適，媒體名與時間是小字灰色 |
| 色彩 | 7.5 | Ground News 的左／中／右用紅、白、藍偏向條，語意一致，但跟品牌色混在一起，有點搶眼。Google News 幾乎只用中性色，識別性靠 Google 的既有樣式 |
| 間距與版面 | 8 | ground-news-home desktop：多欄卡片格線對齊、留白均勻。verity-home desktop：卡片節奏穩定，但 1440 寬時兩側留白偏多 |
| 一致性 | 8 | 四張頁面內的卡片、偏向條、來源標記都是同一套 |
| 資訊密度 | 7.5 | ground-news-home desktop 一屏可看到十多則；verity-home mobile 卡片偏大，一屏只有兩到三則 |
| 導覽 | 7.5 | google-news-tw：頂部分類分頁清楚。ground-news mobile：底部主要靠漢堡選單與捲動，目前位置的提示較弱 |
| 狀態與回饋 | 6 | 參考組只有正常狀態，看不出空資料、錯誤、載入中的處理，只能保守評分 |
| 響應式 | 8 | 四組 mobile 都重新排成單欄卡片，沒有橫向溢出；ground-news-story mobile 把偏向條改成全寬 |
| 文案 | 7.5 | Google News 繁中用語自然；Ground News 與 Verity 是英文介面，不適用台灣讀者，但用詞精準 |
| 無障礙 | 7 | Ground News 偏向條除了顏色也有 L/C/R 字樣與百分比；部分灰色小字（來源數、時間）對比偏低 |
| 信任與清楚 | 7 | ground-news-story 有偏向評分來源說明入口；Google News 對叢集方式幾乎沒有交代 |

要保留的優點：
- Ground News 把偏向分布條與來源數並列在每則新聞卡上，比較一眼可見
- Google News 用「同一事件多家標題」叢集卡，正好對應「同一件事各家怎麼說」
- 卡片格線與留白節奏一致，長時間掃讀不累
- 手機版重新排版，而不是縮小桌面版

最重要的五個問題（由嚴重到輕微）：
1. [狀態與回饋] [全部] [兩者] 樣本裡完全看不到空資料、錯誤與載入狀態 —— 無法確認例外處理品質 —— 參考時只取它的正常狀態版面
2. [信任與清楚] [google-news-tw] [兩者] 叢集如何形成、為何某家排前面，沒有任何說明 —— 讀者無從判斷演算法偏誤 —— 叢集卡要附「為什麼在這裡」
3. [色彩] [ground-news-home] [desktop] 左右偏向的紅藍色塊大量重複，跟頭條圖片互相搶視線 —— 語意色喧賓奪主 —— 降低飽和度或改用細條
4. [資訊密度] [verity-home] [mobile] 卡片與圖片偏大，一屏只有兩到三則 —— 手機掃讀效率低 —— 縮小縮圖、壓縮行距
5. [文案] [ground-news／verity] [兩者] 英文介面，對台灣讀者不適用 —— 只能參考結構，不能參考用語 —— 不適用於本站文案比較

## 組 B
總分：7.5 / 10
一句話總評：B 的功能完整、狀態設計周到。首頁有清楚的網站自介，空資料與錯誤都有下一步；問題集中在資訊過密、灰色小字對比，以及寬表格在手機上的處理。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7.5 | home mobile：文字雲下方有一段自介「新文易數收集台灣與部分國際新聞媒體的公開報導…比較各家標題、藍綠分布與誰先報」，並附「看今天的事件→」「資料怎麼來」，第一次來的人看得懂。event desktop：排名、熱度、標題、藍綠條、各家標題依序排列，但卡片內元素多，主標題不夠突出 |
| 字體排印 | 7 | eve desktop：大標粗黑、摘要灰字，層級清楚。event desktop：卡片 meta 列（「128 登上第1名 上榜3小時 00:00–03:00」）與網址行約 11px，又小又淡。article desktop「全文約 893 字（含標點）」與內文「本文共827字」並存 |
| 色彩 | 7.5 | 橘紅品牌色一致用在主要按鈕、選中籤、連結；藍綠用綠／灰／藍三段條加百分比文字（event desktop「綠營 14% 其他 76% 藍營 10%」）。ranking-dark desktop：橘字文字雲在黑底上有個性，不是純灰階 |
| 間距與版面 | 7.5 | 內容寬約 1250px，1440 寬利用得不錯；article desktop 用正文加右側「延伸閱讀」雙欄，左欄正文底下有大片空白。media mobile 篩選籤橫向捲動，右緣被裁切（「台灣政府 9」後還有半個籤） |
| 一致性 | 8 | 錯誤頁（eve-error、ranking-error desktop）同一版型、同一顆橘色「重新載入」；空狀態（event-empty、my-saved-empty、search-none）都是框線卡片加主要／次要按鈕 |
| 資訊密度 | 7 | event desktop 每張事件卡塞了圖、熱度條、標籤、藍綠條、約 15 個媒體圖示、兩家對照、三條網址，偏擁擠。journalist desktop 表格一行一筆、好掃讀 |
| 導覽 | 7.5 | 頂部主選單有目前頁的橘底標示（event desktop「事件」）；麵包屑「事件表／事件 #4128」；手機用漢堡選單加搜尋圖示。my-following 分頁「我的動態／追蹤清單／收藏…」在手機單列放得下 |
| 狀態與回饋 | 8.5 | event-empty desktop：「今天還沒有整理出事件」，說明原因，附「看前一天（11/12）的事件」「看關鍵字排行」。search-none：給搜尋範圍說明與三個出口。event-loading 骨架和真實卡片版型一致。my-saved-out 有清楚的登入按鈕與好處清單 |
| 響應式 | 7 | home mobile、event mobile 都重排成單欄；media mobile 表格有「這張表可以左右滑動 看更多欄→」提示。但 similarity-daily mobile、ranking mobile 的寬表仍需橫向捲動，欄位多 |
| 文案 | 8 | 台灣用語自然（「看今天的事件」「回報錯誤」「還沒有收藏」）；ranking desktop 解釋「爆發力」「分數」「變動」。錯誤頁「附上這串編號能更快找到原因」比「錯誤代碼」親切 |
| 無障礙 | 6.5 | 大量 11–12px 淺灰 meta 字（event、topic desktop），在淺色與深色下都偏淡；藍綠除了顏色也有「偏藍／偏綠」文字籤與百分比，這點好；卡片中媒體圖示很小，點擊範圍不明 |
| 信任與清楚 | 8 | 每頁有「本頁的資料來源與計算方式」；article 註明「配圖來源」；「相似不等於抄襲」的提醒；tag desktop「191 篇內文高度相似，分成 66 組（已比對 94% 的報導）」交代依據 |

要保留的優點：
- 首頁文字雲下方的自介段落與「看今天的事件→／資料怎麼來」雙入口（home mobile/desktop）
- 空狀態與錯誤狀態一律給原因加下一步（event-empty、search-none、eve-error）
- 寬表格的「右邊還有欄位 看更多欄→」提示（ranking、media desktop）
- 媒體總表篩選器分成「媒體傾向／報導範圍／收錄狀態／媒體標籤」四列，並把其他 20 個標籤收合（media desktop）
- 文章頁桌面雙欄，「所屬事件／他站相似報導／其他媒體相關報導」與正文並排（article desktop）
- 追蹤清單的事件顯示名稱「黃仁勳、NVIDIA、輝達 事件 #4128」（my-following）

最重要的五個問題（由嚴重到輕微）：
1. [資訊密度] [event] [desktop] 事件卡一次塞了十多種元素（熱度條、名次籤、標籤、藍綠條、15 個媒體圖示、兩家對照、三條附網址的標題），主標題被淹沒 —— 這是最常用的頁面，掃讀成本高 —— 把媒體圖示列和網址行收合，只保留標題、藍綠條、兩家對照（另見 event-hour、home 焦點事件）
2. [無障礙] [event／topic] [兩者] meta 列與網址多為 11–12px 淺灰字，深色版（eve-dark、ranking-dark）更淡 —— 對比不足，長時間閱讀吃力 —— meta 至少 12–13px，對比提高到 4.5:1
3. [響應式] [similarity-daily／ranking] [mobile] 多欄數字表在手機只靠橫向捲動，看不到欄名對應 —— 手機使用者多，比對困難 —— 手機改成卡片列，或固定首欄
4. [文案] [article] [兩者] 標頭「全文約 893 字（含標點）」與正文擷取的「本文共827字」互相矛盾，後者像是擷取時外露的原站字樣 —— 數字不一致會傷信任 —— 清掉正文擷取的字數行
5. [間距與版面] [media] [mobile] 四列篩選籤各自橫向捲動，右緣籤被裁一半，沒有捲動提示 —— 使用者不知道還有選項 —— 加漸層遮罩或「更多」按鈕

## 組 C
總分：6.5 / 10
一句話總評：C 和 B 是同一套設計語言，但多處退化：首頁少了自介，事件卡出現沒畫好的佔位灰框，單一事件的錯誤狀態顯示成 404，空資料與登入前頁面幾乎沒有下一步，標籤牆沒有分組。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 6.5 | home mobile：文字雲後直接是「焦點事件」，沒有說明網站是什麼、也沒有「看今天的事件」入口。event desktop：排名列底下多一塊空白灰框，把標題往下推 |
| 字體排印 | 6.5 | ranking desktop：文字雲改成極密排列，大量約 8–9px 的小字無法辨讀；eve mobile 標題斷行在「下一步／去哪？」中間；article mobile 標題斷在「連環／爆」 |
| 色彩 | 6.5 | 品牌橘延續，但 ranking-error desktop 的「重新載入」改用黑色按鈕，tag desktop 的期間選中籤也是黑色，和其他頁的橘色選中態不一致；search desktop 小卡的藍綠條拿掉了百分比文字 |
| 間距與版面 | 6.5 | 內容寬約 1120px，1440 寬兩側留白較多；article desktop 改成單欄，「延伸閱讀」整個移到正文下方，右側大片空白；media desktop 標籤籤牆約五列沒有標題 |
| 一致性 | 6 | 錯誤按鈕黑、選中籤黑或橘，混用；期間籤「1 天／3 天／7 天／31 天」（search、tag）和其他頁的「24 小時／近一個月」不同；my-following 的事件只寫「事件 #4128」 |
| 資訊密度 | 6.5 | media mobile：未分組的標籤籤牆佔滿將近一屏才看到表格；ranking desktop 文字雲塞了數百個字，無法掃讀 |
| 導覽 | 7 | 主選單、麵包屑同 B；my-saved mobile 分頁「設定」被擠到第二列（my-saved、my-following、my-saved-out mobile） |
| 狀態與回饋 | 5 | eve-error desktop/mobile 顯示「404 找不到這個頁面」，把暫時錯誤說成頁面不存在；event-empty desktop 標題寫「今天到目前為止的 0 件事」，日期列只剩兩個箭頭，只有一句「今天沒有事件資料。」；my-saved-empty 只有一行字，沒有按鈕；event-loading 骨架是清單列，跟實際的卡片版型不符 |
| 響應式 | 6.5 | 手機都改成單欄，但 event mobile 卡片內出現藍點加灰框的未載入佔位；similarity-daily desktop 表格最後一欄「採用／引用他媒」直接被裁掉，沒有捲動提示 |
| 文案 | 6.5 | tag desktop「相似 191 篇・66 群」比「分成 66 組」生硬；ranking-error 寫「錯誤代碼 3772224109」，偏工程用語；search-none 只有「過去 31 天沒有符合『zzqxv』的文章。」 |
| 無障礙 | 5.5 | search/home 的小卡藍綠條只剩色塊、沒有數字，只靠顏色傳達陣營；文字雲小字對比與字級都不足；my-saved-out 的登入入口只是一個內文底線連結，點擊範圍小 |
| 信任與清楚 | 7 | 一樣有「本頁的資料來源與計算方式」、配圖來源、「相似不等於抄襲」；但 ranking desktop 拿掉了「爆發力／分數／變動」的定義說明 |

要保留的優點：
- 與 B 共用的元件系統：頂部導覽、麵包屑、資料來源摺疊列、頁尾透明度連結
- 事件表的藍綠三段條加「藍綠家數比約 40：60」摘要（event desktop/mobile）
- 文章頁單欄閱讀的行長舒適，正文在手機上字級夠大（article mobile）
- 收藏卡片的「修改註記／取消收藏」雙按鈕與黃底註記（my-saved）
- 媒體單頁右側「媒體資料／寫法／網站流量來源」資訊欄（media-outlet desktop）

最重要的五個問題（由嚴重到輕微）：
1. [狀態與回饋] [eve-error] [兩者] 單一事件載入失敗卻顯示「404 找不到這個頁面」，沒有「重新載入」—— 使用者會以為事件被刪除，不會重試 —— 區分暫時錯誤與不存在，提供重試（對照 ranking-error 的做法）
2. [狀態與回饋] [event-empty] [兩者] 空資料顯示「今天到目前為止的 0 件事」、只剩箭頭的空日期列和一行「今天沒有事件資料。」—— 沒有原因也沒有下一步 —— 說明事件生成時間，附「看前一天」「看關鍵字排行」（另見 my-saved-empty、search-none、my-saved-out）
3. [響應式] [event] [兩者] 事件卡排名列下出現藍點加灰色空框的未載入佔位，home 焦點事件與 event-hour 也有 —— 看起來像壞掉 —— 沒資料時不渲染那一塊，或改成真正的迷你圖
4. [資訊密度] [ranking] [desktop] 文字雲塞進數百個約 8–9px 的字，篩選籤也不分組換成兩列 —— 排行頁的主視覺無法閱讀 —— 限制在前 60–80 個詞並設最小字級（另見 ranking-blue、ranking-dark）
5. [無障礙] [search／home] [兩者] 事件小卡的藍綠條拿掉了「綠 x%・藍 y%」文字，只靠色塊 —— 色覺障礙者與灰階閱讀無法判讀陣營 —— 恢復數字標註

```json
{"A": {"overall": 7.5, "scores": {"資訊層級": 8, "字體排印": 8, "色彩": 7.5, "間距與版面": 8, "一致性": 8, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 6, "響應式": 8, "文案": 7.5, "無障礙": 7, "信任與清楚": 7}, "issues": ["樣本無空資料、錯誤、載入狀態，無法評估例外處理", "google-news-tw 叢集形成方式完全未說明", "ground-news-home desktop 紅藍偏向色塊大量重複，搶視線", "verity-home mobile 卡片過大，一屏僅兩到三則", "Ground News／Verity 為英文介面，不適用台灣讀者"]}, "B": {"overall": 7.5, "scores": {"資訊層級": 7.5, "字體排印": 7, "色彩": 7.5, "間距與版面": 7.5, "一致性": 8, "資訊密度": 7, "導覽": 7.5, "狀態與回饋": 8.5, "響應式": 7, "文案": 8, "無障礙": 6.5, "信任與清楚": 8}, "issues": ["event desktop 事件卡元素過多，主標題被淹沒（另見 event-hour、home）", "event／topic 的 meta 與網址為 11–12px 淺灰字，深色版更淡，對比不足", "similarity-daily／ranking mobile 多欄表只能橫向捲動", "article 標頭「全文約 893 字」與正文擷取的「本文共827字」矛盾", "media mobile 篩選籤橫向捲動，右緣被裁切且無提示"]}, "C": {"overall": 6.5, "scores": {"資訊層級": 6.5, "字體排印": 6.5, "色彩": 6.5, "間距與版面": 6.5, "一致性": 6, "資訊密度": 6.5, "導覽": 7, "狀態與回饋": 5, "響應式": 6.5, "文案": 6.5, "無障礙": 5.5, "信任與清楚": 7}, "issues": ["eve-error 載入失敗顯示成 404 且無重新載入", "event-empty 顯示「0 件事」與空日期列，無原因與下一步（另見 my-saved-empty、search-none、my-saved-out）", "event／home 事件卡出現藍點加灰框的未載入佔位", "ranking desktop 文字雲數百個 8–9px 小字無法閱讀，篩選籤未分組", "search／home 小卡藍綠條只剩色塊，沒有百分比文字"]}}
```
