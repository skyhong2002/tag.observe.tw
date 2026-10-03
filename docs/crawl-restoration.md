# 未啟用媒體抓取修復（2026-10-03）

最新：第四輪後，原 55 個停用項目中 48 個範圍內來源已有入庫全文；5 個既有排除維持，Google 新聞與動態網 2 個仍未完成。未宣稱全部恢復。以下保留各輪證據，啟用不等於全文成功。

盤點 289 個爬蟲設定中 55 個停用／未排程項目。排除重複代碼、非媒體、已指定排除與已變質網域後，逐一試抓 49 個來源，另恢復已有近期全文驗證的東網排程。恢復 15 個，排程總數從 234 增為 249，剩餘 40 個保留明確原因。

以下第一輪為當時快照。使用者隨後明確授權收錄最新可取得的舊文章，第二輪已取消這些來源的 14 天限制；仍須真實發佈日期與完整公開正文，不能以網址日期、sitemap lastmod、摘要或登入頁代替。

## 第四輪：ENN 當日報導與 WSJ 中文公開電子報（2026-10-03）

本輪兩個來源均實際入庫，總排程 282 / 289。彙整第一至第四輪恢復清單，48 個來源均在資料庫有 body_status=ok 且非空正文；查核結果 artifacts/crawl-round4/restored-coverage.json，missing=[]。尚未完成的聚合平台沒有計入成功。

