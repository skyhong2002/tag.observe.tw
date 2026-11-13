<!--
round: r9
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = new (web 4d94437b), B = reference, C = baseline (ffd6a5aa)
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
Maintainer notes: all three sets dropped 0.5 this round (a stricter reviewer). The "tag-camp" and "search" states the
reviewer could not find are in the set (tag-camp_*.png; search_*.png shows /article/, where an empty search redirects).
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：7.5 / 10
一句話總評：資訊完整、狀態處理成熟，手機版把寬表格改成卡片，是三組裡最完整的新聞比較工具。剩下的問題集中在幾處：原始網址和內部編號露出、桌面寬表格超出版面、藍色語意撞色，以及幾個數字不一致。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | home desktop：文字雲中央是品牌與「同一件事，各家怎麼說」，下方有一段說明網站在做什麼，還有「看今天的事件→」「資料怎麼來」兩個入口；下方三欄依序是熱門關鍵字、焦點事件、藍綠溫差，主次清楚。event desktop：前 3 件用大卡片，第 4 件起改成雙欄，右側有「今天 61 件」索引。扣分：eve desktop 的麵包屑是「事件表 / 事件 #4128」，home 的「讀者關注」直接列出「事件 #4078」「事件 #4602」，沒有事件名稱 |
| 字體排印 | 7.5 | 繁中內文行高寬鬆，article desktop 正文行長大約 34 字，很舒適。eve mobile 標題斷行自然。扣分：topic、topic-story、event 卡片下方的原始網址（如 `https://news.pchome.com.tw/features/living/2024…`）在 topic mobile 從路徑中間斷行；ranking desktop、media desktop 的表格數字字級偏小（大約 11px） |
| 色彩 | 8 | 主色是一個橘紅色（文字雲、選中的膠囊鈕、CTA），系統一致。藍綠用綠／灰／藍三段條，旁邊有「綠 33%・藍 27%」文字（home desktop）。home-dark、ranking-dark、media-outlet-dark 是暖橘配近黑底，有自己的個性，不是預設灰階。扣分：eve desktop 與 tag desktop 的「關鍵字變化」用藍色深淺表示熱度，和「藍營」的語意色衝突 |
| 間距與版面 | 7.5 | home desktop 三欄格線對齊、節奏穩定。my-saved desktop 是主欄加「這幾頁怎麼用」側欄。扣分：ranking desktop 的表格在 1440 寬時仍超出容器，「媒體」欄被切掉，要靠「看更多欄→」；similarity-daily desktop 最後一欄「被採用」也被截斷；article desktop 正文結束後，左欄有大約 350px 空白，只有右側的延伸閱讀還在延續 |
| 一致性 | 8 | 期間膠囊鈕在各頁都用「24 小時／3 天／7 天」，選中都是橘色（tag、search、media-outlet）。錯誤頁（eve-error、ranking-error）共用同一個模板。空狀態（event-empty、search-none、my-saved-empty）都是虛線卡片加主要／次要按鈕。扣分：media-outlet 用「不限期間」、search 用「近一個月」，同一組控制項的命名不一樣 |
| 資訊密度 | 7.5 | ranking desktop 的文字雲大約 150 個詞，大小有層次，下方表格一屏大約 37 列。media desktop 的篩選列分成「媒體傾向／報導範圍／收錄狀態／媒體標籤」四列，多出來的標籤收進「其他 20 個標籤▾」。扣分：event desktop 每張卡片都附 2–3 條含完整網址的連結，卡片很長；topic desktop 每項都重複「最後更新…・開始追蹤前已上架・網址」 |
| 導覽 | 7.5 | 桌面頂部導覽有目前頁的底色（如「事件」）。event-hour 有「←前一小時／後一小時→」和時段長條。media、similarity 用子分頁（收錄概況／流量與排名）。扣分：手機版只有漢堡選單，沒有常駐的主要導覽；event mobile 的日期列只看得到四天 |
| 狀態與回饋 | 8.5 | event-empty mobile：「今天還沒有整理出事件」，說明原因，給「看前一天（11/12）的事件」「看關鍵字排行」。search-none desktop 列出搜尋技巧和 3 個 CTA。my-saved-out 有登入好處清單和「用 Google 帳號登入」。eve-error 和 ranking-error 有「重新載入」與回報編號。event-loading mobile 的骨架和真正的卡片版面一致。扣分：載入骨架沒有任何文字；資料夾裡沒有「標籤只看綠營」和「搜尋還沒輸入」的截圖，無法評這兩個狀態 |
| 響應式 | 8 | ranking mobile 把表格改成卡片（名次、分數・篇數・家數、走勢、爆發力、變動）。journalist mobile、similarity-daily mobile 也改成卡片，並附排序下拉。media mobile 的篩選列可橫向捲動，有箭頭提示，表格也標示「這張表可以左右滑動 看更多欄→」。扣分：event mobile 第 1 張卡片顯示 6 個媒體圖示加「+4」，但同一行寫「91 家」，數字對不上 |
| 文案 | 7.5 | 用語自然，例如「累計上榜約 7 天」、「191 篇內文高度相似，分成 66 組（已比對 94% 的報導）」、「相似度門檻 0.65（內文約 65% 相同才算相似）」。扣分：topic 的「開始追蹤前已上架」，similarity 圖表的「÷ 比對篇數」，event 的日期欄位顯示美式格式「11/13/2026」 |
| 無障礙 | 7 | 藍綠在徽章上同時用文字和顏色（「偏藍」「偏綠」），長條旁有百分比文字。表格列和卡片按鈕高度足夠。扣分：圖表圖例與表格內的灰色小字對比偏低（tag desktop 的 x 軸、media desktop 的「最新文章」欄）；eve 的「重點報導」只用媒體名稱前的小圓點分藍綠；截圖看不到焦點樣式 |
| 信任與清楚 | 8 | 每頁都有「本頁的資料來源與計算方式」。頁尾寫「今天已收錄 684 篇・24 小時內 220 家媒體發稿」。新聞列附原站網址和外連圖示。ranking 有爆發力／分數／變動的定義列。topic-story 說明「哪些新聞放進這一頁由三立新聞網決定」。扣分：article desktop 的「文章摘要」和下方正文是同一段文字，容易誤以為那就是全文；similarity 的 daily 與 reposts 兩張截圖完全相同 |

