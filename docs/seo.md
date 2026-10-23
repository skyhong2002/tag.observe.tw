# 搜尋與分享預覽

- `web/src/lib/seo.mts` 統一 canonical、Open Graph URL、標題與描述；主要索引頁與事件、標籤、媒體、記者、議題／專題媒體頁均有專屬 metadata。
- Canonical 去除排序、顯示方式、UTM 等變體，保留排行榜分類、事件存檔日期／小時與媒體文章分頁游標。媒體站內搜尋變體與全站搜尋頁不建立索引。
- 根 layout 提供 WebSite JSON-LD；事件、標籤及媒體頁提供麵包屑。標籤頁的 ItemList 對應畫面上前十篇報導，不宣稱本站為原始新聞出版者，也不把新聞事件誤標成可參加的 Event。
- JSON-LD 使用 JSON 序列化並跳脫 `<`；頁面資料不直接拼接成 HTML。

## 分享卡片成本

事件、標籤使用 `next/og` 在伺服器產生 1200×630 PNG，只有抓取分享圖片時才執行。使用固定文字版型與本機中文字型，不啟動瀏覽器、不畫即時圖表，也不抓取新聞配圖。其他頁面保留全站預設圖；文章頁保留既有配圖設定。

路由明確設定 `force-static`；事件圖與事件頁同採 120 秒 revalidate、HTTP 快取 120 秒，標籤圖維持 6 小時 revalidate、瀏覽器快取 1 小時。卡片不放即時數字，避免快取期間的數字被誤認為目前值。社群平台另有自己的快取，重新部署不保證既有貼文立刻換圖。

圖片網址交由 Next 的檔案 metadata 產生（含 route group 的雜湊），不要自行猜測 `/opengraph-image` 路徑。字型約 7.1 MiB，只部署在伺服器；一般網頁不下載它。代表性標籤卡片本機實測約 42 KiB，首次生成約 270 ms，Next 快取命中約 4 ms；實際成本視標題長度、API、機器負載及冷啟動而變化。

## 驗收

檢查 SSR HTML 的 canonical、description、og:url、og:image、twitter:image，以及 JSON-LD 是否可解析；測試中文參數、日期／分類與 UTM 的正規化。沿著實際圖片 metadata URL 取圖，確認回應為 1200×630 PNG、中文字可讀、standalone release 包含字型、重複請求命中快取。不存在的事件／標籤不應產生任意內容卡片。

GSC 可針對首頁、排行榜、事件及標籤重做 URL 檢查。麵包屑／結構化資料是否顯示搜尋強化項目由 Google 決定，不保證收錄、排名或 rich result。

## 收錄品質（2026-10-05）

- 空事件日期、沒有該類內容的議題／專題媒體頁保留正常導覽，輸出 `noindex, follow`。日期校驗由正文及 metadata 共用，無效日期一致回到預設日期。
- Sitemap 只列有對應類別內容的議題／專題媒體頁，補入相似報導總覽、每日統計與方法頁。移出 sitemap 本身不等於禁止收錄，因此空頁仍須輸出 noindex。
- 文章有可讀節錄、相關事件、其他媒體相關報導，或畫面實際顯示的相似報導時保留索引；只有標題、來源摘要、標籤或到期提示時 noindex。相關資料暫時不可得且無節錄時採 noindex，下次取得資料可恢復；不批次改成原站 canonical。
- 事件描述使用實際追蹤起訖與主要標籤；標籤描述加入近 72 小時收錄的代表標題，沒有資料則使用基本描述。媒體分頁 JSON-LD URL 與 canonical 同步。
- 排行等頁面的迷你圖表改在接近視窗時才初始化，降低長列表初始繪圖成本，保留完整 SSR 文字和列表。這不會直接縮小 HTML；進一步分頁或文字雲結構調整須另量測，不能用未壓縮 HTML 大小推定 Core Web Vitals。

## HTML 體積（2026-10-05）

媒體徽章以精簡的媒體代號、名稱、篇數與傾向跨越 RSC 邊界，不再逐一傳送整段 React 標記；事件報導列同樣只傳入畫面需要的文章欄位，特別排除 `TimedArticle.outlet.articles` 的整份媒體報導集合。這些 Client Components 仍參與 SSR，原始 HTML 保留全部標題與連結。文字雲共用 CSS 取代每個詞重複的高亮樣式。

事件時間線／傾向／媒體三種檢視原本就只渲染所選檢視，維持可直接存取的 URL，沒有新增另一套按需 API 或移除內容。

在同一版本基底、固定 API 回應快照及正式建置下比較（十進位 KB；gzip 為 HTTP 回應實際收到的 body）：

