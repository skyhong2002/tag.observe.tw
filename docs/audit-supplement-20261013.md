# 補交：4 筆 GA 稽核、Lighthouse 原始資料、admin 來源

## 4 筆舊合成請求

只列稽核，沒有刪除或修改 GA 資料，不算自然流量，也不算 GA 收件證據。cid/sid 未記錄，以下均不包含。

`/tmp/tag-ga-back-debug.log` 的 birth time 是 UTC **2026-10-12 17:15:51.857049630**，最後修改是 **17:16:13.785413622**。相對應 `.mjs` 於 17:15:51.851 建立、17:15:51.856 完成寫入。程式依序執行 landing、article、back、query、query-back，每次 state 固定等待 4 秒，共 20 秒；與 log 存續 21.928 秒相符。因此整輪可用 **17:15:51.857–17:16:13.785 UTC** 作為保守執行範圍，不能當成每筆實際送出時間。

依 HIT 在各 state 輸出前後的順序及尚未執行的固定等待，可再推算下列**上下界**；不是精確網路 timestamp：

| 順序 | en | 推算 UTC 範圍（2026-10-12） | dl（只留 path） | Google 傳輸／2xx |
| --- | --- | --- | --- | --- |
| 1 | page_view | 17:15:51.857–17:15:57.785 | `/` | 觀測到 browser request；沒有 response/status 紀錄，2xx 未知 |
| 2 | 無（endpoint probe） | 17:15:51.857–17:15:57.785 | 未送 dl | 同上；沒有事件名稱，不能算 page_view |
| 3 | web_vital | 17:15:55.857–17:16:01.785 | `/` | 觀測到 browser request；2xx 未知 |
| 4 | page_view | 17:15:59.857–17:16:05.785 | `/` | 觀測到 browser request；2xx 未知 |

當時程式只訂閱 `page.on('request')`，以 URL 含 `/g/collect` 篩選，再印 en/dl/dr/dt，**沒有保存完整 destination URL，也沒有訂閱 response**。頁面與測試預期是 Google collect，但不能從這份 log 逐筆獨立確認送到 google-analytics.com 並完成傳輸，更不能補稱收到 204。先前其他測試有 204 的紀錄，不可套用到這 4 筆。可機器讀取的清單見 [GA 稽核 JSON](analytics-synthetic-disclosure-20261013.json)。

## Lighthouse 原始資料與設定

三次量測時的正式 SHA 均為 **`adf47ee84fda870592bdf50d42694a1e396bcb5c`**，包含圖片／行動版修正 `c2f3233`。本機 Lighthouse **13.5.0**，Chrome 153；以下是原始 JSON 的 fetchTime（量測啟動時間）。

| UTC 2026-10-12 | score | FCP | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: |
| 17:48:03.951 | 78 | 2368.5985 ms | 4127.8945 ms | 0.0008018934 | 284 ms |
| 17:49:32.319 | 72 | 2417.8135 ms | 4438.5515 ms | 0.0008018934 | 386.5 ms |
| 18:07:18.298 | 73 | 3098.127 ms | 4690.889 ms | 0.0008018934 | 233 ms |
| 中位數 | **73** | **2417.8135 ms** | **4438.5515 ms** | **0.0008018934** | **284 ms** |
| 使用者原 PSI 基準 | 69 | 未提供 | 7800 ms | 未提供 | 未提供 |

三份報告設定完全相同：`formFactor=mobile`、`throttlingMethod=simulate`、RTT **150 ms**、`throughputKbps=1638.4`、`cpuSlowdownMultiplier=4`；Moto G Power 模擬 UA，412×823、deviceScaleFactor=1.75。原始設定另列 requestLatencyMs=562.5、downloadThroughputKbps=1474.56、uploadThroughputKbps=675，這些是 DevTools 節流欄位；本次 simulate 的網路模型使用前述 RTT／throughput，不能混為實際下載線速。三次主機 benchmarkIndex 分別為 3337、3464、3690.5。

上述符合 Lighthouse 公布的一般 mobile Slow 4G／4x 預設，但 **不能保證等於這份 PSI 基準的實際設定**。PSI 官方說明其 CPU 因子曾針對生產主機 benchmark 調整；本次沒有原 PSI JSON、CPU benchmark、Chrome／Lighthouse 版本可核對，所以只能並列觀測值，**不可作同條件直接比較或宣稱修正造成 7.8→4.44 秒的確定改善**。參考：[Lighthouse throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)、[PSI release notes](https://developers.google.com/speed/docs/insights/release_notes)。

原始報告完整保存在私有持久目錄，內容與 `/tmp/tag-psi-after-3/4/5.json` 逐 byte 相同，未改寫：

| 報告 | 持久路徑 | SHA-256 |
| --- | --- | --- |
| 1 | `/home/deck/tag-analysis-private/performance/20261013/lighthouse-mobile-1.json` | `256a179318ab2ff1391fd8b81afd5f54c439bd4c829b7ebb24064f96787236e0` |
| 2 | `/home/deck/tag-analysis-private/performance/20261013/lighthouse-mobile-2.json` | `5e7a83d23c345c2f28546f7928e12d8f38103831ce4fd9aeebdc6d8838d63a33` |
| 3 | `/home/deck/tag-analysis-private/performance/20261013/lighthouse-mobile-3.json` | `2c9ed8d5198193c716174421011d46535b8bd1ac16e94d6050a511f38e1d60b9` |

隱私證據更正：原 CLI 的 `blockedUrlPatterns` 以逗號串接，原始 JSON 顯示它被當作**單一 pattern**，而 Lighthouse 原始碼直接傳給 Network.setBlockedURLs，不能當成正確封鎖兩個網域的證據。三次原始 network audit 都是 **零 Google Analytics／Tag Manager 請求**，原 automation guard 未繞過；本次沒有因此新增 GA 合成事件。先前「明確 block」的敘述已修正，保留原始報告讓此限制可核對。

## 4aa4d41 admin 修正來源與補審

完整 SHA `4aa4d41624adf46be21f2735e5afe12fc131a638`，Git author／committer 都是共用 **Sky Hong**，提交時間 UTC 2026-10-12 17:10:19。此提交不是本工作建立；Git 無 thread/session 身分，不能可靠指出是哪位協助者。使用者轉達它於 17:14 正式部署，但沒有可用證據說明另一 thread 部署前做過什麼審查。

它只改 `app/src/tag-groups/relations.ts`，15 行 diff（9 增、6 刪）：從符合標籤的 article_tags／article_writing 先取候選文章 ID，下推 cursor 條件，再 STRAIGHT_JOIN articles。事後補審確認 requireAdmin 先於 SQL、參數綁定、UNION 去重、30 筆游標分頁與 no-store 保留。熱門標籤候選仍可能很多，沒有宣稱查詢是常數成本。

UTC **17:18:30**，獨立 MariaDB fixture `tag_admin_review_20261013` 的 writing.spec.ts **6 項通過**，包含未授權拒絕、游標、關係種類、唯一 ID 與跨頁去重。這是本工作的事後補審，不能冒稱另一工作事前已審。

主 checkout 的 `app/src/admin/routes.ts`、`app/test/admin-media.spec.ts`、`docs/login.md`、`web/src/components/article/ArticleView.tsx`，以及未追蹤的 `AdminFullText.tsx` 仍原樣存在。`git log 8df2828..4aa4d41 -- <這五個路徑>` 為空；4aa4d41 的檔案清單也僅有 relations.ts，沒有混入這五個未提交檔案。本工作持續只改獨立 worktree。
