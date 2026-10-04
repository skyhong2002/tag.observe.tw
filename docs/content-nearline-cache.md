# 新站正文與摘要的 nearline 快取

## 實作與上線狀態

2026-10-05 已完成正式資料庫備份與還原演練，並套用 0016 migration。此版本將近線快取與 GA4 一起納入正式 release；worker 的 NAS 設定已備妥。既有母站 SQL 分包封存仍獨立執行。

本功能保存的是新站 `articles` 中當次封存讀到的正文、摘要與文章 metadata，包含 `source=own`。它補上母站 SQL 備份通常沒有新站全文的缺口。不是逐次更新的變更日誌，不能恢復上線之前已清除的內容，也不保證保留兩次封存之間所有修改版本。

## 新保留規則

| 資料 | 新規則 |
| --- | --- |
| 本機正文、摘要 | 平常最後使用／取得後 90 天才成為淘汰候選；不是按發布日清摘要 |
| 容量壓力 | spool 所在檔案系統低於 20 GiB 可用時，候選門檻縮成閒置 7 天，且文章已過 7 天公開期；每包重新檢查空間 |
| 本機硬保留空間 | 低於 10 GiB 停止封存及取回；NAS 低於 100 GiB 停止新增封存。此時保留本機內容並報錯，需釋放其他空間或擴容 |
| 已封存文章索引 | title、url、media、日期、tags、authors、來源標記與對照繼續留在本機 |
| `source=legacy` | 不適用「14 天未抓取無標籤」整筆刪除 |
| 新站雜訊 | 只有 source=own、發布超過 14 天、未抓取、無標籤、無正文、無摘要、無封存索引且無來源對照，才可刪除；交易內鎖定後刪除文章與標籤關聯 |
| 公開全文 | 仍只在原發布時間後 7 天提供；從 NAS 取回不重開閱讀窗口 |
| 排行／工作日誌 | 原有兩年後排行縮成前 100 名、30 天清理執行紀錄仍保留；本功能不替這些資料做永久封存 |

目前使用時間由**單篇 content API 實際傳回正文或摘要**、以及內部 restore 工具更新，寫入以一天為粒度。列表、直接 SQL、其他分析工作並不自動視為 touch；新增內部使用者可呼叫 `touchArticleContent`。正文與摘要共用文章層級的快取時鐘。時鐘取最後使用時間與最後取得時間兩者較晚者，缺值時回退到原收錄時間。

## 寫入與清快取的順序

1. 讀取冷資料，每包最多 25 篇，JSON 未壓縮上限 32 MiB，gzip 打包。包含當時整列文章 metadata，並為每列與整包計算 SHA-256。
2. 上傳到 NAS `.partial`，發佈到內容 hash 命名的 `objects/<prefix>/<sha256>.json.gz`。
3. 從 NAS **最終物件路徑讀回**，比對壓縮檔 SHA-256。
4. 在 MariaDB `article_archives` 保存文章版本、物件位置、整包 hash、封存與驗證時間。
5. 條件式清空本機 body/description，並把 `articles.content_archive_hash` 指向真正清掉的那一版。清除前以 binary 比對內容、比較取得及使用時間，並再次確認過了公開期與閒置門檻。遇到並行讀取／更新就保留本機內容。

不用「最近驗證時間」猜要取回哪一版：多個版本可能同秒完成，也可能有版本封存成功但因競爭而沒有清掉本機。取回時跟隨文章上的明確版本指標。

未設定 NAS、NAS 斷線、空間不足、校驗失败、索引寫入失敗，均不能授權清除。中斷在索引寫入之後、清快取之前，最多留下多一份封存。物件不自動刪除。

每日 retention 預設最多處理 **5,000 篇內容**，每包 25 篇；`TAG_CONTENT_ARCHIVE_BATCH` 可設定 1–50,000。這是避免無限佔用 worker 的上限，不保證每次清完所有候選；應監看 `contentArchived`、`contentEvicted`、`cachePressurePages` 與剩餘容量。如果長期新增量高於處理上限，需調整頻率或上限。新站雜訊與其他日誌清理的 batch 仍為 500。

## 索引與來源對照

遷移 `0016_nearline-content.sql` 增加：