要保留的優點：
- 手機版把寬表格改成卡片（ranking、journalist、similarity mobile），每列都放了名次、分數、走勢和變動。
- 空狀態、錯誤和未登入的模板（event-empty、search-none、my-saved-out、eve-error）都講清楚原因，並給兩個下一步。
- 首頁文字雲下方的網站說明，和「看今天的事件→」「資料怎麼來」兩個入口。
- 藍綠分布同時用三段條和「綠 xx%・藍 xx%」文字，不只靠顏色。
- media 的篩選分成有標籤的四列，次要標籤收合；手機版可橫向捲動並有箭頭提示。
- 收藏、追蹤頁的「這幾頁怎麼用」側欄。

最重要的五個問題（由嚴重到輕微）：
1. [間距與版面] [ranking] [desktop] 1440 寬時表格仍超出容器，「媒體」欄只露出一部分，要另外橫向捲動。另見 similarity-daily desktop 的「被採用」欄 —— 在大螢幕上長時間比對資料的人，反而看不到完整的表格 —— 把「一起出現」「首次出現」等次要欄位收成可展開的欄，或讓表格吃滿 1440 的寬度。
2. [文案] [home、eve] [兩者] 「讀者關注」顯示「事件 #4078」「事件 #4602」，事件頁的麵包屑是「事件 #4128」—— 內部編號對讀者沒有意義，在首頁還佔了一個熱門位置 —— 一律改用事件的代表標題或主要標籤組合，編號最多放在網址裡。
3. [色彩] [eve、tag] [兩者] 「關鍵字變化」甘特圖用藍色深淺表示熱度，同一頁的長條圖又用藍色代表「藍營傾向」—— 讀者可能把熱度誤讀成陣營 —— 熱度改用主色橘或中性灰的單一色階，藍綠只留給陣營。
4. [資訊密度] [event、topic、topic-story] [mobile] 每則新聞下方都完整顯示原始網址，在手機上斷成兩行，例如 topic mobile 的「https://news.pchome.com.tw/featu / res/living/…」—— 網址佔了大約三分之一的列高，干擾掃讀標題 —— 改成只顯示網域加外連圖示，完整網址放進 title 或複製按鈕。
5. [信任與清楚] [article、event] [desktop／mobile] article 的「文章摘要」和正文段落文字相同；event mobile 第 1 張卡片顯示 6 個圖示加「+4」，卻寫「91 家」。另見 home 文字雲左下「新加坡」的破圖小圖示（home desktop，大約 x380 y290，請看 1:1 原圖確認）—— 數字和內容重複，會削弱資料站的可信度 —— 正文只有摘要時，明確標示「本站只擷取摘要，全文請到原站」；「+N」改成「91 − 已顯示數」；破圖時改用文字標籤。

