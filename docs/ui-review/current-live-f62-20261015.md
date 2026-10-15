# Current formal f62 UI review (2026-10-15)

APP `f62abfb5a99f3f8d9700ed4914faef8823349c55` / BUILD_ID `08ItzUxu99m4XSoNcfGsu`; API `dc7b814e220606202a408d21e73b1d6e7c61fe16`. NativeDNT1, prelaunch Google transport barrier, actual production screenshots. Full65-route/state scope incomplete; observed presentations below do not verify login/mutations/missing dynamic states. Historical versions and candidate reports remain separate.

## batch001 — actual independent production review

/root/unfreeze_independent_review, GPT-6.1 Sol, UTC2026-10-15T00:36:43.739901+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001-independent-ui-review.json` SHA256 `5e51e2d75b9ab95b03ba008a77c6fcd3e7d49345d44ebd49222a0ccad916d418`, same-nameTXT has actual image/view timestamps. Verdict: PASS（主四頁所見狀態範圍，無新增blocking）.

- 001: PASS（所見正常與局部無資料呈現） — 正式首頁本小時24焦點事件、熱門rank、記者/讀者、同題不同標、關係圖、五議題卡及footer可讀；手機單欄/桌面三欄無新增整頁溢位。綠營在推藍營少報一欄顯示今天的事件裡沒有，議題部分無圖占位如實呈現，非全站空/error驗收。 Pending: 其他動態資料/loading/error states; keyboardfocus/hover/點擊互動; missing圖片來源原因; 全站每字AA
- 002: PASS（所見正常匿名標籤） — 正式追蹤入口可見，政治人物上位分類、related/alias尚未收錄，#269/13篇/9of43媒體與3日30篇新聞資料可讀；history/趨勢另crop實看，手機單欄資訊與圖表呈現未見新增阻擋。 Pending: 追蹤登入/關係投稿; 期間/圖表/keyword搜尋互動; 更多資料與分類/別名狀態; loading/empty/error
- 003: PASS（正式匿名權限提示） — 正式明示登入後投票選圖或上傳交管理員審核，登入連結可見；不是candidate disabledtext。無gallery/form，未把匿名提示當選圖/投稿/審核通過。 Pending: 登入/投票/上傳/管理員審核; 有圖/空/錯誤state; notes展開
- 004: PASS（所見正常排行） — 08:30資料91媒體11079篇、500匹配50列及wordcloud載入，desktop表頭/次要字/crop可讀；mobile保持局部表格橫捲無wholepageoverflow，未見新增blocking。 Pending: 排序/篩選/更多列/右側欄位操作; focus/keyboard; 其他loading/empty/error; 完整AA全欄逐字

Network recomputed: `{"requests": 766, "requestDNT1": 766, "requestGoogleURL": 0, "HAR": 766, "harDNT1": 766, "harGoogleURL": 0, "harStatuses": {"200": 745, "-1": 21}, "transportEvents": {"denied-http": 2, "denied-connect": 91, "admitted-connect": 6}, "googleBackgroundCONNECTDenied": 71, "nativeGPC": null, "webdriver": true, "limits": "host-admission/HAR/request，不是TLS封包或GA收件驗證；未完成HAR不稱全部資源成功"}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/001-1280-light-viewport.png` — `0da0bff2146dcda4c36fd7d42a59bbf588e1fe66a508921cf179689b2a55d71a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/001-1280-light-full.png` — `f59dae9ef34b6aa0b1cb393c39de7fd0654ef12a92e0738591b7c9e5eb2c1eff`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/001-1280-dark-viewport.png` — `401f852ed60d5b6683affc94e16638fe9f0742afc6fb2e86418905af346202a6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/001-1280-dark-full.png` — `4e6e56766f8581980b81c1a56bc19f89e9467124ab059ca8b485c3ee86dcfa9a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/002-1280-light-viewport.png` — `2da37e95588dfd3f9fe877b9cf6019f155448c147fd743c12b3732d0bbf54bd0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/002-1280-light-full.png` — `bd65a369fb5410f062f011f7f9221329c8a7e260bf03382c60e5786c9bb2907d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/002-1280-dark-viewport.png` — `6f839865d8b166d83a63c4bb60bd7ffbc3a9165f0ca0427c22b165501e030623`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/002-1280-dark-full.png` — `5aef7a98b23b66cdddda03537b531f18766c86aa1d2e43ada4680507c9a01173`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/003-1280-light-viewport.png` — `df10b56ffaeac26a13d791549e65bcece48ea37a1ec6655b1c3653ea9760b3e2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/003-1280-light-full.png` — `29a62e7d0f0b947f5bfb204f46af3a5717da4f45d170a7bf035f06a6f38f0f05`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/003-1280-dark-viewport.png` — `5eb0e7a2c08b00e678350ef5b6fdd70cdf9ff3bd8896bf18d6dd16609f549e1a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/003-1280-dark-full.png` — `5eb0e7a2c08b00e678350ef5b6fdd70cdf9ff3bd8896bf18d6dd16609f549e1a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/004-1280-light-viewport.png` — `10cba26b37610dbf32fc79bb5e94ff94d020e22af1aa656c4a95b87b87128d88`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/004-1280-light-full.png` — `a718d9cda397678d9c171ccc02c4aa6433a8358daa98a1656dbdb30bdb30bc08`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/004-1280-dark-viewport.png` — `e385270fa716720c2588c83959b39205e39674176e2877855359ee1f77038aca`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/004-1280-dark-full.png` — `c5baf63671d241577fd1f17c6073422558c6ac4fcab64f7ddc98081528fde17d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/001-390-light-viewport.png` — `0f5ccb306a68cb4c35b405f8d6cead17bd0ea235d233830cef84b0d1c1378410`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/001-390-light-full.png` — `f9a0d2f7b450bc556416fb13051b52df5caa67198eeb8dd36065c55a5fddeb49`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/001-390-dark-viewport.png` — `d0d1d7da36afbf500c99e4573fc63200177e4006d85dcf96591dc3a8debf6960`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/001-390-dark-full.png` — `732bda22010605cf847fc4fef947aac5f5c063780714e1a3f135bfb9a80f9358`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/002-390-light-viewport.png` — `42167c08ee00583a8fd4979f267c8f1e8e103011261239399e9a04113efe6c83`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/002-390-light-full.png` — `8fd381f7d80cf30a9c4dd85ced0998dfa30d470b32ad8857f5610fbdd490ab6c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/002-390-dark-viewport.png` — `262e97680fbe028881409ede5d33e36d0d29eec096499379d134b5c6323d0978`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/002-390-dark-full.png` — `8f2387c5cf7071f8000b6c178d06d976c7a4e128d1cf4fa68cbd3bea703d6db8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/003-390-light-viewport.png` — `14208c80434e1acec2cb28d4305f0c729af0a0713ef1972337b6bd350a0950f0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/003-390-light-full.png` — `a609affb95a83753efc01d64cf86ddc2e21efacfd4d91cb07d5586d6c26025b3`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/003-390-dark-viewport.png` — `9e1e4f68608497d758c1615d12074747e5cc13f3aede695e2bc5a34c6a4ad6db`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/003-390-dark-full.png` — `54f2eaa62b898c09b6a4a69f4e78afa48922d0eb7ef15c4aed46c041ce97e999`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/004-390-light-viewport.png` — `fa04fa64426e207c5cb519c1ff31eccc46638174d2461199c023b6128596fe5d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/004-390-light-full.png` — `a006ef3760a2caf7f19bf8d6b4673b1b4d5593fa520761550b42dea102c4854f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/004-390-dark-viewport.png` — `46108060956d93f31b953e0bf441717edbdf6af1c10402fb51de193661b66459`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch001/004-390-dark-full.png` — `728c8e2339f2c9717b9750b5551c30bc411061592a6534b39772330906d2c9cb`

## batch002 — actual independent production review

/root/f1_frontend_independent_sol, gpt-6.1-sol (existing independent non-author instance), UTC2026-10-15T00:42:09.322315+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002-independent-ui-review.json` SHA256 `e73df6785c2ae7178577051ad5dcc7b85e21a54e141409c60e60d211756bdc8f`, same-nameTXT has actual image/view timestamps. Verdict: PASS（所見正常首屏/指定裁切布局範圍無新增blocker），PARTIAL整批fullscopepending；不能當四route/allstates完整UIPASS.

- 008: PASS（實際所見正常首屏/指定crop布局，無新增視覺阻擋）；完整route未PASS — 實際見經濟日報標誌、兩行ASML/台積標題、作者簡國帆/鍾惠玲、10/15 03:29、822字、三個tag chips、文章摘要與ASML原圖上半部；收藏/回報按鈕有間距，未操作。 實際見手機logo/search/theme/login/menu、三行ASML標題、metadata、chips換行、摘要與圖片；無字互疊或整頁橫溢。 實際读758字preview與原站URL、延伸閱讀、所屬事件、他站相似報導1篇、97%與共同片段折疊提示；列前幾筆相關報導。未展開共同片段、不宣稱全文或操作通過。 實際看末段相關報導/原媒體相關報導、收合method notes、footer data/open-source/安裝/聯絡/返回頂端；手機兩欄footer與social buttons換行正常。 Pending: full route/state scope remains pending; loading/empty/API error recovery states not induced or verified; keyboard focus/hover/menu/theme clicks/search/filter/sort/pagination/scroll actions not performed by reviewer; anonymous captures only; sign-in/nonreader/reader/admin auth operations untested; notes/details expansion and outbound navigation untested; global AA/screen-reader text semantics and every image-resource completion not approved; 長圖所有中間列/細字未連續viewport覆蓋；僅原圖overview+指定900px裁切/native首屏可讀細節; 收藏/回報/原站開啟、共同片段展開、完整文章body取得狀態未操作
- 010: PASS（實際所見正常首屏/指定crop布局，無新增視覺阻擋）；完整route未PASS — 實際見媒體與文章數、08:31更新、四卡2478/18599/227/99%、待確認19篇、status/category/camp/regionchips與表頭及首8媒體列；正常數字與0/缺值概念未混成error。 實際见收錄/流量tabs、2×2統計卡、status/category/camp/region chips多行，首屏未到table。沒有截出桌面右欄，不當手機全欄PASS。 實際读美國之音中文網、動態網、關鍵評論網、INSIDE/妞新聞/欣傳媒等中段列。桌面含24h/7日/流量/分類；手機只初始橫捲位置的媒體/範圍/傾向，右側数字未實捲。亮色若干favicon空位、暗色相同列部分favicon顯示，需lazyload/incomplete resource覆核。 實際看桌面最後零計數/缺值媒體列及footer；手機底只最後列局部，notes/完整footer可讀。未把整12048/12735px所有列當逐字看完。 Pending: full route/state scope remains pending; loading/empty/API error recovery states not induced or verified; keyboard focus/hover/menu/theme clicks/search/filter/sort/pagination/scroll actions not performed by reviewer; anonymous captures only; sign-in/nonreader/reader/admin auth operations untested; notes/details expansion and outbound navigation untested; global AA/screen-reader text semantics and every image-resource completion not approved; 長圖所有中間列/細字未連續viewport覆蓋；僅原圖overview+指定900px裁切/native首屏可讀細節; 手機table右側欄位horizontal scroll/所有header-sort/statusfilter未操作; 未完成image資源與亮/暗favicon差異需實際scroll/lazy-load重驗
- 011: PASS（實際所見正常首屏/指定crop布局，無新增視覺阻擋）；完整route未PASS — 實際見最新文章/進階tabs、1/3/7/31天、賈永婕賴惠員主事件照片/標題、綠29其他51藍20分布、45家300篇、六小事件卡；內容對比與間距正常。 實際见mobile事件主圖上/文下、主標題折行、29/51/20分布與三個報導摘要ellipsis，蔡康永首小卡；未見horizontaloverflow。 實際read玉晶光/Intel Xeon/川普/台股ETF等文章列、媒體/時間/標籤；桌面sidebar23/58/19%、top媒體計數可讀，手機列自然換行。 實際見末幾篇文章/更早的文章、notes/footer，手機所截底部不含全部末幾篇。pager/filter/selected camp ring沒有操作；只正常未選畫面。 Pending: full route/state scope remains pending; loading/empty/API error recovery states not induced or verified; keyboard focus/hover/menu/theme clicks/search/filter/sort/pagination/scroll actions not performed by reviewer; anonymous captures only; sign-in/nonreader/reader/admin auth operations untested; notes/details expansion and outbound navigation untested; global AA/screen-reader text semantics and every image-resource completion not approved; 長圖所有中間列/細字未連續viewport覆蓋；僅原圖overview+指定900px裁切/native首屏可讀細節; 更早的文章/1,3,7,31天/陣營篩選與selected ring行為未操作
- 012: PASS（實際所見正常首屏/指定crop布局，無新增視覺阻擋）；完整route未PASS — 實際见議題表description/專題link、keyword chips、更多關鍵字22、搜尋、今天更新38、台一/颱風/美股首列與媒體sidebar；首列圖片缺省與有圖情況均不擋文字。 實際見media browse35家收合、chips換行、keyword搜尋、今天更新38、台一/颱風首列；URL分多行且ext icon靠右，標題/圖片/來源無明顯重疊。 實際read東協財經/2026大選/AI浪潮/品觀點/六都爭霸等middle rows，桌面text/media partners兩區分明；手機URLwrap、摘要ellipsis與來源小字可讀。亮desktopบาง圖占位、dark圖已到，不能宣稱全部圖資載完。 實際見陳建州/2023杭州亞運/隋棠末段桌面rows及footer；手機末列只有URL尾端與footer。全文16219/23065px之間大多rows僅縮圖overview，完整逐列pending。 Pending: full route/state scope remains pending; loading/empty/API error recovery states not induced or verified; keyboard focus/hover/menu/theme clicks/search/filter/sort/pagination/scroll actions not performed by reviewer; anonymous captures only; sign-in/nonreader/reader/admin auth operations untested; notes/details expansion and outbound navigation untested; global AA/screen-reader text semantics and every image-resource completion not approved; 長圖所有中間列/細字未連續viewport覆蓋；僅原圖overview+指定900px裁切/native首屏可讀細節; 35家media disclosure、更多22keywords、search/topic navigation未操作; 部分desktoplight圖占位但dark已顯示；resource capture completeness未過

Network recomputed: `{"requests_total": 1327, "requests_dnt1": 1327, "browser_google_attempts": 0, "browser_flag_disagreements": 0, "request_domains": {"tag.observe.tw": 1319, "static.cloudflareinsights.com": 8}, "transport_events": {"denied-http": 2, "denied-connect": 92, "admitted-connect": 6}, "transport_google_denied": 88, "transport_google_admitted": 0, "transport_admitted_targets": {"tag.observe.tw:443": 6}, "har": [{"file": "network-1280.har", "entries": 688, "dnt1": 688, "google_attempts": 0, "google_success": 0, "status_counts": {"200": 557, "-1": 131}, "aborted_types": {"script": 4, "image": 127}, "failure_text_counts": {"net::ERR_BLOCKED_BY_CLIENT.Inspector": 4, "None": 127}, "failed_domains": {"static.cloudflareinsights.com": 4, "tag.observe.tw": 127}}, {"file": "network-390.har", "entries": 639, "dnt1": 639, "google_attempts": 0, "google_success": 0, "status_counts": {"200": 492, "-1": 147}, "aborted_types": {"script": 4, "image": 143}, "failure_text_counts": {"net::ERR_BLOCKED_BY_CLIENT.Inspector": 4, "None": 143}, "failed_domains": {"static.cloudflareinsights.com": 4, "tag.observe.tw": 143}}]}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/008-1280-light-viewport.png` — `e4e7cb19d2ffaa002c9c80d22c442cd6e16656622945b9a851dbfa0c599d4f3a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/008-1280-light-full.png` — `a1b5a5de42d3d126d710152836f4da708207760cdea938920190637df7ae5d47`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/008-1280-dark-viewport.png` — `7d23092b2601e245159054afe7ef129b753648deaa977193ed3ca9dc4b051400`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/008-1280-dark-full.png` — `29d553f9d25a9864cd8a229afa1fe1605d85dfd2dcc9296f8ef4854865bd2d71`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/010-1280-light-viewport.png` — `fdd979666aba8b0e1ca7162f927cc801737370c4c238ef609766b8a551bd1e70`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/010-1280-light-full.png` — `b488278e98901e50c5cf17da3e4217a9e45f075fa1906c78b4ef241de53e277a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/010-1280-dark-viewport.png` — `1a30d5acc6b3e609ac9053d6bdfbd2ccbd2daee63cbb1d65dbcb3f6f3562dddc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/010-1280-dark-full.png` — `2f896d8a868f8b48eda3d8bc87c3b6fb0f06af575c70674c2cd9eab888d26ee7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/011-1280-light-viewport.png` — `7c3a445e7b18f3eef6d0a15c4569f7e1b135b43411570ae706a2c679d1e275e1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/011-1280-light-full.png` — `5f02ef494f430b1ee375d95c6a9be765f827fcbf65d42ae47dc69cc6be1b62f9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/011-1280-dark-viewport.png` — `2e27f621d9771d5032c5c58c8726dc1611e476cc9146a17b7b331e3aa1d65a46`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/011-1280-dark-full.png` — `14a3de24451ad32e6e2cc52855c37c0b8f5682708275285a2523c671c3fb0e5b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/012-1280-light-viewport.png` — `135bbca67d9016091a8117d99b3f5cd2767b9424881c4bcc5673aef0c557f68c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/012-1280-light-full.png` — `e503654c4ecb9eb7cb02fd91e737ebd1371dac4c54e6f5ceb7a89ac1e94ccbc0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/012-1280-dark-viewport.png` — `b5b8f9437c148014eedffdde032cdc9c864e112e6a30c54a62b0013947b60b69`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/012-1280-dark-full.png` — `eb78beb3d03f35f9a3264abdf42726951d47ae332b94b56d3b571c59328ad6ed`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/008-390-light-viewport.png` — `b6ac6f24a0502ea5696bbc9569bfe148f2cfa4205695e6ffa52572b7cee98e53`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/008-390-light-full.png` — `2799e52e8c36cca7a1ce7575f562eb133758588c13618f797db5f5a04972640a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/008-390-dark-viewport.png` — `7c7c3dd4913f369512554b50d92e11c9c80571e10c70730c33e8dea74e51e8f3`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/008-390-dark-full.png` — `66ae90a29b0d8d50a8275e37fc009b7f2017ad8ed1ecf9c325aa582680d9c48c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/010-390-light-viewport.png` — `a16cc4468328b1ceed965337413bcf543e3eeda36ba883766a389f6e2aceefe9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/010-390-light-full.png` — `dcc9695ddffe99562ac623559a0e183b1afb070ed7128351549a720b52a5526a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/010-390-dark-viewport.png` — `2f5002f5d8c6adc9407b299037140c1945bc8beacc334fbc941679aec2ebf03e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/010-390-dark-full.png` — `6dee955fc946fef5c27f4744cf7bc26321958319d540c14ed48e673c4a9dbd01`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/011-390-light-viewport.png` — `90bced8a94a3fc046fabf688682f5ead36f26e4ed85e50d2815e760d96134d33`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/011-390-light-full.png` — `16a30932459f3f764f4fe47fd9c430719627c2a16c0c6704caae7f7f997acce1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/011-390-dark-viewport.png` — `725bfc5b4616f3930579ed197a5c0fc2290ba06de94e47e3c5583f84d4c22f9f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/011-390-dark-full.png` — `85dfff595a6cc7f6a642cee64b4e7c17b697299a19317a0dfe12203823b34407`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/012-390-light-viewport.png` — `afb61fd7d6dddf582e41cbffe83d73b277e546357b286bfdd76630e121744361`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/012-390-light-full.png` — `18098ed7dcb75772d7d4c364530ae598c79336cd214f8fb8898a4e710d97dbae`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/012-390-dark-viewport.png` — `c010c31592fa6af2cc448888ffb1d03b527ed1c9bb9ec7f42a58e0d5b4eb85fc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch002/012-390-dark-full.png` — `4ef6832ee4ad0e9340d796bd73ad38452b96f068b0ba971f801e4c38cec80bbe`

## Capture paused before batch005

Fresh SM probe `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005-pre-probe.json`: blog homepage UTC2026-10-15T00:41:12.295796–00:41:17.741854 HTTP500 (curl exit0,5.439066s,29435bytes,CF DYNAMIC); nine-row probe failed despite medians within gates. No batch005 browser/profile started. Previous four captures all completed; existing picture reviews proceed offline. This temporal observation does not establish the cause or blame another service/build. Tag f62 remains deployed; no API/DB/other service changes. New captures await a genuinely fresh all200 probe.

## batch003 — actual independent production review

/root/unfreeze_independent_review, GPT-6.1 Sol, UTC2026-10-15T00:42:42.400044+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003-independent-ui-review.json` SHA256 `f6bf0811822e15029017acd26e224fd8d1f21fd857b190dc6f2149d5cff13fcb`, same-nameTXT has actual image/view timestamps. Verdict: PASS（四頁所見state範圍，無新增blocking）.

