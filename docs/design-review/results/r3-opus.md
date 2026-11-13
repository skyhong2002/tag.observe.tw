<!--
round: r3
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = reference, B = baseline (ffd6a5aa), C = new (web b50f93bf)
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
Maintainer check: C issue 2 (search-none desktop "只有一行") is a misread. rounds/r3/C/search-none_desktop.png is
byte-identical to the new set and shows the full no-results card with 24 小時／近一個月 chips; the one-line
version is B's (baseline). No change made for it.
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：7.5 / 10
一句話總評：這組是成熟的國際新聞比較產品，偏向標示、卡片節奏和手機底部導覽都很老練；扣分在付費牆、手機橫向溢出和過小的灰字，而且只有 4 個頁面，狀態類項目幾乎無從評估。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | ground-news-home desktop：頂部 banner 寫「See every side of every news story」；主圖標題上疊著 Left 29%／Center 27%／Right 44% 長條，主次清楚。verity-home desktop：「My Verity Beta」大圖卡下是分類、標題、副標、來源頭像與「2 HRS」 |
| 字體排印 | 7.5 | ground-news-home desktop：大標題用粗無襯線、層級分明，但「46% Right coverage: 11 sources」這類說明約 9–10px。google-news-tw desktop：中文標題與來源名字級合理，行長控制得好 |
| 色彩 | 8 | Ground News 的紅、白、藍偏向條自成系統，Blindspot 卡用紅框和藍框區分；底色是米色，有品牌感。google-news-tw 是標準 Material 藍，比較沒有個性 |
| 間距與版面 | 7.5 | ground-news-home desktop 三欄（Daily Briefing／主欄／Blindspot），1440 寬全部用上。verity-home desktop 左側有 icon 欄，但上方分類列在「Social iss」處被截斷 |
| 一致性 | 7.5 | 首頁與 story 共用頁首和 trending chip 列（Jensen Huang +、Nvidia + …）。偏向條在大卡、小列表、Blindspot 卡都出現，但樣式三種不同 |
| 資訊密度 | 8 | ground-news-home desktop 一屏約 10 則新聞，每則都附偏向條與來源數。google-news-tw desktop 有焦點新聞、地方新聞、為你精選三塊，密度適中 |
| 導覽 | 8 | ground-news mobile、verity mobile 都有底部 tab bar（News/For You/Search/Blindspot/Local；Home/Bias Split/Sources/Controversies），單手很好操作。google-news-tw mobile 上方 tab 在「台」字處被切掉 |
| 狀態與回饋 | 6.5 | 沒有載入、錯誤、空資料的截圖。ground-news-story desktop 的 Factuality、Ownership 只顯示鎖頭和「Upgrade」，沒有說明降級後還能看到什麼 |
| 響應式 | 7 | ground-news-home mobile 重排成單欄，偏向條保留文字標籤。google-news-tw mobile 卡片和「瀏覽更多頭…」按鈕超出右緣，看得出橫向溢出 |
| 文案 | 7.5 | ground-news-story mobile 寫「We've assigned a media bias rating of unknown to NVIDIA… look no further」，語氣自然但偏行銷。Google 新聞的繁中用詞正確（「焦點提要」「為你精選」） |
| 無障礙 | 6.5 | Ground News 偏向條在大卡上有 Left/Center/Right 文字，小列表卻只剩顏色條。灰色 meta 字很小、對比偏低；Verity 的大寫小字「COMPUTERS & INTERNET」只有約 10px |
| 信任與清楚 | 7 | ground-news-story desktop 有「our methodology here」連結與「Do you disagree? Edit bias」，但 NVIDIA 的偏向評為 unknown，可信度與持有者資料都被鎖在付費方案後 |

要保留的優點：
- Ground News 主圖上直接疊 Left／Center／Right 百分比條，一眼看懂立場分布（ground-news-home desktop）。
- Blindspot 欄用紅框、藍框卡片標出「只有一邊在報」的新聞（ground-news-home desktop）。
- 手機底部 tab bar 把主要功能放在拇指範圍內（ground-news-home mobile、verity-home mobile）。
- 方法論、「Edit bias」的入口就放在判斷結果旁邊（ground-news-story desktop）。
- Google 新聞每則都標來源 logo 與「1 小時前」，時間感清楚（google-news-tw desktop）。

