<!--
round: r0 (calibration: the "new" set is a byte-identical copy of the baseline)
reviewer: claude-proxy · claude-opus-5-5 · effort high · fresh delegate_task
host: skyhong-SM · captured 2026-11-13 (UTC+8)
mapping (hidden from the reviewer): A = reference, B = baseline (ffd6a5aa), C = new (= baseline copy)
brief.md sha256: 0564dc41a4fd4b534580e90a5837941081f75dce9d526c13a9aabc87291077f6
The text below is the reviewer's final message, unedited.
-->

## 組 A
總分：7 / 10
一句話總評：這組參考網站（Ground News 首頁與來源頁、Google 新聞台灣版、Verity）各自完成度高，Ground News 把「立場分布條」做成一眼可讀的主視覺；但 Google 新聞手機版明顯壞版，Ground News 把關鍵的信任資訊鎖在付費牆後，三站也都沒有提供空資料或錯誤狀態可評。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 8 | ground-news-home desktop：頂部標語 "See every side of every news story"，主圖標題直接疊上 Left 29% / Center 27% / Right 44% 立場條，每則新聞都附 "42% Center coverage: 515 sources"，最重要的資訊最先被看到。google-news-tw desktop：「焦點提要 11月13日星期五」之下，一則主新聞配三則他台報導，主次清楚。verity-home desktop：每張卡片是圖片、分類、標題、提問式導言，最後才是來源頭像，順序一致。 |
| 字體排印 | 7.5 | ground-news-home desktop/mobile 全站用同一套無襯線字，標題字重與行高穩定。verity-home mobile 的襯線導言字距過鬆，"cloud ser vers" 看起來像斷字。google-news-tw desktop 的來源與「1 小時前」約 11px，偏小。 |
| 色彩 | 7.5 | ground-news 整站是米色底，紅、白、藍三色只用在立場條，有系統也不搶戲。verity 以黃色標示目前位置（左側欄 HOME），Controversies 用綠到紅的漸層。google-news-tw 是預設 Material 配色，沒有個性。三站都沒有深色截圖，只看得到 ground-news 頁首有 Light/Dark/Auto 切換。 |
| 間距與版面 | 7 | ground-news-home desktop 三欄格線整齊。ground-news-story desktop 左欄在 y≈1240 就結束，右側欄一路延伸到 y≈1820，留下大片空白。verity-home desktop 內容只用到 1440 寬中約 830px，左邊大片留白。google-news-tw desktop 內容置中約 1040px，算合理。 |
| 一致性 | 7.5 | ground-news 首頁與來源頁共用頁首、話題膠囊（帶 +）、立場條與按鈕樣式。verity 卡片格式從頭到尾相同。google-news-tw 的「顯示更多」「瀏覽更多頭條新聞和觀點」兩種按鈕樣式不同。 |
| 資訊密度 | 7 | ground-news-home desktop 一屏約可看到 12 則，而且每則都有來源數。google-news-tw desktop 一屏約 10 則。verity-home desktop 每則都配大圖，一屏只有約 2 則，密度偏低。 |
| 導覽 | 8 | ground-news-home mobile 和 verity-home mobile 都有固定底部分頁列（News/For You/Search/Blindspot/Local；Home/Bias Split/Sources/Controversies），手機上很有效率。ground-news 頂部有可橫滑的趨勢話題列。google-news-tw mobile 的分頁列在「台」字被裁掉，頁首看不到搜尋。 |
| 狀態與回饋 | 6 | 三站都只提供有資料的截圖，看不到空資料或錯誤狀態。ground-news-home desktop 的 "My News Bias" 用 "?" 佔位條加 "See the demo" 說明，算有引導。ground-news-story mobile 的 Factuality/Ownership 只顯示鎖頭與兩個 Upgrade 按鈕，沒有任何預覽。 |
| 響應式 | 5.5 | google-news-tw mobile 等於直接套用桌面版：左側留約 160px，內容溢出右緣，標題被切成「張仁瑋開轟、王念好追平…」，「瀏覽更多頭」也被切斷，壞得很明顯。verity-home mobile 的回到頂部浮鈕壓在標題 "Ban on Trans Ath↑s" 上（約 y≈1850）。ground-news mobile 改用底部分頁列並放大字級，處理得好。 |
| 文案 | 7 | ground-news-story mobile 有重複的樣板句 "If you want to know if NVIDIA is credible… look no further. We rank NVIDIA as Unknown factuality"，評等是 unknown 卻說「不用再找了」，語意矛盾。verity 導言一律寫成提問（"Is this proof of…"），帶有引導性。google-news-tw 用語自然，「1 小時前」的相對時間也好懂。 |
| 無障礙 | 6.5 | ground-news-home 列表的小立場條約 60×6px，只標了主導那一方的百分比；"Coverage: 5 sources" 那則完全沒有文字，只能靠紅藍色辨識。verity 來源頭像約 24px 而且互相重疊，難以辨識和點選。各站淺色字都不夠清楚，例如 google-news-tw 的灰色時間文字。 |
| 信任與清楚 | 6.5 | ground-news 處處連到 "our methodology"、"Learn more about Media Bias Ratings"，也標出來源數。但在 ground-news-story desktop/mobile，可信度與所有權被付費牆擋住，NVIDIA 的評等寫著 unknown。verity 的 Controversies 有 UNLIKELY–LIKELY 漸層條，卻沒說明依據。google-news-tw 只列媒體名，不說明收錄範圍或排序方式。 |

