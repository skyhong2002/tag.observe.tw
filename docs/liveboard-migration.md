# 即時看板移轉至 live.observe.tw

## 路由與程式邊界

- 公開 gateway 將 `/liveboard`、`/liveboard/`、`/liveboard/advanced/` 及其他舊看板子路徑直接以 301 轉至 `https://live.observe.tw/`，保留 query string。新站沒有舊 advanced 路徑，因此不拼接舊子路徑。
- 舊 `/liveboard/setting/` 與 `/liveboard/settings/` 直接轉至新站設定頁，保留 query string。
- 舊 manifest 路徑轉至新站 `/manifest.webmanifest`。已安裝的舊 App 啟動網址會經 gateway 轉址；跨網域的 App 身分不會自動移轉，需在新站重新安裝。
- Next 亦配置永久轉址，供獨立開發伺服器使用。正式公開入口以 gateway 為準。
- 移除 `web/src/app/liveboard/`、四個 `web/src/lib/liveboard*.mts`、離線字標產生器、專用前端測試及 GA 心跳（包含最新主線的 SimpleBoard、場景、設定頁與專用測試）。頁尾直接連至新站。
- 保留 `/api/v1/liveboard`、事件與 coverage、排行、媒體、Tag 文章 API，以及其後端測試。這些是新站的資料來源，不是待刪除的 UI；資料庫、爬蟲及 worker 繼續由 tag 站維護。

## 移轉驗證（2026-10-25）

最終以 `origin/main` 的 `8d7b0a0d` 為基底，保留新版帳號、live 偏好 API 與所有共享後端；新站基底為 `62a8cb4`。

正式新站首頁與瀏覽器文字雲可正常載入；`/api/board?full=1&history=0` 回傳 `status: ok`、`partial: false`，full 資料包含 40 篇文章、12 組相似報導、60 筆內文、12 個議題，以及 events、coverage、ranking、media、totals、readerPresence、activity。這證明公開資料可供獨立看板取得，不代表所有舊畫面功能已逐項驗收。

## 功能與使用者設定

舊一般版的「我的 Tag 追蹤」使用 `tag-liveboard-follows-v1` localStorage，最多五個精確 Tag，並另外呼叫 `/api/v1/tags/:tag/articles?hours=24&limit=8`。跨網域轉址不能讀取或搬移這份瀏覽器資料。已在 `skyhong2002/live.observe.tw` 補上獨立 Tag 追蹤面板，沿用相同 API、五個精確 Tag、最新三則、失敗保留結果、暫停與同源分頁同步；每兩分鐘更新，使用者在新站重新加入追蹤。既有安裝與使用者設定不會自動移轉。

新站「原版新文易數看板」回鏈已改為新文易數首頁，避免轉址後自我回鏈。舊實作及其測試可從此變更之前的 Git 歷史取回，以供核對或補移植。

本文件記錄程式邊界與檢查結果，不代表此次轉址已部署。
