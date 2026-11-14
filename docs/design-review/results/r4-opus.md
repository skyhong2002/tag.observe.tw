<!--
round: r4
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM
mapping (hidden from the reviewer): A = baseline (ffd6a5aa), B = new (web dc4d03ab), C = reference
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
Maintainer notes: "similarity-daily = similarity-reposts" is the inventory, not the product: /similarity/daily/ has
permanently redirected to /similarity/reposts/ since 2026-10-11 (states.md is kept as written for the whole run).
The "主欄約 780 px" measurements are read off downscaled images; the content column is 1120 px at 1440 (max-w-6xl).
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：6.5 / 10
一句話總評：資料豐富，比較功能也很完整，但空資料、錯誤、未登入和手機寬表格的處理明顯落後，而且有一處錯誤狀態是錯的。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 6.5 | home_desktop：標籤雲下方直接接「熱門關鍵字／焦點事件／藍綠溫差」，沒有一句話說明網站在做什麼。home_mobile：焦點卡片的媒體名下面多了一塊空的灰色縮圖框（約 y≈1000，原圖 ×1.69），把標題和陣營條隔開。event_desktop：第 1 名卡片的排名列和標題之間，也有一塊空白灰框。 |
| 字體排印 | 6.5 | 長標題斷行還算自然。不過 eve_mobile 的標題在「下一步／去哪？」斷開。media_desktop、journalist_desktop 的表格內文約 11–12 px，數字與百分比混在同一格，很難掃讀。tag_desktop 第 4 則摘要直接露出「&#10;」實體字元。 |
| 色彩 | 7 | 橘紅品牌色和綠、藍陣營色都有固定用法。home-dark_desktop、media-outlet-dark_desktop 的深色外觀有層次，標籤雲改成橘色，不是單純反灰。event-hour_mobile 的「看 2026-11-13 整天的事件」卻用藍色連結，和全站橘色連結不一致，也容易被誤認為藍營。 |
| 間距與版面 | 6 | media_desktop、topic-story_desktop、journalist_desktop、similarity-daily_desktop、tag_desktop 的主欄只有約 780 px 寬，1440 寬螢幕右側約 40% 空白。article_desktop 正文欄約 490 px，右半邊完全空白。 |
| 一致性 | 6 | 錯誤頁的主按鈕在 ranking-error_desktop 是黑底「重新載入」，在 eve-error 卻變成 404 頁的黑色「搜尋」按鈕。ranking-blue_desktop 的「藍營傾向媒體」放在篩選列最後一行，「所有媒體」在第一行，同一組分類被拆成兩處。my-saved-out_desktop 是純文字清單，my-saved-empty_desktop 是一行灰字，兩個「我的」頁面的空狀態樣式不同。 |
| 資訊密度 | 7 | event_desktop 每張卡片都有陣營條、媒體圖示、兩則對照標題和三則延伸報導，比對效率高。ranking_desktop 的標籤雲有數百個字，字級小到無法閱讀（約 y 250–540），擠掉表格的位置。 |
| 導覽 | 7 | 桌面頁首導覽完整，目前頁面有底色標示。event_desktop 有日期列和「其他日期」。my-saved_mobile 的分頁「設定」被擠到第二行，看起來像另一組控制項。 |
| 狀態與回饋 | 5 | eve-error_desktop/mobile：事件載入失敗卻顯示「404 找不到這個頁面」，錯誤類型是錯的。event-empty_desktop 仍顯示空的日期框（只有 ‹ ›）和「今天沒有事件資料。」，沒有下一步。search-none_desktop 只有「過去 31 天沒有符合『zzqxv』的文章。」。my-saved-empty_desktop 只有一行字。ranking-error 只給「錯誤代碼 3772224109」，沒說這組號碼要拿來做什麼。 |
| 響應式 | 6 | ranking_mobile：寬表格被截斷，「變動」欄只剩半個標頭，右側箭頭被切掉，看不出還能橫滑。journalist_mobile：表格標頭右上角的「篇」字被切掉。event-loading_mobile 的骨架是列表樣式，和實際的大卡片版面不符。 |
| 文案 | 6 | 「今天到目前為止的 0 件事」很生硬。event-hour 的「上榜 162 小時」需要心算。article_desktop 同頁出現「全文約 893 字」和「本文共827字」，數字不一致。「錯誤代碼」直接露出系統編號。 |
| 無障礙 | 6 | 陣營有「偏藍／偏綠」文字標籤，不只靠顏色。不過 home_mobile 的陣營條只有色塊，沒有百分比文字。media_desktop 表格內的灰字很淡、很小。篩選膠囊與小按鈕在桌面高度約 24 px。 |
| 信任與清楚 | 7.5 | 幾乎每頁都有「本頁的資料來源與計算方式」，每則新聞都印出原站網址。media-outlet_desktop 的 Similarweb 流量註明月份與「整個網域的估算值」。home 沒有交代陣營怎麼判定，只有圖例。 |