要保留的優點：
- ground-news-home：主圖疊上有文字標籤的 Left/Center/Right 百分比條，是「同一件事各家怎麼說」最直接的視覺語言。
- ground-news-home 與 verity-home 的手機底部分頁列：主要功能一次點到，目前位置也清楚。
- ground-news-home 每則新聞都附「主導立場 % ＋來源數」，掃讀很有效率。
- google-news-tw「焦點新聞」叢集卡：一則主新聞配三則他台報導，同事件比較的結構清楚。
- ground-news-story：來源頁有 Similar Topics、Sources Covering Similar Topics、Suggest a source 這類延伸與回饋入口。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [google-news-tw] [mobile] 手機版直接套用桌面版：左邊空約 160px，內容溢出右緣，標題與按鈕被切掉，分頁列也被裁。—— 手機讀者幾乎無法正常閱讀。—— 改成流動版面，移除固定左邊距，分頁改為可橫滑。
2. [信任與清楚] [ground-news-story] [兩者] 可信度與所有權只顯示鎖頭和 Upgrade，評等是 "unknown"。—— 媒體識讀網站最核心的判斷依據被付費牆擋住，信任感大幅下降。—— 至少開放摘要或分級說明，付費只鎖進階細節。
3. [響應式] [verity-home] [mobile] 回到頂部浮鈕壓在第二則標題文字上（約 y≈1850）。—— 擋住標題，也容易誤觸。—— 浮鈕改放右下角的安全區，並避開內容。
4. [無障礙] [ground-news-home] [desktop] 列表的小立場條只有約 6px 高，沒有百分比或只標一方，例如 "Coverage: 5 sources" 那則；整體只靠紅藍色區分。—— 色覺辨識困難的讀者無法判讀。—— 每段加上 L/C/R 文字或紋理，並把條加高。
5. [間距與版面] [ground-news-story／verity-home] [desktop] 來源頁左欄在 y≈1240 後一大片空白；Verity 在 1440 寬只用約 830px。—— 大螢幕空間浪費，看起來像沒載完。—— 用延伸內容填滿左欄，或讓版心隨視窗放寬。

