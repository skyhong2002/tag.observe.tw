# 行動版圖片、對比與觸控目標改善

程式 commit `c2f3233`（已 push），基底 origin/main `eac82fa6f9dcfc81b2922edb3f40d9d6140ec30e`。正式 release `adf47ee84fda870592bdf50d42694a1e396bcb5c` 於 UTC 2026-10-12 17:45:04 通過正常部署流程；建置前空間通過 10 GiB 門檻，備份位於私有 backups/mobile-performance-20261012T1743Z，保留先前 4aa4d41 可回滾版本。未刪除既有 release／備份。

## 改動與實際畫面

LCP 是首頁 hero 圖（手機畫面 378×213）。它已由 SSR 提供、eager/high priority，不需要等 client JS；保留此載入方式，降低其他新聞圖和媒體圖示的優先權，避免競爭頻寬。媒體圖示改以 Next image optimizer 產生正確 32/48px srcset、WebP、lazy loading；修正帶版本 query 的本地 favicon 白名單，其他本地圖仍拒絕 query，沒有放寬遠端任意來源。

實例：mknews 圖示由原始 PNG 66,332 bytes 改為 48px WebP 614 bytes。圖片的固定尺寸減少版面偏移；非首屏新聞圖和圖示延遲載入。主圖既有 next/image 的 sizes、SSR、高優先權保留。Lighthouse 三次 LCP 圖片發現延遲為 12.1、15.5、22.0 ms，顯示沒有 client-only 載入鏈。這是 trace 中的分段資料，不可與模擬 LCP 4.44 秒直接相加。

陣營欄底色加深，白字對比實測為 5.364、6.832、7.720，明暗模式均達 AA 一般文字門檻。事件媒體連結至少 24×24，coarse pointer 改 44×44；更多按鈕及媒體清單展開按鈕亦留足觸控範圍。展開按鈕移到列表下方，避免覆蓋最後一列圖示。

T3 協作瀏覽器 412px 寬驗證：完整媒體清單已呈現、331 張圖片無破圖、頁面無水平溢出；fine pointer 媒體連結 24×24，展開按鈕高 44，與清單末端相距 10px、不重疊，展開／收回成功。coarse pointer 的 44px 規則已檢查程式與樣式，不將桌面 fine pointer 實測冒稱成實機觸控測量。

前端 TypeScript、Biome、release smoke 通過。UTC 17:45:47 curl：匿名 `/api/v1/articles?limit=1` 為 200 / public,max-age=60；Cookie、Authorization、X-Service-Token、X-Api-Key 各為 200 / private,no-store，Cloudflare 設定未動。

## 三次量測

使用主機 Lighthouse mobile 預設模擬；只跑改完後的量測。三份 network audit 均無 Google 分析請求，沒有繞過 automation、DNT 或其他隱私防護。補查 raw config 發現 CLI 的逗號串接被當成單一 blockedUrlPatterns 字串，不能當作有效 URL 封鎖；先前「明確 block」的說法在此更正。本次零請求的證據是原始 network audit 與保留的 automation guard，沒有因此補送任何測試事件。

| UTC 2026-10-12 | 分數 | LCP | FCP | CLS | TBT | 無障礙 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 17:48:03.951 | 78 | 4.128 s | 2.369 s | 0.000802 | 284 ms | 100 |
| 17:49:32.319 | 72 | 4.439 s | 2.418 s | 0.000802 | 386.5 ms | 100 |
| 18:07:18.298 | 73 | 4.691 s | 3.098 s | 0.000802 | 233 ms | 100 |
| 中位數 | **73** | **4.439 s** | **2.418 s** | **0.000802** | **284 ms** | **100** |
| 使用者提供的原 PSI 基準 | 69 | 7.8 s | 未提供 | 未提供 | 未提供 | 未提供 |

原基準未重跑，不填造缺少的 FCP／CLS／TBT。INP 是 field data，本次沒有量測，也不拿 TBT 代替 INP。圖片可省大小由使用者原 PSI 817 KiB，降至這三次各 66 KiB；剩餘主要為新聞圖／詞雲，不聲稱圖片已完全無改善空間。LCP 仍超過 2.5 秒良好門檻，TBT 仍有改善空間。

部署後最早兩輪因 media-stats 冷快取／逾時，媒體目錄是暫不可用占位，頁面內容不完整，**不納入**上述三次；等待正常完整目錄恢復後才開始有效量測。正式新聞內容及 DOM 數會變，主機 Lighthouse 與遠端 PSI 環境也不同，所以前後差值是觀測對照，不能全數歸因於此改動。[精簡 JSON](mobile-performance-20261013.json) 保留每次數值與排除原因。
