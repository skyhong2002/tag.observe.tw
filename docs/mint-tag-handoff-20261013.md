# tag → Mint 建置與驗收交接（2026-10-13）

本批唯一 deploy owner：本 tag thread 的 root Codex。Mint 基礎環境由協調者準備；此清單不是開跑或正式部署的 receipt。tag 是第一個等待 Mint 的建置，原本 YT 後的 SM 建置名額已取消。18:50 截止已取消，全部原 scope 完成才結束；下列 pending 不代表縮減範圍。

## 固定來源與乾淨交付

- Repo：`https://github.com/skyhong2002/tag.observe.tw.git`
- 分支：`feat/shared-tag-submissions`。
- 本批 APP_SHA：`677a0c793eeda0c4d850c81ac574c95508d08e0a`，已推送；包含 F1、PSI、四項 UI issues 與後續暗色修正。產品 source 不再用舊 ae9e18e 代替。
- OPS_SHA：原 SM rollout 工具可固定 `64a427b1ef677d654ab0d711f08216510a692ecb`；Mint 專用工具仍在 source/mock review，完成後另補 OPS_SHA，不修改以上 APP_SHA 的內容。
- 已 fetch 的遠端基底：`origin/main` = `a89908a650c42a1224d657e6c908d5fd3c7be5a0`，是 APP_SHA 祖先。Mint 開跑前再 fetch，核對 exact SHA 與遠端基底；如果有新的基底而 APP_SHA 不含它，先由 owner 整合及重新固定版本，不自行換 SHA。
- SM 隔離 source：`/home/deck/Projects/tag-f1-release`。tracked/index 無未提交修改（本文件提交前除外）；既有未追蹤 `node_modules` 是指向另一 worktree 的 symlink，**保留、不傳送、不加入 commit**。不用這個目錄直接拷貝當乾淨交付。
- Mint 使用全新 clone、detached checkout exact APP_SHA，安裝前 `git status --porcelain` 必須空白。只從 Git 提交取得 source；不拷貝 SM 的 `.env`、node_modules、`.next`、個人 session 或整個既有 worktree。這樣交付內容不含既有未追蹤 symlink。
- Lockfile：根 `package-lock.json` SHA-256 `dcbdcc3df6d0fbb2517d12dcf59df5f07ab862c3b3c34b926c0d6a08f43e73c0`；`web/package-lock.json` SHA-256 `820cba8fbd5d4ac2b8251dcfce8e3bfa35368c7b8e144796b2d4c136b50167fa`。不得改 lockfile 或用 npm install 取代 npm ci。

## Mint 開跑前的能力檢查

- 使用者提供 Mint Node 為 `v24.15.0`；repo engines 為 `>=24 <25`，SM 本批也是 `v24.15.0`。Mint 非互動 shell 找不到 npm，需基礎環境 owner 提供可用的 Node/npm **絕對路徑及 PATH**，在同一個非互動 shell 核對 `node --version`、`npm --version`、`command -v node`、`command -v npm`，不可只依賴互動 nvm 初始化。
- 核對 Mint OS、architecture、libc、Node ABI 與 SM 部署 ABI。必須是相容的 Linux 執行環境；Mint-MBP 的名稱不能當 OS 證據。若實為 macOS/不相容架構，不拿 Mac 運算，也不把 darwin/不相容 native modules 傳回 SM。
- Mint 目前沒有 Docker、MariaDB。本清單不假設已安裝，也不授權自動安裝或建立帳號/權限。Next build 本身只需要隔離 HTTP API；它不必直接連 MariaDB。F1 真實隔離投稿/審核流程則需 Mint 上可用的既有 fixture DB 或有明確 scope 的 mock；不能因此連正式 DB。
- 需要 Git、tar、nice、ionice、curl、sha256sum、SSH/Tailscale 可信連線、可用 Chromium/Playwright 及獨立私有 artifact 目錄。未驗證主機金鑰不得跳過檢查。CCLabPC 不列入排程；Mac 筆電不運算。
- 建置是全站唯一名額，任何遠端 YT 建置也計入；須取得 Mint 開跑交接，不能因 SM 沒有本機 Next process 就自行開跑。截圖仍全站最多 2 個 browser。
- SM 不開新的 build/capture/restore；原本已執行中的工具讓其自然結束。Mint runner 必須記錄 **SM** 的磁碟/load/三站健康，不能拿 Mint 本機數字冒充 SM。固定門檻：SM `/home` 開始 ≥40 GiB、<30 GiB 暫停自己的工作；load1 >12、任一站 5xx 或首頁 total 超限就暫停。tag/YT 2.0s、blog 6.17s。基準時間與方法見 `docs/gate-baseline-20261013.md`，DYNAMIC 是端到端而非精確 origin 渲染時間。

