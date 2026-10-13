# F1 後端獨立離線原始碼審查

審查 UTC：2026-10-13T02:55:58Z。模型：GPT-6.1 Sol。基準／所審 source SHA：`b8d030c747f87c997800371e33e1ab2d168ad257`。本 reviewer 未撰寫原 F1 產品實作。僅讀碼與無 DB fixture 的測試；未 build、未啟 DB、未連正式服務、未 probe、未操作 staging、未擷取畫面，**未 UI pass**。此文件是修正前審查，不能作為修正後驗收。

## 必須修正

1. **繼承 group membership 的 LIMIT 前精確比對缺口。** 更正初版判斷：migration `0038_tag-semantic-submissions.sql` 明確將 tag_submissions.tag/target 設為 utf8mb4_bin；因此 direct semantic 與 cycle 的大小寫混讀判斷撤回，不能只以 schema.ts 推定實際 collation。現有 tag_group_members 屬舊 collation，初始結果有 JS `m.tag === tag`，繼承結果有 `frontier.includes(m.tag)`，可阻止混讀輸出；但 inherited LIMIT 201 發生在 JS 精確過濾前，可能先被大小寫近似標籤擠掉真正 ancestor memberships。修法：membership 查詢在 LIMIT 前精確比對，或以不漏精確結果的方式分頁。此項是 bounded public projection 正確性缺口，非 semantic direct/cycle 身份洩漏。新增超過201個 case-near rows 的 regression。
2. **200 上限未涵蓋既有 group 與祖先，效能亦未 bounded。** `publicRelations` 最後直接回傳 `[...grouped.values(), ...relations]`；初始 memberships 不限量，所有 active defs 全欄讀取；每 membership 重建 ancestors map 且線性找 own，祖先可能任意多，超過 200 時 `truncated` 仍可 false。修法：group 與 semantic 邊共用最終 budget，可靠標示 truncation；只讀 defs 必需欄位，建立一次 byId，祖先遍歷 memoize／bounded，membership 查詢有界。測試至少涵蓋 201 memberships、長祖先、mixed 199 group + 2 direct 與 revoked inherited memberships。

3. **圖片管理員鎖定可能被並行 vote／approval 覆寫。** `pictures/votes.ts:applyVotes` 先讀 chosen/hidden，再以只含 tag（avatar 加 nonhuman）的 WHERE 更新。`pictures/routes.ts:/lock` 沒有共用 transaction row lock；其他請求可在 applyVotes 讀取後寫 chosen/hidden，之後 applyVotes 把 status 改 voted。approvePicture 的交易 row lock 可保護該交易本身，但不能修復既有投票讀寫競爭。修法：投票 apply 與管理員 lock 共同鎖住 tagPeople/tagVisuals 狀態行，或使用包含允許 status 的 compare-and-set，並以受影響行數重新讀取結果；不能回報不存在的 shownRank。需要控制 interleaving 的 mock regression，驗證 chosen 與 hidden 均不被覆蓋。

## 完整流程與邊界

- 登入／同源／permissions：relation POST 與 admin PUT 首先檢查 exact Origin；未登入 401，非 admin 的 admin list/image/review 403。身份來自 LoginStore session token hash 與 roleOf，投稿 body 不能指定作者或 role。所有投稿／審核 guard 設 no-store。讀取 admin blob 受 requireAdmin gate，list 明列 metadata 而不 select image；blob 使用 WebP、nosniff、CSP。source-level 未見 bypass。
- relation 投稿：有效 1–60 Unicode scalar 標籤、拒絕控制字元／surrogate／空白／self、限定三種類型及理由。related/alias symmetric structured dedupe，is-a directional；group ID 與字面 `group:811` 分開。唯一 dedupe index 與 upsert 防跨作者重複；user row lock 串行每人 rolling 24h 的 20 筆配額，既有 rejected 不重新公開。
- relation 審核：先鎖 tag_relation_lock，再鎖 submission；missing lock fail closed，非 pending 409。is-a cycle walk 32 depth/1000 nodes fail closed；0038 binary collation 確保大小寫精確；此次未重跑 DB concurrency。group bridge 鎖 active group，confirmed membership、member log、writing sync、submission status、submission log 同一交易；target 已刪除則 rollback。tag→tag graph approval 由全域鎖避免逆邊並行 write skew。
- relation public：只讀 approved semantic 與 auto/confirmed group membership，排除 topic own group；既有 group ID 保留 `/group/id/`，撤回 membership 不透過 old approved bridge 復活。只投影公開欄位，不含 reason、reviewReason、createdBy、reviewedBy 或 email。tagId exact、source 有 provenance，legacy creation timestamp 保持 null。匿名 cache 60 秒，credential header cache guard 經 offline injection 有 coverage。200／效能及 identity 見 blocking。
- image 投稿：upload 必須登入、同源、agree true，15MiB body limit。visual 經 recolourLogo 後進 submitPicture；avatar resize 後排 `tag-avatar-photo`，data 包含 userId；worker→runTagAvatarsInChild→tag-avatars-child→addPhoto 保留 userId，因此讀者走 submitPicture，沒有掉入管理員直接 chosen 分支。
- image 待審：submitPicture 用處理後 bytes、tag、kind hash 去重；user row lock，rolling quota 計算含 pending/rejected，approved candidate 透過 NOT EXISTS 排除重複計數。avatar 需目前仍為有效人物，metadata 與 image 僅進私人 submission；沒有 candidate、public shown state 或 vote。job polling 限本人／admin，回傳結果不含 photo/email。
- image 審核：submission lock + pending/candidateRank 檢查；avatar 鎖 person 並再次拒 nonhuman，visual 插入／鎖 tagVisuals 作 rank allocation mutex。candidate、上傳者初始票、shown update、review status 與 audit 同一外層交易，metadata 缺失／錯誤 rollback；重複審核 409。單執行緒保留 chosen/hidden，但並行鎖定見 blocking。
- image public：v1/tag-person 與 v1/tag-visual 僅讀既有 person/visual shown state 和 candidates，不查私人 submission。avatar 的 legacy review 為既有展示狀態，並不等於讀者 pending submission。public response 不含 upload userId、私人審核理由或 email；讀者候選清單 strips uploadedBy，僅輸出 uploaded/mine。管理員自行上傳的直接 chosen 分支有獨立 admin gate，屬既有授權功能。

