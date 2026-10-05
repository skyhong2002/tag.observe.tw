# 母站資料近線封存 pipeline

## 用途與保證

把母站 MySQL `tag` 分包保存到 `nas:Archive/tag.analysis.tw/nearline-v1`，需要哪張表／哪個主鍵範圍，再抓到本機 SSD 還原。NAS 不運行資料庫，也不存放使用中的 datadir。原本 `Archive/tag.analysis.tw/2026-10-04/` 的核心副本繼續保留。

來源目前為 MySQL 5.6，幾乎都是 MyISAM，binlog 關閉。本 pipeline 是**在線、無顯式鎖表的逐段封存**，不是同一時間點的全庫快照，不能做 point-in-time recovery。資料在兩次掃描間新增又刪除，仍可能完全沒有被保存；外鍵／關聯資料也可能來自不同時間。MyISAM SELECT 本身仍可能短暫阻擋寫入，因此採短查詢、分包、單工、限速；不會自動停寫、修復來源或啟用 binlog。

`show_tag_hour` 已知無法 SHOW CREATE TABLE，明列 excluded（即使 information_schema 不再列出該表）。其餘表錯誤會保持未完成並重試，不會當成功。`complete_with_gaps` 只代表其餘範圍掃完，**不代表全庫無缺漏或一致性備份**。

## 資料流程

1. 透過既有 `tag-analysis` SSH 與來源既有 MySQL 登入設定取得盤點；不複製憑證、不修改來源表。
2. 分別保存結構、資料，以及 routines/events/triggers。程式物件獨立保存，避免還原資料時觸發舊 trigger 或排程。
3. 有單一整數主鍵的表，以索引 keyset 分包；每張表開始时記錄最大主鍵，依 `(lower_exclusive, upper_inclusive]` 範圍擷取。預估每包 32 MiB 原始 SQL、最多 50,000 列，原始 SQL 超過 256 MiB 時自動減少列數重試。小型無合適主鍵表整表匯出，大型無主鍵表列為 blocked。
4. 母站串流 gzip 壓縮；本機驗證傳輸 SHA-256、gzip CRC 與原始大小。一次僅處理一包，暫存約數百 MiB，無須放下完整資料庫。
5. 先傳 `.partial`，從 NAS 讀回比對 SHA-256，再發佈物件。物件以內容 hash 命名，既有相同內容讀回校驗後重用。
6. 每包驗證後保存本機進度與 NAS manifest；只有成功物件會推進游標。斷線／重啟從上次進度繼續。NAS 已有物件但 manifest 尚未提交時，最多重做該包，不會跳過它。
7. 全部可讀表掃完後保留整代 manifest；完成後等待 7 天再開新一代重新掃描，以保存更新和刪除後的表版本。不假設舊 ID 資料永不更動，也不是僅抓 MAX(id) 之後的資料。

NAS 佈局：

```text
nearline-v1/
  objects/<hash前兩碼>/<sha256>.sql.gz
  generations/<UTC時間-隨機碼>/manifest.json
```

manifest 包含來源、引擎、表結構物件、主鍵範圍、各包擷取時間、壓縮／原始 SQL 大小、SHA-256、錯誤與完成狀態。metadata 的 estimated_rows 是來源估計，不是已驗證還原筆數。每表結束會再次比對結構；忽略 AUTO_INCREMENT 下一值變動，其餘 DDL 變動列為 blocked。

SQL gzip 選擇是為了來源 Python 2.7／MySQL 5.6 的相容性。可直接還原到隔離 MariaDB；日後若要 Parquet 分析，可由已驗證封存離線轉換。

## 安裝與排程

需 Python 3.11+、SSH、rclone、systemd user services；母站需 Python 2.7+、mysql、mysqldump、nice、GNU timeout。rclone 使用既有 `/home/deck/.config/nas-backup/rclone.conf`。repo 的設定範本不含密碼。

```sh
python3 -m unittest discover -s tools/nearline -p 'test_*.py' -v
bash tools/nearline/install.sh
```

安裝腳本將程式複製到 `/home/deck/.local/share/tag-legacy-nearline/`，不直接執行正在編輯的 worktree。設定在 `/home/deck/.config/tag-legacy-nearline/config.json`；更新程式後重新安裝。進度在 `/home/deck/tag-analysis-private/nearline/state.json`，權限私有。

預設每次最多 30 分鐘／128 步（結構與完成檢查也算一步）；批次結束休息約 5 分鐘，再繼續。單次來源程序限時 300 秒；步驟邊界才檢查批次預算，最終耗時可能超過 30 分鐘。systemd 有 3 小時硬上限。僅一個寫入程序可取得進度鎖。

人工小批次驗證可執行 `run --table tag_cna --max-steps 2`；`--table` 可重複指定，不會將其餘表誤標完成。若背景 service 正在執行，進度鎖會阻止第二個寫入程序；`status` 和 `fetch` 仍可使用。

NAS 上下傳各限 8 MiB/s，每步間隔 2 秒。**這個限速作用於 NAS 傳輸，不是來源 mysqld 的磁碟讀取限速。** 本機至少留 10 GiB、NAS 至少留 100 GiB；低於門檻就失敗退出並由下個批次重試。使用者 service 是否跨登出持續，取決於此帳號的 systemd linger 設定與主機是否開機連網。

