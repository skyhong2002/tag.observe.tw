# 爬蟲

舊站 cron 的 190 支 PHP 爬蟲（列表 `*_index.php`、內文 `*_tag.php`）已全部以 Node 重寫，由 `tag-worker.service` 排程，寫入自家 MariaDB 的 `articles`／`article_tags`。

## 引擎（`app/src/crawl/`）

| 模組 | 用途 |
| --- | --- |
| `fetch.ts` | 下載：瀏覽器 UA、逾時、大小上限、charset 偵測（Big5 等）；Cloudflare 擋 Node TLS 時改用 curl；同一轉址鏈內保留 cookie；每一跳檢查 DNS 拒絕私有位址（SSRF），釘住全部已檢查位址，連線失敗換下一個 |
| `feed.ts` | RSS 2.0／RSS 1.0（RDF）／Atom／News sitemap／純 sitemap |
| `html-list.ts` | 無 feed 媒體：標記式列表（舊規格）或 `list.discover` 同站連結探索 |
| `article.ts` | 內文：news_keywords → keywords → article:tag → JSON-LD → 站別標記；發布時間、og:image、canonical |
| `title-tags.ts` | 頁面沒有關鍵字時，用其他媒體常用的標籤比對標題 |
| `sources.ts`、`sources/overrides.ts` | 由舊 PHP 規格產生的 `app/data/crawl-sources.json`；手動修正只放 overrides |
| `news-discovery.ts`、`news-sources.ts` | 全部新聞來源的 RSS／sitemap／首頁探索、近期完整文章驗證與啟用證據 |
| `registry.ts` | 啟用來源；停用清單 `app/data/crawl-disabled.json`（附原因）＋ `CRAWL_DISABLED` |
| `pipeline.ts` | `runIndex`（列表 → upsert，feed 自帶標籤立即寫入）、`runArticles`（抓未抓過的文章，429 時停止該批） |
| `topics.ts`、`topic-page.ts` | 議題表：各媒體專題頁 |

來源規格常用欄位：`list.include`（網址路徑過濾）、`list.articleId`（同一篇多網址時的文章身分）、`list.titleInclude`、`titleSuffix`（去掉標題後的站名）、`article.provider`（聚合站只收自製內容，其餘記在 `rejected_urls`）、`article.jsonTags`、`tagSelector`、`skipMeta`。新增或替換來源時，也要更新 `app/data/media-catalog.json` 的分類。

## 繁體收錄

`news-source-catalog.json` 的 `traditional: true` 會傳給來源設定與文章探索流程；`traditional.ts` 使用 OpenCC `cn → tw`，轉換索引與文章的標題、摘要、正文、作者、分類及標籤。聯合早報已啟用；2026-10-10 的擴充設定加入 RFA 華語、VOA 中文、澎湃新聞與新華社。這是本站轉換後的收錄文字，不代表原站提供獨立繁體網址。

原文網址、canonical、圖片網址、日期、抓取證據與供稿者標籤保留原值。供稿者標籤仍以原始文字解析來源身分，避免把澎湃的「经济日报」判為台灣「經濟日報」。RSS 的原始 HTML 保留到正文抽取完成，轉換不改寫其中的連結或屬性。既有歷史簡體文章、標籤與統計尚未回填；`media-scope.json` 的 coverage 明列這項差異。

四站各兩篇公開文章的唯讀驗證均成功，RFA、VOA 使用 RSS，澎湃與新華社使用 HTML 探索，保留原始發布時間。轉換功能的線上生效時間仍以實際部署版本為準。

