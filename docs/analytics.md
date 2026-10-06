# GA4 與 Search Console

正式網站：`https://tag.observe.tw`。GA4 評估 ID：`G-D1E1CZSX7L`（公開識別碼，非密鑰）。

`SiteAnalytics` 在 hydration 後，僅在 production 且 hostname 為 `tag.observe.tw` 時載入 Google tag。localhost、開發模式與其他預覽網域不送資料。阻擋追蹤腳本的瀏覽器不會影響網站操作。

## 評估方式

- 初次瀏覽與 Next.js 站內切頁交由 GA4 加強型評估處理。串流的「網頁瀏覽 → 進階設定 → 根據瀏覽器記錄事件變更網頁」需開啟；程式不另外送 `page_view`。
- `open_original`：點擊共用 `SourceLink` 的原站連結，參數為 `link_domain`、`source_page_type`。不代表原文讀完。GA 自動外連 `click` 可能同時存在，兩者不可加總當作原文點擊數。
- `select_content`：點擊本站標籤／事件連結，參數為 `content_type`（tag/event）、`content_id`（事件 thread 編號或標籤文字，
  只送純數字或 ≤100 字、無控制字元／角括號／引號／斜線／@ 的標籤，否則不帶）、`source_page_type`。GA 內建維度
  `contentType`／`contentId` 直接可查，不需另建自訂維度。規則在 `web/src/lib/analytics-consent.mts`。
- `rss_click`：點擊本站 RSS 連結；不代表訂閱成功。
- `app_installed`：瀏覽器發出 `appinstalled`，不以按安裝按鈕或接受提示代替。未提供此事件的瀏覽器無法量到。

自訂事件不送標題、搜尋字詞、完整外連 URL 或使用者識別碼。但 GA 加強型評估仍會收集網頁網址、標題、外連與站內搜尋等資料；上線管理時需檢查資料刪改設定（電子郵件及 URL 查詢參數，例如 `q`），若不需要搜尋字詞報表可關閉站內搜尋評估。URL 刪改不會自動清理頁面標題，搜尋頁標題也應避免帶入敏感輸入。

## 不送統計的瀏覽器

`SiteAnalytics` 在掛上 Google tag 之前判斷（`analyticsBlock`），任一成立就完全不載入 gtag.js，page_view、自訂事件與
`web_vital` 都不會送出，同時設 `window['ga-disable-G-D1E1CZSX7L']`：

- 非 production 或 hostname 不是 `tag.observe.tw`。
- 自動化瀏覽器：`navigator.webdriver === true`，或 UA 含 HeadlessChrome、Lighthouse、Playwright、Puppeteer、Selenium、bot 等。
  要從自動化測試驗證一般讀者的追蹤，需在測試中以 init script 把 `navigator.webdriver` 改為 false、換一般 UA，並攔截
  `/g/collect` 不讓請求送到 GA。
- 使用者在 **`/observe/opt-out/`（不計入統計）** 按下「這個瀏覽器不計入統計」：localStorage `tag-analytics-opt-out=1`，
  可在同一頁「恢復計入統計」（下一次載入頁面起生效）。設定隨瀏覽器與網站資料，無痕視窗、換瀏覽器或清除資料需重設；
  Safari 可能在 7 天未造訪後清除。頁面 noindex，入口在網站觀測頁尾的計算方式說明。

不做 IP 排除。此設定不會回溯排除已送出的紀錄；需要移除既有資料時，另用 GA4 管理介面的資料刪除要求。

## 驗收與報表

1. 部署後以未阻擋 Google tag 的瀏覽器開啟正式站，在 Network 確認載入 `gtag/js?id=G-D1E1CZSX7L`，並有 `g/collect` 請求。
2. 以 Tag Assistant 啟用偵錯，在 GA DebugView 確認首次瀏覽、站內切頁、上一頁各只有一次 `page_view`。若重複，先檢查是否另有 GTM 或額外 Google tag。
3. 點原站、標籤／事件與 RSS，確認事件名稱及參數；一般報表可能延遲 24–48 小時。
4. 在自訂定義建立事件範圍的 `source_page_type`；`content_type` 和 `link_domain` 如需於自訂報表使用，也依 GA 介面支援的維度設定。
5. `open_original` 可標記為關鍵事件，建議同時看工作階段關鍵事件比率。內部流量篩選先採測試模式。
6. GA 管理 → 產品連結 → Search Console 連結，選擇 `https://tag.observe.tw/` 與此 Web 串流。

GSC 的 sitemap 已成功讀取；即時測試通過代表可供索引，不等於已收錄。實際結果看 GOOGLE INDEX 與 Pages，搜尋成效看 Performance。

## 真實使用者效能

正式網域的 GA4 啟用後，`web-vitals` 回報 `web_vital` 事件：

