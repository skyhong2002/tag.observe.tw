# 026–050 獨立 UI 審查

Reviewer: GPT-6.1 Sol。受測正式部署程式 SHA `48083b58c4ee3d16f2072206f1da3df332f34143`，透過內部同版本入口截圖；不是正式 CDN 驗收，也不是尚未部署的 F1 新功能驗收。只看既有 collector 圖，沒有登入、production寫入或browser操作。逐頁狀態保留pending，首屏觀察不替代全文、互動或動態狀態矩陣。

## 026 /cat/news/

桌機：新聞媒體選中，排行標題、時間摘要、方法連結與橙色字雲層級清楚。手機：導航折圖示、方法連結換行；類別chips右端截斷，未見捲動提示，字雲較小且表格僅首列在首屏末端。URL證實轉址/ranking/?category=news；未見頁級溢位。卡片不適用；下方表格、互動、loading/empty/error及少筆/權限樣本pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/026-cat-news-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/026-cat-news-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.589327+00:00。

## 027 /crawlers/

桌機：爬蟲/流量tab、方法連結、摘要条、搜尋與抓取篩選間距清楚；七欄表以橙色失敗次數、紫色工具標籤區分。手機：篩選標籤自然換行；表只見媒體/頻率/累計，下一欄殘片，近期失敗欄須水平捲動且未見提示。297來源正常樣本；表格互動、loading/empty/error pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/027-crawlers-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/027-crawlers-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.590269+00:00。

## 028 /crawlers/traffic/

桌機：流量tab選中、方法連結在說明旁，Similarweb/Cloudflare摘要卡等寬；表格綠色已取得、灰色等待清楚。手機：卡片堆疊、文字換行；表裁切日期，Cloudflare欄在視區外且未見滑動提示。已見等待抓取/部分網域未能更新；完整空/錯誤及表格互動pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/028-crawlers-traffic-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/028-crawlers-traffic-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.590928+00:00。

## 029 /demo/

URL證實/demo/轉址首頁。桌機：頂部只有導覽無左方品牌，中心新文易數品牌與橙色字圖分布清楚，下方排行/焦點/溫差三欄有間距；手機：搜尋/登入/menu、字图及單欄焦點卡清楚，焦點圖片與新聞標題及三色比例無重疊。表格/方法notes首屏不適用；下方、互動及loading/empty/error pending；不能宣稱有獨立demo UI。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/029-demo-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/029-demo-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.592652+00:00。

## 030 /demo/compare/

URL證實/demo/compare/轉址首頁。已分別看本route兩張：桌機中心品牌字雲與三欄卡對齊、橙色鏈結明顯；手機字圖仍圍繞品牌，焦點圖卡占全內容寬度，標題換行與比例條可讀。沒有比較控制項，不能當比較頁功能pass。方法notes/表格首屏無；下方、互動及loading/empty/error pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/030-demo-compare-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/030-demo-compare-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.593507+00:00。

## 031 /event/archive/

URL證實/archive/轉址/event/。桌機事件導航選中，每日/每小時、方法連結、三色比例、日期列與累積提示層級明確，圖片/事件內容/67事件右側索引分欄。手機日期列左端日期裁切，日期選擇與時段欄換行；索引折為事件索引accordion，卡片圖片及熱度行堆疊。圖中來源網址長但未见頁級溢位。archive獨立功能不作pass；下方、互動、loading/empty/error pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/031-event-archive-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/031-event-archive-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.594439+00:00。

## 032 /feature/setn/

桌機：專題導航高亮、麵包屑、媒體標題/外部來源/方法連結、34個專題更新摘要清楚；列表縮圖與標題/外部URL、其他報導數，來源靠右。手機：縮圖旁標題與URL換行，多筆關聯報導以省略號保留來源，間距能區分各專題。灰色更新資訊字小但仍可見，未量對比。無表格；多筆首屏已見，少筆/空/錯誤/權限、互動與下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/032-feature-setn-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/032-feature-setn-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.603275+00:00。

## 033 /feature/setn/50/

