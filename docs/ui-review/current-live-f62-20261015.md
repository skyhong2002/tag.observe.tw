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