- `metric_name`：LCP、INP、CLS。
- `metric_value`：LCP／INP 單位 ms；CLS 無單位，保留三位小數。
- `metric_rating`：good、needs-improvement、poor。
- `page_type`：本次文件載入的首頁／ranking／eve／tag 等類別，不含查詢字串或畫面文字。
- `metric_id`、`navigation_type`：辨認樣本與導覽類型；不要把高基數的 metric_id 註冊成自訂維度。

每個文件只註冊一次，採 web-vitals 預設的結算時機，沒有互動的頁面不會產生 INP；SPA 換頁不假裝是新的完整載入。數字送出通常要等第一次互動或頁面進入背景，並非開頁立刻全部到齊。開發環境不送 GA。

GA4「自訂定義」可新增事件維度 metric_name、metric_rating、page_type，以及數值指標 metric_value（標準單位；報表必須先按 metric_name 篩選，不能混算 ms 和 CLS）。這項設定需要編輯者權限，可以由網站擁有人操作。探索報表用裝置類別、頁面類別、指標名稱及評級查看樣本量與良好比例。GA 的一般聚合平均值不是第 75 百分位；要算真實 p75，使用 BigQuery 原始事件匯出，或看有足夠樣本的 CrUX／GSC Core Web Vitals。

## 授權讀取 GSC／GA 成效

目前此開發環境沒有已登入的 Google 分析連接器。可以先提供兩個後台匯出的 CSV；不需要任何帳號權限。持續自動讀取可採 Google Cloud 服務帳戶：

1. 在自己的 Cloud 專案啟用 Search Console API 與 Google Analytics Data API，建立專用服務帳戶。無需授予專案 Owner／Editor。
2. GSC 的 `https://tag.observe.tw/` 資源，設定 → 使用者和權限 → 加入該服務帳戶電子郵件；讀取成效報表先給受限使用者。需要 URL Inspection 等額外功能時，再核對該功能所需權限。
3. GA4 資源 `557297184` 的資源存取權管理，加入同一電子郵件，給「檢視者」。一般流量與事件報表不需要編輯者或管理員。
4. 憑證放在主機上、Git 工作目錄以外的私人檔案（權限 0600），以 `GOOGLE_APPLICATION_CREDENTIALS` 指向；只提供服務帳戶電子郵件與檔案路徑，不把私鑰貼到聊天或提交 Git。也可使用工作負載身分／短期 OAuth，避免長期金鑰。
5. 程式只要求 `https://www.googleapis.com/auth/webmasters.readonly` 與 `https://www.googleapis.com/auth/analytics.readonly`。取得憑證後先验证 GSC 資源列表與 GA4 測試報表，再排程匯出。

GSC API 可讀搜尋查詢、頁面、裝置與點擊／曝光／CTR／平均排名，但沒有完整的「網頁索引」報表 API；該報表仍需後台匯出。GA Data API 可讀事件與來源成效，精確的使用者旅程／原始事件分析可能需 BigQuery。提供 GA/GSC 唯讀權限不等於啟用 BigQuery；後者另行設定，且可能有費用。

## 公開網站觀測與讀者關注

公開入口：`/observe/`（每日瀏覽、讀者關注、來源、裝置、熱門頁面、互動、Google 搜尋、使用體驗；`?days=7|28|90`），
首頁左欄的「讀者關注」（近 7 天內容頁前 5 名，不足 3 筆時不顯示）。`/readers/` 永久轉址到 `/observe/#readers`。
定義寫在頁尾「本頁的資料來源與計算方式」（`web/src/components/method/observe.tsx`）。

資料流：`tag-worker` 的 `analytics` job（`app/src/jobs/analytics-job.ts`）每小時 :20（`ANALYTICS_CRON`）用服務帳戶
唯讀讀取 GA4 Data API 與 Search Console，寫入 `site_metrics`（每日 × 來源 × 指標 × 鍵），API
`GET /api/v1/site-observation`（`app/src/v1/site-observation.ts`）彙整給網頁。網站程序不碰 Google 憑證。
`analytics-live` 每 2 分鐘（`ANALYTICS_LIVE_MINUTES`）讀 GA Realtime API 的最近 30 分鐘活躍使用者、瀏覽與每分鐘瀏覽
（source=`rt`，每次整批替換，不寫 job_runs）；只取總數，不取 `unifiedScreenName`，避免頁面標題帶出搜尋字詞。
超過 15 分鐘沒更新時 API 的 `live` 為 null，頁面不顯示「最近 30 分鐘」。API 與頁面快取 1 分鐘。

- worker 從專案 `.env` 讀 `GOOGLE_APPLICATION_CREDENTIALS`（指向 Git 外 0600 的 service-account.json）、
  `GA4_PROPERTY_ID`、`GSC_SITE_URL`；三者缺一則不排程。授權只用 analytics.readonly／webmasters.readonly，
  簽 JWT 換 token（`app/src/analytics/google.ts`），不印出回應內容。