## 建置指令與環境（只列名稱）

以下是 guarded runner 的底層步驟，不是繞過開跑交接或安全閘門的獨立指令。現有 `tools/prepare-f1-candidate.js` 綁定 SM 路徑與 SM 舊 slot 證據，**不得直接在 Mint 執行**；Mint adapter review 完成後再接線執行。

```sh
# 在 exact APP_SHA 的新候選 source 目錄，整批受 guard 管理
nice -n 19 ionice -c3 npm ci --omit=dev --ignore-scripts --no-audit --no-fund
# 在同一候選的 web/ 目錄
nice -n 19 ionice -c3 npm ci --ignore-scripts --no-audit --no-fund
nice -n 19 ionice -c3 node node_modules/next/dist/bin/next build
```

- Next 並行由 `web/next.config.ts` 固定 `experimental.cpus=2`、`staticGenerationMaxConcurrency=1`，output standalone；不再額外同時建置另一份。
- build 環境名稱：`PATH`、`NODE_ENV`、`NEXT_TELEMETRY_DISABLED`、`TAG_API_ORIGIN`。TAG_API_ORIGIN 指向 **Mint 上的隔離 candidate API**；不能默認回 SM 正式 gateway，也不能用正式服務網址作 candidate API。
- candidate web 環境名稱：`NODE_ENV`、`PORT`、`HOSTNAME`、`TAG_API_ORIGIN`。外部 preview 經同源隔離 frontdoor，實際可達的 Mint Tailscale URL 在服務就緒後重新核對，不預先宣稱可用。
- 若跑既有隔離 F1 API/worker：`TAG_DB_URL`、`REDIS_URL`、`PORT`、`UI_ORIGIN`、`LOG_LEVEL`、`F1_UI_SHA`、`WORKER_METRICS_PORT`、`AVATAR_MODEL_DIR`；只用隔離 fixture DB/queue/store。Redis 對 queue/圖片工作需要，純 Next build/mock API 不必啟 worker。ONNX 真模型未完成隔離驗證，不自動下載模型或啟預設 createDb 的子 worker。
- 正式 SM 的 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`TAG_ADMIN_EMAILS`、`TAG_SERVICE_TOKENS`、`TAG_ADMINER_SECRET`、GA/GSC 憑證以及正式 TAG_DB_URL **不傳 Mint**。隔離 bridge 使用既有 fixture actors，不做真 OAuth、不新增角色或帳號，也不把 fixture 當真人 admin 驗收。

## API、資料與服務依賴

- 既有隔離 fixture：SM `tag_f1_semantic_test`（原埠 18306）、actors 701/702/703；這不是正式 DB。Mint 尚未有同一 fixture，所需的小型、已去識別 fixture 搬移/接線仍 pending；不得為交接新增 SM restore/export 或拷貝 66 GiB 正式資料庫。
- 參考 recipe：SM 私有 `/home/deck/tag-analysis-private/f1-release/candidate-fixtures/` 與 `sprint-candidate-ae9e18e/`。內含 `db.env.json` 的目錄不能原樣傳送；只選去識別的 bridge source/scenario/image/test 輸入，路徑、APP_SHA、DB isolation 重新固定。舊 bridge 的 production GET relay 必須換成 Mint 隔離的公開資料 fixture；不能讓 Mint capture 重新產生 SM 正式資料查詢負載。
- 關係 API/OpenAPI/type/provenance、pending 不公開、四 credential no-store、審核權限/理由等已有 source/mock 與舊版本隔離 API 證據；重新執行須綁本次 exact APP_SHA。migration 0038 已在 SM 套用，這次不重跑、不回復 DB dump。
- 新 Mint backend 若只有 mock，manifest 標明 mock 限定範圍；不能把它當原 DB integration 或全圖片處理通過。

## 截圖與每頁独立 review 排程