桌機：返回專題鏈結、收藏/回報靠右，中央704px文章寬、標題/未署名日期/關鍵字chips、摘要橙邊與大圖有間距。手機：返回與兩動作同列清楚，chips兩欄換行，摘要行距與圖片/配圖來源可讀；未見溢位。首屏沒有本頁方法notes或表格；單專題正常樣本，related多/少/空/錯誤/權限與動作/下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/033-feature-setn-50-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/033-feature-setn-50-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.604365+00:00。

## 034 /group/

桌機：標籤群組方法說明直接位於標題下、7天選中、身份/類型下三欄卡；每卡五名、橙條、紅升綠降且箭頭可辨。手機：說明換行後日期tabs，卡正確單欄，篇數及增減靠右沒有重疊。無表格；首屏多卡正常，loading/empty/error及下方/互動pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/034-group-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/034-group-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:18:59.605156+00:00。

## 035 /group/1/

桌機：群組返回標籤、政治人物標題、532標籤/7天門檻說明及日期tabs；五欄排行榜間距足、紅正綠負數字附符號。手機：表五欄完整塞入內容寬，標籤/名次/近7天/前7天/增減可逐列閱讀，沒有027表裁切問題；說明換行清楚。卡片不適用，方法直接說明；多筆已见，少/空/錯/權限及排序/下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/035-group-1-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/035-group-1-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:19:50.554299+00:00。

## 036 /journalist/

桌機：署名導航選中、記者類別tabs、2天chip、三項統計與搜尋媒體欄/排序/方法連結清楚；表格可見記者、刊登媒體、篇數、首見/相近/引用及小圖線。手機：類別tabs完整，統計堆疊及篩選欄分列；表到右端僅見篇數欄標頭殘片，關係指標須水平捲動且未見提示。loading/empty/error、表格互動與下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/036-journalist-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/036-journalist-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:19:50.568429+00:00。

## 037 /journalist/方承業/

桌機：方承業姓名與追蹤、原文角色連結、媒體logo/數量行和7天統計列清楚；相近文章卡、粉紅刪除/綠新增高亮與右側常寫主題/比對篇數卡分欄，『相似不等於抄襲』方法提示緊鄰。手機：媒體行換行，統計四項再兩項、側欄折accordion，文章卡標題與相近稿分段不重疊。沒有表格；多筆相近文章正常，少/空/錯/權限、追蹤等互動與下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/037-journalist-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/037-journalist-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:19:50.578537+00:00。

## 038 /liveboard/

桌機：全螢幕看板無一般navbar，頂部品牌/在線/今日收錄/更新/時間、頁點明確；橙色人物國旗logo與黑字環繞中央綜合標題，時間軸灰字層級較弱。手機：看板所有元素縮小而仍無重疊，中央時間軸及『所有媒體最常寫的關鍵字』非常小、閱讀負擔明顯，今日收錄數在手機頂部未見。無卡片/表格/方法notes，播放輪換、設定入口、loading/empty/error未測。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/038-liveboard-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/038-liveboard-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:19:50.582382+00:00。

## 039 /liveboard/setting/

桌機：即時看板設定中央窄欄，精簡/完整卡並排且橙框選中，兩個開啟/預覽按鈕，鏡頭checkbox表列色條與上下箭頭清楚。手機：選擇卡堆疊、按鈕同列，鏡頭長副標仍塞入單行且字較小，箭頭在右可辨；上箭頭淡色看似disabled。方法說明直接在標題下，非表格資料頁；未變更設定，重排/預覽/下方與loading/empty/error pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/039-liveboard-setting-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/039-liveboard-setting-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:19:50.590389+00:00。

## 040 /liveboard/settings/

本route兩張獨立看過，顯示相同即時看板設定。桌機中央窄欄兩張選擇卡、橙框、checkbox鏡頭列與動作間距明確；手機選擇卡改單欄，按鈕並排、鏡頭色條/箭頭不重疊但副標小。JSON URL證實/settings/轉址/setting/；設定播放與保存/下方/其他states pending，不以039抽樣代替。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/040-liveboard-settings-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/040-liveboard-settings-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:19:50.597355+00:00。

