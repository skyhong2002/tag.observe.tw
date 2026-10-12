# F1 離線 API／文件契約複查

- 基準 SHA：`00da091601da5371884e20b7ab2b3776d491e9a3`。
- UTC：2026-10-12T23:03:05Z；模型記錄：GPT-6.1 Sol。
- 邊界：只讀 source、git 與本機文件，新增純 mock／Fastify injection 單元測試；沒有 browser、capture、build、staging、probe、export、真 DB、Redis、對外網路、正式服務或 tag-backup 操作。不安裝依賴。

## 已確認

`tagId` 保留原 UTF-8 字串 SHA-256；`relationKey` 只對 related／alias 對稱化、is-a 保留方向，字面 `group:811` 與群組 ID 不碰撞。公開關係使用持久投稿 ID 或既有 group-membership ID。SQL 限定 approved relation，分類限定 auto／confirmed；topic 不冒充 is-a，沒有讀取共現資料。

公開投影只輸出 target、source／sourceDetail、createdAt、status、inherited、depth 等契約欄位；不輸出 email、投稿理由或審核者。source 寫入來源為 manual／submission，既有分類來源有明確 enum；不接受任意私人描述。mock 注入額外私人欄位後不會出現在回應。

relations 路由匿名成功為 public max-age=60。gateway onSend 依憑證標頭存在（含空值）覆寫 private,no-store，所有 >=400 回應覆寫 no-store。測試使用 vi.mock 包裝 Fastify constructor，於 buildApp boot 前註冊 mock-backed 真 relations 路由；Fastify instance、injection engine 與 gateway onSend hooks 保留真實實作。在同一 relations 路由驗證匿名成功、四種憑證含空值的成功、400 驗證錯誤與 mock query 拋錯的 500 均使用正確 cache-control。buildApp 不傳入 DB／tagDbUrl，因此沒有 media-label 初始化查詢；不啟動 listener。OpenAPI success/error schemas、type enum、approved const、nullable createdAt 與生成文件一致；docs/api.md 對 renderApiMarkdown 完全相等。

T-ref 34 個元件／目錄參考中原本 3 個 admin 路徑依前言解析不存在，已補完整 admin 路徑。globals.css 的品牌 50–950、字型、dark variant、table 背景 tokens 均存在。此為 source 路徑驗證，不是視覺驗收。

## 限制與未測項

- 新 tag→tag 語義邊最多 200，查詢 201 筆作截斷偵測；tag is-a 追溯最多 8 層、每層 membership／relation 查詢最多 201。回應 truncated 提示不完整，但沒有 cursor／下一頁機制。
- 既有分類不計入上述 200 邊限制；直接 defs／memberships 無 SQL limit、group ancestors 無固定深度上限（有循環停止）。因此總 relations 可以超過 200；沒有在真資料量下量測效能或保證全圖固定 payload 上限。OpenAPI 說「200筆新關係」而非「總共200筆」，與實作一致。此限制已通知主 agent，未擅自改圖語義。
- 未執行 shared-db 的 tag-semantic.spec.ts、會啟本機 HTTP listener 的 api-docs.spec.ts、會連 DB／fetch 的 check-openapi.ts。未驗證 DB collation、SQL 實際篩選、併發審核、quota、部署版快取、跨站瀏覽器或 runtime CSS。
- mocks 已預先選擇 approved rows；不宣稱 mock 證明 SQL WHERE 行為。SQL eligibility 由 source review 確认。

## 驗證與狀態

命令：`nice -n 19 node node_modules/vitest/vitest.mjs run --project unit --maxWorkers 1 app/test/f1-offline-contract.spec.ts`。最終 1 檔 6 測試全通過；沒有 coverage／CI 設定。route schema 比較實際回應欄位與物件 schema 欄位，不只檢查文字。第一版嘗試在已 boot gateway 後加路由失敗，最初改用獨立 Fastify route injection；複查再改為 constructor 包裝以測同一 instance，最終 6/6 通過（5.31s），Biome 通過。

提交：此分工未 commit／未 push，由主 agent 整合。部署：未部署；不表示本機文件或測試已上線。


## 獨立測試複查

另一個GPT-6.1 Sol instance `/root/pending_sha_audit` 審核mock边界、真handler與cache hooks，並針對兩個新測試檔做TypeScript API的限定語意／語法diagnostics（noEmit、incremental=false，沒有整站typecheck或build）。首次找到Fastify overload參數與schema物件union兩項型別錯誤；已改成明確FastifyServerOptions與runtime object guard。`2026-10-12T23:07:13.695197+00:00` 同一diagnostics script復驗兩檔均無錯誤，且未削弱真路由／hook的執行。私有log `/home/deck/tag-analysis-private/ui-review/f1/freeze-unit-independent-review.log` 保存首次失敗、修正後結果與hash。
