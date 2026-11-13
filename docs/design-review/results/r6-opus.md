<!--
round: r6
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = baseline (ffd6a5aa), B = new (web 99243454), C = reference
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
Maintainer notes: the baseline rose 6.5→7.0 with identical screenshots (drift). similarity-daily = similarity-reposts is the
inventory (/similarity/daily/ redirects), not the product.
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：7 / 10
一句話總評：功能與資料完整，品牌字雲有辨識度；但幾個狀態做壞了（載入錯誤時顯示 404、空狀態只有一行字、卡片裡留著空白的佔位框），手機版的表格與分頁籤也還沒調好，整體還不夠精修。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7 | home_desktop：首屏是關鍵字字雲，中間是「新文易數／同一件事，各家怎麼說」，下面依序是熱門關鍵字、焦點事件、藍綠溫差三欄，主次清楚。不過沒有一句話說明這是什麼網站、能做什麼，第一次來的人只看到一堆詞。event_desktop：排第 1 的事件卡把標題、標籤、藍綠條、各家標題對照依序排好，層級正確。 |
| 字體排印 | 7 | eve_desktop：事件標題用粗黑體約 24px，內文行高寬鬆，可讀性好。article_mobile：標題斷在「連環／爆」，把一個詞切成兩行。article_desktop／mobile：正文第一行「本文共827字」和上方的「全文約 893 字」重複，數字還對不上。延伸閱讀的媒體名與時間約 11px，偏小。 |
| 色彩 | 7.5 | 品牌橘紅貫穿 logo 圓點、字雲、選取中的分頁籤與日期鈕。藍綠用綠／灰／藍三段條（event_desktop「其他 76%」），語意固定。在 search_desktop 列表裡，「偏藍」「偏綠」用小色塊標示，不搶版面。 |
| 間距與版面 | 6.5 | article_desktop：1440 寬只用中間約 590px 單欄，延伸閱讀也堆在正文下方，左右大片空白。event_desktop 排第 1 的卡片，在標題上方留了一個空的灰色框（約 100×28px）。home_mobile 每張事件卡的媒體列下方，也都有一個空的佔位框。 |
| 一致性 | 7 | 各頁共用藥丸形篩選鈕、圓角卡片與「本頁的資料來源與計算方式」摺疊區，這部分有系統。但期間的寫法不一致：search_desktop 用「1 天／31 天」，tag_desktop 用「1 天／3 天／7 天」，而且選取中的樣式一個是黑底、一個是橘底（tag_desktop 的「3 天」是黑底）。 |
| 資訊密度 | 7.5 | event_desktop 右側有「今天 61 件事」的編號索引，加上主欄卡片，一屏能掃讀很多內容。media_desktop 表格一列一家媒體，含 24 小時長條，很好掃。媒體頁的標籤篩選卻把 40 多顆鈕全部攤開，佔掉約 180px 高。 |
| 導覽 | 7 | 桌面頂部有 9 個項目，選取中的項目用橘底標示，位置清楚。my-saved_mobile／my-following_mobile：「我的新文易數」分頁籤在手機上擠不下，「設定」被擠到第二行。event_mobile 的日期列左右都被裁切，例如左邊只剩「/09」。 |
| 狀態與回饋 | 5 | eve-error_desktop：資料載入失敗時卻顯示「404 找不到這個頁面」，會讓人以為網址錯了。event-empty_desktop：只有一行「今天沒有事件資料。」，日期列變成空框，藍綠比寫成「50：50」，讓人懷疑資料是否可信。search-none_desktop 只有一句話，沒有下一步。my-saved-empty 也只有一行字，沒有按鈕。my-saved-out 只有一個行內「登入」文字連結。 |
| 響應式 | 6.5 | home_mobile 的字雲重排得不錯。event_mobile 卡片內的原文網址折成兩行（例如「…/head」換行接「lines/274007」）。my-* 系列頁面的分頁籤換行。手機與桌面在佔位框、日期列裁切上各有破綻。 |
| 文案 | 7 | 多數用語自然，例如「今天才過了 3 個小時，事件還在累積」。「31 天」「1 天」偏工程語氣。事件被追蹤後只顯示「事件 #4128」（my-following_desktop），這是內部編號。article 頁「本文共827字」和「全文約 893 字」並存，互相矛盾。 |
| 無障礙 | 6.5 | 藍綠標示同時有文字（「偏藍」「綠營 28%」），沒有只靠顏色。但 home_mobile 事件卡的藍綠條沒有百分比文字，只能看顏色。延伸閱讀與表格內的灰字約 11px，對比偏低。截圖看不到焦點樣式。 |
| 信任與清楚 | 7.5 | 每頁都有「本頁的資料來源與計算方式」，媒體頁標註「更新於 11/13 02:48」，關鍵字頁有 Wikidata 與 CC 授權，新聞列都附原始網址並標示外連。但 similarity-daily 與 similarity-reposts 兩張截圖完全相同（md5 一致），轉載統計看起來沒有切換成功。 |

