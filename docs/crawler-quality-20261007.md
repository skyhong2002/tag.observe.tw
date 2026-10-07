# 爬蟲 24 小時品質觀察（進行中）

觀察時間：2026-10-07 18:49:13 至 2026-10-08 18:49:13（Asia/Taipei）。初輪額外納入起跑前一小時作為基線；不能把基線算成已完成的觀察時數。

每小時按媒體將這一輪完成內容擷取的自有爬取文章（不限制發布年齡，包含新取得舊文與錯誤未來日期）分組，每 100 篇以固定雜湊取最多 2 篇，尾組亦取最多 2 篇。已進入前輪母體的文章不再重複抽。保留原 HTML 壓縮檔、SHA-256、資料庫欄位、正式 release 路徑、同一原頁重新解析的欄位，以及疑點；人工核對紀錄獨立保存。空白署名、HTTP 失敗、欄位不同都只是疑點，不能直接當成爬蟲錯誤。官方新聞稿不一定有個人記者。

抽樣只執行 SELECT、公開頁面讀取與本地檔案寫入。單一請求串行、每篇間隔 750ms。獨立 systemd timer 不重啟正式 worker。到期後不再擷取新的時間窗；最後一次整點啟動會補齊結束前的區間。結束後停用 timer 並彙整最終報告。

證據：主工作目錄 `artifacts/crawler-quality-20261007/`（不提交新聞全文）。工具：`tools/crawler-quality-watch.mjs`。獨立修正工作目錄 `/home/deck/Projects/tag-crawler-quality-20261007`。原工作目錄既有未提交變更已記錄，未混入本次修正。

起始兩輪曾限制發布七日內；19:02 的補抽保留已見 ID、回溯最初時間窗，補入 432 篇此前未納入的母體並抽取 29 篇，消除年齡範圍缺口。SELECT 有 30 秒伺服器端時限；失敗不推進游標。

## 第一批已發布修正（2e2f053）

| 媒體／流程 | 原始問題 | 修正與證據 |
| --- | --- | --- |
| AFP factcheck | 把 ClaimReview 內被查核貼文的 9/30 日期當作 10/7 報導日期；漏 AFP Thailand 署名 | 採主文章 created epoch 時間及主署名列；樣本 45409613。原資料庫日期正確，錯誤在文章重新解析路徑 |
| 阿波羅 | 新唐人轉載只留媒體名稱，漏掉尾署名安琪、臣倩；大紀元／新唐人提供者未成為來源 | 限定新唐人獨立尾署名格式；阿波羅文章明示 provider meta；45411494、45411495 |
| Focus Taiwan | 只留網站名稱，漏文章末段兩位英文署名 | 主文章 author 第一段及明確 `(By … and …)`；45408622、45408623 |
| 台灣新聞雲報 | WordPress 帳號高雄港區新聞網／墨新聞取代張游舜；漏明示墨新聞來源 | 支援墨新聞前綴與原文來源連結；45408283、45408285 |
| 鏡報 | 公開摘要與正文拆成兩個 article/div，未取得正文，頁尾訂閱文字造成 blocked 誤判 | 限定共同容器並只保留兩段 story-renderer，44942252 原頁重播恢復完整 247 字；署名呂健豪與發布日期原本正確。發布後追蹤正常重試恢復 |
| 聯合新聞網 | 特殊斜線 ╱ 使記者呂翔禾漏辨識，明示台灣醒報來源未入庫 | 正規化署名斜線；限定文章作者欄的醒報供稿格式，分開記者及提供者。45358930 原頁重播署名／來源修正，正文及發布時間不變 |
| 台灣醒報 | 捐款文案混入正文、SEO 網站名稱尾綴留在標題 | 使用 article 內 markdown-body 與文章 header h3；RSS 入庫移除明確網站尾綴。45408146 原頁重播僅刪除 68 字捐款尾段，正文及呂翔禾署名保留 |
| BBC 中文 | YouTube 曲奇同意提示與「結尾 YouTube 帖子」進入正文 | 僅排除指定嵌入提示元素；45416418 |
| i-media | 舊 overrides 的記者選擇器未套用到 auto-discovery，新文章沒有署名 | 將選擇器放到 URL 共用規則；45408257、45408258 |
| 更生日報 hsnews | 作者／發布時間 microdata 不在 article tag 內，重新解析漏抓 | 指定主文章 header 的 author 與 datePublished；45411637、45411639 |
| 上報 | 主文用 div，嵌入推文用 p，解析僅存推文 200 字 | 按主文章容器保留 div 正文，排除圖片圖說、標籤與推薦；樣本 45360803，正文 1,599 字並恢復 CNN 引用 |
| 三立 | JSON-LD 錯把本地 18:00 宣告 UTC | 用主文章明示發布時鐘；45374687、45397193。資料庫原日期正確，修正重新解析路徑 |
| 芋傳媒 | JSON-LD 只有日期，丟掉實際發布時分秒 | 用「發表時間」datetime，明確排除「最後更新」；45410154 |
| 蕃新聞／創新聞／焦點時報 | 明示互傳媒、創新聞、點傳媒前綴未辨識；埔里被黏進名字 | 擴充限定前綴及埔里地名；45408533、45408306、45408464 |
| 4Gamers | 明示 GameRant 報導卻無來源記錄 | 增加 Game Rant／GameRant 別名，國別維持未知，不推測；45410105 |
| 今傳媒／鴨鴨新聞 RSS | 把整句標題或過長標題片段當作標籤 | 入庫文章與排行標籤索引都遵守既有文章解析的 30 字上限；45408341、45408340、45408571 |
| 大紀元／端傳媒 | JSON／meta 將本地時鐘誤宣告為 UTC | 官方 RSS 交叉確認 45415054、45415057、45361082；僅當頁面明示本地時鐘與宣告時鐘吻合才校正時區，保留秒數，不複製不同的更新時間 |
| BBC 英文／基督教今日報 | `for`、`The` 等英文虛詞成為標籤 | 限定完整虛詞比對，保留 The Hope、US、AI 等有意義名稱；45411431、45408598 |
| discovery → 入庫 | 驗證文章時取得的 provider 被丟棄，入庫抽引用固定傳 null | 保留 verifiedProvider，在新增與正文修復兩條路徑帶入引用解析；不把 provider 欄位直接展開成 DB 欄位 |

已增加原頁精簡版型回歸測試、provider 傳遞及實際入庫路徑測試。第一批已於 10/7 19:51:13 發布為 `2e2f0534b51f0437cd28ef2c5dec623f8f1d1a44`，並推送 origin/main。gateway、worker、前端的 process cwd 均確認使用該 release，正式 HTTPS 首頁回應 200（開發主機端驗證）。無修改時不發布。

## 待釐清與限制

- 大紀元與端傳媒的時區問題已由官方 RSS 證實並完成本地修正；三篇原頁重播時間均與 RSS／既有資料庫相符，正文與署名不變。
- Game Rant 國別尚未獨立確認，引用已能記錄，國別保留 ZZ／未知。
- BCC、i-news 原頁 HTTP 403：列為無法驗證，不嘗試繞過驗證頁，也不把已存在的內容抹除。
- 完整 24 小時、跨輪改善率、發布結果與最終修改清單尚未完成；本檔不是結案報告。

## 發布檢查的基線修補

完整測試原有一個 API 文件測試失敗：正式基線的公開 GET `/api/v1/reader-presence` 未列入 OpenAPI。補上對應文件與產生的 Markdown；兩份 migration metadata 僅正規化格式，無 SQL 或 schema 異動。獨立提交 `9a54073`。這些不是爬蟲修正，不列入修改媒體數。

## 正常欄位的對照核驗

另核對 17news 45408981、4Gamers 45410106、中時 45393700／45393706、中央社 45357266、BBC 英文 45411430 的原頁標題、署名或筆名、時間及標籤；已檢查欄位未發現問題。中央社正文記者陳婕翎與末段編輯陳清芳可正確區分。BBC 45411431 的網站 h1 與既存標題不同但 canonical 一致，保留為可能的編輯／SEO 標題差異，不擅自當作解析錯誤。這些紀錄只證明已檢查欄位，不代表文章所有 metadata 已全面驗證。

## 第一批既有資料修復（已套用並驗證）

`tools/crawler-quality-repair.mjs` 僅接受最多 100 筆有原始快照及人工證據的修復計畫，預設 dry-run。正式套用必須指定備份；工具取得既有 similarity-index 鎖，若已有任務執行就退出等待，逐筆鎖定文章並比對快照，將原始列及受影響索引先落盤。署名使用既有 `repair-article-authors.ts` 的獨立修復流程。

已完成 17 筆 metadata 修復 dry-run：9 筆引用／來源、5 筆標籤、3 筆正文（含上報 CNN 引用及醒報標題）。三篇正文重新抓取後與已核對的原頁解析一致。正文修復只允許尚無相似配對的文章，清除舊 sketch 並交回正常索引排程；引用與標籤的衍生索引在同一筆交易修正。原始發布／取得時間保持不變。19:52 已套用 17 筆修復，逐欄及衍生索引核對全部相符；另 14 筆署名修復全部成功且回讀相符，沒有競態覆寫或抓取失敗。三篇正文於 19:55:49 由正常相似度排程完成重新索引。原始資料備份、計畫及結果存於忽略的 artifacts 目錄。

## 第一批任務連續性與限制

19:49:36 暫停佇列領取新任務，當時 active=0、waiting=0；既有 delayed 排程保留。worker 在 19:50:26 正常收到 SIGTERM 並完成關閉，無 deadline 或強制 kill。19:51:13 驗證新版本後恢復佇列；failed 維持原有 7 筆，ID 比對無新增失敗。暫停期間約 97 秒，沒有中斷執行中的爬蟲任務。

部署並非網站零停機：前端重啟約 19:50:26–19:51:00 出現 unavailable；舊 gateway 關閉 exit 1，替代程序隨即健康。正式頁面部署後回應 200。直接 Tailscale IP 的 18130 未公開，因此未提供該 preview 連結；不把主機端檢查宣稱成使用者機器驗證。

## 使用者追加：摘要 metadata（第二批，eecd30e 已部署）

新增 `summary` 與 `summarySource`，保留媒體原文，來源優先序為經核對的文章摘要區、同篇 JSON-LD abstract、summary meta、description meta，及原 feed 摘要。以來源欄位區分編輯摘要與 SEO／feed 說明；沒有證據不從正文首段生成摘要。公視兩篇 830328、830312 的 `.post-article > .articleimg` 已核對並原頁重播，正文／署名／發布時間不變。

包含 feed、discovery、正文更新、專題文章入庫、文章 API 與摘要搜尋，以及品質抽樣欄位。摘要隨既有內容快取封存／清除／還原；舊 v1 封存檔沒有摘要欄位仍能通過原始雜湊驗證並還原為 null。migration 0019 只新增兩個可空欄位，指定 ALGORITHM=INSTANT、LOCK=NONE；正式資料庫於 20:53:56 完成遷移，20:55:46 部署摘要功能並恢復佇列。

摘要驗證：獨立可丟棄 MariaDB 11.4（loopback 23327、tag_test）實際跑過 0000–0019 migrations 與一般正文入庫；完整測試 1,360 通過、2 項跳過。這不是對正式資料庫執行測試。整合測試原有 fixture 將發布時間等同抓取時間，卻期待可判定相似文章先後；基線版本也重現失敗，調整 fixture 為明確早於抓取的發布時間，未改動正式判定規則。


## 第二批新增署名修正（已部署並回填）

20:00 抽樣原頁確認民視 45511072 的開頭署名為「社會中心／王毓珺 黃柏榕 新北市報導」，原本只保留公司名稱。新增嚴格的新聞中心／姓名／地點報導格式辨識，回放取得兩位記者，正文及發布時間不變。聯合新聞網 45515275 的「中央社／台北7日電」改為中央社機構署名，排除電稿地點日期；沒有憑空補上記者。聯合新聞網 45503873 的洪子凱、邱書昱與發布時間原本正確，回放維持不變。兩筆既有署名已於第二批部署後經備份及競態檢查完成修復。

摘要上線前另回放本輪 259 份可讀 HTML，核對到網站固定宣傳詞、空白格式不同的重複標題、純記者／編輯台署名被當成摘要。新增精確排除與標題空白正規化；賴傳媒、青年日報改採文章專屬 og:description。16 份回放結果因此改變，228 份仍有媒體提供的摘要或 description；這是自動回放數，並非 259 份全部人工驗證。保留帶署名的正常摘要全文，不因開頭有記者姓名就丟棄。

第二批亦新增台灣好新聞頁首署名／發布时间選擇器。45489695 正確取得葉志成；45489696 保留生活中心／綜合報導機構署名。兩篇正文原頁回放相同，時間與既存值一致；826 項 crawl 測試與型別檢查通過，兩筆既有署名 fresh-source dry-run 通過，第二批已回填並回讀驗證。

遊戲基地 45491735 的發布時間在抓取時仍位於未來；頁面與官方 RSS 同樣宣告 UTC，頁首只有日期。未取得獨立時區證據前不擅自扣除八小時，列為來源時間疑點，後續持續核對。

## 20:38 階段紀錄（非最終報告）

