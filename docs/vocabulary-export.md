# 共用詞彙快照（待完成容量審查，尚未部署）

供 YouTube Board 等觀測工具同步 tag.observe.tw 維護的文章標籤。包含目前所有 `article_tags` 與現存 `articles` 的關聯，不限排名或最近窗口。這不是新建人工詞典：來源可能是文章關鍵字、編輯或規則補標，逐詞記者指派未知。封存且移出目前索引的文章不在涵蓋範圍。

每個詞條以原始 UTF-8 字串的 SHA-256 作穩定 ID，大小寫/Unicode 字形不合併。字串改名是新 ID；沒有別名或人工 merge 的資訊時不自行推論。比對系統應另外保留詞庫版本及字串正規化規則。

## 產生與服務

```sh
node tools/vocabulary-export.ts
# 先檢查 preview；只有 operator 核准後才執行以下命令。
TAG_VOCABULARY_EXPORT_ENABLED=true node tools/vocabulary-export.ts --execute
```

執行時須提供 `TAG_DB_URL` 與 `TAG_VOCABULARY_EXPORT_DIR`。DB 使用唯讀交易，要求 InnoDB source、repeatable-read consistent snapshot。preview 先以 10 秒上限檢查引擎、EXPLAIN 與 covering-index 詞數探測；候選標籤超過 250000 時立即結束，退出碼 2，不執行全量 JOIN/filesort，也不寫檔。小型來源的實際聚合上限 30 秒、250000 詞；超限/失敗不發布半套資料。單一標籤不符合 schema、空值或不合法日期會拒絕整批並保留目前版本，避免靜默遺漏；需修復上游來源後重跑。已附離峰 systemd service/timer 範本但未安裝或啟用；production env 未修改。2026-10-12 僅執行下述有界唯讀 production preview。

export 目錄必須位於私有持久 volume，由產生器與 API 服務以相同受控使用者讀寫；檔案 0600。不要設為可任意上傳/修改的目錄。所有歷史快照保留以便證據回溯；清理策略另行審查。各頁寫到 staging，完成後 rename 目錄，最後原子替換 current pointer。各檔案及發布目錄會 fsync，再原子替換 pointer。鎖使用 exclusive file，內容記錄 pid、hostname、startedAt、snapshot id；程序異常退出留下鎖時，先依記錄在對應主機確認 pid 不存在、停用其他 publisher，再由 operator 手動刪除 `.publish.lock`；不要在仍有程序或容器使用該 volume 時清除，不能依時間自動搶鎖。原快照維持可讀，殘留 staging 目錄不會被 API 服務。

正式啟用前需檢查查詢負載、volume 與可回退部署。回退可停用 export gate 並將 API env 移除（503），已下載的固定版本與歷史 evidence 不需刪除。

## 同步契約

1. GET `/api/v1/vocabulary/snapshots/current` 取得 manifest。
2. 固定 id，依 `/api/v1/vocabulary/snapshots/{id}?cursor=0` 的 nextCursor 讀完。
3. 每頁核对 SHA-256：JSON.stringify(entries) 加 LF；完整 checksum 則依快照排序，把每個 JSON.stringify(term) 加 LF 串接。
4. 驗證總數/來源/schemaVersion/固定 id 後，再原子替換本機 current。途中錯誤繼續使用前一版本。
5. 直接前一版本可用 `/api/v1/vocabulary/changes?after=OLD&target=NEW`；落後多版本回 409，重新全量讀取。

`absent-from-index` 只表示某词目前没有索引關聯，不代表記者/編輯刪除。保留歷史快照與既有影片證據。新增/更正統計也會出現在 upsert。

公開端點僅讀受驗證分頁檔，每頁 500 詞，不在 HTTP request 中做全量 DB 聚合。未設定目錄回 503；尚未產生快照回 404。完整 OpenAPI 與 API 文件由既有 generator 產生。


## 噪音欄位與相容性

詞條新增 `noise`、`noiseReasons`、`noEqual`；manifest 新增 `noisePolicyVersion`。
`noise` 完全沿用 `isTagNoise`：原因為 `empty`、`category`、`english-function-word`、`section-label`、`bare-year`。
`noEqual` 用修剪前後空白的完整字串查 `no-equal-tags.json`，與既有標題補標邏輯一致。
no-equal 中的人物、國家、政黨不一定是顯示噪音，兩種判定分開提供。所有標記詞仍完整保留。
規則版本為 tag-noise 規則版本與 no-equal 清單的 SHA-256；修改判定邏輯需更新 `TAG_NOISE_RULE_VERSION`。
標籤原字串、ID、大小寫、Unicode、500 詞分頁、checksum 演算法及 changes 契約均維持。
兩個下游現有 validator 都保留並允許附加欄位，checksum 仍以整個詞條 JSON 驗證。

