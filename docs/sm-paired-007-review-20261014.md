# SM007：實際截圖、獨立 review 與停止證據

執行 OPS `9171ffffc76e7a5296da3060017c2cbddc4fd703` 已推送，remote default ancestor `a89908a650c42a1224d657e6c908d5fd3c7be5a0`。APP `677a0c793eeda0c4d850c81ac574c95508d08e0a`／BUILD_ID `PmjYScQDDoJKBr43SLkhd`。沒有重建或部署。

## 結果與限制

babysit UTC 2026-10-14 01:13 核准後在期限內執行：candidate exit0、capture exit1、paired exit1；四個匿名 route、1280×800／390×844、淺色／深色各一張，共16張實圖。載入期間沒有 queue-limit 或 HTTP5xx；API 唯一 scheduler-stopped 紀錄發生在正常清理。

最後一張 01:14:07.633Z；first-evidence-write-failure 01:14:07.772Z（ENOENT）。proxy failure 為 denied audit ENOENT，原始007診斷未記錄具體操作或路徑，不能斷言是 Singleton/cache 檔。manifest status=partial、error=Proxy audit failed。proxy855 admitted／99 denied 與已保存raw／closedStats一致；HAR852 entries（772×200、72×307、8×-1）。可見紀錄 Google attempt／outgoing=0，但 audit 失敗使完整零外送證據不成立，不能標完整 transport pass。

每張導航前 DNT=1、webdriver=true；原生 GPC 欄位不存在，value=null，不假稱 GPC=true/false。dataLayer commands=0。不是正常 GA 收件證據。

既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol 實際逐張 view_image original：16 target＋8歷史淺色參考。review UTC `2026-10-14T01:24:59.315735+00:00`；歷史48083b5參考只有當前檔案hash，原receipt未綁PNGhash，且沒有深色參考，不能當本次target或暗色基準。

正向F1標籤畫面有醫師／政治人物、職業身分／公共身分上層、相關台北市、別名柯P；不能把此批全部說成empty。首頁／ranking缺snapshot只涵蓋恢復狀態；圖片頁只涵蓋匿名登入提示，投稿登入／admin流程未驗。

**阻擋問題：** 深色 `/tag/柯文哲/` 的共同關鍵字空狀態與報導空狀態文字，shot08原像素對比約3.67:1／2.56:1，低於一般文字AA4.5:1。元件缺dark文字override。修正須提交產品原始碼、建置新APP artifact，不能修改已驗hash的原runtime或把舊BUILD當成修正驗收。

完整65主route仍0完整pass／65pending；002另標APP677視覺issues。四頁部分scope實看不代表完整UI pass、B0／SSR／RSC privacy barrier或部署許可。

## 實際16張圖

目錄 `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/`；每列是既有原檔，未新增capture。