- 005: PASS（所見正常每日事件） — 63事件正常資料、首三大型卡片及其餘卡片/折疊列、camp分布、圖片、對照標題、9小時與00:00–09:00等次要文字可讀。手機日期列局部橫捲、單欄卡片無新增整頁溢位；folded中段另crop實看。 Pending: 每小時/日期/時段切換; event索引/對照連結/RSS/折疊展開; keyboardfocus; 空/載入/錯誤state; notes展開
- 013: PASS（所見正常專題列表） — 昨天1、本週24及更早95個資料有標題、更新、來源/摘要與圖片。手機46媒體折疊列與keyword自然換行，URL斷行未越界。無圖條目/灰色placeholder如實存在，不稱所有圖loaded。 Pending: 搜尋/keyword/更多keyword/媒體/更新狀態操作; 原站與專題詳情; 缺圖原因; 空/載入/錯誤states; notes展開
- 024: PASS（所見正常匿名統計表） — 2日記者統計4092署名、24231有署名文章/35623署名欄位、35793已比對，3000匹配與顯示更多可見；深色表頭/媒體/百分比/中段0.0%可讀。手機controls換行與table局部橫捲，未見整頁overflow。actual /byline/ 以sameinterface呈現，不造redirect。 Pending: 種類/期間/搜尋/媒體/排序/百分比/進階/詳細欄位; 顯示更多及手機其餘欄位; 空/載入/錯誤states; keyboardfocus; notes展開
- 036: PASS（所見正常匿名統計表） — 2日記者統計4092署名、24231有署名文章/35623署名欄位、35793已比對，3000匹配與顯示更多可見；深色表頭/媒體/百分比/中段0.0%可讀。手機controls換行與table局部橫捲，未見整頁overflow。actual /journalist/，獨立看本route原圖。 Pending: 種類/期間/搜尋/媒體/排序/百分比/進階/詳細欄位; 顯示更多及手機其餘欄位; 空/載入/錯誤states; keyboardfocus; notes展開

Network recomputed: `{"requests": 1168, "requestDNT1": 1168, "requestGoogleURL": 0, "HAR": 1168, "harDNT1": 1168, "harGoogleURL": 0, "harStatuses": {"200": 1129, "-1": 36, "404": 3}, "transportEvents": {"denied-http": 2, "denied-connect": 128, "admitted-connect": 6}, "googleBackgroundCONNECTDenied": 70, "nativeGPC": null, "webdriver": true, "limits": "本輪HAR/request/host-admission證據非TLS封包或GA收件，-1/404不當資源全成功"}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/005-1280-light-viewport.png` — `26c6446f352ddbdd62efc5a8c3f3efdce1450d44c0ddc2beec944ae33f985856`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/005-1280-light-full.png` — `2c026a4efde129f90b40abaa159059c5b15b9d2ea18491b6f6780e2a31b97161`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/005-1280-dark-viewport.png` — `6c7f990ed0dc3593fc0ee62273c947d6ae8eaefcabf4b7447d72c7303bbf58a7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/005-1280-dark-full.png` — `bb3ee4f7802f4f84351410b56d243998759adeb318708992c3b7604f4a487309`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/013-1280-light-viewport.png` — `bd2d884718189a793d092c186c7b837fab2b2002d568b13584477ef17dc18b8e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/013-1280-light-full.png` — `6cf7042d8a3edf1aea013ad4295d6507e9c79fefd9b928e3acbafaed140ae83b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/013-1280-dark-viewport.png` — `a15b3097273ea6bdd24db788142d555e646e5db0b8d0c29dd7278a3e4d54fb58`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/013-1280-dark-full.png` — `f77ec2cb6063e035ca04cf2dc17c962184d151bdb25aeca12c26bd42f093e1ac`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/024-1280-light-viewport.png` — `7a9aff2e88c584cce75e76aca6f6614439cbf2332e4f3d9583622119bb44cee6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/024-1280-light-full.png` — `58cb3ab36c5da250f9d44250933e9a565a0c181bea17f66a0aae2eb8c30709c0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/024-1280-dark-viewport.png` — `9d9ec9d44be937b3bf0deda5b0d9cdbe7edcdb0915698178a420d0d3cedc1789`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/024-1280-dark-full.png` — `2e07ddb774117dac7e6b8444436c6c05563d552558eb94f79864ac445324e1cd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/036-1280-light-viewport.png` — `7a9aff2e88c584cce75e76aca6f6614439cbf2332e4f3d9583622119bb44cee6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/036-1280-light-full.png` — `58cb3ab36c5da250f9d44250933e9a565a0c181bea17f66a0aae2eb8c30709c0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/036-1280-dark-viewport.png` — `9d9ec9d44be937b3bf0deda5b0d9cdbe7edcdb0915698178a420d0d3cedc1789`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/036-1280-dark-full.png` — `0486c94fc18bbddeb9bf843e1f9f5e14f715d63e3d93564ff9383f85de6ae47a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/005-390-light-viewport.png` — `fd308ba7ac6f966c874dc1874a93668266a6f03631c41bd56602a9c470535a2d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/005-390-light-full.png` — `d8060211f8c300f822eefe82423c68f1091b3b61ae0703713c316efbbd8f519b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/005-390-dark-viewport.png` — `b118eb81d3c3ff6dce0247ab12e431877d105ff5bd97576e5b76668dfef59711`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/005-390-dark-full.png` — `50c22e33542d0aabf23a9de894ea9cb4e67f93c64c29c724f3b6f0d98f742c0e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/013-390-light-viewport.png` — `0fa7d1f0b037ff62a0aceb3a25c3ccdf00341bc7161776af9ca0c52d52f428a7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/013-390-light-full.png` — `a5324353cd625cff72ff5d3d98295440f9b60ac065d6c0b30891994f25e8e9a6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/013-390-dark-viewport.png` — `c62c343b30aa8bc0460a34dc03c8eac238c94bf70610fe3b8c85400df0a388dd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/013-390-dark-full.png` — `8dd999b4852b402fed41dfa480097575839a930099d01e7a93207107b4884533`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/024-390-light-viewport.png` — `9967b115b104caf1ffbabbdd308e79e02d2315c54f79e38bb6985417c2c2ed7a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/024-390-light-full.png` — `958368047a20dd3b7ea125d49b0bfc75f3500bf4f95fd8e21465beb393325b18`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/024-390-dark-viewport.png` — `dcd28da902a4dca7953c1e10eb2119b89b2bf52f3c780681a598304890d1f9e9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/024-390-dark-full.png` — `2903b062742ac5d6e706d14cfc7adeb455225876f72fd0d1a56d5d8f21331177`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/036-390-light-viewport.png` — `9967b115b104caf1ffbabbdd308e79e02d2315c54f79e38bb6985417c2c2ed7a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/036-390-light-full.png` — `ebbaecb58746b95915758ea4e31c9202885f9742c6a9bfe508c743a869a75a6b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/036-390-dark-viewport.png` — `dcd28da902a4dca7953c1e10eb2119b89b2bf52f3c780681a598304890d1f9e9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch003/036-390-dark-full.png` — `f92aa0c36730ec9d081b563475b0c9a35886c701b648ad280082f163977b62b7`

Actual fresh nine-row retry UTC00:43:45 all200/exit0, medians tag0.086/blog2.820/YT0.068, load3.66, /home48.74GiB, MemAvailable3.76GiB. Batch005 resumed only after this recovery; previous500 raw remains retained, cause unknown.

## Batch005 runtime gate exception

Admission fresh9all200 at00:43:45 passed, but monitor ended00:45:28 with blog median6.267938s >6.17s (all200; load6.05). Owner delayed acting until00:46:34; capture had already ended 2026-10-15T00:46:23.317Z with32PNG, so no browser PID was actually stopped. No all-runtime-gates PASS claim, no further capture started. Raw monitor and manual-stop receipts retained in current private root; finished DNT/Google/network/image facts may be reviewed separately from this resource-protocol exception. Next manual monitor probes will be awaited immediately rather than left pending while other work proceeds.

Offline capture pacing adjustment: scroll discovery90→350ms per650px, leaving transport, nativeDNT, GET/HEAD and version checks unchanged. This reduces discovery bursts and gives lazy images more time; it does not prove a cause for blog500/latency or certify resource completeness. No new screenshot yet; next batch still requires fresh gates.

## batch004 — actual independent production review

/root/f1_frontend_independent_sol, gpt-6.1-sol (existing independent non-author instance), UTC2026-10-15T00:52:43.144794+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004-independent-ui-review.json` SHA256 `e7f3153080c4d82fc8ca86d44a6314643caaa1994f456d9a356f277b180594fa`, same-nameTXT has actual image/view timestamps. Verdict: PARTIAL：所見027/034/046正常布局範圍PASS；038desktop修正指定pixelPASS，mobile/fullscopepending；無新增確證blocking但不給完整route/allstatesPASS.

- 027: PASS（所見正常首屏/nativecrop布局，無新增確證blocking）；fullscope pending — 實際見新聞爬蟲tabs/title、近7日271刊登媒體/247至少一篇摘要、08:37更新、297/297来源、search與抓取方式/工具/收錄内容chips、table首8列。error ratios與近24h無失敗是正常public資料，並非UI API-error狀態驗收。 實際見header、summary換行、297/297、chips多行、table只前媒體/執行頻率/累計欄，右側出fade。沒有整頁橫溢；並未horizontal scroll到error/tools等欄。 實際讀健康醫療網/TechCrunch/民生好報/Google新聞/FocusTaiwan/everylittle d等中段row。桌面period/nexttime/errors/抓取blue/toolpurplecapsules可讀；手機只初始table位置前欄可讀。 實際見末段未啟用來源/尚無執行紀錄等資料、notes收合與完整footer；未操作filter/sort/scroll/detail展開，不宣稱297row逐字全驗。 Pending: 操作/keyboardfocus/hover/theme或details點擊未驗; loading/空集合/APIerror/retry狀態未誘發; 匿名正常capture，登入/帳號/私有狀態未操作；publicroute不能推出其他authscopePASS; 全字AA/所有image completion未核；原件view/hash不代表所有長表逐字驗收; 297來源逐列/所有capture中間rows與手機橫捲右欄待驗; search與method/tool/contentfilter、sort、來源展開未操作
- 034: PASS（所見正常首屏/nativecrop布局，無新增確證blocking）；fullscope pending — 實際見groupdescription、1/7/30天7天selected、身份3欄cards，政治人物139/551、民進黨53/98、國民黨39/102與counts/▲▼/orangebars；smallmetadata與rows不疊。 實際見groupdescription多行、7天button、單欄政治人物/民進黨cards，數字/metadata/排名項皆可讀；無整頁overflow。 實際讀親民黨/議題/社會新聞人物/網紅等中段mobilecards；desktop前任公職/電視電影/評論名嘴/氣象/醫療健康/專家、藝人網紅、最近7天無標籤上新聞與主題大類過渡，small灰字可辨讀。 實際見體育/科技/健康醫療及動物無資料提示、notes/footer；mobilecrop尾只上一段無資料文字尾部+footer。此局部合法空是specificgroup提示，不代替全頁/APIempty/error驗收。 Pending: 操作/keyboardfocus/hover/theme或details點擊未驗; loading/空集合/APIerror/retry狀態未誘發; 匿名正常capture，登入/帳號/私有狀態未操作；publicroute不能推出其他authscopePASS; 全字AA/所有image completion未核；原件view/hash不代表所有長表逐字驗收; 所有group/topiccards逐native連續覆蓋待驗；僅首屏/中/底crop; 1/7/30天切換、groupnavigation/個群ranking操作、zero/same delta其他狀態未驗
- 038: PASS（正式desktop指定futureticks修正像素）；mobilecontrast/fullframes/操作 pending，非完整routePASS — 實際見simple full-screen板、綜合lens、1天/18h/12h/6h/現在timeline、keyword文字/人物caption/圖案與changebadges、ranking08:30、online0/today2537/clock08:39；圖案照片保留原材質，logo色不當普通字AA。 實際見portrait simplelayout、online0/ranking/clock08:40、人物caption、lens/ticks與keywords。ticks很小，不能依desktop測值宣告mobile AA；未操作taglinks/focus/播放鏡頭/prefs/fullmode。 本人nativecrop讀1天前、18小時前、12小時前、6小時前、現在。desktop實像素old8cf1.7754→productiondarkviewport4.5817/full5.4026；light7.2919。手機字形小且抗鋸齒無明確solidcore，darkstrongsampleviewport4.0243/full4.5176，只記raster follow-up，不作normativeAA PASS/FAIL或新blocker推論。 full PNG與viewport同尺寸，固定simple板沒有sitefooter為設計surface；已實際view兩種capturepath，不拿同尺寸當其他frames/fullmode驗完。 Pending: 操作/keyboardfocus/hover/theme或details點擊未驗; loading/空集合/APIerror/retry狀態未誘發; 匿名正常capture，登入/帳號/私有狀態未操作；publicroute不能推出其他authscopePASS; 全字AA/所有image completion未核；原件view/hash不代表所有長表逐字驗收; mobile timeline tinyglyph/trueink contrast與穩態重截待驗；目前nativepixels不是solidcoreAA判據; 全鏡頭/historyframes、播放時序、新舊字fade、hover/focus、prefs/fullboard/dailypending狀態各自待驗，不全局忽略; fullboardpulse/latest數字與waiting等未被defaultsimplecapture覆蓋
- 046: PASS（所見正常首屏/nativecrop布局，無新增確證blocking）；fullscope pending — 實際見sources入口redirect後媒體流量與排行、Similarweb/CloudflareRadar説明、search/月變化selected/2026-09、正增幅513.3/492.16/325.69等首列、domain/monthstats/taiwanshare/rank可讀；right最後欄有tablefade。 實際见media trafficmobiletools換行、月份分列、table媒體縮略/domainellipsis/10月與7天前欄與sparkline部分；rightvalues需橫捲未操作，並非整頁overflow。 實際讀FTNN/新浪/瘋先生/MSN/CTW/ETtoday/民視/CNN等負增幅與人工share、belowthreshold小字；light中段多favicon空、dark更多loaded，imagecomplete仍pending。mobile僅前欄names/domain/counts局部spark。 實際見Yahoo/Google新聞/動態網發現來源與缺值—，notes/footer；觀察URL為/media/traffic/?sort=traffic&dir=desc，不能拿這當原sources語意另一route已驗收。 Pending: 操作/keyboardfocus/hover/theme或details點擊未驗; loading/空集合/APIerror/retry狀態未誘發; 匿名正常capture，登入/帳號/私有狀態未操作；publicroute不能推出其他authscopePASS; 全字AA/所有image completion未核；原件view/hash不代表所有長表逐字驗收; search/month/viewvaluevschange/sort/taiwansharetooltip、手機rightscroll、統計幾何未操作; redirect入口與目的surface分開；未驗流量缺值/error不同routescope; imagecomplete與長表各中間row逐字pending

