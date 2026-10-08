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

第十三輪另20篇／13媒體的markup指定欄位核對已保存`five-am-markup-proof.json`；累計676人工紀錄、509不同文章、226媒體、505自動抽樣文章。MSN與Miin的HTML空殼不能證明既有署名錯誤，鉅亨HTML無摘要也不能因此清除有實質feed導讀，均保持資料。客新聞摘要為截斷合作編按、美通社轉貼的description有編碼殘留，仍待進一步核對，沒有猜測回寫。

台灣線報46160988第一段將「貴賓大合照。〈圖／記者翻攝-下同〉」與完整「〔焦點時報/記者蔡宗憲報導〕」接在一起，generic opening credit未認出。新增僅該站年月數字文章路徑、main td-post-content內首個p、完整照片括號前綴及焦點時報記者報導信用；採蔡宗憲，排除攝影與敘事提及，正文不改。看中國46163511主文首段完整「看中國記者高芸編譯/綜合報導」原規則只接受綜合報導，擴充同一完整信用的編譯/前綴。另2份存檔45715476／45793185完整田靜心同格式已人工驗證，但未作fresh歷史修復。2篇新增候選fresh200及完整13欄乾跑成功，擴充第十一批metadata10篇乾跑全數通過；併TechNews正文3篇為13篇不同候選、7作者信用、5摘要、3正文、5既有配對、0日期寫入，正式本批未套用。

台灣好報RSS description含實質publisher excerpt，加上「〈本篇標題〉這篇文章最早發佈於《台灣好報》。」，已限feed:description、與本篇標題完全相符的精確尾句移除，保留原站導讀及截斷標记，不从正文另生摘要；錯誤標題或metadata來源不移除。fresh官方feed10項全部只有summary改變，標題／URL／日期不變，`batch11-goodnews-feed-replay.json`保存證據；兩篇既有feed摘要的歷史修復尚未準備，不計入本批13篇候選。

951crawl／attribution、tsc、全專案Biome通過；1935成功HTML對固定第十批回放44篇變化，其中台灣線報14篇只有或包含bodySource標記變更（正文相同）、1篇新增蔡宗憲署名，看中國3篇新增明示編譯記者；原有3篇TechNews去UI正文、Epoch時間及其他變化範圍維持。第十一批本地提交仍未推送／部署／套資料；下一批須距第十批實際05:13:52完成約一小時。24小時觀察持續至18:49:13。

05:17補充：第十批14metadata、5source與2health combined共21篇修復已套用並留備份；health2篇原文／完整DB／公開API／citation/sketch/pair核對通過。其他兩組驗證首次在公開API回傳500時停止，第二個metadata及第三個source請求受影響；重查45408380與45709901皆200。首次失敗報告與log另存first-attempt，尚待完整重新驗證，不把已套用等同已驗證，也不重新套用資料。

05:18驗證完成：第十批全部21篇不同文章（14metadata、5source、2health combined）與備份／DB／公開API／指定original证据核對成功，11署名、5摘要、7來源，0正文／日期歷史寫入；source與health的citationindex及既有sketch/pair保存亦通過。`batch10-full-repairs-verification.json`整合三組verified=true。公開API首次短暫500仍保留紀錄；source第二次失敗是驗證脚本未考慮2023年端傳媒文章既有七天public body window，而非資料庫正文遺失，改按live article-retention驗證expired/body=null/chars=0/source=null與精確deadline，同時核對正文DB完整不變及公開引用仍保留後通過。沒有改公開期限或重套修復。第十批已推送／部署且21篇修復驗證完成，後續禁止重套。本批第十一批13篇候選仍未套用，程式提交未推送／部署；下一批安排06:16，比第十批實際恢復晚約一小時。觀察持續至18:49:13。

### 10/8 05:32：客新聞明示摘要框、MyGoPen／美通社來源與第十二批準備

客新聞46163199主文開頭有合作編按，但真正導讀是main-content內single-content文章、post-content第一個div開頭的quote_style，h3明示「你可以先知道：」，後續兩段依序（1）（2）整理查核結论。新增僅該站日期／數字文章路徑、主文直系框、完整label与連續編號的摘要抽取；保留原站重點文字並記為article:selector，不從任意本文段落生成摘要，不從推薦／側欄或普通引言採摘要。原有截斷合作編按排除為摘要，沒有真正重點框時保留其他實質description fallback。fresh200原頁與既有正文／組織署名相同，主文原有編按和重點正文保持不變。

同篇完整開頭「本篇文章由《MyGoPen》提供」明示來源，原引用identity缺少MyGoPen；加入已審閱名稱（國別ZZ待獨立證據）與僅客新聞完整lead合作宣告。AMM轉貼46161211的第二段完整「洛杉磯2026年10月8日 /美通社/ —」也明示稿件來源，新增美通社／PR Newswire identity（國別ZZ）、僅AMM開頭三段的完整中文城市日期agency dispatch；排除普通名稱、圖片來源、未完整宣告或稍後段落。source evidence保留明示信用，來源與作者角色分開。名稱identity亦讓其他已存在完整「新聞來源：PR Newswire」的台灣新聞網／新頭條原文被正確識別。

953crawl／attribution、tsc、全專案Biome通過；1935成功HTML對固定第十一批c63dacb回放11篇變化：客新聞1summary／來源、美通社10來源，0正文／作者／日期parser變化。全部11份變化的source evidence逐項人工核對，其他非來源字段沒有變化。台灣好報46149813／46149814用fresh官方feed同post ID、題名（DB保留站名prefix）、精確date與原文正文／署名交叉驗證，只去除已審阅own-title出版宣傳尾句，保留feed excerpt；不能因HTML摘要為空便清除feed摘要。看中國45715476／45793185 fresh200確認完整田靜心編譯信用，正文與DB相同。

第十二批候選14篇不同文章：4metadata（2看中國署名、2台灣好報feed摘要）及10source（含客新聞summary＋來源atomic update），合計2署名、3摘要、10來源、0正文／日期寫入。4metadata fresh／完整13欄與10source fresh／完整14欄乾跑全部通過。source apply會durable backup完整metadata／citationindex／sketch／pair，來源與摘要同篇transaction更新；正式資料尚未套用。`batch12-goodnews-reviewed-plan.json`、`batch12-secretchina-reviewed-plan.json`、`batch12-source-reviewed-plan.json`保存快照。AMM46161211雖初次fresh200證據成立，後續重驗兩次逾時，排除正式source plan，沒有盲目回寫或覆蓋正文。保留原3-summary proof作archive；不要另外套用包含客新聞的舊summary-only plan，避免與atomic source計畫重疊。

新增全球之聲與女人迷各2份指定欄位檢查，人工目前713紀錄／524不同文章／228媒體／520自動樣本。全球之聲own English作者、繁中譯者、主文原稿writer與publisher信用需要區分角色，尚未覆寫；女人迷樣本是collections专题landing而非個別新聞，標題／description有實質內容，空personal byline不應當錯誤；nested teaser短正文與取得分類另待查。其餘6家未取得200原頁，仍不能宣稱metadata正確。

正式第十批183f87e已推送／部署／21篇修復驗證完成，不要重套。05:32主機probe仍主站與worker200，持續至05:57（不是零停機或用戶browser證明）。第十一批c63dacb固定本地提交，未推送／部署／套資料，06:16 publisher／06:11 probe timer仍active；禁止修改固定checkout。第十二批另有隔離checkout，本地提交後仍未推送／部署／套資料，最早距第十一批實際部署约一小時後發布，尚未排程。24小時觀察仍至18:49:13維持active。

### 10/8 05:43：全球之聲原作者、英語版作者、譯者與來源分開核對

全球之聲21818351的主文章header標示「作者 (English) Hong Kong Free Press」「譯者 (繁體中文) 臺北科技大學應用英文研究所翻譯小組」，主文第一段完整明示Hans Tse撰寫並於香港自由新聞刊登，且依夥伴協議重新刊登；同篇entry內methods段完整列出譯者Gwendolyn Liu、Riley Hung、Young Chung。21818350的own英語版作者是Anastasia Pestova、繁中譯者Tenn，主文第一段另外完整宣告原稿Alina Mikhalkina／NewsMaker以及內容共享、編譯轉載。不能把原稿writer／publisher與own English credit混為一個欄位或用其中一方蓋掉另一方。

新增僅zht.globalvoices.org日期／數字文章path、main header bookmark與own URL一致、主文entry存在的信用抽取。只採主文章header明示English作者／繁中譯者的官方author链接，不採校對、日本語譯者、sidebar或其他文章作者。完整首段夥伴／共享宣告成立才加入原稿writer與provider；香港自由新聞發布帳號移為來源，Hans Tse保留為writer，已明示成員的翻譯小組以該篇完整methods名單取代。結果21818351署名Hans Tse、Gwendolyn Liu、Riley Hung、Young Chung；21818350保留Anastasia Pestova，並加入Alina Mikhalkina、Tenn。原稿HKFP與NewsMaker链接分别指向hongkongfp.com、newsmaker.md，新增來源identity，國別ZZ未猜測。已登錄且原頁明示供稿的媒體，即使國別未知，也應保留其來源identity，不需先猜出國別才辨識來源。

兩篇fresh200原頁完整14欄核對通過，正文／日期／summary／tags保持，writer與citationindex同篇atomic修復；較早原稿日期不取代繁中版既有publication。2024文章超過既有七天public body期限，verification按article-retention檢查public body被masked、精確expiry與公開來源／署名，而DB正文及sketch/pair完整保存；沒有放寬public期限或改寫正文。

955crawl／attribution、tsc、全專案Biome通過；1935份成功HTML對固定第十一批c63dacb回放13篇變化：先前11份source／Hakka summary加上2全球之聲provider／署名／引用，0正文／日期。維持先取得summary再進行正文DOM cleanup，1111兩份既有圖說摘要排除結果相同，沒有回歸。第十二批候選增至16篇不同文章：metadata4＋source12（含全球之聲2writer／source及客新聞1summary／source），合計4署名、3摘要、12來源、0正文／日期歷史寫入；metadata4與source12全部fresh完整快照乾跑成功。`batch12-gv-reviewed-plan.json`保存2篇新增before／update，source apply／verifier已涵蓋12篇且檢查fresh extraction与citationindex，正式資料未套用。

目前正式仍183f87e已推送／部署、21篇驗證完成；第十一批c63dacb固定本地提交未推送／部署，06:16 timer。第十二批本地程式與報告提交，未推送／部署／套資料，仍未冻结或排程，發布需距第十一批實際部署約一小時。觀察持續至18:49:13維持active。