| 頁面 | 原始 HTML 前 → 後 | gzip 傳輸前 → 後 |
| --- | --- | --- |
| 排行 | 1,912 → 1,491 KB（−22%） | 133 → 123 KB（−7%） |
| 事件 897 時間線 | 910 → 700 KB（−23%） | 87 → 81 KB（−8%） |
| 事件 897 傾向對照 | 904 → 722 KB（−20%） | 88 → 82 KB（−7%） |
| 事件 897 媒體對照 | 802 → 649 KB（−19%） | 80 → 75 KB（−6%） |

上述四頁及蔡英文標籤頁的可讀文字、連結、canonical、社群 metadata 逐項比較相同；標籤頁作為未改動對照組，原始 HTML 大小相同。互動資料縮減 32–40%；壓縮後降幅較小是因為重複標記原本便容易壓縮。這些數字不是 Core Web Vitals，也不代表所有頁面固定節省同樣比例。


## 摘要與公開期限一致性

- 事件頁 H1、搜尋摘要及分享圖共用代表標題選擇函式。事件圖改用與頁面相同的 120 秒重新驗證週期，移除原本可額外保留一天的 stale-while-revalidate；ISR 背景更新與社群平台自己的快取仍不保證即時換圖。
- 現有事件合併僅以 combinedFrom／combinedTo 串聯相關時段，不刪除舊頁內容；保留每段自己的 canonical，避免把不同報導集合誤當成重複網址轉址。
- 文章及專題共用的正文、metadata、收錄資格，都以公開期限再檢查 API 快取內容。期限已到即捨棄節錄，改用仍公開的來源摘要；無摘要時使用標題，沒有相關事件／跨媒體對照時 noindex。搜尋描述採用畫面相同的 readingExcerpt 規則。
- 標籤摘要採用目前選定的報導期間，與正文共用相同請求，不再固定引用另一個 72 小時視窗。
- 測試以過期但 status 仍為 ok 的快取 API 回應驗證：節錄標記不出現在 HTML 或 metadata、公開摘要仍顯示、robots 為 noindex。Google 已建立的索引及第三方分享快取須等待重新抓取，無法由本站強制刪除。

## 舊站 tag.analysis.tw 整併（GSC-20261023）

GSC 回報：新站 0 已索引、5,019 個「已發現－尚未檢索」；舊站約 132 萬已索引、83.7 萬「重複、未選取 canonical」、7.1 萬 5xx、6.8 萬 404。新站首頁 10/12 抓取成功、允許索引、自指 canonical，不是 robots 封鎖。以下為 2026-10-23 實測。

### 根因

- **舊站沒有任何 canonical**。同一頁經 `https://tag.analysis.tw`、`http://tag.analysis.tw`、`seokpi.analysis.tw`、`api2.analysis.tw`（後兩者直連 origin、只有 HTTP）都回 200；`api.analysis.tw` 由 Apache 301 到 `http://tag.analysis.tw/tag.php?tag=…`，又是另一個 200 變體。
- **臉書頁是無界爬蟲陷阱**。每個標籤頁的分頁列都連到 `/tag/X/fb/`，fb 頁再對每個標籤輸出 4 種排序 × 5 種期間（含隨時間變動的 `today`、`thisweek`），舊站約 6.9 萬個標籤乘上去即為陷阱。每次請求都對各媒體表做前置萬用字元 LIKE 掃描；資料來源 `facebook_now` 最後更新於 2024-03-07，頁面早已沒有近期內容。沒有 Apache log 可對照，與 5xx／主機問題的關聯是推論。
- **舊站對任何字串都回 200**。`/tag/{nt_id:123}/`（舊站程式與標籤表都沒有此字串，屬外部殘留網址）及沒有近期資料的標籤，都輸出約 4.7 KB 的空殼頁（`var data = [];` 加空表格）。舊站 `tags` 表內的標籤也會是空殼（例：洪篤昌、2020立委），因此以輸出內容而非資料表判斷。
- **新站本身沒有參數陷阱**：canonical 去除排序、期間等參數，camp／cursor 變體 noindex，未知標籤 404＋noindex，舊路徑 `/tag/X/fb/…` 在新站 301 到 `/tag/X/`。
- **新站容量**：10/23 約 17:00 起本機 load 50–60、zram 全滿另用 10 GB swapfile、tag-db CPU 100%；閘道一小時記錄 1,053 次 `ui origin unavailable`（Headers Timeout）。抽樣 12 個標籤頁只有 2 個 200，其餘 500／503／逾時；sitemap 產生需 13.8 秒。Google 依伺服器健康度調整抓取量，這是「已發現－尚未檢索」持續的直接風險，須先解決主機容量。

### 舊站 guard

舊站 Apache 為 `AllowOverride None`，沒有 root 權限，也不能用 `.htaccess` 或 `auto_prepend_file`。`infra/legacy-tag/seo_guard.php` 由各入口 PHP 第二行引入，只決定狀態碼、轉址與 canonical／robots 標記，不查資料庫、不改頁面內容，命令列執行（cron）時不動作。`/api/*.php` 不經 guard。