要保留的優點：
- event_desktop 的事件卡：陣營三段條、媒體圖示列、藍綠標題並排，再加原站網址，是全站最有辨識度的核心元件。
- 每頁固定的「本頁的資料來源與計算方式」摺疊區，以及每則新聞直接印出原始 URL。
- eve_desktop 的「時間變化」雙層圖和「關鍵字變化」甘特圖，把事件演進講得很清楚。
- journalist-person_desktop 的內文差異比對（紅刪綠增）很直觀。
- 深色外觀（home-dark、media-outlet-dark）保留了品牌橘，不是灰階。

最重要的五個問題（由嚴重到輕微）：
1. [狀態與回饋] [eve-error] [兩者] 事件頁載入失敗時顯示「404 找不到這個頁面」——使用者會以為事件被刪除或網址錯了，而不是暫時失敗，也沒有重試按鈕——應改為「暫時無法載入」，提供重新載入與返回事件表。
2. [響應式] [ranking] [mobile] 關鍵字表格在 390 寬被截斷，「變動」欄只剩一半，又沒有可以橫滑的提示（另見 journalist_mobile 標頭被切）——手機是主要使用情境，排行頁是核心頁——手機改用單欄卡片列，名次、關鍵字、分數、變動放同一張卡片。
3. [狀態與回饋] [event-empty / search-none / my-saved-empty / my-saved-out] [兩者] 空狀態只有一行灰字，沒有原因也沒有下一步；event-empty 還留著空的日期框——使用者會停在死路——每個空狀態都寫出原因，並給一到兩個行動按鈕（看前一天、看熱門關鍵字、登入）。
4. [資訊層級] [home、event] [兩者] 焦點與事件卡片在媒體名下面插了一塊空白灰框（像沒載入的走勢圖），把標題往下推，看起來像壞掉——第一屏最重要的位置出現破損感——沒有資料就不要顯示，或改放在標題之後。
5. [間距與版面] [media、topic-story、tag、journalist、similarity-daily、article] [desktop] 主欄固定約 780 px，1440 寬螢幕右側大片空白，寬表格反而要橫向捲動——大螢幕長時間比對的使用者吃虧——資料表頁面放寬到 1120–1200 px，或把側欄資訊移到右側。