### 10/8 05:55：女人迷專題介紹正文，保留獨立摘要與未知日期

女人迷10668979（collections/2026Unilever）與10668991（collections/ChildWelfare）是專題頁，原擷取分別只留下內嵌故事卡63字或育兒guide單一步驟77字。新增僅womany.net／www、collections單一slug、own canonical一致且主頁seo-title存在的介紹擷取；從main直系editor／emphasis／youtube／qa-fold／gallery／feature-intro章節的直系container > p.description依序取得原站編輯介紹。排除linked articles、tag_articles、socialshare與頁尾；同章節desktop存在時排除mobile重複，保留neutral及mobile-only文字。這是專題自身介紹，不宣稱已抓取全部互動元件或連結文章。

兩頁fresh200確認新正文327字／164字，bodySource均feature:womany-description，後者維持short，不為達長度門檻拼入推薦文章。原站獨立description摘要不變，personal authors仍空，parser publication仍null。資料庫既有2023／2020日期保留，不能由2026網址或內容年份推測覆寫。舊parser正文與DB完全一致，兩頁皆0existing pairs／sketches／citations；完整article snapshot與重新取得原頁的正文修復乾跑通過。正式資料尚未套用。repair-batch12-womany.mjs僅更新body／body_status／body_source與重新索引標記，apply需exact live release、clean candidate、索引鎖與不存在backup；逐筆durable backup後transaction提交。verifier保存歷史七天public body期限，檢查expired mask與exact expiry、DB正文、原頁及公開metadata，不為舊專題強制啟動重索引。

957crawl／attribution測試、tsc、全專案Biome通過。1935成功HTML對固定第十一批回放共15篇變化（原13篇加女人迷2篇）；只有這兩篇新增正文變化，日期沒有改變。第十二批候選18篇不同文章：metadata4、source12及女人迷body2；合計4署名、3摘要、12來源、2正文、0日期歷史寫入。16份既有metadata／source乾跑及新增2份body乾跑均已通過；未推送／部署／套用。

正式版本仍183f87e已推送／部署且21修復驗證完成，主站／worker最新主機probe200。第十一批c63dacb固定本地提交未推送／部署，06:16發布timer維持；第十二批仍未凍結或排程，發布需距第十一批實際部署約一小時。24小時觀察維持active至18:49:13，需最終有界抽樣與完整報告。

### 10/8 06:00：AMM 摘要被截斷的 numeric entity，來源與摘要原子修復

AMM46161211的meta description／og:description原站直接供應「申請情況反映全球各界對增加域名系統選擇、促進競爭的廣泛關注 洛杉磯2026年10月8日 /美通社/ &amp;#821 […]」，HTML編碼中途截斷形成可見&#821。新增僅AMM數字文章、own article#post-ID內ak-post-content直系p或第一層div直系p開頭三段、完整城市日期／美通社dispatch格式，且metadata保留部分與主文開頭去空白後完全一致才清理。只移除破損&#821，保留原站excerpt與[…]；不猜補缺失的破折號或下文。有效完整entity仍正常解碼、不套清理，其他網站／ID／不一致主文保持原摘要。

此前AMM來源歷史修復曾因fresh timeout排除；本次兩次fresh200已成功，正文／署名／精確publication與DB相同，摘要唯一清理符合預期，美通社完整來源信用同時成立。新增batch12-amm-reviewed-plan.json；摘要與來源同篇transaction、citationindex一起更新，沒有body／日期覆寫。source apply／verifier明確加入第三plan與46161211，13篇source完整14欄fresh乾跑通過，未套正式資料。

958crawl／attribution、tsc、全專案Biome通過；1935成功HTML回放仍15篇變化，AMM既有來源變化增加summary字段，僅去除截斷entity，沒有新增body或日期變化。第十二批候選19篇不同文章：metadata4＋source13＋body2，合計4署名、4摘要、13來源、2正文、0日期歷史寫入。更新後source13與原metadata4／body2乾跑已通過。第十批probe PID747632於05:57:01正常結束，544次主機主站／worker200，探測間隔不證明零停機，保留部署gateway restart錯誤紀錄。06:00抽樣已以新PID792801自然啟動，禁止重複或修改其checkout。

正式仍183f87e已推送／部署；第十一批c63dacb固定本地提交未推送／部署，06:16timer；第十二批本地提交未推送／部署／回寫，未冻结或排程。觀察持續至18:49:13。

### 10/8 06:10：第十四輪、法新社作者連結、食力主文署名與追蹤首頁

06:00自然抽樣PID792801已terminal success：新增取得population280、抽樣82；累計14輪2086樣本／9724不同取得文章／235媒體，2013成功解析／58non200／15exceptions（新增4fetch exceptions保留證據，不宣稱原metadata錯誤）。

AFP46229872／46229871 main sub-header的By作者及Translation and adaptation信用以person-link > a標示，逗號在作者anchor外。僅將已存在AFP署名selector收窄至直系anchor，移除Liesa PAUWELS／Gwen Roley尾逗號；保留原頁明示AFP Netherlands／AFP Canada／AFP USA組織作者／adaptation信用，不把它們猜成個人，也不抓sidebar。兩篇fresh200，正文／summary／精確UTC publication完全一致，完整metadata快照乾跑通過。

食力46261386／46261388 issue/paper頁面主h1與post-content共用直系容器，獨立takeaways blockquote後第一個直系p完整「採訪＝林玉婷、李加祈<br>撰文＝李加祈」及「撰文=食力企劃」。新增僅foodnext own article path、canonical或og:url與own identity一致、main h1／post-content、第一個直系p完整署名。採訪者與撰文者去重為林玉婷／李加祈；另一篇保留真實組織署名食力企劃，不取正文受訪者夏豪均或推薦文章作者。主文章直系p.date完整2022/09/07／2021/08/13提供正確+08:00日日期，與DB精確一致，0歷史日期寫入；bodySelector限定main h1直系post-content，正文文字不變（bodySource parser變為selector，歷史body_source保持）。两篇fresh200／正文／summary／精確日期及完整metadata快照乾跑通過。舊食力news-only listing策略沒有更動。

Heho46195370／46195371實際是lifestyle／kids首頁加utm_source=heho-menu，網站description／舊建立日期／帳號並非新聞metadata。原listSource只排除沒有query的root，新增root的query全部屬TRACKING時同樣排除。保留?p=及其他文章識別query與正常article path；新增Heho RSS root／tracking-only／article-ID／path混合測試。沒有因此直接刪除既有首頁row或強制改日期，既有錯誤分類另列待處理。

新metadata4加入第十二批；重新乾跑原計畫时45715476原文有已逐項核對的逗號／直角引號與ASCII引號差異，但移除僅這些標點與空白後全篇逐字一致，own canonical、精確date及完整田靜心信用成立；只該ID可接受明示typography proof，DB正文完全保留。45793185原文有其他敘述變化，fullbody guard擋下，從正式metadata plan排除（旧兩篇plan已archive）；不放寬通用body guard。最新metadata7完整快照fresh乾跑通過，13source／2body既有乾跑保存，正式資料尚未套用。

961crawl／attribution、tsc、全專案Biome通過；2013成功HTML回放20篇變化，4新增AFP／FoodNext字段、06:00女人迷10669143專題介紹scope及先前15篇。正文文字變化僅女人迷3篇；date parser變化僅2食力（從null到DB相同日日期）。第三女人迷201509Witch的原編輯介紹、獨立summary／空personal byline／未知publication已確認，尚未新增歷史body修復plan，不能把回放變化當成已回寫。第十二批現在22篇正式候選：metadata7＋source13＋body2，合計7署名（包含真實組織）、4摘要、13來源、2正文、0日期歷史寫入。

正式仍183f87e已推送／部署；第十一批c63dacb固定未推送／部署，06:11probe／06:16release timer；第十二批本地提交未推送／部署／回寫，仍未冻结，需距第十一批實際部署約一小時後發布。24小時觀察持續至18:49:13。

### 10/8 06:15：大媒體明示 wire provider、第三女人迷專題与第十一批發布前快照

大媒體46217819 own article-header的article-meta span完整標示「鉅聞天下｜作者 PR Newswire」，meta#articleAuthor同時是「鉅聞天下｜PR Newswire」，own canonical exact article identity一致。footer的PRNewswire只是全站合作媒體清單，不能作為該篇來源證據。新增僅bigmedia數字article path／own canonical／main article-read-block header h1／完整兩處wire credit一致的provider識別，僅已確認PR Newswire組織；保留原作者組織信用、summary、正文與日期，不推測其他人名是供稿媒體。完整主文、summary、署名与fresh200／14欄snapshot乾跑通過，citationindex可依原明示provider補prnewswire；國別仍ZZ未猜測。

女人迷10669143 collections/201509Witch的自有編輯介紹86字談歐洲獵巫歷史與電影女巫形象，舊parser只取nested linked story的迪士尼片段。既有scoped collection parser取得正確own介紹，獨立summary／空署名／date-null保持；歷史資料日期保留，不由201509網址推測。三篇Womany重新fresh200，old parser正文exact DB，主文介紹／摘要／署名核對，全部0existing pairs／sketches／citations；第三篇維持short，不拼入故事卡。plan／apply／verifier加入第三ID，完整article snapshot與原頁的body3乾跑通過；API歷史expired body政策保持，正式資料未套用。

962crawl／attribution、tsc、全專案Biome通過；2013份成功HTML对固定第十一批回放27篇變化，新增大媒體7篇provider／引用（包含先前6份樣本），沒有額外正文／日期變化。其他6篇歷史來源修復尚待fresh再核對，不能當成已回寫。最新source14、body3乾跑通過，metadata7乾跑保留；第十二批24篇不同候選（metadata7＋source14＋body3），7署名、4摘要、14來源、3正文、0日期歷史寫入。

第十一批06:14:08發布前13篇DB完整快照及body既有pairs與review plan全相同，batch11-prepublish-snapshot-preflight.json verifiedtrue。06:11 readonly probe PID801457正常運行，主站／worker200；06:16固定release timer未重複啟動。正式仍183f87e已推送／部署，第十一批c63dacb固定本地未推送／部署，第十二批本地提交未推送／部署／套資料且未冻结，發布須距第十一批實際成功部署約一小時。24h觀察仍至18:49:13。

### 10/8 06:21：第十一批已部署與13修復已套用；第十二批30候選

