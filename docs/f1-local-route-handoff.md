# F1 本機路由交接（僅準備，未部署）

`tools/f1-rollout-plan.js` 只輸出 argv，須由協調者在獨立 review 通過後逐項執行；不 build、不複製 release、不讀出 `.env` 內容。以 existing candidate 的完整 SHA、COMMIT、manifest、BUILD_ID 及 standalone 身分產生 transient user units。先確認 18192/18194/18195 未占用，candidate API 的環境與 review fixture 不混用。Gateway 不需依賴 current symlink。manifest 保留隔離建置時 API origin（實際候選為18170）；web transient unit 以 TAG_API_ORIGIN=http://127.0.0.1:18194 提供 runtime API origin，使用同一既有產物，不改寫 manifest／重建。切換前驗證 server-side API 實際使用 runtime override。

## 部署前備份與 gate

協調者先以 umask 077 建立全新小型 private evidence directory，保存 `systemctl --user cat/show` 的三個現行 units（包含 drop-ins、PID、cwd、ExecStart），current symlink target、COMMIT、現行 nat OUTPUT 規則、runtime `.env` 的私有副本及其 hash。這些檔案可能含秘密，不印到公開 log／repo。只備份小設定，不 export 全 DB、不改原檔。現有 0038 gz 已於本次唯讀重驗 SHA256 `947adc1993e2eaadcbc694eaefd742ac5fbfd7c5ef96b5e64ed786eae5d76fef`，路径及隔離 restore 既有記錄在 f1-release-20261013.md；保留原檔，不重跑 migration。

先啟動新 web/gateway，直接隔離入口驗 UI/身份、privacy/cache、API、實際畫面，保留舊 gateway 18130/web18132 以及已建立連線。新入口尚未接公開流量。依 source 已驗證的 drain 行為停止舊 worker 領取新工作，等待 active jobs 為零並確認正常 exit0，證明舊 consumer 不存在；worker40秒deadline且exit1代表未完成drain，不能算成功；再啟動並確認新 worker 的 pending-image 私有候選政策。未完成此順序不得讓新投稿 admission 可達。對外流量切換前必須完成同 SHA 獨立畫面 review。

## 唯讀路由／權限驗證

2026-10-13 探測現有 `haproxy:3.2-alpine` image ID `sha256:9d3b7cdc11c490a3e2a6193b71adc184eb38c7a996c654503b5394ca71c595bb`，其 chroot 存在。必須 `--user 0:0 --network host --cap-add NET_ADMIN --cap-add SYS_CHROOT --mount type=bind,src=/,dst=/host,readonly` 才能 `chroot /host /usr/sbin/iptables -t nat -S OUTPUT`。預設 image user 的 chroot 會 EPERM。host `/usr/sbin/iptables` 指向 xtables-legacy-multi；現行 OUTPUT 僅有 Docker 的非 loopback LOCAL rule，未有 18130 redirect。探測不 pull image、不修改 rule。

NET_ADMIN 權限雖以 read-only host mount啟動，仍可修改主機網路；唯一授權 mutation 是帶本次完整 SHA comment、127.0.0.1/32 TCP dest18130 的 REDIRECT→18194。先檢查 rule 不存在及舊 pool健康，再插在 OUTPUT 第一條。不得 flush／restore 整張表，rollback 僅 `-D` 完全相同 rule。此方案不修改 Cloudflare/WAF/cloudflared。cloudflared 必須仍是 host-network origin 18130，否則 gate 失敗。

conntrack讓已建立 TCP 連線保持既有 upstream，新連線轉新 gateway；這是全量新連線切換，並非百分比 canary。route check 的 exit1表示 absent，其他錯誤不可視作 absent。切換命令失敗或 transport模糊時先 `-C` 確認實際規則，禁止盲目重插。現行舊 web 呼叫18130也會轉新API，需評估新舊API相容性；切換前後的持續连接、reader/admin session和browser健康仍需驗證，唯讀探測不能證明零錯誤。

回切僅刪自有完整 rule，舊 gateway/web永遠保留。新已建立連線仍可能存續，保持新 gateway/web直到drain。新投稿 jobs 存在時不得恢復舊 avatar worker；保留新pending-policy consumer或停用consumer，保持候選私有，不回復DB dump。

提交：本分工待主協調者整合；部署：未部署，僅唯讀 probes與plan source。

## 重開機與 immutable chunk 門檻（新增 plan，尚未安裝）

planner現在同時輸出persistent user unit內容與安裝argv；transient命令僅候選隔離驗證，不能當正式部署。持久化ops模組放獨立完整SHA私有目錄，不修改review過的artifact。需要一起保存planner、frontdoor、route及central baseline小模組及package.json的type=module；ops source需獨立review，不能單用artifact review代替。