| 來源 | 2026-10-10 驗證樣本（未寫入資料庫） |
| --- | --- |
| RFA 華語 | [賴清德主持國慶典禮](https://www.rfa.org/mandarin/yataibaodao/2026/10/10/taiwan-double10th-laiqinde/)；[金明日牧師獲蘭托斯人權獎](https://www.rfa.org/mandarin/xinwenkuaixun/2026/10/09/china-pastor-ezra-jin-lantos-prize/) |
| VOA 中文 | [賴清德會美國會議員](https://www.voachinese.com/a/taiwan-president-to-say-strengthening-defense-not-a-provocation-as-members-of-congress-visited-island-ahead-its-national-day-20261009/8209700.html)；[中國民兵船現身臺灣東部海域](https://www.voachinese.com/a/us-called-chinese-actions-detablising-after-militia-boat-spotted-near-taiwan-east-coast-20261009/8209675.html) |
| 澎湃新聞 | [海水倒灌專訪](https://www.thepaper.cn/newsDetail_forward_34218699)；[商業街區如廁問題](https://www.thepaper.cn/newsDetail_forward_34224652) |
| 新華社 | [十個「沒想到」](http://www.news.cn/sci-tech/20261010/52c2ae21e4ac4510924cf5c10fbc5ad6/c.html)；[月壤「時間膠囊」](http://www.news.cn/sci-tech/20261010/b6eff6a7479c469c8632279786377630/c.html) |

## 工具

- `node --env-file=.env tools/crawl-once.ts <media> index|articles`：單跑一個來源。
- `tools/cleanup-crawl-quality.ts`（預設 dry run，`--apply` 才寫入）。
- `npm run crawl:coverage`：依指定媒體中可納入統計的來源流量權重檢查最近 48 小時實際收錄覆蓋率，低於 95% 時 exit 1；原始母體、統計排除與缺口分開列出。
- 驗證修正要看實際**插入**的列數（`crawl_runs.inserted`、`articles`），不是列出的項目數。
- 定期稽核：各媒體 48 小時標籤率、日期未定比例、同編號重複標題、標題／網址的垃圾內容掃描（過期網域可能變成賭博站）。

## 來源範圍與驗證口徑（2026-10-07～10-09）

`app/data/news-source-catalog.json` 目前列出 211 個新聞來源：202608 Similarweb 快照及歷史月份來源 196 個、2026-10-04 補入 6 個國際媒體、2026-10-07 補入 9 個政府機關。這份名單描述「應核對的來源」，不等於每個來源都已成功抓取；逐站成功狀態、樣本、策略與時間以 `app/data/news-crawl-audit.json` 為準。完整對照與來源身份說明見 [Similarweb 新聞來源對照](news-source-references.md)。

目前 registry 另有 284 個啟用設定，包含一般文章、專題入口、發現器與影片來源；不同設定不一定各自代表一個獨立新聞品牌。2026-10-06 的署名稽核對 286 個設定做限制請求的唯讀抽樣：279 個收到 HTTP 回應、4 個沒有有效文章樣本、3 個是發現器或影片來源而略過。HTTP 200 仍需再檢查正文與欄位，不能把回應碼當成抽取成功；詳見 [記者署名爬取稽核](reporter-crawl-audit.md)。

2026-10-07 新增 9 個官方政府新聞來源：總統府、內政部、外交部、農業部、國防部、衛生福利部、勞動部、臺北市政府與新北市政府。它們放在新聞類別，但角色標為政府機關，不加入藍綠分類或 Similarweb 流量基準；每站先以 3 篇近期完整文章驗證，再依既有來源門檻加入排程。民國年日期只在來源規則明確指定 `publicationFormat: 'roc'` 時轉換，更新日期不會取代發布日期。行政院、經濟部、環境部、財政部與數位發展部本輪仍未通過驗證，因此不宣稱已收錄。

## 來源紀錄

### 2026-10-03：文章串聯來源的統計口徑

- 使用者澄清：試算表的「內容」指參與文章串聯的來源，**不代表內容農場**。原始出處未釐清前，不把串聯刊登視為獨立媒體報導納入統計。使用者隨後撤回停用抓取的建議，這次維持所有抓取設定與既有資料。
- 檢查試算表 55 列「內容」標記，現有來源名稱／列表網域未直接符合；其中 15 列有明確網址，對照資料庫所有文章網域也未找到相符資料。現有排行、事件與媒體篇數不需扣除文章，也不刪改歷史快照；這不代表已完成其他媒體內每篇文章的溯源。
- 流量基準保留原始 29 家、253.287，統計時排除「內容」類別的蕃新聞（0.789），有效分母為 **28 家、252.498**。排除同時作用於分子與分母，即使未來抓到蕃新聞，也不能自動計入。報告的 `excluded` 保留來源與理由，不再把它列為應補抓的 `missing`。
- 新增來源時要對照試算表標記；參與文章串聯且未溯源者不得直接加入統計。Yahoo 仍只收自製、鏡新聞仍排除合作稿；本次沒有建置跨媒體稿件溯源。

以下早先的 29 家覆蓋率紀錄為當時口徑；現行統計依上述排除規則。

### 2026-10-03：UDN 當日沒有新聞

- 原先抓每週封存 sitemap，2,154 篇的 `lastmod` 完全相同；純 sitemap 每檔最多 300 篇，因此每輪重讀同一批舊文。修正前最新文章停在 10 月 2 日 23:38，10 月 3 日收錄 0 篇，列表工作仍顯示成功。
- 改讀官網 robots.txt 列出的 `sitemap/gnews/2` 與 `sitemap/gnews/1015`，跟進各分頁。新聞 sitemap 直接提供標題、發布時間與標籤，不套用純 sitemap 的 300 篇限制。
- 首次實跑列出 1,232 篇、實際補入 812 篇；當日文章從 0 增為 445 篇（442 篇帶標籤），最新發布時間恢復到 16:05，抽抓 20 篇內文皆成功。回歸測試涵蓋多分頁及超過 300 篇的新聞 sitemap。
- 媒體顯示名稱改為「UDN 聯合新聞網」，方便辨識。48 小時流量覆蓋率只能證明期間內有收錄，不能當作即時更新正常；仍須查看媒體頁的最新文章時間及 `stale` 狀態。

### 2026-10-03：指定媒體流量覆蓋率與藍綠分類

- 基準：[使用者提供的試算表](https://docs.google.com/spreadsheets/d/1B5RsSVZSrjKSUFDFZ-2VVlU3-tpTN49J1YzLGOohalM/edit)，2026-10-03 透過 CSV 匯出讀取。`app/data/traffic-baseline.json` 保存截圖指定的 29 家「流量」及原始分類；分母固定 **253.287**，目標 **95%**。這是指定來源的流量權重覆蓋，不代表全台市占、去重訪客或已收錄 95% 文章。基準更新時須重新讀取試算表並檢查範圍，不在排程中自動更換分母。
- 原本 25 家占 **98.0358%**。新增鏡報（即時列表）、鏡新聞（八個新聞分類，只收自身 `/story/<日期><代碼>`，不收 `mm-`／`md-` 合作稿）、知新聞（即時列表），皆每 9 分鐘探索文章，內文階段補發布時間、關鍵字及圖片。列表卡片用 `titleSelector` 避免日期、分類及摘要混入標題。
- 三家加入後，設定來源占 **99.6885%**（28／29 家）。蕃新聞 **0.3115%** 暫未納入：抽樣文章為合作媒體稿件，首頁也混有舊文章；仍列在分母與缺口中。
- 首次實抓：鏡報插入／內文成功 23 篇、鏡新聞 26 篇、知新聞 24 篇，73 篇皆取得標籤；其中近 48 小時且日期確定分別為 20／12／24 篇。以實際資料庫重算的覆蓋率為 **99.6885%**，不是只計設定檔。
- 每 15 分鐘的 crawl-health 工作計算 `tag_crawl_traffic_coverage_ratio`（0–1）並記錄完整結果。只有啟用排程、最近 48 小時實際入庫且發布於該期間、有標題且取得發布時間的來源才計入；只列出連結、無日期、未來日期、停用來源都不算。每家只計一次流量權重，缺少來源仍保留於分母。`npm run crawl:coverage` 可取得相同報告。
- 藍綠分類依本次試算表更新這 29 家，其他來源維持原設定；「多元」「內容」不歸藍綠。新增藍營分類：ETtoday。新增綠營分類：鏡週刊、上報、鏡報、FTNN、新頭殼、太報、鏡新聞、華視、央廣。分類共用 `media-catalog.json`，套用於媒體頁、排行篩選及事件標題對照。

### 2026-09-29：資料品質

| 問題（實測） | 修正 | 結果 |
| --- | --- | --- |
| TVBS／CTiTV／CTS／TTV／on.cc 的文章永遠沒有標籤（舊站沒有這些媒體的 `*_tag.php`，內文階段停用），3 天內 1,400+ 篇不計入排行 | 內文階段涵蓋所有來源：有舊 tag 腳本的抓全部，其餘只抓列表沒給標籤的文章，未標籤優先 | TVBS、CTiTV 部署後開始補標籤 |
| 抓了內文仍無關鍵字（mirror、nextapple、dramaqueen 等） | 標題字典備援：其他媒體 30 天內 ≥3 篇用過的標籤比對標題；兩字詞需 ≥10 篇；拉丁字需字邊界；《作品名》只整體比對；排除舊站 no-equal 泛用詞 | 字典約 2,200 詞；重做後 128 篇中 80 篇取得標籤，其餘寧缺勿濫 |
| http／https、追蹤參數造成同文重複 | `url_key`（去 scheme、去追蹤參數、忽略尾斜線）＋每媒體唯一索引 | 合併 16 筆重複 |
| **10 個 2026-09-28 回報為「已恢復」的來源實際插入 0 篇**（纯 sitemap 無標題被丟棄；14 天過濾在格式化時遺失；比對工具只數「列出」不數「插入」） | 允許無標題項目、由內文 og:title 補；恢復 14 天過濾；纯 sitemap 只收有日期的項目；sitemap index 依 lastmod 取最新子檔（UDN 先前讀到 2020 年檔）；Foodnext 改連結探索 | 10 個全部實際插入（UDN 7,030、supertaste 1,837、commonhealth 911…） |
| 停用來源不會自己復活 | 每週一 05:30 探測（robots sitemap、常見 feed 路徑、首頁文章連結），結果存 `source_probes` 並 warn log | 首次探測找到 EDH（已啟用）；lihpao 為誤判（月份封存連結） |


### 2026-09-29 晚：媒體頁暴露的資料問題

- **停用清單從未生效**：`crawl-disabled.json` 只被 import、沒被使用；24 個失效來源每 9／60 分鐘照抓，健康檢查一直回報 19 個「失敗」。`registry.disabled()` 現在同時讀檔案與 `CRAWL_DISABLED`，媒體頁共用同一份。
- **cti 是 ctitv 的重複**（同一個 ctinews.com，一個抓整站 sitemap、一個抓新聞 sitemap）：刪除 cti 的 3,403 筆。
- **一篇多網址**：太報同一篇掛在每個分類下（`/news/content/<分類>/<id>`），7 天 1,339 筆只有 435 篇；端傳媒有 `-zh-hans` 複本。來源規格新增 `list.articleId`（第一個捕獲群組即文章身分），列表階段與 `url_key` 都用它去重；plain sitemap 的 300 筆上限改在去重後計算。
- **非文章頁**：康健（頻道、期刊、訂閱頁）、女人我最大（分類分頁）、食尚玩家、端傳媒。新增 `list.include`；女人我最大改用 `recent_article_sitemap.xml`，端傳媒改用 Ghost RSS（文章 sitemap 超過 8 MB 上限）；食力只從「即時新聞」區探索（頁面沒有日期，首頁混著多年前的專欄）。
- **標題站名**：新增 `titleSuffix`（聯合、中天、太報、NOWnews、公視、康健、食尚玩家、女人我最大、T客邦）。
- **發布時間**：依序讀 `article:published_time`（property 或 name）、`itemprop`、`publish-date`、`my:publish_date`、`pubdate`（`20260929` 視為台北零時），再讀 JSON-LD `datePublished`（含 `&#x2B;` 實體）。FTNN、天下、數位時代、太報、東網原本全部落到抓取時間。取消「400 天內」限制，舊文就是舊文；日期確定後 `article_tags.published_at` 一併更新。只抓無標籤文章的來源，發布時間未定的文章也會抓內文。
- **HTTP 429**：康健兩天失敗 2,522 次（中時、中天、NIUS、天下也有）。遇到 429 停止該批，其餘留待下一輪；一般失敗一小時後重試一次，第二次標為 `failed`。標題標籤工作不再把 `error` 覆寫成 `title-none`。
- 清理：`tools/cleanup-crawl-quality.ts`（預設 dry run，`--apply` 才寫入）。

### Yahoo：只收自製內容

使用者決定（2026-09-29）：Yahoo 只抓自製內容。Yahoo 的 RSS 全是合作媒體（三立、中央社、風傳媒…），不能用。改從「Yahoo特派」、「Yahoo畫重點」、「財經特派」三個專區探索文章連結，抓內文時讀頁面內嵌的 provider 名稱，**名稱含 Yahoo** 才保留（Yahoo新聞編輯室、Yahoo特別企劃、○○｜Yahoo名人娛樂特派記者、Yahoo財經編輯室、Yahoo股市、Yahoo電影戲劇）。專區頁也會連到思想坦克、美麗島電子報、理財周刊等合作文章，這些會刪除並記在 `rejected_urls`（migration 0007，保留 30 天），下一輪列表不再插入。Yahoo 網址含百分比編碼標題（最長約 495 字元），去重鍵改用結尾 9 位數文章編號。

### 從未產出的來源

- **環境資訊中心**：RSS 404、sitemap 只有靜態頁；改從「新聞」「專欄」區探索 `/node/<id>`（頁面有發布時間與 `article:tag`）。
- **1111 人力銀行**：sitemap 完全沒有日期（純 sitemap 規則因此一筆都不收）；改從新聞首頁探索 `/news/jobns/<id>`。
- **旺報**：已成為中時的報紙分類（2603xx），中時的即時新聞 sitemap 不含；從 `chinatimes.com/newspapers/2603` 探索。
- **新新聞**（new7）：RSS、sitemap、首頁都是 Cloudflare JS 挑戰，curl 也過不了；維持關閉。
- **台灣動物新聞網、想想論壇**：網域已不解析；維持關閉。
- `social.php`：舊站抽設定時混入的檔名，不是媒體；本來就不在排程分組裡。
- 圖片白名單：`pages.dev`、`ghost.io` 任何人都能開子網域，改列為共用主機（只放行實際出現的完整主機）。

### 長期沒有新文章的來源（抽樣文章頁日期，2026-09-29）

- **硬是要學**：網站每天更新，只是 Feedburner feed 停了；改用 `soft4fun.net/feed`。
- **健康醫療網**：每天更新，RSS 已轉址失效；改從首頁探索 `/article/<id>`。
- 停用：旅飯、MPlus（最後 2022）、觀策站（2024-02）、娛樂重擊（2024-06）、NOM（2025-03）、Global Voices（feed 停在 2025-06，網站一年只有幾篇）、Cheers（RSS／sitemap 被 Cloudflare JS 挑戰擋下）。

### Issue #4：替代來源

- **ELLE**：`elle.com/tw/sitemap_google_news.xml`（Google News sitemap，有發布時間）。
- **哈佛商業評論**：`hbrtaiwan.com/sitemap/sitemap-articles.xml`（純 sitemap，文章頁有日期；無關鍵字，靠標題比對）。
- **國家地理**：首頁探索 `/<分類>/article/content-<id>.html`；頁面沒有發布時間，只有新出現在首頁的文章才計入（第一次啟用時首頁既有的約 20 篇會被當成當天）。
- 仍無法恢復：商周（連線失敗）、DIGITIMES（列表無日期、需登入）、GQ／報橘／好房網／農傳媒／新聞市集／沃草（首頁無可解析連結或 403／429）、思想坦克（連線失敗）、Events in Focus（頁面無日期也無關鍵字）、HypeSphere（最後 2026-04，一年幾篇）。

### 新增舊站沒有的媒體（2026-09-30，使用者同意）

- **中視新聞**：官網新聞是 JS 載入，只有一份「熱門新聞」JSON（不即時）。中視新聞實際發在 YouTube，改抓頻道 RSS（最新 15 部，每 9 分鐘），`list.titleInclude` 只收標題含「│中視新聞」且非直播的片段；影片關鍵字是整個頻道共用的樣板（「台湾,台湾新闻,中時電子報」），`skipMeta`，只用標題比對。
- **Taipei Times**：RSS 1.0（RDF），feed 解析器新增支援；日期只到日（紙本）。頁面關鍵字只有報名，`skipMeta`。英文標題幾乎對不到中文標籤，主要計入文章數，對排行影響很小。
- **經濟日報**（`udnmoney`）：Google News sitemap（`money.udn.com/sitemap/gnews/1001`），涵蓋全部頻道。
- **MoneyDJ**：RSS 中心，JSON-LD 有關鍵字。
- **LINE TODAY 不加**：首頁文章全部來自其他媒體（自由、CTWANT、三立、中央社、鏡週刊、TVBS…），看不到自製內容；依 Yahoo 的原則（只收自製）收不到東西，收合作文章則與已抓的媒體重複。
- 分類：中視、Taipei Times → 新聞；經濟日報、MoneyDJ → 財經。

### 2026-10-01 全面稽核（105 個啟用來源，看 48 小時的標籤率、日期、抓取失敗、重複標題）

- **一篇多網址**：自由時報（`/news/<分區>/breakingnews/<id>`，7 天 806 組重複）、TVBS、工商時報、經濟日報，加 `articleId`。
- **新國會**：WordPress 網址 `/?p=123` 的路徑是 `/`，被「首頁連結」規則全部丟掉；現在有查詢字串就不算首頁。
- **華人健康網**：feed 用小寫 `<pubdate>` 且無時區；支援之，無時區的時間一律視為台北時間（不依賴主機時區）。
- **巴哈姆特 GNN**：頁面沒有 keywords meta，標籤是 `search_tag.php` 的 #hashtag 連結（`tagSelector`，去掉 #）；移除舊的 Firefox 31 UA。
- **報導者**：標籤在頁面 Redux 狀態的第一個 `"tags"` 陣列（新規則 `jsonTags`；後面的陣列屬於相關文章）。
- **SHOPPING DESIGN**：母公司 bnextmedia 的 SSO 會先 302 到 `sn-myalb.bnextmedia.com.tw` 設 cookie 再轉回；沒有 cookie 就無限轉址。fetch 現在在同一次請求的轉址鏈中保留 cookie（依 Domain／主機比對，不跨請求保存）。
- **overdope 停用並刪除 2,394 筆**：網域已變成印尼老虎機垃圾站（`/gacor1/`、`/gacor2/`），其中 38 筆帶了 251 個標籤進排行。全站標題掃過賭博／廣告字詞，其他媒體沒有被污染。
- **戲劇女王停用**：網站最後一篇 2026-06-17。
- 低頻但正常：報導者（連假）、苦勞網、女人迷、Pourquoi（約月更）。日經中文網、PeoPo 頁面沒有標籤，只能靠標題比對（日經是簡體，對中率低）。
- 清理：`tools/cleanup-2026-10-01.ts`＋再跑一次 `tools/cleanup-crawl-quality.ts`。


### 2026-10-03：Similarweb 全部新聞來源

- 名單採 `news-source-catalog.json`，最新月 197 列合併為 192 個來源，加上 4 個歷史獨有來源，共 196 個。每個可確認網址都有既有解析器或自動探索設定。原有 29 家流量覆蓋率基準維持獨立。
- 自動探索優先讀官方 feed，再探索同站新聞 sitemap／首頁文章；支援 WordPress、Elementor、Founder 報紙版型與同站 meta refresh。只接受近 14 天、非未來、具有真實發布時間、標題和至少 200 個非空白字元內文的文章。摘要、分類頁、產品頁、付費牆與不可確認日期的頁面不算成功，sitemap lastmod 不能代替發布時間。
- 所有下載沿用 DNS／轉址檢查、大小及逾時限制；429 停止該站。每輪有請求與文章數上限以控制負載，但來源名單沒有 29 家或前 N 名限制。舊 Yahoo 自製稿件 provider 限制保留。
- `news-crawl-audit.json` 保存逐站時間、策略、失敗原因、真實標題／日期／內文字數樣本。新增來源僅在同網址實測成功後加入 hourly 排程；找得到 feed 或只建立設定都不會啟用。既有來源沿用原規則及停用名單。
- 未成功的新來源每週隨 probe job 重新探索，完整文章驗證結果記入 `source_probes`。probe 不直接改啟用狀態；重跑 audit、核對 diff 並更新部署後才採用新證據。更新 JSON 後需要重啟 worker，registry 不會在同一程序熱載入。
- `crawl:sync-news` 將全部來源註冊進 API 名稱與新聞分類，保留既有名稱、圖示及藍綠設定；新來源不自動推論政治傾向。

```sh
npm run crawl:sync-news
npm run crawl:audit-news -- --concurrency 6 --samples 2
# 單站修正後重測；--resume 可續跑同一份報告未完成的來源
npm run crawl:audit-news -- --media focusnews --samples 2
# 真正經 runIndex + runArticles 入庫；預設全部已啟用的新自動探索來源
npm run crawl:news-once -- --limit 3 --concurrency 3
```

評估過 [RSSHub 官方路由](https://github.com/DIYgod/RSSHub/tree/master/lib/routes)、[Crawlee](https://crawlee.dev/js/docs/introduction) 和 [Trafilatura](https://trafilatura.readthedocs.io/en/latest/usage-cli.html)。本次沿用既有 Cheerio／feed 解析器與排程，擴充共同探索引擎；不新增外部 RSS 服務或瀏覽器依賴。僅接受可確認文章身分及公開狀態的 JSON／React 伺服器輸出；仍需瀏覽器執行、反爬阻擋、停止更新或未找到完整內文的站會明確顯示未成功，後續可據逐站證據加專用解析器。

首次驗證快照（2026-10-03）：197 個來源中 107 個驗證到近期完整文章、89 個未成功、1 個官方網址未確定。成功者包含 38 個既有爬蟲及 69 個新增自動探索來源。新增 69 個來源逐一經正常列表／內文流程實際入庫，每站 2 篇，共 138 篇，資料庫均確認 `body_status=ok`。這是一次性實測結果，不保證來源日後持續可用；後續狀態以排程記錄與頁面驗證時間為準。


### 2026-10-03：修復未成功的新聞來源

- 補齊各站正文、標題、發布日期及新聞列表規則；文章日期只採文章本身或官方列表明示日期，不採全站時鐘、相關文章或 sitemap 更新時間。馬祖僅取新聞版首篇貼文，不把留言併入新聞。
- 修正官方搬家與新聞入口，包括立報的官方承接站 `limedia.tw`。恢復上下游公開 WordPress REST 全文；只接受明確未受保護且具有原始文章網址的公開文章。
- 加入客家電視、Miin 的公開 API，以及大愛新聞、Taiwan News、騰訊等頁面已提供的公開文章內容。解析 JSON 與已知 React 伺服器佔位替換指令，不執行網站 JavaScript；保留付費、登入及私有內容檢查。
- 只有逐站人工核對為全文的官方 RSS 才能設定 `feedBody: "full-text"`。文章頁回傳 403／404／410 時可採其 `content:encoded`；摘要不算全文，401／429 或網路／安全檢查失敗不採此回退。
- 探索時已驗證的正文直接隨索引入庫，避免再抓一次而受限。已存在但正文失敗的同來源／同網址資料可補回全文，既有成功正文及 provider 限制保留。
- 原爬蟲耗盡重試次數的近期文章，可在修正後顯式重設失敗正文的重試狀態；保留原內容與成功資料：

```sh
npm run crawl:news-once -- --media bbc --media nikkei --limit 2 --retry-incomplete
```

修復後全量／針對性重測：196 個來源中 172 個驗證通過、24 個未成功。原本 89 個未成功來源中，65 個已通過；原本 107 個成功來源均再次通過。65 個修復來源已逐一經正常流程確認資料庫中有近期完整正文；彪網媒、視傳媒正文與日期解析已個別實測通過，也補上避免舊置頂新聞耗盡額度的候選排序，但最新完整探索／入庫重測仍反覆逾時，因此仍列未成功並保持未啟用。逐站證據與檢查時間見 `app/data/news-crawl-audit.json`。

其餘限制包含 HTTP 401／403／驗證頁、入口逾時、聚合或 PTT 貼文、只有影片短摘要，以及超出 14 天的舊文。寰宇最新 30 篇公開正文為 85–158 字；恆春半島可確認文章為 2011 年；Hi 宜蘭、台灣 e 新聞與 READr 可見文章不在近期窗口內。這些情況不以摘要、修改日期或爬取當下時間充當完整新文章。

### 2026-10-03：指定媒體補抓、名稱與停用

- **鏡週刊**：官方 `rss/posts-news.xml` 可提供約 700 條自有新聞，補足原 RSS 約 150 條的範圍；保留原 RSS 去重合併，只抓 `/story`，不混入 `externals`。正常索引新增 58 篇，抽驗 4 篇正文全部成功。
- **風傳媒**：採官方 robots 公告的 `sitemaps/1/article-news-1.xml`，舊 `sitemap/news` 本次落後約 11 小時，保留為補充。新舊合併取得 538 篇，正常索引新增 77 篇，抽驗 4 篇正文全部成功；未降低日期或正文品質條件。
- **好房新聞**：原站 RSS、文章與公開 API 均回傳 AWS WAF 驗證頁，改採住展的「好房網News」專屬 byline feed。逐篇必須通過自己的 `meta[name=author]` 來源驗證；作者不符或缺漏不收。保留住展實際文章網址與刊載時間，不假裝是原站網址或原始發布時間。正常流程新增 10 篇並完成 5 篇全文，沒有抓取失敗或來源拒絕。
- **旺報**（`want`）：依使用者要求停止抓取、每週探測及公開媒體列表顯示；保留歷史文章與來源識別，不影響其他暫停來源的可見性。
- 顯示名稱改為「巴哈姆特 GNN」「ETtoday 新聞雲」「好房新聞」，舊名稱保留別名搜尋。

驗證：379 項測試通過，10 項需專用測試資料庫的整合測試未啟用；TypeScript、Biome 與 Next.js production build 通過。另已針對修復來源實際執行正常索引／正文入庫，結果如上。程式與狀態快照尚未部署，部署後需重啟 worker 才會載入新設定。


### 媒體目錄的國家、抓取方式與程式連結（2026-10-04）

`/media/` 維持緊湊的收錄統計表，國家／地區以媒體名稱旁的國旗呈現，滑鼠提示及無障礙標籤保留國家名稱。抓取方式、工具、驗證方式與程式超連結移至第三個分頁 `/media/crawlers/`，支援搜尋媒體、國家及抓法；原「流量與收錄」分頁改名為「Similar Web」，網址仍為 `/media/sources/`。`/api/v1/media-stats` 持續提供完整國家／地區及 `crawler` 描述。國家使用 `app/data/media-countries.json` 的明列清單，按媒體或在地版本的營運／發行地標示；不從文章語言、主機位置或報導地推定。Global Voices 按官方基金會所在地標荷蘭；禁聞網按其官方自述標跨國。台灣海外網及台灣 e 新聞仍待確認所在地。新加入但未核對的媒體不自動指定台灣。

抓取方式由 `app/src/crawl/source-info.ts` 讀取實際 registry 設定：RSS／Atom、XML Sitemap、JSON API、HTML 選擇器、HTML 字串標記、指定文章、Feed 全文、YouTube 影片列表及文章發現流程。自動探索同時列出可用流程與最近一次成功驗證的方式，避免把驗證樣本誤說成固定唯一抓法。下載工具明示 HTTP／Undici、curl，以及 Google 新聞解析轉址時的 Playwright／Chromium。正文欄分開表示擷取正文或只收錄標題摘要。

每列的 GitHub 超連結指向該媒體設定的實際行號、解析程式、下載工具及正文解析；沒有爬蟲者明示未設定，不製造不存在的程式連結。

### 2026-10-04：Issue #1 停用來源複查

Issue 列的 17 個「可再嘗試」來源已在 10-03 全數移出 `crawl-disabled.json`，這次逐站看實際入庫與現況：

- **DIGITIMES**：新聞 `/tech/dt/n/` 只有會員看得到全文；免費的是專欄 `/col/article/?id=`。首頁只連 3 篇，改從 `/col/` 探索，新增 8 篇，正文 11/11 成功。
- 正文 ≥ 80%，但 10-03 恢復後還沒有新插入，待排程連續 3 次入庫驗收：商業週刊、地球圖輯隊、姊妹淘、TSNA、思想坦克、Taiwan Tatler、上下游（WP API）、好房新聞（住展 byline）、焦點事件（RSS `/feed` 只有 12 則，首頁已涵蓋）、沃草（首頁約 8 篇，目前入庫 2 篇）。
- 只剩當時釘選的舊文章，之後不會再插入，已移回 `crawl-disabled.json`（舊文章保留，每週 `source-probe` 照常探測）：
  - **Cheers**、**GQ**、**報橘**：官網 RSS／sitemap／首頁都是 Cloudflare JS 挑戰（403）；Yahoo 搜尋沒有 Cheers 來源，roomie GQ 作者頁最新 2017、grinews 報橘作者頁最新 2022。GQ 另有 20 篇 gq.com.tw、Cheers 17 篇 2021 年 Yahoo 項目，正文都失敗且已達 3 次重試上限。
  - **農傳媒**：所有路徑回 Vercel Security Checkpoint（429）；近 60 天資料庫沒有「轉載自農傳媒」的轉載。
  - **動網**：`www.dongtw.com` 301 轉回自己（無限轉址），`dongtw.com` 無 DNS。
  - **風向新聞**：`kairos.news` 無 DNS，網站已不存在。

### 2026-10-04：四個失敗來源

- **國際環宇時報**（`iw_times`）：og:url 少了 `.php`（`/news_view?new_sn=`），和彪網媒／萊媒體／新視界同一套模板，但先前的修補沒涵蓋 `iw-times.com`，所有候選都被判成「canonical 不在文章範圍」，14/14 失敗。加入同一修補（編號必須相同）後，正常索引新增 12 篇，正文 12/12 成功。
- **人民網**（`people_cn`）：站別規則只列 `politics.people.com.cn`，首頁其他頻道（finance、world、ent…）的文章抓不到日期。同一模板（`.rm_txt #newstime`、`#rm_txt_zw`）已逐一核對，擴到 15 個頻道；`pic.*` 圖集不同，`tw.*` 另有規則。正常索引新增 10 篇，正文 10/10 成功。
- **中視**（`ctv`）：YouTube `feeds/videos.xml` 本身間歇回 404／500，其他頻道與外部抓取同樣失敗，uploads 播放清單 feed 也一樣；不是設定問題，失敗以外的輪次照常每天收 30 篇上下。官網 `hotNews.JSON` 最新只到 10-02，不能取代。維持現狀。
- **洞傳媒**（`taiwandom`）：整站連 `robots.txt`、首頁、WP API 都回 Apache 403（ErrorDocument 也 403），外部抓取一樣；是站方伺服器設定壞掉，不是擋爬蟲。最後一篇 09-30。不能修。10-05 仍整站 403（含 Googlebot UA 與外部抓取，Google News 最後一則 09-25），已移入 `crawl-disabled.json`，停止每 9 分鐘輪詢，改由 source-probe 每週檢查。
- **馬祖資訊網**（`matsu_idv`）：10-05 新聞看板（`topiclist.php?f=1`）最新 20 篇都只是「轉載自」自由、ETtoday、大紀元、人民網、馬祖日報等的連結，正文 23–63 字，探索時全部判為正文過短，每次都失敗。不是規則問題；轉載的原媒體已直接抓取。移入 `crawl-disabled.json`，資料保留，source-probe 每週檢查。

### 2026-10-04：12 小時高失敗率來源

統計含部署重啟時遺留的 `running` 列。共同原因在下載層，不是探索流程：

- **下載層（`fetch.ts`）**：SSRF 檢查後只釘第一個 DNS 位址。觀察者網 15 個 A 記錄中 2 個 TCP 不通、1 個 TCP 通但 TLS 卡住，DNS 輪替到它們就逾時（curl 會換位址，所以手動測都正常）。改為釘住全部已檢查的公開位址：TCP 2 秒換下一個，多位址時每輪連線（含 TLS）最多 4 秒、最多 3 輪，只在連線階段失敗時換位址，reset 不重試。另外 abort 不會中斷連線中的請求（undici 固定等 10 秒），連線逾時改以請求剩餘時間為上限。觀察者網同一篇連抓 30 次，修正前 3 次失敗，修正後 30 次全成功（最慢 4.7 秒）；正常索引 3 次都沒錯誤，11 篇已在庫，沒有新插入。
- **民視**：新聞 sitemap 在 10-03 21:38（+08）後停更，之後 80 次索引都是 0 插入，正文階段只剩已刪除文章（404，3 次後停止重試）。加抓 `/realtime/`（約 24 則），sitemap 仍放第一，恢復後照用它的日期與關鍵字；`discover` 遇到 feed／sitemap 內容時改走 feed 解析。正常索引插入 34 篇，正文 34/34 成功，都有標籤和文章頁日期。21:38–07:00 的空窗即時頁已看不到，沒有補回。
- **賴傳媒、視傳媒、彪網媒**：同一台主機 210.242.222.38，SYN 常丟（連線 1–4 秒）、首頁 TTFB 2–6 秒，單篇最慢 9 秒，8 秒逾時太緊。`requestTimeoutMs` 改 15000。重測：賴傳媒 7 篇通過（舊設定會有 1 篇逾時），各跑一次索引賴傳媒 +1、視傳媒 +1、彪網媒 0（6 篇都已在庫）。單篇逾時仍有，是主機本身慢。
- **amm新聞**：同一 IP，平常 0.1 秒，但有時 TTFB 9–17 秒（實測 5 次裡 2 次超過 8 秒），`requestTimeoutMs` 改 15000。重測 12 篇，沒有錯誤（都已在庫）。
- **銳傳媒**：失敗時 feed／sitemap 回 HTTP 500 或整站逾時，之後幾次都有入庫，排程已吸收，不改。重測 11 篇、+1。

### 2026-10-04：多日沒有新文章的 19 個來源

逐站比對官網 feed／首頁／sitemap 的最新文章與資料庫 `MAX(published_at)`。09-28 08:43 同時停住的女人迷、華人健康網、苦勞網、Pourquoi 沒有共同的程式原因：那是新 worker 對它們的第一次列表抓取，此後只有華人健康網真的漏抓。

- **華人健康網**：RSS 停在 09-23（常逾時），官網每天更新；改從首頁探索 `/Article/<分類>/<id>`。實跑插入 27 篇（含首頁置頂舊文，內文日期回填為原日期），正文 27/27。
- **環境資訊中心**：改版後新聞區卡片連結是空的覆蓋層，標題在旁邊的 `.title`，探索因標題太短全部丟棄。`discoverLinks` 在連結無文字時改讀所在 `article`／`li` 的 `.title`。插入 12 篇，正文 12/12。
- **1111 產經新聞網**：`/news/` 改為固定精選（最新只連到 167613，實際已出到 167675），分類頁靠 XHR 載入。改讀 `news/sitemap.xml`（無日期、新到舊），新增 `list.sitemapHead` 只取前 40 筆，日期由文章頁補。插入 34 篇；另補 `bodySelector`，原本所有 1111 文章正文皆 `missing`，重抓後 32/34 成功（舊的 49 篇已用完重試次數）。
- **Roomie（eld）**：首頁 10-02 後不再出現新文章，改用 `/feed`（20 篇、有日期）。插入 19 篇，正文 19/19。
- 發布者本身沒有新文章（官方最新文章日期，皆已收錄）：womany 09-23、coolloud 09-24、pourquoi 08-06（之後只有 feed 不收的每週 podcast）、dacota 10-01、flipermag 10-01、reporter 10-01、agentm 10-02、gamebase 10-02（官網列表與 sitemap 也停在 10-02 18:35）、commonhealth 10-02、ngm 10-02、civilmedia 10-02、everydayobject 10-02、bnext 10-02、pansci 10-03。foodnext「即時新聞」最後 09-30；其他欄目 10-01、10-03 各有 1 篇，依原規則不收。

### 2026-10-04：停用來源第二輪（找官方轉載管道）

不碰 Cloudflare／Vercel 挑戰，只找官網以外的正當來源：

- **Cheers**、**GQ**：已恢復。改抓官方 LINE TODAY 頻道（`today.line.me/tw/v3/publisher/100427`、`/100473`），文章頁是完整全文；新增 `today.line.me` 頁面規則，從 `<meta property="provider">` 讀合作媒體名稱，provider 不符就拒收（頁面的 `publisher` meta 一律是 LINE TODAY）。網址、發布時間都用 LINE TODAY 頁面本身的。各入庫 10 篇，正文 10/10 成功。robots.txt 允許文章與頻道頁。
- **報橘**：仍停用。`/wp-json/` 404，`/citiorange/feed/` 仍是 Cloudflare 挑戰；LINE TODAY 的 CitiOrange 頻道沒有文章；Google 新聞 `site:buzzorange.com`（TechOrange 除外）最新 2022-10，品牌已停更。科技報橘另以 `techorange` 抓取。
- **農傳媒**：仍停用。Google 新聞顯示官網仍每天更新，但找不到 LINE TODAY 頻道、MSN 轉載；udn 倡議家的農傳媒作者頁最新 2019。官網仍是 Vercel 429。
- **動網**：判定已停止。`/`、`/feed/`、`/wp-json/`、`http://` 全部 301 轉回自己，沒有設 cookie；Google 新聞 `site:dongtw.com` 無結果。
- **風向新聞**：判定已停止。`kairos.news` 仍無 DNS，搜尋找不到新網域，Google 新聞 `site:kairos.news` 無結果。
- **商業周刊**：維持官網。LINE TODAY 頻道（100421）2026-09-03 後沒更新（9 月網站遭攻擊），`m.` 轉到活動頁，`api.`／`bw.` 連不上，沒有 `feeds.`。官網連線有一半在 TLS 握手後被重設或回 HTTP/0.9 垃圾回應，curl transport 現在只對這類連線中斷（exit 1/35/52/55/56）重試最多 2 次，逾時不重試。實測一輪取得 8 篇、1 篇仍失敗（之前每小時約一半整輪失敗）。

### 2026-10-04：移除報橘、農傳媒、動網、風向新聞

依網站維護者要求，`buzzorange`、`agriharvest`、`dongtw`、`kairos` 列入 `excludedMedia`，從網站媒體目錄、爬蟲設定與圖示移除（`media-names.json`、`news-source-catalog.json` 保留歷史對照），資料庫內 8 篇舊文章一併刪除。理由見上方 10-04 複查：報橘自 2022 年後停更、農傳媒在 Vercel Security Checkpoint 後、動網無限轉址、風向新聞無 DNS。

### 2026-10-05：移除蘋果日報、overdope，恢復 NHK

依網站維護者要求，媒體目錄不再保留任何「未啟用」項目：`apple`（蘋果日報，2022 年停刊，只有歷史名稱、沒有爬蟲）與 `overdope`（網域自 2026-10-01 起全為博弈垃圾頁）列入 `excludedMedia`，overdope 同時移出 `crawl-groups.json`；資料庫內兩家都沒有文章。NHK 於 10-04 改用繁體版（zt）後，`news-crawl-audit.json` 仍是簡體版（zh）網址，網址不符使它被判為未驗證而停在 `off` 群組；本次以 zt 網址重跑 audit（verified 3 篇，api），回到每小時排程。

NHK 發布時間修正（同日）：NHK WORLD JSON 的 `public_at` 與文章頁的 datePublished 都是整份列表的重建時間，繁體版 38 篇、簡體版 76 篇各自全部同值，不是單篇發布時間。改為以文章 ID 內的日期（YYYYMMDD，日本時間）為發布日，若 `updated_at` 落在同一個日本日期則取其時刻，否則記為該日 00:00 JST；ID 日期超過 14 天或在未來一天以上的略過。資料庫既有 27 筆（15 篇簡體、12 篇繁體）已依同一規則回填。

每小時排程順序（同日）：10-05 下午多次部署使 worker 不斷重啟，`crawl-index hourly` 每輪都從頭跑、走不到排在最後的 NHK。現在兩組列表抓取都依「最近一次完成的列表抓取時間」由舊到新排序，距上次完成不到週期八成的來源跳過，中斷後下一輪會接著沒輪到的來源繼續（見 docs/architecture.md 排程一節）。

部署不中斷（同日）：worker 停止時 crawl 工作只收尾進行中的來源、不再派新的，新 worker 啟動即補跑一輪到期來源；hourly 組改為每 30 分鐘啟動一輪、來源週期維持 60 分鐘。見 docs/architecture.md 排程一節。