```sh
systemctl --user status tag-legacy-nearline.timer tag-legacy-nearline.service
journalctl --user -u tag-legacy-nearline.service -n 50
python3 tools/nearline/pipeline.py --config /home/deck/.config/tag-legacy-nearline/config.json status
```

`status` 的 data_chunks 與 compressed_bytes 是本代引用總量，不是 NAS 去重後的總占用。known gaps、個別重試錯誤會列出。當批失敗會回非零退出碼；詳細記錄留 journal。目前沒有額外外部通知渠道，須定期查看錯誤與更新時間。

暫停須同時停止 timer 與 service：

```sh
systemctl --user stop tag-legacy-nearline.timer tag-legacy-nearline.service
```

## 按需取回

```sh
python3 tools/nearline/pipeline.py --config /home/deck/.config/tag-legacy-nearline/config.json list
python3 tools/nearline/pipeline.py --config /home/deck/.config/tag-legacy-nearline/config.json fetch \
  --generation <generation-id> --table media_list --dest /home/deck/tag-analysis-private/nearline-fetch/media_list
```

只抓一包時加 `--chunk 0`（從 0 起算）。先看該代 manifest 中的主鍵上下界，挑出需要的包；目前沒有按日期自動轉換成主鍵範圍的功能。未完成的表只能明確指定單包取回，不能誤認為完整表。輸出目錄必須為空，會包含 `schema.sql.gz`、`data-000000.sql.gz` 等，以及取回清單。下載逐檔校驗 SHA-256、gzip 與大小，成功才移除 `.partial` 標記。

還原請使用無網路、event scheduler 關閉的獨立 MariaDB 容器，先匯入 schema，再依檔名順序匯入 data；schema 含 DROP TABLE，不可對正式資料庫執行。manifest 中 `programs` 物件為 routines/events/triggers，若要還原，應在資料載入完成後另行檢視 definer、SQL 相容性與排程，勿自動啟用。

來源沒有變更日誌，封存流程也沒有通用 upsert。要重建某代某張完整表，應還原到空的隔離資料庫；不要把不同代的同主鍵 INSERT 直接疊在一起。

## 本機損壞後續跑

保留／重建 SSH 與 rclone 憑證，選擇一個**新的空 state_dir**，然後：

```sh
python3 tools/nearline/pipeline.py --config <recovery-config.json> recover --generation <generation-id>
python3 tools/nearline/pipeline.py --config <recovery-config.json> run
```

recover 讀取 NAS manifest；執行前核對來源與目的地一致，不覆寫既有進度。最新尚未成功發佈的進度會重做。取回資料時仍逐一重新校驗物件，不會只相信 manifest。NAS `.partial` 檔不在成功 manifest 內，失敗上傳會在下次相同路徑重試；目前不自動掃除所有孤立物件或 partial。

## 長期保存的界線

沒有 prune／刪除舊代／來源刪除操作，已保存版本會一直保留。相同包內容可共用，但變動資料、主鍵增刪造成的分包變動仍會增加容量，1.75 TiB 不是無限儲存。接近預留空間時需擴充或手動制定保留政策；pipeline 不會為了繼續跑而自動犧牲歷史資料。

NAS 是一份封存副本，不等於異地災難備援。若要保證每次變更都保存，後續需另行規劃來源 binlog／CDC，以及適合 MyISAM 的一致性初始快照；本次不修改母站配置。全量 restore drill 仍受本機容量限制，初次驗證以代表性小表與大表單包為範圍。

## 2026-10-04 上線驗證

- 首代：`20261004T104058Z-2f94afe6`，先完成 `media_list`、`catalogue` 與 `tag_cna` 第一包，隨後啟用背景續跑；不是全庫完成宣告。
- 實際從 NAS 取回並在無網路、tmpfs datadir、event scheduler 關閉的 MariaDB 11.4 還原：`media_list` 242 筆、`tag_cna` 第一包 50,000 筆。兩張表 `CHECK TABLE` 均為 OK，測試容器已移除。
- 還原報告：`/home/deck/tag-analysis-private/nearline-drill-20261004/restore-report.json`。
- 10 項自動測試通過，涵蓋失敗不推進游標、重試相同範圍、分包超限縮小、已知缺表持續標示、結構變動、gzip 損毀、進度重讀與物件路徑限制。
- systemd unit 驗證通過；此主機 `Linger=yes`。初輪持續透過既有 SSH 讀取母站，未修改母站資料或 MySQL 配置。

## 大型輔助表的分包調整

`table_chunk_row_caps` 可對明確指定的表設定較高列數上限（最多 500,000）；未指定表仍用 `max_chunk_rows=50000`。實際列數仍依每列估計大小與 32 MiB 目標計算，256 MiB 原始 SQL 硬限制、單工、限速及来源限時都不變。文章表維持預設上限，避免超過整理／匯入器的有界還原限制。

設定只在批次開始時套用，保留已驗證的主鍵游標與物件。每張表記錄 `chunk_row_policy`；若輸出超限而減半，下次執行同一設定不會把列數重新拉高。調整只影響後續主鍵區間，不重寫既有分包。
