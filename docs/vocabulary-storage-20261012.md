# 詞庫空間核算與保護（2026-10-12）

23:00 台北時間量測 `/home` 可用11,639,242,752 bytes（10.84 GiB）；稍早警告抵達時只有6.6 GiB，已立即終止快照和release建置，僅清理本次未完成staging。正式版本仍872ef7c；未切到候選新版。開始任何大檔工作前重查10 GiB門檻，空間變化以執行當下為準。

| 本次可歸屬項目 | 目前實際配置空間 |
| --- | ---: |
| 詞庫彙總、既有快照與日誌 | 2.63 GiB |
| 詞庫部署備份（SQLite gzip及快照） | 1.01 GiB |
| 獨立worktree（含node_modules） | 0.62 GiB |
| 本次已部署872ef7c release | 0.57 GiB |
| 從舊release轉成的22份壓縮封存 | 3.00 GiB |

上述項目共約7.83 GiB；封存是既有資料換儲存形式，不能把3.00 GiB全部當作本次淨增加。新門檻快照尚未成功產檔，預估完整gzip約0.4–0.6 GiB、44,695詞active約3–6 MiB，需實測後更新。新版release通常約0.6 GiB，建置staging尖峰另外約1–2 GiB。後續保留3份full約1.2–1.8 GiB、7份active約21–42 MiB；changes及SQLite增量另留餘裕。這些是容量規劃估計，不是已完成新版快照的檔案量測。

## Releases封存前後

22份封存於新的10 GiB／清理確認規則訊息抵達前已完成。每份均先完成gzip tar，再用 `tar --compare` 解壓讀取並對照原目錄的內容及屬性，成功且fsync後才移除展開目錄。目前release、前一個可回滾release及最近七份皆保留。沒有在新規則抵達後继续封存或刪除其他release。

以一般檔案的邏輯內容位元組計，封存前 **27,833,679,670 bytes（25.92 GiB）** → 封存後 **19,123,221,496 bytes（17.81 GiB）**。前值由保留目錄加上已核對封存的展開內容回推，非當時的df讀數。移出內容8,710,458,174 bytes，壓縮封存3,223,841,381 bytes（3.00 GiB），邏輯內容淨省約5.11 GiB。封存後releases目錄的 `du -sB1` 實際配置為20,944,154,624 bytes（19.50 GiB）；包含檔案系統區塊配置，與邏輯內容度量不同。

封存位於 `/home/deck/tag-analysis-private/release-archives/<commit>.tar.gz`；可使用 `tar -xzf <archive> -C /home/deck/.local/share/tag-analysis/releases` 還原。還原亦屬大檔工作，須先通過10 GiB空間門檻。原始服務設定、詞庫SQLite備份及回滾指標未刪除。

## 程式保護

- 匯出／補算開始前與執行中檢查 `/home` ≥10 GiB；不足保留checkpoint並暫停。
- release安裝在建立staging前检查同一門檻。
- full保留3份，active保留7份；過期full與changes回409，不保留沒有用到的全量檔案。
- 分頁在記憶體以500詞為界編碼後直接寫gzip，沒有先写未壓縮全量檔案。
- 其他release、worktree、備份及node_modules不自行清理；需要另外取得使用者同意。本次worktree node_modules的清理已提出確認，收到同意前保留。
