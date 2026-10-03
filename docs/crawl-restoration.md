# 未啟用媒體抓取修復（2026-10-03）

盤點 289 個爬蟲設定中 55 個停用／未排程項目。排除重複代碼、非媒體、已指定排除與已變質網域後，逐一試抓 49 個來源，另恢復已有近期全文驗證的東網排程。恢復 15 個，排程總數從 234 增為 249，剩餘 40 個保留明確原因。

來源仍須有原站發佈時間、14 天內文章及完整公開正文。網址日期、sitemap lastmod、舊文、摘要、影音說明和登入頁不能當作近期完整新聞。

## 恢復來源

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

## 仍未啟用

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