第十一批c63dacb於06:16:03推送main，exact CI37695068621 success，06:18:11.349恢復派送；new-dispatch pause30.095秒，initial active0，沒有殺掉既有job或重開job。三service指向同一release、主站200、workerhealthy、queue未paused，failed IDs與原baseline7相同，兩篇公視summary原頁／DB／publicAPI仍相同，batch11-live-verification.json verifiedtrue。Samplerversion在inactive／clean／expectedoldhead時FF更新至c63dacb，不修改active round。

TechNews body3與既有5pairs已transaction更新、durable backup存在；metadata10已套用且10篇fresh原頁／DB／publicAPI／完整13欄驗證全部通過。合計13不同文章、7署名（6personal＋1desk）、5摘要、3正文、0日期寫入。禁止重套既有修復。Body verifier第一次查到natural reindex pending（NULL similarity_at／無sketch），第一attempt report/log已保存；不是apply失敗。queue readonly觀察顯示原有repeat:similarity-index:1791411947307於06:25:47.307排程，先等待既有job再核對3natural sketches及5pairs，不插入duplicate或重啟worker。完整13修復final verification尚待body索引核對，不能提前宣稱完成。

大媒體先前6份樣本fresh200均成功，完整own header及articleAuthor信用PRNewswire與正文／署名一致；45558630／45558629的DBsummary原為null，但原站已有實質meta:description excerpt（AMEXGOURMETCLUB／femtoAI各自新聞開頭），沒有自行截取正文生成摘要。將兩篇真正供應的summary／summary_source連同來源在同transaction補齊，其他5篇summary不變，全部既有正文／日期保持。source plan BigMedia由1增至7，最新source20完整14欄fresh乾跑全部通過；不因舊DB摘要空白而排除可核對的原站摘要。

第十二批現在30不同候選：metadata7＋source20＋body3，7署名、6摘要、20來源、3正文、0日期歷史寫入。metadata7／source20／body3各自完整snapshot與fresh原頁乾跑已通過。程式仍962crawl／attribution、tsc、全專案Biome，2013成功HTML回放27篇變化，不重複測試未更動的程式。第十二批report本地提交後準備冻结並排程07:21，距第十一批实际恢復派送超過一小時；exact候選CI／clean checkout／main及live守衛仍適用。正式資料未套用，不能把候選當成線上版本。

正式部署c63dacb已推送／驗證，readonly probe PID801457持續至07:01，探測仍非零停機或用戶browser證明。14輪2086樣本／235媒體觀察保持至18:49:13；最终有界抽樣與全程報告仍未完成。

### 10/8 06:27：第十一批13修復最終驗證完成，不重套

原排程repeat:similarity-index:1791411947307在06:25:49自然完成（worker log articles165／indexed162／pairs211／pending0），body修復三篇各有similarity_at及1個sketch。再次執行只讀body verifier，三篇完整snapshot、DB／public API正文、date保留、citationindex與natural minhash字元／hash／published_at均通過，既有5pairs的score／containment／shared／kind／evidence及counterpart snapshots一致，沒有額外新pair。第一attempt pending log保留，没有重apply或強制新job。

batch11-full-repairs-verification.json verifiedtrue：13不同文章（metadata10＋body3），7署名、5摘要、3正文、0日期寫入；metadata10原頁／DB／API核對與body3自然索引全部完成。正式release c63dacb已推送／部署，exact CI37695068621 success、三services指向該release、queue未paused，最初7failed IDs保持。06:11→07:01 probe仍執行，不能提前當成完整監測窗口或零停機證明。

第十二批固定bfb34f2，本地已提交，未推送／部署／回寫；30不同候選（metadata7＋source20＋Womanybody3）乾跑全部通過，962crawl／attribution＋tsc／全Biome，7commit gitleaks clean，排程07:21 exactpublisher、07:16→08:06 probe，兩timer active。不能再修改冻结checkout；第十三批另在audit/crawler-quality-batch13-20261008工作目錄承接新修正，本章報告提交為本地狀態，不是線上版本。

24小時抽樣仍維持active至18:49:13，14輪2086樣本／235媒體、229媒體已做指定欄位檢查；原頁不可取得與partial fields／首頁錯誤分類仍須如實列入最終報告。最终bounded round、完整24h報告与completion audit尚未完成。

### 10/8 06:35：iThome Drupal專題本身介紹與第二個description

iThome10668468／10668465的/article/170511、170893是node-featured-story專題，own article#node-ID有header > h1、row-fluid > field-name-body > field-items > field-item > p；旗下/news/報導是其他node-info。舊通用最長article候選可能取較長的旗下story介紹，10668465因此抓到「2025年新興資安投資」片段，而真正自有介紹是整體預算／DevSecOps／FIDO重點。另外兩份歷史樣本也可重現正文混入，不能把linked story短介紹當成專題正文。

新增僅ithome host／article數字path／canonical own identity／唯一node-featured-story且node-ID相同／main header h1及直系body field的介紹擷取，保留原站段落，bodySource feature:ithome-description；真正intro仍short，不加入linked stories達長度門檻。署名用own article和head的隔離DOM核對配置authorSelector，排除其他node-info的submitted作者，不猜測姓名；六篇own publication仍null，DB既有日期保留，不由標題年份或旗下文章日期推測。

原站description有重複meta，第一個空白，第二個是真正編輯介紹。僅已驗證own feature identity／main field時，讀取內容與該介紹完全一致的原站description，記meta:description，不由普通正文首段生成摘要，不採不同文章description，也不改通用meta順序。新增實際失敗案例測試：空白第一meta／自身供應第二meta、较長related article、related author、mismatchedID／canonical／kind／news path／不一致或空白第二meta。963crawl／attribution、tsc、全專案Biome通過，2013成功HTML對固定第十二批bfb34f2回放只有6篇iThome變化，3篇body文字改為own介紹，6summary／bodySource變化，0作者／日期parser變化。

fresh200完整DB snapshots＋old parser exact DBbody＋own metadata／intro核對6篇通過：10668468、10668465、10668457、10668454、10668443、10668494。summary均供應於原頁且與主介紹相同；3正文內容修正、3既有正文相同，6provenance修正，保留「這也了雲原生生態系」等原站文句，不自行改稿。全部0existing pairs／sketches／citations，combined body／summary6乾跑通過。batch13-ithome-reviewed-plan.json與repair／verifier保留完整article backup／exact live release／clean candidate／index lock／single-apply guard；摘要與介紹同transaction。既有過期public body的mask及expiry維持，沒有強制重索引、回寫日期或套正式資料。

正式仍c63dacb已推送／部署且第十一批13修復全驗證；第十二批bfb34f2已冻结、本地提交未推送／部署／套用，07:21timer；第十三批本地程式／報告提交、未推送／部署／套資料，尚未冻结或排程，下一次需距第十二批實際部署約一小時。24小時觀察維持active至18:49:13。

### 10/8 06:43：Cool3c原站摘要包裝清理與空白摘要補齊

Cool3c兩篇新樣本46007506／46007507的原站description將作者、完整h1、更新時間及#(文章ID)包在真正excerpt外。新增僅own Cool3c數字article path、canonical一致、main h1、meta author與own JSON article author一致、JSON headline identity、description逐字相同、datePublished +08:00分鐘與包裝時間完全一致時清理；保留供應excerpt與原本省略號，並要求excerpt去除末尾省略號後包含在own JSON articleBody。移除一個開頭格式殘留句號；沒有自行截取正文、生成新摘要或改寫供應文字。不一致的頁面保留原摘要。

2013成功HTML對冻结第十二批bfb34f2回放共11篇變化：原6篇iThome，加5篇Cool3c只有summary變化。5篇Cool3c fresh200／署名／精確publication／全13欄snapshot／正文完全相同乾跑通過：46007506、46007507、45409091、46086051、46086050。45409091 DBsummary為null，以原站meta:description同一包裝及JSON/body證據補回供應excerpt；其餘4篇僅去除包裝。ProArt摘要從「移動的個人AI代理工作站」開始，是原站提供的中段excerpt，保留原文及截斷，沒有自行補寫開頭。

batch13-cool3c-reviewed-plan.json、repair-batch13-cool3c.mjs、verify-batch13-cool3c.mjs完成；metadata only transaction保留正文／署名／tags／attributions／日期／取得時間，全snapshot比較、durable backup、exact live release與clean candidate guard，支援已套用row的只讀核對避免重复寫入；public body expiry政策保留。5篇乾跑passed，尚未apply。964crawl／attribution測試、tsc及全Biome通過。第十三批合計11不同候選：11摘要、3正文文字修正、6正文來源修正、0署名或日期歷史寫入。

正式仍c63dacb已推送／部署／驗證；第十二批bfb34f2冻结、本地提交未推送／部署／套用，07:21發布timer維持。第十三批本章與Cool3c修正為本地提交，未推送／部署／套用，仍unfrozen且未排程，需距第十二批實際成功部署約一小時再發佈。24小時觀察至18:49:13仍active，最終報告尚未完成。

### 10/8 06:47：美麗佳人JSON正文延伸閱讀與三篇原站摘要補齊

美麗佳人45861884正文JSON包含最後獨立p.extendArticle「延伸閱讀：」與ul.extendArticle中8個其他文章標題。新增僅own marieclaire兩層分類／數字article URL、canonical exact、article直系.articleContent#contentID[itemprop=articleBody]唯一、article直系h1與JSONheadline exact、DOM整篇與JSON正文去除空白後完全一致時處理。只移除單一p.extendArticle與下一個ul.extendArticle同站article links的字面完整末尾suffix，後面如仍有正文就拒絕；保留章節、正文裡的延伸閱讀字樣與引用URL，不靠全文keyword切割、不選較短DOM正文造成章節遺失。HTML JSON正文、不一致canonical／ID／heading／prose／class／非最後清單／外站links均保持原文。

2013成功HTML對冻结第十二批回放現在15篇：6iThome、5Cool3c、4MarieClaire；4MarieClaire僅body變化，沒有署名、日期或摘要parser變化。四篇45861884／45410174／45410171／45491179 fresh200、舊parser exact DB正文、剩餘正文是原JSON逐字prefix、精確publishedAt／authors保持，body由6041→5637、1611→1556、742→633、3796→3654字；每篇1既有sketch、0pairs／citations，全article snapshots和索引snapshot乾跑passed。後三篇DBsummary null／summary_source null，但原站與舊parser均提供相同實質meta:description，正文清理與摘要補齊在同transaction，沒有生成摘要或覆寫非空summary。

prepare／repair／verify-batch13-marieclaire.mjs與batch13-marieclaire-reviewed-plan.json準備完成。完整article／sketch／citation／pairs與counterpart备份、exact release／clean candidate／similarity-index lock守衛；apply移除舊sketch與設定similarity_at null，等待原有natural index job，verifier核對DB／fresh原頁／public API、原日期、自然minhash及任何new natural pair的正文證據。4篇尚未apply，禁止重啟或另插索引job。972crawl／attribution tests、tsc及全Biome通過，formatter只更動指定files。

