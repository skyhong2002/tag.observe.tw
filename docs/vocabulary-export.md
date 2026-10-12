# 共用詞庫：唯讀增量與完整快照

此 API 提供新文易數目前 `article_tags` 索引維護的**整個**標籤池：原文關鍵字、編輯修改與規則補充一律保留。沒有排名、日期或噪音過濾，也不假設每個詞由記者指派。來源是現有索引（不包含已移出索引的封存關聯），統計使用 `article_tags.published_at`。不讀取全文、作者聯絡資訊等私人資料。

詞條 ID 為原始 UTF-8 字串 SHA-256，大小寫、Unicode 字形、空白原樣保留；噪音空字串也不靜默刪除。每詞保留 `articleCount`、`firstPublishedAt`、`lastPublishedAt`、`noise`、`noiseReasons`、`noEqual`。`noise` 沿用 `isTagNoise`；`noEqual` 依既有 no-equal-tags 完整字串規則，與噪音分開。沒有新增同義詞或自行合併字形。

## 不碰爬蟲寫入路徑

採「水位線增量加週期對帳」，**不建 trigger，不改正式 schema，不在爬蟲交易寫 dirty table**。來源連線設定 `TRANSACTION READ ONLY`、單句 `max_statement_time=0.9` 秒。所有中間狀態、佇列、進度均在私有持久 volume 的 SQLite，沒有新增 DB 帳號或權限需求。

首次建置沿 `tag_published(tag,published_at)` 的 tag key 範圍，從 1,000 個 collation 群組開始、最多 2,000；900 ms 超時就減半，單一大詞群改為 `(published_at,article_id)` keyset 分頁。統計對原始 BINARY tag 分組，保留同一 collation 群組中的大小寫變體。SQLite 以相同 MariaDB collation 的 weight key 對帳，checkpoint 與結果同一交易提交，可續跑。沒有整表 JOIN 或全量排序 SQL。安全閥目前 10,000,000 詞；超限中止並保留舊快照，**絕不發布截斷結果**。

快速層每 10 分鐘讀取 `article_tags` 的 `article_tag(article_id,tag)` 索引。以上次文章 ID 水位倒退 2,000 個 ID 重讀，以 `(article_id,tag,published_at)` 本地記錄冪等去重；MAX(id) 只設定掃描上界，不宣稱它是 commit 順序。受影響詞群以索引重算絕對統計，再發布增量世代。水位線、重讀游標、待重算詞及尚未發布的 changes 都可續跑。保護條件下暫停會保留舊世代，下次補做。

延後 commit 但仍在重讀區間的低 ID 可於下一輪補進；超過 2,000 個 ID 的長交易、對舊文章補標、刊登時間修改與刪除依慢速對帳修正。這是有界 overlap 的限制，不是 CDC 的即時保證。十分快速層的目標是一次輪詢加執行時間；首頁過慢、DB 超時或積壓時會延後，不宣稱故障期間仍有硬性 10 分鐘 SLA。

慢速層每日離峰處理約七分之一詞條的 tag 範圍，游標跨日續跑，正常運作下約七天完成一輪。刪除與舊文修改最晚在該範圍下次對帳反映；連續暫停會延後，須監測 `lastFullReconcileAt`。完整快照仍每天產生，不等同每天重掃來源。

`sourceAsOf` 提供本輪 `observedAt`、新文章水位、首次建置起點與最近完整對帳時間。這是分批觀測的彙總，**不是整個來源在單一時刻的一致性交易快照**。

## 完整快照與增量契約

1. GET `/api/v1/vocabulary/snapshots/current` 取得最近一份**每日完整快照** manifest。它保持不可變，不因快速層發布而改 ID 或欄位。
2. 固定 id，GET `/api/v1/vocabulary/snapshots/{id}?cursor=0`，依 `nextCursor` 逐頁落入本地 DB。每頁最多 500 詞。核對總詞數與完整 checksum 後原子切換。
3. 每 10 分鐘 GET `/api/v1/vocabulary/changes?after=LOCAL_ID`，省略 target 才會取得**最新增量世代**。不要只比較 current.id，否則會漏掉日內新詞。
4. 固定第一頁回傳的 `snapshot.id` 為 target，繼續 `changes?after=LOCAL_ID&target=TARGET&cursor=N`，直到 nextCursor=null。整批完成才把 LOCAL_ID 改為 TARGET。
5. `snapshot` 可以是完整 manifest，或 `kind: "delta"` 的增量 metadata。後者有 id、previousId、baseSnapshotId、generatedAt、total、pageSize、changeCount、changePages、noisePolicyVersion、sourceAsOf，**沒有完整 pages / sha256**。delta ID 不可拿去下載完整 snapshot pages。
6. changes 可跨多個世代；按世代時間及頁序依序套用。每頁最多500筆，在世代交界可能不足500筆。upsert 是絕對值，同詞可能重複；刪除為 `absent-from-index`，不推論編輯意圖。回應 snapshot.changeCount/changePages 描述目標單一世代，**不是整条跨代鏈的總頁數**，跨代讀取依 nextCursor。
7. 保留最近三份每日完整快照與其後所有 delta（最多600世代的安全邊界）。超出保存範圍回409及 `resnapshotRequired:true`，重新載入 current。每天讀活躍子集對帳，完整池初次匯入後以changes維護；完整重抓用於封存/按需對帳及409復原，再接最新changes。