已完成 4 輪：632 份抽樣、3,012 篇母體、194 家媒體；其中包含觀察前一小時基線。正式逐項核對紀錄 91 筆、57 家媒體，包含先前已完成的兩筆公視摘要核對。自動抽樣數不能當成全部人工驗證數；每筆紀錄明載只看過哪些欄位。鏡新聞的 96 字文章已證明是完整影音簡介，短文提示不等於截斷；MSN、PNN 的一般 HTML 是應用程式外殼，不能因原頁重播沒有正文就清除已透過專用資料來源取得的內容。

第二批待發布內容已整合至獨立工作目錄，正式環境仍是 `2e2f053`。原訂不早於 20:51:13 批次部署；先暫停新工作領取並等待執行中工作結束，再執行已測試的摘要遷移與服務更新。抽樣程式會偵測摘要欄位是否存在，避免遷移延後時中止觀察。發布後將核對三個服務的實際 release、worker 健康、公開 HTTPS、佇列恢復、遷移雜湊，以及兩篇公視摘要的原文／資料庫／API 一致性。

第二批既有資料處理已完成預演，尚未套用：

- 9 筆署名：民視、聯合新聞網、台灣好新聞、Focus Taiwan、梅花新聞網、台灣線報、創新聞；重新抓原頁核對，沒有抓取失敗。
- 11 筆 metadata：6 篇端傳媒標題移除混入的分類／會員提示／摘要／署名／相對年齡；5 篇 yam、LINE TODAY、阿波羅補明示內容提供者。保留原發布時間，限定原始快照符合時才能寫入。
- 2 篇公視摘要回填：正式部署後再次抓原頁，核對編輯摘要選擇器與正文狀態。
- 2 筆 Heho 舊首頁誤入文章資料與其 9 筆標籤索引：目前沒有來源、封存、引用、相似配對或事件關聯。只針對已確認 ID，先同步落盤備份，再比對快照與依賴，才清除。現行探索規則重播會排除這些根網址，當前 RSS 10 篇也沒有首頁連結，因此不額外改爬蟲規則。

20:25–20:26 的正式環境複查：worker PID 260686、release `2e2f053` 健康，佇列未暫停、失敗仍為基線 7 筆且無新失敗 ID；每小時爬取工作仍在運作。首頁主機端回應 200，未宣稱使用者機器驗證。

待釐清的來源差異包括遊戲基地宣告未來 UTC 時間、MoneyDJ RSS／原頁 47 秒差異，以及端傳媒舊資料日期精度；這些不以推測時間覆寫。最終報告需在完整觀察期結束、最後時間窗採樣與修復驗證後完成。


## 第二批實際發布與驗證（20:55–21:00）

`eecd30ec8dd2c6f786936c51d9fc73a7c5a77f2f` 已推送並部署。GitHub Actions 37622866591 的後端／前端工作全部成功：1,365 項測試通過、2 項跳過，型別、Biome、gitleaks 與前端建置通過。這次含可丟棄 MariaDB 的整合測試；第一批 CI 所遇到的既有測試資料日期問題已於摘要提交中修復並驗證，未改動正式相似度方向判定規則。

20:51:22 暫停領取新工作；正在執行的文章擷取及專題整理自然結束，20:53:52 active=0。20:53:56 完成精確的 0019 遷移，20:55:21 worker 收到 SIGTERM 並正常關閉，未強制中斷工作。20:55:46 完成服務驗證並恢復佇列，總暫停約 264 秒；排程保留，失敗仍為原有 7 筆，沒有新增失敗 ID。

本次也不是網站零停機：日誌出現 20:55:04、20:55:08 前端 headers timeout，以及重啟期間 20:55:21–20:55:44 的連線失敗。舊前端於 20:55:45 結束（exit 143），替代程序正常。三個服務的執行路徑均確認為 eecd30e；worker 健康，正式 HTTPS 首頁回應 200。驗證位置是開發主機，未聲稱使用者瀏覽器驗證。

第二批資料修復全部完成並回讀驗證：9 筆署名、11 筆標題／來源 metadata（含引用衍生索引）、2 篇公視摘要，以及備份後清理 2 筆 Heho 誤收首頁與 9 筆標籤。公視兩篇的摘要分別為 118、105 字，來源為 `article:selector`；資料庫與公開文章 API 均吻合原頁。所有修復均保留原資料備份，無競態覆寫、抓取失敗或額外刪除。

另抽查自然取得的新唐人亞太 45606669、聯合早報 45606562、PChome 45600449；它們在 20:55:55–57 自動入庫，非人工回填。重新請求原頁後，儲存摘要與媒體 description 逐字一致，來源正確為 `meta:description`，未混稱為編輯摘要。正式逐項核對紀錄增至 94 筆。21:00 抽樣已啟動，使用 eecd30e 與摘要欄位；尚未完成的這輪不提前計入總數。

完整證據見 artifacts 中 `batch2-deployment.json`、`batch2-live-verification.json`、`batch2-row-repair-verification.json`、`batch2-authors-and-cleanup-verification.json`、`batch2-natural-summary-verification.json` 及原始備份。

## 第三批待發布：AMM 轉載署名及來源

21:00 抽樣中，AMM 45559582、45559584 的開頭明示「商傳媒｜方承業／綜合外電報導」「商傳媒｜吳承岳／台北報導」，但入庫署名與內容提供者為空。補上商傳媒署名格式及限定 AMM 正文首段的來源辨識；兩份原 HTML 回放正文、發布時間不變，取得正確人名及商傳媒引用來源。828 項 crawl 測試、型別檢查通過，兩筆來源回填計畫預演成功。此節修正尚未部署，既有資料也尚未回填；不早於 21:55:46 累積批次發布。

第三批另補新唐人亞太文末署名：45606669 為黃亮戩、林嘉韋、邱春蓉；45606668 為池千里、陳玲芝。原頁 `<br>` 讓署名與最後一段合併，新增限定發布者前綴、報導地點與文章結尾的辨識，排除引述及非文末人名。兩篇正文、發布時間、摘要回放完全相同。829 項 crawl 測試與型別檢查通過；尚未部署或回填。

21:00 抽樣於 21:06:30 成功完成：238 篇樣本／1,204 篇母體、129 家媒體，程序錯誤為 0。累計 5 輪共 870 份樣本／4,216 篇母體（仍含起跑前基線），逐項核對紀錄 97 筆。下一輪 22:00；完整 24 小時觀察尚未結束。

### 第三批追加核對（21:14，尚未發布）

新浪兩篇原文首段分別標示「來源：中国新闻周刊」與「來源：懂球帝」，其中一篇文末明列「记者：王晨晨」。新增限定文章網址與正文容器的來源解析，以及完整署名格式比對，避免把一般敘述或推薦內容當作者。兩篇原始 HTML 重播確認正文、時間與摘要不變；830 項爬蟲測試通過。證據為 `batch3-sina-replay.json`。資料補正計畫尚待加入這兩篇來源及王晨晨署名。

台灣好新聞 45559208 於第二批部署前取得，原文記者為季大仁，現行解析已正確；加入下一批署名補正。引新聞 45558758 原網址轉至首頁，Miin 45558768 為 API 取得資料而網頁為應用程式外殼，均不以本次空白正文回應覆蓋既有文章。

21:20 追加摘要檢驗：觀策站 134751、45573019 的 description 僅站名、og:description 僅作者職稱姓名；觀傳媒 45573381 兩份 description 都截在記者署名中。三篇均排除為空摘要，不自行摘取正文代替。觀傳媒 45573382 包含署名後的新聞內容，仍保留正常摘要。230 份原始頁面重播僅上述三筆摘要改變，正文未變。原資料摘要皆為空，無須歷史資料改寫。

第三批資料試跑已擴充為 4 筆來源及 6 筆署名，均通過且尚未套用。懂球帝官網的媒體名稱及天津 ICP 登記已核對，補上來源識別；中国新闻周刊保留原文來源名稱，國別尚未在本輪獨立確認，維持未知。第三批固定於 21:55:46 後才發布，版本與 CI 檢查未通過就不更新。

21:24 核對東森 45554424：推薦新聞與授權聲明皆使用 `.rss_box`，原解析選到前者，漏掉 CTWANT 來源。改為只選明確含授權轉載聲明的區塊，原頁重播確認來源修復、正文／摘要／時間不变；另一篇中央社轉載維持正確。第三批來源補正擴為 5 筆，試跑通過。中央社 45573675、德國之聲 45573450 的署名與摘要核對相符；前者時間差 22 秒保留待查精度來源，後者毫秒差符合資料庫秒精度。德國之聲「德正」為原文宣告的集體筆名；正文另有網站頁尾文字，未據此宣稱全文皆已清理。

21:32 LifeNews 45559046 重試由 HTTP 502 恢復為 200；原文首段以連結明示商傳媒，署名葉安庭／綜合外電報導。補上限定正文首段的來源解析，重播正文、時間、摘要均不變，第三批擴為 6 筆來源、7 筆署名補正，皆已有試跑依據。

統計口徑核對：前五輪 870 個不重複樣本涵蓋 204 媒體，其中 299 個取得時間位於觀察前基準區間、571 個在觀察期間。原始取樣回應有 841 個可解析、26 個非 200、3 個逾時；`round.errors` 未計入逐篇失敗，不能用空陣列聲稱全部頁面成功。重試恢復另外保存，不抹除當時失敗紀錄。

21:37 再查自然入庫摘要：德國之聲 45650834 的摘要與原始 description 完全相符。禁聞網 45653101、45653098 分別把商品折扣與頻道介紹當摘要；加入限定網站、明確模板的排除規則，另一篇含實際節目議題的 45653099 保留。準備兩筆摘要清除工具，正式操作前再取原文確認、比對快照並備份，只清除已核對的不合格摘要，正文不動。

## 第三批實際發布與驗證（21:55–22:00）

`b2d7fba79d5523649ae0c25f4760f80691ef5a32` 已推送並部署。CI 37629919626 後端與前端均成功，1,374 項測試通過、2 項跳過。第三批包含 AMM／LifeNews 商傳媒署名與来源、新唐人亞太文末署名、新浪提供者與記者、東森授權聲明選擇、懂球帝來源識別，以及觀策站／觀傳媒／禁聞網的不合格摘要排除。

先前正在執行的 `topics` job 已自然完成（21:54:44.609）；21:55:54.072 暫停新工作領取時 active=0，13 個 delayed 排程保留。21:56:57 worker 收到 SIGTERM，21:56:58 正常停止與替換；21:57:17.827 完成驗證並恢复派送，暫停 83.755 秒。正式核對時沒有新增失敗 ID，worker、gateway、web 的工作目錄均為 b2d7fba，worker 健康且公開首頁回應 200。

網站並非零停機：主機端探測於 21:56:59、21:57:04 等時點收到首頁 503，21:57:15 回復 200。部署前 21:54:29 曾有一次 3.5 秒探測逾時、21:54:44 已回復，另一次 curl 核對為 200／0.52 秒；該次不歸因於部署。探測間隔約五秒，不能聲稱精確停機長度，亦未聲稱使用者瀏覽器驗證。

資料補正：6 筆來源及全部引用衍生索引回讀相符；7 筆署名重新取原文後套用，全部相符，0 抓取失敗、0 競態。禁聞網 45653101、45653098 兩筆廣告／頻道介紹摘要再次核對原文後清除，僅更新摘要欄位，資料庫與公開 API 均確認為 null。每筆皆有先落盤備份，其他快照欄位與原時間不變。公視兩篇摘要經此次部署後 API 再驗證仍與原文相符。

證據：`batch3-deployment.json`、`batch3-live-verification.json`、`batch3-wait-continuity.jsonl`、`batch3-service-transition.log`、`batch3-service-probes.jsonl`、`batch3-repairs-verification.json`、`batch3-promo-summary-applied.json`、`batch3-promo-summary-api-verification.json`，以及三份 batch3 原資料備份。

## 第四批累積中（尚未推送或部署）

草根影響力新視野 45558641 明示「小丞」筆名而漏抓，加入限定文章頁首作者列規則，另以 45558642 驗證不會把 myhousing住展帳號蓋過梁愷恩。中華新聞雲 45559260／45559264 使用 Unicode division slash「∕」，補上正規化後取得翁聖權／翁順利。波新聞 45558871／45558875 的 description 是固定網站宣傳詞，排除後改用文章專屬 og:description，保留林冬生／陳瑩署名。所有原頁重播正文與時間不變，838 項爬蟲測試通過，3 筆署名 fresh-source dry-run 通過。

以上先在獨立分支完成，再於第三批部署驗證後整合回主稽核工作目錄；目前尚未推送或部署。下一次部署不早於 22:57:18，避免頻繁重啟。22:00 抽样程序已啟動，仍使用正式 b2d7fba；等待完成後才計入新一輪結果。完整 24 小時觀察尚未結束。

22:11 更新：22:00 輪於 22:07:44 完成，新增 242 個樣本／1,064 篇母體，累計 1,112 個樣本／5,280 篇母體（含先前基準資料；不代表全部人工核對）。新增七份欄位人工檢驗記錄。

草根影響力 45639987 的日期與健康醫療網記者署名混入標題，新增限定格式分離標題、黃嫊雰署名，並由頁首 `/author/healthnews/` 確認來源。45639985 頁首王清厚署名漏抓；description 截在年份，og:description 則等同整篇文章，排除兩者後保留空摘要。波新聞 45640308／45640309 已存入全站介紹，準備以文章專屬 og:description 替換；中華新聞雲 45640579／45640583 的 division slash 署名解析修正；禁聞網 45653096 只有商品連結的摘要改為空。

