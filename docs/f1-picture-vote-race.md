# F1 圖片投票與管理員鎖定競爭修正（source/test）

基準：`b8d030c747f87c997800371e33e1ab2d168ad257`。`applyVotes` 在讀取狀態與寫回投票結果之間，管理員可能已選定或隱藏圖片；舊 UPDATE 沒有比對讀取時的狀態，會覆寫管理員決定。

avatar／visual 寫回現在同時比對讀取時的 status 與 shownRank（null 使用 IS NULL）。沒有更新任何列時，重新讀取目前顯示的 rank，避免回報未真正生效的結果；不重試舊投票。沒有新增 migration 或帳號／權限。

`app/test/picture-vote-race.spec.ts`：11 個 mock tests 通過，涵蓋兩種圖片、null／非 null rank SQL 條件、失敗 CAS 重讀，以及 chosen／hidden／nonhuman 不寫入。TypeScript 對兩個變更檔的 syntactic/semantic diagnostics 為零；Biome 通過。

獨立 reviewer `/root/f1_vote_independent_sol`，spawn model `gpt-6.1-sol`，source review 通過；命令、UTC、base 與 diff/source hash：`/home/deck/tag-analysis-private/f1-release/vote-cas-independent-review.log`。reviewer 未撰寫產品碼。

界線：mock 檢查真實函式及產生的 SQL，但沒有重跑 MariaDB 並行 interleaving；不承諾每次並行投票立即收斂到最新 tally，也不處理任意 ABA。此項是 n/a-ui source/test 證據，不是候選 UI 通過。磁碟凍結有效，未 build、capture、probe 或部署。