每頁 checksum：`SHA256(JSON.stringify(entries) + "\n")`。完整 checksum：依 UTF-8 排序，逐詞 `JSON.stringify(term) + "\n"` 串接後 SHA256。驗證時包含新增欄位，不得自行移除 noise 欄位。檔案內部以 gzip 儲存，HTTP JSON 與 checksum 不受壓縮方式影響。

公開 API 只讀取靜態檔，不觸發 SQL。錯誤不快取；current/未指定target的changes快取60秒，固定版本一天。500詞儲存頁最多2MB；5000詞HTTP回應建議18MB安全上限，manifest上限16MB；由於頁面包含 manifest，HTTP response body 的下游安全上限須至少18MB，不能維持舊2MB總回應上限。下游逐頁存DB，勿把全部詞放入記憶體。

### 下游需配合的契約調整

使用者已同意兩站支援大詞庫與分批匯入。相較原本250,000詞版本，下游須同步：

- 容量安全閥10,000,000詞，最多20,000完整頁；changes單世代最多20,000,000筆，最多40,000頁。這是拒絕損毀輸入的安全閥，並非預期常態資料量。
- 接受上述 noise、active、statistics、sourceAsOf 欄位，以及 kind=delta 的增量回應。
- 不以完整 manifest validator 驗證 delta metadata；不要要求 current.id 每10分鐘改變。
- 空標籤屬 noise，保留在資料庫但不進比對集。
- 每頁/完整 hash 必須包含原始全部欄位。當地索引的大小寫合併不可改動來源 ID。
- 使用既有服務白名單 token，遵守每服務6000次/分與合計9000次/分限流，遇429依Retry-After退避。

兩個下游的程式修改由各自 thread 處理。本 repo 不修改它們的工作目錄。

## 活躍子集與容量統計

完整 manifest 的 `active` 提供另一組分頁目錄與 checksum；讀取 `/snapshots/{id}/active?cursor=N`。
預設條件為非 noise、至少兩個 Unicode code points，且 **30天內的實際文章數 ≥3**。不再使用「總篇數≥3 或最後刊登日在180天內」。完整池仍保留全部詞，活躍子集不截斷。`active.policy=recent-article-count`、`days=30`、`minRecentArticleCount=3`，既有 `minArticleCount=0` 表示沒有額外總篇數下限。

每詞新增 `recentArticleCount`（180天）、`recentArticleCounts`（鍵30/90/180）、`recentCountsAsOf`。以來源 `published_at` 在 `[asOf-days, asOf]` 範圍內的實際關聯篇數計算，不把一篇近期報導視為整個歷史篇數都在近期。來源每文章每tag唯一；BINARY label各自計數。未完成窗口補算的舊彙總拒絕發布，不以0猜測缺值。

`tiers` 全部排除noise及不足2字：`articleCountAtLeast` 為總篇數≥3/5/10/20；`recentArticleCountAtLeast[30|90|180][2|3|5]` 為窗口篇數；`intersections[days][recentThreshold][totalThreshold]` 為兩者交集（包括180天≥3且總數≥5）。`measuredTerms` 與 `missingRecentCounts` 揭露計數完整性。這些是完整統計，不是5萬詞的截斷結果。

窗口計數與總數一樣由唯讀分批查詢更新。新文影響的詞每10分鐘重算；舊詞的局部窗口老化、舊文改標或日期修改由七天輪轉對帳更新，`recentCountsAsOf` 明示各詞觀測時間。最後一篇文章離開30天窗口時，快速層排入重算並補發active=false；其他門檻變動最多七天（保護暫停會延長）。每日完整檔不代表所有窗口都剛重新查過。

`statistics` 保留舊版 lastPublishedAt 與總篇數統計供相容，`recent180` 指最後刊登日在180天內，**不是近180天至少3篇**；門檻決策請使用 `tiers`。另列 noise、noEqual 與 gzip頁面實體位元組。活躍子集只是便利索引，不改變完整詞庫。下游依自己記憶體預算由articleCount降序取用，未進集的詞仍保留可查，標示低頻或預算限制。

## 操作與負載保護

```sh
# 唯讀有界樣本，不建立公開世代
node --env-file=/home/deck/Projects/tag.analysis.tw/.env tools/vocabulary-export.ts
# 首次完整建置 / 每日完整快照
TAG_VOCABULARY_EXPORT_ENABLED=true node tools/vocabulary-export.ts --execute
# 快速增量
TAG_VOCABULARY_EXPORT_ENABLED=true node tools/vocabulary-export.ts --execute --fast
```

