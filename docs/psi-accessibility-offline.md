# 首頁無障礙離線修補

基準 `ed1607b`。只讀既有 `/home/deck/tag-analysis-private/performance/20261013/lighthouse-mobile-{1,2,3}.json` 與來源碼；三份 `color-contrast`／`target-size` 均為 score 1、失敗清單空白。這些報告不能支持「修掉 Lighthouse 已報告的失敗」或新的 PSI 分數。

來源碼另有兩項可直接定位的缺口：暗色首頁排行小字 `.rankNew`／`.rankUp` 仍沿用亮色的 red-700／emerald-700；獨立區塊「查看全部」、主卡尾連結、圖例說明、媒體摘要連結與重試按鈕，未指定最小觸控區。它們未必出現在舊報告資料／錯誤狀態中。

本次只改首頁 CSS module：暗色排行改 red-400／emerald-400；上述獨立控制項以 inline-flex 配合 44×44px 最小區域。MastheadCloud 中央排行連結限為 24×24px 最小區域，以減少擠壓既有文字雲中央配置；沒有調整文字雲字詞或全部 inline links。既有媒體圖示桌面26px／coarse-pointer44px已達24px門檻，因此保留。

`web/test/home-accessibility.spec.ts` 的三項小測試檢查控制項來源規則，以及從已安裝 Tailwind OKLCH palette 換算 WCAG 相對亮度，確認兩種排行字色對 zinc-900 panel 和橘色950 hover底色均至少4.5:1。Hover是兩底色的透明混色，測試兩端較保守。這是來源規則／色彩數值測試，不是瀏覽器 computed-style、排版、焦點順序或新 axe／Lighthouse驗證。

驗證：`nice -n 19 ./node_modules/.bin/vitest run web/test/home-accessibility.spec.ts --maxWorkers=1`，3/3通過；`nice -n 19 ./node_modules/.bin/tsc --noEmit --incremental false`（web目錄）及 `git diff --check` 通過。沒有 build、browser/capture、正式probe、DB操作或GA收件；freeze維持有效。新CSS造成的主卡尾部／圖例／區塊標題高度，以及masthead中央字詞是否靠近，仍需解凍後同SHA雙寬UI檢查。不能推定LCP或PSI分數改善。

提交狀態：分工未commit／未push，由主協調者於獨立 review後整合；部署狀態：未部署，沒有本次上線驗證。

追加來源碼核對：`.gapGroup li > a` 為直接事件連結；`.pairNames` 內 `MediaHoverLink` 以 Fragment 輸出直接 anchor；`.topicBody h3 > a` 為直接議題標題連結。三者指定24×24px最小區域，前兩者保留既有webkit-box／inline-flex，議題anchor直接使用webkit-box兩行clamp，h3只保留字型規則。空狀態 `.empty > a` 的「前往事件表」加入44px控制項規則。仍未改正文inline連結；標題clamp與中央cloud實際排版仍待解凍瀏覽器驗證。

獨立審查追加修正：議題標題的兩行clamp直接放在可點擊anchor上，h3只保留字型規則，避免在原clamp父層加入block子元素後的瀏覽器差異。測試驗證anchor的clamp與最小尺寸；真實ellipsis仍待候選驗收。
