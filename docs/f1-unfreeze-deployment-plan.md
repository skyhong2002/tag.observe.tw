# F1 解凍後部署與回滾計畫（離線，尚未执行）

盤點基準 `b8d030c747f87c997800371e33e1ab2d168ad257`。此文件只讀既有 source／artifact；未 build、capture、probe、備份、部署或清理。既有正式版本依 release 記錄為 `0dd38b629621e27ccb40260a27b27cf2d7202519`，不是本次重新查驗。最初遠端基底為 `430cc019b41f769f361b4759f4a4651068aad328`，後合併 `a89908a`；解凍後必須重新 fetch、比較遠端 default branch，使用隔離 worktree，不能 reset 共用 checkout。

## 按順序解除 gate

1. **Source freeze**：主協調者整合所有已授權小修及文件後，記錄唯一完整 SHA、tracked clean 狀態、dependency lock hash、worker/API/UI source 身分與測試輸出。完成純 mock／unit、型別及獨立 source review；不得把 `dba9325` 舊 artifact 的 UI pass 搬到最新 SHA。`6479276` suggestions 修補及四項 UI regression、F1 公開投影/cache/privacy 契約的既有離線測試只證明測試涵蓋範圍。T-ref scope/path 盤點屬依賴，不能代替畫面驗收。若 source blocking 尚存，不先 build。
2. **使用者明確解除完整 freeze**後，才重新量主機容量／load／build/browser 數及授權服務可用性。先確認原有 release、備份保留、沒有競爭 build；不得為騰空間刪除它們。installer 的 10 GiB 是最低拒絕線，不是完整 build/capture 容量承諾；先估 dependency、standalone、cache 和後續證據預算並留正式服務餘裕。capture 既有計畫採 >113 GiB 空間、load≤12、批次≤16、預估≤96 MiB，必須依使用者當次核准預算重新確認，不能沿用歷史數字當現況。
3. **唯一一次低資源 build**：凍結 SHA 不變，Next `cpus:2`、`staticGenerationMaxConcurrency:1`，使用 `tools/guard-next-build.js` 的 `nice 19`／`ionice -c 3` 專屬 process group，每30秒監視。guard 在 transport/probe error、5xx、load>16 暫停；暫停後 load<10 且服務正常才恢復。它現在只 probe tag/blog，不能聲稱涵蓋 YT／disk；由當次協調者補充已授權監視與磁碟中止門檻，不增加產品功能。兩 worker 不限制每頁平行 DB/fetch；記錄所有 pause／resume／exit／UTC。超過容量預算或服務惡化就停止自己的 build group，保留失敗資料，不盲目重跑。freeze 未解除時連 guard 都不能啟動（會正式 probe）。
4. **同 SHA 候選**：一次 build 成功後才 release smoke、確認 COMMIT/BUILD_ID/API source PID cwd 和 fixture 身分，保留舊 immutable chunks。candidate 使用隔離入口、fixture caches 不得進 runtime。重新依 65 主 route 加適用狀態矩陣，在1280／390驗 loaded、少筆、empty、error、loading、角色、互動及頁尾；新 relation／private image／pending approval／suggestions、長標籤繼承badge、單一 admin gate、crawler empty 都須真圖。既有9 notes implementations及新狀態不是額外 route。每小批先 gate，原證據保留；證據截斷／超預算／來源SHA不符不得算完整。
5. **獨立畫面 review**：非產品作者逐圖核對同 SHA，更新各 route 狀態及 blocking，不能用 HTTP200、DOM、source review 代替。若必須改產品 source，重新 freeze SHA，停止沿用前版候選通過證據；「一次 build」是 source 已準備完的目標，不能以此跳過失敗驗證。babysit 完成候選實際畫面與操作驗收後，才排正式切換。

## Worker 與連續服務切換

0038 已於 UTC 2026-10-12 20:07:12.438–20:07:13.599 applied；journal 38→39，新增 `tag_submissions`、`tag_submission_log`、`tag_relation_lock` 及 indexes/singleton，沒有 ALTER、trigger 或 crawler write change。不得重跑此 migration。既有選表備份及隔離還原成功事實／hash在 [release 記錄](f1-release-20261013.md)，保留原檔；本工作沒有新備份。

**新 pending-image worker 必須先於任何新投稿 API admission**。切換前仍由舊 gateway 服務閱讀，保持新投稿入口不可到達；drain/停止舊 worker 領新 job，等待 active jobs 收束，核對 queue 類型、worker source SHA、job handler 私有候選／pending 政策和公開 visual 未自動發布，再啟動新 worker。不可只改 frontend symlink；也不可先開API再賭舊 worker 尚未取到新 job。若不能證明沒有舊 worker consumer，就不開投稿。prepared API 曾運行不等同公開已開放。

既有 `scripts/install-service.sh` 會變 current symlink 並 restart 固定埠 web/worker/gateway，會有連線拒絕；**它不是無中斷切換控制器，不直接以此完成此要求**。routing owner 需交接：可持續服務的前門／upstream ownership與操作權、兩組不同埠 frontend+gateway 的確切目標、候選與舊版健康/identity檢查、選定的小批流量比例與session/credential路由、每階段觀察窗與錯誤/latency中止線、連線 drain、立即原路回切操作及負責人。固定 upstream 無法分批时，須先提供有權限的本機前門方案；未具備就保持舊公開站、新投稿關閉並標 blocked。此工作不改 Cloudflare／WAF。

在 owner 已核准並演練回切後，先保留完整舊 pool，再切少量流量到同 SHA 新 gateway+web，驗匿名與憑證 cache、HSTS、404/error、reader opt-out、relations與圖片待審政策；觀察窗通過才增加。以既有授權小樣本驗證正式畫面，不重跑全站 capture。實際UTC、版本、routing與驗收結果要事後如實記錄；babysit 最後確認公開畫面。

## 回滾

保留 `0dd38b6` 舊 runtime、所有原 release／備份與新審核資料，不 DROP 0038 tables，不覆蓋 journal，不以舊 dump還原正式DB。additive schema允許舊 application忽略新表；這是 source相容性，不代表新feature在舊版等價可用。

先關新投稿 admission並阻止新 avatar job產生，drain新 worker；將公開閱讀流量切回健康舊 gateway+web，同時保留新 pending-image worker或暫停 avatar consumer。**不得在含新投稿job的queue直接恢復舊worker**：舊發布政策可能直接 publish。確定所有待審job及候選仍私有、隔離/處置方案已審核後，才允許舊 consumer處理相容工作；否則保持該consumer停用，明示功能降級。回切後驗舊SHA、服務可用、cache/privacy與新資料保留，記錄失敗原因及下一次重新freeze所需項目。

提交狀態：本分工未 commit／未 push，由主協調者整合。部署狀態：未部署；這是解凍後計畫，沒有新runtime／browser／正式驗證。
