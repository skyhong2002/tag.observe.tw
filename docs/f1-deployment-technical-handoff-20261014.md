# F1：同產物部署前技術交接（2026-10-14）

本批未部署。APP `aff5c0289c4863fedb37368b4942884ccc068d77`、BUILD_ID `d1LVsC3sk6p04uOyWUx5T`；來源基底為已 fetch 的 `origin/main a89908a650c42a1224d657e6c908d5fd3c7be5a0`。正式站仍是 `0dd38b629621e27ccb40260a27b27cf2d7202519`。不重建、不 npm install、不登入、不送 GA、不改 Cloudflare／WAF。

## 已完成的技術檢查

- APP 原始碼來源對照的 analytics 35／35、cache/gateway 19／19 測試通過。測試匯入本次實際 artifact；測試檔由 exact APP 的 Git 取得。測試使用 mock／inject，不能當成正式流量或 GA 收件。
- 真實隔離 DB `18306/tag_f1_semantic_test`、實際 Fastify、實際 Next：匿名 relations 200／`public, max-age=60`；Cookie、Authorization、X-Service-Token、X-Api-Key 的無效與空值成功請求均 `private, no-store`；400／401／404 均 no-store。429／5xx 另由上述測試涵蓋，沒有故意對正式站製造錯誤。
- SSR HTML 200；RSC 正常 canonical 307 後是 200／`text/x-component`。帶憑證的 HTML no-store。匿名 pending image 401／no-store。公開六條關係只投影 approved，沒有投稿者、審核者、私有理由或 image blob；pending／rejected 邊未投影。
- 原產物有 fixture 建置時的 prerender 資料，不能直接發佈。另製作 cache-free **副本**，省略 339 個 generated cache／HTML／RSC／meta／body／segment entries，沒有修改任何 compiled JS、CSS、native、COMMIT 或 BUILD_ID。原產物完整保留。
- 新副本真實首頁 GET 是 200／`x-nextjs-cache: MISS`，tag SSR／RSC 與 404 可重新產生。另補核 favicon、SVG／Apple icon、兩份 manifest、七種 OpenGraph 圖片；canonical URL 全部 200。Next 設定 `isrFlushToDisk: false`，測試重新產生的 fixture 回應留在測試 process 記憶體，測試 process 已停止。
- 對新副本逐檔 `rg --text --fixed-strings`，13 個 exact fixture 私有標記及 fixture DB／origin 字串皆無匹配；40 份匿名回應亦無匹配。這是已列明 canary 的檢查，不是未知私有資料的完整證明，也不是 B0 post-commit 競態實測。
- 新副本 8 個 `.node`、ONNX import、root／standalone Sharp 16×12 AVIF／WebP 編解碼通過，動態 library path 都在副本內。12 個 ELF bytes 與原 smoke 相同，原最高 GLIBC requirement 2.30、RPATH 在產物內的證據仍適用。

012 的 16 張主要頁圖片已有非作者實際看圖 review；manifest `7598b970…`、HAR `363c137e…`、DNT=1、Google 0，詳見 [012 完成紀錄](sm-paired-012-completion-20261014.md)。技術 mock／GET 不取代 UI 或正式驗收。

## 產物與私有原件

| 項目 | 路徑／canonical SHA256 |
|---|---|
| 原產物（保留） | `/home/deck/tag-analysis-private/f1-release/simple-web-aff5c028-001/artifact`；`103b9e671f66c6fe8af530db40fb9e0e9f5b8a38c0822af30404b398e26ac9fc` |
| Cache-free 副本 | `/home/deck/tag-analysis-private/f1-release/deployable-d1LV-cache-free-001`；`59468c4000368e31dce2f9b4a392bcbcd9a133ef1a8a893a0f68f5d851fbbce5`，32114 entries |
| 技術原件目錄 | `/home/deck/tag-analysis-private/f1-release/deployment-tech-d1LV-001` |
| 原件索引 | 上述目錄 `technical-evidence-index.json`；`4289640744ae3b54eb7679e2a6f2152cced3cd4302fe9616c5c30eff3106d629` |
| Canary 清單與 grep | `private-canary-needles.txt`、`private-canary-grep.json`；exact argv、body hash／欄位检查存原件 |
| 初次獨立技術 review | `/home/deck/tag-analysis-private/f1-release/deployment-tech-d1LV-independent-20261014.{json,txt}`；JSON `0911800aa3cc1a4bdd8dffaba81bd07e3c1b8b7591d0f671e6833c72f7e37d32` |
| 補充獨立 review | `/home/deck/tag-analysis-private/f1-release/deployment-tech-d1LV-addendum-independent-20261014.json`；`4768844a0f8980f98a5c2aa49d2bd3d01dfaf27411169bf258fc5fb1843e4f56`，UTC07:52:44；canary／metadata／GET後inventory一致，提案仍 NOT EXECUTABLE READY |

