# RSC 預取實證與修正草稿

來源：原始 privacy flow HAR（SHA `0dd38b629621e27ccb40260a27b27cf2d7202519`）。原檔未覆寫；私有分析 `/home/deck/tag-analysis-private/f1-release/prefetch-audit.json`。

867個HAR項目；request事件日誌869次／全部request+response記錄1882筆；13步。帶Next預取header共365次（HAR的42.1%），其中共用主導航目的路徑140次。這些是請求數，不是獨立連結數。

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
- HAR has 867 entries while event log has 869 request events; route-intercepted fixture/aborted events may not have HAR entries. Counts are not interchangeable.
- A prefetch can span route-tree and segment requests. 365 entries does not mean 365 different links.
- Headers do not identify React component initiators. Component assignment is inferred from source href producers, not a proven browser call stack.
- No candidate build/browser capture run by this audit; request reduction remains unmeasured until independent same-flow production-mode capture.
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

未build或開browser；需另一instance審查變更與production-mode同13步量測，再報真實減幅及點擊navigation有否受影響。點擊可能增加即時RSC等待，屬停預取的權衡，不能先宣稱效能全面改善。

## 已完成的程式檢查

web TypeScript `tsc --noEmit -p web/tsconfig.json`通過；18檔格式檢查完成。Scoped Biome僅剩SimpleBoard原本4個hook/key警告（實為error-level diagnostics），用HEAD來源與同版config/React+Next dependency辨识於私有baseline副本確認相同4個，沒有修不相關動畫邏輯。逐檔去除新增prefetch屬性與排版空白後等同HEAD，證實href、aria與callbacks未改。未build、未browser、未commit；部署狀態未部署。
