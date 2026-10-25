# F1 candidate 部署前 privacy barrier：離線方案

基準 control HEAD：a4713d9cab2bc3d97343c3aa6ba8aa580b61fba2。目標為既有 immutable APP677 `677a0c793eeda0c4d850c81ac574c95508d08e0a`、BUILD_ID `PmjYScQDDoJKBr43SLkhd`；不是把此 control checkout rebuild 後當作 APP677。本文件不代表 candidate 驗收通過。模型 GPT-6.1 Sol；2026-10-14（Asia/Taipei）。

## 最小必要驗收

執行前交 babysit：列出 exact candidate API／Next PID、cwd、COMMIT、兩處 BUILD_ID、manifest/inventory hash、TAG_API_ORIGIN 及各入口的指向證據。API 和 Next 須讀同一隔離 fixture，不能讓 Next 讀正式18130。只能使用 Mint 已授權隔離 DB 與既有 actors701–703；DB 名稱／port／endpoint allowlist 由現有 Mint guard 證明，不能僅靠「不是 production 名稱」。不得新增 actors601/602、登入帳號、權限、DB、服務或 rebuild。本 recipe 沒有 mutation execution 授權；exact transaction 和清理需另交 babysit。

| 面向 | 最小證據 | 失敗／缺口判準 |
| --- | --- | --- |
| 公開 JSON | relations、tag visual/person metadata，及首頁實際使用的圖像清單 | approved 可見；pending/rejected、email、reason、createdBy/reviewedBy、image blob 不可洩漏。未有對應 fixture 不算通過 |
| 憑證快取 | 同一公開 URL 匿名與 Cookie/Authorization/X-Service-Token/X-Api-Key，各含空值和無效值 | 匿名沿實際 public TTL；所有憑證成功 private,no-store；400/401/403/404/429/500 no-store，不能只測 openapi 代替 relations |
| 私人圖片 | 既有 pending image 的 admin image URL；anonymous、701、702、703 | anonymous401、非admin403、admin200/no-store；公開metadata/候選/votes無pending image。703角色須既有fixture證據，不猜測session cookie可登入 |
| HTML/RSC | canonical `/`、`/tag/{fixtureTag}/`，及新features主要頁的實際SSR頁 | HTML Accept:text/html；RSC:1使用candidate驗證的合法router headers。正文、RSC serialized payload、metadata不得帶私人canary；確認content-type及實際render不是fallback/redirect |
| SSR credentials | 同 canonical頁匿名及各憑證序列、再匿名 | 前次私人回應不可進後次匿名；Next internal API request只帶匿名accept，Cookie/token不得透傳。僅API onSend不證明HTML header安全 |
| 圖像 | 實際公開 image URL 與pending admin URL分開 | 只用既有小fixture blob；記錄hash/status/cache，不建新圖或用任意巨大影像 |

普通 anonymous SSR資料可快取並不等於私人洩漏；但撤銷後新B仍含已撤下資料不符合本次fresh要求。未公開pending存在本身，不代表所有匿名頁必須改no-store。不能照抄blog全面force-dynamic規則。

## A／commit／B 決定性 barrier

每一 scenario 使用不同已存在且可復原的fixture，列出 affected和unaffected canary／ID。先確認匿名公開資料有affected與unaffected，pending私人canary從未公開；可暖相同canonical JSON/HTML/RSC一次，再做barrier，不加cache-busting query。

1. 對真DB pool SELECT/execute結果安裝test-only wrapper，SQL完成後、交給真loader前，攔截A的指定affected row。不能只在onSend阻擋。API AsyncLocalStorage correlation須沿Next internal fetch傳遞，對應A/B與query hash。
2. 發起A，若A完成卻未命中SQL結果barrier，直接失敗；常見原因為Next Data/Full Route Cache，不以TTL、sleep或retry消除。
3. A結果被捕捉後，隔離transaction將既有approved relation改rejected，或既有confirmed membership改rejected；確定commit完成後才起B。不可刪除fixture或正式資料。relation review現有handler對已核准edge未必提供撤銷操作；此scenario可用經另行審查的fixture-only transaction，不把管理UI當作已支援撤銷。
4. A仍被擋住時B須完成，body不含affected、保留unaffected，而且取得commit後B自己的fresh SQL（相同query hash、B correlation、started-after-commit序列）。headers另檢實際匿名TTL／有憑證private,no-store。先完成B再釋放A；commit前開始的A可完成舊snapshot。
5. 同一主要tag頁分別HTML與RSC做以上序列；不能用API-only成功宣稱SSR/RSC通過。timeout只用作失敗deadline，不拿它等待快取過期。finally釋放A，對原有狀態做審查過的復原transaction，保留audit，不TRUNCATE／DROP／delete。

`tools/f1-privacy/barrier.mjs` 是**無IO的adapter協定driver**：不連DB、HTTP、不取鎖、不開service；adapter須提供identity、真SQL-result barrier、隔離commit、correlated read、cleanup。它只核對adapter送入證據的序列，不能獨立證明DB／PID真實。現在沒有接上candidate adapter，因此部署gate仍缺真實execution證據。pure mock自測正向、stale B拒絕、A cache bypass拒絕共3項，只證明driver斷言，不是candidate驗收。