要保留的優點：
- 首頁關鍵字字雲加上置中的「新文易數」logo，品牌辨識度高，又直接反映當下的熱度（home_desktop／home_mobile）。
- 事件卡把同一事件的藍營、綠營標題並排對照，最能體現「同一件事，各家怎麼說」（event_desktop）。
- 每則新聞都列出原始 URL 並附外連圖示，來源透明（search_desktop、eve_desktop）。
- 媒體總表一列一家，含 24 小時長條，排序與篩選齊全（media_desktop）。
- 記者頁的內文差異比對，用顏色標出「本篇有、對方無」，對媒體識讀很有價值（journalist-person_mobile）。

最重要的五個問題（由嚴重到輕微）：
1. [狀態與回饋] [eve-error] [兩者] 事件頁載入失敗時顯示「404 找不到這個頁面」，沒有重試按鈕 —— 使用者會誤以為連結失效，不會重新整理 —— 錯誤和 404 要分開處理：說明是暫時無法載入，提供「重新載入」與返回事件表。
2. [間距與版面] [event] [兩者] 排第 1 的事件卡標題上方，和首頁各張事件卡裡，都留著空的灰色佔位框（另見 home_mobile 每張卡的媒體列下方） —— 看起來像壞掉或沒載完，損及信任 —— 沒有資料時就整塊不渲染。
3. [狀態與回饋] [event-empty、search-none、my-saved-empty] [兩者] 空狀態只有一行灰字，沒有原因也沒有下一步；event-empty 的日期列是空框，藍綠比還寫「50：50」 —— 使用者會在死路上卡住 —— 說明為什麼沒有資料，並提供看前一天、熱門關鍵字等按鈕。
4. [響應式] [my-saved、my-following] [mobile] 「我的新文易數」的五個分頁籤在 390 寬下擠不下，「設定」被擠到第二行；event_mobile 的日期列兩端也被裁切 —— 看起來像排版失誤 —— 改成可橫向捲動的分頁籤，或縮短間距。
5. [版面／文案] [article] [desktop] 文章頁在 1440 寬只用約 590px 單欄，延伸閱讀堆在正文下方；正文開頭的「本文共827字」和上方的「全文約 893 字」互相矛盾 —— 浪費空間，也讓數字可信度打折 —— 改成雙欄，延伸閱讀放側欄，並刪掉重複的字數。

