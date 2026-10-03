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
| 無界 | 無網址且名稱無法唯一辨識。已有停止營運的同名新聞品牌與無界網路入口，保留 `websiteUrl: null` 等待人工核對，不猜測建立抓取目標。 |

馬祖日報、彪網媒、自立晚報、中華鱻傳媒等網站需保留 `www` 主機名稱；裸網域在核對時可能沒有 DNS 記錄。Google 新聞、MSN、LINE TODAY、Miin 等聚合服務須另外辨識文章與入口頁；有 feed 或首頁可開啟不等於完整文章可抓取。

本次核對也確認 BBC、Yahoo 日本、RFA、SCMP、紐約時報中文、DW 等官方訂閱來源；DW 使用 RDF RSS 1.0 的命名空間與 `dc:date`。無須為此引入外部 RSSHub 服務。實際抓取狀態與失敗原因以 `app/data/news-crawl-audit.json` 的時間戳與逐站結果為準。