## 組 B
總分：7 / 10
一句話總評：參考組裡 Ground News 的品牌、藍綠（左中右）語意和手機分頁列是業界水準。但 Google 新聞的手機版橫向溢出，Verity 密度偏低，Ground News 的媒體頁大量內容鎖在付費牆後，整體參差。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | ground-news-home desktop：頭條大圖疊上「Left 29% / Center 27% / Right 44%」條，左欄 Daily Briefing、右欄 Blindspot，網站定位一眼可見。google-news-tw desktop：「焦點提要＋日期」，主次清楚。verity-home desktop：單欄大圖，資訊層級單純但偏弱 |
| 字體排印 | 8 | Ground News 的無襯線標題字重對比強烈。Verity 用襯線導言，有編輯感。Google 新聞的繁中字級穩定。扣分：ground-news-home 的「46% Right coverage: 11 sources」大約 9px，太小 |
| 色彩 | 8 | Ground News 用卡其加炭黑，左右用暗紅與深藍，有品牌感又克制。Google 新聞是預設 Material 藍，沒有個性。Verity 的 Controversies 用綠到紅的漸層線。三個產品都沒有截深色外觀 |
| 間距與版面 | 7.5 | ground-news-home desktop 三欄有分隔線，節奏好。扣分：ground-news-story desktop 中段 y 大約 800–1180 一大片空白；verity-home desktop 的分類列在「Social iss」處被截斷 |
| 一致性 | 7 | 各產品內部一致：Ground News 的條狀圖、膠囊加「+」標籤反覆使用；Google 新聞每張卡片都有媒體、時間和完整報導按鈕。三個產品之間無法比較 |
| 資訊密度 | 7 | google-news-tw desktop 一屏大約 8 則，加上「瀏覽更多頭條新聞和觀點」。ground-news-home 一屏大約 12 則，各有覆蓋條。verity-home desktop 一屏只有大約 2.5 則（大圖 360px 高） |
| 導覽 | 8 | ground-news-home mobile、verity-home mobile 都有固定底部分頁列（News/For You/Search/Blindspot/Local）。Ground News 的熱門主題列可橫向捲動、一鍵追蹤。Google 新聞桌面有底線標示目前頁 |
| 狀態與回饋 | 6 | 只拿到有資料的狀態，沒有空、錯誤或載入。ground-news-story 的 Factuality、Ownership 只顯示「Reveal … by upgrading」和「Upgrade」，是付費牆而不是資料說明。google-news-tw 的「為你精選」用登入 CTA 代替內容 |
| 響應式 | 6.5 | google-news-tw mobile 明顯橫向溢出：卡片右側被切（「瀏覽更多頭」「王念好追平」截斷），上方分頁的「台」也被切。verity-home mobile 的回頂端圓鈕蓋住標題（「Ath↑s」）。ground-news-home mobile 處理得好 |
| 文案 | 7.5 | Ground News 的「See every side of every news story」很精準。Google 新聞用「1 小時前」等相對時間，自然。扣分：ground-news-story 的「We rank NVIDIA as Unknown factuality … look no further」，語意自相矛盾 |
| 無障礙 | 7 | Ground News 的左中右條有百分比文字，不只靠顏色。扣分：鎖住的「Factuality／Ownership」灰字對比很低；Verity 的 Controversies 只有漸層線加小圖示，沒有數值；Google 新聞的卡片按鈕圖示偏小 |
| 信任與清楚 | 7 | ground-news-story 有「our methodology here」「Media Bias Ratings」連結，也有「Do you disagree? Edit bias」。扣分：NVIDIA 被評為「unknown」，事實查核鎖在付費牆後；google-news-tw 完全不交代排序與收錄依據 |