原 inventory 不能當成新副本的 hash。副本部署到 exclusive release 後如合併舊 immutable static URLs，必須另記新增 assets 的 hash，不能把完整部署目錄再聲稱成 `59468c40…`。合併使用 `--ignore-existing`，不覆寫新 assets、不攜帶舊 HTML／RSC。

## Migration：不需要

唯讀正式 `13306` schema metadata 於 UTC 06:51:19 核對：`tag_submissions`、`tag_submission_log`、`tag_relation_lock` 已存在；lock singleton 存在，0038 SQL SHA256 `65b1a1195598e7f497ecd59f4ba5745782a455326bc3bbb1023e65dc3699bd07` 與 `__drizzle_migrations` id39 相同。

不執行 migration、DDL 或 down；因此沒有需要新備份的「受影響資料表」。本批只提出備份既有三個 unit、gateway drop-ins、current 指標與 timer 狀態。`tag-backup.timer` 只讀狀態，維持停用。回滾不 DROP 表、不還原資料、不刪新投稿，保留全部 release／備份／worktree。

## Exact 指令：待入口切換方式核定，未執行

正式 gateway 固定在 `127.0.0.1:18130`。現有 installer 會重新建置、重啟與啟用 backup timer，因此不能使用。一般 `systemctl restart` 會有短暫 listener 中斷，沒有把它當成使用者已授權的例外。

本機藍綠的 **條件式提案** 在 [docs/deploy/d1LV](deploy/d1LV/README.md)：新 API／web 位於 18230／18232，舊 0dd API／web 保持運行；部署副本與備份估增加不超過 1 GiB。先只讀檢查 root 路由命令可用，再做 copy／start／匿名 prewarm／worker 切換，最後提議一個 exclusive NFT NAT table 切換 origin，不改 Cloudflare。

```sh
# 必须先经 babysit 及本机 routing owner 核定；当前不能执行成功。
/usr/bin/bash /home/deck/Projects/tag-sm-f1-release/docs/deploy/d1LV/deploy.sh

# 条件式回滚：新连接回到仍在运行的 0dd38b6 API/web，关闭新 gateway keep-alive。
/usr/bin/bash /home/deck/Projects/tag-sm-f1-release/docs/deploy/d1LV/rollback.sh
```

切換尚有明確阻擋：`sudo -n nft` 實測需要密碼，所以沒有做 NFT dry-run 或修改；提案的 runtime NAT 及 worker 啟動狀態尚未有 reboot persistence；cloudflared 既有 keep-alive 的 drain 與 rollback 關閉新 API 的在途行為也未實測。**這些指令是供核對的提案，不是 deploy-ready 或部署成功。** 請 routing owner 提供既有無中斷的入口切換方式，或核定並完成這些路由條件；不把新 wrapper 當成解法，不索取密碼、不自行改權限。

Worker 必須在公開新投稿前更新：F1 userId-bearing image jobs 必須保留 pending／private。若回到 0dd 的 API/web，新的 worker 仍保留以安全處理已入列投稿；不能讓舊 consumer 把私有圖片直接發布。這是明示的 application rollback 邊界，並非聲稱全部 process 都回到 0dd。

## 授權與閘門

送核對的 fresh probe／commands hashes 會另存 `/tmp/babysit/mint-queue/tag-deploy-d1LV-20261014/`。每站三次 HTML GET，中位數 tag≤2.0、blog≤6.17、YT≤2.0；任何 trial 非200／curl錯誤均停。原始開始／結束 UTC、exit、bytes、CF cache status 必須保存，開跑前再量，不重用此送審快照。

全站一個 build／兩個 browser、load12、disk40→30 GiB、DNT1／零GA持續；此批沒有 build 或 browser，只 copy／已有 compiled code 的 startup。遠端名額仍由 babysit 核對，本機 `/proc` 不能冒充全站 probe。

Ledger 仍是 **65 主 route／0 完整 route pass／65 完整 scope pending**；012 主要頁是部分狀態實圖通過。部署後仍需 babysit 的正式 `/tag/柯文哲/`、API、1280／390、header 與隱藏資料驗收，其餘逐頁 review 照常補。
