# 統一 nearline 查詢格式與索引

本階段提供可執行的 metadata 索引與查詢工具，讓母站原始 SQL 和新站文章內容使用同一種查找格式。保留既有物件，不重寫 SQL、不載入資料庫、不取回正文。HTTP 查詢、取回佇列與結果端點尚未接上。

索引在 SSD 上，以 SQLite 保存 metadata；只有將來執行取回工作時才讀 NAS。索引可重建，原始 manifest、分類目錄及 `article_archives` 才是來源證據。查詢不依賴 NAS 在線，亦不會宣稱物件此刻仍可讀。

## 格式與身分

TypeScript 合約：`app/src/nearline/query-index.ts`。Python 建置／查詢：`tools/nearline/query_index.py`。

- 索引版本：`tag-nearline-index-v1`。
- 查詢結果版本：`tag-nearline-query-v1`。
- 新站 archive metadata 匯出：`tag-site-archive-snapshot-v1` JSONL，必須有 header 和筆數吻合的 footer；未完成匯出不能成為有效索引。
- `id`：`nli1_` 加 SHA256。hash 輸入是以 NUL 分隔的種類與身分欄位；表名／世代／主鍵限制字元，不包含 NUL。資料包用 `sql_data, generation, table, object SHA256`；schema 同理使用 `sql_schema`；文章版本用 `article_content, articleId, contentHash`。物件搬位置不改變內容版本身分，世代與文章版本不同則身分不同。
- 所有文章 ID、來源 ID 與主鍵上下界都是十進位**字串**，支援 MySQL signed/unsigned 64-bit 範圍；不得傳 JavaScript number。

| kind | 粒度 | format | 取回 adapter |
|---|---|---|---|
| `sql_data` | 某代、某表的一個資料包 | `mysql-sql-gzip` | `legacy-isolated-sql`，需要原始 schema／隔離還原及轉換 |
| `sql_schema` | 某代某表的結構 | `mysql-sql-gzip` | `legacy-isolated-sql` |
| `sql_programs` | 某代 routines/events/triggers | `mysql-sql-gzip` | `legacy-programs-review`，需人工檢視，不能自動啟用 |
| `article_content` | 新站文章的一個內容版本 | `tag-content-v1-gzip` | `site-content-v1`，既有新站格式 |
| `source_gap` | 明列無法備份的表 | `null` | 無取回 adapter，`availability=unavailable` |

每筆結果包含 `id/kind/source/availability/format/selector/artifacts/retrieval/integration/verification`。`artifacts` 保留 remote、相對 object key、SHA256、壓縮及原始大小；`sql_data` 同時帶 schema 與 data。來源沒有大小證據時用 `null`，不能假造 0。

`verification.basis` 指向原有封存／資料庫 receipt，`freshObjectReadback=false`：建索引沒有再次讀回所有物件。真正取回時仍須驗證 hash 與格式。

`integration.classification` 是分類目錄中的表用途；`tableRowsAccountedFor/tableQuarantinedRows` 是**表合計**，不是此包筆數。`packageIndependentlyVerified` 指既有匯入／reconciliation 證據，`packageReplayPending/mappingSha256` 保留轉換規則及是否仍需重處理；原始 SQL 仍須轉換，不能因此聲稱原始包已變成新站回應。`preparedReceipt/applyReceipt` 保留可追溯的整理及匯入證據位置。

## 查詢

查詢是 JSON object，可用欄位：

| 欄位 | 用途 |
|---|---|
| `source` | `legacy` 或 `site` |
| `kind` | 上表的種類 |
| `generation`, `table` | 世代及來源表 |
| `legacyId` | 來源主鍵；必須同時指定 generation/table |
| `articleId` | 新站內容版本的文章 ID；查母站來源關係另見下節 |
| `objectHash` | **主要物件** SHA256；schema 依賴不算此筆資料包的主要物件 |
| `id` | 穩定 entry ID |
| `limit` | 1–100，預設 50 |
| `cursor` | 前一頁 nextCursor |

範圍依 `(lowerExclusive, upperInclusive]` 定位；沒有整數主鍵的 whole-table 包只能定位整包，不能聲稱已找到某列。表 schema 也單獨收錄，因此空表仍可查找。只有 `sql_data` 參與 legacyId 定位。尚未提供日期、關鍵字、正文或隔離原因的逐列搜尋。