Network recomputed: `{"requests_total": 1556, "requests_dnt1": 1556, "browser_google_attempts": 0, "browser_flag_disagreements": 0, "request_domains": {"tag.observe.tw": 1548, "static.cloudflareinsights.com": 8}, "transport_events": {"denied-http": 2, "denied-connect": 104, "admitted-connect": 6}, "transport_google_denied": 100, "transport_google_admitted": 0, "transport_admitted_targets": {"tag.observe.tw:443": 6}, "har": [{"file": "network-1280.har", "entries": 794, "dnt1": 794, "google_attempts": 0, "google_success": 0, "status_counts": {"200": 663, "-1": 130, "308": 1}, "aborted_types": {"script": 4, "image": 126}, "failure_text_counts": {"net::ERR_BLOCKED_BY_CLIENT.Inspector": 4, "None": 126}, "failed_domains": {"static.cloudflareinsights.com": 4, "tag.observe.tw": 126}}, {"file": "network-390.har", "entries": 762, "dnt1": 762, "google_attempts": 0, "google_success": 0, "status_counts": {"200": 614, "-1": 147, "308": 1}, "aborted_types": {"script": 4, "image": 143}, "failure_text_counts": {"net::ERR_BLOCKED_BY_CLIENT.Inspector": 4, "None": 143}, "failed_domains": {"static.cloudflareinsights.com": 4, "tag.observe.tw": 143}}]}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/027-1280-light-viewport.png` — `b9af87f04d20daec009aafd09a2d4b7fede29b78f270e9881dc7be137b081e30`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/027-1280-light-full.png` — `4344da37aa8e31331f071ced3df5cbc840c0ea91c7b51d3a76c1877c7a671540`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/027-1280-dark-viewport.png` — `7bb8014f20e82e59f9bdfc18eb3d06e8825d32c717920c012a309bf8b3389630`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/027-1280-dark-full.png` — `fbb57fe204757857c71533e462028e9c79d38e41f6ae588c4b428ac711406aff`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/034-1280-light-viewport.png` — `bbaff2fa2c841c3e54621e7c3e423452c073e7afe2605933650df90a28dc6b89`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/034-1280-light-full.png` — `9729cdc434102954b074324b4707a6fa7cc43487dc746f1a55de203018de5f13`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/034-1280-dark-viewport.png` — `1e82e8008d87bdc4d6bdf250339ae9a94bb8ec25c4a0a025ceed48de19545113`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/034-1280-dark-full.png` — `fc86c683ea0722f725d558dd2b6204e4d720a45bda3abe4f9b2b7e632ef148a1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/038-1280-light-viewport.png` — `a27b5f6e407d727a9a4c855f2a4d9f9cd234941ef8a64e7b053388712c126395`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/038-1280-light-full.png` — `709132773d8b3323ad280fd218da3b593ff1ec34c3637e836e37d67694e47ffa`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/038-1280-dark-viewport.png` — `b79bda6f32b06c9242917914e88a0c221aef3eac7d3cbbec93eb43a21b7cda13`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/038-1280-dark-full.png` — `898db488a064ccc207a9a35ac71b1b52d97cc198faac71855eb3c4d18f2339ef`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/046-1280-light-viewport.png` — `0ba55133685a043b6c8512666f7b64ad68b1bd1d9010cdec64a46f6fd47af182`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/046-1280-light-full.png` — `678d2ec6a3d004860e23ec73553a30d891faecadba27cf56907ccfcdcfbf897c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/046-1280-dark-viewport.png` — `99a31d533c8cb21ca09b300258fa43cd398a5bdbfa7729bbf273e050dfd45f56`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/046-1280-dark-full.png` — `fbb08980a7f0c34f58959c6ad3a8ae390b584b02840819dfaa3eed6ccd1a16cf`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/027-390-light-viewport.png` — `d9f4aa4fd20f36b4450ed484ace29605a8b88831525d0915be450985f3441178`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/027-390-light-full.png` — `0d96a0733c6f951e5226e756d917c9360c521d6a629a88db231be7cdf6a83431`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/027-390-dark-viewport.png` — `a762e56901439e214a3e3e96f81e6112a88ebc12af1fd8ae3ccdb6407456e1c6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/027-390-dark-full.png` — `e2932536336a94a652578df5780994f79f44970aa45109d5da8e0d5895dfae2d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/034-390-light-viewport.png` — `fc44f455b97cf378b83548c846cd449faf848078929763f5dda972146aa4ee72`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/034-390-light-full.png` — `c34f533d673474ec639baa3aa6e0b2f8ad474285d41c3cc50eea110a5c80d016`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/034-390-dark-viewport.png` — `a0e80d5eb78cf4bf24b859a8e735b38b3b82ee9795df2510ffbb16df3c52c7fd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/034-390-dark-full.png` — `2c989a01c4d5499158e4f5b4c51aa0d9860dc7ce5dce0a9398737a7083a07c79`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/038-390-light-viewport.png` — `13d2832614339b4afcb60b9b44e936dcd3dad6c56591fc7afddb2230f02fd673`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/038-390-light-full.png` — `08c1bb364bc644d23d4910546d28bd82d6f44c52c1dbefefdfcf84ddaca49006`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/038-390-dark-viewport.png` — `f2a5cd177623941a1c92b280e2ab029dd5dcf93a3f609361e2a7790e0350180d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/038-390-dark-full.png` — `0b46c9c7c9bab35b8173cb7a07b6503b81c03437ab8f40d81b0e35c9089a5609`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/046-390-light-viewport.png` — `5ee0d2146eb1453c3a0a03fb06d86b7131d96ea6bebcd2cc685ba76d1415bedd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/046-390-light-full.png` — `41f850a3776d99664ba374f3f5277f364ce3eb4e22dacdff173788982662a56a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/046-390-dark-viewport.png` — `a5b3b4cb8b2d42b9eb7181c80ecfe6032e0302868be38cf67100c6a3cbe9dd8f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch004/046-390-dark-full.png` — `29edf6dcb2fbabd9170a8f2cc330fbc5fbf2efedda7bf4f850efed462b7664d5`

## batch005 — actual independent production review

/root/unfreeze_independent_review, GPT-6.1 Sol, UTC2026-10-15T00:53:54.912261+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005-independent-ui-review.json` SHA256 `5127dfac6f2688c5ed98df96974e3c309e2c4670c43817add10c0ce9a43a7434`, same-nameTXT has actual image/view timestamps. Verdict: 所見UI SCOPED PASS /060 desktop loaded PENDING；有runtime gate例外，不能總結all-gates-PASS.

- 057: PASS（所見正常graph/table；非全runtimegate PASS） — 48小時/30家graph與legend、媒體比較表正常載入；desktop35744 vs手機35702保留時間差。節點密集局部labels重疊，手機可見controls自然換行與局部表格橫捲，未見新增整頁overflow；未操作縮放/固定節點。 Pending: 密集graph每label/縮放/drag/選取; filters/進階/種類/比較/排序操作; empty/error/loading; 全字AA認證
- 058: PASS（所見擷取狀態資料） — actualURL /similarity/about/，實際擷取狀態，非泛用about文案。48h各媒體文章、可比較/比例、已比對/缺漏/待抓與總列有資料；可見0列次要字及orangebars、中段百分比可讀。手機table局部橫捲，其餘欄位沒操作。 Pending: sorting/媒體連結/橫捲更多欄位; 空/載入/錯誤; notes/鍵盤互動; 所有列每字AA
- 060: PARTIAL PASS（mobile loaded；desktop loading pending） — actualURL保持/similarity/reposts/，同每日轉載統計介面但沒有recordredirect，不造URL轉向。desktop明暗viewport/full只載入每日統計中；mobile明暗則234348比對篇數/170649相似配對/24337內文相同/19783來源引用、legend與曲線/柱圖及各媒體表正常呈現。不能拿mobile補成desktop loaded PASS；手機右側表格fade/裁切不是已操作全文讀取。 Pending: desktop loaded/legend/zero狀態; 90/365日/排序/百分比/圖表tooltip操作; 手機右側zero欄實際橫捲; 空/錯誤及根因查明; 完整日期每一天數據正確性
- 061: PASS（所見來源排行資料） — 78來源與來源地區、被註明篇數、媒体數/關係圖連結正常；未知地區与本期僅有來源/引用資料提示如實可讀。手機查詢controls換行、表格局部橫捲，未見新增版面阻擋。 Pending: 搜尋/地區/期間/查詢/關係圖連結操作; 空/錯誤/loading; 手機右側欄位; notes/鍵盤focus

Network recomputed: `{"requests": 1368, "requestDNT1": 1368, "requestGoogleURL": 0, "HAR": 1368, "harDNT1": 1368, "harGoogleURL": 0, "harStatuses": {"200": 961, "-1": 407}, "transportEvents": {"denied-http": 2, "denied-connect": 103, "admitted-connect": 6}, "googleBackgroundCONNECTDenied": 70, "nativeGPC": null, "webdriver": true, "dailyRequests": [{"url": "https://tag.observe.tw/api/v1/similarity/daily?from=2026-09-16&to=2026-10-15&threshold=0.65", "status": -1}, {"url": "https://tag.observe.tw/api/v1/similarity/daily?from=2026-09-16&to=2026-10-15&threshold=0.65", "status": 200}], "limits": "HAR/request/host-admission不是TLS封包或GA收件；-1不稱資源成功"}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/057-1280-light-viewport.png` — `a75b878591f4d743bae3b6a4309d39b79879c0582ea9403fd7df8c9461be8770`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/057-1280-light-full.png` — `44db8fc45dc6fafff22389a87b0e3214bd8e2f59ca62e9161b0c777eeec70532`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/057-1280-dark-viewport.png` — `65898066aa00a4b40cbeb6f68bcc5918618c68793435b7b84dae775e362182b7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/057-1280-dark-full.png` — `267c500031851114d8992b890e4d19c94cdffa6bf05e9dd8989cc2c3717a3500`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/058-1280-light-viewport.png` — `9377597c6ef9cf6f3dd63e7d04f2e12ab283b45b7c15a0fbc150dc01c8f8709c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/058-1280-light-full.png` — `b7f7d43588ba895f3b095579c68c68a9e2a3778dfe27a97674deee10b3e24bd6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/058-1280-dark-viewport.png` — `43181af8d77c9072cfba000155380262044c7c2001c4b85ac5b5dbd86e58939d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/058-1280-dark-full.png` — `7890ed9d3bacbdc60527a36d6f2957e08ee3f7c941c25a542593cd28c36744cc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/060-1280-light-viewport.png` — `5f739ee7991b12fca0f1cd5e3b2c0f45137b62730350f7bd58437625b58b2257`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/060-1280-light-full.png` — `2cd3eb397f1e2aec489b09499af9683d1516a23992772d2695b6ab8d3834b143`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/060-1280-dark-viewport.png` — `546035fccd717b2df543f1d4647efeec1fcea24d364e78a5185d96a3b963023c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/060-1280-dark-full.png` — `18e5db0031d8cc094b16f32bbc85284ecd841c869a26b9f9cb43a9ffd4bc1d66`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/061-1280-light-viewport.png` — `5f1b5b30543514f0bbf50426bd12773c69ba741829229b6c2465ba219b3350ab`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/061-1280-light-full.png` — `e87925fff7641425346f48e285dcacfe4c069284459ac6171e9c34d7980fb600`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/061-1280-dark-viewport.png` — `03f2b2a47ded35708e0a8ab96653546c11c448b2717c250cdeac878d393218e8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/061-1280-dark-full.png` — `a5534b1acf0646f0107427cd7c63c0c6502a13bd86f3c1b1f813d50c3d4c0228`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/057-390-light-viewport.png` — `97ce4e78b3e52ef49adc8eccfdbd3f06772c529f86cb5fa631aba3574713e887`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/057-390-light-full.png` — `d9e6cdb6dfb9891fca85683b81572d71fa1fce5177e04ec6543735fe3882e6a6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/057-390-dark-viewport.png` — `20e6d8883940bcfd8fd4f951b60744f7d81f106e284bbe09cda2eead419a39a3`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/057-390-dark-full.png` — `47fbd2c3e1448ef8bcff38c8a464b1c28c2c3d57995dc93b27c6fc0a0e405d41`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/058-390-light-viewport.png` — `7211a44063feebd8aebdb7309ce710038aeeb377d7d5b72d9c30f486a6bc0289`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/058-390-light-full.png` — `4d80698f4a6ff63332d4f6ce2676186ac302d14c5c352e573f58bf3176502ede`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/058-390-dark-viewport.png` — `60b2eaa59322c60a923e91a2df54787dea6d8d4eac638b9b87f674668b73fc2c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/058-390-dark-full.png` — `ae8bf0c2b82c3949580602c6ff90e64883c2bb35c4a1c53e648c83bf36137493`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/060-390-light-viewport.png` — `7d5b7b59670b6ac76e140fa003190f22a0442224bb0e3eee52053d50720540ed`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/060-390-light-full.png` — `a666228d2024fe288fff79a040903456827f749a0b64c11f98e58cec2f1fc930`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/060-390-dark-viewport.png` — `7bfda89c5404c15f0845a45047359a3b1bddbb615e1139c7159262fbad56f4b6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/060-390-dark-full.png` — `fa67ea6b31ac9c0d5bf7aa2043d1ea3bb51d3e6ed7e8c53dba0bcf4fbaf9cd4d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/061-390-light-viewport.png` — `dc585071f14ef0c8d99c5230988a6049534aa9a2a94d73ad0ba13ecff18dd5cc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/061-390-light-full.png` — `79653fd893b80aa2da120d49ad55325a0fe40268e10b31d2e392f8d0206c042e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/061-390-dark-viewport.png` — `ff40f5188f7b5fb08632e0c5650430a13c90d3cf360b6b67b94665a38e503f7d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch005/061-390-dark-full.png` — `74daf92bec4c4981cfc99da42ec1d18fa8806572a8b682b7503285660975af2b`

Batch006 reviewer report recorded: event1775/headlines bounded normal static presentation; 026 and031 actual308 redirects to ranking/category and event respectively, not independent route templates. Full states/interactions pending; no new blocker.

## batch006 — actual independent production review

/root/f1_frontend_independent_sol, gpt-6.1-sol, UTC2026-10-15T01:03:17.323559+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006-independent-ui-review.json` SHA256 `9b63f25b74ba32b507b7b9c3504dc61e8574599b90e1f32943af9b754a00965b`, same-nameTXT has actual image/view timestamps. Verdict: PARTIAL：已見正常配置無確認阻擋；fullScopePending.

- 006: PASS（僅已見靜態配置） — 事件1775標題、來源、標籤、報導卡、統計、時間圖、關鍵字條帶及部分長列/頁尾；手機卡片、圖表無已確認溢位。 Pending: 追蹤/收藏登入授權及結果; 每日/每小時切換、圖例分頁、tooltip、逐時表格橫向操作; 單標籤73篇展開; 全部230篇逐字與全部45媒體區段未驗; loading/空資料/API錯誤/重試未見
- 007: PASS（僅已見靜態配置） — 45媒體9/23/13家三組；桌面並欄、手機縱排；已勾選差異highlight及其他標題折疊提示，小字與底部裁切可辨。 Pending: Highlight關閉/開啟結果; 各媒體其他標題展開及鍵盤焦點; 45媒體全部逐字核對; loading/空資料/API錯誤未見
- 026: PASS（僅已見靜態配置） — 實際308導向ranking/?category=news；新聞媒體選中、500詞雲及初始50列，歷史不足/無變動符號、底部顯示更多可見；手機只有表格左端已驗。 Pending: 篩選/排序/正在發酵切換; 顯示更多500列與表格右端橫向操作; loading/空篩選/API錯誤恢復; 全部詞雲及列逐字/每色對比未驗
- 031: PASS（僅已見靜態配置） — 實際308導向/event/當日事件表，非獨立archive畫面；今日10/15選中、64事件、首卡與中段/末段包括零分列；手機索引收合。 Pending: 历史日期/dateinput/前後日/每小時切換; 手機日期橫向與事件索引展開; 所有64事件逐字、sparklines互動; loading/無事件日期/API錯誤恢復; 每日pending仍待操作，不能全局忽略

Network recomputed: `{"requests": 1318, "dnt": {"1": 1318}, "googleBrowserRequests": 0, "googleFlagMismatch": 0, "har": [{"width": 1280, "entries": 664, "dnt": {"1": 664}, "googleRequests": 0, "googleSuccessful": 0, "status": {"200": 654, "-1": 5, "404": 3, "308": 2}, "unsuccessfulResources": [{"type": "script", "failureText": "net::ERR_BLOCKED_BY_CLIENT.Inspector", "count": 4}, {"type": "fetch", "failureText": null, "count": 1}], "redirects": [{"url": "https://tag.observe.tw/cat/news/", "status": 308, "to": "https://tag.observe.tw/ranking/?category=news"}, {"url": "https://tag.observe.tw/event/archive/", "status": 308, "to": "https://tag.observe.tw/event/"}]}, {"width": 390, "entries": 654, "dnt": {"1": 654}, "googleRequests": 0, "googleSuccessful": 0, "status": {"200": 647, "-1": 4, "404": 1, "308": 2}, "unsuccessfulResources": [{"type": "script", "failureText": "net::ERR_BLOCKED_BY_CLIENT.Inspector", "count": 4}], "redirects": [{"url": "https://tag.observe.tw/cat/news/", "status": 308, "to": "https://tag.observe.tw/ranking/?category=news"}, {"url": "https://tag.observe.tw/event/archive/", "status": 308, "to": "https://tag.observe.tw/event/"}]}], "transportEvents": {"denied-http": 2, "denied-connect": 100, "admitted-connect": 6}, "googleTransportDenied": 96, "googleTransportAdmitted": 0, "admittedTargets": {"tag.observe.tw:443": 6}, "limitations": "Google 瀏覽器請求 0 與背景 Google CONNECT 被拒不同；不是全域嘗試 0，也非 TLS 封包稽核。status -1 圖片無 failureText 不能判定原因或成功。"}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/006-1280-light-viewport.png` — `b6508ae794a476295860989063701708b6b01179d100f94718fb66f7b4a41080`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/006-1280-light-full.png` — `363bcffdbb5154b1a4da6ed51fa6f92b942df7e1368902eeabcd272096d95a12`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/006-1280-dark-viewport.png` — `8da85521a0a444ec2da4fdb573496eb6e645f65add527f582c8c3d8e41865dd8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/006-1280-dark-full.png` — `9c9b3ee2ca3b5c7deececf36c0261f30008d45078ad609e242226c2c31312659`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/007-1280-light-viewport.png` — `148ed5b8137d5c965df7fbd416aff11e9d9f78e7ff6bdf28019272066520d021`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/007-1280-light-full.png` — `b126caf6f7e5d32c79d2f1c1ce12cecf5245b1b2dacaa2bce0b9fe6cd0ed239d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/007-1280-dark-viewport.png` — `3b9d34ea4539a92b9a97ed9fdeb9f5c050d29eaab9befed583b8f39725e7dcb4`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/007-1280-dark-full.png` — `9f3556df43c6e3efb8f8d19f7bcc45b11b0300c8c55e1c141bd32a385f63a46c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/026-1280-light-viewport.png` — `ef74cd0340fd2d65b07992ce63cc8f9527415169718540abecc6451607d4273e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/026-1280-light-full.png` — `6cf7b60458a09664e85402e8d52cbccfa1c3c9b71095ffe1b52d90909cb4a58f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/026-1280-dark-viewport.png` — `1f0c79b2259639b675f4ef474dcd6b48c89b9c19ffff25724e5ab07240041918`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/026-1280-dark-full.png` — `ffa0cae0c34b0379ea7a10185e6363912fbc57a32b0b9d22206d53cb8c0ec287`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/031-1280-light-viewport.png` — `902e22042769eeed1fbe3621475a7054394b460d74da2602b1522f60f257ab7a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/031-1280-light-full.png` — `73d3d59a35b41430d92a67d240aafdc691c65037d1bc6c4970efdd06e0f7df9b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/031-1280-dark-viewport.png` — `23a13f9789e61f4d0f77367f0b0f765f35c89896f875fac32bbe33a6b975e776`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/031-1280-dark-full.png` — `b93f75d1da612d4238aff23a4915fa27028a158aff237aa34e4a5f05479357dd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/006-390-light-viewport.png` — `a5832868114376e373d0f60667ad521dd4d28152108b91772b120d58773c90bd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/006-390-light-full.png` — `b4ee7e29d543ec39a805b3ee55f1fe932649081703d19db065a8c6522c7be864`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/006-390-dark-viewport.png` — `115df6cb29a93d86753423e8100c42c88f9a5fdaad91921f51e64c2a18b06dbd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/006-390-dark-full.png` — `5d9dfee3899b5cb9ce38a5b59e52d8a47dde57d9fd175fbc160933a01ef5a87b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/007-390-light-viewport.png` — `03f2528056ac9d2994b325d1a445575e607084a61ce0097734b4e7ec1244a3ba`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/007-390-light-full.png` — `c3aa3db3ea38238a816f3fabf75cbd42b3d3d73529fd8a894fe0da040e40ee8c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/007-390-dark-viewport.png` — `880d10e312f323706c4caf83f5ec4aadc87cc00fbbc69d50b805a1433024b768`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/007-390-dark-full.png` — `aaec05f3f0e00b93a51e2ad208ab97bc27f726ef538b966f3e4b4ce86a251be6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/026-390-light-viewport.png` — `55004e4c2839caf0daa16707ee88b00dde65b3212ff391fa6fdd05a9a14f8f12`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/026-390-light-full.png` — `9c87dc0ae28e3c861a5b613f0a49541e45d4d1fa99288740309d3377c374ae2b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/026-390-dark-viewport.png` — `aee937e15a907055a1fd202d6a27a1037ce50419dc78034ef3f0fb9b17d2d9ea`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/026-390-dark-full.png` — `a4465c121b419a175f4b8ffaed157c134eeedb08dd7134b99d52af290045ea77`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/031-390-light-viewport.png` — `f0d686ce652b8ff03d69b37abe901a163940831f0b40ab2b802bba7493f49dbb`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/031-390-light-full.png` — `20a6aa47b03ce08137c80f7268e6f10295685947f5f5e529110f60c87bee44a1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/031-390-dark-viewport.png` — `88d18679326654244da44c568d3abb87d69973cce073a9d6b970a259ebba1b29`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch006/031-390-dark-full.png` — `e7c3f2a6c00e5f76e5a00777862676b8be859703849d1c756f26218433f4aa06`

Batch006 actual formal review recorded: event1775/headlines normal bounded presentation; `/cat/news/` redirects 308 to ranking category and `/event/archive/` redirects 308 to `/event/`, so those are not independent templates. Missing interaction/auth/loading/error/full-list states remain pending. Reviewer report retained with actual 32-image hashes and raw network.

Batch008 partial capture: capture-public exited nonzero at screenshot font wait timeout after 9 shots/5 pages; `batch008-partial-receipt.json` and raw manifest remain. It is not submitted for review or counted as route PASS; no retry started.

## batch007 — actual independent production review

/root/unfreeze_independent_review, GPT-6.1 Sol, UTC2026-10-15T01:06:31.367515+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007-independent-ui-review.json` SHA256 `c58ea52598c5895da45de9cf737bec20f2b42d85f9ce41e5b1b32f191046ce58`, same-nameTXT has actual image/view timestamps. Verdict: PASS（四頁所見狀態範圍）.

