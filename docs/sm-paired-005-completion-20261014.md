# SM005：SQL 分類、capture 失敗與正常收尾

執行 OPS `f13151bc22aecd2c71aa88ef3e03734af12a8ae6` 已推送、開跑前工作區乾淨；使用 fetch 過的 remote default ancestor `a89908a650c42a1224d657e6c908d5fd3c7be5a0` 所屬分支，不碰共享主 checkout。babysit UTC2026-10-14 00:29核准後，依同一份產物實際執行；**candidate exit0、capture exit1、paired exit1、0張PNG，未部署**。

APP `677a0c793eeda0c4d850c81ac574c95508d08e0a`／BUILD_ID `PmjYScQDDoJKBr43SLkhd`／inventory `f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`／manifest `76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0` 均未改動或重建。

## SQL：已知分類與尚未確診的部分

API 私有原檔 `api-readonly-failures.jsonl` 在 `00:29:59.794Z` 記錄兩筆 `operation=query / phase=driver / driverCode=unknown`。這兩筆可能是同一錯誤經兩層 wrapper 記錄，不能當作兩個獨立 SQL statement。沒有觀察到 admission／forbidden-operation 分類；後續 `api-unavailable.jsonl` 的28筆明確是 `cause=sql-latched`。

因此本批確認原本不明的503有 SQL latch 分支；**driver code 未知，不能判定 schema 缺漏、權限拒絕或其他 client/driver 錯誤**，也不能報出未記錄的 statement/table。HAR content omit，且本批只收到7個200、其餘107項status=-1；HAR沒有503，503分支證據來自 API 原始診斷，不混成 browser 已收到503。

下一步只做 installed driver source/mock 查因或 bounded enum 診斷；不擴大 pool/queue、不放寬 SELECT-only、不寫 fixture/正式 DB、不猜測實際 cause。若 source/mock 能重現某個錯誤，仍須區分它和本批原始已證事實。

## capture 與網路

`native-before-goto.jsonl` UTC `00:29:59.660Z`：首頁1280×800/light、`navigator.doNotTrack="1"`、`webdriver=true`、GPC `present=false/value=null`。沒有關閉或繞過 guard，沒有假造 GPC。

首次 evidence-write failure 明確是 `ENOENT`；partial manifest 原始錯誤指出 `profile/Default/Cache/Cache_Data/todelete_*` 在容量掃描的 `stat` 時已消失。這是**005 的實際競態證據**，不能倒填成004已確診的原因。proxy audit 也保存 admitted event 的 ENOENT；失敗後停止，沒有繼續截圖或忽略5xx。

獨立核對 HAR114 entries（全部DNT1）、request raw115 request／7 response／34 failed、proxy raw10 admitted／9 denied；9個deny全部分類other、Google分類0。proxy raw、closedStats與manifest stats相同，reported googleOutgoing=0，可見Google請求0。**因proxy audit本身失敗，完整紀錄不完整，仍不能列完整零外送驗收**；這不是GA收件或自然流量證據。

## 停止證據

candidate parent `3445958` started `00:29:26.005Z`；guard worker `3446313` started `00:29:38.715Z`；API `3446481`／18197、Next `3446627`／18198、frontdoor `3446712`／18199，只綁127.0.0.1，DB是既有18306/tag_f1_semantic_test。capture parent `3446860` started `00:29:47.142Z`，Chromium root `3447369`。

原始事件 `00:30:02.702Z` cleanup-start，三服務TERM；frontdoor `00:30:02.710Z`、Next `00:30:02.721Z`（TERM後143）、API `00:30:02.740Z` 全退出；`00:30:02.754Z` allExited=true，guard `00:30:12.926Z` exit0。capture ended `00:30:14.802Z` exit1、candidate parent ended `00:30:28.828Z` exit0、paired-failed `00:30:28.896Z`。這是程序事件，沒有 listener bind syscall，不把 group 時間當精確listener uptime。

worker／owner完整before/after inventory與manifest一致。另在 `00:32:41.687074Z` 保存當下kernel raw TCP與完整 `/proc/locks`，確認18197–99無listener、鎖inode無holder、legacy18196 inode215996810保留；owner觀測9自有PID不在、此profile browser0。不是停止當下的重建，也不是 reviewer 本人重新 live probe。

## 私有原始資料與獨立核對

- `/home/deck/tag-analysis-private/f1-release/paired-sm-batch-005/`：input衍生、stage started/ended/failed、stdout/stderr、currentkernel。
- `/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/local-candidate-sm-batch-005/`：API SQL/503 enum診斷、guard/probe raw、started/stopped／完整inventory／owner-session-ended。
- `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-005/`：partial manifest、HAR/raw、native-before-goto、first-evidence-write-failure、proxy-failure／closed、watchdog。
- HAR SHA `a7ef16f268104054726ead5eb36fa75abbaa5454b16a0cbd9f0ef04bb7ccdcc3`；request raw `c3b0205ea196eec49f392440a5bcab1c63fabc65c7e7cacc18113ea3a334b6a1`；proxy raw `009cec9b9d2318f1a45e0c6e18de5bdc436bcb65dde326f0432f440e9dcb4048`。
- native-before-goto SHA `dbd7667a597971b8dd4c95661a88e1e681f33dcaf29f741588f5a86ddd01e5c3`；currentkernel SHA `d172604933ac62f2e95883cf7a33114aaaa777d436e407354b7ff56bd9733aee`。
- 既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol 的 actual005 離線核對：`/home/deck/tag-analysis-private/f1-release/sm-paired-005-independent-20261014.json` SHA `b71338d7884bc6ed5a03a1da6ed92e65be5caea5c4c467eaa170c26f1978fbb7`；同名txt transcript SHA `cec8989879e532aa24e77076f6fc7bccfdc451af7d7303b3753928e81a283ecc`。117個原始top-level證據hash/input/sourceGitblob/network診斷chain verified；讀原始kernel重算TCP/lock，未新開browser、probe或重算整棵runtime。

APP677 仍65主routes／0完整UIpass／65pending，005為n/a-ui失敗執行證據；沒有完整B0/SSR/RSC或UI PASS。所有004／005／Mint／runtime／release／rollback／備份保留，未部署。
