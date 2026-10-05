# 母站一次性全量整合工作

此工作整合既有 NAS 原始備份，不重新抓取母站文章頁面、不執行母站 DDL，也不讓 MariaDB 直接使用 SMB 作資料目錄。原始備份由 `tag-legacy-nearline.timer` 繼續運作；本工作由獨立的 `tag-legacy-import.timer` 續跑。

## 範圍與分類

`tools/nearline/plan-integration.ts` 對照固定 generation 的全部表、原始欄位盤點及已核實的媒體網域，產生每張表的處理決策：

- `import_articles`：有明確媒體對照、整數 newsid 主鍵及原始日期／URL／標題／標籤欄位的文章表。每媒體表依表名對照；`tag_news`、`tag_news_2024` 依每列原有 `media` 對照。舊 mediaid 不當成新 ID，也不從網址猜未知媒體。
- `nearline_only`：保留完整原始 SQL、schema 和 manifest，供獨立取用。包含母站分類／人工標籤規則、舊排行／事件歷史、Facebook 紀錄及尚無可靠對照的來源；這些資料不覆蓋新站不同語意的規則或演算法。
- `source_gap`：來源無法讀取或缺少適用封存方式；保留原因，不宣稱已備份。

2026-10-05 初始全量計畫列出 280 張表：126 張文章表（124 個直接媒體對照＋2 個跨媒體表）、153 張近線保留表、1 張已知來源缺口 `show_tag_hour`。這是處理範圍，不是完成數。當時文章表已取得 1,069 個分包；`tag_yahoo` 尚待原始備份，已加入母站備份優先序，取得後自動接續。

## 每包流程

1. 讀取 NAS generation manifest，以原始 SHA-256 取回單包與 schema；驗證大小、hash、gzip。
2. 在無網路、限制 CPU／記憶體的暫存 MariaDB 還原，核對必要欄位與還原筆數。
3. 正規化為 JSONL，保留每列原值、原始物件及來源 ID。只用 LF 分行，避免合法 JSON 字串中的 Unicode U+2028／U+2029 被切斷。日期不合法、媒體未知及無法解析的標籤會明確隔離。
4. 將 prepared 內容、報告、來源 manifest 上傳 NAS，逐檔讀回 hash 驗證後才進入正式匯入。
5. 用正式唯一索引／collation 檢查身份衝突；每 100 列交易提交文章、標籤與來源對照。既有 own 資料只新增符合條件的來源關係，不覆寫。
6. 逐批讀回 origins 與 articles，核對每一筆成功／已存在的來源關係及新 ID。
7. 將完整逐列結果壓縮、報告與 archive manifest 上傳並讀回驗證，才提交完成 checkpoint、刪除該包工作暫存。

預設將發布或原始收錄時間在近 91 天內的資料暫留。完成 worker `own-indexed-v2` 及 migration 0018 後，以安裝器 `--allow-recent` 啟用近期列匯入；執行器會重訪曾因近期限制暫留的資料包，原完成紀錄保存於 `previous_results`，新產物使用含 mapping SHA256 與近期模式的 `integration-v3/<mapping-sha>/recent/`。有效近期資料應完成補匯入，不能以暫留當作整合完成。錯誤 image 欄位若其實是 HTML／不合法 URL，原值仍保存在 raw；正式 image 留空並記錄警示。

## 狀態、續跑與取回

私有狀態：`/home/deck/tag-analysis-private/nearline-integration/state.json`。

- `completed` 按 `(table, 原始物件 SHA-256)` 記錄結果及 NAS 路徑。
- `current.stage` 顯示 fetch、archive_prepared、apply、archive_result。
- 每包計數區分 inserted、linked_existing、already_imported、quarantine；quarantine_reasons 保留原因統計。
- 暫時斷線、鎖競爭或程序中斷時，不提前提交完成。未完成交易由資料庫回滾，已完成列由 origins 辨認。NAS 結果上傳失敗後可接續既有完整 apply 報告。
- 每次執行最多約 30 分鐘再交回 timer；單包完成所需時間可能延長此界線。啟動使用固定程式快照，避免其他工作修改 repository 時改變執行規則。
- 本機不足 25 GiB 或 NAS 不足 100 GiB 時停止新增工作，不自動刪除原始資料。