最重要的五個問題（由嚴重到輕微）：
1. [信任與清楚] [ground-news-story] [兩者] Factuality、Ownership 只有鎖頭和「Upgrade」按鈕，偏向評等是 unknown —— 讀者最需要的判斷依據被付費牆擋住，降低可信度 —— 免費版至少給評等摘要和資料來源，付費只鎖細節。
2. [響應式] [google-news-tw] [mobile] 上方分類 tab 在「台」字處被截斷，焦點新聞卡片和「瀏覽更多頭…」按鈕超出視窗右緣 —— 有橫向溢出，部分控制項點不到 —— 卡片寬度改用視窗寬度，tab 列加捲動提示。
3. [無障礙] [ground-news-home] [desktop] 列表項的偏向條只有紅藍色塊，旁邊的「46% Right coverage」約 9–10px 灰字 —— 色弱讀者分不出兩側，小字對比不足 —— 列表也標 L/C/R 字母，說明字放大到 12px 以上。
4. [間距與版面] [ground-news-home] [mobile] 促銷 banner、Subscribe／Login、trending chip 三層頁首吃掉約 200 CSS px —— 首屏只剩一則新聞 —— 手機收起促銷列，或捲動後隱藏。
5. [導覽] [verity-home] [desktop] 分類列在 1440 寬時於「Social iss」截斷，沒有箭頭或漸層提示；左側 icon 欄和上方 tab 是兩套導覽 —— 使用者不知道還有更多分類，主次也不清 —— 加上溢出提示，合併成一套主導覽。

## 組 B
總分：6.5 / 10
一句話總評：資料完整、功能多，事件卡的藍綠對照很有特色；但手機寬表格被截斷、錯誤與空資料狀態處理粗糙，而且有內部 ID、錯誤代碼外露，整體還停在「工具」而不是「產品」。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 6.5 | home desktop：首屏是關鍵字插畫雲，中央只有「同一件事，各家怎麼說」和更新時間，沒有交代網站在做什麼。event desktop：事件卡的排名、標題、藍綠條、媒體 icon 主次清楚 |
| 字體排印 | 6 | article mobile：標題斷成「AI 教父婚外情連環／爆 黃仁勳辭輝達 CEO」。media-outlet mobile：列表標題斷成「全球經營政商人／脈」「為何難成／真？」。journalist desktop 表格數字約 11px |
| 色彩 | 7 | 主色橘紅一致，藍營是藍、綠營是綠。ranking-dark、home-dark desktop 是黑底配橘字，有個性。但 tag desktop 選中的「3天」是黑色、ranking-error 的「重新載入」也是黑鈕，和其他頁的橘色選中態不同 |
| 間距與版面 | 6.5 | 內容欄約 1120px，1440 寬兩側留白多。ranking desktop 的文字雲擠到 7–8px 小字、密成一團。event desktop 第一張事件卡的排名列下有一塊空的灰色占位框 |
| 一致性 | 6 | 時間 chip 各頁寫法不一：「1 天」「24 小時」「31 天」「近一個月」混用（search mobile 是 1天/31天，search-none desktop 是 24小時/近一個月）。選中色有橘有黑 |
| 資訊密度 | 7 | journalist desktop 一屏約 30 位記者，欄位完整。ranking desktop 的表格要到約 y=600 才出現，前面被文字雲和 20 個分類 chip 占住 |
| 導覽 | 6.5 | 桌面頂部 9 個主項目，目前位置用淺橘底標示，清楚。手機只有漢堡選單。my-saved mobile 的分頁 tab「設定」被擠到第二行。ranking 的藍營、綠營 chip 排在 18 個分類最後 |
| 狀態與回饋 | 5 | eve-error desktop：載入失敗卻顯示「404 找不到這個頁面」。event-empty desktop：日期列空白只剩左右箭頭，只寫「今天沒有事件資料。」。my-saved-empty 只有一行字、沒有下一步。my-saved-out 沒有登入按鈕，只有句中連結。event-loading 的骨架是列表樣式，和實際的卡片版面不符 |
| 響應式 | 5 | ranking mobile：表格右側「變動」欄被切掉，▲ 只露一半。similarity-daily、journalist mobile 的表格右緣數字被切斷（「20」「36」只剩半截），沒有任何可橫向捲動的提示 |
| 文案 | 6 | my-following desktop 的事件只顯示「事件 #4128」。ranking-error mobile 只給「錯誤代碼 2433737388」，沒說用途。search-none mobile 只有一句「過去 31 天沒有符合『zzqxv』的文章。」 |
| 無障礙 | 5.5 | search mobile 的事件小卡只有綠灰藍色條、沒有百分比文字。桌面大量 11–12px 灰色 meta 字。ranking mobile 的變動 ▲ 被裁切成粉色碎片 |
| 信任與清楚 | 7.5 | 幾乎每頁都有「本頁的資料來源與計算方式」。media-outlet desktop 側欄寫明收錄範圍、開始收錄日、流量資料更新日。similarity desktop 標出「相似度門檻 0.65」與日期區間 |

