# Current8cf production UI review — 2026-10-15 Taipei

Web `8cf7c94aac3b92df6e51656623893ac1f4930c4f` / BUILD `QyaaKSDvYTbRplSFmJ_kU`, API dc7b814e. Sixteen current observed routes independently reviewed (fifteen scoped presentations PASS,038ISSUES),49not yet; fullroute/state0complete/65pending. Candidate and historical SHA passes never transfer. NativeDNT1/GPCnull/webdrivertrue, prelaunch Google transport barrier and raw HAR/request/transport retained. Not GA receipt or all-resource success.

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


## batch003 — actual independent production review

GPT-6.1 Sol non-author, UTC2026-10-14T23:53:54.151172+00:00;32originalPNG actually viewed. `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003-independent-ui-review.json` SHA256 `140d0d5d4eb533f015d9cc5aaec7de82dd8ab542e5584fdadaaa9da2e038e783`, same-nameTXT and per-image view timestamps/hashes retained. PASS（四頁所見狀態範圍，無新增blocking）.

| Route | Observed | Pending |
| --- | --- | --- |
| 024 | 署名/記者統計介面有實際資料，選定2日/記者，約4094–4096個署名、24252–24324篇有署名文章；3000匹配表先顯示部分列、顯示更多可見。深色表頭/媒體及百分比可讀，手機controls換行、表格局部橫捲。actualURL仍/byline/，不是以同畫面假造redirect。 | 搜尋/媒體/類別/期間/百分比/詳細欄位/進階篩選；排序與顯示更多操作；手機橫捲其餘欄位；空/載入/錯誤狀態；notes展開 |
| 036 | 署名/記者統計介面有實際資料，選定2日/記者，約4094–4096個署名、24252–24324篇有署名文章；3000匹配表先顯示部分列、顯示更多可見。深色表頭/媒體及百分比可讀，手機controls換行、表格局部橫捲。actualURL為/journalist/；不同截圖時間數據不假設與byline完全一致。 | 搜尋/媒體/類別/期間/百分比/詳細欄位/進階篩選；排序與顯示更多操作；手機橫捲其餘欄位；空/載入/錯誤狀態；notes展開 |
| 013 | 昨天1、本週24及較早專題資料、keyword chips、來源網址與摘要可讀。桌面媒體sidebar、手機折疊媒體列46家與搜尋，長頁來源網址自然換行；部分條目無圖/灰色placeholder如實保留，未稱所有圖片已完整載入。 | 搜尋/keywords/更多keywords/媒體展開/更新狀態操作；原站連結與專題詳情；無圖來源原因；空/載入/錯誤；notes展開 |
| 005 | 每日62事件，首3大型與其後卡片/折疊列，圖片、camp比例、排名/時段、對照標題與來源可讀；手機依序單欄且日期列局部橫捲。深色folded時段及排名字已以中段crop實看，未見新的可讀性阻擋。 | 每小時/日期切換/其他日期/各時段keyword；事件索引/各媒體對照/RSS操作；folded展開；載入/空/錯誤；notes展開 |

Network: `{"requests": 1235, "requestDNT1": 1235, "requestGoogleURL": 0, "HAR": 1235, "harDNT1": 1235, "harGoogleURL": 0, "harStatuses": {"200": 1185, "-1": 48, "404": 2}, "transportEvents": {"denied-http": 2, "denied-connect": 131, "admitted-connect": 6}, "googleBackgroundCONNECTDenied": 73, "nativeGPC": null, "webdriver": true, "limitations": "HAR/request與host-admission，不是TLS封包/GA收件證明；-1表示該HAR資源未完成，不宣称全部圖片健康"}`; no all-resource,GA receipt or fullstate claim.

- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/024-1280-light-viewport.png` — `62963a6314b965c358bfb86188b99c4e6d13bfbf284d0c86cb7b485584313e57`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/024-1280-light-full.png` — `b207427327629b260a73d58fc8b6bd9828dcef894dd798c0f5214f15b058bf7b`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/024-1280-dark-viewport.png` — `1feb8a01d751fef41f1fd65980912d29de1facd25fed72e210f0b956f4b4208d`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/024-1280-dark-full.png` — `351156061070e14382f1c6088ea6fad0c740ba2b783c634149dc87e666d1b0aa`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/036-1280-light-viewport.png` — `0741700d12cc15297e7bacedde205f777e90b74ef7e92aa227d969342d55b78e`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/036-1280-light-full.png` — `42ccbd12f9e3ead089b336c0aa8ec849ef8c3079cd106edf1f2414e09bed4d28`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/036-1280-dark-viewport.png` — `47cef0f392c5548e92c3f94295efa018539ea4a8cfdfeb8bf742c5549a86e55d`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/036-1280-dark-full.png` — `537e906711f2e063d5926b558fea096e2d105af75fde1b7980300d8bab453d71`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/013-1280-light-viewport.png` — `4aaaf14e0a87de1d489e5aa2ad060afaff75bd7400097292e1a1ccd921fa1125`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/013-1280-light-full.png` — `296c53461228fab5a49aa364f2fde17aeb1b8f3ec6a3fae870659989ca82a965`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/013-1280-dark-viewport.png` — `1394ec23c72abd96fe9cdffe398be49efe895235c12ef51005ecc3ae2f471128`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/013-1280-dark-full.png` — `532a317df28f7ef0d1acf37219db056fe014df328b39eb754b2ca2759fe10915`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/005-1280-light-viewport.png` — `ccd928ae82a885fbd41d2173040808a6bc59e29d3fdb2d73fec8854d01bd744f`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/005-1280-light-full.png` — `48491ce52e7d8a974a6a2878522f1212cbb6ef4b70d0330142741ad1f75053f0`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/005-1280-dark-viewport.png` — `ca7ee0655246a4f1f945997a38f7f8ed23d23e14aaf892dd33fd8a114bdc90c2`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/005-1280-dark-full.png` — `1cf945ec099198da4bb33f5cfc2f42bd2925d80850efbe88c32bea2cd07360c7`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/024-390-light-viewport.png` — `63bb115f467489db0ecabad04e40ac05ba697e9e71662a585a396259d0a28682`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/024-390-light-full.png` — `c7d895c27b89567bbf7ad95717d6374976f43b249da53b3973b86aa325131fd8`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/024-390-dark-viewport.png` — `8fac4ce573e942f17b61b746be6eecf48469878f03ba275bf31fba2e93979dc1`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/024-390-dark-full.png` — `5fa1d400b5825a4a6d49cfd8af3418d13a565dc63f2dfc9cd942190988a98b9c`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/036-390-light-viewport.png` — `63bb115f467489db0ecabad04e40ac05ba697e9e71662a585a396259d0a28682`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/036-390-light-full.png` — `a21116c6f9e0f45625efe48798432e7f897430805a075ab1715f8c7368edd2d7`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/036-390-dark-viewport.png` — `8fac4ce573e942f17b61b746be6eecf48469878f03ba275bf31fba2e93979dc1`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/036-390-dark-full.png` — `ef6a1c4763c89c9d037d30f43d2a81b903dab757acbad9c8a991cf9984e7fafd`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/013-390-light-viewport.png` — `3a5fdce66fedaf60229c5a8358513ecd126174a22cb05e63b4ed7ab3ec546f98`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/013-390-light-full.png` — `624b366a56ad148b6b22e3dcbb42a79666b7ee8c1c7d9f0a309f3d62553f3931`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/013-390-dark-viewport.png` — `cf1e4273f4f89d59d6343e187b7b465dfb20547a3447a1168ae8f0d986c1c57a`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/013-390-dark-full.png` — `7d63c66b754e079895ead7df766d6f94ec5f63f96aa6f3227ae84b2295a63e44`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/005-390-light-viewport.png` — `b70fc4eda59c5c6e72e2265fa4c961225ddc409054d70cd6889144b80fb0f629`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/005-390-light-full.png` — `32fad46cd770174d0f85dcd0c544b569d78ecc898137f49ace3f6dada39271bd`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/005-390-dark-viewport.png` — `385eb2cadcbb43eb8add835c45da28d7eb56eb9d6a8716bbf8ee2c1ec0d344a0`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch003/005-390-dark-full.png` — `7b7e035563c361ea51a3e678eb68b180e1dca45fef2a8f8ec32b63566dba23a4`

