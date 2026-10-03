# 相似文章的引用來源與媒體國別

`app/src/similarity/attribution.ts` 只記錄明示引用：媒體名稱緊接「報導指出／報導，」等報導語句、來源／引述／編譯／授權文字，或文章擷取器提供的獨立內容提供者欄位。單純提到媒體、討論媒體公司或圖片署名，不建立內文來源關係。證據最多 160 字，並排除刊登媒體自己。這些紀錄表示文章引用了該媒體，不能證明原始作者或原始稿件；發布時間和相似度也不能單獨證明稿源。

國別為媒體本身的所屬國別，不是事件地點、記者國籍或母公司所在地。未知提供者保留名稱，國別顯示「未知」（`ZZ`）。本地顯示名稱沿用現有 `app/data/favicon-catalog.json`；目前沒有 `media.json`。台灣明確對照表涵蓋使用者流量基準內 29 個媒體鍵值；其餘來源不因中文名稱或本地收錄而一律推定台灣。

外國媒體國別參考官方介紹或登記資料（2026-10-03 核對）：

| 媒體 | 國別 | 官方依據 |
| --- | --- | --- |
| Reuters 路透社 | 英國 GB | [英國公司登記：Reuters News & Media Limited，倫敦地址](https://find-and-update.company-information.service.gov.uk/company/02505735) |
| AFP 法新社 | 法國 FR | [AFP 法律資訊：巴黎登記與總部地址](https://www.afp.com/fr/mentions-legales) |
| AP 美聯社 | 美國 US | [AP 聯絡資訊：紐約總部](https://www.ap.org/contact-us/) |
| BBC | 英國 GB | [英國政府 BBC 介紹](https://www.gov.uk/government/organisations/bbc/about) |
| CNN | 美國 US | [CNN 官方新聞室：亞特蘭大、美國國內頻道說明](https://cnnpressroom.blogs.cnn.com/2025/07/08/brad-smith-joins-cnn-as-an-anchor-for-networks-fast-channel-cnn-headlines/) |
| NHK | 日本 JP | [NHK 自有頂級網域介紹：日本公共廣播機構](https://nic.nhk/) |
| Kyodo 共同社 | 日本 JP | [共同社官方英文媒體介紹](https://img.kyodonews.net/static/KyodoDEn.pdf) |
| Yonhap 韓聯社 | 韓國 KR | [韓聯社官方概況與首爾地址](https://cb.yna.co.kr/gate/big5/cn.yna.co.kr/aboutus/index) |
| Xinhua 新華社 | 中國 CN | [新華社介紹](https://www.xinhuanet.com/english/2018-01/31/c_136938621.htm)、[新華網官方介紹與北京地址](https://english.news.cn/20260610/3dc340f2e64d43c9bc6e48d9ec939aac/c.html) |
| DW 德國之聲 | 德國 DE | [DW 官方介紹：德國國際廣播機構](https://innovation.dw.com/about) |
| RFI 法國國際廣播電台 | 法國 FR | [France Médias Monde 官方 RFI 介紹](https://www.francemediasmonde.com/en/) |
| Nikkei 日本經濟新聞 | 日本 JP | [日本政府法人資料：日本經濟新聞社](https://info.gbiz.go.jp/hojin/ichiran?hojinBango=3010001033086) |

台灣媒體對照的官方參考包括[中央社常見問答：台灣國家通訊社](https://www.cna.com.tw/missions/faq/)、[自由時報介紹](https://service.ltn.com.tw/)、[聯合報 75 週年介紹](https://udn75.udn.com/)及 [NCC 電視新聞觀測報告](https://www.ncc.gov.tw/chinese/show_file.aspx?file_sn=61400&table_name=news)。流量基準鍵值與範圍見 `app/data/traffic-baseline.json`。