- 032: PASS（feature list） — 三立新聞網專題頁34筆，來源／更新／圖片／摘要與相關媒體可讀，手機自然單欄。 Pending: 點擊、搜尋、空錯誤、更多互動
- 033: PASS（feature article） — 股市瘋AI熱文章含摘要、主圖、未取得正文提示及8篇專題相關新聞，所見暗色可讀。 Pending: 正文原文、收藏回報、互動
- 062: PASS（topic list） — Newtalk近期84筆議題，來源、更新、標籤、圖片與摘要正常，手機換行。 Pending: 搜尋、空錯誤、詳情互動
- 063: PASS（topic article list） — Newtalk議題19有100篇議題新聞，圖片、日期、標籤與摘要可讀。 Pending: 摘要展開、搜尋、空錯誤、詳情互動

Network recomputed: `{"requests": 1037, "requestDNT1": 1037, "requestGoogleURL": 0, "HAR": 1037, "harDNT1": 1037, "harGoogleURL": 0, "status": {"200": 1004, "-1": 27, "504": 5, "500": 1}, "transport": {"denied-http": 2, "denied-connect": 81, "admitted-connect": 6}, "googleDenied": 71}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/032-1280-light-viewport.png` — `c2a6662f793b9f6eb723a2c215026d795e91f1924281a8b27841d554564de2f8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/032-1280-light-full.png` — `274b870d6d8f8da3e9de4f9f6030f8dacc21ce11cfdef4e3a086172141d4c46d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/032-1280-dark-viewport.png` — `e943382b8d6376937eaf8f8cdff4b0a4477e107756083c59939ba0ff63aedb99`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/032-1280-dark-full.png` — `5eebb850a7019ecf3114bade242a057b2dbfa9422b6b3fd9ee1517774978fcee`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/033-1280-light-viewport.png` — `38fa39eb4c580d98ef42e1c7b6b112e3af2dbb009173f3c4d5b19ab1e77d1d8b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/033-1280-light-full.png` — `a0c1e3a91de2c9ea8b2989e06f4c4c0150d3ba367bca3b802c28e619d38f9a02`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/033-1280-dark-viewport.png` — `3476ed5f3456fb7ea9ff32bcbc288e5080a3e68cb6a3f81cf70c72faeabe612c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/033-1280-dark-full.png` — `f76dbba6bc6cba1853e58abe1ae2837e2e5b0e248f28570de1ca332cefb214a5`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/062-1280-light-viewport.png` — `0e4a90d26c32bb23941682558ef9ccf0f642ea2850a8cc844178855340c76b07`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/062-1280-light-full.png` — `277b0b0bca3fcc46d85a22c31ea364d28d60de00860de975f4871fd975a712a3`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/062-1280-dark-viewport.png` — `fd154477b7667b260b366036f0b8783476ef588cf8b2999b9f9f54770ed49725`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/062-1280-dark-full.png` — `9599c71e33acfe73fa856b1fc54970fe596c1b4f6c9e2b4c9e41fab125be2b56`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/063-1280-light-viewport.png` — `9dc8252ce6578d149468b095dd24adb711ce04961e89fe29ecf7c7dbd03825be`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/063-1280-light-full.png` — `0a29f8196b2fb96a5de3ff800ed02f1ab582023e8b630e60ce44b24b6b930dd7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/063-1280-dark-viewport.png` — `8df702eeb5f00f2e94fc4ad176598f751e18948ed62a8036ed5cec70c9c3d69f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/063-1280-dark-full.png` — `c1a595bf71c6e2d1ad751d54e1e0cec37febd3aa50b7043e54878e0a3eb5338d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/032-390-light-viewport.png` — `92df0ab213510b7541d0aef06b4b240c0a188d14627cefcd5ad4094bad466331`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/032-390-light-full.png` — `e9cd51cff24989011050d95d317395e4a4c0a155e6c008f6d77193049b0f324a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/032-390-dark-viewport.png` — `fdcfedaa308382e038d646c17e4d30ef94f901e64aa9263ce22938cde976d023`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/032-390-dark-full.png` — `a32d0a6051e1f5d84d6a01e7183a3d00c9c0dc82fb217ce35f7d79b0b89e7d2b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/033-390-light-viewport.png` — `f2f4b1366f6edbf38dbc3f7f4b288ec2fd5b1563e52e54c579cbdb49239337de`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/033-390-light-full.png` — `6d90692027d8755db8bf7af343a87a12ac22ae6f2814ae437f9c1ce43b0efcd8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/033-390-dark-viewport.png` — `a1a8bc7c377a506f3ff87c560367acf55a66b8d7e941012409d54c6b53fbf10c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/033-390-dark-full.png` — `c05889ca9ad1b218bb039f0306ac70a15d62daa81c9cb680334e4c4533513995`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/062-390-light-viewport.png` — `d05529ff7a4ee0f43828c31464fe3b1415eee0444d334a3106c5d6a08c1a66c5`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/062-390-light-full.png` — `387d7d205abf3d4df04c9a7f81cff643df590e32f2ffb0ea20abd176c722b04e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/062-390-dark-viewport.png` — `01d85d8a124da585806d84f54a82a5d516364d07c9d35f51c3a67433d118afe1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/062-390-dark-full.png` — `24e6de454de6ef989da94227481cb5e07b8b6df0562e27a7af14a8af55aa38b8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/063-390-light-viewport.png` — `6447b4ba92731275ae47e6f4bab75bf766c6457cc804287236a34213ff07106b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/063-390-light-full.png` — `97e03d8e5541783308195f20f4bf5f8a11c183f0eedea894ca1832cab9cc07c9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/063-390-dark-viewport.png` — `e84c955d1c8894941396096298d05314e3bff458d10b938d1002ac5fe52d0a43`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch007/063-390-dark-full.png` — `84a956b2d424ec822054db45db67ad39b6176b13abec84a781bc5158b0c947fc`

Batch007 actual formal review recorded: SETN routes032/033 and Newtalk062/063 have normal observed presentation PASS, no layout blocker; search/details/empty/error/interaction pending. Reviewer retained HAR with 5x504 and 1x500 resources despite successful page captures; this does not establish route-wide failure or a root cause.

Batch009 capture completed 32 original PNGs (routes 030/009/023/055), DNT1, browser Google 0, proxy admitted Google 0; independent review pending. Fresh/monitor gate remained within limits.

## batch009 — actual independent production review

/root/f1_frontend_independent_sol, gpt-6.1-sol, UTC2026-10-15T01:13:56.353488+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009-independent-ui-review.json` SHA256 `d2a2e35286e4a8e7a672020abdb2d8758028e13afde6934e21fca309125135a0`, same-nameTXT has actual image/view timestamps. Verdict: PARTIAL / fullScopePending.

- 043: PASS（靜態已見） — 媒體收錄頁（匯流新聞網）正常；收錄文章、關鍵字雲、側欄統計及手機折疊可見。 Pending: 追蹤、分頁、搜尋、摘要切換、全部60篇逐字、錯誤/空資料/重試
- 044: PASS（靜態已見） — 關係圖來源/引用頁正常；30篇被引用、0篇引用其他來源、來源說明及長列可見。 Pending: 兩個說明按鈕、關係圖導向、分頁/長列逐字、錯誤/空資料
- 045: PASS（靜態已見） — 新聞爬蟲公開牌正常；297/297來源、工具與錯誤計數表可見，手機表格橫向內容未全見。 Pending: 搜尋、排序、工具操作、所有來源逐列、爬蟲狀態切換、錯誤恢復
- 047: PASS（靜態已見） — 媒體流量與排名正常；月變化/數值切換、2026/09及桌面完整表格可見，手機僅左側欄位。 Pending: 月份/數值切換、搜尋、排序、橫向欄位、全部長列、錯誤/空資料

Network recomputed: `{"requests": 1619, "dnt": {"1": 1619}, "googleBrowserRequests": 0, "transport": {"denied-http": 2, "denied-connect": 124, "admitted-connect": 6}, "googleDenied": 0, "googleAdmitted": 0, "har": [{"width": 1280, "entries": 823, "dnt": {"1": 823}, "google": 0, "status": {"307": 1, "200": 800, "-1": 21, "308": 1}, "redirects": [{"url": "https://tag.observe.tw/media/cnews/articles/", "status": 307, "to": "https://tag.observe.tw/media/cnews/"}, {"url": "https://tag.observe.tw/media/crawlers/", "status": 308, "to": "https://tag.observe.tw/crawlers/"}]}, {"width": 390, "entries": 796, "dnt": {"1": 796}, "google": 0, "status": {"307": 1, "200": 730, "-1": 64, "308": 1}, "redirects": [{"url": "https://tag.observe.tw/media/cnews/articles/", "status": 307, "to": "https://tag.observe.tw/media/cnews/"}, {"url": "https://tag.observe.tw/media/crawlers/", "status": 308, "to": "https://tag.observe.tw/crawlers/"}]}]}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/043-1280-light-viewport.png` — `b8d601b18a50a0458e6ad88635088867fea6852597001fe08597ac07e8ec0d80`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/043-1280-light-full.png` — `4b8061cac0fe440805282d7dfa1486546a025c5e3120b60f75a5aa3775023f9d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/043-1280-dark-viewport.png` — `2ebc85632bd757ee69d5174448329f4def899e49cb2e9f001b737ebfb216fb24`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/043-1280-dark-full.png` — `21670a56e183f41be31af8c3536b01374c710e264b940e33115a1c5b67163b30`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/044-1280-light-viewport.png` — `68f1314643be45f5a2937b03b19df806fba2a16bcadf1bb418d5ac2e29ccb685`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/044-1280-light-full.png` — `ecc35ad6e644c1cf406ccf43f8c7b8b424329848363a82fe1845f4e251f8bda6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/044-1280-dark-viewport.png` — `6100d7e9e23ca144b5c419d021aeaa4ea2102abdc061322922721309498f6e98`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/044-1280-dark-full.png` — `a9ed504c64b704319660012fdc6de12e9c2dfe5b4ba75a772305b4a7d9922402`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/045-1280-light-viewport.png` — `ba229dae859be57c17f6b25d4a0ad236bd28cd8a1f13555bda4efaf827b28cdd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/045-1280-light-full.png` — `6acc9b0b7961657b2e7a2c443fc5f234d8f32f89dbc1b0ea0caaea0c63feb67b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/045-1280-dark-viewport.png` — `999f1806214669451eeb6aba1897fe6f8cac5e777a70494ae62c714546ec9af2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/045-1280-dark-full.png` — `3afa892c44f4dec3be8a952927d4a17111e1e7df5f14b59a6f60ff104c3bfaf4`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/047-1280-light-viewport.png` — `ac7478e9acc3952feff707e29f8cab81daf6e20cd764406bde79b6638a57cb79`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/047-1280-light-full.png` — `066586a4e0fb160da40b9fd0ca34ec86d5b3f104aa629eb5de67b053092a74b2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/047-1280-dark-viewport.png` — `7ef6a8554f7e6a1f88834d63c22afc71b6d6784a17ffcea52732550703ed2287`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/047-1280-dark-full.png` — `5b11ba2ff619a6bf6748ea30801dc9296ce6428f7a22f391976ce2ce099cac78`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/043-390-light-viewport.png` — `e6759ad4f82b9800b61f586385ea36da4e52f714c8dd2f37341e973f329ff38a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/043-390-light-full.png` — `dfe9966ad8cff6112dadf8b0c31d9c9c832b8178b435b7dd5caf90cefe8f2d4a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/043-390-dark-viewport.png` — `11a6d181facbeae0f875892c6b8565bd463a51a4c6cc537166c85544df5bdac8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/043-390-dark-full.png` — `e5b47ac10c7a7a0229b1bd644cc67486537980c41a8f25c7c2b3e9aa84c26fbf`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/044-390-light-viewport.png` — `ad96c3fa8dc85d86b52b4614874e80e9595ac5c7d0b5df7fee16e8634d7ed320`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/044-390-light-full.png` — `39564abe4d9fa82da5e3e5ff6374f89432e9e9df7feb59c17016ff7ca74dd187`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/044-390-dark-viewport.png` — `c17518106dd40ff86a12c5117b7369bccf8d509606fdb10c28bc53a9cd2ba6e0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/044-390-dark-full.png` — `28161eebab7d9108c852e8c9a1c39da6d269adb6bb25434eb5382ab04bed641e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/045-390-light-viewport.png` — `74055a447a33b714c4811939c0cca3026c983423d60e890f580b35e2ca54c2ee`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/045-390-light-full.png` — `bd87fc7b0517273f7108cc0bd507e5e33550ccb2c3118b855566ec52812f0891`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/045-390-dark-viewport.png` — `fab38061bf996bcc5e5f82a38b4cced59d38203f643424aa4d1bd14c01d0aac0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/045-390-dark-full.png` — `76b3eec80ffaab71c09a614e7e0c5e149543e38dfc42d2622199b0cc255aaf8a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/047-390-light-viewport.png` — `b76e64410b87ffc1fcb4e0af69c39630a6ea21d9b7db7fa54267bef53a1adb24`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/047-390-light-full.png` — `e17895289e446e51d0c5b9df03a79d1557a1f2cba2a9a1baa4c2d95e32c8d90f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/047-390-dark-viewport.png` — `e4842626abaf1af7645151b5ee0762ca70ecdefaab9d0b8459c146f54f2f499a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch009/047-390-dark-full.png` — `b60f2a80167cae32c0dbcf0590df09fc5b01745efc0ada02aeca6585cc054ef1`

Batch009 actual manifest/review recorded as routes043/044/045/047 (media subpages), despite the planned input filename. Redirects 307/308 and actual URLs are retained; 32 observed routes total. Interactive/search/sort/date/error/empty states pending.
Batch010 capture completed 32 original PNGs with browser/transport Google 0; independent review pending.

## batch010 — actual independent production review

