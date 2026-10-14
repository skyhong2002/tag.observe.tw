# SM010 新 d1LV candidate 與部分截圖

APP `aff5c0289c4863fedb37368b4942884ccc068d77`／BUILD `d1LVsC3sk6p04uOyWUx5T`，control OPS `f40662ff67abf9400d6a6c76adad2c9cbc1aaeba` 已推送，remote base `a89908a650c42a1224d657e6c908d5fd3c7be5a0`。沿用同一份產物，不重建，未部署。

依 babysit 對 startup fresh 一次小修的預先放行，80/80 獨立 source/mock 測試後執行010。packet `/tmp/babysit/mint-queue/tag-sm-paired-010-admission-20261014T060304Z/packet.json` SHA256 `4543815bd7a3fd86f0a0f974c946dcb4abfacbce8a0e054f9e7eef0518aef488`，exact pair input `e836746d8b41aeaed6c4404f206f83399399c31621b97932ac72908cc2173c86`。初始九筆皆200/curl0，中位數 tag1.176146／blog3.018303／YT1.105412秒、MemAvailable2.606GiB、52.315GiB磁碟、load3.58；SM／skyhong-blog無其他build/browser。

隔離API PID4025264／18197、Next4025388／18198、frontdoor4025456／18199實際就緒，只綁127.0.0.1，API只讀fixture18306／tag_f1_semantic_test。candidate-started成功原件SHA256 `15ff23481ddcc59a12ccec712255bf14063e011ed6f31d5c8f177f958e91c705`。capture真正啟動Chromium，但只有三张首頁圖，沒有新tag／picture／ranking頁圖。

| 原件（私有根目錄 `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-010`） | Viewport／theme | UTC | SHA256 |
|---|---|---|---|
| `shot-01.png` | 1280×800／light | 2026-10-14T06:05:06.118Z | `732cafffd5782bc39eb46ec962a3e2523b0ad550ed66361060e4880879c24efb` |
| `shot-02.png` | 1280×800／dark | 2026-10-14T06:05:08.147Z | `41438d211f778fecac67456e6dabb7a16c9f2483b657e963c554bf6ec1acb3bf` |
| `shot-03.png` | 390×844／light | 2026-10-14T06:05:19.696Z | `8d32b225d90df4fa79cfc6d1cf40f9ff62a03478053df2d6d76ff2d26fd78da8` |

## 工具阻擋與範圍界線

capture bytesIn在瀏覽器仍運行時掃描profile，lstat `profile/Default/Code Cache/js/93f60f21dc560390_0` 得ENOENT。manifest是partial、capture退出1、pair退出1，不能列成16圖完成；不是SQL或native loader錯誤。依babysit最新指示，再次工具本身擋住就回報共同選最簡單繞法，不自行再加guard／monitor／連續修wrapper。具體建議已寫 `/tmp/babysit/mint-queue/tag.md`：固定證據容量即時計算，mutable profile等Chrome關閉後核對，尚未實作／執行。

manifest SHA256 `b088905f41a1018b2be28277a2260beb71660aff45fbcb65054b250229a5c255`；HAR `e44135a8c4d65727faf84a772bd39820c4e609e81cf7f710b9bacc0768faa5f0`、requests raw `79f93808991119dd976d96ef5facc329e3c103434617828fcdab6311a1e431cf`、proxy raw `b5c3f2a9dcb7d6fe4add4156a96efbf1a71e4ae66d679434e175824c3a9ee019`。HAR／request可見Google0、proxyGoogleOutgoing0（admitted312／denied27）；DNT1、GPC屬性不存在null、webdrivertrue、dataLayer commands0。獨立核對HAR369 entries（281×200、19×307、69×-1），369項DNT1；proxy312admitted／309responses／27deniedother／2failed／1quiesced與closedStats一致，觀測Google0各鏈吻合。但event-drain失敗及CodeCacheENOENT使capture與網路證據不完整，不當完整零外送證書／正常GA收件／B0或全部隱私驗收。

首頁只恢復／empty狀態；390dark缺圖，主要新功能頁全未重拍。既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol 已實際逐張 view_image 全三張 target＋四張既有首頁參考；三個恢復狀態無明顯overflow，但不是normal loaded驗收、沒有mobileDark／三個其他route。JSON `/home/deck/tag-analysis-private/f1-release/sm-paired-010-partial-ui-independent-20261014.json` SHA256 `31b41a63b248567c66d6c7cb13a10315f12e73753ec6b9cb61496995d0fcdab3`，同名txt transcript `bd06e2b9eee77793316087c0cdfb620d5aa9196053082599b65a90ffca35be9f`。65主routes仍0完整pass／65完整scope pending。

## 收尾

服務cleanup-start UTC06:05:22.717；Next06:05:22.770 exit143、frontdoor06:05:22.776 exit0、API06:05:22.910 exit0，06:05:22.921 allExited。pair失敗原件當時candidate exit null／cleanupConfirmed=false，不能倒填；後驗證06:07:11七個自有PID皆消失。

完整owner raw kernel `/home/deck/tag-analysis-private/f1-release/paired-sm-batch-010/owner-poststop-kernel.raw.json` UTC06:07:41.441，SHA256 `ed7c2c4f6ffb6e26c6934129cdb7d3555b0ea8843c50115113cc733637fe816d`，包含全nettcp／nettcp6／locks及7ownPID缺席，browser/build root0；當時load6.36、MemAvailable3.341GiB。收尾較早曾load12.21超閘門，沒有啟新build/capture，不拿它當初始ENOENT的根因。06:07:46.814全inventory仍 `103b9e671f66c6fe8af530db40fb9e0e9f5b8a38c0822af30404b398e26ac9fc`，manifest仍f50，原件 `owner-poststop-inventory-summary.json`。

全部產物、失敗job、PNG／HAR／profile、正式release、回滾版本、備份與worktree保留。native實際PASS仍成立；未部署F1，沒有Cloudflare／WAF／正式DB／backup timer操作。