第十三批合計15不同候選：14摘要、7正文文字修正、6iThome正文來源修正、0署名或日期歷史寫入；6iThome／5Cool3c／4MarieClaire乾跑通過。正式仍c63dacb已推送／部署／驗證；第十二批bfb34f2冻结、本地提交未推送／部署／回寫，07:21 timer維持；第十三批本地提交未推送／部署／回寫，仍未冻结或排程，下一批須距第十二批實際成功部署約一小時。24小時觀察至18:49:13持續active。

### 10/8 06:52：MSN公開abstract、PNN已核對原站summary、Miin API實證

先前MSN／Miin／PNN的一般HTML是應用殼，不能作為空正文或缺署名的正確性證明。本次直接核對原爬蟲採用的公開資料途徑，不重開爬蟲job：MSN assets.msn.com/content/view/v2/Detail/zh-tw/ID四篇45492352／46087842／46163067／46163066都是public-access article／locale zh-tw／own ID完全相同，parsed完整正文、作者（保留供稿provider＋明示作者）、精確publication均與DB一致；四份detail.abstract都是原站獨立供應的實質摘要，舊adapter只保留供稿來源description而漏存abstract。新增publisherSummary(detail.abstract, api:msn:abstract, ownTitle)，保留原abstract及其截斷、不從正文生成，provider／原文URL description維持；錯ID、限制／paywall、缺abstract／相同title／oversized摘要均不補。

MSN四篇full13field snapshot＋fresh API乾跑通過，摘要都能在該篇已核對正文中找到，原DBsummary／summary_source null。batch13-msn-evidence.mjs、reviewed-plan、prepare／repair／verify-batch13-msn.mjs保留exact-release／clean guard、durable metadata backup、single-apply核對、public API與retention檢查；尚未apply。一般2013 HTML回放仍15篇變化；專用API新增4摘要變化獨立列證，不把應用殼回放當完整adapter驗證。

Miin45558768／46085197／46149826／46149825公開api.miin.cc story endpoint exact storyId、normal state與正常content spans已驗證，完整body／title／publishing account Miin Events (EN)／createAt精確日期同DB。API dataKeys只有title／content／author等，沒有summary或description；四篇summary保持null、不把網站slogan或自動正文首段當摘要，也不改publishing account成推測記者。batch13-public-api-review.json／gzip保留實證；檢查的是上述selected fields，不宣稱所有欄位已正確。

PNN45478221／45780646實際pnn5.aotter.net hosted viewer（一般pnn.tw response是殼）與其description明示的中央社own原文均fresh200，main viewer heading／origin title與canonical／兩方向正文overlap與closingparagraph／精確original publication／provider＋authors及DBbody一致。兩篇origin頁有獨立meta:description摘要，viewer無自己summary metadata；新增僅已完整驗證供稿原文後保存detail.summary與origin:meta:description來源，保持原文URL／供稿credit，不自行生成或誤稱viewer自己供應。兩篇full13field snapshot＋fresh viewer與original乾跑通過，摘要字面出現在供稿正文；PNN source資料取得或identity不符就拒絕，缺original summary維持null。batch13-pnn-evidence.mjs、reviewed-plan、prepare／repair／verify準備完成，尚未apply。

974crawl／attribution tests、tsc／全Biome通過；第十三批合計21不同候選：20摘要、7正文文字修正、6iThome正文來源修正、0署名或日期歷史寫入，6iThome／5Cool3c／4MarieClaire／4MSN／2PNN各fresh完整snapshot乾跑通過。正式仍c63dacb已推送／部署／驗證；第十二批bfb34f2冻结、本地提交未推送／部署／回寫，07:21 timer；第十三批本地提交未推送／部署／回寫、unfrozen且未排程，須距第十二批實際成功部署約一小時再發佈。24小時觀察維持至18:49:13。

### 10/8 06:57：星島明示BBC引用與過期pending記錄校正

星島46150129主文完整「另一方面，根據《BBC》的消息指，賴斯亦接近與阿仙奴續長約。」實際指向BBC新聞消息；舊來源parser未涵蓋此句型。新增僅據／根據引導、可引號完整已知outlet、可「的」、消息指出／指／稱／表示＋明確逗號或冒號的citation cue；單純BBC提及、消息指數、消息指控、圖片信用不成立。來源為bbc、引用角色，既有已核對GB identity保留，不把BBC改為作者或猜供稿provider。新增圖片來源後包含根據的排除測試，先前測試發現的false-positive已修正。

975crawl／attribution tests、tsc與全Biome通過；2013成功HTML回放現在16篇（之前15＋星島1，只有新增attributions變化）。Fresh200 own body／authors／summary／精確publication與DB相同，full14field snapshot乾跑passed；batch13-bbc-source-reviewed-plan.json、prepare／repair／verify準備完成，只更新attributions與citation index，同transaction備份完整metadata／sketch／pairs／citations，正文及日期不變，尚未apply。

舊Kingtop45408331／45408332的pending狀態已過期，現在fresh原頁、DB、public API的summary與summarySource均null且一致；batch13-kingtop-state-review.json verifiedtrue，没有重复資料寫入。ccsn0405兩篇及iw_times／peopo／guancha／lihpao／nikkei／musou共8篇屬已部署parser但歷史未回寫／selected fields／fresh不可用限制未解除；依各batch7／9／11 live verification與對現live的git ancestry證據標記parser-deployed-historical-review-retained，不能誤標成所有metadata已修正。保留原有date精度與upstream／availability排除理由，final報告須區分parser部署與歷史資料驗證。

第十三批合計22不同候選：20摘要、7正文文字修正、6iThome正文來源修正、1BBC引用、0署名或日期歷史寫入；6iThome／5Cool3c／4MarieClaire／4MSN／2PNN／1BBC各fresh完整snapshot乾跑通過。正式仍c63dacb已推送／部署／驗證，readonly probe PID801457執行至07:01；第十二批bfb34f2冻结、本地提交未推送／部署／回寫，07:21 timer；第十三批本地提交未推送／部署／回寫、unfrozen未排程，須距第十二批實際成功部署約一小時再發佈。24小時觀察至18:49:13持續active，07:00下一輪自然抽樣尚未開始。

### 10/8 07:08：第十五輪、報新聞／蕃新聞署名與第十三批固定候選

07:00 sampler PID842952於07:02:18自然完成，ExecMainStatus0且MainPID0；新一輪112樣本／310新取得population，累計15輪2198樣本／10034不同取得文章／237媒體。2123成功解析／60non200／15exceptions，299pre-observation baseline＋1899within observation acquisition；此輪parser仍正式c63dacb，沒有中途改checkout或重開job。新媒體GQ與聚傳媒；GQ兩篇LINE syndication metadata作者Adam Cheung／Katherine Tu、精確JSON datePublished、獨立description與stored相同，正文exact DB但引用／全文清理未全面核對，僅selected fields檢查，batch13-seven-am-gq-proof.json留證。聚傳媒46292249完整特約記者credit在照片caption後同p內，待另批scoped DOM修正，不因no-author旗標猜人名。

報新聞46292873主文開頭完整「報新聞/記者蔡昀臻/台北報導」，舊OUTLET reporter prefix沒有報新聞；加入已確認prefix，既有完整記者role／姓名／地名邊界規則處理，不把editor desk或後段敘述提及當作者。蕃新聞46292320供應相同完整稿件，舊parser fallback作者蕃新聞，現可取明示記者蔡昀臻。兩篇fresh200、主文exact DB、精確日期與DB相同，報新聞own canonical exact；蕃新聞own數字Article identity／主h1僅空白normalization後exact DBtitle，沒有放寬body guard或猜canonical。完整13field snapshots與乾跑passed；只改authors／creator，RSS供應summary與蕃新聞原meta summary完全保留。batch13-contentplatform-reviewed-plan.json／prepare／repair／verify完成，尚未apply。

新Cool3c46292892的原站wrapper與own author yeah／h1／JSON／分鐘clock／文章ID252687／body excerpt全部成立，加入既有摘要計畫；6篇Cool3c重新fresh full13field乾跑全部passed，保留原description供應截斷。976crawl／attribution tests、tsc／全Biome通過；2123成功HTML對冻结第十二批回放19篇：6iThome、6Cool3c、4MarieClaire、1星島、2報新聞／Yam，新增byline only2，無新日期parser變化；MSN／PNN另6份專用資料途徑摘要變化獨立列證。

第十一批probe PID801457已inactive／MainPID0／exit0，06:11:00.126→07:00:59.474共545主站200＋545worker200，batch11-probe-summary.json verifiedtrue。這是主機端定期探測，不能宣稱零停機或用戶browser已驗證；先前gateway restart錯誤紀錄保留，不重開probe。

第十三批固定候選25不同文章：21摘要、2署名、7正文文字修正、6iThome正文來源修正、1BBC引用、0日期歷史寫入；6iThome／6Cool3c／4MarieClaire／4MSN／2PNN／1BBC／2報新聞Yam各fresh完整snapshot乾跑通過。準備以本章commit冻结候選並安排08:26發布；publisher需第十二批實際部署／完整30修復驗證且距resumed至少3600秒，再核對exact main／live／clean與CI才部署。第十二批bfb34f2仍冻结、本地提交未推送／部署／回寫，07:16probe及07:21release timers維持；正式仍c63dacb已推送／部署／驗證。第十三批本地提交尚未推送／部署／套用，冻结及timer實際狀態以ledger為準；後續聚傳媒、三立main editor credit、MSN複合人名與食力legacy頁面等新發現移交第十四批隔離checkout持續處理，並非24h工作完成。觀察到18:49:13仍active，最终有界round、全程報告與completion audit未完成。

### 10/8 07:22：聚傳媒自有主文記者及供應摘要包裝

聚傳媒46292249 own Article/Detail/38688 canonical與og:url同identity，唯一article.entry的直系.single-post__entry-header含主h1。實際正文在直系.entry__article-wrap > .entry__article > div > first p；同p以「照片取自臺南市政府<br>【聚傳媒特約記者陳欣如報導】」開頭，原JSON／DOM通用正文flatten成同一段，lead parser因photo caption未取得記者。新增僅j-media own數字article URL／own canonical／唯一主header與精確正文層級的完整開頭credit，取陳欣如，排除政府照片信用、sidebar、後段敘述、人名不完整及編輯中心placeholder。聚傳媒屬news catalog新增來源，legacy overrides不套用；已改為有own identity的專用parser，沒有保留不起作用的override或更動通用catalog合併架構。