要保留的優點：
- Ground News 的左中右覆蓋條直接疊在頭條圖上，條內有百分比文字（ground-news-home desktop）。
- Ground News 與 Verity 的手機固定底部分頁列，單手就能切換主要區塊。
- Ground News 熱門主題膠囊附「+」，一鍵追蹤。
- Google 新聞同一事件的多家標題群組，加上「瀏覽更多頭條新聞和觀點」入口。
- Verity 的 Controversies「UNLIKELY–LIKELY」視覺化，概念新穎。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [google-news-tw] [mobile] 頁面寬度超過 390，卡片與分頁在右側被切斷 —— 手機讀者看不到完整標題和按鈕 —— 改成單欄流式卡片，分頁列改為可橫向捲動。
2. [信任與清楚] [ground-news-story] [兩者] 媒體的 Factuality／Ownership 鎖在付費牆後，偏向評等是「unknown」—— 這正是讀者最需要的判斷依據 —— 至少公開評等結果與方法摘要，付費內容另外標示。
3. [間距與版面] [ground-news-story] [desktop] 中段大約 380px 空白，主欄只有 3 則新聞 —— 頁面看起來像沒載完 —— 內容少時縮短版面，或用相關新聞填補。
4. [資訊密度] [verity-home] [desktop] 單欄大圖，一屏只有 2–3 則 —— 比對多家報導的效率很低 —— 縮小圖片或改成雙欄，提高掃讀效率。
5. [響應式] [verity-home] [mobile] 回頂端浮動鈕蓋住第二則標題文字 —— 遮住內容，也容易誤觸 —— 浮動鈕要避開內文區，或只在捲動後出現。