要保留的優點：
- 事件卡：排名＋熱度線＋標題＋藍綠其他比例條＋媒體 logo 列＋藍綠兩側代表標題，是全站最有辨識度的元件（event desktop）。
- 單一媒體頁右側的「媒體資料」與 Similarweb 流量來源面板，資料來源和時間點交代完整（media-outlet desktop）。
- 「本頁的資料來源與計算方式」的入口在各頁位置一致。
- 記者署名頁的內文比對，用紅綠標示異同，作為證據呈現很到位（journalist-person desktop）。
- 深色外觀用黑底和橘色強調，不是單純反轉成灰階（ranking-dark、home-dark desktop）。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [ranking] [mobile] 排行表在 390 寬時右側「變動」欄被裁掉，▲ 只剩一半；另見 similarity-daily_mobile、journalist_mobile 數字被截半 —— 手機是主要使用情境，核心數據看不到也沒有捲動線索 —— 改成卡片列表（名次、關鍵字、分數·篇數·家數、爆發力、變動），或至少凍結首欄並加捲動提示。
2. [狀態與回饋] [eve-error] [兩者] 事件頁載入失敗卻顯示「404 找不到這個頁面」 —— 誤導使用者以為連結失效、事件不存在，也沒有重試鈕 —— 區分「暫時無法載入」與「不存在」，前者給重新載入。另見 event-empty（只剩空箭頭列與一行字）、my-saved-empty（沒有 CTA）。
3. [資訊層級] [home] [兩者] 首屏只有關鍵字插畫雲與一句 slogan，沒有說明網站在做什麼、怎麼用 —— 第一次來的讀者看不出這是媒體比較工具 —— 在插畫下加一句功能說明和「看今天的事件」主要按鈕。
4. [文案] [my-following] [desktop] 追蹤的事件只顯示「事件 #4128」；ranking-error 只給「錯誤代碼 3772224109」 —— 內部 ID 外露，使用者認不出追的是什麼，代碼也不知道拿來做什麼 —— 改顯示事件名稱，錯誤代碼附上「回報時請附上這串編號」。
5. [一致性] [tag] [desktop] 選中的時間 chip「3天」是黑底，其他頁是橘底；ranking-error 的「重新載入」是黑鈕；時間選項有「1 天」「24 小時」「31 天」「近一個月」四種寫法 —— 降低系統感 —— 統一成一種選中色，時間詞彙全站統一。

