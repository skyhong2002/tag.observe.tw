# PSI 行動版：凍結期間原始碼修正

本輪基底 `ed1607b8f9a695b3035238375842d80defb76948`，工作目錄 `tag-f1-release`。只用既有 Lighthouse JSON、來源碼、SSR／mock 單元測試；沒有 build、browser、capture、正式 probe、DB、清理、備份操作或 GA 事件。這份文件接續先前 [離線盤點](psi-offline-readiness.md)，不是新的 PSI 報告。

## 問題與修正

既有 `lighthouse-mobile-2.json` 的 LCP 是首頁焦點新聞 `<img>`（`home.hero > home.heroImage > home.picture > img`）。當時已有 SSR 可發現、eager、fetchpriority=high，三項 discovery 檢查皆 true；不再疊加另一個 preload。當時378×213 CSS像素、750×422來源與1.75 DPR，不能把來源直接縮到378像素。

1. **LCP 資料等待**：`loadDemo()` 原本等待6個請求，包含只供頁尾藍綠新聞量使用的 blue／green 排行。現在先啟動事件、全日事件、news排行、媒體資料；blue／green 同時開始，但結果由獨立 Suspense 區塊等待。news Promise共用，不多打一筆請求。網路或資料格式錯誤維持可復原的null，不拖垮主新聞；頁尾仍有既有retry。這縮短程式依賴鏈，不是實測LCP毫秒改善。
2. **圖片尺寸與格式**：`home-images.mts` 依目前grid比例、220px側欄下限、padding/border、640/690/1000/1152斷點描述hero／story slot；議題cover實際72px，不再沿用新聞縮圖的vw。Next imageSizes增加192，390px手機的story在2x DPR可選192而不跳到256；較高DPR仍有更大來源。主圖quality75，縮圖quality65，僅允許這兩個品質值。保留現有WebP：本機Next文件指出AVIF首次編碼及多格式cache有額外成本，在共享主機與磁碟限制下本批選WebP，不新增AVIF格式。允許主機清單、fallback及低優先權lazy縮圖維持。
3. **對比與觸控**：首頁獨立連結／retry目標補足最小尺寸，暗色排行小字換400色階。由已安裝色票換算，red對zinc-900為2.76→6.13、對orange-950為2.44→5.42；emerald分別3.30→9.17、2.92→8.10，均超過一般小字4.5。這是色票數值，不是新瀏覽器computed-style驗證；細節及scope見 [無障礙修補](psi-accessibility-offline.md)。三份舊報告的contrast／target audit皆已score1，不能把此次source缺口說成它們的失敗紀錄。

## 離線證據與界線

`home-loading.spec.ts` 實際執行loader，以未完成blue／green Promise證明主新聞能先完成、news只請求一次，並涵蓋network／malformed回應；`home-images.spec.ts` 用本機Next getImgProps及實際NewsImage的SSR輸出，核對11種viewport的slot算式、72px議題圖、quality allowlist、srcset與priority/lazy/fallback；`home-accessibility.spec.ts` 核對CSS目標及實際palette對比。

新圖片品質／optimizer實際輸出、瀏覽器串流到達時間、控制項是否互擋、深色畫面以及Suspense fallback換成完成內容時的CLS，仍必須在candidate驗。fallback的min-height只作用於等待狀態，不承諾完成後完全相同高度或CLS降低。單元測試不是UI review，亦不證明新分數。

## 解凍後量測與重拍

使用者明確解凍及安全gate後，只對同SHA candidate跑3次行動版Lighthouse，保留3份原始JSON、SHA、工具版本、每次UTC、URL、資料來源／fixture及快取狀態；採固定mobile simulate設定（RTT150ms、throughput1638.4Kbps、CPU4x、412×823／DPR1.75，沿用現存報告以利辨識，執行時核對實際configSettings）。這是量測viewport；逐頁UI另為1280×800／390×844，兩者不混用。

DNT=1及所有guard維持；擷取／量測啟動前先從網路層封鎖GA/GTM所有transport，保留原始request/network artifact證明zero-outgoing（依核准的小批模式，不要求新增HAR）。不能套用曾失敗的逗號串接阻擋pattern，也不做GA收件驗證。遵守全站最多2個瀏覽器、候選降速及服務負載gate；不藉freeze文件自行解除凍結。完整budget與route×state×width×theme矩陣見 [ledger](ui-review-ledger.md)。

回報三次與中位數的score、LCP、FCP、CLS、TBT。**INP不列實驗室指標。** 使用者基準69／LCP7.8秒只作參考欄，其FCP／CLS／TBT與完整原始設定未提供，不能補造或宣稱同條件比較。先前adf47ee的73／LCP4.44秒是另一批歷史報告，不冒充本次after。不上正式站重跑基準。

提交／部署狀態：來源碼與文件由root獨立審查後分批commit；本文件建立時未部署。所有正式／candidate UI scope仍pending。

## 最終來源碼驗證

`nice -n 19 env -u CI -u TEST_DB_URL ./node_modules/.bin/vitest run --project unit web/test/home-loading.spec.ts web/test/home-images.spec.ts web/test/home-accessibility.spec.ts web/test/home-ranking.spec.ts --maxWorkers=1`：**29／29通過**（4 loading、16 image、3 accessibility、6既有ranking），4 files，2.90秒；原始小型輸出 `/home/deck/tag-analysis-private/performance/20261013/psi-final-source-unit-tests.log`。web與web tests兩份TypeScript均以 `--noEmit --incremental false` 通過，沒有建置產物。

非作者 `/root/psi_independent_review`（spawn model `gpt-6.1-sol`）完成獨立source/doc review；提出的redirect狀態適用性與議題標題clamp問題已修正後複審。UTC、基底、diff/file hash、獨立測試與限制在 `/home/deck/tag-analysis-private/performance/20261013/psi-independent-review.log`。reviewer沒有撰寫產品修正；此證據不提升任何route的UI pass。
