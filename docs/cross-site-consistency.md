# 三站呈現一致性參考（T-ref）

以新文易數既有元件為基準；blog 與 YouTube 應盡可能直接沿用實作與外觀。只有功能目標不同時才偏離，並在各站的 `docs/ui-review-ledger.md` 逐頁寫明理由。同一資料的名稱、來源、時間範圍與狀態應有相同含義。元件與樣式參考均列出相對儲存庫根目錄的完整路徑。此文件描述沿用約定，並非宣告 F1 已完成瀏覽器驗收或部署。

## 目前可對齊的正式基準（2026-10-15 台北）

- 正式 web：`7dc59c3c17f6d6420354c3d4df733549071f2bb4`，BUILD_ID `4nl3B-BcT4mA9uh47rm0Z`；API：`dc7b814e220606202a408d21e73b1d6e7c61fe16`。此文件後續 commit 是文件或截圖工具更新，不代表重建了前端。
- 範例：[首頁](https://tag.observe.tw/)、[標籤與關係](https://tag.observe.tw/tag/柯文哲/)、[排行](https://tag.observe.tw/ranking/)、[事件表](https://tag.observe.tw/event/)。事件頁 canonical 是 `/event/`，不是 `/events/`。
- 正式與 candidate 審查分開；實際版本、圖片路徑、raw network 和非作者看圖 transcript 放在 `docs/ui-review-ledger.md`。舊 APP677 的截圖只供歷史參考，不用來驗現在的 UI。全站65 route 的各狀態尚未全部完成。
- 原始碼可直接從上述 web commit 複製元件；一起帶它的相對 import 依賴。資料取得、路由和同源 auth 接上各站自己的 API，不能把 tag 的私有 SSR origin、服務 token 或帳號設定複製進 browser bundle。
- 已知問題不作為模仿目標：正式版部分排行、關鍵字歷史與事件時間的小字缺少深色 override，實圖低於 WCAG AA。source `58cdab2d` 已補 `dark:text-zinc-400`，尚待新產物看圖驗證與部署；下游可沿既有可讀的 `dark:text-zinc-300/400` 約定修正，不要直接複製已知低對比。正式資料載入失敗也不能拿來當合法空集合的呈現範例。

## 首頁可複用元件與 CSS module

| 實作路徑 | 可沿用的 class／元件／token | 使用與偏離約定 |
| --- | --- | --- |
| `web/src/app/_home/home.module.css` | `.home`：`--paper`、`--panel`、`--line`、`--soft-line`、`--ink`、`--muted`、`--accent`、`--tint`、`--chip`；亮／暗值在同一檔內 | 以這些 semantic token 套用卡片、邊框與文字；不要只複製亮色值或更換各站近似色。首頁使用品牌橘，藍／綠專指資料中的媒體陣營。 |
| `web/src/app/_home/home.module.css` | `.main`、`.columns`、`.left`、`.center`、`.right`、`.sectionHeading`、`.brief`、`.ranking`、`.rankBody`、`.notice` | 最大寬1152px、內距16px、欄間20px；手機堆疊和中尺寸雙欄沿檔末 media rules。若 blog／YT 沒有第三個資料欄，可以減欄，需在該頁 ledger 說明其功能差異。 |
| `web/src/app/_home/TopicPanel.tsx`、`web/src/app/_home/HomeTopicsRecovery.tsx`、`web/src/lib/home-topics.mts` | `.topicPanel`、`.topicList`、`.topicCover`、`.topicBody`、`.topicRecoveryNotice` | 有代表圖就顯示原議題圖片；載入、空資料和失敗分開。只有 SSR 缺資料才做一次 public recovery；失敗 notice 不保留320px空白。下游複用呈現時換成自己的資料型別，不硬套 tag 的篇數。 |
| `web/src/app/_home/NewsImage.tsx`、`web/src/lib/home-images.mts`、`web/src/components/SafeImage.tsx`、`web/src/lib/images.ts`、`web/src/lib/image-hosts.json` | `.picture`、`.pictureFallback`、`.pictureMark`、`.photo`；`homeImageSizes.hero/story/topic` | 圖片位置／sizes 和 CSS 尺寸一起複製；既有 topic72px、縮圖 quality65、Next WebP、lazy/low，LCP hero eager/high。無圖或載入失敗才 fallback，不能換成無關圖片；每站的圖片 host allowlist 由自己的 gateway 同步驗證。 |
| `web/src/app/_home/home.module.css` | `.campOutletLink`、`.campOutletsMore` | 正式媒體格26×26，符合24px最低觸控目標；展開按鈕44px。這是密集媒體索引的既有設計，不要再用 coarse-pointer rule 把每格放大為44px。一般操作按鈕仍以44px為預設。 |

F4 對齊應包含共用的 header/footer、method notes、表格 loading／empty／error 和兩種寬度、亮暗色。只複製首頁的一張截圖不等於逐頁對齊；資料不可用時不能顯示成0，也不能省略本頁的資料來源與計算方式。

## 元件與可直接沿用的樣式

| 場景 | 實作參考 | 呈現約定 |
| --- | --- | --- |
| 導航與版面 | `web/src/components/SiteHeader.tsx`、`web/src/components/SiteNavigation.tsx`、`web/src/components/NavPending.tsx`、`web/src/app/(site)/layout.tsx` | 沿用桌機／行動導航、當前頁標示和導覽載入狀態，不另造首頁以外的導航模式。 |
| 表格排序、篩選與捲動 | `web/src/lib/table-styles.ts`、`web/src/components/TableScroller.tsx` | 直接使用 `table.cell`、`table.num`、`table.row`、`table.lead`、`table.leadHead`、`table.leadBox`、`table.leadExtra`、`table.stack`；寬表橫向捲動、首欄固定，窄文字表搭配 `data-label` 堆疊。各頁排序與篩選須保留可見狀態。 |
| 文章列、卡片 | `web/src/components/ArticleListItem.tsx`、`web/src/components/ArticleResults.tsx`、`web/src/components/EventCard.tsx`、`web/src/components/TopicCard.tsx` | 標題為主要連結，媒體、刊登時間與原文來源另列；整列避免互相嵌套的連結。 |
| 標籤摘要、排行 | `web/src/components/TagSummaryCard.tsx`、`web/src/app/(site)/ranking/` 下元件、`web/src/components/RankingBasisNote.tsx` | 排名、篇數、分數分開標示；數字使用 `tabular-nums`；缺值保留為缺值，不能把資料不可用寫成 0。排行必須附時間窗口及基準媒體。 |
| 標籤分類與關係 | `web/src/components/TagGroupChips.tsx`、`web/src/components/TagRelationsPanel.tsx` | 分開顯示上位分類（is-a）、相關詞（related）、同義或別名（alias）。父分類可多個、可有上層；共現只屬統計。 |
| 圖片與頭像 | `web/src/components/ArticleThumbnail.tsx`、`web/src/components/SafeImage.tsx`、`web/src/components/TagPerson.tsx`、`web/src/components/TagVisual.tsx` | 使用既有處理後的圖片 URL、正確尺寸；原作者、來源連結與授權不可省略。人物素描和標誌不要當新聞現場照片。畫面外圖片延遲載入。 |
| 本頁資料來源與計算方式 | `web/src/components/MethodNotes.tsx`、`web/src/components/method/`、`web/src/app/(site)/@notes/` | 使用平行 `@notes` slot 對應本頁，將定義、來源、計算範圍與限制放在固定頁尾；不要每站另創同義指標。 |
| 管理表格、審核 | `web/src/app/(site)/admin/AdminGate.tsx`、`web/src/app/(site)/admin/Reports.tsx`、`web/src/app/(site)/admin/tags/TagSubmissions.tsx`、`web/src/app/(site)/admin/tag-groups/TagGroupEditor.tsx` | 登入與 admin 權限沿用 gateway；待審、已通過、未採納必須明示，留來源與審核理由；圖片核准須確認授權，待審圖片使用同源受權限保護的審核端點；只在成功回應後更新畫面。 |
| 使用者投稿 | `web/src/components/reader/TagRelationSubmission.tsx`、`web/src/app/(site)/tag/[tag]/picture/PictureVote.tsx` | 未登入提供登入返回路徑；依回傳的 pending／approved／rejected 顯示審核或重複投稿結果，不暗示 pending 已公開；驗證錯誤保留使用者輸入。 |

可沿用的 Tailwind 組合（色票由 `web/src/app/globals.css` 的 theme 定義；不要自行選近似橘色）：

- CSS token：`--background`、`--foreground`、`--color-background`、`--color-foreground`；品牌完整色階 `--color-brand-50`、`--color-brand-100`、`--color-brand-200`、`--color-brand-300`、`--color-brand-400`、`--color-brand-500`、`--color-brand-600`、`--color-brand-700`、`--color-brand-800`、`--color-brand-900`、`--color-brand-950`（各自映射同階 `--color-orange-*`）。
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

- 導覽、頁尾、字雲與大量重複的文章／事件／媒體連結使用 `prefetch={false}`，避免只瀏覽一頁就替多個目的頁發起 RSC 查詢。保留點擊時的 Next Link 導覽；若個別頁要預取少數連結，需說明預算並量測實際請求數。候選修正與原始請求盤點見 `docs/rsc-prefetch-audit-20261013.md`。
- 公開資料 SSR 平行取得，互動部分才使用 client component；`web/src/lib/api.ts` 的匿名 GET 有短期 revalidate 與失敗重試。不要讓使用者 Cookie/token 進入共用 SSR fetch。
- 所有 `/api/v1` 請求若帶 Cookie、Authorization、X-Service-Token 或 X-Api-Key，回應為 `private, no-store`；錯誤與限流回應 `no-store`。只有匿名成功回應能公開快取。下游遵守實際回應標頭，不另猜 TTL。
- `/auth/*`、管理與投稿一律 `cache: 'no-store'`、同源 credentials；寫入要求同源 Origin 與後端權限。前端 `AdminGate` 僅控制呈現，不能代替授權。
- loading 顯示「載入中…」；空集合說明「尚未收錄」或「沒有待審投稿」；失敗顯示獨立錯誤且可重試。切換篩選／分頁要忽略過期請求，不把舊頁誤畫到新狀態。
- 圖片審核通過後才可進公開候選與投票；重用既有轉檔、授權確認、上傳額度和重新驗證頁面機制。
- GA 的 DNT、GPC、自動化、bot 與 opt-out guards 全部保留；管理、搜尋與私人頁不送事件。開發、測試與跨站驗收不得送合成 GA 事件。