## 組 B
總分：7.5 / 10
一句話總評：和 A 是同一套系統，但補上了首頁說明、錯誤與空狀態的下一步、手機卡片化的表格，完成度明顯較高；剩下的主要是大螢幕留白和少數狀態沒有區隔。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7.5 | home_desktop/mobile：標籤雲下方加了一句「四周是今天正在升溫的關鍵字。新文易數收集台灣與部分國際新聞媒體的公開報導，把同一件事放在一起，比較各家標題、藍綠分布與誰先報。」，並附「看今天的事件 →／資料怎麼來」。event_mobile：第 1 名卡片的排名列之後直接接標題，沒有空白灰框。 |
| 字體排印 | 7 | eve_mobile 的標題改成「黃仁勳閃辭輝達！／下一步去哪？」，在標點處斷行。tag_desktop 的摘要沒有「&#10;」。media_desktop、journalist_desktop 的表格仍是約 11–12 px 小字。 |
| 色彩 | 7.5 | event-hour_mobile 的「看 2026-11-13 整天的事件」改為橘色，連結色統一。ranking-error 的主按鈕從黑色改為品牌橘，和其他頁一致。home_mobile、home-dark_mobile 的陣營條下方有「綠 33%・藍 27%」文字。深色外觀和 A 一樣成立。 |
| 間距與版面 | 6.5 | 留白問題和 A 相同：media_desktop、topic-story_desktop、similarity-daily_desktop、journalist-person_desktop 主欄約 780 px，media_desktop 表格上方還提示「表格比畫面寬，右邊還有欄位 看更多欄」，右側卻空著約 550 px。article_desktop 正文欄偏窄。 |
| 一致性 | 7.5 | 錯誤頁（eve-error、ranking-error）都是「眉標＋標題＋說明＋橘色重新載入＋次要按鈕＋分隔線下的回報說明」。空狀態（event-empty、search-none、my-saved-empty、my-saved-out）都是框線卡片加主次按鈕。ranking-blue_desktop 的「藍營傾向媒體」排在「所有媒體」旁邊。 |
| 資訊密度 | 7.5 | ranking_desktop 的標籤雲改成少量大字，可以閱讀，表格提早出現。media_desktop 的篩選分成「媒體傾向／報導範圍／收錄狀態／媒體標籤」四列，次要標籤收進「其他 20 個標籤 ▾」。 |
| 導覽 | 7.5 | my-saved_mobile、my-following_mobile 的分頁「我的動態…設定」排在同一行。topic-story_desktop 的麵包屑最後一層是「黑色購物節」，不是 A 的重複「議題」。event-hour 的前後小時與整天切換清楚。 |
| 狀態與回饋 | 8 | event-empty：「今天還沒有整理出事件」＋原因（剛過午夜或新聞量少）＋「看前一天（11/12）的事件」「看關鍵字排行」。search-none：兩條搜尋建議＋三個按鈕。my-saved-out：「登入後才能使用這一頁」＋「用 Google 帳號登入」。eve-error 正確顯示「事件頁暫時無法載入」。event-loading_mobile 的骨架和實際卡片版面一致。 |
| 響應式 | 7.5 | ranking_mobile 改為卡片列（名次、關鍵字、「分數 30.5・1478 篇・38 家」、走勢、爆發力與變動）。journalist_mobile 改為記者卡片，含首見報導、內文相近、引用三欄。media_mobile 的篩選列可以橫滑，但右緣被切斷，沒有漸層提示。 |
| 文案 | 7.5 | event-hour 用「累計上榜約 7 天」，取代「上榜 162 小時」。錯誤頁寫「一直無法載入的話，歡迎到頁尾的『聯絡與移除請求』告訴我們，附上這串編號能更快找到原因」。期間膠囊改為「24 小時／近一個月」。article 的「全文約 893 字／本文共827字」仍不一致。 |
| 無障礙 | 6.5 | 陣營條加上文字百分比，不只靠顏色。小型膠囊與表格文字仍偏小（media_desktop、journalist_desktop）。深色模式下次要灰字（ranking-dark_desktop 的「首次出現」欄）對比偏低。 |
| 信任與清楚 | 8 | topic-story_desktop 說明「三立新聞網的議題頁列出的報導…哪些新聞放進這一頁由三立新聞網決定，可能包含原站一併列出的其他新聞」。tag_desktop 寫「191 篇內文高度相似，分成 66 組（已比對 94% 的報導）」。首頁說明了收錄範圍。陣營判定依據仍要點進計算方式才看得到。 |

要保留的優點：
- home 標籤雲下方的一句話定位，加上「看今天的事件／資料怎麼來」兩個入口。
- 錯誤、空資料、無搜尋結果、未登入四種狀態，都是同一套「原因＋主次按鈕」的卡片。
- ranking_mobile、journalist_mobile 把寬表格改成手機卡片，數字與變動並排、好掃讀。
- media_desktop 的篩選分成四組並加上標籤，次要標籤收合。
- 陣營條下方一律附「綠 x%・藍 y%」文字（home、event、eve）。
- topic-story 的說明交代議題頁由原媒體決定，降低「本站編排」的誤解。

最重要的五個問題（由嚴重到輕微）：
1. [間距與版面] [media、topic-story、similarity-daily、journalist-person、tag] [desktop] 主欄約 780 px，1440 螢幕右側約 40% 空白，media 表格卻還要提示「右邊還有欄位」——大螢幕比對資料的使用者被迫橫向捲動——資料頁改用 1120–1200 px 容器，或讓表格撐滿可用寬度。
2. [狀態與回饋] [similarity-daily vs similarity-reposts] [兩者] 兩個狀態的截圖完全相同，「每日相似統計」打開後仍停在「轉載統計」分頁——使用者無法直接進到每日相似統計，網址或分頁狀態沒有生效——確認分頁和網址參數連動，選中的分頁要正確反映。
3. [間距與版面] [article] [desktop] 站內擷取正文的欄寬約 490 px，置於左側，右半邊整片空白；「延伸閱讀」也擠在同一窄欄——長文閱讀與延伸比對浪費空間——正文維持適讀寬度並置中，「他站相似報導／其他媒體的相關報導」移到右側欄。
4. [無障礙] [media、journalist、ranking-dark] [desktop] 表格內文與次要數字約 11–12 px，灰字對比偏低，篩選膠囊高度約 24 px——長時間比對容易疲勞，觸控與低視力使用者難以操作——表格字級至少 13–14 px，次要灰字提高對比，可點選元素至少 32 px 高。
5. [文案] [article] [兩者] 同一頁同時出現「全文約 893 字」和「本文共827字」——兩個數字互相矛盾，削弱可信度——統一來源，或註明差異（例如原站顯示字數 vs 本站擷取字數）。

