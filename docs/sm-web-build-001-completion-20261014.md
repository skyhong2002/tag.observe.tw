# SM web build 001：實際失敗與保留證據

本紀錄只適用控制 OPS `a2ee1e1266cb423d6f6423308aec7ca5074c478a`、新 web APP `aff5c0289c4863fedb37368b4942884ccc068d77`。隔離 API／舊 candidate 實際載入 APP `677a0c793eeda0c4d850c81ac574c95508d08e0a`，原 BUILD_ID `PmjYScQDDoJKBr43SLkhd`。這一輪沒有完成新建置、截圖或部署，不能把來源測試或舊產物的驗收算到新 web。

## 核准與原始資料

babysit 在 UTC 2026-10-14T02:33 明確核准 candidate＋SM web 建置及全站唯一建置名額。提案與實際輸入均保留於 `/tmp/babysit/mint-queue/tag-sm-build-admission-20261014T022822Z/`：

| 檔案 | SHA-256 |
| --- | --- |
| `packet.json` | `85a8e426a0d928dec3f74adba8e2dfa5fff79fde81b2185a50eb7808e2d99db1` |
| `candidate-input.requested.json`／`candidate-input.json` | `d8d07fbd6b62fb2671a7e456d05981da3bdb65b65cc6be9eac08ead61fb6ea74` |
| `build-proposal.requested.json`／`build-proposal.json` | `728190901a3425f843933dc7fb209671231540a41ee40c5495c05f1698334527` |
| `probe.json` | `868790668a363cd9e6f3263217cda492673715c867efdf2f11a447587e46e8e1` |

原始提案中的 permission=false 是提交當時的狀態，不改寫成事後核准。實際執行由外部明確放行；active 輸入以 exclusive 0600 寫入，bytes 與 requested 相同。動態 build-input 只在真實 candidate-started receipt 存在後產生，不預填 PID 或 receipt hash。

candidate 原始目錄：`/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/local-candidate-sm-batch-008/`。新建置的部分資料：`/home/deck/tag-analysis-private/f1-release/build-aa-aff5c028-001/`。兩者及全部失敗資料保留，沒有刪除或覆寫。

## 實際時序與原因界線

| UTC 2026-10-14 | 原始證據所支持的事件 |
| --- | --- |
| 02:28:22.506–02:28:32.074 | 開跑提案 probe：九筆 HTTP 200／curl 0；tag／blog／YT time_total 中位數 0.090063／2.459668／0.073063 秒。 |
| 建置初段 | 多次資源閘門 pause；owner 曾觀測 MemAvailable 約 2.36 GiB，低於開始門檻 3 GiB。這次觀測沒有獨立 UTC receipt，不能当作精確峰值或最後退出原因。 |
| 02:36:44.528 | build receipt 103：真正 stage group `3665574` 開始，nice 19／idle IO。archive、extract 已經進行，dependency copy／比對階段有部分資料。 |
| 02:37:18.447 | candidate 開始 cleanup；02:37:18.465 向三個自有 child 發 SIGTERM。 |
| 02:37:19.543 | 舊 candidate Next child 退出。 |
| 02:37:19.612 | builder 記錄 fatal-binding-or-readiness-error，隨後 STOP／CONT／TERM 自己的 stage group。 |
| 02:37:19.639–02:37:19.640 | builder finished／failed-retained；沒有新 BUILD_ID 或新 inventory。 |
| 02:37:19.753–02:37:19.790 | API、frontdoor 退出，candidate cleanup 記錄 allExited=true。 |
| 02:44:01.437 | owner 完整停止後核對：所有自有 PID／stage group 成員已無、18197–18199 已關、舊 runtime 完整 inventory／manifest 未變。 |

candidate 原始失敗紀錄只有 startup-or-cleanup-failed，不能唯一判定 OOM、閘門或其他最後原因。builder 的直接失敗是其綁定 candidate／API 已不可用；這並不證明 Next compile 錯誤。原本的 stage stdout/stderr 為 0 bytes，不能拿來推論完全沒有執行；真正的 stage／checkpoint 原始紀錄支持已執行部分 archive／copy 工作，但不支持 dependency copy 完成或 Next compile 開始。

原 builder 沒有把每輪 MemAvailable／group RSS 保存到輸出的 probe receipt，**整個 stage 的記憶體峰值未記錄**。不能用 controller 的單次 RSS／VmHWM 代替整組程序的峰值，也不能填成零。新的方案必須補足原始資源 telemetry，在判定與停止前先保存。

owner 在考慮手動中止後查到 builder 已退出，沒有送出手動 SIGTERM。兩個命令均已自行收尾；既有服務、正式資料庫、legacy listener 沒有被停止。

## 停止與不可轉移的驗收

owner proof：`/home/deck/tag-analysis-private/f1-release/build-aa-aff5c028-001/logs/owner-poststop.json`，SHA-256 `7cd58bdb5bdc9d40cc2e302e8522f5d85fde6d18c498eed65f71278b8b201817`。包含 owner 的 PID／group 掃描結果、原始 TCP／locks，以及 owner 完整 runtime 重算結果。legacy 18196 的原 inode `215996810` 保留；本輪自有鎖 holder 已不存在。

原 inventory：`f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`；原 manifest：`76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`，與執行前一致。這只驗證原產物不變，沒有新產物的 native／privacy／UI pass。

既有非作者 GPT-6.1 Sol 已離線核對 424 份原始檔 hash、16 個工具檔案與 exact a2ee Git blobs，以及 108 份內嵌 raw SHA；本人重新解析保存的 TCP／locks。JSON：`/home/deck/tag-analysis-private/f1-release/sm-a2ee-build-failure-independent-20261014.json`，SHA-256 `9835b2ef89f4724d18cc6182f0d611d75d27f62c6ad7d6d59a3beb39c8a18368`；同名 `.txt` transcript SHA-256 `8abe2d15d4e7367516a1c59e51b5898567a851990038d85ac0d85ca6bf07b6f2`。這是原始執行與收尾的離線審查，reviewer 沒有重新啟動服務、live probe、全 runtime tree 重算或建置，不能據此填記新 UI／B0／native pass。

本輪没有瀏覽器、PNG、HAR 或新的 GA 驗收。65 個主 route 仍為 0 完整 pass／65 完整範圍 pending；APP677 的深色問題仍須在新 APPaff5 的新產物上重拍。未部署；全站建置名額已交回 babysit，可安排 YT。

下一步採分開啟動的 API-only build scope：只起隔離 API 18197 供 prerender，不起舊 Next／frontdoor；保留 3 GiB 開始、1.5 GiB 執行中及 2 GiB group RSS 門檻。先完成 source/mock 與非作者 review，新的 exact OPS／命令／fresh probe 另交 babysit，不把本次核准沿用到新 scope。