## 041 /login/

桌機：登入新文易數標題、Google只取名字Email說明與Google登入按鈕位於中央；下方方法accordion與完整footer三欄間距清楚。手機：登入內容左對齊、文字換行、按鈕容易辨識，大段留白後方法accordion及品牌footer，社群按鈕換行不溢位。無表格/卡片；僅登入gate視覺已看，未按登入，OAuth/錯誤/授權後內容、accordion互動pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/041-login-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/041-login-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:19:50.604620+00:00。

## 042 /media/cnews/

桌機：媒體nav選中、匯流新聞網logo/追蹤、右側今日0/24h87/7天361、三tabs；橙黑字雲與最新收錄搜尋左欄，媒體資料/寫法卡右欄有間距。手機：統計移到名稱下、三tabs完整，媒體資料折accordion、字雲壓縮仍有明確主詞；搜尋/期間chips/顯示摘要與文章縮圖可見。無表格，方法notes首屏未見；多篇正常，今日0不是全頁empty。少/空/錯/權限、追蹤/搜尋/下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/042-media-cnews-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/042-media-cnews-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:21:52.373471+00:00。

## 043 /media/cnews/articles/

URL證實/articles/轉址/media/cnews/。本route兩寬獨立看過：桌機媒體名稱統計、字雲/媒體資料卡雙欄，latest search row及文章行有清楚層級；手機媒體卡折起，字雲與收錄列表單欄、文章標題換行且右縮圖不碰文字。方法notes/表格首屏無；多篇正常，其他狀態、下方及互動pending，不宣稱独立articles頁功能。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/043-media-cnews-articles-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/043-media-cnews-articles-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:21:52.388369+00:00。

## 044 /media/cnews/references/

桌機：來源/引用tabs選中、兩張30/0統計卡、引用方向兩按钮、關係圖鏈結；30則列表以橙媒體/紫引用標籤與左紫邊引用原句區分，行距清楚。手機：兩統計卡仍並排但夠寬，兩方向按钮同列，列表長標題與作者來源行自然換行，原站鏈結可辨。麵包屑稱關係圖而主navbar高亮媒體有分類疑慮待實際導航。0的另一方向僅統計不是已審empty。少/空/錯/權限與互動/下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/044-media-cnews-references-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/044-media-cnews-references-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:21:52.391266+00:00。

## 045 /media/crawlers/

URL證實/media/crawlers/轉址/crawlers/。已獨立看兩張：桌機摘要條、抓取篩選標籤、七欄表正常，橙失敗次數/紫工具清楚；手機標籤換行，表僅媒體/频率/累計露出，右側失敗/抓取/工具需捲且未见提示。JSON兩寬consoleErrors有React minified #418（需修正/復驗）；不猜原因。方法鏈结在標題下，loading/empty/error與表格互動/下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/045-media-crawlers-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/045-media-crawlers-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:21:52.396232+00:00。

## 046 /media/sources/

URL證實/media/sources/轉址/media/traffic/?sort=traffic&dir=desc。桌機流量nav/流量與排名tab高亮，方法鏈結、搜尋/月變化-數值/月選擇、收錄/月變化/台灣占比/造訪/排名多欄表清楚，但最右欄仍被裁切。手機筛選兩行，媒體名稱網域省略、月變化數值及排名在右側視區外，只見折線末端且未見捲動提示；核心流量數字首屏不可見。沒有摘要卡；loading/empty/error、排序/月份/下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/046-media-sources-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/046-media-sources-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:21:52.402386+00:00。

## 047 /media/traffic/

本route雙寬獨立看過：桌機媒體流量與排名，搜尋/月變化選中及2026/09、橙折線綠增幅與排名可辨，但最右欄裁切。手機同樣媒體行截短與流量值在右，未見滑動提示；本手機navbar只有搜尋/月/menu，少登入圖示，桌機URL帶sort/dir手機無，可能拍攝時狀態差，尚未判因。方法鏈結清楚。無卡片；loading/empty/error、表格互動/下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/047-media-traffic-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/047-media-traffic-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:21:52.406396+00:00。

