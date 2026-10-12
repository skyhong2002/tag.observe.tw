# RSC 預取實證與修正

來源：原始 privacy flow HAR（SHA `0dd38b629621e27ccb40260a27b27cf2d7202519`）。原檔未覆寫；私有分析 `/home/deck/tag-analysis-private/f1-release/prefetch-audit.json`。

867個HAR項目；request事件日誌869次／全部request＋response＋failed事件記錄1882筆（869request＋828response＋185failed）；13步。帶Next預取header共365次（HAR的42.1%），其中共用主導航目的路徑140次。這些是請求數，不是獨立連結數。

| next-url來源 | 預取請求 | 獨立目的path | 最常預取目的path |
|---|---:|---:|---|
| `/` | 191 | 74 | `/journalist/` 7、`/media/ftnn/` 6、`/media/news_pchome/` 6、`/media/ftv/` 6、`/media/moneydj/` 6 |
| `/observe/opt-out` | 68 | 16 | `/` 9、`/article/` 6、`/event/` 6、`/topic/` 5、`/feature/` 5 |
| `/liveboard` | 37 | 29 | `/liveboard/setting/` 5、`/tag/沈伯洋/` 2、`/tag/蔣萬安/` 2、`/tag/AI/` 2、`/tag/台積電/` 2 |
| `/login` | 25 | 16 | `/` 3、`/article/` 2、`/event/` 2、`/topic/` 2、`/feature/` 2 |
| `/admin` | 24 | 16 | `/` 3、`/article/` 2、`/event/` 2、`/topic/` 2、`/feature/` 2 |
| `/search` | 20 | 17 | `/` 3、`/media/` 2、`/article/` 1、`/event/` 1、`/topic/` 1 |

## Referer分頁

| Referer | 預取請求 | 獨立目的path |
|---|---:|---:|
| `/` | 191 | 74 |
| `/observe/opt-out/` | 68 | 16 |
| `/liveboard/` | 37 | 29 |
| `/login/` | 25 | 16 |
| `/admin/` | 24 | 16 |
| `/search/?q=%E6%B8%AC%E8%A9%A6` | 20 | 17 |

## 最常預取目的連結

| path | 次數 |
|---|---:|
| `/` | 24 |
| `/article/` | 15 |
| `/event/` | 15 |
| `/topic/` | 14 |
| `/feature/` | 14 |
| `/ranking/` | 14 |
| `/similarity/` | 13 |
| `/observe/` | 12 |
| `/media/` | 12 |
| `/byline/` | 11 |
| `/media/traffic/` | 10 |
| `/writing/` | 10 |
| `/journalist/` | 7 |
| `/liveboard/` | 6 |
| `/crawlers/` | 6 |
| `/method/` | 6 |
| `/api/` | 6 |
| `/media/ftnn/` | 6 |
| `/media/news_pchome/` | 6 |
| `/media/ftv/` | 6 |
| `/media/moneydj/` | 6 |
| `/journalist/方承業/` | 5 |
| `/eve/1627/` | 5 |
| `/eve/1608/` | 5 |
| `/tag/豆腐媽媽/` | 5 |
| `/tag/李灝宇/` | 5 |
| `/tag/巴拉圭/` | 5 |
| `/tag/顧立雄/` | 5 |
| `/liveboard/setting/` | 5 |
| `/tag/沈伯洋/` | 4 |

## 判讀界線

- Historical production privacy flow only, includes reload/back/forward and account-response fixtures; not normal traffic or per unique visit.
- Referer is document-level and can remain earlier page during client navigation; next-url can be a router context rather than the current full URL. Both recorded separately; never assume their attribution equals exact click chronology.
- HAR has 867 entries while event log has 869 request events; counts are not interchangeable. The event log contains 1882 records: 869 request, 828 response and 185 failed events. Request＋response alone is 1697. A failed event is another lifecycle record for a request, not a new independent request, and can occur after response headers arrived; do not add it to request totals or treat it as a distinct HTTP error count. Route-intercepted fixture/aborted events may not have HAR entries; the aggregate 2-entry difference alone does not identify which requests are missing.
- 原始正式 privacy HAR 有789筆HTTP200、37筆HTTP429、41筆status -1；365筆帶預取header者為333筆200＋32筆-1，沒有429。429是此流程額外干擾背景，不推論所有429皆由預取導致，也不把它們當自然流量。
- A prefetch can span route-tree and segment requests. 365 entries does not mean 365 different links.
- Headers do not identify React component initiators. Component assignment is inferred from source href producers, not a proven browser call stack.
- 原始 HAR 的離線分析不包含修正後請求量；減幅必須另以相同流程的 production-mode candidate 對照，不能由新增 prop 數量推算。
- Status -1 includes unfinished/failed HAR entries; response bytes vary and are not a reliable completed-download metric here.