## batch004 — actual independent production review

GPT-6.1 Sol non-author, UTC2026-10-15T00:01:07.465085+00:00;32originalPNG actually viewed. `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004-independent-ui-review.json` SHA256 `0623414550f703f645b05e7485ad83139941b030b9fc00b45eb917796a4945f4`, same-nameTXT and per-image view timestamps/hashes retained. PASS（四頁所見狀態範圍，無新增blocking）.

| Route | Observed | Pending |
| --- | --- | --- |
| 008 | 57065438經濟日報艾司摩爾文章標題、作者/時間、ASML/台積電/晶片chips、摘要、配圖來源、原文網址、所屬事件及相似/相關報導清楚；手機長標題自然換行。不同全文約822/本文758字標示如實呈現，未驗證計算語意。 | 收藏/回報登入互動；共同片段與相似度說明展開；連結/延伸閱讀操作；其他文章多/少/無圖/錯誤狀態；notes展開 |
| 010 | 今日2037、24h18694/226發稿媒體及100%標籤KPI可讀，手機2×2卡片與filter chips換行，長表局部橫捲；原低對比KPI/theads所見改善，未見新增版面阻擋。零值在指定中段可讀，不以未建置零值source補修當本版全部零值AA通過。 | 分類/狀態/傾向/範圍篩選與排序；手機右側欄位；全部遠端零值/disabled狀態AA；空/載入/錯誤；notes展開 |
| 011 | 1天主事件hero蔡康永/沈伯洋、6桌面次卡與手機較少次卡、18,745篇/sidebar來源統計及最新文章列正常呈現；hero hashtags與caption可讀，手機事件/統計/文章改單欄。內文連結無摘要及部分無圖如實呈現，未當空頁或全部圖健康。 | 3/7/31天/進階查詢；日期分頁/更早文章/來源連結；不同事件與其他動態資料state；圖片缺失原因；notes展開 |
| 012 | 桌面今天29個、手機38個反映不同截圖時刻，不強作同snapshot；關鍵字、來源資訊、相關報導、圖片與摘要可讀；來源網址手機換行且媒體折疊列35家。部分無圖與占位灰塊保留，不假稱已載入全部圖。 | 媒體/keyword/更多keyword/搜尋/更新狀態操作；原站及議題詳情；缺圖原因；空/載入/錯誤；notes展開 |

Network: `{"requests": 1332, "requestDNT1": 1332, "requestGoogleURL": 0, "HAR": 1332, "harDNT1": 1332, "harGoogleURL": 0, "harStatuses": {"200": 1041, "-1": 291}, "transportEvents": {"denied-http": 2, "denied-connect": 94, "admitted-connect": 6}, "googleBackgroundCONNECTDenied": 71, "nativeGPC": null, "webdriver": true, "limits": "host admission/HAR/request證據非TLS封包或GA收件；HAR -1不得聲称所有圖片成功"}`; no all-resource,GA receipt or fullstate claim.

- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/008-1280-light-viewport.png` — `90fb054c55288c67840a246514757e4cfed33816bde68a9d24fe325cd78ad5a4`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/008-1280-light-full.png` — `b73d42b81451baf382b0e465f8bda06dbd4d347549dd5f1f57128191c7d8e4cc`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/008-1280-dark-viewport.png` — `6b3f7a583d480c135e0588f97038535b85dfa958076ad8006934103218a4292c`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/008-1280-dark-full.png` — `35020434fdc5a86f3866d97dd0d62ccfb06ac78464570d84fa5223823faf2d0c`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/010-1280-light-viewport.png` — `adc9eea4643e7bef94fb6d5064680eec4da8ae3a339546f6510492b3a4560bff`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/010-1280-light-full.png` — `ee2d97b034895c103dbb779036b973299a25ff4ca978965c523e0d846cf98d07`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/010-1280-dark-viewport.png` — `c35c8f823966bc43f3455ea813cee807fb7348b3e8aa651896a379368c9d4b76`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/010-1280-dark-full.png` — `a49905c1f34251978d4a7589a1deea57c9e9776f0a5319a1bcba281dfc867156`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/011-1280-light-viewport.png` — `fa9d1a5526525041da85585d93c3004aa139cd52afef68b4c6a992f15bbdf8b9`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/011-1280-light-full.png` — `0164293dfb1fde9fc862d131c98d363d88947ff2a12fe086a4a8082aa3a71e38`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/011-1280-dark-viewport.png` — `76fb164ca2e716ffd42ef4a06d2ef409b4559f359e42a33ffc89e91759d26fb3`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/011-1280-dark-full.png` — `0d8d8b9d0b85dcacd01d994caddac946567b72f1331cca9816bb6447e7713343`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/012-1280-light-viewport.png` — `d23ddd0427c5e7db9ecb4cc3156580a8c2be6f141c42c5e560ae35c095cd0799`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/012-1280-light-full.png` — `c277df9c30717637145c032c8dd3c4260ab5da13acac07971f771dba7970654f`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/012-1280-dark-viewport.png` — `001e4b879fff3b1a15d820eae70ef5d708581472a69b3e0c15739395c7a4750d`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/012-1280-dark-full.png` — `dcb593ec0d7a64bb28d1ea45c423871e734c4e2ea8ed6f9e24ed302610e6389b`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/008-390-light-viewport.png` — `6cb470abf4adbe16a4f3206bc8737b2cd312b373076ab3ee5c889a19225a8feb`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/008-390-light-full.png` — `5c2b25fce1500b02ad5bdf1ca5722f63e81ce62992055213bd9d445697a6dcd8`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/008-390-dark-viewport.png` — `65f1aa458b5904e03f2aea4ee86f75a49f1bde4d21190bcd09935e6238717ba1`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/008-390-dark-full.png` — `c5b19082ac880dc8226a1f1d7fea92a8dad2babb702480a2c233e19cb9adec1d`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/010-390-light-viewport.png` — `da3bbdbfe3ae0b0cf85da4cb2af708d8c2850edebb334732b527c4fed774eb77`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/010-390-light-full.png` — `bb86cb5cb274917e1c3774099566f0e26a622472a5ff431331152b4244e75307`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/010-390-dark-viewport.png` — `2b58b9e249d27dda2ea59dd18ebfc8840f41e7b75f36f4f1ab19e05c4ef22a42`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/010-390-dark-full.png` — `7d8e1b9e8ae8d4ade54c88c9a06062cb097d8097ae86af190322c5fb4118ac5f`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/011-390-light-viewport.png` — `76bd460830c030f9e1c846f426b90f3e1e5cd219828e2fe480cc889a830d9127`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/011-390-light-full.png` — `d3d86a22e22621ae2275b41c1abaa4fd25dd515b1172566162e6fdb4728a74f0`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/011-390-dark-viewport.png` — `26f7db1b9976606fdca5513d75d6c978f9b3755fff583fb25e35b8b9eb80b2bb`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/011-390-dark-full.png` — `b972cf07f4f167425b1173b29296505e870b8ff4c04898a099a43e7fa2fed36a`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/012-390-light-viewport.png` — `afb61fd7d6dddf582e41cbffe83d73b277e546357b286bfdd76630e121744361`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/012-390-light-full.png` — `f6d72efb86e681ba970690068c1945553ab5b8d71402318e8f5893ae01e44990`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/012-390-dark-viewport.png` — `c010c31592fa6af2cc448888ffb1d03b527ed1c9bb9ec7f42a58e0d5b4eb85fc`
- `/home/deck/tag-analysis-private/ui-review/current-live-8cf-20261015/batch004/012-390-dark-full.png` — `7263d8b94ac90bc748ebdc419ef98b11fe9358a82bf3f71b8fd1ce0431e6be3b`