七篇原始 HTML 重播正文與刊登時間皆不變。840 項爬蟲測試與型別檢查通過。7 筆署名重新抓取原文試跑全部成功；1 筆標題／來源快照補正試跑通過；4 筆摘要補正亦重新抓取原文確認，包含 2 筆替換及 2 筆清除。所有補正尚未套用，腳本要求部署版本相符、快照未變並先備份。下一批仍不早於 22:57:18 發布。

22:16 追加：中華鱻傳媒（ccsn0405）45640434／45640433 的首段位於 `.post-body` 的直接文字節點，原解析只取得後續 `<p>`，連帶漏掉于郁金署名。新增限定文章路徑的完整容器解析；重新抓取兩份原文確認首段恢復、舊正文全部保留，摘要與時間不變。署名補正另加入是新聞 45640091，其原文「商傳媒｜簡明心／綜合外電報導」與現行解析相符，資料仍為品牌帳號；第四批共 10 筆署名試跑通過。

45640434 已有與 PChome 45525636 的相似關係，常規補正工具正確拒絕直接修改正文。另準備限定此文章與配對的操作：比對完整文章／配對／另一篇正文快照，備份後以正式演算法重算原配對，並重新安排文章 sketch 建索引。新增完整首段後 Dice 分數由 0.5018359853 升至 0.6920700309，關係仍成立。此操作 fresh-source dry-run 已通過，尚未寫入；另一篇無現存配對，可用原補正工具。資料補正仍待候選版部署。

## 第五批累積中（第四批候選固定後，未發布）

第四批候選 `b385f4293e5ca8a140acfbb81b67ab1729cbd422` 已推送，CI 37635310052 全部成功：1,381 項通過、2 項跳過；本地 841 項爬蟲測試通過。發佈 timer 固定於 22:57:18，執行前會驗證同一 SHA 與 CI，再等待 active jobs 自然完成。22:20 正式環境仍為 b2d7fba，第四批尚未部署或套用補正。

健康醫療網 45641553 的首頁相同 URL 有多個卡片，其中一個把「過敏」分類 badge 包在標題連結內，列表選較長文字而污染標題。新增 `.a1-title, .a1` 只讀標題並以文章 h1 解析正式標題；最新首頁 69779 與原始文章 h1 一致。另兩筆舊樣本 45409715／45490677 有分類與截斷標題，已重新取原文準備三筆僅改標題的補正，快照試跑成功。

是新聞 45640094 的分享描述僅截斷《圖說》，沒有文章專屬摘要，新增網站限定排除；大成報 45640161 的兩份 description 僅「【大成報記者林瑞明/台北報導】...」，擴充既有純署名排除以涵蓋省略號。兩篇重新抓取原文確認後準備摘要清除，試跑成功。署名及正文不變。

843 項爬蟲測試、型別與格式檢查通過。全部 1,072 份可解析原始頁面以第四批／第五批解析器重播比對，仅三篇健康醫療網 title 與兩筆已核對 summary 欄位改變，所有正文與刊登時間不變。另補核對六個媒體署名：鉅聞天下李蘭妮、今周刊鄭鴻達、匯流新聞網謝東明、報新聞袁青、FTNN 吳峻光、巴哈姆特 RU，均有原頁明確署名證據。此為指定欄位人工檢驗，不宣稱每篇全欄位皆正確。

證據：`batch5-healthnews-yesmedia-replay.json`、`batch5-all-sample-replay.json`、`batch5-reviewed-row-plan.json`、`batch5-row-repair-dry-run.json`、`batch5-reviewed-summary-plan.json`、`batch5-summary-dry-run.json`、`round6-six-media-original-proof.json`。第五批先在 followup 工作目錄保存；第四批安裝工作目錄保持固定候選。第五批發布需等第四批實際完成後再相隔約一小時。

## 第四批實際上線與補正（22:22–22:33）

22:29 驗證公視新文章時發現，另一項 logo 更新已於 22:22 切換正式版為 `c76f53036ff3539e84227d643d99a1ad7f6cdb86`。該版為 b385f42 的後續 commit，爬蟲、jobs 與 DB 程式完全相同，包含全部第四批修正，CI 37636008727 成功。原定 22:57:18 的第四批 timer 已取消，避免重複部署；並未執行本稽核的第四批 drain／安裝 wrapper。這次部署由另一項工作執行，本稽核沒有其逐 job 排空及網站探測證據，因此不宣稱全程零中斷。

22:30 主機端驗證 worker、gateway、web 全部指向 c76f530，worker PID 401823、健康回應正常、公開首頁 200、佇列未暫停、13 delayed、0 active、無新增失敗 job ID（仍為 7 個基準失敗）。服务切換 journal 已保存，worker 於 22:22:26 正常 SIGTERM／停止，新服務随后恢復。

第四批補正已套用並備份：10 筆署名均重新抓取原文成功，0 抓取失敗／0 競態；45639987 分離健康醫療網署名附註的標題，其既有健康醫療網 attribution 與引用索引原本已正確，保留並核對，沒有額外來源改寫。中華鱻傳媒 45640433／45640434 恢復首段，完整保留其他快照欄位；後者與 PChome 的既有配對按正式演算法更新至 0.6920700309。兩篇 sketch 已清除並安排自然重建，22:32 尚待排程完成。

摘要共 4 筆：波新聞 45640308／45640309 改為文章專屬 og:description，草根影響力 45639985 與禁聞網 45653096 清除無效摘要。公開 API 與資料庫回讀均相符。全部補正於 `verify-batch4-repairs.mjs` 通過，索引完成仍須另行追蹤。

新公視 45618788（13:13:32Z 取得、13:27:05Z 抓正文）自然寫入 95 字編輯摘要，原頁 `.post-article > .articleimg`、資料庫與公開 API 完全相符，不是手動回填。

證據：`batch4-live-verification.json`、`batch4-external-service-transition.log`、`batch4-row-repair-applied.json`、`batch4-paired-body-applied.json`、`batch4-author-repair-applied.jsonl`、`batch4-summary-applied.json`、`batch4-repairs-verification.json`、4 份 batch4 原資料備份、`round6-natural-pts-summary-verification.json`。第五批現仍僅本地保存，發佈間隔改以新正式版觀測驗證時間起算，最早 23:30:46，避免重複重啟。

22:35:51 自然 similarity 排程已完成兩篇正文重新建索引。回讀 45640433／45640434 的 chars 分別 803／523，sketch bytes 與以當前完整正文重算的 minhash 完全一致；既有 PChome 配對分數仍為 0.6920700309。證據 `batch4-natural-reindex-verification.json`，無需額外重啟 worker 或強制另開索引 job。第四批資料補正驗證完成。

22:36 覆蓋口徑：1,112 自動樣本／212 媒體；152 份人工記錄涉及 151 篇不同文章、85 個媒體，其中 147 篇屬取樣集合。人工檢驗含局部欄位及待查項目，不把全部自動樣本算成人工驗證。

## 第五批擴充驗證（23:02，仍未發布）

鳳凰網文章 45640507 明確以新華社開頭電訊格式署名「王作葵、刘恺」，45640508 以獨立「文 张红日」署名，原本只有媒體品牌。新增嚴格限定的署名規則，排除內文提及記者、編輯或一般敘述。鳳凰網限定文章路徑與正文容器，同時讀取頁首明示來源；新華社與觀察者網加入明確 attribution，觀察者網國別沿用既有媒體登錄資料。環球科學／天下事只保留原頁 provider，身份尚未確認，不猜媒體或國別。

梅花新聞網八篇樣本原先以污染或截斷的頁面 title 作標題，改取文章 h1、限定 #articleContent；八篇原文正文與刊登時間保留。Roomie/ELD 45443794、45596329 的作者自介被混入正文，僅排除有 roomie.jp/writer/ 連結的作者框，普通 inset 框仍保留。鳳凰網 45478470、45640508 僅移除末尾 286 字平台聲明，原敘事全文保留。

最新本地測試 870 項通過，型別與 Biome 檢查通過。全部 1,072 份已解析原頁與不可變正式 c76f530 重播，19 篇欄位改變（包括僅 provider/選擇器來源變動），刊登時間全部不變。每項改變均檢查；不把自動差異當成品質結論。

第五批資料補正計畫共 15 筆常規資料（11 標題、3 正文、1 attribution）、另 1 筆有既存配對的鳳凰網正文／attribution、2 筆署名、2 筆摘要。再次抓原文與快照試跑通過，尚未套用。有配對的 45640508 將以正式演算法重算兩個既存關係，分數分別由 0.7564469914／0.7420594780 改為 0.7939849624／0.7775891341，兩個配對仍成立；四篇正文都須追蹤自然 sketch 重建。任何寫入前須保存原始資料備份。

人工檢驗記錄更新為 170 份、169 篇不同文章、92 個媒體，165 篇屬自動樣本；含局部欄位與未解項目。另核對工商時報傅秉祥、天下編譯樂羽嘉、火報組織署名及葛瑪蘭三名記者，指定欄位有原文證據。23:00 定期取樣正在執行，尚未計入完成輪數。24 小時觀察仍待 10/8 18:49:13 到期。

證據：`batch5-final-all-sample-replay.json`、`batch5-ifeng-all-sample-proof.json`、`batch5-expanded-fresh-proof.json`、`batch5-final-ifeng-proof.json`、`batch5-final-crawl-attribution-tests.log`、`batch5-final-tsc.log`、`batch5-final-biome.log`、`batch5-row-repair-dry-run.json`、`batch5-two-authors-dry-run.jsonl`、`batch5-summary-dry-run.json`、`batch5-paired-body-plan.json`、`review-coverage.json`。

## 第六批累積（23:16，未推送或部署）

第五批候選 `17d6bde24d856d5abb08e638452a6747e63cece1` 已推送；CI 37641834399 成功，1,390 項通過、2 項跳過，web 建置、型別、Biome、秘密掃描通過。固定該候選的第五批 timer 排在 23:30:46，執行前還須確認正式版仍為 c76f530、候選與 origin/main 相符，再排空 active jobs。23:16 尚未部署，所有第五批資料補正仍未套用。

23:00 輪於 23:05:36 完成，新增 206 樣本／1,027 母體。累計 1,318 個不同樣本／6,307 篇不同母體、218 媒體；299 樣本屬觀察前基準，1,019 屬 24 小時觀察期間。1,267 原頁可解析、44 次非 200、7 次請求例外。不能把 `round.errors=[]` 當成零抓取錯誤。

太報六篇 `/specialtopic/content/<topic>/<id>` 專題文有 `.container > .special-text2` 正文，原來源僅 `.news-box-text` 因而漏抓。加入限定路徑與容器，配合來源設定接受專題容器，取文章 h3 去除網站尾綴與列表作者前綴；直接文字、nested paragraphs 及小節均保留，排除頁首刊登列及其他推薦文。六份原文取回 4,424／970／583／664／973／626 字正文，署名、刊登時間、summary 與引用均不變。

六筆資料都重新抓取原文、完整 DB 快照試跑確認；原 body null、body_status missing、content_archive_hash null，沒有既存 sketch 或相似配對。這是確定的解析漏抓，不是恢復遭封存清除的正文。限定補正腳本須 live SHA 相符、原快照未變、無封存及配對，先落盤備份，只改 title/body/body_status/body_source，重新安排自然索引；不改取得時間，也不繞過公開全文七日規則。目前尚未寫入。

鳳凰網 45709872 及新浪 45709996 末尾明示「红星新闻记者 周月潇」，品牌帳號誤當作者，加入限定末尾署名及最多兩列編輯／審核規則，不搜尋敘事中的記者提及。AP 45711388 原頁是 Linley Sanders、Sarah Jane Tribble、Ali Swenson、Fatima Hussein，45711389 是 Kaitlyn Humani、Barbara Ortutay；原 metadata 卻分別為機構及網站帳號 Dominic Hurry。限定 AP 文章路徑的 `.post-meta > .author` 及明示機構尾綴，正確分出撰稿人。姊妹淘 45409438／45490422／45711098 作者列把「綜合報導」當姓名，改取陳知微／黃語汐／周昭安，保留正常組織或非該格式署名。

第六批 854 項爬蟲測試通過，型別與 Biome 通過（既有 String.raw info 提示未變）。全部 1,267 原頁與固定第五批解析器重播，僅 13 篇改變：6 太報標題／正文、7 署名；刊登時間與摘要全部不變。8 筆署名 fresh-source 試跑：7 需改、1 原本正確、0 不可取得、0 競態。另核對 SCMP Matthew Cheng、Tatler Edgar Chang 的可見作者連結，TVBS 羅凌筠的同篇結構化宣告。只宣稱指定欄位，沒有宣稱全文正確。

人工記錄目前 186 份，涉及 185 篇、98 媒體，181 篇屬樣本；含局部／未解項目。第六批在独立 `tag-crawler-quality-batch6-20261007` 累積，以免改動已排程的第五批 checkout。發布須待第五批實際部署後相隔約一小時。

證據：`batch6-all-sample-replay.json`、`batch6-taisounds-original-replay.json`、`batch6-taisounds-reviewed-plan.json`、`batch6-taisounds-dry-run.json`、`batch6-expanded-authors-dry-run.jsonl`、`batch6-seven-authors-plan.json`、`batch6-final-crawl-tests.log`、`batch6-final-tsc.log`、`batch6-final-biome.log`、`round7-five-media-byline-proof.json`、`sample-outcomes.json`、`review-coverage.json`。

