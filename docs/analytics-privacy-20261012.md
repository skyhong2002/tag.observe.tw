# GA 隱私修正驗證紀錄

基底 origin/main：c862552b5eea503f8947aa2206be53a1bf1af9a4。僅修改獨立 tag-vocabulary-release worktree，未修改主 checkout、其他站、release 或備份。

UTC 2026-10-12 15:26:46–15:26:49：42 項測試通過（analytics-consent、analytics-runtime、tracking-availability、reader-presence、cache-control），前端 TypeScript 檢查通過。涵蓋私人落地、私人進出、搜尋返回、公開切頁／上一頁、StrictMode 重掛、腳本延遲期間轉私人頁、看板設定固定標題、opt-out、DNT/GPC 與自訂事件共用防護。純 runtime 測試驗證 config 只一次且沒有手動 page_view；不把 mock 當成 Google 網路驗證。

## 正式驗收（2026-10-13 台北時間）

17:13 UTC 本工作依使用者指定先部署已測試的8df2828，使用既有備份、smoke及回滾流程；17:14 UTC 另一部署作業接續上線4aa4d41，包含本修正。驗收以4aa4d41為準，沒有降版或覆蓋它。最初因部署鎖及兩次部署銜接遇到舊HTML快取和暫時性API 500，均在服務穩定後重驗，不計為成功證據。

UTC **2026-10-12 17:17:22–17:21:17**，主機獨立Chromium、一般瀏覽器UA與webdriver=false，實際Google腳本與g/collect（HTTP 204）。T3協作瀏覽器明確回報host unavailable後才使用這個替代瀏覽器。僅記錄en/dl/dr/dt等欄位，不保存client ID、登入cookie或私人資料；未聲稱已操作後台DebugView。詳細證據：[Network JSON](analytics-privacy-network-20261013.json)。

| 情境 | 實際page_view |
| --- | --- |
| 公開首頁落地 → Next連結至文章 → 上一頁 | 各一次，dl依序為 `/`、`/article/`、`/`，dt均「新文易數」 |
| 公開頁 → 搜尋頁 → 返回 | 搜尋與返回零新增hit；含私人頁觸發的自訂事件也不送 |
| 公開頁 → admin/login → 返回 | 私人頁及返回零新增hit |
| admin、login、me、my、opt-out、帶q的search、article/query、帶q的article落地 | 不載入Google腳本、零hit |
| 搜尋頁落地 → 首次公開頁 | 公開頁一次，dl無query、dr僅origin |
| `/liveboard/setting/` | 一次，dt固定「即時看板」 |
| DNT、GPC、opt-out | 不載入Google腳本、零hit |

所有收錄的dl/dr均無query或測試搜尋字串。GA會延遲批次傳輸，測試需等上一個公開page_view實際送達後才開始私人頁計數；早期用固定5秒等待曾把延遲的合法公開hit誤判為私人頁新增hit，改成等待實際hit後三組切頁測試均通過。空的 `/search/` 本身會由伺服器導向公開 `/article/`；實際搜尋情境使用非空q測試。

API `/api/v1/articles?limit=1`：匿名200 `public, max-age=60`；Cookie、Authorization、X-Service-Token、X-Api-Key四種假標頭均200 `private, no-store`。API key一輪碰到429，確實為no-store；17:18:31 UTC限流窗口後成功回應也再次通過。沒有改Cloudflare設定。

## 4aa4d41來源與補審

這不是本工作的程式提交。Git作者及committer都是共用的Sky Hong，沒有session/thread身分，無法僅憑Git確認是哪一個協助者。8df2828後主線的427509f、e305d66、24654ae、4aa4d41為其他工作提交；本工作沒有替它們提交或執行正式資料庫遷移。

4aa4d41僅改 `app/src/tag-groups/relations.ts`，先從article_tags/article_writing取得符合標籤的文章ID，將游標條件下推，再STRAIGHT_JOIN文章；避免少見標籤讓MariaDB選擇掃整張articles。已補做程式審查：管理員驗證先於查詢、SQL參數綁定、UNION去重、30筆分頁及no-store皆保留。這不等同於聲稱所有熱門標籤查詢都是常數成本，候選ID仍可能很多。

UTC 2026-10-12 17:18:30，獨立MariaDB測試庫tag_admin_review_20261013的writing.spec.ts **6項通過**，包含未授權拒絕、游標驗證、關係區分、唯一ID與跨頁去重。無證據可確認該commit在另一thread部署前做過哪些審查；以上是本次補審。

主checkout原本未提交的 `app/src/admin/routes.ts`、`app/test/admin-media.spec.ts`、`docs/login.md`、`web/src/components/article/ArticleView.tsx` 及未追蹤的 `AdminFullText.tsx` 仍在原處。`git log 8df2828..4aa4d41 -- <這五個路徑>` 為空，沒有混入此次release的提交範圍；本工作未修改它們。

匿名CDN補驗：UTC 2026-10-12T17:23:14.274Z–2026-10-12T17:23:16.107Z，不帶驗收cookie的全新context，首頁與看板設定各收到一次HTTP 204的page_view，dt分別為「新文易數」與「即時看板」。