## 組 C
總分：7.5 / 10
一句話總評：保留了 B 的資料深度，又補齊空資料、錯誤、登入前等狀態，手機排行改成卡片，首頁也加了說明，成熟度明顯更高；剩下手機寬表格、過小字級，以及搜尋無結果狀態在桌面與手機不一致。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7.5 | home desktop／mobile：插畫雲下加了「四周是今天正在升溫的關鍵字。新文易數收集台灣與部分國際新聞媒體的公開報導…」和「看今天的事件 →」「資料怎麼來」。event desktop 事件卡加上「綠營 14%・藍營 10%」文字 |
| 字體排印 | 6.5 | article mobile 標題改斷成「AI 教父婚外情連環爆／黃仁勳辭輝達 CEO」，自然多了。但 media-outlet mobile 仍有「政商人／脈」「今蚊／子園區」的斷字。桌面表格與 meta 仍約 11px |
| 色彩 | 7.5 | 選中態統一成橘色（tag desktop「3 天」、ranking-error「重新載入」）。藍綠只用在陣營資料。ranking-dark desktop 黑底配橘字成立 |
| 間距與版面 | 7 | ranking desktop 的文字雲放大、詞數變少，排行表約在 y=520 出現，比 B 早。內容欄仍約 1120px，1440 寬兩側空白偏多。ranking desktop 的「更多欄位 →」pill 壓在表頭「媒體」欄上 |
| 一致性 | 7 | 錯誤、空資料、登入前都用「虛線框＋標題＋說明＋主次按鈕」同一套樣式（event-empty、my-saved-empty、my-saved-out）。但 search desktop 的 chip 是「24 小時」，標題卻寫「過去 1 天的主要事件」；search-none 兩種尺寸的 chip 文字不同 |
| 資訊密度 | 7.5 | ranking mobile 每張卡含名次、分數·篇數·家數、sparkline、爆發力、變動，一屏約 6 筆、可完整掃讀。journalist desktop 一屏約 30 列。ranking desktop 首屏仍被約 20 個分類 chip 占去一塊 |
| 導覽 | 7.5 | ranking mobile：藍營、綠營 chip 移到「所有媒體」後面，改成橫向捲動。my-saved、my-following mobile 的分頁 tab 收在一行。event-empty 提供「看前一天（11/12）的事件」 |
| 狀態與回饋 | 8 | eve-error：「事件頁暫時無法載入」＋「重新載入」「看事件表」。event-empty：「今天還沒有整理出事件」並說明原因。my-saved-out：「登入後才能使用這一頁」＋「用 Google 帳號登入」。event-loading 骨架是卡片樣式，對應實際版面。但 search-none desktop 只有一行「過去 31 天沒有符合『zzqxv』的文章。」 |
| 響應式 | 6.5 | ranking mobile 改成卡片列表，好。similarity-daily、journalist mobile 仍是被截斷的寬表格，只加了「左右滑動看更多欄 →」提示，右欄數字照樣被切半。tag mobile 的「RSS」單獨掉到第二行 |
| 文案 | 7.5 | 錯誤頁寫「一直無法載入的話，歡迎到頁尾的『聯絡與移除請求』告訴我們，附上這串編號能更快找到原因」。tag desktop 寫「191 篇內文高度相似，分成 66 組（已比對 94% 的報導）」，比 B 的「相似 191 篇・66 群」好懂。my-following 仍附「事件 #4128」 |
| 無障礙 | 6 | search、event 的藍綠條旁加了百分比文字，不再只靠顏色。但桌面仍大量 11px 灰字（journalist 表格的百分比、ranking 說明列）。ranking desktop 的「更多欄位」pill 蓋住表頭 |
| 信任與清楚 | 8 | ranking desktop 表格上方說明「爆發力：分數加上近 48 小時的升幅；分數：每家媒體都報一篇約 50 分，同一家多報分數遞減；變動：名次和 24 小時前相比」。資料來源入口各頁一致。tag 頁仍把黃仁勳標成「政治人物」 |

要保留的優點：
- 手機關鍵字排行改成卡片列表，名次、指標、走勢、變動一次看完（ranking mobile）。
- 錯誤、空資料、登入前、無收藏共用一套說明加下一步按鈕的狀態元件（eve-error、event-empty、my-saved-out、my-saved-empty）。
- 首頁插畫雲下的一句功能說明，加上「看今天的事件」「資料怎麼來」（home desktop／mobile）。
- 排行表上方對爆發力、分數、變動的白話定義（ranking desktop）。
- 藍綠比例條旁補上「綠 14%・藍 10%」文字，不再只靠顏色（search mobile、event desktop）。
- 載入骨架與實際卡片版面一致，減少跳動（event-loading desktop）。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [similarity-daily] [mobile] 各媒體表格在 390 寬時右欄數字被截半（「6,043 20…」），只靠「左右滑動看更多欄 →」提示；另見 journalist_mobile、similarity-reposts_mobile —— 手機使用者仍要橫向捲動才能讀關鍵比例，截半的數字容易誤讀 —— 比照 ranking mobile 改成卡片，或只留 2–3 個關鍵欄並提供欄位切換。
2. [狀態與回饋] [search-none] [desktop] 桌面無結果只有一行「過去 31 天沒有符合『zzqxv』的文章。」、chip 是「1天…31天」，手機卻是完整建議加三個按鈕、chip 是「24 小時…近一個月」 —— 同一狀態在兩種尺寸行為不同，桌面使用者沒有下一步 —— 兩種尺寸統一用手機版的完整狀態，時間詞彙也一併統一。
3. [字體排印] [media-outlet] [mobile] 文章列表標題斷字不自然：「全球經營政商人／脈」「為何難成／真？」「今蚊／子園區」 —— 中文斷在詞中間會影響閱讀，文章頁已修好但列表沒有 —— 列表標題取消平衡換行，或改成以標點、空白為斷點。
4. [無障礙] [journalist] [desktop] 表格的百分比、刊登媒體、說明列約 11px 淺灰；ranking desktop 的「更多欄位 →」pill 壓住表頭 —— 長時間比對資料的研究者讀起來吃力，對比可能不到 4.5:1 —— 表格內文提高到 13px 以上、灰階加深，「更多欄位」改放表格外。
5. [一致性] [search] [desktop] 時間 chip 寫「24 小時」，下方標題卻是「過去 1 天的主要事件」；tag desktop 也把 CEO 黃仁勳標成「政治人物」 —— 小處的不一致會削弱資料判斷的可信度 —— 標題跟著 chip 的用詞走，人物分類加上來源或人工覆核。（附註：similarity-daily 與 similarity-reposts 兩個狀態的截圖完全相同，都選在「轉載統計」分頁，B 組也一樣。請維護者確認「每日相似統計」是否有獨立入口，或是截圖狀態沒有切換成功。）

