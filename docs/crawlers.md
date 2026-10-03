# 爬蟲

舊站 cron 的 190 支 PHP 爬蟲（列表 `*_index.php`、內文 `*_tag.php`）已全部以 Node 重寫，由 `tag-worker.service` 排程，寫入自家 MariaDB 的 `articles`／`article_tags`。

## 引擎（`app/src/crawl/`）

| 模組 | 用途 |
| --- | --- |
| `fetch.ts` | 下載：瀏覽器 UA、逾時、大小上限、charset 偵測（Big5 等）；Cloudflare 擋 Node TLS 時改用 curl；同一轉址鏈內保留 cookie；每一跳檢查 DNS 拒絕私有位址（SSRF） |
| `feed.ts` | RSS 2.0／RSS 1.0（RDF）／Atom／News sitemap／純 sitemap |
| `html-list.ts` | 無 feed 媒體：標記式列表（舊規格）或 `list.discover` 同站連結探索 |
| `article.ts` | 內文：news_keywords → keywords → article:tag → JSON-LD → 站別標記；發布時間、og:image、canonical |
| `title-tags.ts` | 頁面沒有關鍵字時，用其他媒體常用的標籤比對標題 |
| `sources.ts`、`sources/overrides.ts` | 由舊 PHP 規格產生的 `app/data/crawl-sources.json`；手動修正只放 overrides |
| `registry.ts` | 啟用來源；停用清單 `app/data/crawl-disabled.json`（附原因）＋ `CRAWL_DISABLED` |
| `pipeline.ts` | `runIndex`（列表 → upsert，feed 自帶標籤立即寫入）、`runArticles`（抓未抓過的文章，429 時停止該批） |
| `topics.ts`、`topic-page.ts` | 議題表：各媒體專題頁 |

來源規格常用欄位：`list.include`（網址路徑過濾）、`list.articleId`（同一篇多網址時的文章身分）、`list.titleInclude`、`titleSuffix`（去掉標題後的站名）、`article.provider`（聚合站只收自製內容，其餘記在 `rejected_urls`）、`article.jsonTags`、`tagSelector`、`skipMeta`。新增或替換來源時，也要更新 `app/data/media-catalog.json` 的分類。

## 工具

- `node --env-file=.env tools/crawl-once.ts <media> index|articles`：單跑一個來源。
- `tools/cleanup-crawl-quality.ts`（預設 dry run，`--apply` 才寫入）。
- `npm run crawl:coverage`：依指定 29 家媒體的流量權重檢查最近 48 小時實際收錄覆蓋率，低於 95% 時 exit 1。
- 驗證修正要看實際**插入**的列數（`crawl_runs.inserted`、`articles`），不是列出的項目數。
- 定期稽核：各媒體 48 小時標籤率、日期未定比例、同編號重複標題、標題／網址的垃圾內容掃描（過期網域可能變成賭博站）。

## 來源紀錄

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