## 非阻擋限制／待確認

- avatar admission 只算已寫入 submission 的 quota，尚在 queue 的昂貴處理 job 未預留配額；可排超過 20 jobs，worker 最終 submitPicture 仍拒超额持久投稿。若「每天最多上傳20張」包含入隊工作量，就須使用者鎖與 job reservation，而非只依完成後 count；目前不能宣稱 queue admission bounded。
- image tag 驗證仍用 UTF-16 length >60，與 semantic 的 scalar 字數規則不同，亦未拒空白／控制字元；屬既有 picture 路徑限制，未見因此洩漏 pending。
- worker 成功後清除 job image；失敗前 image 保留至 removeOnFail age 86400。這是 queue 私人資料保留，source 不代表實際 Redis ACL 或磁碟權限驗證。
- group target 審核只檢查未刪除而未再次檢查 kind；目前正常 admin 路徑不能把既有 group 改為 topic，未能形成可用繞過，故不列真正 blocking。

## 驗證紀錄

執行 `env -u TEST_DB_URL ./node_modules/.bin/vitest run app/test/tag-semantic.spec.ts app/test/picture-submissions.spec.ts app/test/f1-offline-contract.spec.ts`：3 files pass，**10 passed、25 skipped**。其中 offline-contract 6 passed，tag-semantic 3 pure identity tests passed、17 MariaDB tests skipped，picture-submissions 1 pure identity test passed、8 MariaDB tests skipped。mock batches 不評估 SQL where，因此現有 6 offline checks 無法证明大小寫隔離或資料庫鎖定。本輪沒有 DB concurrency pass；root 回報先前19項 integration 已有私人 log，本 reviewer 未複驗，不否認先前已執行。沒有 worker模型／image processing pass，也沒有 UI pass。另 `--project unit tag-semantic` 因該檔是 shared-db project，沒有找到檔案（exit 1），不能算測試成功。

審查涵蓋 semantic/submissions、v1/tag-relations、pictures/routes/submissions/votes、avatars/run、worker、jobs child傳遞、v1/tag-person/tag-visual、login gate、schema與現有三份測試。未修改產品源碼。此 reviewer 不 commit，交由 root 統一提交；未 push、未部署。

## 修正工作交接（等待另一位 reviewer 複審）

2026-10-13 本 reviewer 經 root 指派轉為 semantic writer；因此不能自批本修正。publicRelations 已改為總量200、group與tag祖先depth8、按需要的group ID分批載入及cache，membership使用索引predicate加BINARY exact並於LIMIT前過濾。OpenAPI／生成API文件同步描述。新增mock涵蓋group+direct共同budget、祖先深度／cache、繼承精確predicate；此前blocking紀錄保留為修正前證據，完成狀態等待另一Sol instance獨立review。未改votes.ts、未commit、未部署。

Writer檢查：9項offline mock tests通過、3個相關TS檔Biome通過、`tsc -p tsconfig.json --noEmit --incremental false` exit0。僅工具驗證，非writer自批或DB／UI pass。

Root／independent reviewer指出cache需全域budget及shorter-path provenance問題後，writer補上：definitions cache總key數≤200（包含不存在／topic ID），滿200 relations不再讀新parent；較短path完整替換公開relation來源欄位。新增3mock（總cache、滿額不讀parent、較短pathprovenance），現在12項offline通過；Biome與noEmit/nonincremental typecheck通過。仍等待獨立review，不能以writer測試自批。

## 修正後獨立複審（source/test，非 UI）

writer 完成後，由未撰寫 semantic 修正的另一個 instance `/root/f1_vote_independent_sol`（spawn model `gpt-6.1-sol`）獨立複審通過；review 時 HEAD `4182009`，所審產品 diff 基準 `b8d030c`。紀錄：`/home/deck/tag-analysis-private/f1-release/semantic-independent-review.log`，含 UTC、diff/source hashes、命令與範圍。12 個 mock tests 通過；writer 的完整 backend TypeScript `--noEmit --incremental false` 與 Biome 亦通過。

legacy memberships 使用 indexed IN 加 BINARY 精確條件後才 LIMIT；group definitions 按需讀取必要欄位，cache 含 missing/topic keys 合計最多 200，公開關係合計最多 200，tag/group 祖先深度最多 8。到達界限時明示 truncated；較短路徑會完整替換 origin ID／來源／時間，不沿用較深路徑的 provenance。OpenAPI 與產生的 docs/api.md 同步。

此 mock 驗證真實函式與 query 結構，未實際執行 SQL collation 或 query plan，因此不能宣稱 MariaDB case-near-201／效能驗收通過。圖片競爭修正另見 `docs/f1-picture-vote-race.md`（`9db1e43`），已獨立 review。其餘上述非阻擋限制保留。尚未建置、UI 重拍或部署。