## 組 B
總分：6.5 / 10
一句話總評：資料量與透明度遠超同類網站，橘色品牌、深色外觀與「資料來源與計算方式」貫穿全站；但手機版寬表格被裁切、中文標題在詞中斷行、各頁期間選項與按鈕樣式不一致，空資料與載入中等狀態的處理也不夠成熟。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7 | home desktop 的文字雲主視覺搭配「同一件事，各家怎麼說」與「11/13(五) 02:34 更新」，下方三欄（熱門關鍵字／焦點事件／藍綠溫差＋同題不同標）主次清楚。event desktop 每張事件卡依序是排名、標題、關鍵字膠囊、綠／其他／藍分布條、藍營與綠營標題對照，重點先出現。但 home mobile 與 ranking mobile 的第一屏幾乎全被文字雲佔滿，真正的排名表要捲過約一屏才看得到。 |
| 字體排印 | 6 | 手機版標題常在詞中斷行：media-outlet mobile 的「全球經營政商人／脈」「為何難成／真？」、article mobile 的「AI 教父婚外情連環／爆」、journalist-person mobile 的「深／化國際交流」。ranking desktop 的文字雲最小字約 8px，無法閱讀。journalist desktop、journalist-person desktop 的指標標題約 10–11px。article desktop 正文字級與行高舒適，這點做得好。 |
| 色彩 | 7 | 全站統一以橘色為品牌與目前狀態色；home-dark、eve-dark、ranking-dark、media-outlet-dark 都是真正的深色主題，橘字在近黑底上有個性。但 ranking-blue desktop/mobile 選中「藍營傾向媒體」時，膠囊仍是橘色，沒有用到藍色語意。ranking-dark mobile 的 ▲ 變暗成深酒紅，在黑底上幾乎看不見。 |
| 間距與版面 | 6 | ranking desktop 最右邊「媒體」欄被卡片邊緣切斷（約 x≈1272，第二個媒體圖示只剩一半）。similarity-daily desktop 最後一欄「採用／引用(」也被切掉（約 x≈1280, y≈886）。event desktop 卡片排名下方有一個空的灰色方框，裡面只有一小段藍線（約 x≈510–610, y≈395），像沒畫完的走勢圖。article desktop、topic-story desktop 只用約 590–700px 的版心，1440 寬兩側大量留白。 |
| 一致性 | 5.5 | 期間選項各頁不同：journalist 是 24 小時／2 天／3 天／7 天，journalist-person 是 24 小時／3 天／7 天／30 天，search 是 1 天／3 天／7 天／31 天，tag 是 1 天／3 天／7 天。「目前選項」在 tag desktop 是黑底（3 天），其他頁是橘底。ranking-error 的主按鈕是黑色，其他頁的強調色是橘色。event-hour desktop 的「看 2026-11-13 整天的事件→」是藍色連結，其他連結是橘色。日期格式混用 2026/11/12、11/12 18:50、2026-11-13，日期輸入框還顯示美式的 11/13/2026。eve-error 是通用 404，ranking-error 卻是專屬錯誤頁，兩者格式不同。 |
| 資訊密度 | 7.5 | ranking desktop、journalist desktop、similarity-daily desktop 是可排序的密集表格，一屏 30–70 列，適合研究者。media desktop 有 4 列篩選膠囊（標籤約 45 個）壓在表格上方。media mobile 有約 14 列膠囊，超過一整屏才看到表格，而且表格只剩媒體／範圍／傾向三欄，文章數全被隱藏。 |
| 導覽 | 6.5 | desktop 頂部導覽（文章／事件／議題／關鍵字／媒體／媒體關係／署名／寫法／即時看板）會標示目前頁面，搭配麵包屑與子分頁，位置清楚。手機只有漢堡選單，沒有底部常駐導覽。event mobile 的日期列左邊被切掉（「週一 /09」只剩一半）。topic-story desktop/mobile 的麵包屑「議題 / 三立新聞網 / 議題」重複出現「議題」。 |
| 狀態與回饋 | 5.5 | ranking-error desktop/mobile 做得好：說明原因，並提供「重新載入」「回首頁」。但 eve-error 只顯示「找不到這個頁面」加搜尋，沒說明事件可能被合併或已過期。event-empty desktop/mobile 寫「今天到目前為止的 0 件事」，上方 24 小時藍綠條卻顯示 27/49/24、「藍綠家數比約 50:50」，日期列空白只剩 < >，也沒提供「看昨天」的連結（有資料的狀態反而有）。event-loading 的骨架是 8 列清單，和實際的大圖卡片版面不符。search-none 只有一行「過去 31 天沒有符合…」，沒有改字建議。my-saved-empty 也只有一行灰字，沒有行動按鈕。 |
| 響應式 | 5 | ranking mobile 與 ranking-dark mobile 的表格只看得到「關鍵字」「爆發力」，「變動」欄被切一半（約 y≈1810），沒有任何可橫滑的提示。journalist mobile 的「篇數」欄標題只露出一角。similarity-daily mobile 的「% 」欄被截斷。media mobile 直接拿掉所有數字欄。search-none mobile 頁首搜尋框被擠成「zzqx」。my-saved-out mobile 的分頁折成兩列，「設定」單獨一列。 |
| 文案 | 6 | 內部術語外露：「爆發力」「升溫量 -1.2 已達多家跟進門檻」（tag desktop）、「每篇分攤造訪」（media desktop）、「相似度索引已比對」（journalist desktop）。my-following desktop/mobile 的事件只顯示「事件 #4128」，沒有標題。tag desktop 的鉅亨網摘要直接露出 HTML 實體「&#10;」兩次（約 x≈690, y≈2000）。event-hour desktop 有「上榜 925 小時」。ranking-error 顯示原始錯誤代碼「3772224109」。tag desktop 把黃仁勳標成「政治人物」。 |
| 無障礙 | 6 | 陣營不只靠顏色：分布條寫明「綠營 28%／其他 53%／藍營 19%」（search desktop），列表也有「偏藍／偏綠」文字徽章，這點做得好。但 journalist desktop 的比例橫條是極淡的灰線，幾乎看不見。各頁大量 10–11px 淺灰說明字（ranking desktop 的「首次出現」、journalist-person desktop 的指標標題）。ranking-dark mobile 的 ▲ 對比不足。my-saved-out 的「登入」只是句中的底線文字，點擊範圍很小。 |
| 信任與清楚 | 7.5 | 幾乎每頁都有「本頁的資料來源與計算方式」，還有「相似不等於抄襲」（article、journalist-person）、journalist-person desktop 的「關於這一頁」移除請求說明、tag desktop 的 Wikidata 與 CC BY-SA 圖片來源、各頁的「更新於 11/13 08:10」。但數字自相矛盾：home 是 19,835 篇，media desktop 寫 24 小時 19,866 篇；search 是 222 家，footer 是 220 家，ranking 又是 85 家。topic-story desktop 標題是黑色購物節議題，列表卻大多是黃仁勳、亞冠賽的新聞，沒有任何說明。ranking-blue 的爆發力 108.9 和全部媒體的 34.8 尺度不同，也沒說明。 |

要保留的優點：
- event desktop 的事件卡：排名、關鍵字膠囊、綠／其他／藍分布條、媒體圖示列、藍營與綠營標題對照，再到「各媒體標題對照→」，完整呈現「同一件事各家怎麼說」。
- journalist-person desktop/mobile 的內文差異比對：紅色刪除、綠色新增，加上「本篇早 49 分鐘刊登・相似 74%」，又標註「相似不等於抄襲」，是同類網站少見的深度。
- 全站「本頁的資料來源與計算方式」折疊區、footer 的「今天已收錄 684 篇」即時狀態，以及 journalist-person 的「關於這一頁」移除說明。
- 深色外觀（home-dark、eve-dark、media-outlet-dark、ranking-dark）不是單純反色：橘色強調、媒體 logo 與圖表都重新調過。
- ranking-error desktop/mobile 的錯誤頁：小標、原因、「重新載入」「回首頁」雙按鈕，是很好的範本。
- media-outlet desktop 的右側欄：媒體資料、寫法比例、Similarweb 流量來源、媒體關係圖例，資料豐富。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [ranking] [mobile] 排行表只看得到「關鍵字」「爆發力」，「變動」欄被切一半，分數、篇數、趨勢、媒體全看不到，也沒有可橫滑的提示（另見 journalist_mobile 的篇數欄、similarity-daily_mobile 的 % 欄、media_mobile 數字欄全被拿掉）。—— 手機讀者拿不到排行的核心資料。—— 手機改成每列一張卡（名次、關鍵字、爆發力、變動、迷你走勢），或固定第一欄、其餘可橫滑並加上漸層提示。
2. [狀態與回饋] [event-empty] [兩者] 寫著「0 件事」，上方卻還顯示 24 小時藍綠 27/49/24 與「約 50:50」；日期列空白只剩 < >；沒有「看昨天」的下一步（另見 event-loading 骨架和實際版面不符、eve-error 是通用 404、search-none／my-saved-empty 只有一行字）。—— 資料互相矛盾，讀者會懷疑網站壞了。—— 空狀態隱藏和事件無關的統計，補上「看昨天（11/12）」主按鈕；骨架照實際卡片版型畫；事件找不到時說明可能已合併並提供搜尋。
3. [間距與版面] [ranking／similarity-daily] [desktop] 最右邊的「媒體」欄與「採用／引用」欄被卡片邊界切斷（約 x≈1272–1280）；event desktop 的事件卡有空的灰色走勢框（約 x≈510–610, y≈395）。—— 1440 寬的大螢幕還會裁切，看起來像壞掉。—— 表格寬度要符合容器，或加上明確的橫向捲動；走勢沒有資料時就不要畫框，或改顯示「資料不足」。
4. [文案] [tag／my-following] [desktop] 摘要露出「&#10;」；追蹤清單的事件只顯示「事件 #4128」；「爆發力」「升溫量 -1.2 已達多家跟進門檻」「每篇分攤造訪」等內部用語沒有就地說明（另見 ranking-error 的原始錯誤代碼、tag 頁把黃仁勳標成「政治人物」）。—— 系統用語與資料瑕疵直接傷害專業感。—— 解碼 HTML 實體；事件一律顯示標題；術語加上滑過說明或改成白話，例如把「爆發力」寫成「升溫速度」並附說明。
5. [一致性] [journalist／journalist-person／search／tag] [兩者] 期間選項各頁不同（2 天、30 天、31 天、1 天混用）；目前選項有時黑底、有時橘底；ranking-error 主按鈕是黑色；event-hour 連結是藍色；日期格式三種，輸入框還是美式 11/13/2026。—— 讀者每到一頁都要重新理解控制項。—— 統一期間元件（例如 24 小時／3 天／7 天／30 天）、選中狀態一律用橘色、日期一律 YYYY/MM/DD（或 11/13）並改成台灣格式的日期選擇器。

## 組 C
總分：6.5 / 10
一句話總評：C 組 64 張截圖和 B 組逐位元相同，評估結果與 B 一致：資料深度與透明度很強，但手機寬表格被裁切、詞中斷行、空狀態矛盾與元件不一致拖累了整體。

| 項目 | 分數 | 證據（頁面／狀態 ID、尺寸、看到的事實） |
|---|---|---|
| 資訊層級 | 7 | home desktop：文字雲主視覺搭配「同一件事，各家怎麼說」與更新時間，三欄的熱門關鍵字／焦點事件／藍綠溫差主次清楚。event desktop 事件卡依序是排名、標題、關鍵字、陣營分布、藍綠標題對照。home mobile、ranking mobile 的第一屏被文字雲佔滿，排名表要捲過約一屏才出現。 |
| 字體排印 | 6 | media-outlet mobile 的「全球經營政商人／脈」「為何難成／真？」、article mobile 的「連環／爆」在詞中斷行。ranking desktop 文字雲最小約 8px。journalist-person desktop 的指標標題約 10–11px。article desktop 正文字級舒適。 |
| 色彩 | 7 | 橘色品牌與目前狀態色一致，home-dark、eve-dark、media-outlet-dark、ranking-dark 是完整的深色主題。ranking-blue 選中「藍營傾向媒體」仍用橘色。ranking-dark mobile 的 ▲ 是深酒紅，幾乎看不見。 |
| 間距與版面 | 6 | ranking desktop「媒體」欄被切（約 x≈1272）；similarity-daily desktop「採用／引用(」被切（約 x≈1280, y≈886）；event desktop 有空的灰色走勢框（約 x≈510–610, y≈395）；article、topic-story desktop 版心只有約 590–700px。 |
| 一致性 | 5.5 | 期間選項：journalist 24 小時／2／3／7 天，journalist-person 24 小時／3／7／30 天，search 1／3／7／31 天。tag 的選中狀態是黑底，其他頁是橘底。ranking-error 主按鈕是黑色。event-hour 有藍色連結。日期格式 2026/11/12、11/12、2026-11-13 混用，日期輸入框是 11/13/2026。 |
| 資訊密度 | 7.5 | ranking、journalist、similarity-daily desktop 是可排序的高密度表格，一屏 30–70 列。media mobile 有約 14 列篩選膠囊才到表格，表格只剩三欄、沒有數字。 |
| 導覽 | 6.5 | desktop 頂部導覽會標示目前頁面，有麵包屑與子分頁。手機只有漢堡選單。event mobile 日期列左側被切。topic-story 麵包屑「議題 / 三立新聞網 / 議題」重複。 |
| 狀態與回饋 | 5.5 | ranking-error 有原因與「重新載入／回首頁」。eve-error 是通用 404。event-empty「0 件事」卻顯示 24 小時藍綠 27/49/24，日期列空白，也沒有看昨天的入口。event-loading 骨架和實際版面不符。search-none、my-saved-empty 只有一行字。 |
| 響應式 | 5 | ranking mobile「變動」欄被切一半，沒有橫滑提示。journalist mobile「篇數」欄只露出一角。similarity-daily mobile「%」欄被截。media mobile 拿掉所有數字欄。search-none mobile 頁首搜尋框被擠成「zzqx」。 |
| 文案 | 6 | tag desktop 摘要露出「&#10;」（約 x≈690, y≈2000）；my-following 顯示「事件 #4128」；有「爆發力」「升溫量」「每篇分攤造訪」「相似度索引已比對」等術語；event-hour「上榜 925 小時」；ranking-error「錯誤代碼 3772224109」。 |
| 無障礙 | 6 | 陣營有文字標籤（「綠營 28%」、「偏藍／偏綠」徽章），這點好。journalist desktop 的比例條是極淡灰線。大量 10–11px 淺灰字。ranking-dark mobile 的 ▲ 對比不足。my-saved-out 的「登入」是句中小連結。 |
| 信任與清楚 | 7.5 | 各頁都有「本頁的資料來源與計算方式」，有「相似不等於抄襲」、移除請求說明、Wikidata 圖片來源、更新時間。但 home 19,835 篇對 media 19,866 篇、222 家對 220 家對 85 家互相矛盾；topic-story 列表內容和議題名稱不符；ranking-blue 爆發力 108.9 的尺度沒有說明。 |

要保留的優點：
- event desktop 事件卡的「陣營分布條＋藍營與綠營標題對照＋各媒體標題對照」結構。
- journalist-person 的內文差異比對（紅色刪除、綠色新增），以及「相似不等於抄襲」與移除說明。
- 全站的「本頁的資料來源與計算方式」與 footer 的即時收錄狀態。
- home-dark、eve-dark、media-outlet-dark、ranking-dark 是有個性的深色主題。
- ranking-error 的錯誤頁有說明，也有「重新載入」「回首頁」兩個出口。
- media-outlet desktop 側欄的寫法比例、流量來源、媒體關係等多面向資料。

最重要的五個問題（由嚴重到輕微）：
1. [響應式] [ranking] [mobile] 排行表只剩「關鍵字」「爆發力」，「變動」欄被切一半，沒有橫滑提示（另見 journalist_mobile、similarity-daily_mobile、media_mobile）。—— 手機讀者看不到排行的核心數據。—— 改成卡片式列，或固定首欄可橫滑並加漸層提示。
2. [狀態與回饋] [event-empty] [兩者] 寫「0 件事」卻顯示藍綠 27/49/24 與「約 50:50」，日期列空白，也沒有下一步（另見 event-loading、eve-error、search-none、my-saved-empty）。—— 資料自相矛盾，讓人懷疑系統壞了。—— 隱藏無關統計，提供「看昨天」主按鈕；骨架照實際版型；404 說明可能已合併。
3. [間距與版面] [ranking／similarity-daily] [desktop] 最右欄在約 x≈1272–1280 被切斷；event desktop 有空的走勢框（約 x≈510–610, y≈395）。—— 大螢幕上還會裁切，看起來不專業。—— 表格寬度符合容器或明確可捲動；走勢沒有資料就不畫框。
4. [文案] [tag／my-following] [desktop] 露出「&#10;」、只顯示「事件 #4128」，術語也沒有就地說明（另見 ranking-error 錯誤代碼、黃仁勳被標成「政治人物」）。—— 系統外露會傷害可信度。—— 解碼實體、顯示事件標題、術語加上說明或改成白話。
5. [一致性] [journalist／journalist-person／search／tag] [兩者] 期間選項、選中狀態顏色、主按鈕顏色、連結顏色與日期格式各頁不同。—— 增加學習成本。—— 統一期間元件、選中狀態用橘色、日期採台灣格式。

```json
{"A": {"overall": 7, "scores": {"資訊層級": 8, "字體排印": 7.5, "色彩": 7.5, "間距與版面": 7, "一致性": 7.5, "資訊密度": 7, "導覽": 8, "狀態與回饋": 6, "響應式": 5.5, "文案": 7, "無障礙": 6.5, "信任與清楚": 6.5}, "issues": ["[響應式] google-news-tw mobile 直接套桌面版：左邊空約 160px、內容溢出右緣，標題與分頁被切", "[信任與清楚] ground-news-story 兩者：Factuality/Ownership 被 Upgrade 付費牆鎖住，評等為 unknown", "[響應式] verity-home mobile：回到頂部浮鈕壓在第二則標題上（約 y≈1850）", "[無障礙] ground-news-home desktop：列表的小立場條約 6px 高，常無 L/C/R 文字，只靠紅藍色", "[間距與版面] ground-news-story／verity-home desktop：左欄 y≈1240 後空白；Verity 在 1440 寬只用約 830px"]}, "B": {"overall": 6.5, "scores": {"資訊層級": 7, "字體排印": 6, "色彩": 7, "間距與版面": 6, "一致性": 5.5, "資訊密度": 7.5, "導覽": 6.5, "狀態與回饋": 5.5, "響應式": 5, "文案": 6, "無障礙": 6, "信任與清楚": 7.5}, "issues": ["[響應式] ranking mobile：排行表只剩關鍵字與爆發力，變動欄被切一半，無橫滑提示（另見 journalist/similarity/media mobile）", "[狀態與回饋] event-empty 兩者：寫 0 件事卻顯示藍綠 27/49/24、日期列空白、沒有看昨天的入口（另見 event-loading 骨架不符、eve-error 通用 404）", "[間距與版面] ranking/similarity-daily desktop：最右欄在約 x≈1272–1280 被切；event desktop 有空的灰色走勢框", "[文案] tag desktop 露出 &#10;、my-following 只顯示「事件 #4128」、爆發力/升溫量/每篇分攤造訪等術語沒有說明", "[一致性] 期間選項各頁不同（2天/30天/31天）、選中狀態黑或橘、主按鈕黑、連結藍、日期格式混用含 11/13/2026"]}, "C": {"overall": 6.5, "scores": {"資訊層級": 7, "字體排印": 6, "色彩": 7, "間距與版面": 6, "一致性": 5.5, "資訊密度": 7.5, "導覽": 6.5, "狀態與回饋": 5.5, "響應式": 5, "文案": 6, "無障礙": 6, "信任與清楚": 7.5}, "issues": ["[響應式] ranking mobile：排行表只剩關鍵字與爆發力，變動欄被切一半，無橫滑提示（另見 journalist/similarity/media mobile）", "[狀態與回饋] event-empty 兩者：寫 0 件事卻顯示藍綠 27/49/24、日期列空白、沒有看昨天的入口（另見 event-loading 骨架不符、eve-error 通用 404）", "[間距與版面] ranking/similarity-daily desktop：最右欄在約 x≈1272–1280 被切；event desktop 有空的灰色走勢框", "[文案] tag desktop 露出 &#10;、my-following 只顯示「事件 #4128」、爆發力/升溫量/每篇分攤造訪等術語沒有說明", "[一致性] 期間選項各頁不同（2天/30天/31天）、選中狀態黑或橘、主按鈕黑、連結藍、日期格式混用含 11/13/2026"]}}
```
