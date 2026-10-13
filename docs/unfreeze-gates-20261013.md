# F1 / PSI 解凍後的 candidate 準備

> **Sprint override:** 使用者於2026-10-13再次明確授權立即建置，到UTC07:10。本機tag/blog最多2個建置，YT遠端不計；三站門檻tag2秒/blog6秒/YT2秒。舊名額順序及blog2秒門檻不再適用。其餘disk40/30、load12、browser2、DNT與隱私規則維持。

使用者於台北 2026-10-13 12:5x 明確解凍；本文件取代舊文件的「仍全面凍結」、113 GiB capture floor、10 GiB build floor 及 load 16 規則。歷史量測和截圖不改寫。解凍不等於 tag 已取得建置名額。

## 來源與目前狀態

本批基底 `a6304f818c40a0509a85a5dfb7ca78b40aebf424`；產品 source `e68987fb2e5adaf92c07a92931b04ebb089710a6`。已重新 `git fetch origin`，遠端 `origin/main` 是 `a89908a650c42a1224d657e6c908d5fd3c7be5a0`，為本分支 ancestor。主 checkout 沒有變更。本批只改工具與準備文件；最終 candidate 要綁定實際建置 commit，不能把產品 source SHA 當成不同 artifact 的 BUILD_ID 證據。

首次 gate（2026-10-13 04:56 UTC，shell/tool 回傳值摘錄，非 browser）：`df -h /home` 69 GiB；load1 4.56；`pgrep -fc 'chrome|chromium|playwright'` 原始值9。這個數包含 Steam helper、shell 命令文字等，**不是9個 capture browser，也不是已取得名額的證據**。

| 首頁 | HTTP | TTFB 秒 | time_total 秒 |
|---|---:|---:|---:|
| tag.observe.tw | 200 | 0.060216 | 0.077789 |
| blog.observe.tw | 200 | 0.059234 | **4.002459** |
| youtube.observe.tw | 200 | 0.173980 | 0.181809 |

blog 超過2秒，因此沒有啟動 build/capture。須等 blog → YT → tag 的明確名額交接及新 gate 通過；觀察不到 build PID 不代表前兩站已完成。此樣本不能沿用為下次啟動許可。readlink 唯讀核對 current 仍指向 `0dd38b629621e27ccb40260a27b27cf2d7202519`；未新增部署或正式 UI 驗收。

## 工具與容量

- `tools/guard-next-build.js WEB_DIRECTORY PRIVATE_LOG_JSONL ESTIMATED_USAGE_GIB`：估算必填，開始前 free≥40 GiB，且扣估算仍≥30 GiB；每30秒 probe 三站 status、TTFB、total、exit code、UTC、load1 及 /home available bytes。任何 total>2秒、非健康 status、probe 缺失、load>12 或 free<30 GiB，STOP 自己的 detached process group。恢復採較保守 load<10、free≥40 GiB、三站健康。nice19、ionice3；Next 現有 cpus2/staticGenerationMaxConcurrency1 保留。
- 三站 probe 並行，curl deadline10秒；這是定期抽樣，不是 filesystem quota 或即時零延遲控制。controller 訊號與 orphan cleanup 只操作自己創建的 group。它不擁有全站排程：每次仍需交接、確認全站最多1個build／2個capture browser，並使用既有部署鎖。
- `scripts/install-service.sh` 的起始容量提高40 GiB，新建release必填 `TAG_BUILD_ESTIMATE_GIB`，在 staging/dependency write 前驗證估算；傳給guard。**這個舊installer仍會restart固定埠服務，不是本次無中斷部署途徑，也不可直接拿它建立本次candidate**。npm/staging階段的全程監控與名額交接須由candidate runner覆蓋，尚未執行。
- `tools/ui-capture-budget.cjs` 保留每批1–16張、32 MiB profile/log配置、4 MiB/PNG上限，16張估96 MiB；8 MiB final flush reserve，總檔案超過92 MiB即停。capture開始≥40 GiB、扣預估≥30 GiB，過程扣reserve≥30 GiB是本工具保守政策。必須給同步 `getServiceSample`，三站完整資料且不超過30秒；total>2或load>12即停。舊private collector尚未接此callback，會fail closed；不得跳過guard執行。

唯讀 `du`：既有 dba9325 candidate 約1.2 GiB（web依賴444 MiB、Next產物257 MiB、app依賴428 MiB），prepared release約583 MiB，均保留。新一輪規劃 **4 GiB**（candidate/dependencies、compiler cache、standalone複製及小型logs總配置），首批capture另96 MiB。這是估算，不是已配置／寫入，也不是總量硬上限。以使用者提示28 GiB/小時背景下降估算，20分鐘另可能耗9.33 GiB，不能只以當下69 GiB保證完成。名額交接後須重新df與估算，過程實測不足即停；不終止、不修改tag-backup。

全站2312矩陣格包含n/a/conditional；目前496 applicable，全部1300 conditional若成立，共1796潛在擷取格，單張配置約10.594 GiB，長頁分段與重試另計。不可一次全啟動；先F1與四個issues、首頁PSI，再逐頁繼續，65主route仍全數pending，不縮小scope。見主ledger與CSV。

## Candidate 驗收前置條件