23:26 第六批追加：大愛文章頁其實也內嵌與首頁相同的新聞 JSON；依 URL NewsID 只讀對應記錄、不執行 JavaScript、不取推薦篇。45639979／45639977 取出正文 1,038／988 字，与既有正式正文逐字相符；原來一般文章頁抽查為空，但正式 specialized discovery 已存有正文。追加共享一般文章解析支援，使後續署名 refresh 也能核對原頁。兩篇末尾明示張慧珍、拉梅什、陳榮豐（尼泊爾報導）及蔣邦彥、鍾江波（花蓮報導），新增嚴格完整結尾格式，若有「│製作」只取前段報導人名。兩筆 fresh-source 署名試跑通過。

大愛 description 等同全份逐字稿，新增原文全文一致時排除為摘要；保持独立 description 的摘要正常。兩篇正式 summary 已經 null，因此無摘要清除或正文回填需求。第六批資料署名補正計畫增至 9 筆；6 太報正文計畫不變，全部未寫入。最新 858 項爬蟲測試、型別、Biome 通過；1,267 原頁完整重播共 15 篇改變，刊登時間全部不變。大愛的兩篇只是一般解析結果與先前 specialised pipeline 對齊，不宣稱修過既有正文。

Bnext 44696550、早安健康 45595849 是 topic／special landing，標題與描述具有文章專屬意義，沒有可確認記者或刊登時間；正文是否有可用獨立導讀仍待 specialised 檢查，不以 generic missing 判定文章漏抓。新增原頁欄位檢驗記錄，證據 `batch6-daai-and-landing-review-proof.json`、`batch6-daai-author-dry-run.jsonl`、`batch6-daai-second-author-dry-run.jsonl`、`batch6-nine-authors-plan.json`。23:24 已啟動第五批部署前後服務探測，session 56466，預計 23:43 結束，探測非終端時不得重啟或另开副本。

## 第五批實際上線與完整驗證（23:30–23:42）

候選 `17d6bde24d856d5abb08e638452a6747e63cece1` 於 23:32:34.538 安裝成功並恢復派工。23:30:52.813 暫停新派工，active 已為 0，排空在同秒完成；新派工暫停 101.725 秒。先前爬蟲 `repeat:crawl-hourly:1791386636639` 已於 23:29:32.390 自然完成，queue job 狀態 completed、attemptsMade 1，沒有複製／重啟該 job。初次正式驗證 worker PID481094、gateway481575、web481548 均指向候選；首頁200、worker健康、queue未暫停、無新增失敗 job ID（7個基準失敗）。公視兩筆摘要 DB／API 再核對原文相符，schema migration 未重做。

網站可用性與 job 排空分開記錄：196 次主機側探測中，23:32:16／21／27 回應503、23:32:33回應502、23:32:38恢復200；五秒左右探測節奏不能推算精確停機秒數。23:31:34 build 期間另有首頁 timeout；23:25:39 worker health 單次 timeout 發生在更新前。後續外部部署期間23:33:43／23:37:12亦有首頁 timeout，最後23:42:59首頁200、worker健康。沒有使用者機器上的瀏覽器驗證，不宣稱网站零停機。

資料補正：15 常規筆（11標題、3正文、1新華社 attribution）在重新抓取原文確認後套用；另鳳凰網45640508正文／觀察者網 attribution與兩個既存配對一同備份後更新，兩個分數0.7939849624／0.7775891341仍成立。兩筆署名王作葵、刘恺／张红日 fresh-source套用，0不可取得／0競態；是新聞45640094及大成報45640161清除圖說／纯署名省略摘要，資料庫及公開API均null。`verify-batch5-repairs.mjs` 核對全部修正欄位及其他快照欄位相符，citation衍生索引也相符。四份 durable 原始備份已保存。

四篇正文於23:35:48自然建索引，23:36:42回讀驗證 sketch bytes 與正式 minhash 重算完全相符，chars1137／752／828／2905，兩個既存配對分數未被覆蓋。沒有為補正強制重跑或中斷 similarity job。第五批資料補正及索引驗證完成，後续不用重做。

同時有其他網站工作切換服務：23:33正式版改為 `bc4be106f09bed1aa37e31f854f91691f2db2072`，其後為 `6868b8ba1243248930315c7876931aae65e37af1`。兩版都是候選17d6bde的後續，crawl/jobs/db/similarity程式差異為空。原配對補正當遇live SHA變動時在任何寫入前拒絕操作，確認代碼相同且現行三服務／API正常後才按新SHA套用。bc4版CI37644775031成功；23:40再次驗證6868三服務、首頁200、worker健康、queue未暫停、無新增failed IDs。外部服務切換沒有本稽核逐job排空證據，不宣稱其零中斷。外部網站提交已保留；第六批重基底至6868，仍未推送或上線，下一批不早於00:40:02（以最新觀測驗證時間保守間隔一小時），發佈前重查正式版。

證據：`batch5-deployment.json`、`batch5-natural-crawl-completion.json`、`batch5-initial-live-verification.json`、`batch5-external-bc4-live-verification.json`、`batch5-live-verification.json`、`batch5-before-apply-fresh-verification.json`、`batch5-repairs-verification.json`、`batch5-natural-reindex-verification.json`、`batch5-service-probes.jsonl`、`batch5-service-transition.log`、`batch5-external-service-transition.log`，以及四份 batch5 原始備份。

23:44 第六批追加引用：鳳凰網45709873原文「据美联社和哥伦比亚广播公司等媒体报道」是明示聯合引用，舊規則因後面不是立刻「報導」而漏了美聯社。新增限定段首完整「據／根據＋列舉＋等媒體報導」格式，只把精確匹配的已知媒體標籤加入；CBS原名仍只是原文證據，不猜媒體鍵或國别，不把圖片來源或單純提及算引用。提供者新華社也有頁首明示，準備一筆來源／引用補正，重新抓原文確認正文、標題、時間不變，完整快照試跑通過，尚未寫入。括號結尾「海洋」沒有清楚角色標記，作者身份保留待查。

最新880項爬蟲／引用測試、型別與格式檢查通過；以不可變17d6bde正式release重播全部1267份原頁，第六批僅16篇改變（前15篇加一筆美聯社引用），刊登時間全部不變。計畫目前6太報正文／標題、9署名、1来源／引用，皆待下一小時批次。取樣未增加，最新人工紀錄209份（190篇不同文章、101媒體、186篇屬取樣集合），含局部／未解／重複驗證，不宣稱全部樣本人工合格。

## 午夜抽樣恢復與第六批擴充（10/8 00:14，尚未發布）

00:00 輪因資料庫 SELECT 超過 30 秒 statement budget 終止，確認 MainPID 0／failed 後才重新啟動唯讀抽樣 service；沒有重啟 crawler。原讀取以未索引取得時間篩選，改為 source/media/published covering index 取得全部 own ID，再每 500 ID 以主鍵分頁讀取精確取得區間，各頁有 30 秒上限及 10 ms 讓步；沒有新增 DB index，也沒有用 ID 新舊或刊登日期縮減母體。修正提交 `050b0a13cb081add73d6b52adef735f30fa32d68` 尚未推送，但抽樣 systemd 執行的 checkout 已使用它。

補跑窗口從原 cursor 23:00:00.498 到 00:03:51.233，沒有跳過取得區間。176,807 own candidates 中 1,182 符合區間，population scan 8,993 ms；00:08 後自然完成、service Result success。累計 8 輪、1,508 不同樣本／7,478 不同母體、221 媒體；1,209 樣本於觀察期間取得，299 屬之前基準。1,450 原頁可解析、47 非 200、11 請求或解析例外。證據 `midnight-sampler-recovery.log`、00:03:51 輪 selection/round.json 與 state.json。

ELLE 45559848 頁面 sailthru.author 與文章作者宣告均為 Christy Tung，新增明示 metadata 來源。遠見 45572290／45572292 頁首明示本文節錄自指定書籍、作者潘韞珊／吳錦珠及王小寧、出版社與以下為摘文；只匹配完整書摘作者宣告，不把一般書名提及或推薦框當撰稿人。三篇 fresh-source 試跑通過，正文與 DB 逐字相符；解析 title/date/summary 與既有 immutable release 相符，只計畫改署名，保留 DB 舊刊登精度、已清理標題及既有摘要狀態。

DW 六篇限定中文文章路径與主文章容器，讀取 author-details 的 extra-info 通訊社列；Felix Tamsut 等前綴人名不當通訊社，德正集體筆名沿用原署名。可確認 AFP/AP/Reuters 才加入既有身份；德新社只保留原始 provider，不猜 DPA 身份或國別。六篇移除兩段固定 Instagram 宣傳／著作權聲明，fresh HTML 與既有正式 parser 重播證明所有其餘段落順序／文字完全相同。正文 466／792／700／973／690／693 字，標題、署名、解析刊登時間與摘要不變。五個既有配對都有完整 pair/counterpart 快照與重算證據，仍成立，更新須連同原 sketch/citation/pair 備份後進行。

午夜新樣本另兩篇太報專題 45676868／45676876 同樣漏抓，重新取得正文 3,666／3,398 字，確認 missing、無 archive/sketch/pair，加入原六篇計畫，共八篇。最新 1,450 原頁完整重播相對不可變17d6bde共27篇差異，新增兩篇已核對，刊登時間不變。887項爬蟲／引用測試通過，tsc／Biome 通過（既有 String.raw info）。第六批計畫為8太報正文／標題、6DW正文（其中3增加agency attribution）、12署名、1鳳凰網引用；全部尚未寫入、未推送或部署，維持不早於00:40:02並於發佈前重查正式版及自然job排空。

證據：`batch6-extra-authors-original-proof.json`、`batch6-twelve-authors-plan.json`、`batch6-dw-reviewed-plan.json`、`batch6-dw-dry-run.json`、`batch6-taisounds-reviewed-plan.json`、`batch6-current-tests.log`、`batch6-all-sample-replay.json`。累計人工紀錄220份、196篇不同文章／101媒體，其中192篇屬取樣集合；包含局部欄位檢驗、待查及重複驗證，不宣稱全部自動樣本人工合格。24小時觀察仍持續至10/8 18:49:13。

## 午夜樣本擴充核對（00:26，仍未發布）

台視45766680原頁明示 datePublished／dateCreated 18:50:14+08、dateModified22:42:25+08，RSS pubDate卻等於後者，DB也存後者。已保存主RSS與完整HTML證據。增加僅台視啟用的 preferPagePublication，成功取文章時以合法原頁刊登時間取代RSS時間，並同步既有article_tags排名時間；普通媒體仍保留既有已知時間。pipeline整合測試實際驗證文章／排名標籤修正、dateModified不誤用及普通來源不變。該筆原fetch_status/body_status error、attempts1、archive null、similarity null，下一輪已有正常HTTP重試資格，等第六批上線後自然重試修正文／日期；不複製job。已準備獨立自然回讀計畫，尚未宣稱日期或正文資料已修好。

天天上新聞11篇以限定主文章 entry-meta time.entry-date.published datetime補足一般parser日期，fresh值全部與既有DB完全一致，沒有historical日期回填。45781233原頁〔焦點時報/記者蔡宗憲報導〕及新聞來源焦點時報明示；只保留原名與未知國別，沒有誤指認成今傳媒Focusnews。央廣四篇限定新聞引據欄位明示AFP／Reuters；45781400雖不足200字，確認原頁完整三段與DB一致，不因short狀態硬補正文。

新增完整段首觀傳媒地域新聞記者格式，確認奇異果5篇、觀傳媒2篇、是新聞1篇記者；台視末尾只取國際中心闕帝慈編譯，不列編輯洪季謙。全部原頁重播新增28篇欄位差異都逐一fresh核對，原文證據含lead、末尾署名、来源槽、圖說及日期，不把一般提及記者作署名。

摘要對指定合作媒體比對主文章實際figcaption／wp-caption-text，只有description以該完整圖說開頭才移除；若剩餘是足夠長的媒體原始新聞描述就保留，絕不從正文生成導讀。是新聞45477997保留原metadata中育碧新聞描述（DB之前為null）；45640091、45780443移除圖說與商傳媒明示署名保留新聞片段；45780442只剩被截斷的記者列，清為null。45477994原圖說後只剩「如」等短殘文，parser排除，但正式summary已null、不再寫入。四筆summary計畫重新抓原頁及完整限制欄位試跑通過。

第六批補正計畫累計14正文（8太報＋6DW）、22署名、6來源／引用（1鳳凰網＋4央廣＋1天天上新聞）、4摘要。署名fresh-source試跑及來源guard試跑已完成；正文配對計畫不變。最新版893項爬蟲／引用測試、tsc通過；全部1450原頁重播55篇欄位差異包含MKnews從missing補出的parser日期（DB未變），其餘解析刊登時間不變。人工記錄248份、222篇不同文章、105媒體，218篇屬自動樣本；仍是指定欄位及局部檢驗，非全部資料已人工驗證。部署前仍須等間隔、CI成功、現行版本驗證與自然job排空。