## 小範圍修正

依專案本地App Router Link文件，`prefetch={false}`同時停止viewport與hover自動預取，仍保留原Next Link的href、可及性和點擊client navigation。只在18個高fanout檔案的48處Link新增此prop，未做共用Link抽象或改寫112檔。

- `web/src/components/SiteHeader.tsx`：1個Link。
- `web/src/components/SiteNavigation.tsx`：1個Link。
- `web/src/components/SiteFooter.tsx`：3個Link。
- `web/src/components/FooterMethod.tsx`：1個Link。
- `web/src/components/MethodNotes.tsx`：1個Link。
- `web/src/components/MediaHoverLink.tsx`：2個Link。
- `web/src/components/WordCloudView.tsx`：2個Link。
- `web/src/components/EventCard.tsx`：7個Link。
- `web/src/components/ArticleListItem.tsx`：2個Link。
- `web/src/components/ArticleThumbnail.tsx`：1個Link。
- `web/src/components/AuthorCredits.tsx`：2個Link。
- `web/src/components/TagRelationsPanel.tsx`：2個Link。
- `web/src/components/TagGroupChips.tsx`：1個Link。
- `web/src/app/page.tsx`：17個Link。
- `web/src/app/_home/HomeRanking.tsx`：1個Link。
- `web/src/app/_home/MastheadCloud.tsx`：1個Link。
- `web/src/app/liveboard/SimpleBoard.tsx`：2個Link。
- `web/src/app/liveboard/LiveBoard.tsx`：1個Link。

元件歸因來自源码href產生位置與HAR目的path對應，HAR沒有React呼叫堆疊，不能證明每一請求由哪個元件發起。主要導覽SiteNavigation對應140次目的path，但這些path亦可能被其他卡片/連結產生，不稱140次全部來自header。首頁wordcloud、排行與事件/媒體連結、liveboard字圖及設定連結均是fanout来源；保留原tooltip資料取得（非RSC預取）及GA守衛不動。

修正已提交 `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`，candidate 建置與 smoke 通過。另一個 GPT-6.1 Sol instance 已獨立以 AST 核對 18 檔 48 處差異，移除新增 prop 後結構一致；production-mode 同13步A/B已完成，但含500、SSRtimeout與動態fallback干擾，不能當clean performance pass；候選視覺另有逐頁證據與尚未完成範圍。點擊可能增加即時 RSC 等待，屬停預取的權衡，不能先宣稱效能全面改善。

## 已完成的程式檢查

web TypeScript `tsc --noEmit -p web/tsconfig.json`通過；18檔格式檢查完成。Scoped Biome僅剩SimpleBoard原本4個hook/key警告（實為error-level diagnostics），用HEAD來源與同版config/React+Next dependency辨識於私有baseline副本確認相同4個，沒有修不相關動畫邏輯。逐檔去除新增prefetch屬性與排版空白後等同HEAD，證實href、aria與callbacks未改。建置記錄：`/home/deck/tag-analysis-private/f1-release/f1-build-225fa38.log`；獨立審查索引：`docs/ui-review/f1-candidate.md`。本修正尚未部署。

## 同流程候選量測（含干擾，不能當作乾淨效能比較）

UTC 2026-10-12T20:08:31.526218+00:00；before `3d96f612ad1f032e94f2e7835195f834f35ad096`、after `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`，同fixture bridge、1280×900、每步6秒、乾淨獨立profile，1browser串行。