/root/unfreeze_independent_review, GPT-6.1 Sol, UTC2026-10-15T01:21:11.842328+00:00. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010-independent-ui-review.json` SHA256 `3a668d3305d5935d9fb228faf68f458a1cdcade8262485e3ad1a50748745fcfd`, same-nameTXT has actual image/view timestamps. Verdict: PASS scoped.

- 048: PASS — 資料來源與摘要說明可讀 Pending: 互動、其他時間、空錯誤、full65
- 056: PASS — 網站觀測圖表與統計可讀 Pending: 互動、其他時間、空錯誤、full65
- 064: PASS — 轉述社群貼文比例與分類可讀 Pending: 互動、其他時間、空錯誤、full65
- 065: PASS — 標題用詞比例卡與媒體列表可讀 Pending: 互動、其他時間、空錯誤、full65

Network recomputed: `{"requests": 1185, "dnt": 1185, "google": 0, "transport": 94}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/048-1280-light-viewport.png` — `a6276a949849d27b9b13581aef53b7226c4f3268c6bb8cc34dbf0ef7603fdaaf`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/048-1280-light-full.png` — `3e530611d3b14ca527b7371a28253b48d0ecfddd827cefb88a48ecd62aadbf99`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/048-1280-dark-viewport.png` — `64ce682f573050bd82cf75830c700e11834b9339d411fac5c57648f99bde0542`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/048-1280-dark-full.png` — `31fac3a6d16e75c68fcdcef142f7e11d98e8f98ec6fc1c250c66799f56a85100`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/056-1280-light-viewport.png` — `b03b53aad7305c0a6a55a4d8c56c3b8428c691c18bc42a82b4a3fddd2cf03bad`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/056-1280-light-full.png` — `f3af0089f69737b3ee7787cf4b1dd0755b187f02bea78e3b0a42d4866e8238ea`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/056-1280-dark-viewport.png` — `024038a1dc4800192f39242bf584932a9d33ff27473aa9f980c2d316dd929aa8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/056-1280-dark-full.png` — `c6713565f7fd8aca987ee244535d89fb3d8e6129598f6e3c8c45def2d5a48782`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/064-1280-light-viewport.png` — `f44c77b9fa4b58e91e012a0576f7bd11def98e791e0a2d85c5080d2d8e79dfb5`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/064-1280-light-full.png` — `b2cb5ce0752948727d254838def7587a47c96c1023e977e85faed7367f000039`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/064-1280-dark-viewport.png` — `2eda631f8df8823a96333b5e5ed3a92d20690368bfc2d0fa72eb1390b2bda9b8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/064-1280-dark-full.png` — `ffb39252ac97770c383040a31b23e2d253e72b4154fddd833bbe6db21aa15dd2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/065-1280-light-viewport.png` — `28a98dba35cf2f4433f7b06dbe25d9d093625a4301e70a9396c284975972a8b2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/065-1280-light-full.png` — `7d585b4768092f30fe34d649a888ef34b965ca9aaba54f30527c854b52632d45`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/065-1280-dark-viewport.png` — `ae51ddb8026c01484d9e8370c689109718f8b1d294c1880795c9534cca912a91`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/065-1280-dark-full.png` — `d5e3e00ce7366674771991633467ff8691d113f72801d7607fa25982e6a789b3`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/048-390-light-viewport.png` — `226d0b8d4523949d7f1abd00ea9f6e807a376ba3df8baf2befbe23a080614a4e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/048-390-light-full.png` — `f312ad3ae2762c97e2aee5c209e7a1f31dff9b9ab8f3e2c27ca0258de03f5000`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/048-390-dark-viewport.png` — `0b0e0228bc09ee57e4744dc38048ad960bb7ad104d4790ff0e2b84b96d5c4733`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/048-390-dark-full.png` — `89d70dbae9577a28cf3851e66c9f2945306bcc477ff7b2312656f6e54799b61d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/056-390-light-viewport.png` — `216d80fb50e5ed269377190b369669ebfbbb45dc9b68a635caf6b4b94f2c4085`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/056-390-light-full.png` — `4550aa1f8a14aacef5588bc654d25c7f23c91e3415348ca682bc060a377f42af`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/056-390-dark-viewport.png` — `7e16564024869f1f8a305939e9ec7b13baa36004ccf27da6a4d9628f4d2e0a3a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/056-390-dark-full.png` — `ce0238748abf3a578077ce4d983a57b5506720a5c392c0c99e7d23d07f637497`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/064-390-light-viewport.png` — `7d4118f49cc38689204bca32b6673a35fd2aaa07bd6f5c7af6224aac94aeea7c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/064-390-light-full.png` — `25527ca2ffe93b822aa9d9ff9ea70aa324223722db35aeb08dbdaf00d0670ac0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/064-390-dark-viewport.png` — `48ca38dac898c8470d7a0e7ea43d7e78644765e6280b13a936dbefd36aadc0f8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/064-390-dark-full.png` — `458ed4ab21019a0e0c120b30d8972b404528769efee4da8ed43ac07f23eb415f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/065-390-light-viewport.png` — `6aa1ffe09634d3db39c0337acd471e8ce6f79e7bc432798cf6354413103ad9b5`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/065-390-light-full.png` — `3550f59eaef8ef0cc5363a168b3c02b43c9a54692eb01de755518e8d526fde7d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/065-390-dark-viewport.png` — `d94e5abdd62644c94becdfd38f34e1b136af1bc9095a33c5ac751a3238d0c372`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch010/065-390-dark-full.png` — `baacbf29aed5d60aeb9ca7477e26aaa362160a7220775b25a0f9affdb7048f48`

Batch010 actual formal review recorded: method/readers/writing/writing-titles bounded normal presentations PASS; interaction, alternate time/data, empty/error/auth states and full-route coverage remain pending.

## batch008 — actual independent production review

claude-subagent non-author (fresh context), claude-opus-5-5, UTC2026-10-15T09:35:50Z. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-independent-ui-review.json` SHA256 `06747db511ecafd79765f3cf0e92f688b9bb48a34919038630bc300985b8881b`, same-nameTXT has actual image/view timestamps. Verdict: ISSUES (037 方承業頁長 197k/284k px 為 blocking；025 署名語意矛盾、037 重複卡片與手機斷行、042 媒體關係載入失敗與無年份舊文日期為 minor；035 PASS).

- 025: ISSUES: 每列「原文署名：民間全民電視公司」下方又寫「未署名」，語意互相矛盾 — 標題、2 天期間篩選、媒體篩選（民視新聞網 897/901）、30 篇清單與「第 1 頁／下一頁」分頁在四種組合都正常；無水平溢出（scrollWidth=寬度），深色模式文字可讀。頁高 6441/7380px 合理。 Pending: 切換 24 小時/3/7/30 天與媒體篩選後的狀態; 第 2 頁以後; 展開「本頁的資料來源與計算方式」; 登入狀態 Issue[minor/1280/light]: 每篇文章都先顯示「原文署名：民間全民電視公司」，緊接一行「未署名」。在一個以該機構署名為主題的頁面上，讀者會覺得「到底有沒有署名」互相矛盾；應改成「未署名個人記者」或「僅機構署名」之類的說法。四種組合都相同。
- 035: PASS — 「政治人物」群組表格（標籤、名次、近 7 天篇數、前 7 天、增減，共 139 列）在 1280 與 390 都完整排在一行內，無溢出；390 欄寬緊但數字對齊、可讀。深色模式增減紅綠色對比足夠。頁尾正常。 Pending: 1 天/30 天切換; 欄位排序互動; 展開資料來源說明; 登入狀態
- 037: ISSUES: 頁面長達 197,224px（1280）/284,183px（390），署名文章清單幾乎無法到達 — 頁首（媒體列、期間、統計數字）、右欄常寫主題/比對篇數/關於這一頁，以及比對卡片的增刪標示在兩種主題都清楚可讀，無水平溢出。但「與其他媒體內文相近的文章」把 495 篇、1,180 組全部一次展開，20000px 截圖在 1280 只到 10/14 23:44、在 390 只到 10/15 03:56（7 天期間的不到一天）。 Pending: 24 小時/3/30 天期間; 展開「主題與比對篇數」（390）; 署名文章 501 篇區塊本身（超出 20000px 截圖範圍，未觀察）; 追蹤按鈕互動; 登入狀態 Issue[blocking/390/light]: 真實頁高 284,183px（約 337 個手機畫面），1280 也有 197,224px（約 246 個畫面）。相近文章區塊無分頁或「顯示更多」，第二個主要區塊「署名文章 501 篇」排在全部比對卡片之後，讀者實際上捲不到；也會拖慢手機載入與捲動。應預設只顯示前 N 組並提供分頁/展開，或把署名文章放到前面/分頁籤。 Issue[blocking/1280/light]: 同上，1280 寬度頁高 197,224px，20000px 處仍在 10/14 的比對卡片中，署名文章清單無法合理到達。 Issue[minor/1280/dark]: 同一則新聞（如「天空之舞傳媒認股權證…」「輝達 RTX 5080…」）以不同刊登媒體為主角重複成多張卡片，內容幾乎一樣，加劇頁面長度與閱讀負擔；可考慮依新聞合併。 Issue[minor/390/light]: 390 寬時「對方多 0 字」「對方多 81 字」常斷成「對方多 0」+ 下一行「字」；標題列「共 1,180」+ 下一行「組」，以及 meta 行以「・」開頭換行，數字與單位被拆開，閱讀不順。
- 042: ISSUES: 1280 側欄「媒體關係暫時無法取得」；最新收錄出現無年份的 10/27（實為舊文）與 7/2 舊文 — 媒體頁首、統計、報導關鍵字文字雲、最新收錄 60 篇（含原站網址與縮圖）、側欄媒體資料/寫法/Similarweb 流量在兩種主題正常；390 側欄收成「媒體資料、流量與媒體關係」摺疊列，無水平溢出，頁高 6685/10280px 合理。 Pending: 相關署名、來源／引用關係分頁; 1/3/7 天篩選與站內搜尋; 顯示摘要切換; 更早的文章分頁; 390 展開側欄摺疊; 登入狀態 Issue[minor/1280/light]: 右欄「媒體關係」卡片只顯示「媒體關係暫時無法取得，文章仍可正常瀏覽。」，屬於載入失敗的降級狀態，匿名讀者看到的是錯誤訊息而非內容（深淺色皆同）。 Issue[minor/1280/light]: 「最新收錄（依收錄順序）」第一頁末端混入 7/2、7/3 的舊文，以及一篇顯示「10/27 16:04」的文章（網址 252171027a01 看起來是 2017 年舊文）；日期不帶年份，在 10/15 看起來像未來日期，容易誤導。跨年份的日期應顯示年份。

Network recomputed: `{"requests": 1975, "requestDNT1": 1975, "requestGoogleURL": 0}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/025-1280-light-viewport.png` — `89f2f849f2f84e10d73d9a6bdb71b61ed57030d2b7740ee5004fd8a538a1d06f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/025-1280-light-full.png` — `6d5e88f78b7f365f2a3bb87d49148e2bb3786225b6514f9db60977f8669b3a1d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/025-1280-dark-viewport.png` — `3b16754df59b8cc1295e6ede371eb9b355bdcdc021df5ceb034dff5f30f5f307`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/025-1280-dark-full.png` — `75eac512a6a899554f40b4593a4e77cf3086888c32afebf4bba31d787ada71ce`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/035-1280-light-viewport.png` — `6c575e0a2fd9f058b0599e387cc229f12249c031f3cf3b4493b94711e13fdbfb`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/035-1280-light-full.png` — `48c5c63cc32e684315401ad1734de7bfa5e5cf48c561e2921b0da91f02061ac9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/035-1280-dark-viewport.png` — `75b165ab87831c3b5bb8ffec795efa20f36aa005e24c3f2a0e8e65bed5da43d6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/035-1280-dark-full.png` — `d141774fa4675c94c8ab4de86655d7ea63cee1301416c95861a3f888e479e83b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/037-1280-light-viewport.png` — `90f2927ec1ce49dd7372fe1c25819d6ad44ee8272b0890ce76b93da48e04a5f0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/037-1280-light-full.png` — `bc98b64edd936b5ebcaa50bb724000046fc3242730d28d275775721725008506`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/037-1280-dark-viewport.png` — `05ac4ea2da10f785045c474794cc7a7bf14af986506f3b4ac19f9f34079360c7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/037-1280-dark-full.png` — `e6ce99e11b9bb36876bb0cc6c5917eefaab4c67d60be0ad06252f13cfe90ed0d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/042-1280-light-viewport.png` — `1c920c29383bcc16a27d196ce2123cb049867824307fc962012e8a92b44478f6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/042-1280-light-full.png` — `600068d8fcdaa0035f13e2813f700e205f72cb71fb289156d1baa7ec85d05eef`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/042-1280-dark-viewport.png` — `6323774ec67f991f0701fd8f2c4a6135aa48b6105c79c70b2c650ecca19dc82f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/042-1280-dark-full.png` — `96b410017112e5d2749468833814d6661c1009e20a3d0b4c95f638172ca23206`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/025-390-light-viewport.png` — `5c734edf1c506757e019d1c3ca5a45853c55a609a21fc053c80beb1a16238bcb`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/025-390-light-full.png` — `08a69a9efde4089bfac2a8b4797b7e979c399125e346de62004a40c6c3554879`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/025-390-dark-viewport.png` — `686a2fe59717aad21c685ac368817a0972f652e03a6bf66b698b4795ad1ef55f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/025-390-dark-full.png` — `23572635a15be5d90b70ef82d129c572b3539f7b6a30d2b25615f0e057dec28d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/035-390-light-viewport.png` — `00fa35025d22793fde2dd31da66b7fbc1d586268bfb1aeddd9d703518365c299`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/035-390-light-full.png` — `db2dc2433734f8ca4290fb77158ff748b7ffeeffb0a131a69cee4e1ffcf11ff8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/035-390-dark-viewport.png` — `2e4b176b1b66bd925b0917fbb773a07ad39c180fa88a3708f98047d0e4d85fb8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/035-390-dark-full.png` — `3c1cef897f519ede4c13730050b9f883276939933e06f3269173d009599cfdb0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/037-390-light-viewport.png` — `4529fa030d23dbbc37a90aba2f36099882c6bc6a3d896cdf19e2df0c3202ee63`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/037-390-light-full.png` — `ef9a705e5f360c85c914ba954ef66799edbecec356a9d161c5cc193920ac210c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/037-390-dark-viewport.png` — `03ce5ad0421d271f6f79f4cf194aca698c45ede3b4e7727ad936d2ac2bd27f0b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/037-390-dark-full.png` — `1ad910ccd1e61032f59db952456e8196a0eb27eedfef7b2a6045625e309a318e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/042-390-light-viewport.png` — `0cf0f345dddab60fcae074fd0e7178094485fc996872a54f4a849b1e8265698d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/042-390-light-full.png` — `9e35ace9a9fe9b372c4f23f0f1d11d1e5ee26107f8fac72198ea2531d6fe121e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/042-390-dark-viewport.png` — `f3b846d5071404701fb69ba567854de8a56e01ec0d70f9bd1e2acc886a1a0327`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch008-r3/042-390-dark-full.png` — `f3f2d1053c266408fee6d789b17388ad45f61d17baecd49b839edeb8ceaf87e2`

## batch011 — actual independent production review