## 組 C
總分：6 / 10
一句話總評：骨架和 A 相同、有資料時也算可用，但手機寬表格直接被裁切、空狀態與錯誤頁說明不足或用錯，還有原始實體字元、灰色占位框、藍色下跌箭頭等細節，整體摩擦明顯較多。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7 | home desktop 的三欄架構和 A 相同，焦點事件突出。扣分：home desktop 與 mobile 的文字雲下方沒有任何網站說明或入口，首次來訪者只看到「同一件事，各家怎麼說」一行字；ranking desktop 的文字雲大約 400 個詞，搶走表格的注意力 |
| 字體排印 | 6.5 | 內文與標題基本可讀。扣分：ranking desktop 文字雲的最小字級大約 6px，無法閱讀；tag desktop 鉅亨網摘要出現原始字元「&#10;」；article desktop 正文前多出一行和正文同字級的「本文共827字」 |
| 色彩 | 7 | 主色和深色外觀與 A 同一套（home-dark、ranking-dark）。扣分：ranking desktop 的下跌「▼」用藍色，和藍營語意衝突；tag desktop 選中的「3 天」是黑色膠囊，其他頁選中都是橘色；event-hour mobile 的「看 2026-11-13 整天的事件→」是藍色連結，其他連結都是橘色 |
| 間距與版面 | 6.5 | 扣分：home、event desktop 與 mobile 每張卡片的「上榜」旁都有一個淺灰小框加細線，看起來像空白占位；media desktop 的標籤膠囊攤成 4 列、大約 50 個，沒有群組標題；ranking desktop 的媒體欄被切到只剩 1 個圖示；topic desktop 的關鍵字列有「徐佳青」單獨換到第三行 |
| 一致性 | 6 | 期間選項各頁不同：search 用「1 天／31 天」，tag 用「1 天」，media-outlet 用「全部」。選中色有黑有橘。eve-error 用 404 模板，ranking-error 用「暫時無法載入」模板，同類錯誤兩種樣子 |
| 資訊密度 | 6 | media mobile 在表格前先排了 13 列標籤膠囊；ranking mobile 有 6 列膠囊加極密的文字雲，往下捲很久才看到排行。my-saved-empty 與 search-none desktop 卻只有一行字、大片空白 |
| 導覽 | 7 | 桌面導覽與子分頁和 A 相同，目前頁有標示。扣分：my-saved mobile 的子分頁「設定」被擠到第二行；topic-story mobile 的麵包屑是「議題 / 三立新聞網 / 議題」，最後一層不是頁名 |
| 狀態與回饋 | 5 | event-empty mobile：日期列框是空的，只剩「< >」，下方一句「今天沒有事件資料。」，同時還寫「藍綠家數比約 50：50」。eve-error mobile 把載入失敗顯示成「404 找不到這個頁面」。search-none 只有「過去 31 天沒有符合『zzqxv』的文章。」。my-saved-empty 和 my-saved-out 都只有一行文字或一個內文連結，沒有按鈕。event-loading mobile 的骨架是一般清單，和實際的卡片版面不符 |
| 響應式 | 5 | ranking mobile 的表格在「變動」欄被裁切（右緣只露出半個三角形），沒有捲動提示；journalist mobile、similarity-daily mobile、media mobile 的表格同樣在右側被切；ranking-dark mobile 也一樣 |
| 文案 | 6 | 「上榜 162 小時」（A 寫「約 7 天」）、「相似 191 篇・66 群（已比對 1238／1311 篇）」、「已達多家跟進門檻」、「31 天」都偏系統語。my-following mobile 的事件只寫「事件 #4128」。ranking-error 的「錯誤代碼 2433737388」沒說要拿這個代碼做什麼 |
| 無障礙 | 6 | home 與 search 卡片的藍綠只剩三段色條，沒有百分比文字，色弱讀者無法判讀；藍色「▼」又和藍營混淆；文字雲小字的對比與字級都不足 |
| 信任與清楚 | 7 | 每頁都有「本頁的資料來源與計算方式」，頁尾有收錄統計。扣分：article desktop 同時出現「全文約 893 字」和「本文共827字」兩個數字；similarity 頁只寫「相似度門檻 0.65」，沒有解釋；eve-error 誤報 404，會讓人以為事件被刪除 |