舊 worker 原unit、所有drop-ins、enablement、current symlink、`.env`與iptables規則保存到新0700 private backup目錄，原release及DB備份保留。先 disable 舊worker boot activation；排空active0且正常exit0；備份並移開原worker unit到私有backup後以 /dev/null symlink mask阻擋任何依賴重啟。不覆寫丟棄原檔。備份內enablement資訊包含 `systemctl --user is-enabled`與 `show` 的FragmentPath/DropInPaths；若存在其他consumer unit/cron必須另行阻擋，未證明所有舊consumer停用即block。不要直接mask尚存在的原unit（systemctl會拒絕），也不要用unmask在rollback自動恢復不安全consumer。

persistent新gateway18194的UI_ORIGIN改18197，小frontdoor轉新web18192。新UI response成功原樣送出；僅 GET /_next/static/ 的404可固定fallback舊web18132，清除所有cookie/auth/router headers。API、RSC、POST、非static、transport failure及5xx不fallback。existinggateway只支持單UI_ORIGIN，沒有內建404舊chunk fallback設定；因此wrapper不可省略。舊pool須持續保存以服務cold chunk。HTTP-only wrapper未做WebSocket upgrade，目前若產品需要upgrade則需另列blocker；新artifact source不變。

route oneshot Requires/After新web/gateway/frontdoor/worker，先HTTP health，且需要完整SHA目錄中private admission-reviewed marker。marker只能在old-consumer barrier、新pending政策及同candidate UI/identity驗收完成後建立。boot沒有marker或新pool不健康時不加rule，舊gateway reader繼續服務且oldworker維持masked；不能以回到舊reader等同恢復舊worker。禁止另行保存整張iptables表自動restore；boot由unit重新加本次精確rule，stop僅刪本次rule。

仍未完成實際驗證：user manager linger/boot啟動、其他consumer來源盤點、worker health與版本/pending政策、cold oldchunk及新chunk實測、wrapper headers/session/cache與可用性、候選UI獨立review、restart/rollback演練。`/health`200不單獨證明worker政策；route gate前須operator完成SHA/process/policy確認。上述全部通過才可宣稱正式deploy ready。回滾先停route unit（不重新啟oldworker），等新web/gateway/frontdoor既有連線drain才可停新pool；newpending consumer留著或明確pause，不能隨web停止一起恢復舊consumer。

## 獨立 review 修正：env、stream、ops 身分與嚴格 boot gate

EnvironmentFile 的 secrets 繼續保留，但固定 PORT/UI_ORIGIN/TAG_API_ORIGIN 等由 ExecStart 的 `/usr/bin/env KEY=value` 最後覆寫，避免 `.env` 改掉新pool埠。不得以列印秘密檔確認；以 unit內容與runtime隔離健康驗證。

frontdoor刪除 request/response 所有hop-by-hop與Connection指定欄位，保留HSTS及cache/no-store；incoming aborted/error及upstream aborted/error中止串流，未送headers時502，已送則destroy避免截斷成功。outer gateway仍負責完整產品header政策。模組測試使用ephemeral loopback埠，不啟正式候選。

planner新增第四參數完整OPS_SHA，必須是包含小ops模組的已提交commit，與APP_SHA分開。snapshotPlan只讀 exact `git show OPS_SHA:path`產生module SHA256 manifest；輸出exclusive mkdir0700、exactcommit archive argv與read-only freeze命令，不自行安裝。若目錄存在立即拒絕，不能overwrite/reuse。同commit模組尚未提交時snapshot不能產生，待root整合commit後執行。manifest字串須完整原樣以wx0600寫入、檢查modulehash再freeze。unit的ExecStartPre以系統python驗pinned manifest hash/fullopsSHA/allmodulehash，wrapper及route只有通過才啟動。privatesnapshot保存package.json type=module與centralbaseline，不能引用mutableworktree。backup/evidence/admission marker位於獨立APP_SHA-OPS_SHA private evidence目錄，可寫資料不放read-only snapshot。

boot health採redirect:error及嚴格200；worker `/health`JSON status=ok且legacyOwnershipPolicy必須等於 source `ownership-policy.ts`的 `own-indexed-v2`。這個值是legacyownership契約，不等同pending-image完整驗證；後者仍是admission-reviewed marker建立前獨立source/runtime gate。404/401/redirect/transport/policy mismatch或iptablescheck非0/1均不insert。rollback不fetch、不啟舊worker，僅check/delete完整ownrule。

unit內容stage在獨立 writable evidenceDirectory/units：exclusive mkdir0700，unit以wx0600寫入，再由輸出install argv讀取該處，不放入read-only ops snapshot。snapshot archive僅canonical modules/package/manifest。main會比對目前執行的planner與所有canonical dependency檔案hash對上所選OPS_SHA blob；任一檔不一致就拒絕產生計畫，避免新版planner搭舊opscommit。最終review後root須先提交完整ops小批，再以同commit clean source跑planner；這是計畫身分驗證，不會自動部署。