| 來源 | 完整篇數 | 真實刊期 | 字數 | 站內全文 |
|---|---:|---|---:|---|
| `cn_wsj` | 1 | 2025-10-08（僅日精度） | 1354 | [文章 8239222](https://tag.observe.tw/article/8239222/) |
| `enn` | 3 | 2026-10-03T10:44:07.000Z | 987 | [文章 8228680](https://tag.observe.tw/article/8228680/) |

- ENN 使用 17news 同集團官方公開搜尋列表，僅接受正文首段完整署名「【台灣電報記者…報導】」。同集團條款與 ENN 官網同題內容已交叉核實；不使用先前授權不明網站。實際存入 3 篇 2026-10-03 完整報導，保留 17news 刊登網址、時間與署名。證據見 artifacts/crawl-round4/enn/report.md。
- WSJ 中文《中國洞察》電子報為官方自行公開分享的瀏覽器版本，普通未登入 GET 200。只抽主文完整 16 塊（含小標），不混入其他新聞摘要、讀者來信或頁尾；主文 1312 非空白字，作者魏玲靈。這是已審核的 2025 年舊期數，較新的已知連結仍無公開完整版本，不代表一般付費文章已可抓取。
- 刊期由 WSJ 官方公開公告明示「2025年10月8日刊」及電子報可見「10月8日」交叉核實，證據 URL 存 app/data/reviewed-publications.json；不從 copyright 推測年份、不借用 LinkedIn 貼文時分。publishedAt 的 UTC 日起點只供排序，API 額外回傳 publishedDate=2025-10-08、publishedDatePrecision=day；閱讀頁及文章列表只顯示日期。模板、題目、作者、日期、段落數與完整首尾不符時不轉換，不把此日期套用其他期數。
- NOM 已識別摘要的閱讀頁改明示「原站僅提供摘要」，避免無正文時還暗示已有保存版本可讀。
- 第三輪已部署 commit `39cf526627b78628f58984b5038d080a0b3d0a7e`；部署後再次檢查聚合／聯播閱讀頁與 NOM 摘要正文撤下成功。本輪全套測試 **498 passed、10 skipped**，TypeScript、Biome 檢查通過，公開 API 文件已同步日期精度欄位。

### 仍未完成：Google 新聞與動態網

兩平台目前的官方 RSS／首頁只證實外站新聞導流，未找到平台託管新聞全文。已詢問是否將其作為文章發現來源、全文仍歸屬原媒體並保留聚合來源標記，或維持未完成等待平台全文；在使用者回答前不變更此兩站分類、不新增排除、不算收錄成功。監督器 state.json 保持未停止，目標尚未全部完成。

## 第三輪：公開聯播、聚合閱讀與摘要修正（2026-10-03）

本輪已新增 9 個來源的實際入庫全文，目前 280 / 289 個來源排程；仍有 4 個範圍內來源未完成，另 5 個既有排除保持不變。以下每站均通過資料庫 body_status=ok、正式 API 及瀏覽器正文／真實發佈日期一致的逐站驗證。

| 來源 | 完整篇數 | 真實發布時間抽樣（UTC） | 字數 | 站內全文 |
|---|---:|---|---:|---|
| `agriharvest` | 1 | 2019-09-27T02:23:33.000Z | 977 | [文章 8209815](https://tag.observe.tw/article/8209815/) |
| `buzzorange` | 2 | 2022-12-01T09:38:50.000Z | 1532 | [文章 8219254](https://tag.observe.tw/article/8219254/) |
| `cheers` | 1 | 2018-09-27T08:31:37.000Z | 801 | [文章 8209814](https://tag.observe.tw/article/8209814/) |
| `gq` | 2 | 2017-11-12T04:30:00.000Z | 534 | [文章 8219256](https://tag.observe.tw/article/8219256/) |
| `msn` | 6 | 2026-10-03T11:42:48.000Z | 252 | [文章 8200397](https://tag.observe.tw/article/8200397/) |
| `pnn` | 4 | 2026-10-02T15:13:00.000Z | 780 | [文章 8209811](https://tag.observe.tw/article/8209811/) |
| `taiwan` | 3 | 2026-09-23T23:42:42.000Z | 1244 | [文章 8219251](https://tag.observe.tw/article/8219251/) |
| `taiwandaily` | 1 | 2021-10-13T01:50:00.000Z | 2100 | [文章 8209816](https://tag.observe.tw/article/8209816/) |
| `travelnews` | 1 | 2019-10-10T03:56:46.000Z | 344 | [文章 8219258](https://tag.observe.tw/article/8219258/) |

- MSN 使用一般匿名公開新聞 feed 與 Detail API，feed 設定來自官方前端檔案，無帳號 token。核對 zh-tw、文章 ID、日期、供稿者與公開存取旗標，拒絕摘要與受限文章。
- PNN 限官方 hosted viewer 的中央社聯播，與原文比對標題、雙向正文相似度及完整末段，取原文真實發布時間；平台 API 的 publishedDate 經查是批次收錄時間，不能使用。兩平台均保留實際供稿者與可用原文來源連結。
- 中國台灣網原站持續逾時，改採新浪明確的官方帳號 1776346 公開 API 定期發現文章。保留新浪聯播 canonical、日期與中國台灣網署名，feed 日期不可補代缺失文章日期。
- Cheers 使用 Yahoo 明確署名且有完整結尾的公開授權文；農傳媒用環境資訊中心明示授權全文；美洲台灣日報使用銳傳媒具名遷移／聯播文章。這三站目前為逐篇審核過的舊文永久網址，尚未宣稱能持續取得原站當期所有新稿。
- 報橘從草根影響力明示 CitiOrange 授權的文章取得全文，供稿判斷以單篇授權欄為準，排除同作者列表混入的 TechOrange。GQ 使用 Roomie 明示授權全文，只讀第一篇 article，避免接入其後推薦整篇文章；宜蘭新聞網使用 FEARLESS 留有完整版權與原站連結的公開全文。這些舊文均保留真正發布時間，不採修改時間。
- 覆核發現 NOM 4 篇既有待抓文章（134246、134248、134249、134250）繞過 discovery 的摘要檢查，已將正文清空並標 short，不再算全文；原始資料備份在 artifacts/crawl-round3/excerpts-before.json。共用抽取層已拒絕 NOM 明示摘要、Yahoo 明示「全文未完」正文，JSON-LD 或背景補抓亦不得兜回 ok。第二輪表格與樣本已重新查核修正。
- 過期修復只允許仍在最初取得日起 90 天內、被舊發佈日政策誤清的正文，並保留原取得時間；已過真正保存期的文章不因每小時排程重置期限。人工 retry-incomplete 對 archive 來源改用近 90 天收錄時間，不再用 14 天發布日期阻擋。

### 第三輪剩餘

ENN 原站 403，部分其他網站雖有「最早出現於 ENN」全文，但尚未核實授權／合作關係，沒有當成功；官方合作網站或無對應全文、或 403/502。Google News 與動態網的 RSS／首頁均只有外站標題、導流連結或軟體公告，尚無平台託管全文證據，不自行算成功或新增排除。中文 WSJ 仍回 401／驗證限制，公開英文 Graphics 不能代替中文網。

- 全套測試 **485 passed、10 skipped**（需獨立整合環境），TypeScript 與本輪程式格式檢查通過；九站 reader 均 HTTP 200、正文與 API 一致、日期與資料庫一致。

原始 HTML、API、文章內容與時間證據保存在 artifacts/crawl-round3/；兩個聚合平台的探查亦在 artifacts/crawl-round2/platforms/aggregator-report.md。監督器保持運作，未標全部完成。

## 第二輪：舊文收錄與公開聯播（2026-10-03）

本輪新增恢復 22 個來源，另完成上一輪視傳媒的實際入庫。排程共 271 / 289；剩餘 18 個項目，其中 5 個是既有排除，13 個仍須研究，**尚未全部完成**。下表以 MySQL `body_status=ok` 及正式站 `/api/v1/articles/:id/content` 200、`content.status=ok` 為證據，不以設定啟用取代實際全文。數量包含成功修復的既有資料，非宣稱已抓完歷史全集。

| 來源 | 已存完整篇數 | 抽查真實發布時間（UTC） | 字數 | 站內全文 |
|---|---:|---|---:|---|
| `bw` | 3 | 2026-10-02T04:00:00.000Z | 1858 | [文章 8190941](https://tag.observe.tw/article/8190941/) |
| `digitimes` | 3 | 2026-10-01T16:00:00.000Z | 1896 | [文章 8186632](https://tag.observe.tw/article/8186632/) |
| `dongtw` | 2 | 2020-01-15T07:50:35.000Z | 694 | [文章 8190461](https://tag.observe.tw/article/8190461/) |
| `dramaqueen` | 16 | 2026-06-17T16:00:00.000Z | 1430 | [文章 580928](https://tag.observe.tw/article/580928/) |
| `globalnewstv` | 1 | 2026-09-22T08:04:37.000Z | 1247 | [文章 8186672](https://tag.observe.tw/article/8186672/) |
| `gv` | 10 | 2026-05-15T06:14:35.000Z | 7656 | [文章 134137](https://tag.observe.tw/article/134137/) |
| `hiilan` | 6 | 2025-06-12T09:54:22.000Z | 459 | [文章 8186666](https://tag.observe.tw/article/8186666/) |
| `jdanews` | 6 | 2011-06-16T16:00:00.000Z | 646 | [文章 8186674](https://tag.observe.tw/article/8186674/) |
| `kairos` | 3 | 2022-04-08T13:32:49.000Z | 916 | [文章 8190463](https://tag.observe.tw/article/8190463/) |
| `mplus` | 12 | 2023-01-04T02:00:00.000Z | 2202 | [文章 8186640](https://tag.observe.tw/article/8186640/) |
| `nom` | 6 | 2025-03-26T09:54:31.000Z | 2147 | [文章 134247](https://tag.observe.tw/article/134247/) |
| `nvns` | 11 | 2026-10-03T11:09:55.000Z | 1701 | [文章 8190106](https://tag.observe.tw/article/8190106/) |
| `pantravel` | 10 | 2024-01-02T06:12:12.000Z | 755 | [文章 134147](https://tag.observe.tw/article/134147/) |
| `punchline` | 10 | 2024-06-26T06:58:51.000Z | 755 | [文章 133687](https://tag.observe.tw/article/133687/) |
| `readr` | 6 | 2026-03-16T12:00:00.000Z | 14497 | [文章 8186679](https://tag.observe.tw/article/8186679/) |
| `reuters` | 3 | 2024-10-16T02:00:00.000Z | 10664 | [文章 8190527](https://tag.observe.tw/article/8190527/) |
| `rwnews` | 3 | 2025-09-29T08:48:28.000Z | 967 | [文章 8190557](https://tag.observe.tw/article/8190557/) |
| `taiwanenews` | 1 | 2026-09-28T16:00:00.000Z | 991 | [文章 8186685](https://tag.observe.tw/article/8186685/) |
| `thepaper` | 6 | 2026-10-03T11:43:00.000Z | 1342 | [文章 8186659](https://tag.observe.tw/article/8186659/) |
| `tnews` | 1 | 2026-10-03T09:19:00.000Z | 762 | [文章 8190692](https://tag.observe.tw/article/8190692/) |
| `tristarnews` | 6 | 2026-10-03T12:35:00.000Z | 441 | [文章 8186660](https://tag.observe.tw/article/8186660/) |
| `viewpointtaiwan` | 6 | 2024-02-26T01:15:53.000Z | 1759 | [文章 8186648](https://tag.observe.tw/article/8186648/) |
| `voachinese` | 6 | 2026-10-02T22:14:46.000Z | 1970 | [文章 8186642](https://tag.observe.tw/article/8186642/) |

- 舊文保留實際發佈時間；正文從 `content_fetched_at` 起算 90 天，舊資料缺值才回退 `crawled_at`，不再按發佈日期立即過期。待抓範圍依收錄日期；description 原有保留方式不變。
- 動網與風向使用 Yahoo 明確署名的公開聯播永久網址；三星傳媒用蕃新聞、菱傳媒用民視具名聯播，逐篇檢查供稿者。保留聯播網址與其公開發佈時間，不推測原站網址。動網特定舊頁 JSON-LD 使用修改日期，改取可見原發布欄位。
- Reuters 僅收錄公開免費 Graphics，首頁按可見日期排序取得 2024 年最新可讀文章；DIGITIMES 使用公開專欄。沒有繞過登入或付費限制。
- NOM 明示「精彩摘要」的文章不收；Hi宜蘭限其新聞分類 feed，避免混入宜蘭痴其他內容；寰宇從官方 WordPress API 取得真正長篇報導，影音短說明仍不算全文。
- 商周改用官方財經列表及受網址安全檢查的 curl，仍有偶發連線失敗；已成功存入 3 篇。大台灣新聞網先恢復台南正式文章入口、單次 15 秒期限及嚴格限定的重複 OG canonical 修正，其他地區尚未宣稱涵蓋。
- 原站 HTML、完整 probe 結果、入庫紀錄、逐站 API 證據及瀏覽器比對保存在本機 `artifacts/crawl-round2/`；`stored.json` 提供來源 URL、收錄時間、全文取得時間與正文長度。

### 第二輪剩餘來源（後續進展見第三輪）

| 來源 | 本輪結果與下一步 |
|---|---|
| `cheers` | 官方 RSS 為 2021 年摘要；個別文章部分可讀但多頁正文與 403 尚未穩定取得。PChome 聯播明示全文未完，不能計成功。 |
| `buzzorange` | 官方及替代公開入口仍 403；繼續尋找實際署名的公開全文。 |
| `agriharvest` | 429，退避後單次重試仍限流即停止；Yahoo 列表混入別家稿件已拒絕，未誤認恢復。 |
| `gq` | 原站文章及 sitemap 403；舊雜誌聯播多為節錄，不能算完整。 |
| `taiwandaily`、`enn`、`travelnews` | 原站 403，未找到可驗證完整公開正文入口。 |
| `google_news` | 官方聚合入口與 RSS 主要轉介原媒體，尚無可歸屬本平台的完整正文證據；不自行排除。 |
| `msn` | 找到官方匿名公開正文 API，正在驗證全文、日期與供稿者，尚未整合入庫。 |
| `pnn` | 找到公開 viewer 可能存有 CNA 全文，正在核對實際發佈日期；先前 PTT/API 摘要不計成功。 |
| `dongtaiwang` | 現有文字新聞大多是外站聚合連結，本站影片及軟體公告不能冒充新聞正文。 |
| `cn_wsj` | 官方文章 401／訂閱內容，不繞過付費限制。 |
| `taiwan` | 官方 www、econ、culture 等公開入口持續連線逾時。 |

既有排除保持：`want`（使用者指定）、`wujie`（使用者先前指定略過）、`cti`（重複 ctitv）、`social.php`（解析產物）、`overdope`（網域已變質）。監督器尚未設為 stopped，後續繼續逐站研究。

### 第二輪驗證

- 全套測試 417 passed，10 項需獨立整合環境的測試 skipped；TypeScript 檢查通過。
- 新增舊文重抓、保留真實日期、取得日起算保留期的實際 SQL 篩選、聯播供稿者拒絕、審核過的舊文網址、模板與 canonical 限定修正測試。
- 正式站 23 個來源逐站 reader 瀏覽器抽查皆為 HTTP 200，正文與 API 全文一致、發佈日期與資料庫一致；第三輪發現 NOM 舊待抓佇列誤標 4 篇摘要後已更正；排程續抓後最新快照合計 137 篇完整全文。
- 已提交並部署 `1b4061777fcd27ce27948c141eecdb457b5e78f8`；部署後抽查恆春、Reuters、動網、大台灣與商周，正文可讀，保存說明亦顯示從取得全文起算 90 天。

## 第一輪恢復來源（歷史快照）

| 媒體 | 修復入口／方式 | 近期完整文章數 | 站內閱讀抽查 |
|---|---|---:|---|
| 地球圖輯隊 (`wyc`) | [https://dq.yam.com/](https://dq.yam.com/) | 11 | [閱讀](https://tag.observe.tw/article/8117148/) |
| 大人物 (`daman`) | [https://www.damanwoo.com/](https://www.damanwoo.com/) | 12 | [閱讀](https://tag.observe.tw/article/8117160/) |
| 姊妹淘 (`babyou`) | [https://babyou.me/](https://babyou.me/) | 12 | [閱讀](https://tag.observe.tw/article/8117184/) |
| TechCrunch (`techcrunch`) | [http://techcrunch.com/](http://techcrunch.com/) | 12 | [閱讀](https://tag.observe.tw/article/8117172/) |
| TSNA體育新聞團隊 (`tsna`) | [https://tsna.com/](https://tsna.com/) | 12 | [閱讀](https://tag.observe.tw/article/8117196/) |
| 沃草 (`musou`) | [https://watchout.tw/](https://watchout.tw/) | 2 | [閱讀](https://tag.observe.tw/article/8117286/) |
| Hypesphere狂熱球電影資訊網 (`hypesphere`) | [https://hypesphere.com/](https://hypesphere.com/) | 7 | [閱讀](https://tag.observe.tw/article/8117284/) |
| L.DOPE (`ldope`) | [https://ldope.com/](https://ldope.com/) | 3 | [閱讀](https://tag.observe.tw/article/1018790/) |
| 焦點事件 (`eventsinfocus`) | [https://eventsinfocus.org/](https://eventsinfocus.org/) | 6 | [閱讀](https://tag.observe.tw/article/8117202/) |
| 思想坦克 (`voicettank`) | [https://voicettank.org/](https://voicettank.org/) | 12 | [閱讀](https://tag.observe.tw/article/8117298/) |
| Tatler Taiwan (`asiatatler`) | [https://www.tatlerasia.com/](https://www.tatlerasia.com/) | 11 | [閱讀](https://tag.observe.tw/article/8117310/) |
| A Day Magazine (`adaymag`) | [https://www.adaymag.com/](https://www.adaymag.com/) | 1 | [閱讀](https://tag.observe.tw/article/8117299/) |
| 視傳媒 (`nvns`) | [https://nvns.net/](https://nvns.net/) | 0 | 原站樣本已通過；正式寫入 2 次皆逾時，交由排程繼續重試 |
| 彪網媒 (`biao_news`) | [https://www.biao-news.com/](https://www.biao-news.com/) | 5 | [閱讀](https://tag.observe.tw/article/8117315/) |
| on.cc東網 (`oncc`) | [https://hk.on.cc/tw/news/index.html](https://hk.on.cc/tw/news/index.html) | 9 | [閱讀](https://tag.observe.tw/article/8117276/) |

數量為修復後資料庫中 14 天內 `body_status=ok` 的實際筆數快照，包含既有文章；不是宣稱已抓完所有歷史文章。正式排程持續補抓。14 個來源已有共 115 篇可讀全文；視傳媒原站樣本驗證成功，但正式收錄時連線逾時，尚未寫入文章，沒有宣稱為收錄成功。

- 沃草使用目前 `watchout.tw` 的報導／論壇頁，發佈欄位為 UTC，已與原站結構化時間比對。
- 焦點事件限定 `main#content` 的新聞正文與發佈欄位，不混入側欄募款報告；保留 datetime 原有時區。
- Tatler 限繁體文章網址，合併所有正文區塊並排除圖庫控制；本次 11 篇已回補完整正文。
- 文章路徑限制同時套用 RSS、sitemap、轉址與 canonical，避免多語站跨入未指定語系。
- A Day Magazine、TechCrunch 補齊既有爬蟲缺少的顯示名稱與媒體目錄資料。

## 第一輪尚未恢復（歷史快照；最新狀態見上方第二輪）

| 媒體 | 本次檢查結果 |
|---|---|
| 動網 (`dongtw`) | 舊官方網域形成重導迴圈。 |
| 中天新聞網 (`cti`) | 中天重複代碼；由 ctitv 抓取，不重複收錄。 |
| Global Voices 繁體中文 (`gv`) | 官方已搬至 zht.globalvoices.org，feed 最新抽樣為 2026-05，超過現行 14 天收錄窗口。 |
| 娛樂重擊 (`punchline`) | 官方 feed 與文章均超過 14 天收錄窗口。 |
| 商業周刊 (`bw`) | 目前官方首頁與文章連線間歇 ECONNRESET；含 curl 重新試抓仍未取得可持續驗證的全文。 |
| 旅飯 (`pantravel`) | 官方 feed 與文章均超過 14 天收錄窗口。 |
| NOM Magazine (`nom`) | 官方 feed 與文章均超過 14 天收錄窗口。 |
| Cheers快樂工作人 (`cheers`) | 官方頁面、RSS 與 sitemap 回應 403。 |
| DIGITIMES電子時報 (`digitimes`) | 目前文章入口為 /tech/dt/n/shwnws.asp；抽查只公開引言，後方要求會員登入，未取得可驗證全文。 |
| overdope (`overdope`) | 舊網域已改為不相關的賭博內容，不能以原媒體身分收錄。 |
| 風向新聞 (`kairos`) | kairos.news DNS 查無網域。 |
| 觀策站 (`viewpointtaiwan`) | 官方 feed 與文章均超過 14 天收錄窗口。 |
| 報橘 (`buzzorange`) | 官方回應 403，robots.txt 為 410。 |
| MPlus云閱讀 (`mplus`) | 可讀文章超過 14 天收錄窗口。 |
| 農傳媒 (`agriharvest`) | 官方回應 429；遵守限流，停止該次試抓。 |
| GQ Taiwan (`gq`) | 官方新聞 sitemap 與文章入口回應 403。 |
| DramaQueen電視迷 (`dramaqueen`) | 首頁文章仍停在 2026-06；頁面缺可驗證日期，未找到近期全文。 |
| social.php (`social.php`) | 舊 PHP 解析產生的非媒體項目。 |
| 旺報 (`want`) | 依使用者先前指示排除旺報。 |
| Google 新聞 (`google_news`) | 新聞聚合頁／RSS 不提供原媒體全文，不能冒充 Google 原創文章。 |
| MSN新聞 (`msn`) | 聚合／頻道頁未提供可驗證的文章時間與全文，且 sitemap 混有其他語系。 |
| 動態網 (`dongtaiwang`) | 目前候選多為影片／聚合頁，未找到帶發佈時間的完整文字報導。 |
| 美國之音中文網 (`voachinese`) | 近期首頁候選主要為影音頁，缺完整文字正文；文字 RSS 候選已超過 14 天。 |
| 澎湃新聞 (`thepaper`) | 官方連線回應 403，舊 sitemap 候選過時或缺發佈時間。 |
| 大台灣新聞網 (`tnews`) | 首頁候選多導向採訪分類列表；未取得近期文章的獨立網址、日期與全文。 |
| 美洲台灣日報 (`taiwandaily`) | 官方回應 403。 |
| ENN台灣電報 (`enn`) | 官方回應 403。 |
| 寰宇新聞網 (`globalnewstv`) | 可讀近期頁面多為影音短文（約 90–160 字），依現行品質規則為 short，不誤標完整全文。 |
| 宜蘭新聞網 (`travelnews`) | 官方回應 403。 |
| 鄉民晚報 (`pnn`) | 未發現可驗證的獨立文章，feed 回應 404。 |
| 三星傳媒 (`tristarnews`) | 官方首頁為 Cloudflare 403 驗證頁，feed 回應 404。 |
| 無界 (`wujie`) | 依使用者先前指示略過，官方來源身分仍未確認。 |
| Hi宜蘭新聞 (`hiilan`) | 官方 feed 與文章均超過 14 天收錄窗口。 |
| 菱傳媒 (`rwnews`) | 官方回應 403。 |
| 路透社 (`reuters`) | 候選文章要求訂閱或回應 401，不繞過付費限制。 |
| 華爾街日報中文網 (`cn_wsj`) | 候選文章回應 401。 |
| 中國台灣網 (`taiwan`) | 目前官方 HTTPS 首頁與入口持續逾時。 |
| 台灣e新聞 (`taiwanenews`) | 候選為舊專欄等頁面，缺可驗證發佈時間。 |
| 恆春半島在地新聞網 (`jdanews`) | 候選多為分類／討論區入口，沒有可驗證發佈時間。 |
| READr 讀+ (`readr`) | 官方一般報導最新抽樣為 2026-03，超過 14 天；專案首頁不能當成近期報導。 |

未以「啟用」掩蓋抓取失敗；這些來源仍可透過每週 probe 重新檢查（明確排除的來源除外）。

## 驗證

- 全套測試：384 passed，10 個需要獨立整合環境的測試 skipped。
- 加入 Tatler 分段正文回歸測試後，相關解析測試 110 passed；TypeScript 檢查通過。
- 正式 `crawl-news-once` 寫入與資料庫全文查核；Tatler 本批正文逐篇重新抓取校驗日期後更新。

## 原站證據抽樣

| 媒體 | 原站文章 | 發佈時間（UTC） |
|---|---|---|
| 地球圖輯隊 | [原站](https://dq.yam.com/post/17061) | 2026-10-02T07:29:21.000Z |
| 大人物 | [原站](https://www.damanwoo.com/node/98028) | 2026-10-02T20:44:57.000Z |
| 姊妹淘 | [原站](https://babyou.me/sensory-joys-261003) | 2026-10-03T08:00:40.000Z |
| TechCrunch | [原站](https://techcrunch.com/2026/10/02/meta-wants-you-to-build-your-own-muse-gadget/) | 2026-10-03T00:45:39.000Z |
| TSNA體育新聞團隊 | [原站](https://tsna.com/article/203742) | 2026-10-03T09:05:48.000Z |
| 沃草 | [原站](https://watchout.tw/reports/cfQ1ORe7lYAGkaX0Oqpr) | 2026-10-01T06:47:33.000Z |
| Hypesphere狂熱球電影資訊網 | [原站](https://hypesphere.com/breaking-news/paramount_wb_skydance/) | 2026-10-03T05:30:25.000Z |
| L.DOPE | [原站](https://ldope.com/news/fashion/levis-rose-collaboration-fashion-jeans/) | 2026-09-25T06:00:58.000Z |
| 焦點事件 | [原站](https://eventsinfocus.org/news/7148462) | 2026-09-29T12:00:00.000Z |
| 思想坦克 | [原站](https://voicettank.org/20261002-2/) | 2026-10-02T07:37:52.000Z |
| Tatler Taiwan | [原站](https://www.tatlerasia.com/style/beauty/bionet-2026-1-zh-hant) | 2026-09-30T07:00:00.000Z |
| A Day Magazine | [原站](https://www.adaymag.com/2026/09/23/anne-hathaway-shiseido-skincare-fortw.html) | 2026-09-23T10:13:34.000Z |
| 視傳媒 | [原站](https://nvns.net/news_view.php?new_sn=144960&new_csn=1977) | 2026-10-03T11:09:55.000Z |
| 彪網媒 | [原站](https://www.biao-news.com/news_view.php?new_sn=144926&new_csn=2713) | 2026-10-02T16:00:00.000Z |
| on.cc東網 | [原站](https://hk.on.cc/hk/bkn/cnt/news/20261003/bkn-20261003160015910-1003_00822_001.html) | 2026-10-03T08:00:15.000Z |