## 組 C
總分：7.5 / 10
一句話總評：國際成熟產品的版面紀律與偏向視覺化（Ground News）可以當標竿，但核心判斷資訊被付費或登入擋住，各站對狀態與信任的交代也不平均。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | ground-news-home_desktop：「Daily Briefing」、頭條大圖與「Blindspot」三欄分工明確，每則都有 Left/Center/Right 比例條。verity-home_desktop：左側 HOME／BIAS SPLIT／SOURCES／CONTROVERSIES 圖示列，主欄是大圖卡片。google-news-tw_desktop：「焦點提要」直接把同一事件的多家標題聚成一組。 |
| 字體排印 | 7.5 | Verity 用襯線大標，摘要層級清楚。Ground News 的標題字重夠，但比例條下方的「45% Center coverage: 315 sources」等小字很細。Google 新聞的中文標題常三行截斷。 |
| 色彩 | 7.5 | Ground News 用紅、白、藍三段表示左中右，並配文字百分比，系統一致。Google 新聞是預設的白底藍連結，品牌個性弱。Verity 黑白為主，色彩只用在少數標籤。 |
| 間距與版面 | 7.5 | ground-news-home_desktop 有多欄格線、對齊整齊，善用 1440 寬。ground-news-story_desktop 右側「Similar News Topics」欄與主欄比例合理。verity-home_desktop 右欄只有約 300 px，主欄卻窄，中間有空隙。 |
| 一致性 | 8 | 三站各自內部的卡片、圖示、比例條都很統一。Ground News 首頁與主題頁共用同一套比例條和來源圓形圖示。 |
| 資訊密度 | 7.5 | Ground News 首頁一屏約 10 則故事，每則附來源數。Google 新聞每組 3–4 則標題加縮圖，密度高、好掃讀。Verity 大圖卡片一屏只有 2–3 則，密度偏低。 |
| 導覽 | 7.5 | Ground News 頂部是主題膠囊列（Jensen Huang、Nvidia、Artificial Intelligence…）加「Home / For You / Local / Blindspot」。Google 新聞有分類分頁列（台灣、國際、商業…）。Verity 左側圖示列沒有文字說明，第一次使用需要猜。 |
| 狀態與回饋 | 6 | 截圖沒有錯誤或載入狀態。ground-news-story_desktop 的「Factuality」「Ownership」都是鎖住的「Upgrade」區塊。google-news-tw_desktop「為你精選」只有「登入」按鈕。核心資訊被付費或登入擋住，回饋偏向轉換。 |
| 響應式 | 7.5 | 三站的手機版都改成單欄，ground-news-home_mobile 保留比例條，google-news-tw_mobile 保留分組。截圖中沒有看到橫向溢出。 |
| 文案 | 7 | Ground News 的「We've assigned a media bias rating of unknown to NVIDIA… factuality of Unknown」是在對公司套用媒體評等，語意彆扭。Google 新聞的中文介面自然。Verity 用「LIKELY / UNLIKELY」預測標籤，沒有交代依據。 |
| 無障礙 | 6.5 | Ground News 比例條小字約 9–10 px、灰色偏淡。Verity 左側圖示列只有圖示加極小字。Ground News 的陣營有文字百分比，不只靠顏色。 |
| 信任與清楚 | 7.5 | ground-news-story_desktop 有「our methodology here」「Media Bias Ratings」說明連結，每則標示 sources 數。但 Factuality 與 Ownership 的依據要付費才看得到。Google 新聞每則都有來源與時間。Verity 的預測沒有資料來源。 |

要保留的優點：
- Ground News 每則故事旁固定附左／中／右比例條與來源數（ground-news-home_desktop）。
- Ground News 的「Blindspot」欄，專門列出只被單一陣營報導的故事，是值得參考的比較視角。
- Google 新聞「焦點提要」把同一事件的多家標題收成一組，密度高又好掃讀。
- Verity 的襯線大標與清楚的分類眉標（COMPUTERS & INTERNET、SCIENCE & TECHNOLOGY）。
- Ground News 主題頁右欄的「Similar News Topics／Sources Covering Similar Topics」延伸導覽。