claude-subagent non-author (fresh context), claude-opus-5-5, UTC2026-10-15T10:18:39Z. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-independent-ui-review.json` SHA256 `2b39354a1ecc3c1598bbf6dfd3c8ec43d5d44b18dc304599a43ee9763bef67a5`, same-nameTXT has actual image/view timestamps. Verdict: ISSUES (沒有 blocking；4 條路由都有 minor：/api/ 端點一覽截斷與行動版過長、/api/status/ 390 斷行、/crawlers/traffic/ 390 Radar 欄在畫面外、首頁讀者關注重複「新文易數」；/demo/→/ 轉址合理。附註：manifest/input 的 apiSha 是 dc7b814e…，與指定的 API e2769539 不同).

- 021: ISSUES: 端點一覽連結截斷到無法辨識路徑；行動版極長且大綱不在前段；程式字串斷行在字中間 — 200，無轉址。1280 有右側「本頁大綱」，使用規則、快速開始、端點一覽與各端點參數表／curl 範例在亮暗模式都清楚可讀，沒有頁面層級橫向溢出（scrollWidth 1280/390）。全頁截圖在 20000px 截斷（實高 33865／49914），後段與頁尾未看到。 Pending: 實高 20000px 以下的章節與頁尾（全頁截圖被截斷）; 展開「回應欄位」; 「在瀏覽器開啟這個範例」連結; 登入後的 API 金鑰流程 Issue[minor/1280/dark]: 「端點一覽」兩欄連結被截斷得太短，例如「GET /api/v1/arti…」「GET /api/v1/li…」「GET /api/v1/media-r…」「GET /api/v1/tags/{t…」，只能靠旁邊的中文說明猜是哪個端點；亮色模式一樣。 Issue[minor/390/light]: 390 寬時端點一覽截斷更嚴重，有好幾列只剩「GET /api…」「GET /ap…」，完全看不出路徑；暗色模式（021-390-dark-full-part01）相同。 Issue[minor/390/light]: 行動版頁面高 49914px，頂部沒有大綱或跳轉；manifest 標題順序顯示「本頁大綱」排在所有章節之後，前 20000px 內也沒看到，所以手機讀者要捲很久才找得到特定端點。 Issue[minor/390/light]: 行內程式碼在字元中間斷行，例如「x-ratelim / it-remaining」「/ap / i/v1/tags/…/article / s」；1280 的右側大綱也一樣（「/vocabulary/snapsho / ts/current」「/similarity/evidenc / e」，見 021-1280-light-full-part00）。
- 022: ISSUES: 390 寬時端點路徑在字元中間斷行，留下 1～4 個字元的孤行 — 200，無轉址。API 與 Nearline 兩張卡片都顯示「正常」，下方是完整的端點用途表（1280 是三欄表格，390 改成卡片堆疊）。頁尾正常，亮暗模式都可讀。高度 3502／8122px。 Pending: 服務異常時的顯示; 「重新整理狀態」按鈕的互動; 以 Accept: application/json 取得的 JSON Issue[minor/390/light]: 端點路徑在任意字元處斷開，留下很短的孤行：「…/snapshots/curren」+「t」、「…/{id}/a」+「ctive」、「…/{id}/re」+「sults」；part01 有「/re」+「try」、「/fi」+「les/{role}」，part03 有「/coverag」+「e」。暗色模式相同。
- 028: ISSUES: 390 寬時 Cloudflare Radar 欄位完全在畫面外，唯一的捲動線索是被切掉的「202」 — 200，無轉址。上方兩張摘要卡（Similarweb 抓取完成 293/294；Cloudflare Radar 部分網域未能更新 293/294）、一個搜尋框，以及依 Similarweb 排序的 294 個網域表格；排在最前面的是「等待抓取」，「共用網域」BBC 在最後。1280 版面整齊，亮暗模式對比足夠。高度 16124／16565px，以全部網域列表來說合理。 Pending: 排序切換; 搜尋框篩選; 「本頁的資料來源與計算方式」展開; 抓取失敗的列狀態 Issue[minor/390/light]: 表格在 390 寬時只看得到「媒體」欄和 Similarweb 的狀態＋日期；Similarweb 的月份被切成「202」，Cloudflare Radar 整欄要在表格內橫向捲動才看得到，畫面上除了被切的字沒有任何捲動提示。暗色模式（028-390-dark-full-part00）相同。
- 029: ISSUES: 轉址到首頁是合理的；首頁「讀者關注」出現三筆「新文易數」 — /demo/ 轉址到 https://tag.observe.tw/（首頁，status 200），舊的展示頁導回首頁是合理的。首頁有字雲 hero、熱門關鍵字、焦點事件、藍綠溫差、同題不同標、新聞關係圖、最近更新的議題、24 小時新聞量與媒體 logo 牆，1280 三欄、390 單欄都沒有溢出，亮暗模式都可讀。高度 4379／約 9000px。 Pending: 字雲與卡片的 hover／觸控; 「顯示全部 211 家媒體」展開; 「本頁的資料來源與計算方式」展開; 登入後的狀態 Issue[minor/1280/light]: 「讀者關注」第 01、04 名是「新文易數｜標籤」，第 05 名是「新文易數｜事件」，網站自己的名字出現三次。看起來這些頁面的名稱退回成站名，而不是實際的標籤或事件名稱，讀者點不出內容。390 寬與暗色模式（029-390-light-full-part02、029-390-dark-full-part02）相同。 Issue[minor/390/light]: 390 寬「最近更新的議題」的媒體 favicon 單獨佔一行，媒體名稱掉到下一行，「篇相關」還被斷成「篇相 / 關」；焦點事件卡片的趨勢小圖也常常自成一行（例如 part00 的台視新聞網、FTNN）。暗色模式相同。

Network recomputed: `{"requests": 1068, "requestDNT1": 1068, "requestGoogleURL": 0}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/021-1280-light-viewport.png` — `a1a64899e3bc93ff48485a45ab7ee3d749f195a7fe80ac780fef34448c00029d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/021-1280-light-full.png` — `2773f05c21e822253fd7980ba989de807d58d1d0fbd0c38453da209e34c355fe`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/021-1280-dark-viewport.png` — `3f043dc1acb7b8743b9af29084f7e6d3f099544678161a7098ff60fd2c058585`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/021-1280-dark-full.png` — `99119dc87b25a3549dee1f5022df999637eca3d09fcad29d9f9ef6622b6535e9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/022-1280-light-viewport.png` — `a14db3bff85989b16b94bcaf9ea1bda006bce7c9c1936b6022d55532481d8410`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/022-1280-light-full.png` — `73394c1a269cf2af012a2c923ff8a400a93eceb3d2e08f77e4b4a3af2949c3a5`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/022-1280-dark-viewport.png` — `972afccc40eb2797c029c56d67d1b26828ff14ebe4b889a2e53bf9b8789ef179`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/022-1280-dark-full.png` — `19a6574d028960b5b721bf8447bd15f9c162e44188667c60391efd209e5ba77a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/028-1280-light-viewport.png` — `221ff4adde8a3407cadb93a53e58f1553d5db46d441e65a43db44dc050582956`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/028-1280-light-full.png` — `dc0e7fa811cb66e71ddf2c4ff725ddbddd359322f17df6754a78ef40f9320694`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/028-1280-dark-viewport.png` — `27c6bf1e21310247a439db3deeb1c4a67cf99d009531b172e49504609f431061`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/028-1280-dark-full.png` — `40d73b8a6f3d3794b26918afb8db371d741286f6a90efba1e99858fcf74ee2b1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/029-1280-light-viewport.png` — `3be48518c719214a2893daf1a538c6dcd9d7a3d38db9f3f7060fbbc8a373e3cd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/029-1280-light-full.png` — `42fd61b29b2848bbee238479977b0db3b4a459b2d55f177ef2a1d5b5fa7a7565`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/029-1280-dark-viewport.png` — `722d58662d1c2d980e368093707b8a92865f8fd7eb616b979929bc79f7d519a5`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/029-1280-dark-full.png` — `e84e9f6df0ac99a2f513953870968678702ea7188d9193cf67302722c782edf4`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/021-390-light-viewport.png` — `41fd71edfcfba20ff9a9468c3adfdf118d81db1bec2f26a0d3a2185e7abfb0fb`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/021-390-light-full.png` — `dd94aa746d61c47d96418e2e3d1935d98c820712e3fb926c303818cc3cce30c8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/021-390-dark-viewport.png` — `789460d832053a7c31438da602c5ed05f7a822a839aabc3c6eca323094b755c2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/021-390-dark-full.png` — `776bdb20f83d74cf6bee2498bcc0df88fff10b647669810962e43fbcd332c236`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/022-390-light-viewport.png` — `caf55788583ff7a207737f786bd3cfe3075a5444edc97577109ae25f2ad155d5`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/022-390-light-full.png` — `7ff1733f0db84a9b2ee7345b6782b59c18dc6be81c0c1958ef36a1e596f8ed03`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/022-390-dark-viewport.png` — `57d2f5923545a958c5d2feff51d09083dce70d229bcf06accbc028672ff86cb2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/022-390-dark-full.png` — `b576dbd323bf24ff6bdbd228450554ad2b5653d5c39b0eb8063ea3ba02812864`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/028-390-light-viewport.png` — `baa0fb6bfea01c7693145ceef3240ad8daf02dc07f4321c86fc4f48c2c26b734`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/028-390-light-full.png` — `2484fa4127e3b286e4509c85d65277029e6e74e6551362223b36130f3204e34f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/028-390-dark-viewport.png` — `cf685580d0c973e848ccfc1c19b76af5cbb6694f4af3f7a8922c49c74204f455`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/028-390-dark-full.png` — `1bf296cd584c43b483f58957bb9eb992468b1cf0081c3983010cd64b567a64a0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/029-390-light-viewport.png` — `5c07a99fac69e72c0ae0bc85c955d2818f982b0233d0c0b9d1e301e7915809d9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/029-390-light-full.png` — `06bcb161ae288e036e184d5343a8810542a092913400a20e629ca62812ee2cfc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/029-390-dark-viewport.png` — `f5aede8e2a0a49fcf1b85fd27d40b2b60d840dbfdd4d8a625dd67d2385950ecd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch011-r2/029-390-dark-full.png` — `d1016574ac894bdc6d2e65becc7fc386da8620890aa5471631ab615f3c068e36`

## batch012 — actual independent production review

claude-subagent non-author (fresh context), claude-opus-5-5, UTC2026-10-15T10:21:27Z. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012-independent-ui-review.json` SHA256 `18cf8563b4086b26194491993782e90e25b545e396276c772fd95fc63488aba5`, same-nameTXT has actual image/view timestamps. Verdict: ISSUES (4 條路由皆無 blocking；minor：首頁讀者關注重複列與 390 議題圖示斷行、文章頁各處 24h 統計不一致、進階查詢 390 按鈕斷字與知新聞標題混入內文、opt-out 按鈕文案含糊與 1280 頁尾舊統計).

- 030: ISSUES: 轉址到首頁合理；讀者關注重複出現兩列「新文易數·標籤」、390 議題列的媒體圖示單獨佔一行 — /demo/compare/ 轉址到首頁 https://tag.observe.tw/（200，scrollWidth 等於寬度，無橫向溢出）。首頁的文字雲、熱門關鍵字、焦點事件、藍綠溫差、同題不同標、新聞關係圖、最近更新的議題、媒體分布和頁尾，在 1280／390、淺色／深色下都完整顯示，沒有錯誤訊息或破圖。 Pending: 文字雲點擊／hover 卡片互動; 「顯示全部 211 家媒體」展開; 資料來源說明展開; 登入狀態 Issue[minor/390/light]: 「讀者關注」第 01 與第 04 列都是「新文易數 · 標籤」（22 次與 13 次瀏覽），第 05 列是「新文易數 · 事件」。兩列同名同類型、看不出差別，讀者無法分辨；1280 與深色版也一樣（030-1280-light-full-part01.png 頂端）。 Issue[minor/390/light]: 390 寬的「最近更新的議題」每列，媒體 favicon 自成一行，下方才是「TVBS新聞網 · 最後更新…」文字，圖示和名稱斷開、看起來像排版失誤；深色同（030-390-dark-full-part04.png）。1280 上圖示與文字在同一行，正常。
- 009: ISSUES: 轉址到 /article/ 合理；同為「過去 24 小時」的文章數與媒體數，在各處數字互相對不上 — /search/ 轉址到 /article/（最新文章，1 天）。頁面依序顯示主要事件大卡、6 張（390 為 3 張）次要事件卡、「所有文章」時間列表，側欄是全站統計與發稿最多的媒體，最後是「更早的文章」連結和頁尾。兩種寬度、兩種主題都沒有溢出、截字或破圖。 Pending: 切換 3／7／31 天; 側欄藍綠分布點選篩選; 「更早的文章」分頁; 登入狀態 Issue[minor/1280/light]: 側欄寫「全站過去 1 天 18,269 篇，來自 244 家媒體」，同頁頁尾寫「24 小時內 245 家媒體發稿」，首頁的「過去 24 小時新聞量」則是 8,440 篇，藍綠比例也完全不同（23/58/20 對 44/14/42）。三處都標成同一個時間窗，但數字不一致，畫面上也沒說明計算範圍的差別。
- 023: ISSUES: 390 的「查詢文章」按鈕與「清除條件」斷行成兩行；知新聞的標題混入導言／記者署名 — 進階查詢表單：1280 為三欄，390 為單欄。預設「最近 7 天」，顯示「符合 110,661 篇文章 · 依刊登時間排序」和當日列表，接著是「更早的文章」與頁尾。1280 版面整齊、無溢出。 Pending: 輸入條件後的查詢結果; 查無結果的空狀態; 錯誤或超過 31 天的提示; 媒體／來源下拉選單; 登入狀態 Issue[minor/390/light]: 390 寬時，送出按鈕斷成「查詢文／章」兩行，「清除條件」也斷成「清除條／件」，因為右側的說明文字把同一列擠窄了；深色同（023-390-dark-full-part00.png）。按鈕標籤不應從字中間斷開，可把說明文字移到下一行。 Issue[minor/1280/light]: 知新聞兩則的標題含有內文：「信義區週年慶大戰開打！…黃金大單成交 【記者劉沛妘／台北報導】新光三越台北信義新天地週…」，導言和記者署名被當成標題顯示並截斷；390 版同（023-390-light-full-part01.png）。
- 055: ISSUES: 狀態已是「不計入統計」，按鈕卻寫同一句、看不出按了會怎樣；1280 頁尾的今日統計是舊數字 — 頁面偵測到自動化瀏覽器，顯示「這個瀏覽器目前 · 不計入統計」，下面有橘色按鈕和四點說明，再來是資料來源說明與頁尾。內容很短（1280 高 1016px、390 高 1451px），沒有溢出或截字，深色對比也正常。 Pending: 一般（非自動化）瀏覽器的計入狀態; 按鈕點擊後的切換結果; Safari 情境; 登入狀態 Issue[minor/1280/light]: 目前狀態已是「不計入統計」，主要按鈕卻也寫「這個瀏覽器不計入統計」，讀者分不出按下後是維持、切換還是恢復計入；導言寫「關閉後…」，但頁面上看不到可「關閉」的開關。所有寬度與主題都一樣。 Issue[minor/1280/light]: 1280 頁尾顯示「今天已收錄 2,203 篇 · 24 小時內 227 家媒體發稿」，但一分鐘後擷取的 390 版（055-390-light-full-part00.png）和本批其他頁面都是 13,967 篇／245 家，可見此頁的頁尾統計是舊快取；深色 1280 同（055-1280-dark-full-part00.png）。

Network recomputed: `{"requests": 693, "requestDNT1": 693, "requestGoogleURL": 0}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/030-1280-light-viewport.png` — `da419ed7943ea1aa059b16289a6a3e31927e5f6b554a20180efd1996c8dd6b0b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/030-1280-light-full.png` — `178596ecf13600c536a6a01c0c8d502f42b4b28a55924415572b6f5b027b99d0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/030-1280-dark-viewport.png` — `97e68d3630cedf146f281062223337966645e2ed07a89bffbd718abbd4a25956`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/030-1280-dark-full.png` — `97763b44d6534b5c5e92944fc832ad1068c7a4fbe351da05a5d1e6ca9e7bf697`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/009-1280-light-viewport.png` — `7dd1396dc772d8ac452eace3a52acc512849ed4bfc9ddaca963cf4b28aa3e1b2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/009-1280-light-full.png` — `9f512e1fea9fa143368cdceca623a93d5bb358c28749ba24b81a0f3fbc625ed4`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/009-1280-dark-viewport.png` — `dd8492b39c2cf685f796514b387c03b67403c47ac8e5c8b93cabdb813435b04b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/009-1280-dark-full.png` — `eb048d59004f6597988e001cb3636fcf6f49e5af439210fec6523853f3a4322a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/023-1280-light-viewport.png` — `61cbf09bdedd5bdf30a80d91a4d759c15bf09b8da8b6cc75123598007c82ed17`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/023-1280-light-full.png` — `61577d043194c6ce039cf1001e158da4f2c71ff97861bf3dbb1a2016dd257867`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/023-1280-dark-viewport.png` — `8c77f17a971d934ef36231aca47988181f3bbb1d7a614de7c330c283c544a6fe`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/023-1280-dark-full.png` — `82c5348b05bbb3eb9039832dd58322b8b0b5ad1dacd54990705a23d812428158`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/055-1280-light-viewport.png` — `ffd757d1f486a84f55132b3023eba690eb984e5683f5058510716fe139356245`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/055-1280-light-full.png` — `19c41371a9dfbbca1b64637bd063f8397618098555189580d6c576a3a9de6974`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/055-1280-dark-viewport.png` — `2ed43396f92d21cb53a2a7ed8d7d07f88253cd0892bcec97b6f1d205d39d3341`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/055-1280-dark-full.png` — `6814978c8b2c84c8343a142d5fcc21da2a5012073508704ff23dfa423c9641e1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/030-390-light-viewport.png` — `41c2ec3b9dc8523f70649d627da26e9e97e05037a0676f3a1c96888391874fee`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/030-390-light-full.png` — `429c7e2846d6c316de76597651a8eeaaacaf7c28b6b9b59a44cf13f318d46836`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/030-390-dark-viewport.png` — `f5aede8e2a0a49fcf1b85fd27d40b2b60d840dbfdd4d8a625dd67d2385950ecd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/030-390-dark-full.png` — `b3b2db4bef5955f876994ed04a330a7c6bc169b691a5d19c3be791e0a1d2aa55`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/009-390-light-viewport.png` — `60eabfc284d9c4b1eecdfd64a3e9ce0eb633baed18f03344740a8edb8b650304`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/009-390-light-full.png` — `57d0cc8c23c06653a9b8ccdc18739cac9bcc3c6293657d1bdd5254c8724a65de`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/009-390-dark-viewport.png` — `ea5f37eac3ef76b58733ccbc38c463fd2ae3e5f1e02d137a4612dc3470cbc43f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/009-390-dark-full.png` — `12f449a54e05b370a2f5c23f8c3470f46e7ba663c9da974b4ea02729a6a65ea9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/023-390-light-viewport.png` — `eef3b8771e904c3d0654e73f9b36337d998a8e9138c20ed7ce21a50ccd156b2d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/023-390-light-full.png` — `98720227a45fff429b26db3154152ef4dbd9133af56aae5190a368540ec786b7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/023-390-dark-viewport.png` — `704c6d3e7f4811bfb1934ddca0478b20ee5e9ab8eb666f7939ce9dd6aa913031`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/023-390-dark-full.png` — `04de6316daac943ba0b8d39bc839faa183c9f9dd64e6148f830d0d8fe8a40e43`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/055-390-light-viewport.png` — `aae948a621ba0851d5615100571f3acd16e00e641832e23517ec908c85e4b398`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/055-390-light-full.png` — `91c2eafc4e8721b232a8b7a192e77f4e61285d1c943ee012b5fd7ac52b1d868d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/055-390-dark-viewport.png` — `c1702fe5538f31653bab373da72602d72521c3676aaf200ddcf70cbb48260ea4`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch012/055-390-dark-full.png` — `459df2af64f11bce011775636dba8fea4992cede72acad0101bf7580e3ac39bd`

## batch013 — actual independent production review

claude-subagent non-author (fresh context), claude-opus-5-5, UTC2026-10-15T10:24:00Z. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013-independent-ui-review.json` SHA256 `385000ba80080f1ff2d46278ae375d2a7aa3e6cbabd8bac60fba38184af86b11`, same-nameTXT has actual image/view timestamps. Verdict: ISSUES (/observe/ 熱門頁面與讀者關注多列標題全是「新文易數」；/similarity/reposts/ 在 1280 卡在載入中且沒有錯誤狀態；看板設定頁尾收錄數前後不一致；390 轉載統計圖例重疊、頁面過長).