## source證據與不能假設的行為

- blog B0 SQL-result攔截與postcommit B獨立read序列可沿用；blog verified/sourceBlogId、404/410、sitemap等模型不適用tag，不照搬。
- `web/src/lib/api.ts` get以 `next:{revalidate}` 匿名fetch，fetchTagRelations為60秒；失敗才用no-store retry。成功ISR/Data Cache不保證mutation commit後立即fresh，不能利用內建fallback retry湊pass。
- `app/src/v1/tag-relations.ts` 匿名public,max-age=60；gateway onSend憑證存在即private,no-store及錯誤no-store。SQL只approved、membership auto/confirmed；publicRelations不取共現或私人audit。
- `app/src/pictures/refresh.ts` fire-and-forget revalidation，失敗被吞掉，不是完成commit與所有cache失效的barrier。圖像v URL一天cache，也不證明旧URL即時撤下；圖片shown→hidden需另外有active image fixture與old URL證據，缺資料就列gap。
- 既有picture-submissions shared-db spec使用601/602並TRUNCATE；此批禁止執行。tag-semantic shared-db spec亦不能直接跑替代Mint actor限定驗收。
- production/Cloudflare沒有隔離fixture映射；不聲稱candidate測試證明edge舊物件撤銷。若需formal deployment後headers/read-only檢核，須另交babysit exact probe。

## 本批結果／凍結

離線mock：`nice -n 19 node --test tools/f1-privacy/barrier.test.mjs`，3/3通過。未執行candidate、SSR、RSC、SQL、mutation、browser、GA或production probe；未build、未啟API、未取鎖。commit：未提交／未push，交root獨審整合。部署：未部署；APP677 privacy/no-store barrier gate尚未完成。此小批到此凍結，不因mock成功放行部署。

後續最小fix定位（本批未修改）：`web/src/lib/api.ts:126` 共用get；`:288` fetchTagRelations60秒；`:188` fetchTagAvatars、`:189` fetchTagPerson、`:205` fetchTagVisuals、`:210` fetchTagVisual均300秒。`web/src/app/(site)/tag/[tag]/page.tsx:32` route revalidate60，`:95–99` 同render取person／visual／relations。首頁來源實際為 `web/src/app/page.tsx`，不能套用不存在的 `(site)/page.tsx`。`app/src/tag-groups/submissions.ts:259–260` 審核commit之後 fire-and-forget refreshPages，不是確認失效完成；`app/src/pictures/refresh.ts:14` 吞失敗。此source定位尚未比對APP677 immutable source逐檔hash，執行adapter時仍須驗證同artifact。
首頁 `web/src/app/page.tsx:39` 是revalidate120且`:43` force-static；因此首頁HTML/RSC B fresh同樣不能從API測試外推，暖後可能直接cache命中而無SQL barrier。首頁可呈現哪些 fixture資料，須依實際 loader／MastheadCloud render和已存fixture決定，沒有relation panel就不把relations撤下強套首頁。

## 可送 babysit 的唯讀 bootstrap（未執行）

新增 `tools/f1-privacy/candidate-adapter.mjs` 會核對兩PID cwd、release COMMIT、兩BUILD_ID、API `TAG_DB_URL` 指定127.0.0.1:18306/tag_f1_semantic_test、API PORT/UI_ORIGIN、Next PORT/TAG_API_ORIGIN；禁止正式18130/18131/18132/18134及DB18306作HTTP入口。它讀JSON/HTML/RSC實際response與headers，不啟服務、不連DB、不mutation。每surface固定匿名→四header各fake/空值→匿名，最多8surface、每body2MB，10秒是失敗deadline；結果只保存hash/headers/canary判斷，不保存正文或proc secrets。

bootstrap exact形狀（交babysit補入並核准config後才可執行）：

```sh
nice -n 19 node tools/f1-privacy/candidate-bootstrap.mjs --approved-read-only-config /home/deck/tag-analysis-private/ui-review/f1/privacy-read-only-config.json
```

config只可填reviewer核對的現有candidate PID／releaseRoot／隔離入口，不從此文件猜埠。結構如下，尖括號必須替換成既有fixture證據，不可原樣執行：

```json
{
  "app": "677a0c793eeda0c4d850c81ac574c95508d08e0a",
  "buildId": "PmjYScQDDoJKBr43SLkhd",
  "database": "tag_f1_semantic_test", "actors": [701,702,703],
  "releaseRoot": "<reviewed immutable path>", "apiPid": 0, "nextPid": 0,
  "gatewayOrigin": "<reviewed existing isolated loopback HTTP origin>",
  "nextOrigin": "<reviewed existing isolated Next HTTP origin>",
  "surfaces": [
    {"kind":"json", "path":"/api/v1/tags/<encoded existing fixture>/relations", "present":["<public canary>"], "absent":["<private pending canary>"]},
    {"kind":"html", "path":"/tag/<encoded existing fixture>/", "present":["<public canary>"], "absent":["<private pending canary>"]},
    {"kind":"rsc", "path":"/tag/<encoded existing fixture>/", "present":["<public canary>"], "absent":["<private pending canary>"]}
  ]
}
```