最重要的五個問題（由嚴重到輕微）：
1. [信任與清楚] [ground-news-story] [desktop] Factuality 與 Ownership 判斷被「Upgrade」鎖住——偏向評等的依據不透明，削弱整體可信度——至少公開判斷方法摘要，付費只解鎖細節。
2. [狀態與回饋] [google-news-tw] [desktop] 「為你精選」整塊只有登入提示，沒有任何預設內容——未登入使用者看到一塊無用空間——未登入時先提供熱門或在地內容，再引導登入。
3. [導覽] [verity-home] [兩者] 左側功能列只有圖示和極小字（BIAS SPLIT、CONTROVERSIES），意義不明——核心比較功能藏在難以理解的入口後面——改為文字分頁，或加上清楚的標籤。
4. [無障礙] [ground-news-home] [desktop] 比例條下方的「xx% Center coverage: nn sources」約 9–10 px 淺灰——關鍵判斷資訊幾乎讀不到——提高字級與對比。
5. [文案] [ground-news-story] [desktop] 對公司主題頁套用「media bias rating of unknown」「factuality of Unknown」——把媒體評等用在非媒體實體，令人困惑——依主題類型切換說明文字。

```json
{"A": {"overall": 6.5, "scores": {"資訊層級": 6.5, "字體排印": 6.5, "色彩": 7, "間距與版面": 6, "一致性": 6, "資訊密度": 7, "導覽": 7, "狀態與回饋": 5, "響應式": 6, "文案": 6, "無障礙": 6, "信任與清楚": 7.5}, "issues": ["[狀態與回饋] eve-error 兩者：事件載入失敗卻顯示 404 找不到這個頁面，沒有重試", "[響應式] ranking mobile：關鍵字表格被截斷，變動欄只剩一半且無橫滑提示（另見 journalist_mobile）", "[狀態與回饋] event-empty/search-none/my-saved-empty/my-saved-out 兩者：空狀態只有一行灰字、沒有下一步，event-empty 留著空日期框", "[資訊層級] home、event 兩者：卡片媒體名下方出現空白灰框，把標題往下推、看起來像壞掉", "[間距與版面] media/topic-story/tag/journalist/similarity/article desktop：主欄約 780 px，1440 寬右側大片空白"]}, "B": {"overall": 7.5, "scores": {"資訊層級": 7.5, "字體排印": 7, "色彩": 7.5, "間距與版面": 6.5, "一致性": 7.5, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 8, "響應式": 7.5, "文案": 7.5, "無障礙": 6.5, "信任與清楚": 8}, "issues": ["[間距與版面] media/topic-story/similarity-daily/journalist-person/tag desktop：主欄約 780 px、右側約 40% 空白，表格卻要提示右邊還有欄位", "[狀態與回饋] similarity-daily 與 similarity-reposts 兩者：截圖完全相同，每日相似統計仍停在轉載統計分頁", "[間距與版面] article desktop：正文欄約 490 px 靠左，右半邊空白，延伸閱讀也擠在窄欄", "[無障礙] media/journalist/ranking-dark desktop：表格約 11–12 px 小字、灰字對比低、膠囊約 24 px 高", "[文案] article 兩者：同頁出現「全文約 893 字」與「本文共827字」，數字矛盾"]}, "C": {"overall": 7.5, "scores": {"資訊層級": 8, "字體排印": 7.5, "色彩": 7.5, "間距與版面": 7.5, "一致性": 8, "資訊密度": 7.5, "導覽": 7.5, "狀態與回饋": 6, "響應式": 7.5, "文案": 7, "無障礙": 6.5, "信任與清楚": 7.5}, "issues": ["[信任與清楚] ground-news-story desktop：Factuality 與 Ownership 判斷被 Upgrade 鎖住，依據不透明", "[狀態與回饋] google-news-tw desktop：為你精選未登入時只有登入按鈕，沒有預設內容", "[導覽] verity-home 兩者：左側功能列只有圖示與極小字，核心入口意義不明", "[無障礙] ground-news-home desktop：比例條下方說明約 9–10 px 淺灰，難以閱讀", "[文案] ground-news-story desktop：對公司主題套用 media bias rating/factuality of Unknown，語意混淆"]}}
```