要保留的優點：
- 與 A 共用的首頁三欄架構，以及事件卡的藍綠三段條與媒體圖示列。
- eve 事件頁的統計卡（事件表名次／最高分／報導／藍綠家數）和時間變化圖。
- media-outlet 右欄把媒體資料、寫法、Similarweb 流量來源和媒體關係集中呈現。
- 404 頁的入口卡片（首頁、最新文章、事件表、關鍵字排行、議題表、專題）本身很有用，只是用錯了情境。
- 深色外觀的暖橘配色（home-dark、media-outlet-dark）。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [ranking] [mobile] 排行表在「變動」欄被裁切，沒有任何可滑動的提示。另見 journalist mobile 的「篇數」欄、similarity-daily mobile、media mobile —— 手機是主要使用情境，關鍵數字直接看不到 —— 寬表格在手機改成卡片，至少要加上可捲動提示和固定首欄。
2. [狀態與回饋] [eve-error] [兩者] 事件頁載入失敗卻顯示「404 找不到這個頁面」—— 讀者會以為事件被刪除或網址錯了，不會重試 —— 改用「暫時無法載入」的模板，提供重新載入與回報編號，保留入口卡片當作次要導覽。
3. [狀態與回饋] [event-empty] [兩者] 空資料時日期列框只剩箭頭，文案是「今天到目前為止的 0 件事」「今天沒有事件資料」，還顯示 50：50。另見 search-none、my-saved-empty —— 讀者不知道原因，也沒有下一步 —— 說明事件怎麼產生、何時會出現，並提供「看前一天」「看關鍵字排行」等按鈕。
4. [字體排印] [tag] [desktop] 摘要露出「&#10;」原始字元。另見 home 與 event 卡片上看起來空白的灰色占位框、article 的「本文共827字」—— 原始字元和像沒載完的元件直接傷害專業感 —— 輸出前解碼 HTML 實體；走勢資料平坦時不要畫框；移除擷取來的字數行。
5. [色彩] [ranking] [desktop] 下跌「▼」用藍色，home 與 search 卡片的藍綠條也沒有文字百分比 —— 在藍綠語意很重的網站上，藍色同時代表「下跌」和「藍營」，而且只靠顏色傳達 —— 變動改用中性灰或紅與灰；藍綠條一律附上「綠 xx%・藍 xx%」。

```json
{"A": {"overall": 7.5, "scores": {"資訊層級": 8, "字體排印": 7.5, "色彩": 8, "間距與版面": 7.5, "一致性": 8, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 8.5, "響應式": 8, "文案": 7.5, "無障礙": 7, "信任與清楚": 8}, "issues": ["ranking desktop：1440 寬時表格仍超出容器，媒體欄被切（另見 similarity-daily 的被採用欄）", "home／eve：讀者關注與麵包屑顯示「事件 #4078／#4128」等內部編號", "eve／tag：關鍵字變化用藍色熱度，和藍營語意色衝突", "event／topic mobile：完整原始網址從路徑中間斷行，干擾掃讀", "article 摘要與正文重複、event mobile「+4」對「91 家」數字不符、home 文字雲左下「新加坡」破圖小圖示"]}, "B": {"overall": 7, "scores": {"資訊層級": 8, "字體排印": 8, "色彩": 8, "間距與版面": 7.5, "一致性": 7, "資訊密度": 7, "導覽": 8, "狀態與回饋": 6, "響應式": 6.5, "文案": 7.5, "無障礙": 7, "信任與清楚": 7}, "issues": ["google-news-tw mobile 橫向溢出，卡片與分頁被切斷", "ground-news-story 的 Factuality／Ownership 鎖在付費牆後，NVIDIA 評為 unknown", "ground-news-story desktop 中段大片空白", "verity-home desktop 單欄大圖，一屏僅 2–3 則", "verity-home mobile 回頂端浮動鈕遮住標題"]}, "C": {"overall": 6, "scores": {"資訊層級": 7, "字體排印": 6.5, "色彩": 7, "間距與版面": 6.5, "一致性": 6, "資訊密度": 6, "導覽": 7, "狀態與回饋": 5, "響應式": 5, "文案": 6, "無障礙": 6, "信任與清楚": 7}, "issues": ["ranking／journalist／similarity／media mobile：寬表格右側被裁切且沒有滑動提示", "eve-error：載入失敗被顯示成 404 找不到頁面", "event-empty／search-none／my-saved-empty：空狀態只有一行字，沒有原因與下一步", "tag 摘要露出 &#10;、首頁與事件卡有空白灰色占位框、article 多出「本文共827字」", "ranking 下跌箭頭用藍色、卡片藍綠條沒有百分比文字，只靠顏色"]}}
```