- 039: ISSUES: 頁尾「今天已收錄」數字首屏顯示 2,203 篇，15 秒後同頁變 13,967 篇 — 即時看板設定頁：精簡版/完整版選擇卡、開啟看板與預覽按鈕、9 個鏡頭的勾選與上下排序、時間跨度/往前幾格/停留秒數、變化量、大小滑桿、顯示圖片、存檔/恢復預設，以及未登入時「設定只存在這台裝置，登入後可存到帳號」說明。1280/390 兩種主題都沒有溢出（scrollWidth 等於寬度）、重疊或裁切，390 版欄位改成單欄也很順。 Pending: 切換完整版; 變更設定並存檔; 登入後存到帳號; 預覽目前設定; 開啟看板後的播放畫面 Issue[minor/1280/light]: 10:17:41Z 的 1280 截圖頁尾寫「今天已收錄 2,203 篇・24 小時內 227 家」，15 秒後同一頁（040 轉址後）寫「13,967 篇・245 家」，10:19Z 變 14,092 篇；兩種主題的 1280 截圖都是 2,203。首屏的統計值看起來是過期快取或算法不同，兩者差了六倍，讀者會看到互相矛盾的數字。
- 040: PASS — /liveboard/settings/ 轉址到 /liveboard/setting/（manifest url），把複數拼法導向正確頁面，合理。四張 viewport 圖的 sha256 和 039 完全相同；full 圖做了逐像素比對，1280 只有頁尾統計列不同（列 1814–1827，數字是 13,967/245，比 039 首屏的 2,203 新），390 只有頁尾少數像素不同。我看過的 1280 淺色與 390 深色頁尾切片都正常。 Pending: 轉址狀態碼沒有在截圖中顯示（只看了 manifest 的 url）; 互動狀態同 039
- 054: ISSUES: 熱門頁面/讀者關注多數列都只顯示「新文易數」無法分辨；Google 搜尋全為 0 也沒有說明；0 位讀者卻有 1 次瀏覽 — 網站觀測頁：最近 30 分鐘即時卡、瀏覽 1,290/造訪 294/Google 點擊 0/曝光 0、28 天每日瀏覽長條圖、讀者關注、從哪裡來、裝置、熱門頁面、讀者做了什麼、Google 搜尋圖、Core Web Vitals。版面在 1280 與 390、淺色與深色都完整，沒有溢出；高度 3032/4307，合理。 Pending: 近 7 天/近 90 天切換; 有 Google 搜尋資料時的圖表; 登入或管理員狀態; 資料來源說明展開 Issue[blocking/1280/light]: 「熱門頁面」第 1、3–8 名七列的標題都是「新文易數」（220、61、56、55、51、50、48 次），「讀者關注」第 2、4、5、7、10 名的標籤或事件也都叫「新文易數」。不同頁面全掛同一個站名（像是拿網站預設 title 當標題），讀者分不出是哪一頁，這兩個排行等於大半失去用途。四種寬度與主題都一樣（390 見 054-390-light-full-part00/01）。 Issue[minor/1280/light]: 即時卡顯示「最近 30 分鐘 0 位讀者・1 次瀏覽」，有瀏覽卻沒有讀者，彼此矛盾；可能是排除了 DNT 或機器人但瀏覽仍有計入，頁面上沒有解釋。 Issue[minor/1280/light]: Google 搜尋點擊與曝光整段期間都是 0，兩張圖只有 0–1 的空軸、看不到資料線，日期也只到 10/3–10/14（選的是近 28 天）；但「從哪裡來」卻有「Google 等搜尋 9 次」。右側雖有「還沒有頁面獲得搜尋點擊。」，但沒有說明 Search Console 資料是否已接上，連曝光也是 0 看起來比較像資料沒進來，而不是真的沒有。
- 059: ISSUES: 1280 卡在「載入每日統計中…」沒有錯誤處理；390 圖例重疊、Y 軸擠在一起、表格很長且有媒體名稱解析殘渣 — /similarity/daily/ 以 308 轉址到 /similarity/reposts/（轉載統計分頁），每日統計就在這個分頁，轉址合理。390 版有載入完成：四個數字、相似配對折線圖、比對篇數長條圖，以及各媒體排序表。1280 兩種主題在 10 秒等待後只看到「載入每日統計中…」。 Pending: 1280 載入完成後的圖表與表格; 最近 90/365 天; 表格排序切換; API 失敗時的錯誤狀態 Issue[blocking/1280/light]: 1280 淺色與深色主體都只有「載入每日統計中…」，頁高只有 938。HAR 顯示 /api/v1/similarity/daily?from=2026-09-16&to=2026-10-15&threshold=0.65 在 10:18:13Z 發出，到 10:18:25Z 截圖時仍沒有回應（status -1），頁面沒有逾時、錯誤訊息或重試按鈕。一分鐘後 390 同一支 API 330 ms 就回了 236 KB，所以可能是暫時性問題，但載入失敗時讀者只會看到永遠在轉的狀態。 Issue[minor/390/light]: 圖例換行後第二行的「比對篇數」和下面折線圖的 Y 軸標題「配對／篇」疊在一起（約 y=424–436），深色也一樣。 Issue[minor/390/light]: 比對篇數長條圖的 Y 軸在約 70px 高度內塞了 18,000/15,000/12,000/9,000/6,000/3,000 六個刻度，文字幾乎互相貼住，難以閱讀。 Issue[minor/390/light]: 390 頁高 13,632px：各媒體表把所有來源全列出來，包括整整一段比對篇數為 0 的長尾（part06 末到 part07 整片都是 0），沒有收合或分頁。 Issue[minor/390/light]: 媒體名稱有解析殘渣：「・以上言論由東森…」、「《新聞直擊》製作組」（part06），「作者：財訊雙週刊」、「民視新聞 徐婉寧」、「economic_daily_t…」（part07），看起來是把署名或免責文字當成媒體名稱。

Network recomputed: `{"requests": 549, "requestDNT1": 549, "requestGoogleURL": 0}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/039-1280-light-viewport.png` — `3db1322a673bcf1f32e3739c48ffa0f9244c646a2227d832fd4b29a389c10786`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/039-1280-light-full.png` — `f593220d0dc4372738255d06df38897f16f648e1be78e1fa3bcb513d684c6d9e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/039-1280-dark-viewport.png` — `cddc23842e4cf59c38e7007958ed38d40fd5009a3e9c95603fd3cc22668c44ec`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/039-1280-dark-full.png` — `49f38cbbad09aae74c64207f663c0d01096d7264c0c4e6325ed508e7781b1abc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/040-1280-light-viewport.png` — `3db1322a673bcf1f32e3739c48ffa0f9244c646a2227d832fd4b29a389c10786`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/040-1280-light-full.png` — `0b48e239cc0a8048dfa3aaa4e629589787584dc9b798e1097c1db5d6b4af738b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/040-1280-dark-viewport.png` — `cddc23842e4cf59c38e7007958ed38d40fd5009a3e9c95603fd3cc22668c44ec`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/040-1280-dark-full.png` — `7002be28468a4b304dc9ab254f50ef65e21ab18c96fc68c6d62deb42c945fc3e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/054-1280-light-viewport.png` — `ec59aca0ad010055366fc79f261ad12630fffad929b189c55a9c66fd3369fe10`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/054-1280-light-full.png` — `096610eb992bb98a273f7955db3dbba0c8fb3ccfd8f5bfa57ba4a5425128aadc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/054-1280-dark-viewport.png` — `cdca64632fd57886249027a90d4cc11cfe2458ec32f8d5269f6db9778dfc884c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/054-1280-dark-full.png` — `07d6788feea0147f5f1a3b15003e9213dd79172a95eb979244f70365ee621a23`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/059-1280-light-viewport.png` — `5cf5b679d2062759d927ace1b223d81b629708f4a2056f951489eded660da3a0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/059-1280-light-full.png` — `6751ab0275ea9218ea5eba6f1cc1288f48bc29f0f2494d721fdbc56e2ab80073`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/059-1280-dark-viewport.png` — `71b826d17fb6a15b085a718b04646d1da801d5c4879d3cc9d49ccb6d64ec2772`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/059-1280-dark-full.png` — `854f0f4b9a8d96148347e1d51ea4a1c472ebc298e420fcdb5925c5099b278933`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/039-390-light-viewport.png` — `d0dfb977362cd624adf30a282fc8547348aa36d1d608ba98a3bcd73cfc2254ec`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/039-390-light-full.png` — `13eac74957c1d5d85337305ce282be23dd1dcb232aee6f3c8ac095cc5f9e37bd`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/039-390-dark-viewport.png` — `f3c426ddd10b6c7d9187c8bc273ef0d4d35e9a1d636eff2cc8242306a483c311`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/039-390-dark-full.png` — `65f57772fece3150dc882b6d9db745ea5b1534c5610f6435cdee8924b3cf866b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/040-390-light-viewport.png` — `d0dfb977362cd624adf30a282fc8547348aa36d1d608ba98a3bcd73cfc2254ec`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/040-390-light-full.png` — `92ee34d44528b231847f3747ce7645f32301c199aad007c2863f9889fce0d82b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/040-390-dark-viewport.png` — `f3c426ddd10b6c7d9187c8bc273ef0d4d35e9a1d636eff2cc8242306a483c311`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/040-390-dark-full.png` — `f494055f3c72027401ad1111ca365eb2f0818b5ac033009b2de3a9bbe51bb606`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/054-390-light-viewport.png` — `7318ae272fae67b78451519ae763bf5e05d113f18a0fc24828f2fd21d5e5d9cc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/054-390-light-full.png` — `8a5a66fbfad9f4ef74d4d57e6db086f5ea359b65ec2892a02c3ad71a789d5a2b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/054-390-dark-viewport.png` — `87daad7e8f37e1faf3a47125cc5006e56f6a7cc223e0752a47160b694c1d6a11`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/054-390-dark-full.png` — `d6c7cd5e88d28ca7e1ff34009af9d44f1a9c824a98b54de29b557b058af70890`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/059-390-light-viewport.png` — `181dc4f028a41f865c9b3da7236db6116da6cbe76692e63a2d8ccb17cefdd567`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/059-390-light-full.png` — `64da19d1a1da8d87f0c0dc05a49ba1a5e5ce53091248b68492ecbd9f0a589830`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/059-390-dark-viewport.png` — `03f134a38bc9b7f9411df5d7d0022e7ae6aac3c459896fc2d99c0a57bc449492`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch013/059-390-dark-full.png` — `aa55507709a4fab9f13f18e029b6b974584569a593c4d2694e1b498527d61bce`

## batch014 — actual independent production review

claude-subagent non-author (fresh context), claude-opus-5-5, UTC2026-10-15T10:23:52Z. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014-independent-ui-review.json` SHA256 `2163882337b3e4d492802ea8be3bc9cda5e35948ad5449552333812f5bb9ae62`, same-nameTXT has actual image/view timestamps. Verdict: ISSUES (/my/ 三頁：1280 擷取拿到 STALE ISR 快取，頁尾統計過期；390 分頁列最後一格被切邊。/login/ PASS。匿名狀態皆有清楚說明與登入入口，無版面破損).

- 041: PASS — 四種組合都顯示「登入新文易數」標題、說明只取得名字與 Email，以及清楚的「使用 Google 登入」按鈕；深色模式對比足夠，390 寬無溢出（scrollWidth 390），頁高 870/1185。頁尾數字 14,092 篇／245 家與其他新鮮頁一致。 Pending: 點擊 Google 登入後的流程; 登入失敗／錯誤狀態; 已登入時造訪 /login/
- 049: ISSUES: 1280 首次載入拿到 STALE ISR 快取，頁尾統計過期（2,203 vs 14,092）；390 分頁列「設定」被切邊 — 匿名時顯示「我的新文易數」標題、五個分頁（我的動態為選取），以及「用 Google 帳號 登入 後，可以：」與六項功能列表，說明清楚且有登入連結。版面在 1280/390、淺色/深色皆正常，無整頁溢出。 Pending: 已登入狀態; 摺疊區展開內容; 點擊「登入」後的 OAuth 流程; 收藏／設定分頁（不在本批） Issue[minor/1280/light]: 頁尾統計顯示「今天已收錄 2,203 篇・24 小時內 227 家媒體發稿」，同一分鐘內 /login/ 與 390 寬版本顯示 14,092 篇／245 家。HAR 顯示此頁 1280 擷取回應 x-nextjs-cache: STALE（s-maxage=60, stale-while-revalidate=300），第一位訪客會看到過期數小時的頁尾數字；1280 dark 同樣。 Issue[minor/390/light]: 390 寬時分頁列（我的動態／追蹤清單／收藏／閱讀報告／設定）最後一個「設定」貼齊容器右緣、右側內距被切掉，看不出可橫向捲動；dark 同樣。scrollWidth 仍為 390，沒有整頁溢出。
- 050: ISSUES: 同 /my/：1280 頁尾統計過期（STALE 快取）；390 分頁列「設定」被切邊 — 「追蹤清單」分頁正確被標為選取，內容為同一段匿名登入說明與功能列表；版面正常、深色對比足夠。 Pending: 已登入狀態; 摺疊區展開內容; 點擊「登入」後的 OAuth 流程; 收藏／設定分頁（不在本批） Issue[minor/1280/light]: 頁尾統計顯示「今天已收錄 2,203 篇・24 小時內 227 家媒體發稿」，同一分鐘內 /login/ 與 390 寬版本顯示 14,092 篇／245 家。HAR 顯示此頁 1280 擷取回應 x-nextjs-cache: STALE（s-maxage=60, stale-while-revalidate=300），第一位訪客會看到過期數小時的頁尾數字；1280 dark 同樣。 Issue[minor/390/light]: 390 寬時分頁列（我的動態／追蹤清單／收藏／閱讀報告／設定）最後一個「設定」貼齊容器右緣、右側內距被切掉，看不出可橫向捲動；dark 同樣。scrollWidth 仍為 390，沒有整頁溢出。
- 051: ISSUES: 同 /my/：1280 頁尾統計過期（STALE 快取）；390 分頁列「設定」被切邊 — 「閱讀報告」分頁正確被標為選取，內容為同一段匿名登入說明（含「自願開啟閱讀報告」一項）；版面正常、深色對比足夠。 Pending: 已登入狀態; 摺疊區展開內容; 點擊「登入」後的 OAuth 流程; 收藏／設定分頁（不在本批） Issue[minor/1280/light]: 頁尾統計顯示「今天已收錄 2,203 篇・24 小時內 227 家媒體發稿」，同一分鐘內 /login/ 與 390 寬版本顯示 14,092 篇／245 家。HAR 顯示此頁 1280 擷取回應 x-nextjs-cache: STALE（s-maxage=60, stale-while-revalidate=300），第一位訪客會看到過期數小時的頁尾數字；1280 dark 同樣。 Issue[minor/390/light]: 390 寬時分頁列（我的動態／追蹤清單／收藏／閱讀報告／設定）最後一個「設定」貼齊容器右緣、右側內距被切掉，看不出可橫向捲動；dark 同樣。scrollWidth 仍為 390，沒有整頁溢出。

Network recomputed: `{"requests": 307, "requestDNT1": 307, "requestGoogleURL": 0}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/041-1280-light-viewport.png` — `544f925fd2e2139fe14c6584e92575750e7937697fecd911b851023f3b715222`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/041-1280-light-full.png` — `70ce5ad8b818733d15a8454d0b42216992db6395d02a49767566c9a0bb3bddc0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/041-1280-dark-viewport.png` — `585374ecb922e1658a0d98cbeafcdf1eff2528b628d7aa5f04f055c699f9a6cb`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/041-1280-dark-full.png` — `dc7bc6276e06f95004501d2e1bb14ff456a9a847d5a895bade26b5b09cca4df6`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/049-1280-light-viewport.png` — `e12a2846365791cbfa916f062b31b9480d5c9a018f73b14d30e52a0868569ba5`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/049-1280-light-full.png` — `f22bb3e568c18eaa114ef8c8467506c1686d0fb9a05ce3dbaf87f65522743cec`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/049-1280-dark-viewport.png` — `f992505124120ec2f9310799c60e1b83f5bf80a03f40e885f0059193d12e505c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/049-1280-dark-full.png` — `740a39753058443525cb761de894c4e323ccddf112dc30a486be6e5ed6c4417e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/050-1280-light-viewport.png` — `1920037a00df6b699e71fa96be6946e507fc16e3906eee3fe95bbe3fa6a4bdc4`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/050-1280-light-full.png` — `03bad6478146c5151fb4fd277aad36d50faf9977a21c524d61fa250dd9934813`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/050-1280-dark-viewport.png` — `abcfc20f4d913141ae73e5c7d9e11a255d507e20d69ba5bf84f202b22e9f3c07`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/050-1280-dark-full.png` — `9c82118fce9fc3e570ff1d70fb10ba6fa3ad0ca1fdfdeabdba99bfc62ebcaf51`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/051-1280-light-viewport.png` — `9f933fef9889a04707b7fca8a9960b226feb57949c2ce8762a3c7fa62ef3356b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/051-1280-light-full.png` — `baa4759797cedb6d71df43723570f13b3726877dfb01560a00a2c4f643062e49`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/051-1280-dark-viewport.png` — `7bbb8a45c86f23be67f774dd07ba37cc99a474134b227bb2715c0218c9ba9a7d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/051-1280-dark-full.png` — `dac7f0dd15353604eebdefb353295a0ba58d94b9bc20b3ca1871c978332b07a9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/041-390-light-viewport.png` — `5513b3b3382265495fc6b980794a43339b9eed985fb0d69e04f74c556141c5fe`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/041-390-light-full.png` — `6a7234d9d7d7c4086dc726cccff1bb8280c65f33154f6db22d3870a5473bbf2d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/041-390-dark-viewport.png` — `1116ac38d2515cca209e0c2ea234ed4179ee3af830a8387a718a38d88e835171`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/041-390-dark-full.png` — `47db99c17ac673c074cb17d6feb26ba921a79c313fb395e8c38ebfc27116418e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/049-390-light-viewport.png` — `c3df866e7760d212b3b7a7f3e2992513165ade554d46fa2171ad2568f0c31147`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/049-390-light-full.png` — `9b1f1c5de6900eaf612ac8bc06c6950c469cda03a90cef5abfcdd5c0f6fa7a56`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/049-390-dark-viewport.png` — `53522d44f30531a3cfac5c9c4695d779ecb756ade3d78d44a636e357432d3ec2`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/049-390-dark-full.png` — `23409173e56003bbf46a314320d690f008a47c5a54145ea3d70ac712e4248f0d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/050-390-light-viewport.png` — `436fabc1f396137c79259876c461f2a44977b8fe92546a6837f48886b848e0ea`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/050-390-light-full.png` — `249fd5db7a0819516dd5c0ca04be717fce3fae1e32f1e8fb594735ee65ca2308`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/050-390-dark-viewport.png` — `383f840125f653f8ed2506561c6cd917219eedb6cfe4f73b4e875920f966968c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/050-390-dark-full.png` — `f894114c51fefc5783ce991474f023cdd5f41cdd22a43d45c417d912378314ae`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/051-390-light-viewport.png` — `a08d97289593e9b394e59c12a9200dd3711a8e8683dc5799fa32fd4d19d09517`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/051-390-light-full.png` — `6d7bbc55c2dd5c2b4985e935c9121a0b948a5600e960590a98f0be9048f191f0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/051-390-dark-viewport.png` — `823bf83b69bc18152c65a531b2692edf340a624ffff4a8b1343460c3ba12d5f0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch014/051-390-dark-full.png` — `1a99d21c96a2957cc454b3a9b6300da51b44ffdfbc10ce2e35974119611640c2`

## batch015 — actual independent production review

