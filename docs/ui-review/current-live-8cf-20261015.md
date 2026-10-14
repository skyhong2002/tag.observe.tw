# Current8cf production UI review — 2026-10-15 Taipei

Web `8cf7c94aac3b92df6e51656623893ac1f4930c4f` / BUILD `QyaaKSDvYTbRplSFmJ_kU`, API dc7b814e. Eight current observed routes independently reviewed (seven scoped presentations PASS,038ISSUES),57not yet; fullroute/state0complete/65pending. Candidate and historical SHA passes never transfer. NativeDNT1/GPCnull/webdrivertrue, prelaunch Google transport barrier and raw HAR/request/transport retained. Not GA receipt or all-resource success.

## batch001 — actual independent production review

GPT-6.1 Sol `/root/unfreeze_independent_review`, UTC2026-10-14T23:47:40.830132+00:00,32originalPNG personally viewed. Report `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001-independent-ui-review.json` SHA256 `b0cc7746e203ec65dfffc6af0982b95a99e2481672c1dc60e12a856f7dafd317` and same-nameTXT record actual path/hash/viewUTC. Verdict: PASS（四頁所見狀態範圍，無新增blocking）. Tool verifies BUILD in page HTML before screenshots; candidate and actual picture prompt differences retained.

| Route | Observed | Pending |
| --- | --- | --- |
| 001 | 首頁焦點、關鍵字、新聞卡片、關係圖、五張議題卡及頁尾可讀；1280/390明暗未見新增整頁溢位或版面阻擋。 | 其他載入/空/錯誤狀態；互動及資料完整性 |
| 002 | 柯文哲標籤統計、上位政治人物、新聞與趨勢/歷史呈現可讀；相關與別名尚未收錄如實呈現。正式追蹤/登入入口未操作。 | 追蹤登入；分類/關係其他資料狀態；圖表互動 |
| 003 | 正式畫面明示登入後可投票選圖或上传交管理員審核，登入連結可見；與候選登入功能尚未開放文字不同。無圖片集或上傳表單，未將匿名提示列為投稿流程通過。 | 登入；投票/上傳/管理員審核；有圖/空/拒絕/錯誤状态 |
| 004 | 500匹配/50列、關鍵字雲與排行表可讀；手機表格保持局部橫向捲動，未見整頁橫向溢位；深色表頭/次要文字未見新的可讀性阻擋。 | 排序/篩選/分頁實際操作；其他資料/載入/空/錯誤狀態 |

Network recomputed: `{"requests": 755, "requestDNT1": 755, "requestGoogleURL": 0, "HAR": 755, "harDNT1": 755, "harGoogleURL": 0, "harStatus": {"200": 737, "-1": 18}, "deniedHTTP": 2, "deniedCONNECT": 93, "googleBackgroundCONNECTDenied": 73, "admittedCONNECT": 6, "nativeGPC": null, "webdriver": true, "limitations": "host-admission與HAR/request證據，非TLS封包檢查或GA收件證明。18筆HAR -1不冒稱所有資源成功。"}`. No full dynamic/auth/interaction or all-text AA claim.

- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/001-1280-light-viewport.png` — `0b088a768b87b128a3268b6cfe38f96047a3d50d58ff8ea63f17ad606f5dc54c`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/001-1280-light-full.png` — `e687cdaae3176ee98a643bccfe57b7783e7d9fcdb4b820d2b26f22637160a260`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/001-1280-dark-viewport.png` — `43dcc5950ca349c727eabcff3037405616c96c90bd5d6a437ffc36b4c72a67d3`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/001-1280-dark-full.png` — `cc789e24926d1ec811313723f557449487ee5b5303b1b9f3ef9f2f124f42fa20`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/002-1280-light-viewport.png` — `658f32b0c4fc3f4765f289be83b8a00121ba963dd9abdb4d05da60b7f7370fee`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/002-1280-light-full.png` — `bd477f4ffc0b4d24fbf4bc78102848cf026b76954634de0e4ae3832f09c21e91`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/002-1280-dark-viewport.png` — `ac89039b692b5da72a81c7c19eb4e84e134445e720d68e3184ca825300a2b919`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/002-1280-dark-full.png` — `d84cf737480cc7fb066d2f5ffb8ec13ce1278a9403e0279d8b25f4fc95ed1721`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/003-1280-light-viewport.png` — `efaed4a4a9fa5e411572ab2929561942a1fd32f77ec46d1fae2c987a31a87532`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/003-1280-light-full.png` — `cddd786ea8b20e250954a852fa72f670d9940385ebf940a750f3ad4b9faac957`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/003-1280-dark-viewport.png` — `b42742cf542e69420c83c980c7455493ff9e607bf8283a26ccd1b738a3423d47`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/003-1280-dark-full.png` — `b42742cf542e69420c83c980c7455493ff9e607bf8283a26ccd1b738a3423d47`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/004-1280-light-viewport.png` — `aae2b2b79ae9ac46d72a4d249fdf9b5a6e32ef18dc11dec5a50281fa51742ae1`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/004-1280-light-full.png` — `86bffa8306d29a7d50e524ab6a8af98de5450153cfa5751d4e7d80f9e4b1271b`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/004-1280-dark-viewport.png` — `856263c25845d36db7f8f21b7952b32928b369ef5a54e3e6b5b3af98ddd2be99`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/004-1280-dark-full.png` — `23ae23f3345328b185dde8cee6cc37af6b60f054f48ce5291c4ba4e4299d66f8`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/001-390-light-viewport.png` — `28d7a040208d19860c15da086735771636d4d2c1a32093478227f3785dffc0ff`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/001-390-light-full.png` — `e2458b3e908eb569c217e5e7619d3f20274961aab496f84d3d28d3421d0d05f6`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/001-390-dark-viewport.png` — `95a2e78fc931a2e902e24c5af4a3e0c8b747426a74bcf9eb4ff5f271f6b55f23`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/001-390-dark-full.png` — `a73ce1168e2198e7bd6ff516fe08fa24ecb84fa1f922449ed032d25da389715f`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/002-390-light-viewport.png` — `6f93fa55cadd5b377b4ccbbf0ad9a1d32a32e9a5c751a2b3d945b5f002018d51`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/002-390-light-full.png` — `331de8c759fa7a094023bc68f78ec6726f51595f989074b750fc8129b3672d22`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/002-390-dark-viewport.png` — `61446fdaa377eb1645600ec960786994b897079bfeb3e71b92767d59da359d9d`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/002-390-dark-full.png` — `5f5ca15a1f205e493a2102d5d4f38b5c7e8b78ed3435991300bd34e3fb1282a4`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/003-390-light-viewport.png` — `79757db2543c3b7e6b9d86983bbce406f7044349e7eebfa7c854c0ab083000d9`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/003-390-light-full.png` — `697dfaf3e059d46133946ae4e08347df5dfcda4ad41dfe3ef2c139057f9f7ac6`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/003-390-dark-viewport.png` — `cdcfdad10e02129577011def19eacc0d578d67a5d4fbf246fbd228bd8f080e91`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/003-390-dark-full.png` — `5f4fd55e91f20b2d6bfa0891862ea049e4efd203d5013c9efbce3c37e896af9e`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/004-390-light-viewport.png` — `dd576337806c498f6d02acf46efd72f1469e89987a1314adf068079492a21906`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/004-390-light-full.png` — `17b012b85b83ce743bcc537572e7ca908759dbe5c6eead21835e8a1ac2b3fd6d`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/004-390-dark-viewport.png` — `aa2a73a6d2ff60764d544878c329423c81004fdaaede833d291d66f6b42fccbb`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch001/004-390-dark-full.png` — `9dd4f5d53257d6cf3fc94070a40f275c86d43a4f843925cf1f8f23f30aa89e69`

## batch002 — actual independent production review

GPT-6.1 Sol `/root/unfreeze_independent_review`, UTC2026-10-14T23:49:51.595289+00:00,32originalPNG personally viewed. Report `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002-independent-ui-review.json` SHA256 `a8988c72d7ba5c180f99dd65caab4cd8dba4252e2bc6cad82500bd895afc043f` and same-nameTXT record actual path/hash/viewUTC. Verdict: ISSUES（038保留；034/027/046原問題正式新圖確認修復）. Tool verifies BUILD in page HTML before screenshots; candidate and actual picture prompt differences retained.

| Route | Observed | Pending |
| --- | --- | --- |
| 034 | 群組卡片與統計/增減、身份和主題分組可讀；桌面三欄手機單欄，未見整頁橫向溢位；正式metadata抽像素確認dark400。 | 1日/30日切換；卡片點擊完整榜單；空/錯誤狀態；完整文字AA |
| 027 | 297/297來源與更新時間清楚，抓取方式/工具chips手機自然換行，表格局部橫捲；失敗次數及未啟用如實顯示。 | 搜尋/排序/篩選操作；橫捲其餘欄位；notes展開；其他載入/空/錯誤狀態 |
| 046 | 實際finalURL為流量排序頁，非獨立sources模板；網域文字正式新圖對比改善，桌面長表與手機局部橫捲，手機名稱/網域省略未視作完整文字驗證。 | 月份/數值/排序/搜尋操作；省略文字完整名稱；notes展開；其餘欄位與空/錯誤 |
| 038 | 正常自動播放18小時前frame的未來12小時/6小時/現在標籤過淡；深色實際比值1.7754。手機亦細小難讀。字雲、時鐘、在線/排行資訊可见；本批未將全看板AA通過。 | ffeaaac6未build/部署，需新圖確認；其他播放frame/互動；其他資料/錯誤狀態 |

Network recomputed: `{"requests": 1564, "requestDNT1": 1564, "requestGoogleURL": 0, "HAR": 1564, "harDNT1": 1564, "harGoogleURL": 0, "harStatuses": {"200": 1218, "-1": 344, "308": 2}, "transportEvents": {"denied-http": 2, "denied-connect": 108, "admitted-connect": 6}, "googleBackgroundCONNECTDenied": 72, "nativeGPC": null, "webdriver": true, "limits": "host admission/HAR/request，不是TLS封包檢查或GA收件；未完成HAR不得冒稱資源均健康。"}`. No full dynamic/auth/interaction or all-text AA claim.

- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/034-1280-light-viewport.png` — `dc506e4e8b6531e72970fd11f4911954c1a6bd39fbc2322d0ccc11e40c406324`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/034-1280-light-full.png` — `ed7e1a9c327913192043b76471fd36ec71dbf68887c7c93a326dcb3965b52fe5`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/034-1280-dark-viewport.png` — `45b1e7cdc2c4938a72c0c6d7b844bb76b4aa49b7daac6d784198c50fd3b16e4e`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/034-1280-dark-full.png` — `8edad3cc4305cd8d51e3298bd4f032dc9a93acd6712653fb33f7d9d926de9b03`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/027-1280-light-viewport.png` — `ed86f2c3b2d71f5899ef136aa77963178cee6cac77a3378367268d726bc39f14`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/027-1280-light-full.png` — `2d89aa9421942abdcb4608b6a3c7103c8b135352ec837d5f3cb55c7112cf781d`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/027-1280-dark-viewport.png` — `88109cc76db78f85ef9015ff0b5d0fd47d796ba3b3af8b4fbbc351f3467b69c5`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/027-1280-dark-full.png` — `27c2da4248a67ce41074d072015f604e0c66962c291dd73c5a7e9254d2be2c70`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/046-1280-light-viewport.png` — `937553c9f02d6a9f75265e14082c65f342c627fdd4fb75a45c23fe7689e109bc`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/046-1280-light-full.png` — `0a2944f7b760bdb193d0ab3560b69ef6027b6ed12f381437271bc8d2cfd252e4`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/046-1280-dark-viewport.png` — `ccc7ca8eaa9e0b517b22bc63daeee51422dc32673de5b8e4073c42384fd22c31`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/046-1280-dark-full.png` — `c4662b037972cc7c6a6f352d3454b912f2f1fd7929ef50d3b280935892601414`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/038-1280-light-viewport.png` — `3c7100b06376691701d63d3a7abfe1f93c9de5d1ed9752a0b25b88a6c3693508`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/038-1280-light-full.png` — `85b9e2ec565471db62368fcf5dbcc120d0bfce4da77602af9fd4ef949aee21a4`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/038-1280-dark-viewport.png` — `9eb0398dd20f4df7990bdefd8a96164845fe18bb55eceab0aef9ab7d4f214ade`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/038-1280-dark-full.png` — `b6df7dbce39a8088ec65fe7868330db723c48b8fd1819767334a42d50cf6fe08`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/034-390-light-viewport.png` — `540fd7213af8129428ed77bce1b8dbee738587be31ccaac9472202082f0a2e1e`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/034-390-light-full.png` — `8aa0f45de304bdaa07e72e43cb6013d5dbde58a2939f19735607b2c20a80a404`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/034-390-dark-viewport.png` — `95b4b58474e2ce9498582f92eb3b9be62ed74f28db9e330f4d7713247ec946f9`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/034-390-dark-full.png` — `9edc2671e22f414cb7e1a4727b426717f8050b67a0a34d33988d63b94bdf57ce`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/027-390-light-viewport.png` — `31c23291e0199afd4d981745d8ba1bdf8a82affd5b95e8405462718fe8f072bb`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/027-390-light-full.png` — `4d2385820705b463eabcbb8b827812dd54ee8abd0b71bba76353a018ac5d3d4c`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/027-390-dark-viewport.png` — `25977995d42f418bbd1d08bc5f53050f25ae8e2bbcaeb1c68ef0ba4c18a36120`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/027-390-dark-full.png` — `60fedaf704a97708189bc4fa2da6a3a667b92fa5267e36a2f745142e6340b8ab`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/046-390-light-viewport.png` — `f0474a374e4a3c1a680428ab68740c7006b3722d0c2c9fd346e36405f38f3ef6`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/046-390-light-full.png` — `8f6fb5ecf856010541463e0fed87e6e281f85259e52b347cc02dcd5efb68635c`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/046-390-dark-viewport.png` — `2ec4cb842337dca41fc1ef10bef931908464877622bbae21cd8a47a928da7e8b`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/046-390-dark-full.png` — `98c1001b1ff08f498e6e03dba77dd4fc5b42604047e16deccc340c83896b6bff`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/038-390-light-viewport.png` — `1bd14d524c38f8b72ea93e541b09038de81750909c268315b9f82314d0ef5f07`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/038-390-light-full.png` — `e2a34008106d114d9d6018c999ef9a499885fa835d7b4475eeaf2eb95a20ec48`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/038-390-dark-viewport.png` — `90b11f27431726d24e4e3db7e7587de0ed576ef0c72692bda2d3d511ee04cf8f`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch002/038-390-dark-full.png` — `8fce13f8f8f0583981994c1ae8227295faf16678ebdc3b27cc9838b1777ddb84`