證據：`ttv-main-feed.xml.gz`、`midnight-selected-markup-proof.json`、`batch6-midnight-reviewed-proof.json`、`batch6-ttv-natural-retry-plan.json`、`batch6-expanded-authors-plan.json`、`batch6-22-authors-dry-run.jsonl`、`batch6-expanded-source-plan.json`、`batch6-expanded-source-dry-run.json`、`batch6-reviewed-summary-plan.json`、`batch6-summary-dry-run.json`、`batch6-expanded-final-tests.log`、`batch6-expanded-final-tsc.log`。

00:28 鏡報44942252已於00:17:47由正常crawler重試成功，正文247字、三段原文逐字相符，呂健豪與刊登12:06+08正確，summary也與原頁相符；00:25:50自然索引。没有人工寫入、沒有重新開job，原先body-blocked待查已由新證據解除。證據 `mirrordaily-44942252-midnight-retry.json`、原頁gzip、`mirrordaily-44942252-natural-retry-verification.json`。

## 第七批累積（00:38，獨立checkout，未發布）

目前仍保持第六批候選e4b5934與其checkout不變，00:40後程序先檢查main／正式版／候選與CI，再自然排空active job。第七批在獨立batch7 checkout累積，不能併入已固定的第六批安裝。

新增15篇原頁指定欄位核對涵蓋此前未人工記錄的14媒體：BAZAAR Kelly Hsiao、BEAUTY321 Jessie、苦勞網王顥中、放言中央社電訊黃麗芸、INSIDE Sisley、台灣華報任禮清、樂活新聞墨新聞记者卞金峰、明報機構署名、鏡週刊陳凱俊、NewMobileLife Doris、日本Yahoo文春組織署名、台灣新聞雲劉艾琳、new-reporter金東天。分辨真正記者、平台帳號與媒體機構，不把人名提及當作者，也不把歷史文章取得時間當刊登日。放言／台灣華報只確認日期精度到日，沒有任意補時分秒。INSIDE摘要含tag／slug，新聞開頭有意義，但是否有更乾淨獨立描述仍待查。日本Yahoo組織作者與文內採訪記者分開，尚未宣稱真實作者身份。

LIFE45780938明示「LIFE生活網記者-郭懿慧」，改署名郭懿慧；台灣新聞雲45780420明示「［中華通訊社］記者涂紹君/台北報導」，原小編帳號不能代替记者。增加嚴格角色／段首規則，只在明示完整格式取人名；中華通訊社原名不等同中央社/CNA。

台灣華報8篇 description全為「台灣華報」，ogdescription則是URL＋標題，同樣不能作獨立摘要；new-reporter45780478 description截在「【Lai傳媒、記者爆料網」，ogdescription截在姓名／台北報，兩個備援都排除。不能只排除第一description又接受同樣錯誤的備援。若真有文章專屬摘要仍保留。9篇fresh originals核對，兩篇summary已null，因此僅7篇待清；不重寫已正確資料。

第七批896項爬蟲／引用測試與tsc通過；1450原頁對第六批候選重播僅11篇欄位改變（8台灣華報摘要、1new-reporter摘要、2署名），正文／刊登時間不變。兩筆署名fresh-source試跑2changed／0unavailable／0raced；7摘要計畫有原欄位快照及fresh證據，尚未套用、推送或部署。人工累計264記錄、237不同文章、119媒體、233篇屬樣本；選定欄位與局部檢驗分開計數，不宣稱全樣本正確。

證據 `midnight-uncovered-media-proof.json`、`batch7-all-sample-replay.json`、`batch7-fresh-original-proof.json`、`batch7-reviewed-summary-plan.json`、`batch7-reviewed-author-plan.json`、`batch7-two-authors-dry-run.jsonl`、`batch7-crawl-tests.log`、`batch7-tsc.log`。

## 第六批實際上線與補正完成（00:40–00:48）

第六批e4b593451585e6f7c924e8400842c12806ea267d於00:40:04.998推送main，CI37653844756成功：1424passed／2skipped、web建置／型別／Biome／秘密掃描成功。00:41:27.257暫停新派工時active0，00:41:52.054恢復，新派工暫停24.797秒。三服務PID543978／544004／543977皆指向此版，首頁200、worker健康、queue未暫停，7個基準failed IDs無新增。公視兩筆118／105字的既有摘要重新抓原頁、DB／公開API相符；沒有重做schema migration。

爬蟲延續性證據：00:27曾觀察active hourly job repeat:crawl-hourly:1791390236639，其hourly group於00:28:25.524正常回傳、stopped0；文章group00:38:37.862、news group00:40:39.608完成且stopped0，部署pause時無active。指定completed queue record在事後已不存在，因此沒有捏造finishedOn或attemptsMade；保留workerjournal、pause counts與先前active快照作證。原source級HTTP失敗仍有發生，與queue job新增失敗分開報告。

主機側五秒服務探測持續到01:00：截至00:45，首頁探測皆200，00:41:51.450切換時一次worker health fetch failed，後續恢復200。抽樣節奏不能證明精確停機秒數或零停機；未測使用者機器瀏覽器。 sampler checkout在其MainPID0／成功後才fast-forward至正式e4b5934，保留050b0a1主鍵分頁讀取修正，下個01:00輪會用現行解析器。

14筆正文（8太報＋6DW）、22筆署名、6筆來源／引用、4筆摘要均按原文／snapshot guard套用，先保存原資料durable備份。來源衍生citation正確、五個既存DW配對重算仍成立。22署名fresh-source applied22／unavailable0／raced0；4摘要DB與公開API回讀逐字相符（其中一筆原null恢復原媒體metadata新聞片段、一筆清除截斷記者列、另兩筆去除圖說留原新聞片段）。00:45:49正常similarity排程已重建14份sketch；00:47:17回讀全部minhash bytes／正文chars與正式演算法重算相符，没有強制新開或重跑索引job。

台視45766680原失敗正文先在00:36:43由正常crawler retry成功，attempts2、完整490字与fresh original相同；當時仍為舊worker，因此RSS更新時間未修。新版上線後以獨立精確證據與完整備份將刊登22:42:25+08改為原datePublished18:50:14+08，同步3article_tags與1sketch刊登時間；同一日、既存配對0，其餘欄位／取得時間保留。00:47:23讀回正文、闕帝慈署名、日期與衍生日期相符；沒有手動恢復正文、沒有複製crawler job。

第六批資料與自然索引驗證完成，往後不得重做。第七批仍本地未推送，發布時間保守不早於01:42:33，發佈前重查現行版本。24小時品質觀察仍待10/8 18:49:13到期，報告是進行中版本。

證據 `batch6-ci-result.json`、`batch6-ci-test-summary.log`、`batch6-deployment.json`、`batch6-live-verification.json`、`batch6-natural-crawl-completion.json`、`batch6-crawl-job-journal.log`、`batch6-repairs-verification.json`、`batch6-natural-reindex-verification.json`、`batch6-ttv-verification.json`、`batch6-service-probes.jsonl`，以及TaiSounds／DW／source／author／summary／TTV-date六份原資料備份。

## 外部網站版更新與第七批重整（00:54）

第六批完成後，同時進行的網站工作另部署683c254與06512c989a094a43ed46fa1444bb34b05a8e8a5b。e4b5934到06512c9在crawl／jobs／db／similarity的差異為空；00:53:54主機側驗證三服務PID555292／555304／554772指向065，首頁200、worker健康、queue未暫停、active1、failed仍為基準7個。兩篇公視摘要再次與原文／DB／公開API一致。這是外部網站版包含已部署爬蟲修正的驗證，沒有重套第六批資料補正。

五秒探測實際記錄00:48:14.965首頁503、00:48:26.109首頁502，後續恢復200；外部切換缺少逐job自然排空證據，不能宣稱全程零停機或零job中斷。原第六批e4b初始驗證與外部065驗證分別保存，不能用後者替換原部署紀錄。

第七批已無衝突重整至065，仍未推送／部署／套資料。保守將下一次發布改為不早於01:53:55（一小時距最新live驗證），發布前須再查main與實際版本。重整後873項crawl測試、型別檢查及變更檔Biome通過；引用測試另列。

證據 `batch6-initial-live-verification.json`、`batch6-external-065-live-verification.json`、`batch6-service-probes.jsonl`、`batch7-post-rebase-tests.log`、`batch7-post-rebase-tsc.log`、`batch7-post-rebase-biome.log`。24小時觀察仍進行中。

## INSIDE摘要證據與第七批擴充（00:58）

45816975原description附有tags與slug，但同頁.post_introduction獨立導讀與og:description逐字相同。限INSIDE /article/數字-路徑優先取此導讀，記來源article:selector；description及正文、作者、日期仍保留原值。fresh原頁確認導讀與分享描述一致，為原站摘要而非從正文生成。另準備1筆summary及來源補正，與原7笔摘要排除及2笔署名同批發布；尚未推送、部署或套資料。

擴充後897項crawl／attribution測試、tsc與Biome通過，1450原頁重播12篇改變，只涉及摘要／來源及2筆署名，正文／刊登日期皆未變。8筆摘要fresh-source精確snapshot試跑全數通過。證據 `batch7-inside-proof.json`、`batch7-inside-summary-plan.json`、`batch7-expanded-summary-dry-run.log`、`batch7-expanded-tests.log`、`batch7-expanded-tsc.log`、`batch7-all-sample-replay.json`。

## 01:00樣本與第七批最終累積（01:11）

第9輪已正常完成，新增154樣本，累計1662篇／224媒體、8242筆不同取得母體；1600份原頁成功解析、51份HTTP非200、11份請求或解析例外。新增12篇原頁指定欄位核對涵蓋ENEWS、美麗佳人、新頭殼、NOWnews、法廣、漾新聞、好視新聞與新頭條等。ENEWS照片中的郭懿慧攝不能證明新聞作者；好視的政府帳號作者角色仍待查；美麗佳人正文尾部旅遊相關連結範圍待查，沒有宣稱全文已正確。

中華鱻傳媒主文章Blogger時間放在.post .post-timestamp的abbr.published[itemprop=datePublished] title欄，原parser為null；新增限定URL／主文章／明示日期欄規則。01:00兩篇page23:43:00／00:04:00+08，比DB保留的RSS23:43:23／00:04:59精度低，因此只補parser，沒有改DB日期、沒有任意補秒。鉅亨兩篇page無description但原feed摘要有意義；summary-differs自動旗標不等於錯誤，不清原feed摘要。

漾新聞三筆段首【漾新聞記者陳雯萍／高雄報導】明示writer，原organizationaccount漾新聞改為陳雯萍。法廣45855888明示「據彭博社援引消息人士報導稱」卻漏引用；新增完整限定cue與Bloomberg別名。重播另見天下45360694獨立資料來源列Bloomberg, Guardian, Economist、電腦王阿達45409625資料來源bloomberg與奧丁丁45709445根據Bloomberg報導，fresh三頁正文逐字相符後準備來源補正。獨立完整reference-list取每個已知標籤，不把圖片來源或列表外其他提及擴成引用。新identity國家保留ZZ，Bloomberg官方contact403不是國別證據，沒有根據事件所在地猜國家。

第七批總計6署名、10摘要、4來源／引用資料補正；兩篇台灣華報本輪新錯摘要併入10筆，兩篇舊資料alreadyNULL保持不寫。901項crawl／attribution測試與tsc通過；6作者及10摘要fresh-source試跑通過，4來源完整snapshot試跑通過，套用前還要重抓全部4原頁確認。所有資料仍未套用，代碼本地commit尚未推送。發布不早於01:53:55，要求main／live／candidate一致與精確CI成功，再暫停新派工、等active自然結束；不能因等待逾時重開job。

證據 `one-am-original-markup-proof.json`、`batch7-one-am-fresh-proof.json`、`batch7-followup-fresh-proof.json`、`batch7-reviewed-source-plan.json`、`batch7-six-authors-dry-run.jsonl`、`batch7-ten-summary-dry-run.log`、`batch7-four-source-dry-run.json`、`batch7-complete-tests.log`、`batch7-complete-tsc.log`。24小時觀察仍進行中，第六批資料不可重套。

## 第七批固定發布排程與第八批新署名（01:24）

第七批固定候選251790dcd3a9bff387b353a72e2c64db8ce7ffa0，本地已提交、尚未推送／部署／套資料。systemd timer tag-crawler-quality-batch7-release.timer已排定01:53:55啟動：main與live須仍06512c9、候選checkoutclean且精確HEAD一致，推送後等該SHA CI成功，再自然排空active才安裝；外部變更則停止不強行覆蓋。samplercheckout只有在MainPID0且仍原HEAD／clean時才fast-forward，若採樣仍執行就保留checkout，事後補核對parser版本。來源補正前全部4原頁fresh檢查／完整snapshot與backup；摘要10與作者6仍未套用。

另建獨立batch8 checkout，保留第七批固定候選。新增8篇原页指定欄位核對至東網、美國之音、世界新聞網、經濟日報、星島、風傳媒、墨新聞與奧丁丁；累计357人工記錄、272不同文章、136媒體、268篇屬樣本，仍分局部／指定欄位檢驗。世界新聞網CNA dispatch label是否應正規化／來源獨立欄、正文開頭及導航範圍待查；美國之音KCNA commentary引用覆蓋、墨新聞lead範圍也保留待查。日期與作者以原站明示欄位為準，不因自動旗標或機構名字就發明人名。

