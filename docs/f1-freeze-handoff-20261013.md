# F1 凍結期間交接：source 就緒，UI／部署未完成

紀錄 UTC：2026-10-13 03:13:20。工作目錄 `/home/deck/Projects/tag-f1-release`；本輪基底 `b8d030c747f87c997800371e33e1ab2d168ad257`。沿用先前從遠端建立並整合的 worktree，未改共享主 checkout。

本輪 source freeze：`2331fa8a136ed0271d1f001cf8a2e780a1b8377d`。其後只補交接／ledger 文件，不把文件 commit 冒充已建置候選。解凍後如需合併新的遠端修改，必須重新確認最終受建置 SHA，review 不跨 SHA 挪用。

| Commit | 內容 | 檢查 |
|---|---|---|
| `9db1e43` | 圖片投票 CAS，避免覆寫管理員決定 | 11 mock tests＋獨立 source review |
| `4182009` | T-ref 元件完整路徑、token、圖片及審核契約核對 | 獨立 source/doc review |
| `3e7b1d5` | Relations 精確 membership、有界查詢與200／8層限制、較短路徑來源 | 12 mock/API injection tests、OpenAPI產生器一致、後端 noEmit 型別检查＋獨立 review |
| `2331fa8` | 投稿／審核去重與晚到結果保護、圖片deadline／取消／預檢大小及錯誤處理 | 16新＋11既有四issue測試、web/source tests兩份 noEmit 型別檢查＋獨立 review |

以上四個 commit 均已推送 `origin/feat/shared-tag-submissions`。三個產品修正分別由非作者 GPT-6.1 Sol instance 審查，review 發現的 cache／provenance／body abort 問題已修正後複審。原始 log：

- `/home/deck/tag-analysis-private/f1-release/vote-cas-independent-review.log`
- `/home/deck/tag-analysis-private/f1-release/t-ref-independent-review.log`
- `/home/deck/tag-analysis-private/f1-release/semantic-independent-review.log`
- `/home/deck/tag-analysis-private/f1-release/frontend-final-independent-review.log`

同一 source freeze 上的最終整合命令：`nice -n 19 env -u CI -u TEST_DB_URL ./node_modules/.bin/vitest run --project unit app/test/picture-vote-race.spec.ts app/test/f1-offline-contract.spec.ts web/test/f1-frontend-flow.spec.ts web/test/four-issue-ui.spec.ts --maxWorkers=1`。**4 files、50/50 passed，7.81秒**。結果於上述UTC核對，原始輸出 `/home/deck/tag-analysis-private/f1-release/freeze-final-mock-tests.log`。僅 mock／SSR／Fastify injection，不連正式或隔離 DB。型別命令均 `--noEmit --incremental false`，未產生 build output。

主 ledger：`docs/ui-review-ledger.md`；65主route（9 notes和3邊界狀態另計），`2331fa8` **0 review、0 pass、65 pending／missing／待重拍**。逐頁排程 `docs/ui-review/f1-recapture-queue.md`。歷史225fa38的5pass／4issues保留歷史身份，不能代表本版；原有四項source fixes仍須真正雙寬復驗。

解凍後順序見 `docs/f1-unfreeze-deployment-plan.md`：明確解除freeze與安全gate、單次低資源build、同SHA逐頁candidate review、babysit畫面驗收、新pending-image worker先於新API、可回切且不中斷的路由切換。沒有新增帳號／權限或操作CF。全部release、備份、暫存／清理候選保留。

PSI：`docs/psi-offline-readiness.md`核對現有SSR、圖片WebP／priority／sizes、延後面板與預取修正，沒有新增猜測性產品改動或新測量，未宣稱分數改善。原始73／LCP4.44秒屬歷史版本，與原PSI69／7.8秒的量測設定未能完整比對。

限制：mock不能證明真實SQL執行計畫、資料庫並行或完整React生命週期；圖片quota目前限制已持久化投稿，尚在queue的avatar jobs沒有預留每日配額，此既有能力界線詳见backend review。所有實際UI／browser／正式服務驗證都仍待解凍，不能宣稱F1整體完成。

**部署狀態：未部署。** 正式版本僅沿用既有紀錄 `0dd38b629621e27ccb40260a27b27cf2d7202519`，本輪未probe或重新驗證。凍結持續；未建置、建立image/staging、capture、匯出、大型檔案、清理，未碰tag-backup，未傳送GA事件。

Ledger／待重拍清單／部署回滾計畫／PSI文件另經獨立 GPT-6.1 Sol source/doc review 通過；65主route與source route核對一致，原歷史逐列狀態未挪用。紀錄 `/home/deck/tag-analysis-private/f1-release/final-doc-independent-review.log`。這不是實際逐頁 UI review。
