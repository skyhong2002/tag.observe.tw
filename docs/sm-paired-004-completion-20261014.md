# SM 004 candidate＋capture：實際失敗與收尾

本批 control OPS 是 `1b73801d67ec85ad6ee0d613ac0687ae0344b9de`，來源基於已 fetch 的 remote default `a89908a650c42a1224d657e6c908d5fd3c7be5a0` 祖先；沒有動共享主 checkout。babysit 於 UTC 2026-10-14 00:12 核准合併執行；本批已實際執行，**capture 失敗，沒有 PNG、沒有 UI pass、沒有部署**。所有原始資料保留。

## 身分與實際結果

- APP：`677a0c793eeda0c4d850c81ac574c95508d08e0a`。
- BUILD_ID：`PmjYScQDDoJKBr43SLkhd`；沿用產物，沒有重建。
- inventory：`f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`。
- manifest：`76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`。
- paired input：`f78c199218e967f209b4a7e5f4abf353f7a252bea0ead11b8da5a9cf039a92f5`。
- candidate input：`d1de0bad3c066d89d7343018e6edb0985b118174c2d5a40e393859667fb49abd`。
- capture input 從真 started receipt 推導：`767e0cbd0db19e95e9105a2c7779b8320eb7d0edfe79a10e6ffe1c891ff4df71`，沒有預填 runtime input hash。
- candidate parent `3418669`；worker `3419040`；API `3419206`／18197、Next `3419317`／18198、frontdoor `3419344`／18199，僅 `127.0.0.1`。既有隔離 DB `18306/tag_f1_semantic_test`，不碰正式 DB。
- capture parent `3419560`；實際單一 Chromium root `3420285`，nice 19／idle I/O。
- paired 退出 1；candidate 退出 0；capture 退出 1。paired-failed 記錄兩 child ownershipVerified／cleanupConfirmed 均 true。這是程序收尾證據，不是 capture 成功。

## 時序與停止

candidate parent started receipt 記錄 UTC `00:14:38.019`；worker guard started `00:14:51.519`。capture parent started `00:15:00.621`；Chromium ownership snapshot `00:15:15.856`。

HAR 記錄 `00:15:16.227` 的 `GET /auth/me` 與 `00:15:16.232` 的 `GET /api/v1/reader-presence` 回 503。capture 遇到 5xx 即失敗；沒有跳過錯誤或把缺資料當成功。

candidate 原始 events 記錄 `00:15:18.611` 開始收尾；`00:15:18.612` 對三個自有 child 發 TERM；frontdoor `00:15:18.618`、Next `00:15:18.629`、API `00:15:18.646` 全退出，`00:15:18.661` cleanup-done/allExited=true。Next code143 是 TERM 後退出。guard finished `00:15:26.621` 為 code0。capture ended `00:15:30.409` 為 code1；candidate parent ended `00:15:39.294` 為 code0；paired-failed `00:15:39.329`。

上述是原始程序事件的時間；沒有記錄每一個 listener 首次 bind 的系統呼叫，不把 group 存活時間冒充精確 listener uptime。

worker stopped 與 owner-session-ended 都做了完整產物後驗證：before／workerAfter／ownerAfter inventory、manifest、BUILD_ID 一致。另在 `00:17:00.438578Z` 保存當下 kernel snapshot：9 個觀測到的自有 PID 不在、18197–18199 已關、legacy18196 inode `215996810` 保留；owner 解析的 lock holder rows 為 0。此 snapshot 不是停止當下的重建；lock 只存解析結果，不能宣稱 reviewer 從完整 raw `/proc/locks` 重算。

## 網路與隱私證據的界線

manifest 為 `partial`，shots=[]。HAR 有 116 entries；request raw 有 116 request／66 response。116 個 HAR request 都帶 DNT:1；profile 設定 enable_do_not_track=true。失敗在首張截圖的 state 保存之前，**沒有 navigator DNT/GPC/webdriver 的實測 state，不猜 GPC 值**。

HAR 與 request raw 可見 Google 請求為 0；proxy reported googleOutgoing=0。但 proxy 的 denied 只有 method，不能分類被擋的 hostname；raw admitted=68，manifest stats admitted=69。manifest 本身記錄 `Actual HAR/proxy evidence missing` 與 `Proxy counters disagree with raw`。因此只能報可見紀錄為 0、統計回報外送 0，**不能算完整零 Google 外送驗收，也不能算 GA 收件證據**。

`/auth/me` 匿名 GET 與 reader-presence GET 的 handler 在 immutable APP 裡不會查 SQL；兩個 503 與 API 全域 sqlFailed 擋住後續請求相容。但 wrapper 也有其他 503 分支，HAR 沒保留 response body，舊 API 也沒有去識別的 SQL failure event，**無法唯一判定是哪個分支，更無法判斷先前是哪個查詢失敗、schema 缺漏或 SELECT guard 拒絕**。不能推測為特定 side effect，不能放寬 SELECT-only 或忽略 5xx。下一批先補 bounded 私有診斷與代理紀錄，再經測試、既有非作者 review、fresh probe／新命令核對；不盲目重試。

## 私有原始證據

- `/home/deck/tag-analysis-private/f1-release/paired-sm-batch-004/`：paired/candidate/capture started、ended、failed、derived input、stdout/stderr、current kernel。
- `/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/local-candidate-sm-batch-004/`：started/stopped、owner-session-ended、完整 inventory、guard raw、程序事件。
- `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-004/`：partial manifest、原始 HAR、分開的 redacted HAR、request/proxy raw、browser ownership/profile/watchdog。
- `network.har` 與 `network.redacted.har` SHA：`10059c7116ea9566a7fceb687579afe34cbe3e065f6fec94375987ebb8e59ba7`。
- `requests.raw.jsonl` SHA：`6b33a038f6f041e8c2c02499e889b91601ac2251378cdd6ecd846187a55ede9f`。
- `proxy.raw.jsonl` SHA：`8402db0553c1cacadd6462f06099ef07ad1a32ffe8399b3617dea2aa022fe2c6`。
- `owner-poststop-kernel-current-20261014.json` SHA：`8dac408b79a7b84129a527f634961c1f911d4f7cadb7c2f6659e73125a6b378a`。
- 既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol 實際離線核對：`/home/deck/tag-analysis-private/f1-release/sm-paired-004-independent-20261014.json`（SHA `0f2e77c75b2de755e43d486c294ef9609815be3e315ee21471c0d1eb02fe8c5b`），transcript 同名 `.txt`（SHA `5632c655825b670ef2d99c9be0e1395db6ac1d9e48567d646feda82e83c0fcff`）。111 個 top-level original hash 與 input／network chains 核對；沒有新 live probe／完整 runtime 重算，不是 UI、B0 或根因 PASS。

APP677 仍為 **65 個主 route／0 完整 UI pass／65 pending**；本批 0 張截圖，不能交實圖 UI review。privacy/no-store 的真 B0/SSR/RSC 技術檢查仍未完成；正式版沒有切換，F1 尚未部署。
