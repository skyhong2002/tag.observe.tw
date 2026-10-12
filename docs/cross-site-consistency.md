# 三站呈現一致性參考（T-ref）

以新文易數既有元件為基準；blog 與 YouTube 應盡可能直接沿用實作與外觀。只有功能目標不同時才偏離，並在各站的 `docs/ui-review-ledger.md` 逐頁寫明理由。同一資料的名稱、來源、時間範圍與狀態應有相同含義。以下未寫前綴的元件檔名位於 `web/src/components/`；`app/`、`components/` 短路徑位於 `web/src/`。

## 元件與可直接沿用的樣式

| 場景 | 實作參考 | 呈現約定 |
| --- | --- | --- |
| 導航與版面 | `web/src/components/SiteHeader.tsx`、`SiteNavigation.tsx`、`NavPending.tsx`、`web/src/app/(site)/layout.tsx` | 沿用桌機／行動導航、當前頁標示和導覽載入狀態，不另造首頁以外的導航模式。 |
| 表格排序、篩選與捲動 | `web/src/lib/table-styles.ts`、`web/src/components/TableScroller.tsx` | 直接使用 `table.cell`、`table.num`、`table.row`、`table.lead`、`table.leadHead`、`table.leadBox`、`table.leadExtra`、`table.stack`；寬表橫向捲動、首欄固定，窄文字表搭配 `data-label` 堆疊。各頁排序與篩選須保留可見狀態。 |
| 文章列、卡片 | `web/src/components/ArticleListItem.tsx`、`ArticleResults.tsx`、`EventCard.tsx`、`TopicCard.tsx` | 標題為主要連結，媒體、刊登時間與原文來源另列；整列避免互相嵌套的連結。 |
| 標籤摘要、排行 | `TagSummaryCard.tsx`、`web/src/app/(site)/ranking/` 下元件、`RankingBasisNote.tsx` | 排名、篇數、分數分開標示；數字使用 `tabular-nums`；缺值保留為缺值，不能把資料不可用寫成 0。排行必須附時間窗口及基準媒體。 |
| 標籤分類與關係 | `TagGroupChips.tsx`、`TagRelationsPanel.tsx` | 分開顯示上位分類（is-a）、相關詞（related）、同義或別名（alias）。父分類可多個、可有上層；共現只屬統計。 |
| 圖片與頭像 | `ArticleThumbnail.tsx`、`SafeImage.tsx`、`TagPerson.tsx`、`TagVisual.tsx` | 使用既有處理後的圖片 URL、正確尺寸；原作者、來源連結與授權不可省略。人物素描和標誌不要當新聞現場照片。畫面外圖片延遲載入。 |
| 本頁資料來源與計算方式 | `MethodNotes.tsx`、`components/method/`、`app/(site)/@notes/` | 使用平行 `@notes` slot 對應本頁，將定義、來源、計算範圍與限制放在固定頁尾；不要每站另創同義指標。 |
| 管理表格、審核 | `app/(site)/admin/AdminGate.tsx`、`web/src/app/(site)/admin/Reports.tsx`、`web/src/app/(site)/admin/tags/TagSubmissions.tsx`、`web/src/app/(site)/admin/tag-groups/TagGroupEditor.tsx` | 登入與 admin 權限沿用 gateway；待審、已通過、未採納必須明示，留來源與審核理由；只在成功回應後更新畫面。 |
| 使用者投稿 | `components/reader/TagRelationSubmission.tsx`、`app/(site)/tag/[tag]/picture/PictureVote.tsx` | 未登入提供登入返回路徑；成功提示「送交審核」，不暗示立即公開；驗證錯誤保留使用者輸入。 |

可沿用的 Tailwind 組合（色票由 `web/src/app/globals.css` 的 theme 定義；不要自行選近似橘色）：