- `articles.content_accessed_at`：最後使用／取回時間。
- `articles.content_archive_hash`：本機淘汰的確切文章版本。
- `article_archives`：以 article_id + content_hash 保留多版本，記錄 remote、object key/hash、驗證時間。
- `article_origins`：以 source_key + raw_hash 保留來源版本，記錄新站 article_id、母站封存 generation/object、適配器版本。來源對照不隨文章刪除 cascade。

`article_origins` 已有 schema 與清理保護，但這次沒有把母站候選自動匯入正式 articles。後續匯入器須在同一個匯入交易保存對照，並把新取回內容的 content_accessed_at 設為實際匯入時間，不偽造原本 crawled_at。舊 `legacy-article-staging-v1` 報告中的刪除風險是當時舊規則的觀察；新版 v2 改列為歷史無標籤／待驗證封存提示。

## 啟用順序

1. 用既有資料庫備份流程保存正式資料與 migration journal。
2. 先套用 `npm run db:migrate`（2026-10-05 已在正式資料庫套用）。新增欄位／表不移除既有欄位；正式 ALTER 的鎖與耗時仍需依實際資料量觀察。
3. 在既有 `.env` 設定，憑證仍只放在現有 rclone 設定檔：

```dotenv
TAG_CONTENT_ARCHIVE_REMOTE=nas:Archive/tag.analysis.tw/content-v1
TAG_CONTENT_ARCHIVE_RCLONE_CONFIG=/home/deck/.config/nas-backup/rclone.conf
TAG_CONTENT_ARCHIVE_SPOOL=/home/deck/tag-analysis-private/content-archive-spool
TAG_CONTENT_ARCHIVE_BATCH=5000
```

4. 按現有 commit → scan → push → `scripts/install-service.sh` 流程部署。此次已整合工作目錄與遠端 main 的修改。worker unit 已補 rclone 所在的 PATH；schema 遷移必須先於新版程式。
5. 查看 retention job 日誌；未設定 NAS 時 `archiveDisabled=1` 且內容保留，不應把此狀態當成封存已啟用。

回退時保留新增表、索引與 NAS 物件。**舊 worker 有原先直接刪除內容的規則**，不能一面回退、一面宣稱仍受新封存保護；必要時先停 worker，直到部署相容的保護版本。

## 按需取回（內部工具）

```sh
node --env-file=.env tools/nearline/restore-content.ts --id 123
```

工具驗證 remote、物件 checksum、gzip、文章版本 hash 與 ID，且只填入正文和摘要均為空、來源身分與取得版本未改變的文章；不覆寫既有快取。不更動發布時間、source、標題或新站作者欄位。取回更新 content_accessed_at，可避免當天又被淘汰。

目前為明確執行的內部取回，**公開網頁不會自動等待 NAS 下載**。索引可繼續搜尋，但已淘汰的摘要不再參與本機 description LIKE 查詢；若要全文／摘要歷史檢索，需要額外的近線搜尋索引。已清空的 similarity sketch 也不因 hydrate 自動重建。

## 驗證與備援

- 自動測試：NAS／索引失敗不清內容、日期與容量門檻、內容校驗、恢復衝突、legacy／來源對照／封存索引保護、公開閱讀期限。
- 真實 MariaDB 11.4 套用全部 0000–0016 遷移，再對 NAS 的獨立 validation 目錄進行上傳／讀回／淘汰／取回。
- 模擬正文只有大小寫變更的並行更新，確認不會因資料庫不區分大小寫而清錯內容。
- 模擬本機剩 15 GiB，確認 30 天閒置內容會先封存、剛使用／取回的內容不會淘汰。
- 報告在 `/home/deck/tag-analysis-private/content-nearline-check-20261004/report.json`，只使用合成文章，正式 DB 未修改。

NAS package 含文章 metadata 與內容，可用於離線重建；日常快速取回依赖 MariaDB 索引，正式 DB（包含 article_archives 與 article_origins）仍須持續備份。這不是異地第二份副本，也不包含自動復原整個網站的程序。

2026-10-05 再次以隔離 MariaDB 與 NAS validation 目錄通過完整封存／取回驗證，報告位於 `/home/deck/tag-analysis-private/content-nearline-check-20261005/report.json`。正式資料備份為 `tag_observe-20261005-041917.sql.zst`，還原演練確認 18 張表。