奧丁丁45860070主文章第三個p明示「文／陳怡瑄　攝影／徐裕庭」，原JSONLD Organization閱政治不能替代記者。限定news.owlting.com/articles/數字、main.article-detail article.news-content最前3個直屬p，只接受完整writer／photo格式，取陳怡瑄、不取攝影徐裕庭；敘述提及、旁欄或第四段後信用都不採。使用已驗證主文章container，body來源標記會由.news-content變selector，但正文逐字相同，沒有回寫舊body來源。fresh原頁確認正文／日期與DB一樣，準備1筆author補正未套。

第八批902項crawl／attribution測試與tsc通過；對固定第七批重播1600原頁，僅14份奧丁丁body來源標記改變，其中1份作者修正；正文／日期／其他媒體無變。只有1筆作者待補，不重写14筆正文或開新crawler/index job。第八批本地工作尚未推送／部署，下一次發布須距第七批實際發布約一小時，不能以已排定時間當成已完成部署。

證據 `batch8-all-sample-replay.json`、`batch8-owlting-fresh-proof.json`、`batch8-one-author-dry-run.jsonl`、`batch8-crawl-tests.log`、`batch8-tsc.log`、`one-am-additional-media-proof.json`。24小時觀察仍待18:49:13到期。

## 世界新聞網正文／來源修正與日期歧義（01:49，第八批未發布）

世界新聞網45860649正文段首的波蘭是p內a.trigger_tag文字，與一般tag導航不同；原generic cleaner誤移除這類anchor，造成句中關鍵字遺失。改為保留p中的trigger_tag，仍由父導航widget排除標籤選單。限定WorldJournal /wj/story/類別/文章ID，主文章.article-content__editor排除.next-page，原上一則／下一則不再混入正文。主文章作者欄完整「中央社華沙7日綜合外電報導」／「中央社斯德哥爾摩7日綜合外電報導」正規化為機構作者中央社，另解析供稿來源中央社；正文法新社／NHK引用保持分開，圖說路透不會成為文章來源。

903項crawl／attribution測試與tsc通過；1600原頁對固定第七批重播28份改變：14奧丁丁來源標記（其中1作者）、14WorldJournal正文及來源標記（其中2作者／供稿來源），其他媒體與刊登日期不變。14份WorldJournal fresh originals與完整DB快照準備／試跑全數通過，22個既存跨媒體配對重算仍有效；所有配對counterpart均不是同批另一目標，完整保存counterpart snapshots。正文補正只還原當前原文inline anchor文字、去除上一則／下一則控制項，其餘段落逐字保留，沒有任意重抓全批body或重新開crawler/index job。

部分頁面的tagging／前後導航隨網站更新，舊parser對fresh HTML不一定等於之前DB，但目前可逐段證明新正文只補回原HTMLa.trigger_tag中被省略的字，未改新闻敘述；完整相等的原頁與樣本另保留。14筆正文、2筆CNA署名／來源與1筆奧丁丁作者皆為第八批未套資料計畫。套用後須自然重建14份sketch、驗證22配對／citation index與DB/API；不得把試跑當成已修資料。

45860643發現日期歧義：RSS item連結121617/9800286宣告16:25Z，該路徑原頁也宣告16:25Z；canonical指向121232/9800286，其原頁則是06:27Z（02:27-04:00），兩頁作者／正文相同、permalink文章ID相同。只抓canonical時看似RSS日期錯誤，但重抓RSS原連結提出相反證據，因此原DB feed時間保持。没有新增WorldJournal preferPagePublication規則、沒有跨日改標籤／引用／配對日期；日期來源語義列為待查，不能把不同路徑同內容當成唯一確定的日期證據。

第七批仍固定251790d，01:50read-only probe／01:53:55publisher排程保留；第八批代碼本地已提交未推送，上線仍06512c9。證據 `batch8-worldjournal-reviewed-plan.json`、`batch8-worldjournal-dry-run.json`、`batch8-worldjournal-feed.xml.gz`、`batch8-worldjournal-feed-route-proof.json`、`batch8-worldjournal-feed-route.html.gz`、`batch8-worldjournal-replay.log`、`batch8-expanded-tests.log`、`batch8-expanded-tsc.log`。24小時觀察繼續。

### 10/8 02:10：第七批正式部署與第八批新增證據

第七批最初提交 `251790d` 的完整 CI 失敗，未部署，也未暫停派送。原因是網站署名頁的型別引用帶入後端資料庫模組，及搜尋 effect 遺漏 callback 相依性。修正版 `fadd82d52023c7ea0d7a7e14801153910f0e5255` 已推送，CI 37663725717 通過（1,442 passed、2 skipped，前端型別及建置成功）。02:03:42 暫停新派送，當時 active=0；02:04:04 安裝驗證完成並恢復，暫停 21.786 秒。三個服務均指向修正版，主站 HTTPS 200、worker health 正常、派送未暫停，失敗 job 與既有 7 筆基準相同。這些為主機端驗證；五秒探測不能證明網站零停機。

6 筆署名、10 筆摘要、4 筆引用已備份並修復，沒有日期寫入。摘要程序在完成兩筆後遇到原站逾時；接續程序依備份及完整原始快照確認已寫入的兩筆，僅寫入其餘八筆。02:12 最後原文／DB／公開 API／引用索引核對全部通過（10 摘要、6 署名、4 引用）；初版驗證器把引用讀自 `article.attributions`，已依實際 API 契約修正為 `content.attributions`，不得把驗證器錯誤當成正式資料錯誤。證據存於 `batch7-deployment.json`、`batch7-live-verification.json`、三類 durable backup、`batch7-repairs-verification.json`。

02:00 抽樣正常完成，累計 10 輪、1,766 篇、227 家媒體、8,798 篇不重複取得母體；1,702 篇解析成功、53 篇非 200、11 篇請求或解析例外。人工為 393 筆檢查紀錄、287 篇不同文章、136 家媒體，包含選定欄位及部分檢查，並非所有欄位皆已確認。

第八批另確認台灣新聞雲兩篇（45928241、45928242）的 description 與 og:description 都是固定網站宣傳，已加入精確文字過濾；第二篇首段為墨新聞編輯部信用，接續獨立署名明確寫「記者李婉如／綜合報導」。修正限於文章容器內前四個段落及完整署名格式，測試確認較後段或容器外的文字不作作者。38 個相關測試、型別檢查與秘密資訊掃描通過，兩篇新鮮原文解析均保持正文不變。快照與 gzip 原文：`batch8-fcl-reviewed-plan.json`、`batch8-fcl-45928241.html.gz`、`batch8-fcl-45928242.html.gz`。第八批仍僅本地提交，未推送、未部署、未修復正式資料；最早約 03:05 才能再發布。

24 小時觀察仍為進行中，預定 10/8 18:49:13 結束後提交最終報告。

### 10/8 02:33：第八批發布前檢查

第八批在 `fadd82d` 基準上已完成 1,702 份原始 HTML 回放，共 71 筆有選定欄位變化。世界新聞網 16 筆正文補回段落內 `a.trigger_tag` 文字並排除上一則／下一則；星洲網 14 筆回放補回 `span.article-content-tag-links` 中的正文用字。Owlting 16 筆只有一篇作者需要修正，其餘正文內容及日期不變、僅選定容器的來源標籤改變。看中國的已核對主文容器另修正日期宣告後括號內的記者署名；這裡的「日期宣告」只用來定位署名，沒有任何日期變更。

摘要另移除看中國描述中的完整固定網站宣傳尾碼，保留原站前面的新聞摘要與來源；是新聞實際位於 `scooptw.com/yesmedia/`，當描述依原文順序包含主文所有較長段落且超過 300 字時，判定為全文拷貝並留空摘要，不截取正文來產生新摘要。保留另撰導讀及只引用單段的描述。TVBS 的完整「編輯：姓名｜責任編輯：姓名／編輯組」宣告分拆為原頁兩筆信用，編輯組保留為團隊，不推斷其為個人。

新增規則及相關爬蟲／引用測試 910 passed，TypeScript、全專案 Biome 與 8 個第八批提交秘密資訊掃描通過。完整 CI 仍須在實際推送的候選提交上重新通過。

正式資料修復計畫為 40 篇不重複文章：世界新聞網 16 篇、星洲網 12 篇正文；Owlting、看中國、TVBS 共 6 篇獨立署名；台灣新聞雲 2 篇及 TVBS／看中國／是新聞 4 篇 metadata。在合併後共有 28 筆正文、11 筆署名、5 筆摘要及 2 筆 CNA 供稿引用修正，沒有日期寫入。各組都已重新取得原文並通過預設不寫入的乾跑。世界新聞網既有 22 組配對仍有效；星洲網 12 篇沒有既有配對。正式更新後需等待排程自然重建全部 28 筆 sketch，逐一核對內容、字數、minhash、引用索引、配對及公開 API，不能強制重開爬蟲／索引 job。

星洲網兩篇 45408772、45489798 的回放確有關鍵字漏字，但現站另外修改正文：前者將申請數量的量詞「封」改為「份」，後者重寫及新增段落。這兩篇不納入只補關鍵字的歷史修復，避免把來源更新混成爬蟲修正。其新取得文章仍會使用修正版解析器。

第七批目前線上為 `fadd82d`，三類歷史修復及全部驗證已完成。五秒服務探測截至 02:32 共 465 筆，02:04:04 有一次主站 HEAD 逾時，同時間 worker health 200；其餘主站與 worker 探測正常。這不是零停機證明，也沒有在使用者電腦驗證。第八批目前僅本地提交，尚未推送／部署／套用正式資料；最早 03:05 批次發布，並以實際 CI、origin/main 與線上版本守門。

### 10/8 03:05：第十一輪抽樣與第九批修正

03:00 輪於 03:02:02 正常結束，累計 11 輪、1,861 篇、229 家媒體、9,008 篇不同取得母體；1,794 篇成功解析、56 篇非 200、11 篇請求或解析例外。人工累計 442 筆紀錄、334 篇不同文章、152 家媒體，其中 330 篇為自動樣本；包含指定欄位與部分檢驗，不代表全部 metadata 正確。

第九批本地提交 `8dc1d423887de4685624d526ac58cc517272f2c5`，尚未推送、部署或回寫正式資料。排除客家電視及國際世界時報固定網站宣傳，後者優先使用文章自己的 OG 描述；台灣好報完整 UI 前綴「新聞熱度／閱讀時間／字體調整」加截斷正文不是摘要，不從正文另行生成。生活頭條僅圖片信用、食尚玩家固定宣傳也依媒體與精確格式排除。自由亞洲完整「记者：刘保罗」解析為記者；國際世界時報主文開頭完整「崔振興／屏東報導2026.10.07」解析為作者，沒有日期寫入。

客家電視 45639995 網頁為外殼，不能據此斷言資料缺漏。官方公開 API `/api/news/read/1791369130715780` 明示「李永盛 南投中寮」、2026-10-07 20:00:34 與正文，現 DB 作者／正文／日期／空摘要完全吻合，因此不清除或補寫該筆。新增來源證據 helper 驗證媒體網域、文章路徑、API ID、狀態、標題、日期與完整正文；抽樣器保留 HTML 解析結果及原始 gzip API 證據，只有驗證成功才採用 API 核對 metadata。此抽樣器改動尚未上線，會隨第九批部署後生效。

921 項 crawl／attribution 測試、TypeScript、Biome 與新提交秘密資訊掃描通過。1,702 原頁相對固定第八批回放有 18 筆 metadata 變化，沒有正文或日期變化。5 篇正式資料候選乾跑通過：台灣好報 45780516、45780517，生活頭條 45939738，食尚玩家 45596631 共 4 筆摘要清除；自由亞洲 45640862 共 1 筆作者補正。國際世界時報 45559924 原存檔證據確認 parser 問題，但重新取得為 403，因此不納入正式資料修復。各筆保留完整快照與 fresh 原文，套用仍須精確部署版本、交易前快照及 durable backup。

第八批固定候選 `8958290` 03:05 自動發布程序已到啟動時間，是否已推送／CI 通過／部署應依 `batch8-publish-progress.json` 與正式部署記錄判定，不能把排程當成完成。第九批下一次發布須距第八批實際部署約一小時，仍持續至 18:49:13。證據：`batch9-all-sample-replay.json`、`batch9-hakkatv-api-db-proof.json`、`batch9-hakkatv-public-api.json`、`batch9-metadata-reviewed-plan.json`、`batch9-metadata-dry-run.json`、`batch9-expanded-crawl-tests.log`、`batch9-uncovered-markup-proof.json`、`review-coverage.json`。

### 10/8 03:14：第八批上線及下一批摘要擴充

第八批 `8958290d81f28770f037e78d0b285fe194e62788` 已於 03:05:02 推送，精確 SHA 的 CI 37671790192 成功。03:06:25 暫停新派送時 active=0，03:06:50 安裝驗證並恢復派送，約 25.1 秒。03:07 線上核對三服務均指向該版本、主站 HTTPS 200、worker 健康、佇列未暫停、失敗 ID 仍既有 7 筆；兩篇公視摘要與原文、DB、公開 API 相符。這是主機端檢查，不是使用者瀏覽器或零停機證明。

40 篇不重複文章的正式修復全部已備份並套用：世界新聞網 16、星洲網 12 筆正文；6 筆獨立作者與6篇 metadata，合計 28 正文、11 作者、5 摘要、2 CNA 供稿引用、0 日期變更。既有 22 配對在交易中依 counterpart 快照確認並重算。全套 DB／API／配對與自然 sketch 的最終驗證仍待排程索引，不可宣稱已通過；下一次自然 similarity 排程為 03:15:47，沒有強制啟動或重開 job。證據 `batch8-deployment.json`、`batch8-live-verification.json`、三組 repair backups／applied reports、`batch8-author-repair-applied.jsonl`。