| 指標 | before | after | 變化 |
|---|---:|---:|---:|
| request事件 | 1515 | 446 | 減少1069（70.6%） |
| 有預取header的request事件 | 794 | 17 | 減少777（97.9%） |
| HAR項目 | 1515 | 446 | 不與事件混算 |
| failed lifecycle事件 | 443 | 18 | 不是額外request或獨立HTTP500；可能與已有response重疊 |
| 外部完成response | 0 | 0 | 僅browser觀測 |
| GA/GTM attempted / completed | 0/0 | 0/0 | route層保護與真guard並存 |

| next-url來源 | before預取 | after預取 |
|---|---:|---:|
| `/` | 537 | 4 |
| `/observe/opt-out` | 105 | 6 |
| `/liveboard` | 45 | 0 |
| `/search` | 37 | 4 |
| `/admin` | 35 | 0 |
| `/login` | 35 | 3 |

### 實證路徑

- before原HAR/report/requests：`/home/deck/tag-analysis-private/f1-release/prefetch-before-2026-10-12T20-04-17-919Z`
- after原HAR/report/requests：`/home/deck/tag-analysis-private/f1-release/prefetch-after-2026-10-12T20-06-28-697Z`
- 私有完整分析：`/home/deck/tag-analysis-private/f1-release/prefetch-comparison.json`

### 界線

- Single controlled run per version; not production traffic or throughput benchmark.
- Before443／after18 failed events are request lifecycle records. They may overlap response records (for example, failure after headers) and do not establish443／18 additional requests, unique failing requests or HTTP500 responses. The measured HTTP500 counts are separately3／25.
- Both use same fixtureAPIbridge, mockaccount response and readonly production data; live news may change across sequential runs.
- RSC request headers count requests, not unique links. next-url is router context, Referer can remain document URL through client transitions.
- All external browser routes were blocked before first page; 0 external completed responses does not prove external receiver behavior. It does not attribute zero GA solely to any one guard.
- Next image optimizer may fetch public images server-side; only browser request transport is measured here.
- Clicks without prefetch can wait for on-demand route data. This does not establish faster clicks.
- Original formalprivacyHAR used1900ms waits/formalCDN versus local6000ms here; compare these two local runs to each other, not their total counts directly to the original869.

### 500 診斷與驗收限制

狀態：實際觀測的請求下降，**不是乾淨效能pass**。before有3個ranking500；after25個（20個avatar/visual、5個ranking），全部回應带`existing-production-readonly-get`，bridge原log證實上游正式唯讀GET真的回500。耗時before17.4–19.3ms、after2.0–99.9ms，不是bridge25秒timeout；after另有6筆SSR橋timeout（media-stats3、journalists/similarity/articles各1），不能混成這25個browser500。兩版另各18個presence403是安全橋刻意拒絕可寫GET。

20:10:20 UTC六次串行唯讀probe：avatar/visual/ranking各直連18130與橋18170，全200、2.6–95.0ms，各配對payload SHA256相同。目前不能重現；原HAR省略body、v1橋未保存500 body，因此無法確定上游瞬時錯誤的根因。没有同步job/build/CPU證據，不把load上升歸因任何指定工作。新增失敗與fallback影響可見連結數，故97.9%預取下降與70.6%總請求下降只報本輪觀測，不全歸因prefetch修正。完整私有診斷：`/home/deck/tag-analysis-private/f1-release/prefetch-error-diagnosis.json`。

root補充正式gateway journal證據：UTC 2026-10-12T20:07:31.071000+00:00的單一`DrizzleQueryError`，查詢`media_category_defs`時出現`Queue limit reached`。可確認同期間曾有DB pool queue飽和，但沒有每筆API error關聯ID，不能把28筆500全歸因該事件。沒有增加production pool或改任何正式services。後續僅after低負載檢查可確認錯誤是否消退，不能取代clean A/B；本agent未再啟動browser。

後續不再重跑舊版高預取流程，以免再次擠滿正式 gateway 的查詢等待佇列。UI fixture bridge v3 的一般資料改經已準備的新版本 API（獨立 gateway pool、相同正式資料庫，GET-only 且去除憑證）；這只能隔離 gateway 等待佇列，仍共用資料庫／CPU，因此全站負載閘門不變。新候選畫面和點擊驗收與本次含干擾的網路量測分開記錄。
