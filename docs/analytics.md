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
