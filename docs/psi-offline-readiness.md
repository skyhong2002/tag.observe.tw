# PSI 後續離線準備盤點

基準 `b8d030c747f87c997800371e33e1ab2d168ad257`；只讀source及既有 Lighthouse JSON，沒有新 Lighthouse／PSI、browser、build或正式 probe。此清單不實作產品修正。

## 已有數值與可比較範圍

[原始設定及hash](audit-supplement-20261013.md)記錄 adf47ee 正式版三次 Lighthouse 13.5.0／Chrome153，mobile simulate、RTT150ms、1638.4Kbps、CPU4x、412×823／DPR1.75：score78/72/73，FCP2368.5985/2417.8135/3098.127ms，LCP4127.8945/4438.5515/4690.889ms，CLS均0.0008018934，TBT284/386.5/233ms。中位數score73、LCP4438.5515ms、TBT284ms。使用者原PSI只有score69、LCP7800ms；缺原JSON、版本、benchmark與完整設定，不能說同条件7.8→4.44秒已證明改善。

## 4aa4d41 之後已有 source

- `c2f3233`（在4aa後）：本機媒體logo經Next optimizer、homepage NewsImage尺寸及觸控目標；上述三份報告已包含這些修正，不能再當作未測的新改善。
- `b911fb0`／`a7193e7`／`0dd38b6`：analytics opt-out偏好／過期request與remount保留，屬隱私正確性；不能推定提高PSI。
- F1恢復、typed relation去重，及 `225fa38` 高量導航停止自動RSC prefetch。既有AB受API failure、DB wait-queue干扰；[預取稽核](rsc-prefetch-audit-20261013.md)只能支持請求變化與實驗限制，不能證明新PSI分數。
- `bfad57e`長relation label、`4788514`單一admin gate、`e0eb4dd`crawler empty、`6479276`suggestions sticky offset：可讀性/互動修正，最新SHA真圖仍待驗。
- `821711c` Next兩workers、`98734e2`build guard：保護共享主機的建置流程，不是browser payload優化。

## 尚待評估的小修與不能直接下結論的項目

讀中位數報告 `/home/deck/tag-analysis-private/performance/20261013/lighthouse-mobile-2.json`：root document約540ms、server-response-time估437ms；unused JS24455bytes（約24KiB，估150ms）；image-delivery估66KiB。首頁hero為LCP，當時378×213 CSS、750×422來源、DPR1.75，已有eager/high及responsive sizes；不能把Lighthouse按CSS尺寸的oversize直接當成應降至378px（高DPR仍需清晰度）。

| 項目 | 下一個 source小修／盤點 | 尚缺的證據或限制 |
| --- | --- | --- |
| Hero/thumbnail圖片 | 檢查 `web/src/app/_home/NewsImage.tsx` sizes與CSS實際各breakpoint；評估局部quality/deviceSizes，保留主圖high/eager、次圖lazy/low及fallback | DPR清晰度與不同原圖品質；不能全站盲降quality，image-delivery savings不可直接相加當LCP改善 |
| 初載unused JS | 根據該報告chunk `12r7mtftnr471.js` 的同版module mapping找真正可延後的非首屏元件；已有圖表延後策略先核對 | 缺可可靠對应最新SHA的module mapping；不能直接刪runtime/shared chunk或把正常hydration算浪費 |
| SSR/TTFB | 離線盤點homepage API串並行、fallback/cache邊界與DB讀取；只在已定位重複read時提局部修正 | 540ms是單次舊報告，不證明最新瓶頸；憑證private/no-store不可犧牲，真load/DB資料要解凍後授權驗 |
| CSS/font阻塞 | 舊render-blocking insight與現有font載入檢查是否首屏必要；只提精確未用資源、避免重複preload | 沒有最新source到chunk映射／新trace，不能預先宣稱CSS拆分必要或字型造成全部LCP |
| RSC負載 | 保留已有限制prefetch，核對新增高量列表是否沿用同策略 | 先前AB不具乾淨可比條件，無新量測不能寫已達分數目標 |

這些是待評估候選，不是已確認的缺陷，也不是完成F1所必須盲做的更動。若主協調者決定納入任何已授權修補，必須在唯一build前完成source review、freeze SHA與合適unit驗證；不能在候選驗收途中改source卻沿用舊PSI/UI證據。

解凍後先完成同SHA候選與服務穩定驗收，再另排低資源、固定資料/版本/節流的量測。原三份JSON及hash保留；不得補造新的GA收件或同条件PSI比較。測試須真正逐pattern封鎖GA/Tag Manager且確認rawnetwork（原逗號串接pattern證據已撤回）。若未得到新量測授權，保持本盤點為offline pending。

提交狀態：本分工未 commit／未 push，由主協調者整合。部署狀態：未部署；上述原正式量測版本為歷史事實，沒有本次上線驗證。

## 本輪追加的來源碼核對

- `web/src/app/page.tsx` 的主新聞由 server component `await loadDemo()` 決定，再輸出 `NewsImage priority`，不需要等 client fetch 才決定 LCP 圖。`web/src/lib/demo.ts` 的六筆主要資料已使用 Promise.all；記者、關係圖、議題面板先啟動 Promise 再透過 Suspense 獨立輸出。沒有證據支持本輪新增另一層 preload 或拆掉這些既有邊界。
- `NewsImage.tsx` 透過 `SafeImage`／next/image，主圖 eager/high，其他圖 lazy/low；sizes 配合640／1000／1152斷點。`next.config.ts` 已啟用 WebP；主圖16:9容器與fill降低版面位移。既有高DPR來源不能只按CSS寬度盲目降尺寸。
- 本輪沒有追加猜測性的 PSI 產品修正，沒有新效能分數；既有 `c2f3233` 與預取修正保留。量測LCP/FCP/CLS/TBT及雙寬UI需等解凍；INP不列Lighthouse實驗室指標。