```json
{"A": {"overall": 7.5, "scores": {"資訊層級": 8, "字體排印": 7.5, "色彩": 8, "間距與版面": 7.5, "一致性": 7.5, "資訊密度": 8, "導覽": 8, "狀態與回饋": 6.5, "響應式": 7, "文案": 7.5, "無障礙": 6.5, "信任與清楚": 7}, "issues": ["[信任與清楚] ground-news-story 兩者：Factuality/Ownership 鎖在 Upgrade 後，偏向評為 unknown", "[響應式] google-news-tw mobile：分類 tab 與焦點卡片超出右緣，有橫向溢出", "[無障礙] ground-news-home desktop：列表偏向條只有紅藍色塊，說明字約 9–10px", "[間距與版面] ground-news-home mobile：促銷 banner＋登入列＋trending 列占去約 200px 首屏", "[導覽] verity-home desktop：分類列在「Social iss」截斷且無提示，左側 icon 欄與上方 tab 是兩套導覽"]}, "B": {"overall": 6.5, "scores": {"資訊層級": 6.5, "字體排印": 6, "色彩": 7, "間距與版面": 6.5, "一致性": 6, "資訊密度": 7, "導覽": 6.5, "狀態與回饋": 5, "響應式": 5, "文案": 6, "無障礙": 5.5, "信任與清楚": 7.5}, "issues": ["[響應式] ranking mobile：排行表右側變動欄被裁掉；similarity-daily/journalist mobile 數字截半且無捲動提示", "[狀態與回饋] eve-error 兩者：載入失敗顯示成 404 找不到頁面、沒有重試；event-empty 只剩空箭頭列", "[資訊層級] home 兩者：首屏只有插畫雲與 slogan，沒有功能說明與主要行動", "[文案] my-following desktop 顯示「事件 #4128」；ranking-error 只給錯誤代碼不說用途", "[一致性] tag desktop 選中 chip 為黑、其他頁為橘；時間詞彙 1天/24小時/31天/近一個月混用"]}, "C": {"overall": 7.5, "scores": {"資訊層級": 7.5, "字體排印": 6.5, "色彩": 7.5, "間距與版面": 7, "一致性": 7, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 8, "響應式": 6.5, "文案": 7.5, "無障礙": 6, "信任與清楚": 8}, "issues": ["[響應式] similarity-daily mobile：寬表格右欄數字仍被截半，只加滑動提示；另見 journalist mobile", "[狀態與回饋] search-none desktop 只有一行無結果文字、chip 為 1天/31天，mobile 卻是完整建議＋按鈕、chip 為 24小時/近一個月", "[字體排印] media-outlet mobile：列表標題斷在詞中間（政商人/脈、今蚊/子園區）", "[無障礙] journalist/ranking desktop：表格與說明 11px 淺灰；「更多欄位」pill 壓住表頭", "[一致性] search desktop：chip「24 小時」但標題寫「過去 1 天」；tag 頁把黃仁勳標成政治人物；similarity-daily 與 reposts 截圖相同待確認"]}}
```
