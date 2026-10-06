# 讀者體驗排查與修正（2026-10-07）

## 真實讀者資料

使用現有服務帳戶唯讀查詢 GA4 Data API，期間 2026-10-05 至查詢當日，限定
`hostName=tag.observe.tw`、`eventName=web_vital`，按 `pagePath`、`deviceCategory`、
`customEvent:metric_name`、`customEvent:metric_rating` 分組 `eventCount`。

- 首頁 LCP 16 份：8 good、4 needs-improvement、4 poor；desktop 13 份中 6 份偏慢，mobile 3 份中 2 份偏慢。
- 全站 LCP 46 份中 11 份偏慢：首頁 8、liveboard 2、topic 列表 1。
- CLS 的 2 份 poor 分別在 mobile `/event/archive/` 與 desktop `/topic/setn/21/`。
- GA 僅註冊 metric_name、metric_rating，沒有數值指標，無法從這份報表還原耗時或 p75。
- 舊版在指標結算時使用當下的 GA page_location；SPA 切頁後的路徑可能不是最初載入頁面。
  因此上述頁面分組是排查線索，不能據此認定根因，也不能當作 CrUX 評估。

## 已確認的程式問題

1. 正式站桌機的一次瀏覽，LCP 元素是首頁主圖；舊 sizes 以 55vw 估算且未限制最大值，
   下載 1920px 圖片，而實際圖片欄寬約 559px。調整成符合 640/1000/1152px 版型的 sizes，
   首圖設定 eager + fetchPriority=high，其餘圖片仍 lazy。
2. 首頁一次等待全部資料。主機端同一輪 API 讀取中，media-stats 約 3.77 秒，events、archive、
   ranking、media 約 0.03–0.21 秒。媒體清單、記者、議題與關係圖改為獨立 Suspense，
   在載入首頁時平行發出請求，焦點內容不等待這四份資料。媒體分布百分比仍由排行快照計算。
3. 議題新聞縮圖失敗時，ArticleThumbnail 原本整欄消失，會改變標題可用寬度。
   現在保留縮圖欄的寬高與連結，失敗時移除圖片而不移除欄位。
4. 媒體清單、其他串流區塊與頁尾統計預留高度。min-height 是降低位移的措施，
   不保證任何文字長度、字型設定下都零位移；事件存檔那份歷史 CLS 的確切原因仍未知。

## 新量測

WebVitals 使用 `web-vitals/attribution`，保留原本的一次結算與同意／排除規則。
`page_location` 使用 PerformanceNavigationTiming 的原始文件網址，移除 query/hash，
避免把文件 LCP 歸屬到之後的 SPA 路徑。CLS/INP 仍是整份文件生命週期，並非每次 SPA 換頁的新樣本。

新事件參數：

- `metric_target`：固定區塊名稱或 HTML tag；不傳 DOM 文字、id、selector 或圖片網址。
- LCP 的 `lcp_ttfb`、`lcp_load_delay`、`lcp_load_duration`、`lcp_render_delay`，單位 ms。

GA4 要在自訂定義註冊事件維度 `metric_target`、`page_type`，以及上述四個數值指標，
才可在一般 Data API 報表使用；既有唯讀憑證無法建立定義。本次未修改 GA4 管理設定。
自訂定義不回補歷史。DebugView／已設定的原始事件匯出可另行檢查事件參數。
比較修正後資料時應以部署日切開，不要把近 7 天的歷史樣本當作新版本即時成績。

## 驗證

- `app/test/home-loading.spec.ts`：四份附屬資料保持 pending 時，主內容仍能完成；失敗後可正常結束。
- 既有 analytics-consent 與 analytics-job 測試，合計 15 項。
- Web TypeScript 與 Next production build。
- 協作瀏覽器在本地 production build 的議題頁模擬縮圖 error：圖片移除，欄寬 80px、高 55px
  保留，所在列及下一列位置完全一致。390px iframe 手機版型亦通過：縮圖欄 64×44px、列高 109px，下一列位置不變。
- 獨立 production server + 測試 API 人為延遲 media-stats 4 秒：焦點新聞 HTML 0.572 秒抵達，
  全部串流 6.045 秒完成，確認主內容不等待媒體清單。此為控制情境的主機端 HTML 時間，並非讀者 LCP。
- 預覽同一入口的首頁、JS 靜態資源、site-observation API 均回傳 200；正式站未部署。

這份紀錄描述本地修正；部署狀態以實際 release 紀錄為準。
