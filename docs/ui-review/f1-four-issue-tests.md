# 四個 UI 問題的離線回歸測試

本輪只補單元測試；四個 source 修正已存在，沒有新增產品程式碼，亦未建置、
capture、staging、probe 或部署。最新 UI source 是 `6479276`，目前的原始碼
與既有截圖版本不可互相替代。

| Ledger | 問題／source 修正 | 本輪測試證據 |
| --- | --- | --- |
| 002 | 長關係標籤跨欄或裁切；`bfad57e` | 以真 TagRelationsPanel SSR 保留完整長字串、href、上層註記；檢查可縮排容器及換行結構。 |
| 020 | 關係管理頁出現重複登入提示；`4788514` | loading／登入停用／匿名／非admin 各只一則權限訊息，未顯示editor；admin可見兩個editor，tag正規化與登入返回路徑正確。另以真子元件AST核對mock保留的AdminGate契約。 |
| 027 | 窄螢幕空篩選訊息被寬表格裁切；`e0eb4dd` | 真 MediaCrawlersTable SSR 測初始空集合及篩選後空集合，訊息位於真TableScroller外；有結果時不顯示空訊息。 |
| 028 | 搜尋建議浮層遮住sticky導覽列；`6479276` | 真SuggestInput以明確hook狀態SSR；確認combobox/listbox ARIA連接與selected option，popup z-20低於header z-30。 |

測試檔：`web/test/four-issue-ui.spec.ts`，11項通過。命令使用 `nice -n 19`、
Vitest `--project unit --maxWorkers 1`，停用CI／coverage；Biome通過。
測試只在記憶體轉譯TSX、mock明列的imports及SSR，不開browser、socket、DB或Redis，
也不安裝依賴。執行log：
`/home/deck/tag-analysis-private/ui-review/f1/four-issue-unit-tests.log`。

獨立reviewer `/root/pending_sha_audit`（GPT-6.1 Sol）另審測試真實性與限定新測試檔的
TypeScript diagnostics；紀錄：
`/home/deck/tag-analysis-private/ui-review/f1/freeze-unit-independent-review.log`。
初次發現的session union型別錯誤已修正；獨立復驗於 `2026-10-12T23:07:13.695197+00:00` 對兩個新測試檔的限定diagnostics均回傳空陣列（noEmit、incremental=false）。這不是整站typecheck，也不把Vitest轉譯成功當成型別檢查通過。

這些是行為／DOM結構／class契約測試，**沒有量測瀏覽器像素、overflow或實際stacking**。
SSR hook狀態不是鍵盤、effect、focus與blur的瀏覽器驗收；editor mocks不替代真管理工作流程。
未跑舊版本mutation反證。四列因此仍是 **issues，待同SHA雙寬畫面復驗**；
不因新增測試改成fixed/pass。

提交由主agent整合，hash見Git及交接。部署狀態：未部署；先前正式版本紀錄仍為
`0dd38b6`，本輪沒有probe或重新驗證正式站。