結果包含 `indexRevision/indexBuiltAt/sourceSnapshots/count/entries/nextCursor`；sourceSnapshots 列出各來源 digest 與觀察／擷取時間。這是來源快照，不是 live DB 查詢。cursor 綁定來源快照 hash 與查詢條件；來源快照或條件改變時需重新分頁。未支援的篩選欄位會報錯，不會被忽略。缺口查表可見，但不會被當作可下載資料。

```sh
python3 tools/nearline/query_index.py query --index /path/to/index.sqlite \
  --query '{"generation":"20261004T104058Z-2f94afe6","table":"tag_cna","legacyId":"50001"}'

python3 tools/nearline/query_index.py query --index /path/to/index.sqlite \
  --query '{"source":"site","articleId":"123","limit":20}'

python3 tools/nearline/query_index.py query --index /path/to/index.sqlite \
  --query '{"table":"show_tag_hour"}'
```

## 文章與原始封存的對應

以新站文章 ID 讀 `article_origins` 的既有 article_id 索引，取得 generation、來源表／主鍵及 source_object，計算相同 `sql_data` entry ID。支援已存在的相對 `.sql.gz` 路徑與 hash receipt；路徑 prefix 必須與 hash 相符。不複製四千多萬筆來源關係到 SQLite。

```sh
node --env-file=.env tools/nearline/export-query-index.ts --article-id 123
```

回傳 `tag-nearline-article-links-v1`：`entries` 是新站內容版本，`legacyReferences` 是原始資料包查詢條件／來源主鍵。把各 reference 的 `query` 交給 SQLite 查詢，即可取得取回所需 schema/data 指標。reference 的 `availability=index_lookup_required`，未命中時不能宣稱檔案已可取回。此輔助查詢每類最多 100 筆，超過時 `truncated` 明列；不能把截斷結果當作全部來源。將來 API 接線須處理該界線及逐類分頁。

沒有 origin 的新站文章也可能沒有封存版本；空結果不代表文章不存在。隔離資料沒有正式文章 ID，本階段只能由其原始表／包與 prepared/apply receipt 追溯，尚未建立隔離列的搜尋索引。

## 建置與更新

先取得指定世代的 NAS manifest，以及該代分類目錄，再唯讀匯出新站 `article_archives`：

```sh
node --env-file=.env tools/nearline/export-query-index.ts --out /private/site-archives.jsonl

python3 tools/nearline/query_index.py build --index /private/index.sqlite \
  --legacy-manifest /private/legacy-manifest.json \
  --catalog /private/integration-catalog.json \
  --site-snapshot /private/site-archives.jsonl
```

export 使用 read-only、repeatable-read consistent snapshot，按 `(article_id,content_hash)` 每次 500 筆 keyset 讀取。索引更新寫入旁邊的 `.partial`，完成 SQLite integrity check 後原子替換；失敗保留原索引。索引產物與匯出檔權限私有。CLI 建置一次需約 metadata 大小的暫存空間，不需要完整 SQL 資料庫空間。

`--legacy-manifest` 和 `--catalog` 可重複指定，以收錄多個世代；每次是完整重建，**必須傳入所有要保留可查的世代**，不自動疊加上一個索引。新一代未完成匯入分類時可不傳 catalog，分類會標為 `unclassified`。已有分類目錄時會核對世代、表清單、status、包數及 evidence 的原始 hash。

這一階段提供手動快照刷新，尚未接入 timer 自動刷新。後續接線時，nearline 完成世代及文章 retention 成功寫入 archive index 後都應觸發 metadata 刷新；不能只在第一次建置後永遠沿用舊索引。

## 後續取回 API 的界線

未來 enqueue 應提交 `entryId + indexRevision + selector`，worker 依可信索引解析 adapter，驗證 artifact hash，輸出帶相同來源及版本的結果。原始 SQL 只在 SSD 的隔離資料庫還原，新站內容用既有 decoder。公開 API 不直接接受 remote/object key；內部索引包含儲存拓撲，需先定義管理端授權及公開結果格式，再暴露 HTTP 端點。

metadata 查詢不改變正文刊登後七天的公開期限、不自動 hydrate、不修改母站資料或既有備份，也不代表原始 MyISAM 封存已變成跨表一致快照。