03:00 樣本另確認澳門日報两篇摘要是精確版權聲明，青年日報兩篇 OG 描述包含主文全部較長段落。新增澳門版權文字排除；青年日報限官方文章路徑及主文章 `article.PageArticle #ContentPlaceHolder1_div_Desc p`，至少3段、總長300字、依原文順序全部出現在描述中才排除全文拷貝，保留独立導讀或只引用首段。没有修改日期／正文／署名或從正文生成摘要。

最新測試為 crawl 898 與 attribution 25，共 923 passed，tsc／Biome 成功；1,794 原頁重播共 32 metadata 變化，包含12青年日報、2澳門日報，没有正文或日期變化。新增4筆摘要 fresh source／完整快照通過，併入第九批共9篇候選（8摘要、1作者），仍未套用。食尚玩家45596631被正常爬蟲更新 `content_fetched_at`，首次完整快照乾跑如預期停止且未寫入；重新抓原頁確認其他12欄完全一致，保留舊快照後更新review snapshot，9篇乾跑全部通過。人工紀錄446筆、338篇不同文章、153家媒體，仍為部分／指定欄位核對。

第九批僅本地提交，未推送或部署；最早下一次更新須不早於04:06:50。`batch9-round11-summary-reviewed-plan.json`、`batch9-nine-metadata-dry-run.log`、`batch9-supertaste-refresh-plan.json`、`batch9-metadata-reviewed-plan-before-natural-fetch.json`、`batch9-latest-crawl-tests.log`、`batch9-latest-attribution-tests.log`、`batch9-all-sample-replay.json` 保留證據。

### 10/8 03:19：第八批全部修復驗證完成

自然 similarity 排程 03:15:48 正常結束，157 筆索引、pending=0；本批 28 筆正文均有正確字數、日期與 minhash。最終 `batch8-repairs-verification.json` verified=true，28 筆正文逐欄 metadata／DB／API／citation／sketch、6 筆獨立作者、6 篇合併 metadata 全部通過。原有22配對逐一保留且分數／containment／shared／kind／evidence與既存counterpart快照吻合；正常索引另外產生的新配對也依當前counterpart正文完整重算驗證，保存新配對證據。所有日期保留。

初版驗證器要求配對筆數等於修復前數量，正常索引新增有效配對時停止；修正為保留且驗證所有原配對，另嚴格重算新增配對，不放寬matching門檻。重讀公開 content API 會更新正常 `content_accessed_at`，因此驗證器保留對文章metadata／正文的逐欄要求，只將有效的API存取時間及自然similarity時間視為可正常更新的操作欄位。没有重套資料或重開job。最終驗證器已正常結束。

第九批已固定本地提交 `d2f9a5828deef0b99469ec4f3e3f4cafb373b81d`，3個新提交秘密資訊掃描乾淨，尚未推送／部署／套資料。發布timer為04:08，probe04:03至04:53；exactHEAD、舊main／live8958290、完整CI、排空及排空後main／live重檢守門。若外部版本介入則停止，不能覆蓋。新工作使用獨立batch10 checkout，保留固定第九批。第八批五秒探測03:18:47為止205筆均主站200／worker200，仍不能推論取樣間隔零停機。觀察預定18:49:13結束。

### 10/8 03:31：跨媒體覆蓋擴充與第十批累積

新核對34篇指定欄位，涵蓋17媒體，包括15家先前未記錄人工檢查的媒體。累計人工520紀錄、370不同文章、168媒體、366篇自動樣本；有部分核對與未解項，不能當成370篇所有metadata全數正確。中視樣本主要為影片頁描述，未取得主文／記者證據；更生日報兩篇為分類廣告而非一般新聞，保留本報訊機構信用，文章分類仍待查。癮科技署名Vera與作者profile相符，其描述的作者／標題／日期wrapper保留待查。商傳媒45860692解析正文比先前DB多出一個與描述相同的開頭段，尚未證明為來源更新或既有parser變更，因此不盲目覆寫正文。美通社、GlobeNewswire與記者爆料網等帳號是原站信用，不猜個人名字。

第十批修正緯來新聞45640994 description及OG都因未跳脫引號而截斷在 `<a href=`；限news.videoland.com.tw官方文章路徑與這個完整未封閉尾碼排除，嘗試下一個原站摘要欄，保留一般短摘要。中評社主文通稿完整「中評社雲林10月8日電（記者 李京昇）」明示writer，泛用lead parser新增精確通稿格式，支持開頭照片後的署名，不接受攝影、敘述引用或較後段人物提及。台灣生活新聞官方news/數字頁，主新聞 `.main .content.min-h > .top-info > div > span.author` 完整「記者 范宏坤 報導」才採作者，不從側欄、圖片或缺少記者角色的文字推斷。

青年日報主文章 `article.PageArticle .date #ContentPlaceHolder1_domReleaseDate` 明示發佈日期，新增日期解析，隔離側欄／無主文章wrapper的宣告。14份原始頁均與DB日期一致，正文逐字相同；兩份僅宣告日期而無時分，仍保留原有日精度語義，不宣稱原站刊登在午夜，也沒有歷史日期写入。

927項crawl／attribution測試、tsc、全專案Biome通过（2個既有info），1,794份原頁對固定第九批d2f9a58回放24篇變化：14青年日報日期與body來源標記、7台灣生活新聞署名、2中評社署名、1緯來摘要；正文內容皆無變。9署名／1摘要的10篇候選全部fresh-original與完整13欄DB快照核對通過，日期／標題／tags／引用不寫入；仍未套用。證據 `batch10-uncovered-markup-proof.json`、`batch10-ydn-date-proof.json`、`batch10-all-sample-replay.json`、`batch10-expanded-metadata-reviewed-plan.json`、`batch10-metadata-reviewed-plan.json`、`batch10-crawl-tests.log`、`batch10-tsc.log`、`batch10-biome.log`。

第九批固定d2f9a58仍只在本地，04:08發布timer等待中，線上仍8958290。第十批在獨立checkout累積，尚未推送／部署／套資料，下一次發布須距第九批實際部署約一小時，不能拿排程時間當完成時間。24小時觀察至18:49:13持續中。

### 10/8 03:43：第十批補上明示評論引用

年代45489775、鳳凰45559164、壹電視45709901及美國之音45862947主文直接引用朝中社已刊登的評論，原parser沒有這個agency identity／刊登cue。新增朝中社identity kcna，國別保留ZZ未知，未以政治事件或敘述中的國名猜country。只接受完整明示已刊登評論或日期加引述、星期加「在一篇評論文章中」的原文；一般提及名稱、未來刊登計畫、照片來源與自家引用不新增citation，role仍為引用而非供稿來源。測試同時發現中文media alias緊接日期數字會被ASCII單字邊界排除，改為中文名稱允許數字相鄰，英文alias保留原邊界；例如Reuters10月不會誤識別為Reuters媒體。

4篇原文均重新取得200且正文與DB逐字相同，新增kcna以外的引用与既有正規化引用完全相同，完整12欄snapshot乾跑通過；所有既存正文、署名、日期、tags、配對與sketch皆不寫入，正式更新只補attributions與對應citation index。第十批合計14篇不同文章，9署名、1摘要、4引用，日期寫入0，全部尚未套資料。新增 `batch10-reviewed-source-plan.json`、4份`batch10-source-ID.html.gz`、`batch10-source-fresh-dry-run.json`；修復守門仍要求exact HEAD／live與clean checkout，網路重新核對完成後再重檢，保留durable backup。

最新928項crawl／attribution測試與tsc、全專案Biome通過；1,794原頁對固定第九批回放29篇變化，含4篇新增朝中社引用及1篇路透社引用，正文內容仍沒有改變。其他24篇為既已核對的14青年日報日期解析、7台灣生活新聞／2中評社署名、1緯來摘要。世界新聞網日期歧義與中評社「衛星新聞」短稱尚未取得獨立唯一身份證據，這些不猜、不改資料。

人工530筆紀錄、378篇不同文章、168家媒體，包括部分及指定欄位核對。第九批04:08timer仍等待、線上仍8958290；第十批本地累積未推送／部署／套資料，下次發布以第九批實際完成後約一小時為準。24小時觀察仍待18:49:13到期。

03:45 補充：端傳媒45373600明示「路透社9月26日引述知情人士報導」也因中文alias緊接日期而漏列；重新取得官方公開頁200，正文與DB完全相同，既有引用不變，新增路透社引用。併入第十批來源修復總計5篇，整批15篇不同文章（9署名、1摘要、5引用），仍沒有日期或正文歷史寫入，也未套用正式資料。證據 `batch10-initium-reviewed-source-plan.json`、`batch10-source-45373600.html.gz`、擴充後`batch10-reviewed-source-plan.json`。回放29篇是已確認總數，初步28篇計數漏算這篇，已更正。

### 10/8 03:59：另外20媒體與健康醫療網稿件署名／來源

新核對40篇指定欄位，涵蓋20家先前未記錄人工檢查的媒體。各網站的筆名及組織信用依宣告保留：新聞府跳跳虎（蔡虎虎）、硬是要學手哥HANDBRO、運動視界圓周率／kazumi，以及總統府GovernmentOrganization。TaiwanPlus45559355的JSONLD與可見By欄均為DevinTsai?Amelia Loi，保留原站完整信用，不擅自拆分人名。Vogue45559890原刊登精度含472毫秒，DB秒精度差異不做無意義歷史回寫；台灣產經新聞45492435的page日時與舊DB同一localday但DB只保留午夜，日期精度／来源語義仍待查，不能當成確定19小時時差錯誤。部分政府稿無個人記者證據，保留機構信用／空值，不從文內官員姓名推斷作者。

桃園電子報45862872首段完整「【健康醫療網／記者陳靖安報導】」與是新聞45411677「【健康醫療網／記者林則澄報導】」明示writer，原帳號健康醫療網不能替代記者。已將健康醫療網加入完整署名格式的publisher前綴，兩篇原頁正文皆與DB一致。主文開頭的完整agency／reporter credit另證明稿件來源，解析為來源：完整信用，不將普通提及、照片信用或主文較後段quote當成provider。健康醫療網identity／TW使用既有catalog名稱與國別。原頁桃園稿尾亦有健康醫療網原稿超連結，但正文cleaner排除導航連結後不保留footer，因此來源判斷根據主文明示署名，不靠補寫被清除的正文。

兩篇作者與來源將以單篇原子交易一起修復，備份原始14欄metadata、citations、sketch及pairs；正文／日期／tags保持，更新author／creator／attributions及citationindex，不清sketch或強制重開job。原文／快照準備已通過；所有正式資料仍未套用。第十批合計17篇候選（原10metadata、5引用、2合併署名與來源）：11署名、1摘要、7來源／引用，日期寫入0。

最新930項crawl／attribution測試、tsc、全專案Biome通過。對固定第九批回放1,794原頁，31篇變化，新增兩篇健康稿的作者與來源，正文內容無變；其餘29為前述已核對欄位。人工將包括新增核對及是新聞fresh followup，仍明示部分／指定欄位而非全欄位正確性結論。新增證據 `batch10-more-uncovered-markup-proof.json`、`batch10-health-reviewed-plan.json`、`batch10-health-45411677.html.gz`、`batch10-health-45862872.html.gz`、`batch10-final-health-replay.log`、`batch10-health-crawl-tests.log`。

第八批read-only探測已正常結束，544筆從03:00:00至03:49:55，主站及worker均200、無記錄錯誤；五秒採樣仍不能證明取樣間隔零停機，使用者端未驗證。`batch8-service-probes-summary.json` 保存terminal狀態及統計。第九批04:08仍排定，線上8958290；本批尚未推送／部署，發布間距依第九批實際部署完成計時。24小時觀察尚未結束。

### 10/8 04:14：第九批已上線並完成修復；RSS摘要持續檢查

第九批 `d2f9a5828deef0b99469ec4f3e3f4cafb373b81d` 04:08:03 已推送，精確 SHA 的 CI 37679713952 成功。04:09:58 暫停新派送時 active=0，04:10:25 安裝驗證及恢复，約26.4秒。線上三服務皆指向該版、主站200、worker健康、佇列未暫停、失敗ID仍為既有7筆；兩篇公視摘要與原文／DB／公開API一致。全部9篇歷史修復已durable backup並通過fresh原文／完整DB／API核對：8摘要清除、1自由亞洲記者署名補正，正文與日期不改。`batch9-live-verification.json`、`batch9-repairs-verification.json` verified=true。主機端驗證不是使用者瀏覽器或零停機證明；五秒probe持續至04:53。

04:00抽樣正常完成，累計12輪、1926樣本、9286取得文章母體、231媒體；1859成功解析、56非200、11請求或解析異常。樣本中299為觀察前基線、1627為觀察內取得。人工檢查目前572紀錄、420不同文章、188媒體、416抽樣文章，仍包含部分／指定欄位核對。

台灣新聞雲886 RSS description直接附上標題加「繼續閱讀」，detail summary為空時feed fallback重新存成摘要。新增精確title+CTA排除，保留有實質導讀內容的feed摘要。當次fresh官方feed30項對固定第九批回放，15項僅summary／summarySource清除，标题／URL／日期不變；931crawl／attribution測試、tsc、全專案Biome通過。`batch10-news886-feed.xml.gz`、`batch10-news886-feed-replay.json`保存證據。