## 組 B
總分：8 / 10
一句話總評：資料、品牌和 A 相同，但狀態頁、空狀態與首次造訪的說明都補齊了，藍綠也改成同時有數字與顏色。剩下的問題集中在桌面媒體表太寬、文章頁兩欄高度失衡，以及少數重複的頁面狀態。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | home_desktop／home_mobile：字雲下方新增一段說明「四周是今天正在升溫的關鍵字。新文易數收集台灣與部分國際新聞媒體的公開報導……」，接著是「看今天的事件 →」「資料怎麼來」，第一次來的人知道這是什麼網站。event_desktop 第 1 名卡片拿掉了空框，標題直接接在排名後面，主次更乾淨。 |
| 字體排印 | 7.5 | event_desktop 事件標題放大到約 26px，粗體，兩行收尾。article_mobile 標題改成「AI 教父婚外情連環爆／黃仁勳辭輝達 CEO」，在詞的邊界斷行。延伸閱讀側欄的媒體名與時間約 11px，仍然偏小。 |
| 色彩 | 8 | 系統和 A 相同，但藍綠條下方都補上「綠 14%・藍 10%」等彩色數字（home_mobile 事件卡、search_desktop 的事件卡），語意更清楚，也沒有過度上色。主要操作鈕（「重新載入」「看今天的事件」）一律用品牌橘，次要鈕用描邊，層級一致。 |
| 間距與版面 | 7 | 內容寬度加大到約 1250px（各頁 desktop），1440 寬的螢幕用得更足。article_desktop 改成雙欄，但正文在約 1040px 就結束，左欄下方空了近 700px，右欄還一路延伸到 1680px，兩欄失衡。media_desktop 表格超出容器，需要橫向捲動。 |
| 一致性 | 8 | 期間統一寫成「24 小時／3 天／7 天／近一個月」，橘底表示選取中（search、tag、search-none）。空狀態、錯誤、未登入都用同一套「標題＋說明＋主按鈕＋次按鈕」卡片（event-empty、eve-error、my-saved-empty、my-saved-out、search-none）。 |
| 資訊密度 | 7.5 | media_desktop 的篩選加上「媒體傾向／報導範圍／收錄狀態／媒體標籤」列標題，並把罕用標籤收進「其他 20 個標籤 ▾」，比 A 好掃。但表格多出「語言」「標籤率」欄，導致在 1440 寬也要橫向捲動。event_mobile 卡片裡少了第三則標題，密度剛好。 |
| 導覽 | 7.5 | my-saved_mobile／my-following_mobile：五個分頁籤收在一行，不再換行。空狀態都附導向按鈕。event_mobile 的日期列兩端仍被裁切（左邊「/09」）。手機沒有底部導覽，主要頁面都要經過漢堡選單。 |
| 狀態與回饋 | 8.5 | eve-error_desktop：「暫時無法取得資料／事件頁暫時無法載入」，有「重新載入」「看事件表」兩個按鈕，還附錯誤編號 2231233683。event-empty：「今天還沒有整理出事件」，解釋事件怎麼算出來，並給「看前一天（11/12）的事件」。search-none：列出搜尋規則（只搜標題、摘要與標籤）和三個去處。event-loading 的骨架和實際的卡片版面一致。 |
| 響應式 | 7.5 | search-none_mobile 的三個按鈕會折行，但仍可點。my-* 系列頁面的分頁籤不再換行。event_mobile 的原文網址仍會折成兩行（「…/10」換行接「70703」）。桌面的 media 表格反而需要橫向捲動，手機上則由卡片處理。 |
| 文案 | 8 | 「近一個月沒有符合「zzqxv」的報導」「搜尋比對標題、摘要與標籤，不搜內文；試試較短或較常見的說法，例如人名只打姓名」，具體又自然。my-following 的事件改為顯示「黃仁勳、NVIDIA、輝達」，後面才附小字「事件 #4128」。「全文約 893 字（含標點）」把計算方式也交代了。 |
| 無障礙 | 7 | 藍綠條處處附百分比文字，不只靠顏色。按鈕在手機上約 44px 高。灰色輔助字（「表格比畫面寬，右邊還有欄位」、延伸閱讀的時間）偏淡、偏小。截圖看不到焦點樣式。 |
| 信任與清楚 | 8 | 錯誤頁提供編號與回報管道。tag_desktop 寫明「191 篇內文高度相似，分成 66 組（已比對 94% 的報導）」，比 A 的「相似 191 篇・66 群（已比對 1238／1311 篇）」好懂。仍有 similarity-daily 和 similarity-reposts 兩張截圖完全相同的問題。 |

要保留的優點：
- 首頁字雲下方的一段網站說明，加上「看今天的事件 →／資料怎麼來」（home_desktop、home_mobile）。
- 統一的空狀態、錯誤、未登入卡片，有標題、原因、主次按鈕（event-empty、eve-error、search-none、my-saved-empty、my-saved-out）。
- 事件卡的藍綠條加上「綠 x%・藍 y%」文字（home、event、search）。
- 媒體篩選分組，並為每列加上列標題，長尾標籤收合（media_desktop）。
- 時間範圍的用語統一為「24 小時／近一個月」（search、tag）。
- 文章頁的延伸閱讀移到右側欄，正文欄寬適中（article_desktop）。