claude-subagent non-author (fresh context), claude-opus-5-5, UTC2026-10-15T10:25:46Z. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015-independent-ui-review.json` SHA256 `681f7252d38ba382ca655bd9885dd5ffaf3aede007b9dd4800bd8a63f89d12ff`, same-nameTXT has actual image/view timestamps. Verdict: ISSUES (沒有阻斷性問題；/my/ 頁在 1280 的頁尾統計 2,203 篇與其他頁的 14,092 篇不一致；390 分頁列右緣被切到；後台權限提示太簡短且有多餘空白；後台沒有洩漏資料).

- 052: ISSUES: 1280 頁尾統計數字與其他頁不一致（2,203 vs 14,092）；390 分頁列最右邊的「設定」被切到 — 匿名狀態顯示「我的新文易數」標題、五個分頁（我的動態／追蹤清單／收藏／閱讀報告／設定），「收藏」為目前分頁，下方說明用 Google 帳號登入後可以使用的六項功能，並附上登入連結。四種寬度與主題的版面都正常，沒有橫向溢出（scrollWidth=寬度），深色模式文字也清楚可讀。 Pending: 登入後的收藏列表; 空收藏狀態; 收藏載入錯誤; 分頁切換互動; 資料來源摺疊區展開 Issue[minor/1280/light]: 頁尾即時統計顯示「今天已收錄 2,203 篇・24 小時內 227 家媒體發稿」，但 13 秒後擷取的 /admin/tags/ 與 1 分鐘後的 390 寬同一頁都顯示「14,092 篇・245 家」。同一時段兩組數字差距極大，代表 /my/ 頁面的頁尾數字可能是過期快取或來自不同計算來源。 Issue[minor/1280/dark]: 同上：深色 1280 也顯示 2,203 篇／227 家，與其他頁的 14,092 篇／245 家不一致。 Issue[minor/390/light]: 390 寬的分頁列可以橫向捲動，但最後一個「設定」緊貼右邊被切到，容器右側沒有內距，也沒有漸層或箭頭提示還能捲動。
- 053: ISSUES: 1280 頁尾統計數字與其他頁不一致；390 目前分頁「設定」貼齊右緣被切到 — 匿名狀態與 /my/saved/ 相同：「設定」分頁為選取狀態，下方是登入說明與好處清單，並附上登入連結。版面正常，沒有橫向溢出，淺色與深色模式都清楚可讀。 Pending: 登入後的設定表單; 儲存成功／失敗狀態; 本機偏好設定; 分頁切換互動 Issue[minor/1280/light]: 頁尾即時統計顯示「今天已收錄 2,203 篇・24 小時內 227 家媒體發稿」，但 13 秒後擷取的 /admin/tags/ 與 1 分鐘後的 390 寬同一頁都顯示「14,092 篇・245 家」。同一時段兩組數字差距極大，代表 /my/ 頁面的頁尾數字可能是過期快取或來自不同計算來源。 Issue[minor/1280/dark]: 同上：深色 1280 也顯示 2,203 篇／227 家，與其他頁的 14,092 篇／245 家不一致。 Issue[minor/390/light]: 390 寬時目前選取的「設定」分頁按鈕貼齊畫面右緣，按鈕右側邊框被分頁容器切掉，看起來像被截斷。
- 014: ISSUES: 權限提示「請先 登入 。」過於簡短且有多餘空白；沒有洩漏管理資料 — 匿名狀態顯示「管理後台」麵包屑、「標籤管理」標題、一行功能說明，以及五個子頁籤（分類與群組／投稿審核／文章關係／人物頭像／其他標籤圖像），下方只有「請先 登入 。」。沒有出現任何標籤資料、審核佇列、表格或可操作的編輯控制項。390 寬時頁籤正常換成兩行，沒有溢出。 Pending: 管理員登入後的內容; 非管理員帳號登入後的拒絕訊息; 子頁籤點擊後的匿名狀態 Issue[minor/1280/light]: 權限提示只有「請先 登入 。」：「登入」連結與全形句號之間多了一個空白，排版不自然；文字也沒有說明需要管理員權限（一般帳號登入後仍無法使用）。
- 015: ISSUES: 權限提示「請先 登入 。」過於簡短且有多餘空白；沒有洩漏管理資料 — 匿名狀態只顯示「管理後台」標題和「請先 登入 。」，接著就是資料來源摺疊區與頁尾。沒有任何管理連結、統計或控制項外洩。版面在四種寬度與主題下都正常，沒有溢出。 Pending: 管理員登入後的後台首頁; 非管理員帳號登入後的拒絕訊息 Issue[minor/1280/light]: 權限提示只有「請先 登入 。」：「登入」連結與全形句號之間多了一個空白，排版不自然；文字也沒有說明需要管理員權限（一般帳號登入後仍無法使用）。

Network recomputed: `{"requests": 284, "requestDNT1": 284, "requestGoogleURL": 0}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/052-1280-light-viewport.png` — `4d3d36cf4026d3c99875f031cdda88f6f32b0d1b9c7e39f44f435f5134d4c7b0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/052-1280-light-full.png` — `96cead4b0b47b2df486ed58b9a5c07d9ac4a41a5ce11180e2e427619aa0b2c74`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/052-1280-dark-viewport.png` — `d528dfbbc389570d5e7b143df532330831cff7aee864c00f91bc6d9c75f50c3d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/052-1280-dark-full.png` — `f57b58b435786723cb589b5190092cc80dac42b00d5bdb3b82a04c4ef568c73a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/053-1280-light-viewport.png` — `e3013ad2e2d4694c7229c033feeb17f572c08fa5038455c2fa6b3710a989472b`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/053-1280-light-full.png` — `e89b6edf8ec59b324b5801e79b4432ec9e4e02a6b1c60a4e0aed96c7a246f8cf`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/053-1280-dark-viewport.png` — `7a0025fcdbeb6cb6400b0dc1a43a73a18d08d3446285d276e3ef616611896228`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/053-1280-dark-full.png` — `f0cc5c19e6389b8f745870b1737d7a62a9f4cdb3a120de976f16b072499447be`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/014-1280-light-viewport.png` — `b8b97fc204bf7571b7739ad5504325b71797866b59c0f76da2ab3dd8b7e9603c`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/014-1280-light-full.png` — `ed5ebf71686c218695df95883f54f49c0e2bc56eb942fa12888bad94217433df`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/014-1280-dark-viewport.png` — `bb06cefe358dd9d30d5a1baae748695e65fb47d0f57e2afb7721d3a954c85d0a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/014-1280-dark-full.png` — `cb91113a654dde5e421e1c9af77971b7263bfb0cef9511eb9e5e999c1f972c23`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/015-1280-light-viewport.png` — `ec25c18d92365ed0974535f5891dc1b770cf9d7e0ab92875b020743f07b30a46`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/015-1280-light-full.png` — `a2420622b96bc5686b6a08da62f0c666afd1f34ed4d573dc04f531a07884f437`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/015-1280-dark-viewport.png` — `0baba8596a4042e05fc91e82db35a097cfc45f6828e3afa40957a8b2c330f6b1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/015-1280-dark-full.png` — `d60345aeddf35de023e98ff67daac9a548f1ef1ef30345d34892b262e8e49f40`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/052-390-light-viewport.png` — `6e37325d3b48a87f03fe6bcf20df59c10afb148f4b1decb02d99e9c93ae43630`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/052-390-light-full.png` — `bffb1d5e8b7932dece326d3ff31f14131e399c1f18699f57f48b0a85da3eeda9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/052-390-dark-viewport.png` — `4f62e2c92b76f0a275163596f246dcd18bc440c9efe3c95ef24929abca37f87d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/052-390-dark-full.png` — `42928a2e70eaf31e3f6e9a280a823701a5301dd6d92c787c1e4c40c9793a42e4`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/053-390-light-viewport.png` — `9f2e13fcc5af9398d93d255ed9efade1ba98bd1dcac7855f04c2ff5075ce8710`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/053-390-light-full.png` — `3777d96d33036e42a626483d987e60c0f75a3da0724f63f1499e0c93d3e9f470`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/053-390-dark-viewport.png` — `2d8f3160c23eb6988ce426170e91b16b695d06529460a0333d90c2f92714efac`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/053-390-dark-full.png` — `aaed7d6f017b4a38ec3f4662c91d5d182b1d0a5927b7383a486ea965d8e41c49`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/014-390-light-viewport.png` — `9237f8017ecdac858b3a8d5317f4d0191489579a5b6309eabe1e59dc8359160a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/014-390-light-full.png` — `83612baa85775f6b9b34f9151dd809d47e4ec30ff8625f06357ccf60e3c3d27d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/014-390-dark-viewport.png` — `3a838a0c4e6ea0f3dff1534f35aacb096f52e27bf9b03b282932c43ce763ab70`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/014-390-dark-full.png` — `d1a1bbd56722cc7a3fbb01701e9e4443b366b3b9e96bab8aae7cad3738a23033`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/015-390-light-viewport.png` — `c5dc1e930d9eff2d6e8140ca5e65e187490e6bacbc9f492b52f8bf07ec581524`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/015-390-light-full.png` — `26c654f3d32482edf69750bb285bd10d41c95f20c0576adc7063958fe396bc64`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/015-390-dark-viewport.png` — `2808fdb03611de205599234ade05de8c1767142e3bf20fc389105147439eca33`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch015/015-390-dark-full.png` — `f661a575693427a4d6c564ef05ad01ad85122b4b793a15de90071070ba1be9d5`

## batch017 — actual independent production review

claude-subagent non-author (fresh context), claude-opus-5-5, UTC2026-10-15T10:27:09Z. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017-independent-ui-review.json` SHA256 `39c1c901bcbae411126aa35711d238bd6f4b03268d9bb73e41b3779be529679f`, same-nameTXT has actual image/view timestamps. Verdict: PASS (匿名狀態只顯示登入提示，未見管理資料或操作控制；僅有 note 級觀察).

- 020: PASS — 四張截圖皆已依預期轉址到 /admin/tags/?view=relations（標題「標籤管理 · 管理後台」，「文章關係」分頁為選取狀態），內容區只有一句「請先 登入 。」，沒有任何標籤、文章關係資料或編輯/核准按鈕。1280 與 390、淺色與深色版面都正常，scrollWidth 等於寬度、頁高 856/1263 合理，深色模式文字對比足夠。 Pending: 已登入管理員狀態（文章關係實際資料表）; 已登入但非管理員狀態; 點擊分頁後的互動/預取內容; 展開「本頁的資料來源與計算方式」; 錯誤/空資料狀態

Network recomputed: `{"requests": 68, "requestDNT1": 68, "requestGoogleURL": 0}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017/020-1280-light-viewport.png` — `a00a22c48285250720502ae311b3b2c58b2e3a45d84a94e49844d4082e398d07`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017/020-1280-light-full.png` — `7f5ed57c4248f85d3f464bd915762ef376ccf0e47ee25f5d592ca6e60afe57c0`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017/020-1280-dark-viewport.png` — `50ba782cca3c219d2cc89dc183e7f72d7895fef5de4f05ae8ef28f790b46444a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017/020-1280-dark-full.png` — `b75bbd1f035769ab593f73fa7b2dacc34622e13a777bbf3c8fc23fd7e52c508d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017/020-390-light-viewport.png` — `42e7008786ccfd3e6d96cbbad673722fe8834c04d7b0a2c888df6e4eeca30fe7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017/020-390-light-full.png` — `5841d0a065f83f091511c040b7734522d643e4df69b140ee46f92638a3c7ad7a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017/020-390-dark-viewport.png` — `d2741f84e66d89318b83765b17275e4e715342c587218b37758e79b4b882a19f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch017/020-390-dark-full.png` — `0b668671f697e972d1492fab34e3bf818b04d835058f6799a387123d5d528a1b`

## batch016 — actual independent production review

claude-subagent non-author (fresh context), claude-opus-5-5, UTC2026-10-15T10:27:52.550Z. `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016-independent-ui-review.json` SHA256 `5f448dcda1cc08f5cf2dde7490d60118750e4080836d81d13366803e7a974ac1`, same-nameTXT has actual image/view timestamps. Verdict: PASS（四條路由都沒有洩漏管理資料，皆顯示登入提示；沒有新的 blocking/minor 問題，只有觀察）.

- 016: PASS — 307 轉址到 /admin/tags/?view=avatars（manifest 確認）；頁面標題為「標籤管理」，對應分頁標籤以橘色顯示為選取狀態，主內容只有「請先 登入 。」，沒有洩漏任何管理資料或控制項。四種寬度與主題組合版面都正常，scrollWidth 等於視窗寬度，沒有水平溢出，深色模式文字也讀得清楚。 Pending: 已登入但非管理員; 已登入管理員（實際資料／操作）; 互動（分頁切換、展開資料來源說明）
- 017: PASS — 沒有轉址，頁面標題為「媒體設定」，主內容只有「請先 登入 。」，沒有洩漏任何管理資料或控制項。四種寬度與主題組合版面都正常，scrollWidth 等於視窗寬度，沒有水平溢出，深色模式文字也讀得清楚。 Pending: 已登入但非管理員; 已登入管理員（實際資料／操作）; 互動（分頁切換、展開資料來源說明）
- 018: PASS — 307 轉址到 /admin/tags/?view=groups（manifest 確認）；頁面標題為「標籤管理」，對應分頁標籤以橘色顯示為選取狀態，主內容只有「請先 登入 。」，沒有洩漏任何管理資料或控制項。四種寬度與主題組合版面都正常，scrollWidth 等於視窗寬度，沒有水平溢出，深色模式文字也讀得清楚。 Pending: 已登入但非管理員; 已登入管理員（實際資料／操作）; 互動（分頁切換、展開資料來源說明）
- 019: PASS — 307 轉址到 /admin/tags/?view=visuals（manifest 確認）；頁面標題為「標籤管理」，對應分頁標籤以橘色顯示為選取狀態，主內容只有「請先 登入 。」，沒有洩漏任何管理資料或控制項。四種寬度與主題組合版面都正常，scrollWidth 等於視窗寬度，沒有水平溢出，深色模式文字也讀得清楚。 Pending: 已登入但非管理員; 已登入管理員（實際資料／操作）; 互動（分頁切換、展開資料來源說明）

Network recomputed: `{"requests": 256, "requestDNT1": 256, "requestGoogleURL": 0}`. Original shots:

- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/016-1280-light-viewport.png` — `e6b916c82582ea40126979a94e91388e82e87353ac0dbc0815cd18e996fc6837`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/016-1280-light-full.png` — `839a491932692c7103991205f90ebdb4bedc4dd979a7fccca6bd8dfe1842d8d9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/016-1280-dark-viewport.png` — `19aab3d4ba22125d722483af36e80c5df1a1de8857341b2658001bb2b5cf6897`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/016-1280-dark-full.png` — `d7261f1a5eec04dd04177b97826897c73f1fea1740e625026f16bc0e42f58311`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/017-1280-light-viewport.png` — `a00086ab4b157664b2f0f1d5d239b802ff2d5efe4450d9db782d84a68bd85c2d`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/017-1280-light-full.png` — `024215b0c92454582410d13b63a5e0b5d113ac89f5e862bceae10b7d4f33cb8a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/017-1280-dark-viewport.png` — `87d79116f4b69d65bfe9e94af842201dbbbbbb8488775874bc3295cf2e2bc871`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/017-1280-dark-full.png` — `f54dc6151801fdaf2e38199b391ac5a010eeac4266c0d6d3c1fe3a38eb545498`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/018-1280-light-viewport.png` — `05cf0fb84e958331f1810145257f693d130b683e87752f983b680d43b4e305f9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/018-1280-light-full.png` — `d3e3ce46bdb033b10275ce7019441590489ff0524cac6281445252a56906fae1`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/018-1280-dark-viewport.png` — `ebba6c6b7c8ce5a425ea13868f96c40cea2fedd312bee3a2778188f142fb576f`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/018-1280-dark-full.png` — `ba6ef74ae71d24be869dbbea219be5b3e6555cd87d00a976bcbfb140f4510115`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/019-1280-light-viewport.png` — `87894af8ad99f63bf61b7c541bf667204d126e8ed14c319cde036d1c4ed61085`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/019-1280-light-full.png` — `402fd50597f224876b17d4ca62535182e92b0d8d16d7c4708ae6cb314dca317a`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/019-1280-dark-viewport.png` — `d829f2d870ab51f5926dc9c3950329105b598825dc183789f9b6b2e2ce1d61bf`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/019-1280-dark-full.png` — `9ee26ee69f437b33111bb84277eb7e17208afc1710145caed12c573706d4b8f9`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/016-390-light-viewport.png` — `709acd9a08cedd5ae9914adaa4c64ff95f9cfec484ec55867112b5ceffc224e7`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/016-390-light-full.png` — `e7085169f98e704b864def1d4b1b67813b47f57cfef526bd46faf0553a5477cc`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/016-390-dark-viewport.png` — `7c072078420dc2b4e9d31e1fe83ca38acfe011ef5640fb372c9ffdb14fbe53ac`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/016-390-dark-full.png` — `3ce4227d8edc02cc14ce7917b471f2b0deb6aef5633659eeeccf973151fd3b62`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/017-390-light-viewport.png` — `61873e790007ace9840ae415708eb65bc48cd629f1bbbc2d4bc86df2f00efd71`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/017-390-light-full.png` — `357a5d0372f4e196945dc6539e08d228beca5461cf8b560517aba0c92c5b0903`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/017-390-dark-viewport.png` — `47893e7834337762468b7ca5fd083aa9f9f8b41f5ba17147a1d09f02b7b6de53`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/017-390-dark-full.png` — `b287e713014b5a647eca1280e7f3ccf672f50e3250f0e83ff931ac20810aeff8`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/018-390-light-viewport.png` — `9d98cb298ecb9cb60528d1bc2750f9cc6563e6680410aeef9df5f2fbb148f3f4`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/018-390-light-full.png` — `95d0bad18a9c8dc4a4766b8bbbda1ddd8671d6992df5c0a9ccc7a3fe19fee71e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/018-390-dark-viewport.png` — `ee76ea068bc17fa04ebf2cde3b5fe8e8a13c4a4c0813c7a2041f092d24c11813`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/018-390-dark-full.png` — `aa22243936c1ac47d5295a8b4da8606e253e1d5b2ccedf693c50fd620846fe30`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/019-390-light-viewport.png` — `a4e2f225a75af1a4e61efe2a594c2c2d800cbb0cd97e30e8cb976f8e5610c151`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/019-390-light-full.png` — `18ddff5622aa29dc4cd03d5ccc14a97ecfc55f014b33661c1dadf271196e4abf`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/019-390-dark-viewport.png` — `054c6020ca24f8805f1fd368ca058775ef53f606a1fdf10cf566e8731db8e11e`
- `/home/deck/tag-analysis-private/ui-review/current-live-f62-20261015/batch016/019-390-dark-full.png` — `297b0c2879f4db42c39f32ee212c8568d2c93ac4cc5d670ac11ba8e7262c514a`