另4篇fresh原文與完整13欄快照通過：886新聞46085123／46085124的標題CTA、青年日報46088079／46088078的全文拷貝描述，均應清除摘要；記者／正文／日期保持。第十批增加至21篇不同候選，11署名、5摘要、7來源／引用，0正文／日期歷史寫入，正式資料仍未套用。下一批最早05:10:25，依實際第九批恢复時間計算。24小時觀察持續至18:49:13，尚未結束。

### 10/8 04:33：第十一批繼續核對署名角色及摘要

目前跨媒體人工指定欄位檢查649紀錄、487不同文章、225媒體、483自動抽樣文章；包括部分檢查與未解項，不能宣稱487篇所有欄位正確。追加24篇／17媒體及32篇／19媒體的原頁markup核對；政府新聞未將官員當作者，書摘帳號「精選書摘」保留，HBR中英文並列姓名保持完整。非凡、美麗島、報導者的正文差異及部分日期精度／來源仍待查，沒有直接回寫。

第十一批新增TechNews主文章刊登時間及精確贊助modal／GoogleNews追蹤提示排除；PeoPo僅主文章完整header日期，不採相關文章time。13份兩站原頁的印出分鐘與DB秒時間皆相符，保留歷史日期。3篇TechNews重新取得完整原頁確認只去除兩個UI尾段，其他正文逐字保留；完整metadata不寫入。45409516既有5配對均依counterpart快照重算仍有效，將在body transaction內保留並更新；其他兩篇無配對。3篇完整快照／fresh source／pair乾跑通過，正式資料尚未套用。

Yahoo日本地震pickup metadata僅「(Yahoo!天気・災害)」服務信用，article JSONLD有明確新聞導讀，改採該站article description fallback。康健45337528／45491938的JSONLD把責任編輯王湘翎／廖苾君列入作者，可見原頁「文／梁惠明／鄧桂芬」與「責任編輯／」清楚分別；改採主文章writer欄。Livio45862286的主文章header內語義footer明示Ben Ma及完整時區日期，允許精確配置的header credit，同時排除頁尾或推薦文章署名。這4篇完整13欄快照／fresh source乾跑全部通過，日期／正文／引用保留。

立報limedia45711535主文章td-post-header完整潘韜宇／綜合報導信用、觀察者網45573369首段完整「（文/观察者网 郭光昊）」均已修正parser；立報fresh request逾時、觀察者網fresh原文已新增一段，兩者排除歷史修復，不覆蓋既有正文。觀察者網沿用既有date/title規則，避免shadow rule造成刊登日期回歸。日經中文網精確網站宣傳描述、台北郵報純「編輯/鄭欣宜撰文」「生活中心/綜合報導」描述亦排除為摘要，保留實質文章導讀。這3篇另行fresh核對中，尚未宣稱回寫。

940crawl／attribution測試、tsc、全專案Biome通過。1,859份成功原頁對固定第十批回放23篇變化：13份PeoPo／TechNews時間解析（與DB同分鐘）、3份TechNews正文去UI、康健2／Livio1／立報1／觀察者網1的作者、Yahoo日本1／日經1／台北郵報2摘要；部分為同篇多欄變化，Livio另1篇只有body來源標記。7篇正式資料候選（3正文、3作者、1摘要）乾跑已通過，5配對有快照；沒有日期歷史寫入、尚未套資料。

第九批live仍`d2f9a58`，已推送／部署並完成9篇修復驗證；probe04:31樣本仍主站／worker200，持續至04:53。第十批固定`183f87e`僅本地提交，未推送／部署／套資料，timer05:12。第十一批目前本地累積，發布須距第十批實際完成約一小時，尚未排程。24小時觀察仍至18:49:13，沒有提前結束。

04:34補充：台北郵報46006945／46085458 fresh原頁與完整13欄快照核對通過，只清除純信用摘要；日經45378769重新取得為完整文章，與DB舊paywall提示正文不同，因此不納入歷史摘要或正文回寫。擴充後6metadata候選乾跑全部通過，併同3TechNews正文為9篇不同候選（3作者、3摘要、3正文、0日期），5既存配對已核對；正式資料尚未套用。第十一批程式提交`2f9fcccea1b3f63643e8a5af3cdc720825079dfb`僅本地、未推送／部署，報告補充另行提交。

### 10/8 04:40：沃草UTC時間優先順序與明示作者

沃草45491414的JSONLD `2026/10/7 11:03:50` 未宣告時區，被generic解析成+08:00的03:03:50Z。原頁SSR印出11:03:50 UTC、Nuxt內嵌doc.publishedAt.seconds=1791371030，皆等於DB既有11:03:50Z。已在該站既有utc规则明示preferPrintedPublication，並限定主文章 `.page.read.single .doc-header .dates`，不從側欄或更新時間取日期。主文章作者卡明示完整「薛翰駿 Sih Hān-Tsùn」，新增精確writer欄，維持姓名完整、不拆成兩人。

原存檔與新取得200原頁，經內嵌fetchReportsIdData.doc.id核對文章identity，均確認epoch／printed／DB一致，沒有歷史日期写入。正文与DB仍有差異，且不只段落空白差異，暂不纳入歷史作者或正文更新。`batch11-watchout-date-proof.json`、`batch11-watchout-fresh-date-proof.json`保存只含必要欄位的證據，未把整個頁面客戶端設定當資料來源。941crawl／attribution、tsc、全專案Biome通過；原頁1859回放24篇變化，較前次增加這篇作者與日期修正，正文內容沒有新增變化，正式9篇候選不變。

前一goal turn為實際進展：新增parser、fresh originals、historical dryruns、report及commits。本輪亦為進展；24小時目標維持active。正式仍d2f9a58已推送／部署並完成9篇验证；第十批183f87e仍本地提交未推送／部署，05:12排程。第十一批本地程式與報告提交，尚未推送／部署／套資料，下一次發布須距第十批實際部署約一小時。

### 10/8 04:53：台北郵報寫稿信用、1111图說及內政部傳輸

台北郵報46006945主文第一段完整「編輯/鄭欣宜撰文」明示writer，配置主文章首段及完整pattern，採鄭欣宜而非刊稿帳號享民頭條；不接受攝影／普通人物提及／稍後段落信用。與其原有純信用摘要清除以單篇metadata transaction處理，保留先前summary-only review作archive，改用`batch11-taipeipost-combined-reviewed-plan.json`。46085458帳號新頭條保持。

1111兩篇description前綴是主圖圖說，限官方/news/jobns/數字頁及主文章yellow panel的center(img)後面相鄰div，與metadata逐字相同才處理。46085989僅有圖說，清除summary。46085984去圖說後僅剩「臺灣證券交易所啟動115年新進人員招募甄選，廣徵」，是主文首段被切斷的短前綴；限小於50字、缺完整句尾、等於主文長段落的嚴格前綴，排除該不完整候選。保留有實質完整導讀、獨立短描述，或本文完整段落本身；沒有用正文補寫摘要。兩篇正文和日期均不變。46085989的main time完整「媒體中心／綜合報導」保留為組織信用，取代全站公司meta author；沒有當成人名。46085984的記者林育如保持。

fresh原頁／完整13欄快照再次驗證通過，擴充metadata8篇全部乾跑成功；加上3篇TechNews正文為11篇不同候選，5作者信用（4個人、1組織desk）、5摘要、3正文，0日期歷史寫入；5既存配對已有完整核對。`batch11-1111-reviewed-plan.json`、`batch11-final-eight-metadata-dry-run.log`保留證據，所有正式資料尚未套用。

另檢查7家未取得200原頁的媒体HTTP取得狀況，這是availability檢查，不可當作其署名／summary已正確：中廣、艾傳媒、rise、威傳、媽媽經、上下游仍403；內政部舊HTTP逾時而同一官方文章HTTPS200。加入精確官方moi.gov.tw／www.moi.gov.tw的News_Content.aspx、n與s數字ID、預設port的HTTPS request upgrade；不改DB原URL，也沒有改其他HTTP目標或地址／DNS安全驗證。兩篇45420690／45420696直接用stored HTTP URL走新fetch，200 final HTTPS、正文／空個人署名／ROC日期與DB完全一致。`unavailable-media-review.json`與`batch11-moi-https-proof.json`保存資料。

946crawl／attribution、tsc、全專案Biome通過；1859成功原頁對固定第十批回放26篇變化，較前次增加2篇1111，另台北郵報同篇增加作者修正，沒有多出日期或正文變化。人工656紀錄、489不同文章、226媒體、485自動樣本，包括部分與未解项。第九批正式d2f9a58已推送／部署／9篇驗證；第十批183f87e仍本地提交未推送／部署，05:12 timer；本批新修改本地提交後仍須距第十批實際部署约一小時才能發布。24小時觀察至18:49:13維持active。

### 10/8 05:09：第十三輪與大紀元時區交叉證據

05:00抽樣已正常結束：78樣本／158新取得不同文章；累計13輪、2004樣本、9444取得母體、233媒體，1935成功解析、58非200、11請求或解析異常；299觀察前基線、1705觀察內。人工檢查仍為指定欄位及部分檢查，不能把自動旗標當錯誤判定。

大紀元46112193新樣板的主文info時間是artbody兄弟，原correctUtcClock selector漏取；datetime宣告更新03:43:27+08:00，可見「更新 2026-10-08 3:29 AM」實際對應JSONLD publication03:29:39Z，而dateModified03:43:27Z對應datetime的wall clock。新增僅該站、主文wrapper、唯一同URL article JSONLD、published分鐘與可見時間一致、modified秒與datetime一致且publication不晚於modified的交叉證據；以明示+08:00校正publication並保留秒，沒有直接把較晚更新時間當刊登時間。

05:08 fresh200原頁再次驗證，校正19:29:39Z與DB完全一致，正文／作者／summary／summarySource均相同；沒有歷史日期寫入。`batch11-epoch-fresh-proof.json`與壓縮原頁保存證據。948crawl／attribution、tsc、全專案Biome通過；1935成功原頁對固定第十批回放27篇變化，只新增該篇publication，其他既有差異範圍不變。第十一批仍本地提交、未推送／部署／套資料；第十批仍按05:12排程，正式目前d2f9a58已推送／部署並完成9篇修復驗證。24小時觀察持續至18:49:13。

### 10/8 05:15：新增署名與RSS摘要尾句修正；第十批已上線

第十批183f87e於05:12:02推送，精確SHA CI37687691752成功，05:13:26暫停新派送時active=0，05:13:52安裝驗證並恢复，約26.47秒。線上三服務版本、公網主站200、worker健康、佇列未暫停與既有7個失敗job不變已驗證；兩篇公視摘要仍與fresh原文、DB與公開API相同。`batch10-live-verification.json` verified=true。21篇已審核歷史修復開始套用，本段記錄時尚未全部完成，不能當作已驗證。主機端檢查不是零停機或使用者瀏覽器證明。

第十三輪另20篇／12媒體的markup指定欄位核對已保存`five-am-markup-proof.json`；累計676人工紀錄、509不同文章、226媒體、505自動抽樣文章。MSN與Miin的HTML空殼不能證明既有署名錯誤，鉅亨HTML無摘要也不能因此清除有實質feed導讀，均保持資料。客新聞摘要為截斷合作編按、美通社轉貼的description有編碼殘留，仍待進一步核對，沒有猜測回寫。

台灣線報46160988第一段將「貴賓大合照。〈圖／記者翻攝-下同〉」與完整「〔焦點時報/記者蔡宗憲報導〕」接在一起，generic opening credit未認出。新增僅該站年月數字文章路徑、main td-post-content內首個p、完整照片括號前綴及焦點時報記者報導信用；採蔡宗憲，排除攝影與敘事提及，正文不改。看中國46163511主文首段完整「看中國記者高芸編譯/綜合報導」原規則只接受綜合報導，擴充同一完整信用的編譯/前綴。另2份存檔45715476／45793185完整田靜心同格式已人工驗證，但未作fresh歷史修復。2篇新增候選fresh200及完整13欄乾跑成功，擴充第十一批metadata10篇乾跑全數通過；併TechNews正文3篇為13篇不同候選、7作者信用、5摘要、3正文、5既有配對、0日期寫入，正式本批未套用。

台灣好報RSS description含實質publisher excerpt，加上「〈本篇標題〉這篇文章最早發佈於《台灣好報》。」，已限feed:description、與本篇標題完全相符的精確尾句移除，保留原站導讀及截斷標记，不从正文另生摘要；錯誤標題或metadata來源不移除。fresh官方feed10項全部只有summary改變，標題／URL／日期不變，`batch11-goodnews-feed-replay.json`保存證據；兩篇既有feed摘要的歷史修復尚未準備，不計入本批13篇候選。

951crawl／attribution、tsc、全專案Biome通過；1935成功HTML對固定第十批回放44篇變化，其中台灣線報14篇只有或包含bodySource標記變更（正文相同）、1篇新增蔡宗憲署名，看中國3篇新增明示編譯記者；原有3篇TechNews去UI正文、Epoch時間及其他變化範圍維持。第十一批本地提交仍未推送／部署／套資料；下一批須距第十批實際05:13:52完成約一小時。24小時觀察持續至18:49:13。
