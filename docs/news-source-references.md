# Similarweb 新聞來源對照

`app/data/news-source-catalog.json` 以 [來源試算表](https://docs.google.com/spreadsheets/d/1B5RsSVZSrjKSUFDFZ-2VVlU3-tpTN49J1YzLGOohalM/edit?usp=sharing) 已匯入快照的「新聞」類別為範圍，並非只收錄 29 家流量基準媒體。202608 的 198 列對應 193 個來源，加上歷史月份獨有的 READr、上下游、緯來新聞及花花日報，共 197 個來源。來源名單與爬蟲實際成功狀態分開保存；列入名單不代表已成功取得文章。

- `referenceRows` 僅指 202608 工作表列號；198 列各出現一次。
- `referenceNames` 保留各月份原始名稱與別名；歷史獨有來源的 `referenceRows` 為空。
- `existing` 代表擴充前的爬蟲 registry 已有同一來源 ID，不代表本次驗證成功。
- `websiteUrl` 為實際抓取入口，可以是新聞子網域或內容頻道；`websiteEvidence` 保存原表連結或官方核對頁。
- `feedUrls` 來自官方頁面的 RSS/Atom 宣告或實際讀取驗證的官方 feed；部分網站的可用性可能隨時間變動。
- `articlePattern` 為檢查官方首頁實際文章連結後設定的路徑規則，不包含無關分類頁。

自由、TVBS、東森的品牌列與新聞列合併；三立、三立新聞及 iNews 共用三立文章來源。BBC 全站與 BBC 中文保留不同來源，新唐人與新唐人亞太保留不同網域來源，民報與人民網是不同媒體。日經、RFI、DW 等中文內容入口的收錄範圍與原表全站流量不同，不能把原表流量解讀為本站已收錄內容量。

## 原表缺網址或需要校正的案例

| 原表名稱 | 核對方式與官方來源 |
| --- | --- |
| 鴉鴉新聞 | 疑為「鴨鴨新聞」誤植；按唯一近似新聞品牌及[官方關於頁](https://yayanews.com.tw/about-us/)對應，保留原名及推定說明。 |
| taiwanpost 台灣郵時 | 依原表英文識別 taiwanpost 與[臺灣郵報官方站](https://taiwanpost.net/)對應；中文名稱疑有誤植。 |
| 好視新聞 newday.tw | 原表疑漏字母 s；[NewsDay 好視新聞網](https://newsday.tw/)為核對後入口。 |
| 台灣產經新聞 | 改用官方新聞子網域 [news.taiwannet.com.tw](https://news.taiwannet.com.tw/)，原 www 網域憑證不符。 |
| 中嘉（新聞） | 使用[中嘉新聞網](https://news.homeplus.net.tw/)，不可與中華日報 cdns.com.tw 混併。 |
| 台灣 miin 迷因 | 對應 [Miin 迷音](https://miin.cc/)，名稱拼法依原表保留。 |
| 獨家報導 | 依[官方聲明](https://www.scooptw.com/disclaimer/)確認 scooptw.com。 |
| 警政時報 | 依[官方關於頁](https://www.tcpttw.com/aboutus/)確認 tcpttw.com。 |
| 無界 | 無網址且名稱無法唯一辨識。已有停止營運的同名新聞品牌與無界網路入口，2026-10-03 使用者明確要求略過，保留 `websiteUrl: null` 與原始對照列，不建立爬蟲。 |

馬祖日報、彪網媒、自立晚報、中華鱻傳媒等網站需保留 `www` 主機名稱；裸網域在核對時可能沒有 DNS 記錄。Google 新聞、MSN、LINE TODAY、Miin 等聚合服務須另外辨識文章與入口頁；有 feed 或首頁可開啟不等於完整文章可抓取。

本次核對也確認 BBC、Yahoo 日本、RFA、SCMP、紐約時報中文、DW 等官方訂閱來源；DW 使用 RDF RSS 1.0 的命名空間與 `dc:date`。無須為此引入外部 RSSHub 服務。實際抓取狀態與失敗原因以 `app/data/news-crawl-audit.json` 的時間戳與逐站結果為準。


## 2026-10-03 第二輪失敗來源修復

針對第一輪未通過來源逐一讀取首頁、官方 RSS 與文章候選，將「來源身分／入口」與「取得近期完整正文」分開判斷。所有新增但未通過來源均納入檢查；原有爬蟲另由既有來源修復流程處理。網址回應 200、RSS 有標題、或搜尋引擎能找到文章，都不單獨代表抓取通過。最新結果仍以逐站 audit 為準。

- `articleHosts` 僅允許官方首頁、官方 RSS 或文章 canonical 實際連結的指定文章主機，沒有整個網域的萬用字元。新浪、鳳凰、人民網、央視、環球與新華網等入口會跨新聞子網域連到正文。
- `feedBody: "full-text"` 僅在人工讀取官方 RSS 多篇 `content:encoded`，確認有完整段落與結尾後啟用。威傳媒、銳傳媒、586 傳媒、商傳媒、民生頭條、在地人新聞、享新聞與全國大小事各抽查三篇。一般 RSS 的 description 仍視為摘要；VOA、明報、國語日報與 Google 新聞 RSS 不套用全文旗標。
- `apiUrls` 只指前台公開資料來源。銳傳媒與享新聞已讀取官方 WordPress REST 的公開文章內容；它們與完整官方 RSS 都可提供文章正文，不需要繞過登入或付費限制。

| 來源 | 本輪入口修正或檢查結果 |
| --- | --- |
| 人間福報 | 使用可讀的 [HTTPS www 入口](https://www.merit-times.com.tw/)；`NewsPage.aspx?unid=` 為文章，文章日期與全站當日日期必須分開解析。 |
| 明報 | 使用[官方即時新聞 RSS](https://news.mingpao.com/rss/ins/all.xml)，有當日文章與發表時間；原裸網域 HTTP 入口逾時。 |
| VOA 中文 | 從[官方 RSS 目錄](https://www.voachinese.com/rssfeeds)取得實際訂閱端點；feed 是摘要，正文仍需讀文章。 |
| 新浪 | [桌面新聞首頁](https://news.sina.com.cn/)有當日文章；原行動版首頁讀取結果只出現舊文。桌面正文的 canonical 指向同篇 `news.sina.cn` 行動版，已核對加入允許主機。 |
| 新華網 | [HTTPS www 首頁](https://www.xinhuanet.com/)可讀，當日文章直接指向同品牌 `www.news.cn`。 |
| 梅花新聞網 | [當日文章](https://www.i-meihua.com/Article/Detail/57033)在 www 與裸網域均可讀；依 canonical 使用 www 首頁，限定 `/Article/Detail/` 文章路徑。 |
| 彪網媒 | [當日原始文章路徑](https://www.biao-news.com/news_view.php?new_sn=144926&new_csn=2713)可讀；頁面 `og:url` 漏掉 `.php`，不可把該錯誤路徑的轉址當作整個新聞網已遷移或停站。 |
| 國際環宇時報 | [HTTPS www 首頁](https://www.iw-times.com/)及 `news_view.php` 正文可讀；原 HTTP 入口逾時。 |
| 立報 | 舊 lihpao.com 已是無關英文內容；依[立報傳媒官方復刊詞](https://www.limedia.tw/comm/652/)與現站頁尾說明，改用 [limedia.tw](https://www.limedia.tw/)。 |
| Hi 宜蘭 | 原站 TLS 失敗。同公司品牌短連結 `reurl.cc/6Kxvbd` 指向[宜蘭痴的 Hi 宜蘭新聞頻道](https://www.crushonyilan.com.tw/category/hi-yilan-news/)，只收此頻道。可見文章仍為 2025 年及更早，不能當成近期來源啟用。 |
| 台灣英文新聞、客家台、Miin、大愛、鄉民晚報 | HTML 頁面或前台 JavaScript 存在串流、嵌入新聞資料或公開 API；交由具來源限制的解析流程讀取。大愛 `Description` 是顯示於新聞視窗的多段全文；鄉民晚報 API 則明確記錄 PTT `originURL`，需保留聚合來源歸屬。 |
| 台灣 e 新聞 | 首頁可見文章為 2025 年，未發現近期文章；不得以抓取時間代替發表時間。 |

持續回傳 HTTP 401／403、付費或登入阻擋的來源保留原始來源身分及實際失敗原因，不改用來源不明的鏡像。檢查時包含華爾街日報中文、澎湃、台灣電報、三星傳媒、菱傳媒、美洲台灣日報等；逾時、TLS 或 DNS 失敗與權限阻擋分開處理，不能據此斷言網站已停止營運。正文短、影片摘要、分類頁及歷史文章也不冒充近期完整報導。

馬祖資訊、自立晚報與台灣海外網改由官方新聞列表探索；網站全域顯示的「今天」不能當作文章發表日期。大台灣新聞的地區入口與採訪通告可讀，但核對時新聞地區頁逾時，採訪行程不作為完整報導。Google 新聞、MSN、鄉民晚報等平台即使提供聚合連結，仍需確認原始發布者及完整正文，不能直接把入口卡片摘要存成報導。
