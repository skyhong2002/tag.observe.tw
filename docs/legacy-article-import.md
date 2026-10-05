# 一次性歷史文章匯入

母站初次搬遷是一次性、可中斷續跑的工作；nearline 原始備份與新站內容封存仍持續排程。匯入器不提供母站 CDC，也不會自動追蹤來源刪除。

目前支援已審核媒體對照的單一原始分包；中央社是首批試點。全量分類與執行見 [全量工作流程](legacy-integration-runner.md)。每包先經 `prepare.py` 還原、核對筆數及整理，原始 SQL 與 prepared 產物保留在 NAS。跨媒體 `tag_news`／`tag_news_2024` 僅依明確的原始 media 及媒體網域處理；議題、Facebook 或 show_* 歷史計算結果維持獨立近線保留。

## 執行

先以正式庫連線做預演；只建立連線私有的 temporary tables，不修改正式文章：

```sh
node --env-file=.env tools/nearline/import-articles.ts \
  --package /path/to/verified-prepared-package --out /private/new-dry-run-directory
```

核對 prepared 檔案與 NAS 讀回 hash，檢查預演報告後，加上 `--apply` 並使用新的輸出目錄。連線指向新站，完全不使用母站寫入權限。工具是獨立遷移程序，不需重啟 worker 或啟用新排程。

```sh
node --env-file=.env tools/nearline/import-articles.ts \
  --package /path/to/verified-prepared-package --out /private/new-apply-directory --apply
```

每 100 列一個交易，文章、標籤與 `article_origins` 同時提交。 每批先以資料庫原有 collation 與唯一索引批次讀取並鎖定來源／文章身份，避免逐列重複往返；同包身份碰撞仍在寫入前排除，來源主鍵必須唯一。中斷後用相同 package、新的輸出目錄重跑即可，來源主鍵與原始內容 SHA-256 會辨認已完成的列。交易提交後若尚未寫完本機報告就中斷，資料庫來源紀錄仍是續跑依據。已連結來源出現不同原始版本時列入衝突，不默默覆寫既有文章。

## 邊界與保護

- 驗證壓縮及解壓內容 hash、筆數與來源追溯，再以目前 normalizer 重建候選；最多 100,000 列／512 MiB 解壓資料。執行前本機至少須有 20 GiB 空間。
- 依正式表 collation 比對 `media + url` 和 `media + url_key`。同包任何身份碰撞的所有成員都保留待查，不先任取第一筆。跨包及既有庫透過相同唯一索引比對。
- 既有文章僅在媒體、URL、urlKey、標題與原發布時間精確一致時新增來源關係；不改新站正文、作者、標籤、來源或 ID。不同欄位、大小寫／重音碰撞、URL 與 urlKey 指到不同文章，一律隔離。
- 預設仍以 91 天限制暫留近期資料。啟用 `--allow-recent` 後可匯入有效近期列，但正式寫入前必須確認執行中的 worker 回報 `own-indexed-v2`，且資料庫已建立 migration 0018 的來源索引。legacy 不自動進入爬取及即時計算；正常來源索引再次發現時才轉 own，保留原始來源對照，不偽造 fetched_at。詳見 [來源界線](legacy-ownership.md)。
- 新文章為 `source=legacy`，保留原始發布／收錄日期；摘要不當正文，正文、作者及抓取狀態維持未取得。有摘要時以匯入時間記錄 `content_accessed_at`，給本地快取新的保留時間，但不偽造 `content_fetched_at`。
- 完整原始欄位仍在 NAS；`tags_cat`、`tags_user` 不混進正式標籤。標籤 JSON 保留原本正規化詞彙，索引對 collation 等價詞保留一個鍵。
- 匯入需要 InnoDB 及 migration 0016；正式執行必須有 nearline remote 設定。部署的 retention 保護 legacy／有 origins 的文章；內容必須經 NAS 驗證後才能清掉快取。
- 每個輸出目錄包含 `report.json` 與逐列 `outcomes.jsonl`，分類為 inserted、linked_existing、already_imported、quarantine。保留這些紀錄與程式快照到 NAS，不能把 quarantine 當成成功匯入。
- 每個資料庫只有一個匯入器可取得 advisory lock。crawler 仍可運作；若遇到鎖競爭／唯一鍵競爭，當批回滾、程式停止，重跑即可續接。

## 驗證

`app/src/legacy/import.spec.ts` 包含日期與容量檢查，以及隔離 MariaDB 整合測試：預演無正式寫入、既有 own 資料保留、大小寫衝突、URL/urlKey 分裂、版本衝突、重跑冪等、失敗交易回滾。資料庫測試僅允許 loopback `23316/legacy_import_test`：

```sh
LEGACY_IMPORT_TEST_DB_URL=mysql://root@127.0.0.1:23316/legacy_import_test \
  npx vitest run app/src/legacy/import.spec.ts app/src/legacy/normalize.spec.ts
```

## 2026-10-05 第一包正式結果

已於台北時間 16:18 完成中央社第一包正式匯入：50,000 篇文章、50,000 筆來源對照及 3,432 筆標籤索引；發布日期介於 2014-12-28 至 2015-05-16。預演及正式執行皆無身份衝突或隔離列。全部標記 legacy，48,891 篇無標籤文章受到現行 retention 保護；沒有任何一篇進入 crawler 的 90 天範圍或近期排行範圍。

來源 generation 為 `20261004T104058Z-2f94afe6`，原始物件 SHA-256 為 `33d30508b45a74b21319036de966618b07522b392cc47da021996ac4b0438446`。本次只完成第一包，不代表中央社全表或其他媒體已匯入。其餘表的原始 NAS 備份繼續獨立運作。

本機報告位於 `/home/deck/tag-analysis-private/nearline-import-20261005-cna-{dry,apply,replay}/`。匯入報告、逐列來源／新 ID 對照、驗證結果與程式快照保存於 NAS `Archive/tag.analysis.tw/nearline-v1/imports/20261005-cna-first/`。