## 048 /method/

桌機：資料來源與計算方式正文寬欄加右本頁大綱，章/小標/正文/橙色跨頁鏈結層級清楚，正文行距舒適。手機：目錄卡移到正文上方且16項橙鏈結占大半首屏，正文資料來源在下方可讀；無溢位、表格首屏無。需捲很長才到詳細方法，不記錯誤但為導航可用性觀察。所有方法章節全文及錨點互動未驗、loading/empty/error pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/048-method-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/048-method-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:21:52.410298+00:00。

## 049 /my/

桌機：我的新文易數標題與五tabs，內容僅『載入中…』，navbar也未顯登入；方法accordion及footer顯示正常，無重疊。手機：同tabs完整塞入，內容已為Google登入後可追蹤/收藏/設定/報告/API/回報的六條說明，有橙登入鏈結，下方方法/品牌footer。兩寬狀態不一致，桌機未穩定，已請collector補；僅loading及匿名gate視覺，不能算我的動態內容pass。未登入、無表格/資料卡；授權後/empty/error/互動pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/049-my-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/049-my-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:21:52.410962+00:00。

## 050 /my/following/

桌機：我的新文易數、追蹤清單tab高亮、匿名Google登入六項說明、方法accordion、三欄footer清楚；大段留白無重疊。手機：五tabs仍完整、說明自然換行，登入橙鏈結與品牌footer可辨。無追蹤資料表/卡片因未登入，只看匿名gate，不是空追蹤清單或授權後功能pass。沒有登入或production寫入；其他狀態/accordion/下方pending。

Status: pending。圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/050-my-following-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/050-my-following-390.png。記錄：/home/deck/tag-analysis-private/ui-review/f1/review-middle.log；UTC 2026-10-12T19:22:24.502328+00:00。


## 範圍與具體阻礙

026–050共25條route，每條都實際透過view_image看1280×800與390×844首屏，共50張，沒有用共享元件或抽樣冒充。正常首屏已可判讀，但所有整頁最終狀態維持pending：collector僅首屏、未提供下方/互動/動態多-少-空-錯誤-權限完整矩陣；049桌機仍載入中；my頁僅匿名gate，既有授權session未提供。045兩寬捕捉React#418。正式CDN截圖先前429且中斷，不用作本分片驗收。內部入口可證明同release畫面，不是對正式CDN外部路徑驗收，也不可替代F1。

具體可用性疑慮：026手機類別列截斷；027/028/036/045/046/047手機資料表核心欄位在視區外且沒有明確捲動提示（未測實際捲動）；038手機時間軸與副標太小；047手機登入圖示未出現，兩寬query狀態差需補穩定證據。無對比度量測，不將灰字可读性觀察寫成標準違反。

提交狀態：本分片未提交，依主agent要求統一commit。部署狀態：未部署任何變更；所看同release SHA 48083b58c4ee3d16f2072206f1da3df332f34143 的內部畫面，正式CDN驗證未完成。

## 049 穩定匿名gate補審

049穩定狀態補審：實際看新的1280/390兩張。桌機現已顯匿名Google登入六條用途說明，非載入中；我的動態tab高亮、方法accordion及三欄footer均清楚。手機五tabs及同六條說明完整換行、橙登入連結可辨，方法列與單欄footer不重疊；今日收錄數因兩次不同時間由759到808，不當作UI錯誤。兩寬均匿名gate首屏可讀，仍未驗授權後內容/互動/下方/其他states，pending。此前loading捕捉保留於原log，不假稱通過。

UTC 2026-10-12T19:47:53.209259+00:00；圖：/home/deck/tag-analysis-private/ui-review/f1/playwright-stable-states-v2/003-my-1280.png；/home/deck/tag-analysis-private/ui-review/f1/playwright-stable-states-v2/003-my-390.png；log同上。
