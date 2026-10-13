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
