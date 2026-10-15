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