原站獨立meta:description同樣包「照片取自臺南市政府【聚傳媒特約記者陳欣如報導】」在真正供應excerpt外；只有其prefix去空白後與own首p完整credit相同，且剩餘摘要去末尾省略號後字面出现在該own正文，才移除photo／byline包裝。保留原站excerpt與...、meta:description來源，沒生成摘要、刪正文或抓較長related內容。Own canonical／caption／excerpt不一致時不改摘要。

980crawl／attribution tests、tsc及全Biome通過；2123成功HTML對冻结第十三批bedafe7重播只有46292249的authors與summary變化，0正文／日期parser變化。Fresh200，old parser與DB正文及原summary exact，own reporter／新excerpt／精確publishedAt均核對，全13field snapshot乾跑passed；summary與authors／creator同transaction，完整metadata backup／exact live／clean candidate／already-applied核對／DB-publicAPI-origin verifier準備完成，日期／正文／tags／attributions／取得時間保留。batch14-j-media-reviewed-plan.json／repair／verify尚未apply。第十四批1候選：1署名＋1摘要、0日期或正文寫入，unfrozen未排程。

第十二批bfb34f2已07:21:02推送main，exact CI37701765282當時in_progress，正式仍c63dacb已推送／部署／驗證；PID859022 publisher只執行原timer一次，07:16→08:06 probe PID854082 active、主站與worker200。部署前metadata7／source20／Womanybody3重新fresh完整快照乾跑共30passed，尚未apply，不把pushed當deployed。第十三批bedafe7冻结、25候選未推送／部署／apply，08:26 timer且需第十二批完整30驗證與actual resumed至少1小時間隔；不能修改冻结checkout。24小時觀察持續至18:49:13，最终有界round與總報告仍未完成。

### 10/8 07:31：第十二批部署與30筆修正核對完成；MSN明示複合署名

第十二批bfb34f290d3c6769414c82eb6362fe1f40dd4163已07:21:02推送main，exact CI37701765282 success；原timer publisher自然完成，未重複啟動。07:22:24.583 active0後暫停新派工，installer verified，07:22:50.475恢復，暫停25.892秒；三個服務實際cwd為exact release，主站200、workerhealthy、queue pausedfalse，原7個failed IDs不變。兩篇公視summary原站／DB／API一致。這是主機端驗證，沒有宣稱用戶browser測試或零停機；07:16→08:06既有probe繼續。

metadata7／source20／Womany正文3已逐筆fresh/full snapshot核對、durable backup後套用，30不同文章全部original／DB／publicAPI驗證通過，0日期寫入；batch12-full-repairs-verification.json verifiedtrue／expected exact bfb／uniqueArticles30。GoodNews檢核最初誤將已修正row傳給需要pre-repair摘要尾註的freshEvidence，改傳已備份before，重新驗證通過；source verifier最初未處理API既有authors空值回退creator及normalizeAuthorCredits，確認正式contentArticle規則後修正檢核，重新通過。兩份首次失敗log保留，沒有重套資料或放寬原站正文guard。GV到期body仍masked，Womany原日期／摘要／作者保留。不得再次apply。

MSN46294703 public Detail明示authors.name為「洪凱音、黃琮淵╱台北報導」，既有reporterNames可完整辨識兩人。只在MSN已驗證同article的公開author欄位套既有明示role／地名規則，有有效名字才拆分；沒有識別到完整credit時保留原字串。供稿中時新聞網及普通陳凱俊／財經中心保留，台北指控等不完整報導邊界不拆。46294701與46294703各有public abstract、相同title／完整body／精確publication及供稿人，追加第十四批兩份原站供應摘要候選；46294703 authors／creator與summary同transaction更新，另一篇只改summary／summary_source，正文／日期／取得時間／tags／attributions保持。原DBcreator是pipeline完整署名join，核對oldjoin後更新新join，不把provider欄位誤當DBcreator。

981crawl／attribution tests、tsc、全Biome通過；6份MSN專用API回放僅46294703作者拆分變化，summary／正文／日期及provider無變化；兩篇fresh完整13field snapshot乾跑通過，batch14-msn-reviewed-plan.json／repair／verify已準備但未apply。第十四批現在3不同候選：2署名、3摘要、0正文／日期寫入，本地提交未推送／部署／apply，unfrozen未排程。第十三批bedafe7冻结25候選，08:26timer保留，需距第十二批actualresumed至少1h才發布。24h觀察仍active到18:49:13，總報告與最後有界round未完成。

### 10/8 07:38：食力舊頁面明示寫作角色與三立主文署名

FoodNext46335496自有主文.post-content第一個直系p為「採訪·撰文=蔡幸儒」；46335500完整「撰文＝約翰‧艾倫（John S.Allen，美國南加州大學…的神經人類學家。）」將英文別名和個人簡介放在同一parenthesis。沿用既有數字paper path／own URL identity／主h1+post-content DOM scope，只接受完整採訪·撰文角色、有效personal name，或完整dotted外國名字+有效英文alias+以學術職業／研究單位結尾的bio；保留原「約翰‧艾倫」字形，不把別名算第二人、不將簡介當姓名，後接活動文案／alias無效／canonical不同／related credit不採。HTTP og:url與HTTPS输入本來就由urlKey同identity，不需更動URL規則。

兩篇fresh200、main title及canonical identity／精確date／整篇body／summary+summary_source exactDB；oldparser authors同DB食力foodNEXT，新parser蔡幸儒／約翰‧艾倫。完整13field snapshot乾跑passed，batch14-foodnext-reviewed-plan.json／repair／verify準備，僅authors+creator，不改日期、正文、摘要或引用，尚未套用。

SETN46281284唯一主文.article_time_wrap > .article_time_area > .article_remark_wrap > .author_wrap明示「編輯 林昀萱 台北報導」，own主h1相同。新增只在三立該主文欄位完整匹配的署名pattern；不放寬通用reporterNames或responsibility editor規則、不採aside相同class。fresh原頁正文／精確date／summary與DB一致，DB和正式API本就林昀萱正確，故只有parser修正、沒有新增歷史回寫候選。batch14-setn-proof.json verifiedtrue；責任編輯、他站同名欄位測試排除。

最終983crawl／attribution tests、tsc、全Biome通過；2123成功原HTML對冻结13回放僅食力2／聚傳媒1／三立1的署名（聚傳媒另摘要）變化，0正文／日期變化。MSN專用6份API回放另1作者拆分；第十四批5不同歷史候選＝4署名+3摘要（overlap2），0正文／日期寫入，三立parser-only不混算歷史repair。第十四批本地提交未推送／部署／apply，unfrozen未排程；正式仍bfb34f2已推送／部署／完整30驗證。第十三批bedafe7冻结，08:21probe／08:26release既有timers，actual hourly gate earliest08:22:50.475，不重啟timer。07:38第十二批probe實際PID854082仍active，主站200+worker200，nextsampler08:00維持。24h觀察至18:49:13仍active，總報告及最後有界round未完成。

### 10/8 07:45：Taipei Times主文通訊社供稿與中評社Sputnik引用

TaipeiTimes45941770 own URL/meta og:url同identity，#left_blake > .archives唯一主h1及直系ul.boxTitle > li > .name明示「AFP, WASHINGTON, DC」。新增僅該站數字archives path／owncanonical／唯一主header與完整agency+dateline的解析，作者credit保留AFP而city不當作者，providerAFP建立「內容提供者：AFP」source及citation index。个人評論者Juan Fernando Herrera Ramos仍原credit，正文Photo:AFP/AP不是供稿證據，aside同name／canonical不同／署名後接其他文案不採。

Fresh200 own主h1同DB，generic title含固定「 - Taipei Times」suffix另核對，full body／summary／summary_source exactDB，oldparser完整署名同DB。原頁publicationmeta 2026-10-08T00:00+08與RSS項目2026-10-08T08:00+08有8h差異；重新fresh取index.rss，對同canonical、title唯一item的publication00:00Z exactDB，來源本來skipMeta保留feed時間。本次不更動日期或泛化校正，記錄pageMeta／storedFeed衝突與完整原始feed，作者／creator／attribution一個transaction；完整14field snapshot+existing citations／sketches／pairs備份、fresh乾跑passed，尚未apply。

中評社45781142 fresh own docid107241172／title／full body／summary／作者[]／精確date皆同DB，開頭完整「中評社香港10月7日電／衛星新聞報道，…」是明示報道引用，不是記者。公開sputniknews.cn首頁200，中文title為俄羅斯衛星通訊社，meta description明示Sputnik，支持Sputnik／衛星新聞／衛星通訊社繁簡別名。新增outlet sputnik及明示report邊界，照片來源或衛星技術文字不採；jurisdiction未獨立審核而維持country unknown／ZZ，不據domain猜國籍。只新增attributions及citation index，作者／日期／正文／摘要全部保留；fresh full14snapshot乾跑passed，backup與exact deployment guards準備，未apply。原頁和品牌首頁HTML.gz及identity log留證。

985crawl／attribution tests、tsc、全Biome通過；2123成功HTML對冻结13回放6文章：CRNTT引用1、TaipeiTimesagency署名+provider+source1、食力署名2、聚傳媒署名+summary1、三立署名1，0正文／日期parser變化；MSN另6API回放1作者拆分。第十四批共7不同歷史候選：5署名、3摘要、2source，0正文／日期寫入，SETN另parser-only已正確DB不用回寫。第十四批仍unfrozen未排程，本地提交未推送／部署／套用，需待第十三批actualdeployment+一小時間隔。正式bfb34f2已推送／部署／完整30驗證；13bedafe7冻结08:26timer與priorgate仍維持。24h觀察active到18:49:13，final boundedround及完整修改清單仍待結束時審核。

### 10/8 08:01：澎湃完整主文署名、通訊來源別名與第二次段落回放

澎湃原12個sample的主文main header第一個author div原本完全未選取，新增該站header直接子欄位，排除時間wrapper／責任編輯／aside；provider只接受完整已核對的央視新聞或海南日報公號credit。Own __NEXT_DATA__ props.pageProps.contId及detailData.contentDetail的contId／name／author／originalFlag與url數字ID／main h1／visible header獨立核對後，拆解「澎湃新闻记者」的完整主名列表，以及同欄明示「见习记者／实习生」具名contributor；主記者或Contributor姓名以既有reporterNames驗證，只移除明示角色不猜姓名。不把「责任编辑苏晨」改成作者。實際陳緒厚欄位有兩個空白，JSON／DOM只做相同空白normalize再核對，邊界／ID／title／role均保持；fixture與fresh原12篇作者逐一literal expected names核對通過。

