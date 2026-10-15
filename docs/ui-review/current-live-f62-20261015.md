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
