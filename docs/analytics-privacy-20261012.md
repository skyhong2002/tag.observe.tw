# GA 隱私修正驗證紀錄

基底 origin/main：c862552b5eea503f8947aa2206be53a1bf1af9a4。僅修改獨立 tag-vocabulary-release worktree，未修改主 checkout、其他站、release 或備份。

UTC 2026-10-12 15:26:46–15:26:49：42 項測試通過（analytics-consent、analytics-runtime、tracking-availability、reader-presence、cache-control），前端 TypeScript 檢查通過。涵蓋私人落地、私人進出、搜尋返回、公開切頁／上一頁、StrictMode 重掛、腳本延遲期間轉私人頁、看板設定固定標題、opt-out、DNT/GPC 與自訂事件共用防護。純 runtime 測試驗證 config 只一次且沒有手動 page_view；不把 mock 當成 Google 網路驗證。

部署尚未開始：15:24 UTC `/home` 可用10,702,532,608 bytes（約9.97 GiB），未達使用者要求的10 GiB；停止大檔建置，不自行清除release、備份或worktree。正式版本仍872ef7c。詞庫匯出繼續暫停。

待空間通過門檻後，優先建置並部署本修正，保留目前release與回滾版本。部署後待驗：

1. 記錄測試UTC時間，公開首頁／排行／上一頁各一次合法page_view；Network的dl只有origin+path。
2. 私人與查詢頁落地不載入gtag，g/collect為零；從公開頁進私人頁，再返回公開頁也無新增hit。
3. 私人落地→公開頁的第一個hit無私人URL或標題，dr只有origin。
4. 看板及設定頁dt為「即時看板」；q/query/search/credit與其他參數不出現在dl/dr。
5. DNT/GPC及opt-out不送。保留實際Network證據供後台Realtime／DebugView比對。

此紀錄尚無新版部署或g/collect驗證成功的宣稱。協作瀏覽器目前的舊版頁面也未成功載入Google runtime，須在驗證時確認是否有瀏覽器端阻擋，不能將受阻的零請求誤當隱私測試通過。

同版納入API敏感標頭防護：API v1只要帶Cookie、Authorization、X-Service-Token或X-Api-Key（含無效及空字串），成功回應一律private, no-store；所有4xx/5xx/429一律no-store。匿名成功保留路由原cache政策。部署後對 `/api/v1/articles?limit=1` 驗證四種假標頭及匿名共五組curl，不變更Cloudflare設定。