## 2026-10-12 上線前檢查

基底 `origin/main aeab494be88c04fb02293f05fd437fa733cca92d`；獨立 worktree `tag-vocabulary-release`。
有界索引 probe 取得 250001 個 distinct 標籤後停止，耗時連 metadata/EXPLAIN 共 1234ms。
此數字是候選 `article_tags` 字串數的截限結果，不是已驗證完整快照的精確詞數：資料庫 collation
可能合併大小寫/字形，且尚未檢查孤立關聯。不能據此宣稱完整詞數或完整匯出檔案大小。
EXPLAIN 估計掃描約 92148867 筆標籤關聯，使用 filesort，再逐筆 join `articles`。
因此原本的單一全量聚合 SQL 不適合直接在正式服務執行；候選程式在聚合前中止，未發布快照。
preview 前後首頁均 HTTP200，TTFB 分別 812ms／210ms；首次 probe 太短，沒有取得中途第二筆樣本。
這些數字只能證明有界 probe 的負載，不能證明全量匯出負載合格。

目前 producer 與 YouTube/Blog validators 都限制 250000 詞；YouTube 另有 2000000 字元 trie 預算，
Blog 另有 64MB 快照及 1000000 trie nodes 預算。增加 producer cap 並不足以讓下游使用完整詞库。
必須協調兩個下游的分批儲存與比對容量，並改成有界、可續跑的完整來源匯出，再實测完整詞數、
頁數、檔案量及匯出期間首頁 TTFB。不可只放寬 timeout 或去除 cap，更不可過濾噪音來湊進容量。

## 排程、私有儲存與部署前置條件

`runtime/tag-vocabulary-export.timer` 固定台北 04:17（另加最多 180 秒隨機延遲），每日一次，
`Persistent=false` 避免重開機在尖峰補跑。service 使用 Nice=15、idle I/O、低 cgroup weight、
1GiB 記憶體上限與 5 分鐘程序上限；publisher 的 exclusive lock 防止同機/共用 volume 重入。
注意 nice/ionice 只限制匯出程序，不會降低 MariaDB server 內查詢優先權；不能取代 SQL 負載驗證。

容量與負載過關後才設定獨立私有環境檔 `/home/deck/.config/tag-vocabulary-export.env`（0600），
含 `TAG_DB_URL`、`TAG_VOCABULARY_EXPORT_ENABLED=true`、`TAG_VOCABULARY_EXPORT_DIR`。
目錄建議 `/home/deck/tag-analysis-private/vocabulary`（0700），與 release 分離；gateway 只需相同
`TAG_VOCABULARY_EXPORT_DIR`，不需要 export gate。不得放在 public/、Next assets 或任意上傳目錄。
以既有帳號也只執行 READ ONLY transaction；正式排程宜配置僅能讀兩個來源表的 DB 帳號。

`scripts/install-service.sh` 已將 `tools/vocabulary-export.ts` 納入不可變 release；
正式部署先備份 service/env/current pointer 再切換。
timer 不可在第一份完整快照 checksum、下游相容性與負載驗收前啟用。回滾停用 timer，還原 gateway
設定與上一個 current release；私有歷史 snapshot 檔案保持，不修改來源資料庫。

本次未改 schema 或 DB 內容。既有最近成功完整備份為 2026-10-09T20:38:16Z（2026-10-10
完成還原/NAS驗證）；2026-10-10T20:33:41Z 那份因隔離還原空間不足而標記 failed，不能當作驗證
成功的備份。上線前須重新確認備份/可用空間；不因這份 API 候選而改寫現有備份政策。


補測：加入期間取樣後，第二次低優先權 preview 的 preflight 為 1339ms、總計 1629ms，
依舊在 250001 候選標籤停止。首頁 before/during/after 均 200，TTFB 分別 270/160/171ms。
全量查詢並未執行，完整詞數、頁數、實體檔案大小與噪音總數尚無有效數字。

候選驗證：unit project 1935 passed、29 skipped（未配置 DB 的既有整合案例）；TypeScript 通過。
其中 API 文件、狀態頁、噪音與快照 27 項全通過。以 506 詞／2 頁合成快照直接跑兩站現有
`validateManifest`／`validatePage` 均通過；這是附加欄位相容證據，不代表實際完整詞庫可匯入。