```sh
systemctl --user status tag-legacy-import.timer tag-legacy-import.service
journalctl --user -u tag-legacy-import.service -n 30 --no-pager
python3 -m json.tool /home/deck/tag-analysis-private/nearline-integration/state.json
```

NAS 結果：`Archive/tag.analysis.tw/nearline-v1/integration-v1/<generation>/<table>/<raw-sha>/`，包括 `prepared/` 及每次成功匯入的 `apply-*/`。現行執行器使用 `integration-v3/<mapping-sha>/<recent|historical>/` 路徑，v1/v2 稽核檔保留；獨立核對器會依新稽核路徑重新驗證。原始 SQL 仍由同一 generation manifest 指向 hash-addressed objects，可用 `pipeline.py fetch --generation ... --table ... --chunk ...` 取回，依 `docs/nearline-archive.md` 操作。

## 完成判準

不能僅以 service 啟動或 table 數量宣布完成。須核對：每個已封存文章分包都有成功且已驗證的結果；每列均被計入匯入／連結／已存在／隔離其中之一；隔離原因與未映射來源有清單；原始備份完整度及 `show_tag_hour` 缺口明確列出；持續保存排程維持正常。一次性匯入完成不等於母站後續新增／刪除會自動同步。

簡潔進度可使用：

```sh
python3 tools/nearline/integration-status.py \
  --config /home/deck/.local/share/tag-legacy-import/config.json
```

重新安裝固定程式版本（不重置 checkpoint、不重啟網站）：

```sh
python3 tools/nearline/install-integration.py \
  --plan /home/deck/tag-analysis-private/nearline-integration/plan-all.json \
  --state-dir /home/deck/tag-analysis-private/nearline-integration \
  --backup-config /home/deck/.config/tag-legacy-nearline/config.json \
  --env-file /home/deck/Projects/tag.analysis.tw/.env --start
```

安裝時建立來源 hash 清單，程式存於 `~/.local/share/tag-legacy-import/releases/<hash>/`；`.env` 只用原路徑讀取，不放進程式快照或 NAS。正在執行的批次保留它原先載入的版本，下一批次才採用新版本。

## 獨立核對

```sh
python3 tools/nearline/reconcile.py \
  --config /home/deck/.local/share/tag-legacy-import/config.json --max-chunks 4
```

這個唯讀核對程序從 NAS 重新取回 prepared、apply 報告、逐列結果與封存 manifest，核對原始 generation／物件、壓縮與解壓 hash、筆數、每列來源及成功／隔離分類；再查正式庫確認所有成功列的 origins 與 article ID。結果逐包保存於 `reconciliation.json` 並上傳 NAS 讀回驗證，可重跑接續，不修改正式文章。核對進度與匯入進度分開，不能把只核對前幾包說成全量核對完成。

公開站曾依使用者要求排除的媒體，計畫會標示 `excluded_from_live_site_by_user_request`，只保留 NAS 原始資料，不因歷史資料匯入而恢復公開收錄。

`tag-legacy-reconcile.timer` 會以獨立、較低優先度的唯讀工作，每次核對四包後休息一分鐘，再接續未核對的結果。它與正式匯入使用不同的工作鎖；可從 `journalctl --user -u tag-legacy-reconcile.service` 查看進度。核對曾依使用者要求排除的媒體時，只核對近線保留分類，不恢復其公開文章。

網域對照修訂：姊妹淘 `babyou.com`、`babyou.nownews.com`，Tatler `tw.asiatatler.com`，BBC `bbc.co.uk` 已由舊抓取設定／來源目錄核對，證據存於 mapping。修訂 mapping 後，只重訪仍有 `unreviewed_url_host` 的已完成包（近期模式另處理近期暫留包），以新的 SHA256 命名空間封存並保留先前結果。相同 mapping 不重跑已處理包。來源混入其他媒體、短網址、拼接錯誤 URL 不會因此自動放行。
