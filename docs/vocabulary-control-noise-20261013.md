# 控制字元補標與完整詞庫再驗收

本輪基底 origin/main `1068b2d1c95a294cea4f4f7f9bfc94e39c3dd5c4`；控制字元規則 commit `ca8662c`、SQLite NUL 原樣讀取 commit `e363b71`，均已 push。產出快照時 release 為 `7685825a6101644af2a2d576f176447d10346910`；最後正式 release `48083b58c4ee3d16f2072206f1da3df332f34143` 加上 HSTS，包含前述修正。沒有改主 checkout 或兩個下游程式。

C0、DEL、C1（Unicode Cc）標為 noise，原因 `control-character`，不刪除、不 trim 原詞、不改原 SHA-256 ID／統計。檢查發生於 normalize/trim 之前；ZWJ 等 format 字元不因本規則被當成控制字元。一次性私有 SQLite 每批 5,000 詞、可續跑，將既有控制字元詞 upsert 寫入 changes，讓舊下游也收到補標，沒有正式 DB trigger 或新增 DB 寫入。

額外邊界測試發現 Node SQLite TEXT 會在 NUL 處截斷，已在發布前中止首輪產檔、維持舊 current，再補 `CAST(label AS BLOB)` 原 UTF-8 讀取，涵蓋 pending、游標、分組與刪除異動。私有彙總唯讀檢查中 NUL 詞數為 0，未發現既有詞受影響。UTC 18:13:04 起，包含隔離 MariaDB fixture 的 34 項測試通過；OpenAPI→docs/api.md 生成一致，TypeScript、Biome 通過。

## 正式快照

ID **`724f4e57-a077-49d6-a2f0-4075d46e8341`**。generatedAt UTC 2026-10-12 18:16:48.596 是產檔開始，原子發布完成於 18:19:11.647 左右。來源為分批觀測，不聲稱是單一 DB transaction snapshot。

| 指標 | 完整詞庫 | 活躍集 |
| --- | ---: | ---: |
| 詞數 | 4,733,121 | 44,865 |
| 每頁 500 | 9,467 頁 | 90 頁 |
| 每頁 5,000 | 947 頁 | 9 頁 |
| gzip 檔案 bytes | 342,766,901 | 3,817,382 |

活躍政策維持使用者決定：近 30 天文章數至少 3、非 noise、至少 2 個 code points。完整池噪音 **4,432**、noEqual **297**；其中 **891** 個詞含控制字元。changes gzip 92,270 bytes；總 gzip 346,676,553 bytes。

所有下列 tier 都排除 noise 與不足 2 字：

| 總篇數門檻 | ≥3 | ≥5 | ≥10 | ≥20 |
| --- | ---: | ---: | ---: | ---: |
| 詞數 | 1,030,237 | 649,019 | 372,416 | 221,967 |

| 窗口 | ≥2 篇 | ≥3 篇 | ≥5 篇 |
| --- | ---: | ---: | ---: |
| 30 天 | 70,468 | 44,865 | 28,124 |
| 90 天 | 119,803 | 78,445 | 49,568 |
| 180 天 | 195,192 | 127,662 | 81,039 |

180 天內至少 3 篇且總數至少 5 篇：118,355。其餘交集與完整 metrics 見 [JSON](vocabulary-control-noise-20261013.json)。

## 負載、changes 與 HTTP 驗證

完成輪耗時 **201.207 秒**，唯讀 SQL 342 次、合計 11.368 秒、最長 902 ms；來源回傳 496,277 列，新觀測 165 筆關聯，pending=0。另私有 SQLite 掃描 4,733,121 個 label，補送 891 詞，沒有額外掃正式 DB 全量。首頁 96 次全 200，平均 72.85 ms、最高 **661 ms**。

這輪 firstObservedToPublished 462.603 秒包含刻意中止及部署 NUL 修正的等待，不作一般快速層效能數字。之後 18:20 排程快速輪為 **35.325 秒**，回傳 **562,472 列**、63 筆新關聯、pending=0，首次觀測至發布 **34.389 秒**，首頁最高 572 ms；沒有 DB commit timestamp，不能當成文章實際寫入到發布的精確延遲。

從舊 head `704eca9c-4a63-4803-8228-384abc092a81` 到新 full，3 頁共 1,148 個 changes 全部 checksum 通過，包含全部 **891** 控制字元詞，noise=true、active=false、ID=原 UTF-8 的 SHA-256。``（backspace）仍為 14 篇，`比基尼` 仍為 1 篇，兩者原 label／ID／篇數均與舊完整快照相同，只有 noise 由 false→true。[逐項證據](vocabulary-control-changes-20261013.json)。

HTTPS 使用既有服務白名單 token、每批最多 4 頁，完整 947 頁及 active 9 頁全部讀完；每頁 hash、總 hash、cursor、詞數一致，並逐詞檢查所有控制字元標記，沒有在 active 出現。耗時 **484.524 秒**，首頁 39 次全 200、平均 118.72 ms、最高 **483 ms**。

- full SHA-256：`83947aa497af0fbdb39dd172d5a8802c39975a7bebbc6a44a004e87ebe81dd9a`
- active SHA-256：`ae1205158902f4029043d06057687944267d6d219149d4ecda5ae737c5464131`

每 10 分鐘增量、台北 04:01 輪轉對帳、04:17 每日完整快照的三個 timer 均啟用；低優先權、防重入、TTFB 1 秒與磁碟 10 GiB 保護保留。full 留 3 份、active 留 7 份，changes 維持可接續鏈。

產生前估新增 0.4–0.6 GiB gzip、預留 2 GiB 暫存，可用空間約 158 GiB；最終約 156 GiB，整輪高於 10 GiB。沒有再封存／刪除任何既有 release、backup、worktree 或 node_modules。只清除本輪產生且證據已保存的暫存及 staging。

UTC 18:28:57 起，最終 release curl：三站健康檢查皆 200；匿名 API public,max-age=60，Cookie／Authorization／X-Service-Token／X-Api-Key 四組皆 private,no-store。[最終部署證據](final-deployment-verification-20261013.json)。HSTS 與 GA／PSI 稽核分別見 [HSTS](hsts-20261013.md)、[三項補件](audit-supplement-20261013.md)。
