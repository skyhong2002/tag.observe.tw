# 手機效能與內容一致性驗收（2026-10-05）

## 方法與限制

使用無頭 Chromium、390×844 CSS px、DPR 2、mobile/touch 模擬、CPU 4 倍降速、150 ms 延遲、下載 1.6 Mbps／上傳 0.75 Mbps。每個樣本使用新瀏覽器 context，載入後等待 8 秒，再點擊兩次深淺色切換並捲動。`web-vitals` 收集 LCP、CLS 與這些指定操作的 INP。

前後正式建置使用相同基底 442812a 與固定 API 回應代理，兩個 localhost 伺服器採相同網路／CPU 設定。排行與事件各比較三個樣本的中位數。這是少量實驗室測試，不是真實手機硬體、真實流量第 75 百分位，也不能代表所有操作或所有頁面。LCP 有量測波動，未宣稱整站載入時間一定改善。

| 頁面 | LCP 前 → 後 | 指定操作 INP 前 → 後 | CLS |
| --- | --- | --- | --- |
| 排行 | 1504 → 1452 ms | 280 → 224 ms | 0 → 0 |
| 事件 897 | 644 → 652 ms | 160 → 128 ms | 0 → 0 |

排行首批 JavaScript 傳輸約 383,233 → 195,412 bytes（−49%）；小圖不再需要 ECharts。事件／標籤大圖若已在首屏附近，仍會正常載入，不能期待該頁完全不下載圖表程式。另以 390×200 視窗確認事件圖在畫面外時無 canvas、JavaScript 約 190 KB，捲入後才到約 403 KB 並產生圖表。

首次公開站抽查首頁、排行、事件、標籤：LCP 約 1.0–2.4 秒、CLS 0；最大內容主要為文字。固定資料測試的首頁則有新聞圖成為 LCP，約 1.7–2.5 秒。圖片不是此次證據最明顯的瓶頸，因此保留既有尺寸、lazy/eager 策略及畫質，沒有盲目降低所有配圖品質。

## 實作與驗證

- 裝飾性趨勢圖改為 SVG，保留排名方向、空值斷線與面積填色；單元測試涵蓋零值、平坦資料、空資料與缺值。
- EventChart／TagChart 的程式在接近畫面時才下載；固定容器高度避免載入位移。
- 事件圖切換主題時沿用既有 ECharts instance；瀏覽器驗證 canvas 不被重建。
- 正式站 GA 啟用後回報真實 Web Vitals，欄位與設定見 [analytics.md](analytics.md)。測試以攔截 GA 網路的瀏覽器驗證佇列有 LCP／CLS／INP，未宣稱已在 GA 後台驗證收件。
- 過期但仍在 API 快取的節錄，經模擬 API + SSR 驗證不出現在正文或 metadata，並依頁面剩餘內容套用 noindex。
- 排行的模擬 INP 仍為 224 ms（略高於 200 ms）；保留這個限制，後續根據真實裝置評級、操作種類與樣本量決定下一輪優化。

## 重跑

從專案根目錄執行（需已安裝 web 依賴與 Playwright Chromium）：

```sh
node tools/mobile-audit.mjs https://tag.observe.tw production
```

結果寫到 `/tmp/tag-mobile-production.json`。腳本阻擋 Google Analytics 請求，避免效能測試污染流量。可用 `AUDIT_PATHS='["/ranking/","/eve/897/"]'` 指定頁面；要做可信的前後比較，請使用固定 API 資料、相同建置模式及節流條件，避免與建置／其他重負載工作同時執行。