RSC只發 RSC:1 canonical請求，必須回text/x-component；若candidate需要router state headers而此形狀不成立，工具直接fail，不用query/retry冒充。HTML敏感headers成功要求private,no-store；若proxy繼續匿名ISR header則直接fail，不能因fake凭證「沒有登入」放寬本次隔離要求。此工具不證明真actors存在、不驗manifest內容hash或socketPID擁有者；babysit必須另核對proc／ports inventory和fixture ownership。COMMIT/BUILD_ID只是身分標記，不能冒充檔案完整性簽章。敏感標頭fake值不新增帳號、不建立API key，不證明真權限gate；私人圖片admin成功仍需既有合法fixture session。

## fixture與hook可行性分類

| 類別 | source已知 | 當前證據狀態／下一步 |
| --- | --- | --- |
| 已有隔離fixture定義可驗 | tag-semantic.spec.ts 固定18306/tag_f1_semantic_test與actors701–703、公開甲/公開乙/待審詞/退回詞、group811、pending image | **定義存在不等於當前DB有這些rows**；本批未查DB。babysit只讀inventory須確認具體IDs/status/unaffected canary，不可直接跑此shared-db suite或其reset |
| 可唯讀驗收 | 上述relation fixture若Mint保留；tag HTML/RSC由真page fetch | bootstrap可執行10次每surface序列，尚未執行；row不在就缺fixture，不能換成production tag |
| 需補／確認fixture | 首頁雲圖active tag avatar/visual、可隱藏現有公開圖片、pending image blob及合法既有session | 不能從公開甲relation推論首頁必有它；缺active picture不能做old URL撤下barrier，缺session不能admin200。需另核准既有fixture補充，不新增actor |
| **現有APP677無可用barrier hook** | server.js 在buildApp後listen；buildApp內db封閉、最後app.ready；/internal/* gateway403；Next internal/revalidate只有失效，不攔SQL結果 | 外部HTTP adapter不能暫停已running API的pool result、也不能提供真SQL postcommit B correlation；`armSqlResultBarrier`故意throw。沒有hook route可呼叫；不新增正式hook endpoint |

完整硬性B0至少需在**隔離同APP source的測試gateway程序**啟動前注入wrapped pool+AsyncLocalStorage；Next也需test-only correlation preload將A/B沿fetch傳到該gateway。這會需要核准隔離gateway啟動與Next隔離指向／可能重啟，違反本批不啟服務邊界，故此處未實作暗中起服務的「真barrier」。不能只新啟gateway後把Next仍指原gateway當同一barrier。既有APP677 source支援buildApp injected db，但會media-label初始化，需要fixture可承受；pool wrapper須只攔指定relation SELECT且不擋初始化。

若不允許上述test-only boot instrumentation，就無法在既有APP677程序做SQL-result B0，必須明列gate blocked，不能以唯讀10次序列取代。若允許instrumentation，需另做candidate exact adapter與核准命令；本批沒有mutation bootstrap。

最小product fix建議只在B0實際失敗後評估：敏感／可撤銷projection專用fetch使用no-store（不能泛改所有get），含projection route避免force-static/ISR；tag relations匿名API public TTL也需明確撤銷策略或no-store，才能涵蓋共享HTTP cache。圖片old URL一天cache仍是獨立問題，不能僅get60→no-store就聲稱解決。另一選項為確認完成的commit後失效，但現有refreshPages吞錯且不await，不具此證據。任何產品修正需新APP/BUILD候選另外申請；不得改APP677檔案或部署時rebuild。

後續離線驗證：兩個mock test檔共6/6通過，Biome全5檔通過。唯讀bootstrap本批未執行；其結果始終`barrierPassed:false`、`actorsVerified:false`、`deploymentGatePassed:false`。

barrier driver期限修正：overall預設15秒、phase5秒（上限overall30秒），caller既有deadlineEpochMs取較早值；每段identity/arm/entry/commit/B/A-complete與cleanup受同overall deadline限制，不另延長cleanup window。AbortSignal傳adapter；失敗release A、cancel/close，保留primary error與barrierEvents/cleanupFailure。adapter須真正取消HTTP／SQL，driver期限拒絕不能證明外部底層已停止。新增shared-A singleflight deadlock、entry/B/Acleanup永不完成的negative mocks；共10/10 pure測試通過，沒有真integration。

## Follow-up source review coverage

The initial 10 mock tests are retained as historical results. The corrected
package now has14 pure/mock tests (11 barrier lifecycle +3 adapter validation),
including identity timeout, arm timeout, identity mismatch and a late arm handle.
Cleanup starts for the entire lifecycle, aborts/cancels before a barrier exists,
and releases late handles within the original deadline policy. Cleanup failures
remain attached to the primary failure. These tests do not execute a candidate,
SQL mutation, SSR/RSC request or Google transport and do not satisfy the actual
B0 deployment gate. The read-only adapter continues to report
`barrierPassed:false`, `actorsVerified:false`, `deploymentGatePassed:false`.
