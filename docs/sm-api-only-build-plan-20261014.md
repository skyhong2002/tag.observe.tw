# SM：只啟動隔離 API 的 web 建置方案

本批為 source／mock，**未啟動 API、candidate、建置、瀏覽器或部署，未取得新的執行許可**。上一輪失敗與名額交回見 [實際完成紀錄](sm-web-build-001-completion-20261014.md)；原始部分產物、001 目錄及全部證據保留。

首頁為 force-static，server loader 在 prerender 向 `TAG_API_ORIGIN` 取資料，因此採只起隔離 API 的方案，不採完全無 API 建置。舊 Next、frontdoor 不在建置期間啟動；建完後再以新產物另提 candidate／capture。減少服務數不保證可用記憶體足夠，也不降低門檻。

## 來源、許可與唯一 owner

新 web APP 固定 `aff5c0289c4863fedb37368b4942884ccc068d77`；載入的 fixture API 仍是 `677a0c793eeda0c4d850c81ac574c95508d08e0a`。兩者 app tree 都是 `3d1ab27c59169660eb9a2f470372ce3d8b6c0fbd`，四份 root／web package 與 lockfile 相等。新控制 OPS 由本批 source review 通過後提交決定，不能把舊 a2ee 許可套用到新執行。

只有 `tools/sm-f1-api-only.mjs` parent／worker 可以供應新的 sole-API receipt。僅綁定自己的 loopback 18197，連既有隔離 DB 18306／tag_f1_semantic_test；沿用 SELECT-only、匿名 actor、既有 fixture IDs 701–703、queue disabled、無正式 DB fallback。沒有新帳號、權限、seed、migration、worker 或模型推論。legacy18196、其他 listener 與正式 DB13306 都不動。

API parent 以原有非阻塞 acquire helper 持有真正 WRITE FLOCK；build 只核對同一個已核准 owner，不另搶鎖、借用 YT holder、延長期限或替 API 解鎖。新 API-input、started receipt 與 build proposal 的 schema／namespace 均與三服务 candidate 分開；模板 permission=false、future PID／ticks／hash=null。

build-input 只從真正 started receipt／owner-launch／kernel dev+inode 推導。核對 input bytes、authorization reference、API/new-web app tree mapping、source blobs、PID／ticks／UID／argv／socket／parent 和原始 expiry；拒絕舊三服務 receipt、其他 APP 的相似 API、重用 PID、逾期 lease 或不相符鎖。

## 未放寬的資源保護

開始時 MemAvailable 至少 3 GiB；執行中至少 1.5 GiB；自己的 build group RSS 不超過 2 GiB。仍用 nice 19／ionice idle、Next cpus≤2／static generation1／RAYON2，全站一個 build、兩個 browser。磁碟 40 GiB 才開始、低於30 GiB暫停，且開始前扣掉預估新增空間不能低於30 GiB。

首頁每站三筆 time_total 取中位數：tag2.0／blog6.17／YT2.0秒；任何一筆非200或curl非0均拒絕。baseline UTC2026-10-13T05:47 的 time_total 含來源回應、Cloudflare edge與網路，不是精確 origin render time。load上限12，恢復時仍沿用load<10及磁碟≥40 GiB的 hysteresis。

每輪資源與原始首頁 trials 在判定前保存，含 MemAvailable、disk、load、build／browser counts、group RSS 及固定理由 enum。能重算的是**觀測到的最大值**，不是兩個 sample 間的絕對峰值。私有 evidence sink 失敗或超量就停止，不繼續產生無紀錄的結果。

parent 決定唯一 API worker 的 STOP／CONT；暫時的 resource pause 不由 worker 直接變成 cleanup。build 核對 paused lease 與真實 process state，API 暫停時不打 readiness，自己也暫停；恢复需 fresh run lease。來源／PID／鎖／readiness 失效仍終止自己的 build group。原15分鐘上限、API提前120秒收尾及build至少再提前60秒到期都不延長。

## 失敗收尾與審查

v2 獨審找到既有 fixture close 的單串 await：一個 close／drain 出錯可能跳過 DB close，startup cleanup 也可能蓋掉 primary。v2 ISSUES JSON／transcript 保留於 `/home/deck/tag-analysis-private/f1-release/sm-api-only-build-independent-v2-issues-20261014.{json,txt}`，不是 PASS。

v3 的 `closeFixtureOwned` 嘗試 scheduler abort、server connections、server close、app close、scheduler drain、DB close 全部六個步驟；錯誤 aggregate 保留原始 cause 與固定 phase。初始化的診斷檔／guard／scheduler 設定也放進有 cleanup 的 try；API late-startup 在收到停止後仍會關閉取得的 API。外層 log close 出錯不阻止 lock release。這不證明底層永久卡住時 graceful close 已完成，實際執行仍須依原 guard 的有界停止與 kernel 後驗證核對。

v3 freeze：`/home/deck/tag-analysis-private/f1-release/sm-api-only-build-source-v3-20261014/freeze.json`，SHA-256 `d272a5f8afc2da620ee7917c30790079d0963a6be1eae79b8b35742afe1402ef`。作者54 targeted mocks；root含歷史 plan 回歸57／57通過。既有非作者 GPT-6.1 Sol 已本人核對七檔 hash、57／57 mocks 與四項語法檢查，v3 source PASS；JSON `/home/deck/tag-analysis-private/f1-release/sm-api-only-build-independent-v3-20261014.json` SHA-256 `91c8130822169124da542c8298e9734d9430ca19cc1b02a965b433079de16bf1`，同名 `.txt` transcript SHA-256 `d811ade734fd73172741937fafdbf5afd27a05b10661e6bc44754ab2e0898d03`。source pass不能代替 actual API、建置、B0／SSR／RSC、native 或 UI 驗收。

## 下一步命令與產物

完整模板與固定 env 見 [執行 recipe](../tools/sm-f1-build-README.md)。先提交並推送乾淨 OPS，再產生兩份 exact input／hash、fresh SM probe、實際估算空間並交 babysit 核對全站名額；未核准不取鎖或啟 API。

第一命令只啟 API-only；真 `api-started.json` 存在且核對後才执行 build proposal。新 `build-aa-aff5c028-002` exclusive 目錄不覆寫001。只 archive exact APP、獨立複製原依賴並比對原 bytes／modes／relative links、Next build新web，不 npm install、不改原 runtime。

成功也只輸出新的 BUILD_ID／inventory 與 prepared-native-pending receipt，`deployEligible:false`；新 bytes 的 native smoke、privacy/no-store／B0／SSR／RSC、主要頁面的雙寬淺深實圖與非作者 review 仍要完成。ledger仍65主route／0完整pass／65完整範圍pending；F1未部署。