- CSS token：`--background`、`--foreground`、`--color-background`、`--color-foreground`；品牌完整色階 `--color-brand-50`、`100`、`200`、`300`、`400`、`500`、`600`、`700`、`800`、`900`、`950`（各自映射同階 `--color-orange-*`）。
- 字型：`--font-sans`，依序 `PingFang TC`、`Noto Sans TC`、`Noto Sans CJK TC`、`Microsoft JhengHei`、`system-ui`、`sans-serif`；不要載入不同字型造成跨站行高漂移。
- 深色沿 `[data-theme="dark"]` 與 `dark:` variant；表格沿 `.table-frame`／`.table-card` 的 `--table-bg`、`--table-head-bg`、`--table-hover-bg`，勿把 sticky 欄背景寫死。

- 卡片：`rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900`。
- 次要說明：`text-sm text-zinc-600 dark:text-zinc-400`；主要文字沿全站前景色。
- 一般連結：`text-brand-700 underline dark:text-brand-400`；不要只靠顏色表達操作狀態。
- 按鈕／可點標籤：`min-h-11`（44px）配合 `px-3` 或 `px-4`；圓角 `rounded-full`。不得縮成小字造成難以觸控。
- 輸入欄位：`min-h-11 rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700`；要有可見 label。
- 錯誤：`text-red-700 dark:text-red-400` 搭配 `role="alert"`；成功／載入回饋使用 `role="status"`。
- 清單：`divide-y divide-zinc-200 dark:divide-zinc-800`；行動版先單欄，寬畫面再用 `sm:grid-cols-*`，避免整頁橫向捲動。

## 資料含義與穩定識別

- 標籤文字保留原字串；使用 API 提供的 `tagId`、關係 `id` 與目標 `target.id` 做跨站識別，不用顯示名稱、排行位置或分頁游標當 ID。既有群組 ID 仍沿用。
- 讀取 `/api/v1/tags/{tag}/relations` 的明確 `type`、`source`、`status` 和時間；同義並不等於所有出現次數可以直接相加，文章要先去重。未審核內容不可當公開資料。
- 各站自己的標籤若映射到共用標籤，保留自己的 ID、來源站與共用 ID；不能覆寫 tag 的人工維護紀錄。關係和共現分開儲存。
- `articleCount` 是本站收錄篇數；快照的 active 是當時約定門檻下的比對子集，完整詞庫仍保留。來源、快照 ID、截至時間及排除原因要能查到。
- 畫面日期以 `Asia/Taipei` 呈現；API 時間使用附時區的 ISO 字串。圖表和排行清楚寫時間窗口；不存在資料與載入失敗要用不同訊息。
- 公開畫面不顯示投稿者 email 或私人理由；審核畫面沿用帳號權限，只顯示必要的投稿與稽核資訊。

## 快取與載入

- 導覽、頁尾、字雲與大量重複的文章／事件／媒體連結使用 `prefetch={false}`，避免只瀏覽一頁就替多個目的頁發起 RSC 查詢。保留點擊時的 Next Link 導覽；若個別頁要預取少數連結，需說明預算並量測實際請求數。候選修正與原始請求盤點見 `rsc-prefetch-audit-20261013.md`。
- 公開資料 SSR 平行取得，互動部分才使用 client component；`web/src/lib/api.ts` 的匿名 GET 有短期 revalidate 與失敗重試。不要讓使用者 Cookie/token 進入共用 SSR fetch。
- 所有 `/api/v1` 請求若帶 Cookie、Authorization、X-Service-Token 或 X-Api-Key，回應為 `private, no-store`；錯誤與限流回應 `no-store`。只有匿名成功回應能公開快取。下游遵守實際回應標頭，不另猜 TTL。
- `/auth/*`、管理與投稿一律 `cache: 'no-store'`、同源 credentials；寫入要求同源 Origin 與後端權限。前端 `AdminGate` 僅控制呈現，不能代替授權。
- loading 顯示「載入中…」；空集合說明「尚未收錄」或「沒有待審投稿」；失敗顯示獨立錯誤且可重試。切換篩選／分頁要忽略過期請求，不把舊頁誤畫到新狀態。
- 圖片審核通過後才可進公開候選與投票；重用既有轉檔、授權確認、上傳額度和重新驗證頁面機制。
- GA 的 DNT、GPC、自動化、bot 與 opt-out guards 全部保留；管理、搜尋與私人頁不送事件。開發、測試與跨站驗收不得送合成 GA 事件。