- 首次執行回填 90 天；之後 GA 重抓近 7 天、GSC 近 10 天並整段覆蓋，晚到的資料與修正會補上。
- GA：只計 hostname `tag.observe.tw`。逐頁存瀏覽數與 GA 的頁面標題（去掉「 · 新文易數」）；同一路徑不同編碼合併，
  使用者取最大值不相加。`/search/` 一律只存路徑、不存標題，避免存到搜尋字詞。另存每日總瀏覽／工作階段／使用者、
  預設管道、裝置與 `open_original` 等自訂事件次數。
- `select_content` 依 `contentType`/`contentId` 存為 `select_content`（鍵 `event:897`、`tag:蔡英文`）。`open_original` 依 GA 內建
  `linkDomain` 存為 `original_domain`，再以近 30 天收錄文章與議題頁的網址主機對應媒體（去掉 www./m.，取篇數最多者），
  加總存為 `original_media`（鍵為媒體代號）；對不到的網域只留 `original_domain`。兩者目前只保存，不在網頁顯示。
- GSC：`dataState=all`（含尚未定案的近日資料），存每日點擊／曝光／平均排名與逐頁點擊／曝光，**不讀搜尋字詞**。
- Web Vitals 用 GA4 事件範圍自訂維度 `metric_name`、`metric_rating`（2026-10-05 已建立）。GA 不回補：建立前送出的
  `web_vital` 評級是空白，job 會略過；沒有已評級樣本時 `vitals` 為 null，頁面顯示一行說明。

手動跑一次（例如剛部署或想立即更新）：

```bash
set -a; . /home/deck/.config/tag-observe-analytics/analytics.env; set +a
PATH=/home/deck/.local/bin:$PATH node --env-file=.env tools/analytics-once.ts
```

驗證：`npx vitest run app/src/jobs/analytics-job.spec.ts`；整合測試 `app/test/integration.spec.ts`（需 `TEST_DB_URL`）
以假 Google 回應跑 job 兩次並檢查 API。

## 看板的本站線上讀者

看板的「本站線上讀者」使用同源 `/api/v1/reader-presence`，與 GA4 最近 30 分鐘活動人數分開。
全站可見頁面載入時、回到前景及每 30 秒送一次心跳；最近 90 秒內回報的瀏覽器計為在線。
不需點擊或重新整理，因此可見的常駐看板也會計入。頁面關閉、休眠或進入背景後最多 90 秒自然過期；
同一瀏覽器多分頁共享 localStorage 的隨機 UUID，24 小時輪替，不用 IP、網址、指紋或 GA 識別碼。
輪替交界可能有最多 90 秒的重疊；不同瀏覽器／無痕視窗仍各自計數，這是瀏覽器數估計，不能當成精確人數。

遵守既有「不計入統計」選擇、正式網域限制及自動化排除；storage 無法使用時不計入，避免按分頁重複計數。
看板顯示「包含你的瀏覽器」、「你已選擇不計入」或連線狀態，可點進設定頁調整。
請求失敗顯示 `—`，不假裝成 0。此心跳不增加 GA page_view；僅在 Google 腳本已載入、追蹤端點可連線時送出，以尊重阻擋追蹤的選擇。

目前由單一 Fastify gateway 在記憶體保存 UUID 與最後回報時間，每 90 秒清理，不寫資料庫或歷史紀錄；
服務重啟後會在下一輪心跳重建，若未來擴充多個 gateway，需先改為共用 TTL 儲存。
API 回應 `no-store`，GET/HEAD 不會建立讀者；POST 僅接受正式站 Origin 的 JSON 小型請求，沿用 API 限流。
它不是身分驗證或反作弊統計。舊 liveboard feed 的 `visitors` 仍保留 GA 資料相容性，但看板不再把它當線上人數。


### 看板綠點與防追蹤

綠點表示這個瀏覽器已通過追蹤可用性檢查，且本輪本站心跳成功；不是「全站有人」就亮綠點。
未計入或無法確認時為灰點，其他讀者的總人數仍可讀取。滑鼠提示說明自己的狀態。
使用者 opt-out、DNT=1/yes、GPC=true 時，Google tag 與心跳都停用。
Google 腳本尚未載入或遭阻擋，也不送心跳。

每輪心跳前，以不帶 measurement ID、使用者識別碼、事件、Cookie、referrer 的 POST，確認原本
`https://www.google-analytics.com/g/collect` 端點可連線；不代理、不改網域、不繞過封鎖。
DNS／Pi-hole、AdBlock 或網路錯誤導致失敗時，停止心跳並嘗試移除既有在線紀錄；無法移除時最多 90 秒過期。
檢查本身不產生 GA 瀏覽量。opaque 回應僅代表請求未遭瀏覽器阻止，不代表 GA 已入帳；
瀏覽器無法可靠辨認所有阻擋工具或針對特定事件的過濾，也無法區分斷網與防追蹤，統一顯示未確認。