- 所有 65 主 routes 的權威清單：`docs/ui-review-ledger.md`；逐 route×state×viewport×theme 計畫：`docs/ui-review/f1-recapture-matrix.csv`。既有矩陣的 source SHA 是歷史產品修正 `49cdad0`；執行時綁本批 **APP_SHA 677a0c79**，不沿用歷史 pass，原矩陣與舊圖保留。
- 首批：`/`、`/tag/柯文哲/`、少/空資料 tag、長關係 label、`/tag/柯文哲/picture/`、`/admin/tags/`（既有隔離 actors）、`/admin/writing/`、`/crawlers/`、`/crawlers/traffic/`；另驗 `/api/`、`/api/status/`、404/error、`/observe/opt-out/`，再依 ledger 逐頁完成其餘，沒有抽樣代替。
- viewport **1280×800**、**390×844**，light/dark；每個動態模板涵蓋多/少/空/error/權限，投稿開表單/成功/重複/待審、圖片私有/核准/拒絕、admin loading/queue/filter/page/reason 與長 label、keyboard。n/a 要有 source/test 理由，不自動 pass。
- 65 routes 最新版本目前 **0 完整 pass、65 pending**。舊 ae9e18e 的 48 圖只完成一個 route 的 loaded scope，dark 有 issue；既有 actual manifest 不代表新 APP_SHA。
- DNT=1；維持 webdriver/bot/GPC/opt-out 全部 guard。**瀏覽器啟動前**網路層拒 GA/GTM/Analytics transports，再設 context.route；保留 raw network/proxy log 與 attempted/completed 計數。零 Google 外送、禁止合成事件，不提供 GA 收件驗證。
- 截圖/model transcript 放 Mint repo 外私有目錄。作者不能自審，獨立 Sol/Opus instance 必須實際看圖；review manifest 寫 exact SHA、BUILD_ID、URL、實際 viewport、PNG/hash、UTC、model、transcript 與 raw network 路徑。配置/準備檔不算 pass。
- 容量暫估：build/install/package 預留 **8 GiB**，完整 screenshot 計畫 **約 10.6 GiB**（1796 個可能需拍格，長頁/重試另算），不是已產生用量。分小批 capture；SM 不為此生成大包，回傳先估容量，保留 SM 磁碟門檻。實際 Mint capacity 尚待核對。

## 產出、回 SM 與部署

- 建置目錄記 `COMMIT`、`web/.next/BUILD_ID`、`manifest.json`、guard/stage logs；把 `.next/static` 與 `web/public` 放入實際 standalone server 的 `.next/static`/`public`。同時保存 app/src/app/data 與根 lockfile/runtime deps，不能只交 web HTML 或 BUILD_ID。
- Mint 私有 artifact 根目錄由 owner 初始化時固定；預期 `<artifact-root>/tag/677a0c79/build/manifest.json`、`<artifact-root>/tag/677a0c79/review/manifest.json`，首次初始化後以真絕對路徑回填（目前未建立，不是假產出）。build manifest 記 APP/OPS SHA、BUILD_ID、兩 lockfile hashes、Node/npm/OS/arch/libc/ABI、API/fixture scope、baseline 及實際 gate samples。
- review 通過後，Mint 把 **同一份已審產物**打包並產生 sha256 inventory/tar checksum，經可信 Tailscale SSH/rsync 限速回 SM 新的私有候選目录；不用 SM npm ci/next build/restore 重造產物。native dependencies、server.js、static/fonts/public 都需在 inventory。
- 保留 Mint 原 manifest/圖/network/transcript；SM 另寫 deployment receipt 的路徑對照，不篡改原 manifest 的 Mint 路徑或跨 SHA搬 pass。SM核對包hash、APP_SHA、BUILD_ID、ABI、同份審圖與獨立 source review，仍由本 thread 唯一 owner 控制正式切換。
- 回傳與切換前重新確認 SM 空間及健康；現有 release、回滾版本、備份、worktree 一律保留、不清理。切換前保存小型 runtime/unit/config 備份，沿用已驗證0038前備份，不做新 full restore。
- 部署/回滾方案：`tools/f1-rollout-plan.js`、`docs/f1-local-route-handoff.md`；先 old worker drain active0/exit0、新 pending-image policy 核對，candidate 真畫面/headers/cold chunks/回切演練通過才公開。舊 gateway/web 保留，回滾只撤本次自己的精確 route，不自動恢復不安全舊 consumer。source plan PASS不代表這些runtime已完成。
- 部署後通知 babysit 用正式瀏覽器驗真實畫面。完成定義仍包含正式 UI 與每頁 review；目前 **未部署**，正式版本沿用前次核對 `0dd38b6`。

## 當前待接線（不需要新使用者功能決定）

1. Mint 基礎環境 owner 修好非互動 Node/npm、可信 SSH、Linux/ABI/空間和 browser，以及可用隔離 API/fixture/queue；完成後回報具體能力，不以「Mint online」當 ready。
2. tag source agent 完成 Mint runner/SM remote gate adapter source/mock tests，另一 instance 獨立 review，補 OPS_SHA。
3. 取得 Mint 全站唯一 build slot，第一個跑 tag 新 candidate；同份產物截圖 review → 回傳 → 唯一 owner 小批部署 → babysit 正式畫面驗收。

本文件只做 source/文件交接；未在 SM 或 Mint 啟動新的 build、capture 或 restore，未改 Cloudflare/WAF/GA/GSC，未碰 tag-backup/timer。