同一澎湃main JSON originalFlag2明示新華社、新華網客戶端、唐健輝/新華網客戶端的供稿角色：新華社識別xinhua，網站新華網識別xinhuanet，兩個publisher原catalog本就分開，不能合併。唐健輝保留明示個人作者，新華網客戶端／新华社／央视新闻／海南日报公号保留明示組織署名。CCTV及XinhuaNet國別沿用已存在registry CN，海南日報未獨立jurisdiction審核仍ZZ。完整原稿source建立provider attribution及citation index，不把圖片或單純機構提及當來源。

澎湃12fresh200，own DOM title／JSON article ID+main credit／完整body／精確printed-minute publication与DB相同；其中6篇summary原DBnull而own meta description供應同body的已截斷excerpt，加入獨立summary_source，不生成正文摘要。其餘summary原樣保留。作者／creator／必要source及summary同transaction；無source變化的作者-only row不delete/rebuild citations。完整14field snapshot及fresh乾跑12passed，metadata／citations／sketches／pairs備份與DB/API-origin verifier準備，未apply。

加入「央視新聞／央视新闻」及「新华网／新华网客户端」已核對別名之後，原saved成功HTML另外6篇明示「據央視新聞報導」「来源：央视新闻」「（來源：央視新聞）」「（來源：新華網）」新增source：45408257、45411507、45408750、45640760、45710050、45640761，各fresh正文／署名／publication／old-parser date皆同DB，全部full14snapshot乾跑passed。前3summary原null，own meta excerpt與主文相符，梅花摘要的明示「記者梅花新聞網陳素貞/綜合報導」亦與stored陳素貞及剩餘正文獨立核對，忠實保留原站供應excerpt及來源，沒有另生成描述。source+supplied summary原子更新，日期／正文不改；batch14-wire-citations-reviewed-plan.json等準備。舊5行CCTV-only draft乾跑沒有apply，已由6行完整plan取代，不應另跑舊draft。

報導者10667665／10667651 fresh own topics identity/title／完整own topic intro／summary與DB及API相同，無新增作者／發布時間宣告，既有2016／2018日期保留而不能由目前頁面獨立驗證；public expired body mask／expiresAt核對通過，僅selected fields review，未寫資料。初次review verifier用了generic parser title suffix expectation，但feature parser本就移除suffix；改為精確own title+canonical檢核後通過，原失敗log保留，無code/date改動。

988crawl／attribution tests、tsc／全Biome通過。2123成功HTML對冻结13回放24不同文章，變化僅作者／provider／source及聚傳媒摘要，0正文／日期變化；MSN另6API回放1author拆分。第十四批累積25不同歷史候選：17作者credit（含具名人員與明示組織）、12supplied summaries、14source，重疊欄位同transaction，0正文／日期寫入，三立parser-only另外1既有DB已正確。所有候選fresh/fullsnapshot乾跑passed、未apply；本章commit後固定第十四批候選，本地提交未推送／部署／套用，後續新code移到第十五批。第十四批發布timer尚未建立，以實際ledger為準；需第十三批25修正完整驗證+actual resumed至少一小時後才部署。

08:00既有timer自然啟動第16輪sampler PID893592，實際cwd primary checkout，HEAD bfb34f2；不改active checkout、不重開job。第十二批probe PID854082仍active、主站200／worker200；第十三批bedafe7冻结08:21probe／08:26release timers不重複啟動。正式仍bfb34f2已推送／部署／完整30修正驗證，24h觀察至18:49:13仍active，總報告及最後有界round尚未完成。

### 10/8 08:21：後續批次guard、16輪新樣本與第十五批兩類metadata修正

第14批89160bd已固定本地commit，25候選尚未推送／部署／套用；09:26→10:16 read-only probe及09:31release timers實際建立，prior gate必須13actualinstaller verified／exactbedafe7 live verified／full25repairs verified／queue resumed且距actualresumed至少3600秒，publisher再核對exactcleanHEAD／originmain／currentrelease／CI。隔離fixture的7個gate contract檢查passed：缺檔、actual hour不足、only24/25、priorfailed、queuepaused、wrong SHA均拒絕；fixture不是13真實部署已完成的證據，目前prior13 aggregate尚未產生。13publisher原本誤指向固定12cwd的deploy-batch12，會在version check拒絕安裝，已在08:26timer前改為專屬deploy-batch13；冻结13／14tracked commits沒改。13六支metadata/API verifier改依正式contentArticle的authors trim／normalize／empty fallback creator規則檢核，完整DB快照及原文檢核保留，syntax passed，沒有改production schema或放寬正文保護。

第12批probe PID854082自然08:06:02結束，journal明示Read-only service probes completed；07:16:00.113→08:05:56.506共542home200＋542worker200，batch12-probe-summary.json已保存。後續Failed to open transient unit檔案是完成後unit移除，不是probe重跑或部署失败；這是主機端定期探測，不代表用户browser驗證或零停機。16輪sampler PID893592已08:02:47正常exit0，新增142samples／476population，累計2340samples／10510不同取得文章／237media，2262parsed／63non200／15exceptions；299baseline＋2041observation-acquired。新樣本8:00仍用正式bfb34f2，沒有改動activecheckout或重開job。

台灣線報46369071 own canonical／numeric WordPress URL／main h1與OG/Twitter記事title相符，meta:name description為完整「高雄律師 台南律師 男律師 女律師…」law-office search keyword list，但同頁own og:description有該篇雇主徵才廣告法律文章的原站supplied excerpt。精確列入已審核boilerplate，不做廣泛法律字詞評分，不生成lead，讓既有候選fallback採原供應OGexcerpt及meta:og:description來源。帶相同法律字詞的真正敘事description仍保留；OG不存在時summarynull。原始description欄保持原宣告，修正独立summary選擇；writer／syndication角色本次未改。

聚傳媒46368481 own唯一main heading「鄭自隆》電影評論…」、canonical及完整opening【聚論壇鄭自隆專欄】明示columnist；實際firstp只有「照片為電影預告截圖」，secondp是columnist+第一段，摘要跨到thirdp的製作方宣傳開頭。新增完整column role+同名main h1雙重核對。僅firstp為完整短photo caption、緊接secondp以完整自有credit開頭，才把own leading3directp作summary excerpt證據；不跨sidebar、後段提及、非photo前言或header姓名不符。Photo+column wrapper與supplied metadata完整相符、剩餘excerpt出現在own leading paragraphs才移除，保留原供應截斷；姓名用既有reporterNames作者role驗證，不把圖說／責任編輯當人名。原singlep記者格式維持。初始fixture未模擬真正分p結構及不完整credit負例只替換了meta，因此被fresh proof／test抓到；修正真實DOM fixture及helper後重新通過，沒有錯誤dataapply。

同輪46368482明示聚傳媒特約記者陳欣如，適用已固定14的舊記者helper，仍補準備本次新取得歷史row；不把它算新parser回放變化。15 metadata plan3unique＝twline summary1+Jmedia author2/summary2，fresh200／owntitle／canonical／exactdate／fullbody／完整13field snapshot乾跑3passed，summary/author+creator同transaction，0body/date写入。台灣線報原authors[]保留、法律事務所與楊秉鈞的角色本次不猜；三筆未apply，未有backup。batch15-metadata-reviewed-plan.json／repair／verify準備完成。

991crawl／attribution tests、tsc、全Biome通過；2262成功HTML對冻结14回放只有46368481的authors+summary，以及46369071的summary+summarySource，0body／date變化。第15批本地提交尚未推送／部署／回寫，unfrozen未排程；正式仍bfb34f2已推送／部署／完整30資料修正驗證，13bedafe7冻结08:26timer維持。13候選在此時另重新fresh/fullsnapshot預發布乾跑，完成狀態以實際logs/ledger為準，不宣稱尚未完成的13部署或回寫。24h觀察至18:49:13仍active，最終有界round、完整修改清單與completion audit尚未完成。

### 2026-10-08 08:31：第 13 批上線與健康 2.0 策展文章

第 13 批 `bedafe7608e36ce0582d0cd1d848e6b3ed2c9da1` 已推送，CI 37707743710 成功，08:28:58 恢復派工。部署前原有 crawl-index job 等待自然完成；新派工暫停 93.034 秒，沒有強制終止該 job。主機端確認三個服務執行精確版本、首頁 HTTP 200、worker healthy、queue 未暫停及既有 7 個 failed IDs 不變。公視兩篇摘要原站／資料庫／公開 API 一致。25 篇資料修復正在逐項套用及驗證，尚不可宣告全數完成。

健康 2.0 46410959 原站策展頁同時有影片及 477 字完整食譜正文，署名為「整理／羅以容」，其他人是諮詢專家。既有通用正文選擇器未涵蓋該 sibling-section 版型。第 15 批新增限定主機／insomnia 2024 路徑、own canonical、唯一標題與摘要首段對應的解析，只讀影片前的 content1 正文區塊，排除延伸閱讀、導覽、專家角色及製作團隊；日期沒有原站明確證據，維持 null 解析，不重寫資料庫日期。

新增 3 項正反例，全 crawl／attribution 共 994 項通過，TypeScript／全 Biome 通過。2262 份已保存 HTML 對第 14 批重播僅 3 篇變動：聚傳媒專欄作者及摘要、台灣線報摘要及其來源、健康 2.0 正文及整理者。第 15 批現有 4 篇審查候選（3 署名、3 摘要、1 正文），完整資料快照與原站 dry-run 通過，尚未推送、部署或套用。關鍵評論網兩個專題頁已核對摘要與角色；Alex／Alvin 是製作團隊，不能直接當記者署名，crypto-hk 正文尾段邊界仍待另外檢查。

### 2026-10-08 08:41：第 13 批全數完成，第 16 批五篇候選

第 13 批 25 篇已逐項套用一次並完成原站／資料庫／公開 API 驗證。美麗佳人第一次檢查遇到 natural reindex pending；沒有重複套用資料或新增 job，等待既有 08:35:47 similarity 排程後，四篇 sketch／pair／citation 與全文驗證全部通過。`batch13-full-repairs-verification.json` verified=true、uniqueArticles=25、精確 expected=bedafe7608e36ce0582d0cd1d848e6b3ed2c9da1；第 14 批前置檢查只剩實際滿一小時條件，保留 09:31 發布排程。第 15 批凍結 7f6173854cd1b5969c02b8a721f7534d633e8a94，10:36 發布及 10:31 探測已排程，仍未推送或部署，須第 14 批完整 25 篇及實際恢復派工後一小時。