最重要的五個問題（由嚴重到輕微）：
1. [間距與版面] [media] [desktop] 1440 寬下媒體總表仍超出容器，要靠「表格比畫面寬，右邊還有欄位／看更多欄 →」橫向捲動，「標籤率」欄被切掉 —— 大螢幕使用者最常在這頁比對資料，橫捲很不順 —— 把「語言」「標籤率」等次要欄位收進可切換的欄位組，或在寬螢幕減少欄寬。
2. [間距與版面] [article] [desktop] 正文在約 1040px 就結束，左欄下方空了約 700px，右欄延伸閱讀卻延伸到 1680px —— 視覺重心失衡，頁面看起來沒做完 —— 側欄改為 sticky，或把「其他媒體相關報導」移到正文下方的全寬區塊。
3. [信任與清楚] [similarity-reposts] [兩者] 「轉載統計」的截圖和「每日相似統計」完全相同 —— 讀者可能切換了卻看不到轉載資料，或不知道自己在哪個分頁 —— 確認分頁狀態會反映在網址與畫面上，並在標題寫明目前檢視的統計。
4. [響應式] [event] [mobile] 日期列兩端被裁切（左邊只剩「/09」），卡片內原文網址被拆成兩行（另見 eve_mobile） —— 看起來像溢出 —— 日期列加漸層遮罩或捲到置中，網址改成單行省略。
5. [無障礙／字體排印] [article、search] [desktop] 側欄與列表的媒體名、時間、「共同關鍵字」約 11px 淺灰字 —— 長時間比對時很吃力，對比可能不足 —— 輔助字提高到 12–13px，並加深灰階。

## 組 C
總分：7.5 / 10
一句話總評：參考組裡 Ground News 的偏向條與 Blindspot 概念成熟，Google 新聞乾淨好掃，Verity 編排有個性；但付費牆、手機遮擋與溢出問題都明顯，三者都不是完美的標竿。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | ground-news-home_desktop：頂部標語「See every side of every news story」，頭條大圖上疊 Left 29%／Center 27%／Right 44% 條，主次非常明確。google-news-tw_desktop：「焦點提要」加上日期，新聞依群組排列。verity-home_desktop：主欄大圖卡加上「Go Deeper」側欄。 |
| 字體排印 | 8 | Ground News 的標題字重與字級層級分明。Verity 的導語用襯線體，和無襯線標題形成對比。Google 新聞的繁中字級與行高適中，但 Yahoo 等媒體名約 10px，偏小。 |
| 色彩 | 8 | Ground News 用暗紅、白、深藍代表左中右，沙色橫幅作為品牌色，系統一致。Google 新聞的藍色過於預設、沒有個性。Verity 用黃色選取中圖示，風格鮮明。 |
| 間距與版面 | 7.5 | ground-news-home_desktop 的三欄格線整齊。ground-news-story_desktop 卻在「Top NVIDIA News」下方空出約 500px 白。verity-home_desktop 的分類列在右側被切成「Social iss」。 |
| 一致性 | 7.5 | Ground News 主頁與話題頁共用標籤列與偏向條。不過三個產品各自為政，無法互比。 |
| 資訊密度 | 8 | Ground News 每則都有「46% Right coverage: 11 sources」，一列就說完要點。Google 新聞一屏約 10 則。Verity 每屏只放一張大圖卡，密度偏低。 |
| 導覽 | 8 | ground-news 與 verity 的手機版都有底部分頁籤（News／For You／Search／Blindspot／Local；Home／Bias Split／Sources／Controversies），切換效率高。Google 新聞的頂部分頁籤清楚標出所在位置。 |
| 狀態與回饋 | 6.5 | ground-news-story_desktop／mobile：Factuality、Ownership 只顯示鎖頭與「Upgrade」，對資訊的回饋偏向推銷。Google 新聞有「登入即可取得符合個人興趣的報導」的引導。截圖未涵蓋錯誤與空狀態。 |
| 響應式 | 6.5 | google-news-tw_mobile：右側內容被切掉（「瀏覽更多頭」、標題的最後幾個字被截斷），疑似橫向溢出。verity-home_mobile：浮動的「回到頂端」鈕蓋住標題「Ban on Trans Ath↑s」，底部導覽也壓在圖片上。Ground News 手機版重排合理。 |
| 文案 | 7.5 | Ground News 的文案直白，例如「Stories disproportionately covered by one side」。但話題頁寫「We rank NVIDIA as Unknown factuality... look no further」，語氣矛盾。Google 新聞的繁中自然。 |
| 無障礙 | 6.5 | Ground News 的偏向條附數字百分比，但很多條只有色塊，例如 Coverage: 5 sources 那幾則。Verity 的「UNLIKELY／LIKELY」漸層條只靠顏色。手機底部分頁籤的觸控範圍足夠。 |
| 信任與清楚 | 7.5 | Ground News 有「our methodology here」「Learn more about political bias」，但評級鎖在付費牆後。Google 新聞每則都標來源與幾小時前。Verity 的來源只用小圓頭像加「+9」，看不出是哪些媒體。 |

