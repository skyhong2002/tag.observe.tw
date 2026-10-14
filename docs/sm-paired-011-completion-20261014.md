# SM011 啟動後停止，未開 Chromium

APP `aff5c0289c4863fedb37368b4942884ccc068d77`／BUILD `d1LVsC3sk6p04uOyWUx5T`，control OPS `9b780a4a` 已推送；remote base `a89908a650c42a1224d657e6c908d5fd3c7be5a0`。未重建、未部署。

依 babysit 的011 profile排除最小修正預放行，81/81獨立pure tests與2syntax後執行。packet `/tmp/babysit/mint-queue/tag-sm-paired-011-admission-20261014T061721Z/packet.json` SHA256 `7b4e84787209325146d97bc6fdd300514c5ffda04deee1df811bce250eda70ed`，pair input `226b1242863fe41796d29f0dcb14859ac0103adcde478fe002d3e7a16e2a5e48`。初始九筆200/curl0，中位數tag0.353651／blog2.762735／YT0.235251秒，MemAvailable3.283GiB、52.182GiB磁碟、load3.74，全站無其他build/browser。

隔離API4051991／18197、Next4052246／18198、frontdoor4052273／18199只綁loopback，真candidate-started就緒；DB只讀fixture18306。candidate先UTC06:18:39.249cleanup；frontdoor39.255 exit0、Next39.260 exit143、API39.292 exit0，39.301 allExited。watchdog06:18:49.256才報failed，capture的requireCandidate所需worker4051425已退出；不能把secondary watchdog失敗當成唯一首因。

原 generic worker failure不唯一定位。原health generations時序支持30秒快取／producer刷新競態：generation2 starts06:18:08.730／finishes06:18:16.561，cleanup時已30519ms；generation3 starts06:18:26.835、finishes06:18:41.052，cleanup時尚pending，不能拿完成後gen3回填worker已取得fresh。各generation HTTP200/curl0，原資源sample未超human閘門。只有phase後時序線索，沒有重新執行錯誤情境或偽造receipt。

0Chromium／0PNG／無HAR／proxy；沒有Google transport驗收。profile只執行after-stop總量du，status0／12288bytes；before-launch未走到，所以本次不能證明兩個Chrome cache flags實際生效。capture manifest partial，SHA256 `13570556e37651115226f5ddba2841744e696303039d96946d0f0524c899b77a`；candidate/capture/pair皆failed，不是新16圖UI或B0通過。

依「工具再擋就回報共同選最簡單繞法」，沒有自行再修wrapper或重試。具體時序與建議已寫 `/tmp/babysit/mint-queue/tag.md`：評估既有candidate cache freshness窗能涵蓋median producer刷新（例如60秒，不改開跑fresh probe／HTTP錯誤／humanresource門檻），或直接既有API／Next＋單純Playwright；沒有套用任何新方案。

UTC06:20:25核對七ownPID均無。後驗證 raw kernel `/home/deck/tag-analysis-private/f1-release/paired-sm-batch-011/owner-poststop-kernel.raw.json` SHA256 `528a4b0fa62f57a97d2927c3969ef610974f6ac275a80c12b3fee5c591aef422`，保存全netTCP／TCP6／locks與ownPID結果；06:22:18.017全inventory仍 `103b9e671f66c6fe8af530db40fb9e0e9f5b8a38c0822af30404b398e26ac9fc`，manifest f50不變，原件同job `owner-poststop-inventory-summary.json`。所有失敗原件／runtime／profile／release／回滾版本／備份／worktree保留，未碰正式DB／Cloudflare／WAF／backup timer。65主route0完整pass／65完整scope pending。

既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol離線核對原件：JSON `/home/deck/tag-analysis-private/f1-release/sm-paired-011-failure-independent-20261014.json` SHA256 `90ce674f55b0ef57f472bf7c387b23cbc0406ecd53274c2c48a167a93d1a42b4`；同名txt transcript `4eccf4ebc3f8273dbc87afeda1993c6d5eaa5ec82301e71213248c5831426734`。核 saved raw kernel／時序／0圖／after-stop du，沒有由reviewer重跑loader／inventory／browser，也沒有把owner canonicalhash冒稱reviewer重算。