第 16 批限定關鍵評論網 own canonical／feature 路徑／album-list-wrapper 專題介紹 DOM，且正文必須與原站 supplied description 相符。10668302 移除製作團隊 Alex、Alvin 尾段，10668180 正文維持相同並標明專題介紹來源；不將製作團隊轉為記者署名，不猜日期。女人迷 10668985 是心理測驗，原站正文混入「你是第 0 個龍年開運的人！」互動計數器。限定 own collection／quiz-title／quiz-start／description 與原站摘要一致的版型後，只保留測驗介紹，summary 保持原樣，不讀計數器。10669010 #Proudtobeme 新專題已獨立核对 own canonical、editorial intro、summary、角色，資料庫／公開 API 一致；發布日期無獨立證明，不寫入日期。首次女人迷核對誤以為兩頁均屬 collection description，失敗紀錄保留並促成 quiz 版型修正。

MSN 新取得 46373267／46373268 兩篇的公開 Detail abstract 仍未存入 summary，加入明確原文供應的摘要補回。46373268 author.name 為完整「Newtalk新聞 |張柏源 綜合報導」；限定新頭殼 provider 與 newtalk.tw 原文 news/view 路徑，解析張柏源，保留供稿組織。新頭殼原文 1064345 HTTP 200、same canonical／同標題，顯示「張柏源綜合報導」，另有張柏源 credit，角色原站對照通過。完整資料快照、fresh body／title／API publication／provider 及三組 dry-run 共五篇通過，尚未套用。

1000 crawl／attribution 測試、TypeScript、全 Biome 通過。2262 份 HTML 對第 15 批重播，只有兩篇 TNL 與一篇女人迷變動（2 篇正文內容、3 篇來源）；8 份已保存 MSN 公開 API 重播僅 46373268 作者有變，其他字段不變。合計 5 篇候選，1 篇署名、2 篇摘要、2 篇正文內容、3 篇正文來源，零日期寫入。此章為第 16 批本地準備結果，尚未推送、部署或寫入修復。

### 2026-10-08 08:59：第 17 批署名與摘要五篇，跨媒體新增選定欄位核對

波新聞 46368414 正文第一行是完整「波新聞─陶泰山編輯」，原解析漏抓具名編輯。限定 NewsID numeric path、同篇 og:url、唯一文章標題與 main opening p 的獨立換行署名，補陶泰山；原站 supplied summary 包含同一個署名前綴，核對後只移除該前綴、保留原文截斷符號。TVBS 46395554「編輯：易軍堯」及 45573927「編輯：張哲輔」在 own main contributors 欄位，限定 own canonical、主標題及完整角色後，保留人名並排除 sidebar、重複 mobile/desktop credits、單獨 responsibility-editor credit。既有 combined editor credits 行為保留，公服組等 desk credit 保留原樣，不推測人名。45573927 原庫 summary=null，原站提供與自身正文相符的 excerpt，原站身份／正文／日期快照通過後一併計畫補回。首次 prepare 遇到 null summary 與現行 parser 結果差異，保留失敗紀錄；重新按 publisher excerpt 證據審查後通過，沒有先行寫入。

新取得的澎湃新聞 46373672 楊喆／46373673 高宇婷 fits 第 14 批既有 own JSON record 與可見 header 同步驗證，追加歷史署名候選；無新增 parser diff、無 source/date/body 寫入。第 17 批合計 5 篇署名、2 篇摘要，零正文／日期寫入；metadata3 與 ThePaper2 完整快照、fresh originals dry-run 全通過。1005 crawl／attribution tests、TypeScript／全 Biome 通過；2262 保存 HTML 對第 16 批重播仅3篇变动，且正文／日期完全不變。原重播捕獲公服組被當人名的風險，已補組織 suffix 排除；該篇不列歷史寫入候選。此章是本地準備结果，尚未推送、部署或套用。

另核對 22 篇跨媒體保存原站 HTML 的摘要與署名角色，屬選定欄位人工核對，並非 fresh API／全欄位正確判定。風傳媒主筆室、台灣好新聞地方中心、世界新聞網中央社即時報導均保留為單位署名，不能因 JSON-LD 標 Person 就推測真人。中天兩篇 own 倪鴻祥 declared credit 與原文工商時報 footer writer 是不同角色；明確「※本文授權自工商時報」引用已正確存 ctee，沒有無證據覆蓋自己的署名。BBC 毫秒 date 在 DB 存秒，無須重寫。CNEWS 文章 title 不是 site-logo h1，按 own article entity／byline／專欄角色核對，sidebar names 排除。中央社 46404625 結構化正文多了 own fullPic figcaption 的98字照片說明，剩餘正文完全與 acquisition body 一致，署名／摘要一致；歷史庫正文已排除該 caption，將在第 18 批檢查 scoped parser boundary，無歷史覆寫需要。

### 2026-10-08 09:20 第 18 批修補準備中（尚未提交或部署）

- 中央社：自己的 canonical、主標題、照片說明標記與下一段報導共同驗證後，移除 JSON-LD 內文最前面的照片說明。2,440 份保存原文回放僅影響 6 篇中央社內文；已逐篇確認移除內容等於自己的標記照片說明。46404625、46191256 的歷史資料本來已乾淨，不覆寫。其餘歷史資料仍在審查：45357267、45608919 有既有相似度配對／sketch；45619412、46415556 的現在原文另有尾端照片說明或更新，不能直接拿現在整篇覆寫。中央社頁面日期只到分鐘，保留 RSS 秒數，未改日期。
- 新公民議會：46445603、46445604 自己的數字文章 ID、canonical、entry-title、OG title、頁尾作者及末段「作者」交叉核對，擷取千水默內、朱智德，保留署名／筆名。description 經確認等於整篇自己的段落文本（排除分享與相關文章），改取媒體提供的 OG 摘要；1605／2024 字變為各 198 字，內文、日期不變。
- 蘋果仁：46445649 的原始 RSS 已保存，url、標題、時間及 Hana 署名核對相符；只移除包含完全相同標題的固定 WordPress 發布尾句，保留媒體原本摘要及省略記號，不生成新摘要。
- 1,012 項爬蟲／引用測試、後端 TypeScript、全專案 Biome 通過（2 項既有資訊提示）。三篇 metadata 修復的新原文及完整資料列快照 dry-run 已通過；尚未 apply。
- 第 13 批服務探測正常結束，543 次首頁及 worker 均 200；這是主機端定期觀測，不是使用者瀏覽器或零停機證明。第 14 批原有 09:26 探測／09:31 發布排程仍存在。
- 實際 live release 仍是 bedafe7608e36ce0582d0cd1d848e6b3ed2c9da1（已推送部署並完成驗證）。第 18 批尚未提交／推送／部署。24 小時 goal 持續至 18:49:13。

### 2026-10-08 09:25 第 18 批最終驗證與歷史修復準備

- 中央社補上自己段落容器內的 figure > figcaption.picinfo；只有所有剩餘文字完全等於自己的直接 p 段落時，才移除中間／末尾照片說明。若正文有差異，僅採用已由緊接段落佐證的開頭照片說明修正。第 18 批回放仍為 2440 份原文、6 篇中央社 body 與 2 篇新公民議會 metadata 有變動，無日期或引用變動。45619412 修正後完整等於既有資料庫內文，無歷史覆寫。
- 中央社 45357267、45608919 現在舊 parser 內文仍完整等於資料庫；移除所有標記照片說明後整篇等於自己的 p 段落，已取得完整資料列、相似度配對／對方資料列、sketch、citation 快照並完成 fresh original dry-run。共 9 組既有配對重新計算仍有效。45357267 原本摘要為 null，同時補入媒體自己的 meta:description；其他摘要與全部日期維持原資料。
- 中央社 46415556 最新 HTML 與 JSON-LD 的第二段存在「蔡英文」三字差異，且新增尾端照片說明；不得直接以最新整篇覆寫歷史資料。此項保留後續審查，不能宣稱所有中央社歷史內文已修完。
- 蘋果仁原始 feed 共 20 項回放全部僅改 summary：20 個完整匹配自己的標題與出版尾句，其餘 url／title／date／creator／原始 description／contentHtml 等欄位完全相同。歷史修復本批僅含已核對的抽樣文章 46445649。
- 最後 1013 項爬蟲與引用測試、TypeScript、全專案 Biome 通過（2 項既有資訊提示）。metadata 三篇與中央社兩篇完整快照 dry-run 均通過，尚未 apply。此批共 5 篇，2 作者、4 摘要、2 內文、0 日期。

### 2026-10-08 09:37 第 14 批已部署／第 19 批修復準備

- 第 14 批 89160bd19a5e6dbc057ec5290a351cd852a6285d 已推送，CI 37713318139 通過，09:33:07 恢復 job 分派。實際 current 與三個服務程序版本、主機端首頁、worker、queue、公視兩篇原文／資料庫／API 摘要驗證通過。歷史修復依序完成 j-media 1、MSN 2、foodnext 2、Taipei Times 1、Sputnik 1、The Paper 12、wire-citations 6，全部 25 篇獨立核對通過；已產出 full-repairs-verification，無日期或內文覆寫。未使用 superseded cctv-citations 草案，未重套第 13 批。第 14 批服務探測仍在運行，觀測不是零停機證明。
- 第 18 批固定為 62e7f24311cbce6a6b8bd46ea46d1636191f6910，本地提交且 gitleaks 一個 commit 通過；未推送、未部署。13:46 探測、13:51 發布已排定；必須第 17 批全部 5 篇驗證完畢且實際恢復後滿一小時才推送，7 個隔離 gate 契約檢查通過（不代表現在部署條件已滿足）。
- 第 19 批愛傳媒 46443889：自己的 article.entry 主標題、title、OG title、分享目標完整網址交叉核對；原 OG URL 缺主機，不能當成 canonical 證據。第一個 p 的完整「楊渡/作家」明確署名被獨立擷取，並從媒體供應的摘要去掉完全相同的署名包裝，摘要剩餘文字由自己的段落佐證。未改內文與日期。
- 第 19 批澎湃 46446850／46446851：自己 main h1、URL contId、NEXT_DATA contId／name／author／originalFlag、可見 header credit 一致。禹琳/经济日报、庞慧敏/工人日报 分成作者及提供來源。工人日報原始報紙 2026-10-08 第 6 版 news-1.html 已找到同標題與「本报记者 庞慧敏」，保存原文。來源國別暫 ZZ；不是以語言或事件地点推定。
- 測試抓到经济日报 舊 alias 被誤歸台灣 udnmoney。針對澎湃這個明確提供者欄位保留獨立 economic_daily_thepaper 來源，原始名稱及來源證據不變，國別未知；其他發行者原有台灣 alias 行為不變。中國經濟日報原始紙本入口 HTTPS／HTTP 均 timeout，不能宣稱已直接核對禹琳原稿。此項來源身分與國別需後續獨立補證。
- 2440 份 HTML 最終回放 vs 第 18 批僅上面 3 篇有 metadata／source 變動，0 body／date 變動。1018 項爬蟲／引用測試、TypeScript、全專案 Biome 通過（2 項既有資訊提示）。愛傳媒 1 篇與澎湃 2 篇新原文／完整資料列／配對／sketch／citation 快照 dry-run 通過，尚未 apply。澎湃 before 作者空陣列是第 13 批當時解析結果；第 18 批 parser 已會保留原始完整 credit，不能錯把 parser 現況當成歷史資料庫狀態。

