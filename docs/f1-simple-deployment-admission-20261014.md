# F1 簡化部署提案（2026-10-14，未執行）

使用者已接受 gateway 數秒中斷，舊 `83f5cf29…` NAT packet 作廢。這批僅調整普通 Bash/systemd 部署指令；**不重新建置、不使用 sudo／nft、不部署前另造 executor**。

APP `aff5c0289c4863fedb37368b4942884ccc068d77`、BUILD_ID `d1LVsC3sk6p04uOyWUx5T`，來源基底 `origin/main a89908a650c42a1224d657e6c908d5fd3c7be5a0`。正式目前仍為 `0dd38b629621e27ccb40260a27b27cf2d7202519`。

## 同一份產物

部署來源 `/home/deck/tag-analysis-private/f1-release/deployable-d1LV-cache-free-001`，canonical inventory `59468c4000368e31dce2f9b4a392bcbcd9a133ef1a8a893a0f68f5d851fbbce5`；APP／BUILD／JS／CSS／native bytes 與原 reviewed build 相同，只省略 fixture generated cache/prerender entries。新正式 release 是：

`/home/deck/.local/share/tag-analysis/releases/aff5c0289c4863fedb37368b4942884ccc068d77-d1LVsC3sk6p04uOyWUx5T-simple-001`

合併舊 static 後會實際重算新的部署 inventory，不能再用 source59468當成完整release hash。[同產物技術證據](f1-deployment-technical-handoff-20261014.md)的54／54測試、SSR／RSC／no-store、13canary、native smoke與012的16實圖review保持；此批沒有改compiled code。

## 配置與回滾

採用 **drop-in**，`current` 與舊 `tag-web.service` 完全保持原狀。新 gateway override 固定 release／`UI_ORIGIN18232`；F1 worker override 固定新release，沿用原enabled worker unit。新web18232、新資料API18230是enabled user units，gateway Wants/After引用它們，重開機後會沿用同配置。舊版沒有relations API，故暖機用同APP的18230 API讀正式資料；不將18306fixture搬到正式環境。

備份 `/home/deck/tag-analysis-private/f1-release/deploy-backup-d1LV-simple-001`：三個原unit、已有drop-in目錄、current的readlink、backup.timer狀態。不備份或改.env值。**Migration不需要**，正式0038已相符，不執行DDL/down，不碰13306資料或tag-backup.timer。啟動worker後的正常背景工作屬既有服務執行，並非schema migration或人工資料回填。

完整[deploy.sh](deploy/d1LV/deploy.sh)、[rollback.sh](deploy/d1LV/rollback.sh)、unit/drop-in與流程説明見[README](deploy/d1LV/README.md)。部署只重啟18130 gateway一次；失敗則另外執行一次回滾重啟。原18132 web從未停止。回滾API/web到0dd、UI_ORIGIN18132；F1 worker保留以處理已入列私有image jobs。

停機紀錄使用 restart request→第一個origin200 的實測上界（UTC與ns），不把它假稱精確的斷線秒數。切換後origin/public六個DNT1匿名GET任一非200或curl失敗立即rollback；沒有cookies或GA執行。

## 指令（只供送審，尚未執行）

```sh
# babysit核對exact commit／hash與fresh probe後才執行。
umask 077
set -o noclobber
/usr/bin/bash /home/deck/Projects/tag-sm-f1-release/docs/deploy/d1LV/deploy.sh > /home/deck/tag-analysis-private/f1-release/deploy-d1LV-simple-001.log 2>&1

# 若部署後驗收需要手動回滾，單一owner執行此指令。
/usr/bin/bash /home/deck/Projects/tag-sm-f1-release/docs/deploy/d1LV/rollback.sh > /home/deck/tag-analysis-private/f1-release/rollback-d1LV-simple-001.log 2>&1
```

Bash ERR handler會在cutover安裝override後的任一失敗直接叫rollback（在已持有的部署鎖內）。切換前失敗保留所有檔案、嘗試停止新引入的API/web，正式gateway／舊web不變；worker若已嘗試stop則嘗試start恢復。收尾命令失敗會明列failed/unconfirmed並退出2，不吞掉失敗或假稱已停止。Gate三次中位數與raw保存沿用原已審工具，不使用lease/readiness wrapper；全站1build／2browser、load12、disk40→30與memory保護保持。此批新增0build／0browser，配置與copy預估新增≤1GiB。正式HTTPS可能HIT舊HTML，200不能替代babysit的實際畫面／SHA／BUILD_ID驗收。

獨立review、source hashes與新的fresh probe會交 `/tmp/babysit/mint-queue/tag-deploy-simple-d1LV-20261014/packet.json`；舊packet明確作廢。此文件本身不是執行授權，尚未寫unit/drop-in、複製正式release或重啟任何正式服務。Ledger仍65main route／0完整route pass／65完整scope pending；012四route現有state實圖partial pass，部署後補其餘review。