要保留的優點：
- Ground News 頭條圖上直接疊 Left／Center／Right 百分比條，傾向一眼可見（ground-news-home_desktop）。
- Blindspot 側欄，專門呈現「只被一邊報導」的新聞（ground-news-home_desktop）。
- 手機底部分頁籤導覽（ground-news-home_mobile、verity-home_mobile）。
- Google 新聞以群組卡呈現同一事件的多家報導，並有「瀏覽更多頭條新聞和觀點」入口（google-news-tw_desktop）。
- 頂部的熱門話題標籤列可一鍵追蹤（ground-news-home_desktop 的「Jensen Huang +」）。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [google-news-tw] [mobile] 內容區右側被切掉，按鈕文字與標題結尾都被截斷 —— 手機讀者看不全標題 —— 修正容器寬度與內距，確保沒有橫向溢出。
2. [響應式] [verity-home] [mobile] 浮動的回到頂端鈕和底部導覽蓋住標題與圖片（「Ath↑s」） —— 遮擋主要內容 —— 浮動鈕避開文字區，捲動時收起底部導覽。
3. [信任與清楚] [ground-news-story] [兩者] Factuality、Ownership 只顯示鎖頭與「Upgrade」 —— 識讀資訊被付費牆擋住，讀者無從判斷 —— 至少公開評級摘要，詳細資料再收費。
4. [間距與版面] [ground-news-story] [desktop] 「Top NVIDIA News」只有三則，下方留下約 500px 空白 —— 頁面像沒載完 —— 補上更多報導或縮短版面。
5. [無障礙] [ground-news-home、verity-home] [兩者] 部分偏向條與可能性條只有色塊沒有數字 —— 色覺障礙者無法分辨 —— 每條都附上文字百分比或標籤。

```json
{"A": {"overall": 7, "scores": {"資訊層級": 7, "字體排印": 7, "色彩": 7.5, "間距與版面": 6.5, "一致性": 7, "資訊密度": 7.5, "導覽": 7, "狀態與回饋": 5, "響應式": 6.5, "文案": 7, "無障礙": 6.5, "信任與清楚": 7.5}, "issues": ["[狀態與回饋] eve-error 兩者：載入失敗卻顯示 404「找不到這個頁面」且無重試", "[間距與版面] event／home 兩者：事件卡內殘留空白灰色佔位框", "[狀態與回饋] event-empty、search-none、my-saved-empty 兩者：空狀態只有一行字、無下一步，event-empty 日期列空框且藍綠比 50：50", "[響應式] my-saved／my-following mobile：分頁籤換行，「設定」掉到第二行；event 日期列兩端裁切", "[版面／文案] article desktop：單欄約 590px 浪費寬螢幕，「本文共827字」與「全文約 893 字」矛盾"]}, "B": {"overall": 8, "scores": {"資訊層級": 8, "字體排印": 7.5, "色彩": 8, "間距與版面": 7, "一致性": 8, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 8.5, "響應式": 7.5, "文案": 8, "無障礙": 7, "信任與清楚": 8}, "issues": ["[間距與版面] media desktop：1440 寬下表格仍需橫向捲動，「標籤率」欄被切掉", "[間距與版面] article desktop：正文欄提早結束，左欄留約 700px 空白，右欄延伸閱讀過長", "[信任與清楚] similarity-reposts 兩者：轉載統計與每日相似截圖完全相同", "[響應式] event mobile：日期列兩端裁切、原文網址拆成兩行", "[無障礙] article／search desktop：側欄與列表的輔助字約 11px 淺灰，對比不足"]}, "C": {"overall": 7.5, "scores": {"資訊層級": 8, "字體排印": 8, "色彩": 8, "間距與版面": 7.5, "一致性": 7.5, "資訊密度": 8, "導覽": 8, "狀態與回饋": 6.5, "響應式": 6.5, "文案": 7.5, "無障礙": 6.5, "信任與清楚": 7.5}, "issues": ["[響應式] google-news-tw mobile：內容右側被截斷、疑似橫向溢出", "[響應式] verity-home mobile：浮動鈕與底部導覽遮住標題", "[信任與清楚] ground-news-story 兩者：Factuality／Ownership 鎖在付費牆後", "[間距與版面] ground-news-story desktop：主欄只有三則，下方約 500px 空白", "[無障礙] ground-news-home／verity-home：部分偏向條與可能性條只有顏色、無數字"]}}
```
