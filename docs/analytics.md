# GA4 與 Search Console

正式網站：`https://tag.observe.tw`。GA4 評估 ID：`G-D1E1CZSX7L`（公開識別碼，非密鑰）。

`SiteAnalytics` 在 hydration 後，僅在 production 且 hostname 為 `tag.observe.tw` 時載入 Google tag。localhost、開發模式與其他預覽網域不送資料。阻擋追蹤腳本的瀏覽器不會影響網站操作。

## 評估方式

- 初次瀏覽與 Next.js 站內切頁交由 GA4 加強型評估處理。串流的「網頁瀏覽 → 進階設定 → 根據瀏覽器記錄事件變更網頁」需開啟；程式不另外送 `page_view`。
- `open_original`：點擊共用 `SourceLink` 的原站連結，參數為 `link_domain`、`source_page_type`。不代表原文讀完。GA 自動外連 `click` 可能同時存在，兩者不可加總當作原文點擊數。
- `select_content`：點擊本站標籤／事件連結，參數為 `content_type`（tag/event）、`source_page_type`。
- `rss_click`：點擊本站 RSS 連結；不代表訂閱成功。
- `app_installed`：瀏覽器發出 `appinstalled`，不以按安裝按鈕或接受提示代替。未提供此事件的瀏覽器無法量到。

自訂事件不送標題、搜尋字詞、完整外連 URL 或使用者識別碼。但 GA 加強型評估仍會收集網頁網址、標題、外連與站內搜尋等資料；上線管理時需檢查資料刪改設定（電子郵件及 URL 查詢參數，例如 `q`），若不需要搜尋字詞報表可關閉站內搜尋評估。URL 刪改不會自動清理頁面標題，搜尋頁標題也應避免帶入敏感輸入。

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

公開入口：`/observe/`（搜尋表現／熱門內容／使用體驗）、`/readers/`。
資料端點：`GET /api/v1/site-observation`。網站只讀取本機彙整快照，不存取 Google 憑證。

手動更新（在 skyhong-SM 的 deck 執行，**沒有新增排程**）：

```bash
set -a
source /home/deck/.config/tag-observe-analytics/analytics.env
set +a
/home/deck/.config/tag-observe-analytics/venv/bin/python tools/refresh-observation.py
```

預設快照位置為 `~/.local/share/tag-analysis/analytics/public.json`；可用 `TAG_ANALYTICS_SNAPSHOT`
覆寫，但更新程式與網站 API 必須使用同一路徑。快照位於 Git 與 immutable release 之外；
更新程式僅用 analytics.readonly／webmasters.readonly，Google 私鑰留在既有的 Git 外 0600 檔案。
網站程序不用載入 Google 授權環境。

- 所有必要 API 與合格頁面的標題查核完成後，原子替換快照。失敗保留前份成功資料；缺檔／格式不正確時 API 回傳 `snapshot: null`，不暴露錯誤內容。
- 頁面顯示最後成功更新時間，超過 48 小時提示未更新。API 可快取 60 秒；頁面伺服器讀取不快取。這不是 uptime 監控。
- GA4：台灣時間近 **7 個完整日**、只計 `tag.observe.tw` hostname。故今天剛建立的資料不會立即出現在排行；資料處理仍可能延遲。
- 排行只取有效 canonical 的 `/eve/{id}/`、`/tag/{tag}/`，排除 noindex、重導與不存在的頁面。用公開頁的 OG 標題；查核 HTTP 不帶任何 Google 授權。最多 20 筆，每頁至少 10 views／3 activeUsers。不同 URL 編碼的 views 相加、users 取最大值作為下限，避免重複加總使用者；不公開逐頁 users。
- 未能回溯剔除初期測試流量，頁面明示可能包含測試。門檻是減少小樣本誤導，並非保證匿名化或人氣可信度。
- GSC：太平洋時間近 28 個完整日、type=web、dataState=final。提供整體 clicks／impressions／CTR 與每日序列，不提供個別搜尋 query、來源或個人紀錄。沒有 rows 代表沒有回傳可用資料，不能寫成零曝光；未回傳日期不補零。這不是逐 URL 收錄報告。
- GA 遇到超過 10,000 rows、sampling 或 `(other)` 聚合資料遺失，拒絕發布不完整快照。
- Web Vitals 需要 GA4 **事件範圍自訂維度** `metric_name`、`metric_rating`。現有 Viewer 不能建立，更新程式只查 metadata，不修改設定。管理員可在 GA4 管理 → 自訂定義建立，事件參數名稱填上述字串；不回補歷史，通常需等待 24–48 小時。不要將 metric_id 註冊為高基數維度。
- 若維度尚不存在，`experience.status=definitions_missing`；存在但樣本不足則 `insufficient`。每項至少 30 份已知 rating 樣本才發布「良好比例」，所有裝置合計；未做裝置分層，**不是 p75，也不是 Google CWV 通過率**。計數為事件樣本而非使用者。沒有互動不一定有 INP。

驗證：`python3 -m unittest discover -s tools -p 'test_refresh_observation.py'`、
`npx vitest run app/src/v1/site-observation.spec.ts`。