執行需 `TAG_DB_URL`、`TAG_VOCABULARY_EXPORT_DIR`。私有目錄 `/home/deck/tag-analysis-private/vocabulary` 權限0700，檔案0600，獨立於不可變release，不能放public/uploads。SQLite以OS檔鎖防重入；程序死亡自動釋放，不以過期秒數搶鎖。檔案與staging目錄fsync後rename，最後原子切換pointer。尚未成功發布的partial檔不會公開，SQLite保留續跑進度。

SQL逐句900ms上限、每句後休息100ms、程序nice15、idle I/O、低cgroup weight。首次建置與產出期間每約2秒量測正式首頁；HTTP非200、TTFB>1000ms、磁碟可用低於4GiB就暫停。nice/ionice無法降低DB server內優先權，故不能取代SQL上限與首頁監測。

快速層單輪時間有限，排程與慢速層共用鎖。日誌記錄耗時、SQL回傳列數（不是InnoDB實際掃描頁數）、新觀測關聯、query時間、首頁TTFB，以及第一次觀測新關聯至發布的時間。來源沒有commit時間欄位，**不能把 published_at/crawledAt 當成 DB commit 時間**；端到端寫入延遲以隔離fixture實測，正式流量只報可觀測延遲。

部署使用 `scripts/install-service.sh`：先備份服務設定/current連結/私有SQLite，再建立不可變release、smoke test、原子切換、ready check；失敗回滾。此功能不改正式DB。回滾先停用詞庫timers，再還原gateway drop-in與前一release；不要刪除來源資料或共用checkout的未提交修改。

基底：origin/main `aeab494be88c04fb02293f05fd437fa733cca92d`。首次有界preview 507詞/29ms；60秒續跑測試保存274,256詞、SQL累計10,710ms、最慢589ms、27次首頁TTFB最大541ms。最終完整容量與部署驗證另記於交付報告，這些有界數字不能冒充完整詞數。

正式排程：快速層每個整10分鐘（單輪175秒），舊資料對帳台北04:01（535秒、最多約七分之一詞），完整檔台北04:17（535秒）。三者共用防重入鎖，busy的快速層30秒後重試，最多5次/10分鐘。完整快照只讀本地彙總；每日對帳另用 `--reconcile`，避免每次產檔再掃來源。首次建置由operator以較長時間上限手動續跑，尚未建完前不啟用正式timers。

大詞庫建議分頁帶 `limit=5000&compact=1`（完整頁及active頁皆支援）：回應 snapshot 僅含 id/generatedAt/total/pageSize/sha256，避免每一頁重傳完整 checksum 目錄；entries/cursor/hash完全相同。先保存current完整manifest，再以它驗證精簡頁。這是可選的加法，未帶compact的既有500詞頁面契約保持不變。

## 大詞庫的主要同步來源

兩個下游主要下載 **active 子集**，完整快照仍保留供封存及低頻对帳（不必兩站每日重新抓完全部長尾詞）。每日讀active作比對索引對帳，完整池可首次匯入後持續用全部changes維護，完整重抓按需或409復原時進行。讀取一律使用已配置的服務白名單token。

完整與active分頁均支援 `limit=5000&compact=1`，預設仍500，相容舊客戶端；目前只接受500或5000，不接受任意中間值。`totalPages` 是預設500詞的頁數，`largePages.length` 是5000詞頁數，其內容是大頁checksum。使用active時讀active.largePages。cursor是所選limit的頁號，不能跨limit重用。HTTP提供 `Accept-Encoding: gzip` 協商壓縮，須解壓後再核對JSON checksum；磁碟仍只保留500詞gzip分頁，沒有重複一份5000詞檔案。

每筆changes增加 `active`：upsert按該世代發布時的同一30天/頻率/噪音條件判定，absence固定false。下游仍可把所有changes存DB，但只對active=true更新比對索引；active=false必須移出比對集。全數文章超過30天者在快速層重新查核並補發active=false；部分文章跨過窗口造成的門檻變化依上述窗口對帳延遲反映。

manifest.statistics另列 fullFileBytes / activeFileBytes / changeFileBytes（gzip實體分頁大小）；不把邏輯JSON大小或估計值當作磁碟大小。

快速層保留最後30秒發布已完成的changes；若大量新詞仍在pending，會先發布已重算部分、其餘下輪續跑，避免一直重算卻永不發布。日誌與sourceAsOf.pendingTags揭露積壓量；水位代表已掃描的文章ID，不代表所有pending詞都已重算。正常負載需維持pendingTags=0。

### 既有彙總的窗口補算

`tools/vocabulary-recent-preview.ts` 依私有SQLite的既有tag key排序分批讀取正式 `tag_published` 索引，固定窗口截止時間，可中斷續跑；每句900ms上限、批次間休息100ms、首頁TTFB超過1秒即暫停，持有同一runner鎖。只寫私有recent_counts及checkpoint，不發布、不改正式DB。補算完成後才允許新版runner產檔。公開服務在分布審查期間不掛載詞庫目錄，排程暫不啟用；使用者已選30天≥3篇，驗證完成後照平常流程部署。

門檻選擇的實測分布與負載紀錄見 [2026-10-12 分布報告](vocabulary-distribution-20261012.md)。