### 2026-10-08 09:58 第 20 批修復核對中（尚未提交／推送／部署）

- 中央社 46415556：canonical、自己的主標題及 JSON-LD headline、最前照片標記、第一報導段落一致。排除自己的 figure > figcaption.picinfo 後，完整可見正文與 JSON-LD 只差第二個 p 開頭的「蔡英文」（主標題也明確包含），其餘報導逐字一致。僅當這種完整且唯一的段落差異成立時採用自己的 p 段落，body_source 明確為 article:cna-paragraphs；其他變動、不同標題、錯誤 canonical、隱藏段落都不適用。既有照片修補保留。
- 46415556 歷史修復取得新原文、完整 articles 快照、4 組配對及對方文章、1 個 sketch、0 citations；前置 dry-run 通過。修復後 1370 字完全等於自己的直接 p 文本，與歷史資料只差標記照片說明及上面三字。作者、摘要不變；保留 RSS 秒數，頁面日期只到分鐘。不套用歷史資料、不重跑 job；正式部署後再採自然相似度重新索引及核對。
- 工人日報：官方電子報同篇本报记者庞慧敏、官方關於頁明列「工人日报社主办」、同主辦站的北京聯絡地址均 HTTP 200 並保存，來源本籍國別由 ZZ 補為 CN；證據是來源媒體自身的資料，不是文章語言或事件發生地。經濟日報原始紙本入口未取得，繼續 ZZ。
- 工人日報文章 46446851 的第 19 批作者／來源修復尚未上線；第 20 批國別更新必須在第 19 批實際 live 且全 3 篇歷史修復驗證完成後重新取快照、fresh original、dry-run，不能直接套現在舊空署名快照。已建立只准該順序準備的程式，尚未執行這篇的 country 歷史修復／dry-run。
- 三立 46281284 的第 14 批 parser-only 修補，另外以當前原文、既有 DB 和 live API 核對記者林昀萱一致，0 歷史覆寫。第 14 批服務 probe 959897 仍活躍，最新首頁和 worker 200；10:00 抽樣排程仍存在。
- 手動紀錄更新至 919 筆、621 篇唯一文章、617 篇抽樣文章、233 個發行媒體；包含 selected-field 及 partial review，不是 621 篇所有欄位全部驗證。自動 17 輪 2521 篇樣本、11118 唯一取得母體、241 個媒體；2440 解析、66 非 200、15 個請求／解析例外。原文 availability 失敗與 metadata 正確性分開記錄。
- 協作預覽開啟與狀態查詢皆 timeout；此輪官方來源核對為主機端 HTTP／保存 HTML，未宣稱瀏覽器驗證。線上仍是已推送部署且原文／DB／API 驗證完畢的 89160bd19a5e6dbc057ec5290a351cd852a6285d。第 18／19 批提交 62e7f24／5fb9d22 僅本地、排程發布；第 20 批仍未提交。

### 2026-10-08 10:33 第 20 批新增署名／摘要修補（尚未提交、部署、歷史寫入）

- 彪網媒 46522712／46522713 的 description 是完全相同的網站宣傳標語，OG description 空白；限定已核對的完整標語，清空 summary／summary_source，不製造內文摘要。保留林豊雅的具名署名，另一篇台南新聞中心不推測個人。
- 紐時中文 46524911 原作者字串混入相鄰日期。限定自己的 canonical、唯一 article header、headline 及完整 address 署名，保留 SOUMYA KARLAMANGLA、AMY QIN，排除 sibling time 和頁尾貢獻者；未改正文、摘要、日期。
- 國語日報 46524838 的主標題下完整「沈育如／臺北報導 (2026/10/8)」補回作者，46524839 未署名社論保留未署名。兩篇 description／OG description 都等於自己的整篇段落；只在自己的 URL 參數、OG URL、唯一文章／主標題／正文段落一致時拒絕全文作摘要，另供 excerpt 保留。
- 1,027 項爬蟲／引用測試、後端 TypeScript、全專案 Biome 通過（2 項既有資訊提示）。2,643 份保存原文對固定第 19 批重播，只有 7 篇變動：中央社 1 篇正文／來源、工人日報 1 篇來源國別、彪網媒 2 篇摘要、紐時 1 篇作者、國語日報 2 篇摘要及其中 1 篇作者。零日期變動；新五篇 metadata fresh original／完整快照 dry-run 均通過。工人日報歷史國別仍須第 19 批上線後重新準備。
- 10:00 輪已自然完成，18 輪共 2,733 篇樣本、11,862 篇唯一取得母體、247 媒體；2,643 解析、75 非 200、15 請求／解析例外。依取得時間分為觀察內 2,434、觀察前基線 299。人工紀錄 936 筆／638 篇唯一／634 篇抽樣／243 媒體，包含 selected-field／partial，並非全欄位正確保證。新增正報、花新聞、Cosmopolitan 五篇自己身份／署名／供應摘要選定欄位核對；正報是機構署名且不進入記者人名索引。另七篇 403 只記原文無法取得，不認定 metadata 正確。
- 第 14 批 probe 已自然終止（MainPID=0／inactive／ExecMainStatus=0），540 次觀察中首頁 539 次 200、1 次 502（09:33:06.232，更新切換期間）；worker 540 次 200。保留原始紀錄及 probe summary，不能宣稱零停機。第 15 批 probe 已於 10:31 啟動，發布排程 10:36，須先滿前批實際恢復後一小時；此章寫入時線上仍為已推送、部署、原文／DB／API 驗證的 89160bd19a5e6dbc057ec5290a351cd852a6285d。

### 2026-10-08 10:41 第 15 批實際上線／四篇歷史修復；第 20 批擴充今日報

- 第 15 批 7f6173854cd1b5969c02b8a721f7534d633e8a94 已推送，CI 37718663636 success，10:38:19.779 恢復 queue。更新前 active jobs 空陣列，立即 drained；只暫停新 dispatch 39.194 秒，不宣稱有執行中 job 自然完成。三服務 cwd 同一版本、首頁／worker 200、queue 未暫停、原七個 failed IDs 不變；公視兩篇摘要原文／DB／API 一致。四篇歷史資料（台灣線報 1、享新聞 2、TVBS Health 1）各 apply 一次且完整快照、原文、公開 API、既有 citations／pairs／sketch 核對通過，full-repairs-verification exact release／unique4。不要重套。探測仍在運行至 11:21；下一批必須實際恢復後滿一小時，最早 11:38:19.779，既有第 16 批排程 11:41。
- 基督教今日報 46522336 description 僅六字網站名，OG description 是自己完整供應的文章 excerpt；新增精確網站名排除以使用 OG。自己的 URL News.aspx／EntityID=News／完整 PK、title／OG title／唯一文章區桌機 headline 一致；桌機完整「特約記者 莊堯亭」及「綜合報導」與手機同篇署名、日期一致，補具名特約記者，排除旁欄推薦與不一致 header。兩版時間同 2026/10/08 09:12，DB 秒／日期不變。
- 45408598 也受上述摘要修正影響：自己 title／header／OG 一致，OG 提供同篇摘要，DB summary 原為 null，計畫補供應摘要。署名本報訊／北部新聞中心，不推測記者；無作者、正文、日期寫入。此篇屬觀察前取得基線，不能算觀察期間新取得文章。
- 第 20 批目前 metadata7 + CNA1 + 待第19實際修復後準備的工人日報國別1，共9篇候選。metadata7 全新原文／完整資料列／正文相等／日期解析未變檢查通過，尚未 apply；最終 dry-run 進行中。新增 correspondent 後 1,031 項爬蟲／引用測試、後端 TypeScript、全 Biome 通過（2 項既有資訊提示）。2,643 HTML 最終重播仍進行中，前一版只摘要修改時影響9篇。初次今日報測試／準備把來源誤寫成 og:description，actual 是 meta:og:description；修正預期後測試、準備皆通過，保留失敗 log，沒有先行寫入。
- 上述第 20 批仍是本地未提交、未推送、未部署修正；第 15 批四篇則已正式核對。人工紀錄更新到 940 筆／638 篇唯一／634 篇抽樣／243 媒體，選定欄位與部分核對的範圍不變。

10:42 補充核對：第 20 批最終 2,643 原文回放完成，僅上述 9 篇變動；新增今日報署名只影響 46522336，45408598 的本報訊保持未指定個人。零日期变動、除中央社 46415556 外零正文变動。metadata7 fresh originals／完整快照 dry-run 全部完成，無 backups／applies；第 20 批仍未提交或部署。人工紀錄 942 筆／639 篇唯一／635 篇抽樣／243 媒體。

第 15 批探測尚未結束，但更新過程已觀察到 10:38:11.145 首頁 503、10:38:16.625 首頁 502；同期 worker 都200，恢復後首頁200。此處是發現時間截點的觀察，最終完整 probe 統計待 11:21 自然終止後整理，不能宣稱零停機。原文核對、公視 live API 與服務探測為主機端檢查，未冒充使用者瀏覽器驗證。

### 2026-10-08 10:47 第 20 批固定提交前的發布順序

本批共九篇歷史修復候選（metadata7、CNA正文1、工人日報國別1）。予定16:01發布、15:56至16:46持續服務探測；必須第19批實際版本5fb9d225e45d6f72f836ec93928336a96d24f1e5及全部三篇歷史修復核對完成、queue恢復後滿一小時。推送前再次從當下原文與資料庫準備全部九篇快照，再執行唯讀dry-run；工人日報國別的快照只能在此前批實際修復後準備。任何前置失敗皆不推送、不暫停queue、不安裝新版本。此章記述預定流程，並非聲稱工人日報的尚未開始dry-run已通過或第20批已上線。