1. 在新目標SHA建置成功前，不使用 dba9325 runtime 代驗 e68987f；manifest記錄完整commit、BUILD_ID、frontend PID/cwd、API/worker來源與fixture資料庫身分。矩陣是待拍計畫，所有狀態仍pending。
2. 沿用隔離fixtures與既有授權，不新增帳號/權限，不登入admin。投稿與審核以隔離fixture/API契約驗證並標示邊界；不能冒充正常帳號或正式DB操作通過。
3. 新capture runner使用啟動前已listen的HTTP proxy，僅允許指定http candidate origin；context routing於任何page/navigation之前安裝。舊persistent collector在launch後才route，尚不足證明啟動前全程阻擋，**不可直接復用**。新工具source與loopback測試完成後仍需實際瀏覽器證據，不把proxy程式存在當成已完成零外送capture。不改navigator、webdriver、UA、opt-out/cookie去繞過guard；原生DNT1，保留GPC與所有產品判斷。
4. 保存完整私有raw network evidence、SHA/BUILD_ID manifest、每批前後uptime及三站TTFB/total、1280×800與390×844及亮暗色截圖；log截斷、capture不完整、版本無法核對均不得pass。network零外送是UI capture防護證據，不是GA收件證據。
5. 由未撰寫該頁的GPT-6.1 Sol/Opus instance實際看圖，保存model、UTC、SHA、截圖輸入與transcript。65 route逐列記錄，不以source review替代。首頁candidate Lighthouse3次後取score、FCP、LCP、CLS、TBT中位數，保留設定/原始JSON，不量INP、不發合成GA。
6. review通過後走原有worker先行、私有pending image admission與本機藍綠路由計畫，先可驗證備份與回滾；不更動Cloudflare/WAF。部署後交babysit看正式畫面。只清理本輪新產生且確定不需保留的暫存，所有既有release、rollback、backup、worktree與證據保留。

本批guard與capture budget測試 **16/16通過**，包含本機tiny process group真實STOP/CONT、nice19與orphan cleanup；沒有Next build。installer `bash -n`、helper `node --check`通過。獨立非作者GPT-6.1 Sol source/tool review通過，log：`/home/deck/tag-analysis-private/f1-release/unfreeze-guards-independent-review-20261013.log`，含基底、UTC及逐檔SHA256。此為n/a-ui工具證據；沒有新build、candidate screenshot、Lighthouse或deployment。


## 啟動前網路防護準備（第二小批）

`tools/candidate-capture-proxy.cjs` 在瀏覽器啟動前建立127.0.0.1隨機埠proxy，只允許明確指定的canonical HTTP candidate origin。其他host、HTTPS CONNECT、WebSocket upgrade、非GET/HEAD均拒絕；redirect不跟隨。僅串流回應、固定upstream Host、移除hop/proxy headers，10秒exchange timeout。log不含URL、query、Cookie或Authorization。logger失敗會關閉gate與現有連線，後續request不得外送。

只供本機腳本使用的私有新collector（舊檔全部保留）：

- `/home/deck/tag-analysis-private/ui-review/f1/safe-capture-unfreeze-20261013.cjs`
- `/home/deck/tag-analysis-private/ui-review/f1/unfreeze-resource-gate.mjs`

collector先建立proxy再launch persistent context，設定proxy與`<-loopback>`、禁用QUIC及非proxy WebRTC UDP；保留原生DNT1 Preferences、Sec-GPC、webdriver與產品guards。context.route另阻擋GA/GTM及非同源傳輸。每次budget檢查確認network evidence仍完整；健康sample過20秒刷新、超30秒拒絕。啟動前browser parents必須少於2，過程不得超過2；build不得超過1。它們是抽樣與人工名額交接，不是跨thread原子鎖。

manifest與每筆capture包括UI SHA、BUILD_ID、viewport、light/dark、navigation HTTP/status與耗時；網路上限／log failure／其他操作錯誤會停止並標記networkComplete=false。只讀fixture可供顯示審查，**這個collector不執行真登入、投稿或審核mutation**；完整投稿流程仍需既有隔離candidate測試與獨立畫面review。

獨立review找到並已修正：proxy吞log錯誤仍forward、collector prelaunch log failure後仍可導航、舊/proc掃描吞錯而低估build。回歸測試包含logger always throws時candidate收到0個request及重複close。3/3測試只用loopback mock，未啟動Chromium或接觸Google，不能當成瀏覽器實際零外送證據。獨立非作者GPT-6.1 Sol transcript：`/home/deck/tag-analysis-private/f1-release/unfreeze-proxy-independent-review-20261013.log`，保留初版BLOCKED與修復後判讀，最終source／loopback review為PASS（非UI pass）。

05:04 UTC gate檔：`/home/deck/tag-analysis-private/f1-release/resource-gates/unfreeze-preparation-2026-10-13T05-04-04-784Z.json`。三站200，tag total0.614931秒、blog **4.193238秒**、YT0.300109秒；load3.86、/home73,394,184,192 bytes。仍未通過服務延遲門檻。使用者已明確回覆blog/YT尚未交接，因此本批繼續準備，沒有build/capture/deploy。


## Sprint runner source review

`tools/prepare-f1-candidate.js` 將archive、npm ci（ignore hooks）、Next與static/public複製放同一自有低優先process group監控，使用tag既有flock；private sprint授權證據、remote ancestor、tracked clean、新目錄exclusive。Next開始前重驗本機建置數，只有prepared不啟worker或切正式路由。

獨立GPT-6.1 Sol review通過，24/24測試與3語法檢查：`/home/deck/tag-analysis-private/f1-release/sprint-source-review-20261013.log`。修正了monorepo standalone複製位置、初始建置競態；這是source/tool證據，不是UI pass。candidate仍需實際同SHA／BUILD_ID截圖與另一instance看圖。