| 舊網址 | 處理 | 依據 |
| --- | --- | --- |
| `/`、`/?order=…` | canonical `https://tag.observe.tw/`，舊首頁照常顯示 | 同品牌首頁，新站為遷移後的正式站 |
| `/tag/T/`、`/cat/C/tag/T/`、`/tag/T/<參數>` | T 在新站 `tag_stats`：canonical `https://tag.observe.tw/tag/T/`；否則 canonical `https://tag.analysis.tw/tag/T/`，空殼頁再加 `noindex, follow` | `tag_stats` 只 upsert 不刪除，新站對其中標籤回 200 自指 canonical；清單由 `tools/legacy-seo-tags.ts` 產生（10/23 為 9,979 個） |
| `/tag.php?tag=T` | 301 `https://tag.analysis.tw/tag/T/` | 同一頁的查詢字串形式 |
| `/tag/T/{series,cloud,view,hour,ai}/…` | canonical 為自身、去除參數 | 新站沒有一對一頁面 |
| `/tag/T/fb/…`、`news_fb.php` | 410，不查資料庫 | 資料停在 2024-03-07 |
| 標籤含 `{}<>"\`、控制字元、空白或非 UTF-8 | 404 | 不可能是標籤 |
| `http://tag.analysis.tw/…`、`seokpi`／`api`／`api2.analysis.tw`、IP | 301 `https://tag.analysis.tw` 同路徑 | 重複主機與協定；其他 Host 不轉 |
| `/news/<媒體>/<newsid>/`、`/event/…`、`/rank/…`、`/cat/C/` | canonical 為自身、去除 query | 舊文章 newsid、事件 ID 與新站 ID 無對應，不轉址 |

刻意不在 robots.txt 封鎖 fb：封鎖後 Google 看不到 410，已收錄網址反而留在索引。舊站分頁列的「讚享評」連結改為註解，與該檔其他已停用分頁相同寫法。

保留的舊站行為：舊站持續獨立運作、頁面內容與資料庫不變；新站頁尾「母站」連結保留；`/api/*.php` 在各主機名稱照舊；`urtubeapi.analysis.tw` 在另一台主機，不受影響；新站 `legacyRoute()` 對舊網址形狀的轉址不變。

測試：`php infra/legacy-tag/seo_guard_test.php`，以舊站同版 PHP 5.4 CLI 執行，含 6 個實際舊站頁面的空殼判斷。部署：`infra/legacy-tag/deploy.sh <observe-tags.txt>`，原檔只在第一次備份到主機的 `~/legacy-seo-backup/`（docroot 外），每個檔案 `php -l` 後才換上，可重複執行；`--tags` 只更新標籤清單，`--rollback` 還原。新站執行期不連線舊站，標籤清單由操作者定期執行上述指令更新。

### Sitemap 與 robots

- 有效 sitemap 只有 `https://tag.observe.tw/sitemap.xml`：10/23 17:15 實測 7,633 個 URL（tag 5,000、eve 2,242、media 296、feature 47、topic 36、其他 12），全部 https、無 query、無重複；每小時變動。`https://tag.observe.tw/robots.txt` 已宣告。
- `tag.analysis.tw` 沒有 sitemap（`/sitemap.xml` 404）；robots.txt 只有 Cloudflare 的 content-signal 註解，沒有 Disallow。

### 狀態（2026-10-23）

guard 尚未部署到舊站。10:05–10:14 BST 之間舊站 Apache 停止（Cloudflare 521），當時舊站管理者正登入主機；部署須等 Apache 恢復並與管理者確認。正式驗證網址（部署後）：

- `https://tag.analysis.tw/` → 200，canonical `https://tag.observe.tw/`
- `https://tag.analysis.tw/tag/%E9%A2%B1%E9%A2%A8/` → 200，canonical `https://tag.observe.tw/tag/%E9%A2%B1%E9%A2%A8/`
- `https://tag.analysis.tw/tag/%E6%B4%AA%E7%AF%A4%E6%98%8C/` → 200，自指 canonical＋noindex（空殼）
- `https://tag.analysis.tw/tag/%E6%8E%A1%E6%AA%A2%E7%B5%90%E6%9E%9C/fb/sort=comment&hours=24` → 410
- `https://tag.analysis.tw/tag/%7Bnt_id:123%7D/` → 404
- `http://tag.analysis.tw/`、`http://seokpi.analysis.tw/` → 301 `https://tag.analysis.tw/`
- `http://api.analysis.tw/tag/x/` → Apache 301 `http://tag.analysis.tw/tag.php?tag=x` → 301 `https://tag.analysis.tw/tag/x/`