| Route | Viewport／theme | UTC | PNG | SHA256 |
|---|---|---|---|---|
| `/` | 1280×800／light | 2026-10-14T01:13:38.725Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-01.png` | `aac585962efb32efb75523dfeb149724358f7d42271457dd2870a91ca3d0e78d` |
| `/` | 1280×800／dark | 2026-10-14T01:13:40.601Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-02.png` | `41438d211f778fecac67456e6dabb7a16c9f2483b657e963c554bf6ec1acb3bf` |
| `/` | 390×844／light | 2026-10-14T01:13:42.219Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-03.png` | `8d32b225d90df4fa79cfc6d1cf40f9ff62a03478053df2d6d76ff2d26fd78da8` |
| `/` | 390×844／dark | 2026-10-14T01:13:43.966Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-04.png` | `20bd79483e0ff55bf0846e36a849418acb293219497d84221611324db0a3f498` |
| `/tag/柯文哲/` | 1280×800／light | 2026-10-14T01:13:51.161Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-05.png` | `6d8883de27b347738acf6692b3e003e295a0786f83e2719dc28225e760b7bc9b` |
| `/tag/柯文哲/` | 1280×800／dark | 2026-10-14T01:13:52.325Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-06.png` | `98770c6b6351602296785ebd40d9376e7a3562bd68db06a8dd941fb2eb92a277` |
| `/tag/柯文哲/` | 390×844／light | 2026-10-14T01:13:53.349Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-07.png` | `f74aa043413c2a2be08931abad81c50b984f73306b03a4ca97206c7afe0ee7ec` |
| `/tag/柯文哲/` | 390×844／dark | 2026-10-14T01:13:54.414Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-08.png` | `eba2ddfb96b883e79814d99a2903f2e53267ecae0dde2d3147dc5f1e99e2a3f3` |
| `/tag/柯文哲/picture/` | 1280×800／light | 2026-10-14T01:13:55.048Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-09.png` | `aa82457a1abf3f214224896167c1ec800b8c40756c16064f461bd8ecb56df728` |
| `/tag/柯文哲/picture/` | 1280×800／dark | 2026-10-14T01:13:55.728Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-10.png` | `ae33543fd644e4d82ee6fb7966c21921c191cb8851850ebc3a6fc7d7e8a855eb` |
| `/tag/柯文哲/picture/` | 390×844／light | 2026-10-14T01:13:56.426Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-11.png` | `731c437f14a4e18d4a4b9cb6e8710d33c2d906cfb53b022cd03a8d3b5ff7a4db` |
| `/tag/柯文哲/picture/` | 390×844／dark | 2026-10-14T01:13:57.082Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-12.png` | `c1a55137b887a9031b4a626b4918028a19fb05d2c91a04a2d1edefa21d7b116f` |
| `/ranking/` | 1280×800／light | 2026-10-14T01:13:57.910Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-13.png` | `5e335ce5b43add2b7244c5d8a9ded966ef36dc38c0d243d77cd9333748955922` |
| `/ranking/` | 1280×800／dark | 2026-10-14T01:13:58.634Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-14.png` | `6b4364b03019102bfbcb3b93158b46f1658f1487c881a92f2b88c3ee61723f6d` |
| `/ranking/` | 390×844／light | 2026-10-14T01:13:59.448Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-15.png` | `562d286e32fd05a62cc03b8cceb32a2893d241972fe76e00f4138b5872379a57` |
| `/ranking/` | 390×844／dark | 2026-10-14T01:14:07.633Z | `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/shot-16.png` | `4fac93968f24ad9bb0b6f1eeefc6b8994e620ef1080c04bf0f5ab7d909e03ec9` |

## Listener 與 artifact 收尾

candidate worker3520569 started01:13:12.287Z；API3520822／18197、Next3520907／18198、frontdoor3520959／18199只綁127.0.0.1。cleanup-start01:14:10.285Z；frontdoor01:14:10.292Z、API01:14:10.326Z、Next01:14:10.348Z（TERM143）退出，01:14:10.361Z allExited。capture parent3521118 ended01:14:29.641Z exit1；candidate parent3520176 ended01:14:52.569Z exit0；paired-failed01:14:52.595Z，兩stage ownershipVerified／cleanupConfirmed=true。

owner UTC01:18:49.990420+00:00 的 raw kernel receipt 確認 own PID/profile browser0、18197–18199 closed、full /proc/locks holder0、legacy18196原inode215996810保留。這是當下核對，不能替代停止syscall的精確時間。

owner before／after inventory皆 `f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`、manifest皆 `76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`；獨立review核對原始receipt鏈，沒有由reviewer再開candidate或重跑loader。

## 私有證據索引

| 證據 | SHA256 |
|---|---|
| `/home/deck/tag-analysis-private/f1-release/sm-007-four-page-ui-review-20261014.json` | `225f9fde89680643b51848c715fe0ceb3ee0af894ff160234afea70d63e2bc59` |
| `/home/deck/tag-analysis-private/f1-release/sm-007-four-page-ui-review-20261014.txt` | `d1c666cc6e1cdbf82b9e40be8f1ed0734eba05587a6ce4acad72bbdc9ecf4e56` |
| `/home/deck/tag-analysis-private/f1-release/sm-paired-007-independent-20261014.json` | `8355f6061f001e1cc934bcdd054410edd3eca538551e6f4687cb68cedb3d26f4` |
| `/home/deck/tag-analysis-private/f1-release/sm-paired-007-independent-20261014.txt` | `40b03684e62a58c8199095b6f0b4e7c05290ea022c2ecf83a253a00a4236b9c0` |
| `/home/deck/tag-analysis-private/f1-release/paired-sm-batch-007/owner-poststop-kernel-current-20261014.json` | `054e6c97d90764c769ee0e4217fcdc2b149c751e944c93afa3a0257e5cb08b60` |
| `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/manifest.json` | `0e235e4979b1f31976dff7a85209fa2e945fa1c1ab23145ea3717c88725855f6` |
| `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/network.har` | `1283ebe5bec9dd2c0e935c379c9f7e13b2229991ac31ea11a894d36077401441` |
| `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/requests.raw.jsonl` | `88886719bc9f2123201035c5ea00923d475d37ed17d1ae1dd3b8f3cb8538d4d9` |
| `/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-007/proxy.raw.jsonl` | `b75e47a6b71fca88e93673c79f359d942539c258f70f6ebe98394dd75276c11f` |

原始／失敗job、runtime、Mint資料、正式release、回滾版本、備份、worktree全部保留。下一步為收尾工具source/mock独審和兩處產品對比修正；新的實際build/candidate/capture/deploy仍先交exact命令與fresh probe給babysit，沒有沿用過期007許可。
