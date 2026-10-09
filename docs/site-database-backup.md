# 新站資料庫的 NAS 備份

每日 `tag-backup.timer` 呼叫 `scripts/backup-db.sh`，以 InnoDB single-transaction 匯出新站 `tag_observe`，包含文章 metadata、標籤、來源對照、內容封存索引及 migration journal。備份不取代母站 raw SQL 分包，也不是母站 CDC。

`tools/nearline/backup-site.py` 執行以下順序：

1. 取得單一工作鎖，確認本機有完整匯出及隔離還原需要的容量；檢查資料表皆為 InnoDB。
   主機排程在空間不足時先對已掛載的 `/home/.docker-data` 執行 trim；透過既有 Docker 管理權限，以無網路、僅加入 `SYS_ADMIN` 的暫存容器執行固定 `fstrim` 命令。如果仍不足，可提前回收較舊的本機備份副本：必須有成功完整還原與 NAS 發布收據、本機內容一致、NAS 收據逐位元相同，且 NAS 物件重新完整讀回 checksum 通過。保留最新已驗證的本機備份，也保留最新產生的 dump、失敗及無有效收據的檔案。本機 manifest 與 NAS 物件不刪除；回收過程記錄於新備份 manifest。仍不足或驗證失敗就停止，不降低 `資料庫大小 × 1.5 + 25 GiB` 門檻。
2. 串流匯出並以兩個 zstd threads 壓縮，成功與完整性檢查後才將 `.partial` 改成正式檔名。匯出前後 schema 不同時失敗，不宣稱同時完成 DDL 的備份可靠。
3. 在 `--network none`、`--skip-networking`、event scheduler 關閉的暫存 MariaDB 還原**整份** SQL。檢查 SQL 執行結果與完整資料表名單，結束移除測試容器及其 volume。失敗回傳非零，保留本機 dump 與失敗報告。
4. 確認 NAS 至少仍有 100 GiB 預留空間，上傳 `nas:Archive/tag.analysis.tw/site-db-v1/objects/<sha256>.sql.zst`，完整讀回驗證 hash，再上傳並讀回驗證 manifest。
5. 只有本次成功，才檢查超過 14 天的本機 dump；舊 dump 必須有成功 receipt，且對應 NAS 物件再次通過 checksum 才可清掉。本機 manifest 和 NAS 歷代物件保留。既有沒有 receipt 的老備份不自動清除。

本機資料在 `/home/deck/tag-analysis-private/backups`；manifest 記錄匯出 SHA256、schema hash、還原表名單、耗時、NAS 路徑。失敗不能當作已上傳／已還原。單次工作會保存 dump 開始時的交易快照，持續匯入的後續交易要等下一次備份；不能把它當作任意時間點復原。

取回時從 NAS manifest 選擇物件，以 `rclone copyto` 下載、比對 SHA256、`zstd -t`，再還原到獨立 MariaDB。來源原本的 definer／events 不應未經檢查便在新環境啟用；本工具的演練容器無網路且停用 event scheduler。不要直接將整份備份匯入仍在服務的資料庫。

NAS 與本機容量有限，沒有自動刪除 NAS 歷史或無限保存的保證。空間不足時工作會報錯並保留既有資料，需擴充容量；同一地點 NAS 也不是異地災難備援。

上傳或讀回失敗可從成功的完整還原 receipt 接續；先重新比對本機 dump 大小和 SHA256，內容不同就拒絕沿用還原結果。排程下一次啟動時先補傳這類失敗備份，再產生新快照。也可手動只補傳：

```sh
python3 tools/nearline/backup-site.py --resume /home/deck/tag-analysis-private/backups/<backup>.sql.manifest.json
```

工作啟動前確認 docker、rclone、zstd 存在。rclone 使用明確安裝路徑；systemd unit 亦設定工具 PATH，避免登入 shell 與排程環境不同。


## 容量壓力下的完整備份

2026-10-09 改成分階段容量檢查。先量 MariaDB data+index 與正式 tablespace 實占；匯出前保留估計匯出空間及 25 GiB。壓縮檔完成後，它已計入 SSD 使用量，再檢查隔離還原所需空間：來源實占與 metadata 較大者 × 1.15 + 25 GiB。匯出與還原期間每五秒檢查 SSD，低於 25 GiB 即中止暫存工作，不犧牲正式 DB 空間。這不取消完整還原，也不僅靠調低舊的一次性估算。

成功匯出但空間不足的 dump 保留 SHA、表名與來源空間證據。下次從同一份 dump 接續還原，不再製造另一份大檔。隔離容器使用較大的 redo log 與批次寫入設定以降低演練成本；只作用於無網路的拋棄式容器，正式 MariaDB 設定不變。

成功上傳、還原及 NAS 讀回後，可在容量壓力下回收前一份本機已驗證副本，保留最新成功 dump。匿名還原 volume 移除後執行授權的 Docker trim，讓區塊回到 SSD。容量維護另寫 `capacity-after-<backup_id>.json`，不修改已發布 manifest，避免後續 receipt 比對失敗。維護失敗與完整備份成功分開記錄。
