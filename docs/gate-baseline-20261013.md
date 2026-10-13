# 整頁時間閘門 baseline receipt（使用者 13:39「1 2 都好」授權：閘門 = max(2s, 2× 該站 baseline)）
- 量測 UTC：2026-10-13T05:47:30Z–05:48:30Z（台北 13:47），量測當下 1 分鐘 load 3.36
- 量測端：本機 skyhong（與正式機同一台）經 Cloudflare 到正式站首頁
- 方法：curl -H 'DNT: 1' -H 'Accept: text/html'，各站 5 次、間隔 3 秒，取 time_total（完整下載 HTML）中位數；不加 cache-busting、不帶 cookie；只抓 HTML，不跑 JS、不載入 GA
- 原始紀錄：/tmp/babysit/baseline-raw-0547.txt

| 站 | 5 次 time_total（秒） | 中位數 | 2× | 閘門 max(2s, 2×) | cf-cache-status |
|---|---|---|---|---|---|
| tag.observe.tw/ | 0.256 0.243 0.241 0.269 0.528 | 0.256 | 0.51 | **2.0s** | HIT ×5 |
| blog.observe.tw/ | 3.085 3.297 3.225 2.758 2.974 | 3.085 | 6.17 | **6.17s** | DYNAMIC ×5（no-store） |
| youtube.observe.tw/ | 0.186 0.342 1.360 0.289 0.160 | 0.289 | 0.58 | **2.0s** | HIT ×2、EXPIRED ×3 |

注意：tag／YT 的 baseline 是 edge 快取命中的時間，不代表 origin；blog 是 DYNAMIC，等於 origin 實際渲染時間。
其他閘門不變：全站最多 1 個建置（含 skyhong-blog 遠端建置）、最多 2 個截圖瀏覽器、1 分鐘 load > 12 暫停、/home ≥ 40 GiB 才開建置／< 30 GiB 暫停、任一站 5xx 暫停、DNT=1、零 GA（網路層阻擋）。

原始receipt SHA-256：`c897d26530db7e78b988b5c8c2614d5baa6a7e1716d8852cdc29f43c612d267b`。這是babysit量測的副本，不是本thread重新量測。新build/deploy/capture receipt須含本baseline與實際開始/結束時的fresh samples，不沿用baseline樣本當啟動許可。

解讀補充：原receipt的「DYNAMIC」在此指未快取HTML請求的端到端時間；time_total仍包含網路、TLS、Cloudflare處理、來源等待及傳輸，不能單独歸因為origin渲染耗時。上方原文保留用於來源核對，數值與閘門不變。
