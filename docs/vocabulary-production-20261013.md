# 完整詞庫與 30 天活躍集正式驗收

基底 origin/main：eac82fa6f9dcfc81b2922edb3f40d9d6140ec30e。正式 release 4aa4d41624adf46be21f2735e5afe12fc131a638 已包含詞庫、GA 隱私與 API no-store 程式；本次在 GA Network 驗收通過後，啟用私有詞庫 volume 的 gateway 設定，沒有重新建置或修改主 checkout。GA 與 admin 來源／補審見 [GA 紀錄](analytics-privacy-20261012.md)。

## 正式資料

完整快照 `e8a99a56-3008-4da8-86c6-64d1ff468b3f`，generatedAt 為 UTC 2026-10-12 17:29:51.650。此時間是產檔開始時的觀測時間，原子發布完成於約 17:31:56；分批統計並非單一資料庫交易快照。

| 指標 | 完整詞庫 | 活躍子集 |
| --- | ---: | ---: |
| 詞數 | 4,733,073 | 44,852 |
| 500 詞分頁 | 9,467 | 90 |
| 5,000 詞分頁 | 947 | 9 |
| gzip 分頁大小 | 342,731,078 bytes（326.85 MiB） | 3,813,205 bytes（3.64 MiB） |

完整池保留噪音標記 3,542 詞、noEqual 標記 297 詞；不移除原始標籤或任意合併大小寫。主活躍子集依使用者決定：近 30 天實際文章數至少 3、排除 noise、至少兩個 Unicode code points。沒有截成 50,000 詞。所有詞都有窗口統計，missingRecentCounts=0。

以下各組均排除 noise 和不足兩字的詞：

| 總文章數至少 | 3 | 5 | 10 | 20 |
| --- | ---: | ---: | ---: | ---: |
| 詞數 | 1,030,352 | 649,101 | 372,477 | 222,013 |

| 窗口 | 至少 2 篇 | 至少 3 篇 | 至少 5 篇 |
| --- | ---: | ---: | ---: |
| 30 天 | 70,439 | 44,852 | 28,122 |
| 90 天 | 119,782 | 78,432 | 49,559 |
| 180 天 | 195,171 | 127,657 | 81,034 |

180 天內至少 3 篇且總數至少 5 篇：118,353 詞。完整 36 組交集、checksum、來源水位和負載數字保存在 [JSON 證據](vocabulary-production-20261013.json)，也由正式 manifest 的 tiers 提供。

## 建置與磁碟

首次 tag-key 掃描於 UTC 13:31:21 開始，14:04:36 完成來源一輪，舊政策第一份完整檔約 38 分鐘完成；其後窗口補算 11 分 11 秒。這些是不同階段，不能把磁碟暫停的數小時算成連續查詢時間。

本次續建 583.745 秒（9 分 43.745 秒），先清空暫停期間累積的佇列，再約 125 秒串流產出新完整檔。3,406 次唯讀 SQL 合計 67.837 秒，最長 902 ms；SQL 回傳 1,074,421 列，觀測新關聯 5,805 列。這是回傳列數，不是 InnoDB 掃描頁數。待重算佇列為 0。首頁 274 次 TTFB 平均 72.85 ms、最高 659 ms，皆 200。

開始前預估新增完整 gzip 0.4–0.6 GiB、active 3–6 MiB，另預留 SQLite 暫存 2 GiB；/home 實測可用約 164 GiB，產出後約 163 GiB，過程中每約兩秒維持 10 GiB 保護。空間由其他協助者釋出，本次沒有清理既有 release、備份或 worktree。保留策略為 full 最近 3 份、active 最近 7 份及可接續的 changes；直接寫 gzip，不先產生未壓縮的大檔。

本次設定備份：`/home/deck/tag-analysis-private/backups/vocabulary-enable-20261012T1732Z`。既有 SQLite／快照備份仍保留。回滾可先停詞庫 timers，再移除本次新增的 vocabulary.conf、daemon-reload 並重啟 gateway；不需還原或更動正式 DB。gateway 啟動尚未 ready 的首個請求曾回 502，啟動完成後重驗 200，未將該次失敗算作通過。

## 快速層

UTC 17:33:40–17:34:04，正式 systemd 單輪 23.415 秒，讀取 312,365 列（包含熱門詞重算的 keyset 分頁），觀測 75 筆新關聯，發布 62 筆 changes，其中 51 筆 active=true。發布世代 `3b3008bf-0fc9-4e10-bd0f-3ca1e5ab9372`，總詞數淨增 3、pending=0。首次觀測新關聯至發布 23.041 秒；來源沒有 commit 時間欄位，不能聲稱這是資料庫寫入至發布的精確延遲。首頁 11 次平均 89.82 ms、最高 443 ms。

完整快照 current.id 日內保持固定；下游每 10 分鐘呼叫 changes?after=LOCAL_ID，省略 target 取得最新世代，後續頁固定回應的 target。每日以 active 子集對帳；完整池供首次匯入、封存與 409 復原。舊政策世代無法接到新政策根時回 409/resnapshotRequired，而非靜默漏資料。使用服務白名單 token，回應 gzip、private, no-store；沒有更動 Cloudflare。

第二輪 UTC 17:38:30–17:39:02：31.699 秒、403,205 回傳列、123 筆新觀測關聯、99 筆 changes、pending=0；觀測至發布 30.788 秒。兩輪完整證據見 JSON。跨兩代固定 target 逐頁取得 62+99=161 筆，逐頁 checksum 與 active 判定全部通過。

## HTTPS 完整驗證與排程

UTC 約 17:34:18–17:42:22，使用既有 YouTube 服務白名單 token（未記錄 token），每批最多 4 頁，依順序計算 hash；完整池 947 頁共 4,733,073 詞、active 9 頁共 44,852 詞全部讀完。每頁 checksum、nextCursor、詞數與全量 SHA-256 全部相符。整個驗證耗時 483.717 秒；首頁 39 次全為 200，TTFB 最高 855 ms。全量解碼後約 2.03 GB，這也是下游平日以 9 頁 active 為主、按需才重新匯入完整池的原因。

- full SHA-256：`bf86ecc0e9e082020596d8e79d8e938d355fe2945b775e850f823e1fb2848089`
- active SHA-256：`e9e34a99b9a218c356815502eed5f0de4d123366a82e96b6d5b947c90a84f6be`
- `/api/v1/vocabulary/snapshots/current`、`/api/`、`/api/status` 均 200，文件與狀態頁列出詞庫端點。
- tag、YouTube 首頁及 blog `/healthz` 均 200。

驗收後已啟用三個 timer：每整 10 分鐘快速增量、台北 04:01 七天輪轉對帳、04:17 每日完整快照。nice=15、idle I/O、MemoryMax=1G、SQLite 防重入鎖、首頁及 10 GiB 磁碟保護皆保留；每日產檔約 125 秒，低於 535 秒執行預算。timers 首次預定快速輪為台北 01:50；前述兩輪已用同一正式 service 手動驗證。

本次量測詞庫目錄實際配置 3,190,517,760 bytes，獨立 worktree 662,261,760 bytes；release 目錄目前 3,043,258,368 bytes。既有封存的歷史前後數字見 [空間紀錄](vocabulary-storage-20261012.md)，不能將其他協助者後來清出的空間歸於本次。尚未刪除本 worktree 的 node_modules 或任何既有 release／備份。
