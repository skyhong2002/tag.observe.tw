# 相似文章爬取稽核

公開頁面抽樣時間：2026-10-03T08:25:42.671Z 至 2026-10-03T08:25:58.973Z。基準為 traffic-coverage.ts 匯出的 trafficBaseline（29 家）；正式啟用 28 家。蕃新聞的「內容」分類排除統計，僅做兩篇公開頁面稽核，未加入來源登錄或排程。

執行：`node tools/similarity-audit.ts --limit 2 --output artifacts/similarity/audit-2026-10-03.json`。可加 `--media udn,ltn`、`--concurrency 4`、`--timeout 10000`；單站最多 12 次列表請求，每次有逾時及大小上限，網路失敗不重試，429 停止該站文章抽樣。工具只呼叫公開網站及純解析流程，沒有資料庫連線或寫入。JSON 保存 HTTP 狀態、最終網址、作者欄位、發布時間、擷取來源與長度，不保存 HTML、標題或文章全文。`artifacts/` 不進版本控制。

本次 29/29 家列表有文章；29/29 家至少一篇 bodyStatus=ok，57/58 篇達到內文門檻。作者欄位 29/29 家非空，但中繼資料可能填媒體、編輯部或「綜合報導」，不能等同每篇已確認具名記者。

下表「字數」是擷取字串的 JavaScript length，兩值依樣本順序；ok 門檻是至少 200 個非空白 Unicode 字元。short 保留實際短文；missing 沒有擷取結果；blocked 代表挑戰或付費阻擋。HTTP 200 不代表全文可用，成功擷取也不證明付費或動態文章完整。此稽核沒有驗證入庫、排程更新或全站所有文章。

| 媒體 | 列表文章數 | 內文字數／狀態 | bodySource | 作者欄位（兩篇合併） | 抽樣網址（兩篇） |
| --- | ---: | --- | --- | --- | --- |
| udn | 1221 | 232/ok、752/ok | .article-content | 記者林媛玲／新北即時報導、記者吳淑玲／台南即時報導 | [1](https://udn.com/news/story/124652/9792649)、[2](https://udn.com/news/story/7326/9792646) |
| ettoday | 96 | 834/ok、753/ok | [itemprop="articleBody"] | 陳家祥、賴文萱 | [1](https://www.ettoday.net/news/20261003/3248414.htm)、[2](https://www.ettoday.net/news/20261003/3248389.htm) |
| ltn | 345 | 457/ok、242/ok | ld+json | 龔乃玠、自由時報電子報 | [1](https://sports.ltn.com.tw/news/breakingnews/5594351)、[2](https://news.ltn.com.tw/news/Taitung/breakingnews/5594350) |
| setn | 500 | 445/ok、419/ok | #newsContent | 陳柏良、CTWANT | [1](https://www.setn.com/news/1916781)、[2](https://www.setn.com/news/1916749) |
| chinatimes | 1000 | 566/ok、571/ok | [itemprop="articleBody"] | 楊婕、方翊倩、邱啟霖 | [1](https://www.chinatimes.com/realtimenews/20261003002385-260405)、[2](https://www.chinatimes.com/realtimenews/20261003002393-260405) |
| tvbs | 703 | 589/ok、104/short | selector | 林坤緯、陳淑芬 | [1](https://news.tvbs.com.tw/entertainment/jk-pop/4031156)、[2](https://news.tvbs.com.tw/local/4031151) |
| mirror | 149 | 584/ok、510/ok | ld+json | 鄭淳尹 | [1](https://www.mirrormedia.mg/story/20261003-172soc-155938)、[2](https://www.mirrormedia.mg/story/20261003-172soc-155433) |
| nownews | 782 | 1266/ok、1522/ok | [itemprop="articleBody"] | 陳美嘉、陳雅蘭 | [1](https://www.nownews.com/news/6880321)、[2](https://www.nownews.com/news/6880322) |
| storm | 461 | 1993/ok、3204/ok | ld+json | 陳得馥 | [1](https://www.storm.mg/lifestyle/11158678)、[2](https://www.storm.mg/lifestyle/11164209) |
| ebc | 234 | 487/ok、941/ok | ld+json | 中央社、責任編輯 林語柔 | [1](https://news.ebc.net.tw/news/sport/574065)、[2](https://news.ebc.net.tw/news/world/574066) |
| cna | 50 | 412/ok、771/ok | ld+json | 洪啓原、施施 | [1](https://www.cna.com.tw/news/aopl/202610030120.aspx)、[2](https://www.cna.com.tw/news/aopl/202610030119.aspx) |
| nextapple | 419 | 381/ok、563/ok | ld+json | 曾宛如、劉育良 | [1](https://news.nextapple.com/entertainment/20261003/89FD34613DC89280A378826AEA4FD338)、[2](https://news.nextapple.com/politics/20261003/4B3AD5BBCE0D9E559C491D3CB9DC01E4) |
| ftv | 110 | 277/ok、897/ok | ld+json | 廖予瑄（即時中心） - 民視新聞網、温芸萱 （即時中心） - 民視新聞網 | [1](https://www.ftvnews.com.tw/news/detail/2026A03W0312)、[2](https://www.ftvnews.com.tw/news/detail/2026A03W0309) |
| ctitv | 419 | 742/ok、750/ok | [itemprop="articleBody"] | 李宗芳、彭巧蓁 | [1](https://ctinews.com/news/items/pRnYg9BEaY)、[2](https://ctinews.com/news/items/q9WPPDvmWm) |
| upmedia | 203 | 2520/ok、801/ok | selector | 李雨勳、上報快訊／林士芬 | [1](https://www.upmedia.mg/tw/popularity/chinese-dramas/270369)、[2](https://www.upmedia.mg/tw/focus/politics/270435) |
| mirrordaily | 23 | 616/ok、565/ok | [itemprop="articleBody"] | 鏡報、林建鋒 | [1](https://www.mirrordaily.news/story/89433)、[2](https://www.mirrordaily.news/story/89435) |
| ftnn | 24 | 604/ok、650/ok | selector | 陳崴淩、蔡曉容 | [1](https://www.ftnn.com.tw/news/584252)、[2](https://www.ftnn.com.tw/news/584267) |
| ctwant | 225 | 669/ok、932/ok | ld+json | 吳孟倫 | [1](https://www.ctwant.com/article/500719/)、[2](https://www.ctwant.com/article/500718/) |
| newtalk | 100 | 275/ok、550/ok | [itemprop="articleBody"] | 許天佑、Newtalk新聞 | [1](https://newtalk.tw/news/view/2026-10-03/1063399)、[2](https://newtalk.tw/news/view/2026-10-03/1063396) |
| taisounds | 300 | 350/ok、506/ok | selector | 周志豪、即時中心 | [1](https://www.taisounds.com/news/content/71/291996)、[2](https://www.taisounds.com/news/content/96/291939) |
| tnl | 18 | 3438/ok、3848/ok | ld+json | 讀者投書 | [1](https://www.thenewslens.com/article/270359)、[2](https://www.thenewslens.com/article/270371) |
| mnews | 25 | 533/ok、887/ok | article | 林妏緹、鏡新聞 | [1](https://www.mnews.tw/story/20261003nm002)、[2](https://www.mnews.tw/story/20261001mkt00005) |
| pts | 25 | 556/ok、675/ok | ld+json | 姜筑、林靜梅、邱福財 | [1](https://news.pts.org.tw/article/829786)、[2](https://news.pts.org.tw/article/829784) |
| yam（排除統計） | 28 | 1784/ok、473/ok | selector | 創新聞/陳 聖璋、今傳媒/今傳媒- 記者李祖東 | [1](https://n.yam.com/Article/20260526158389)、[2](https://n.yam.com/Article/20251003889446) |
| cts | 200 | 218/ok、206/ok | .article-content | 綜合報導 | [1](https://news.cts.com.tw/cts/sports/202610/202610033085804.html)、[2](https://news.cts.com.tw/cts/general/202610/202610033085803.html) |
| reporter | 10 | 832/ok、8029/ok | #article-body | 報導者 Podcast 製作團隊、黃世澤、阿潑、鄭宇辰 | [1](https://www.twreporter.org/a/podcast-2026-10-02)、[2](https://www.twreporter.org/a/interview-david-borenstei-mr-nobdy-against-putin) |
| ttv | 149 | 620/ok、614/ok | [itemprop="articleBody"] | TTV | [1](https://news.ttv.com.tw/news/11510030014100I)、[2](https://news.ttv.com.tw/news/11510030009800I) |
| rti | 118 | 970/ok、461/ok | selector | 陳念宜、黃凡甄 | [1](https://www.rti.org.tw/news?uid=3&pid=235529)、[2](https://www.rti.org.tw/news?uid=3&pid=235527) |
| knews | 25 | 848/ok、784/ok | article | 毛琬婷、Alex | [1](https://www.knews.com.tw/news/A6E5314201ECAC7C8231C3C575A11136)、[2](https://www.knews.com.tw/news/DEE3CA494E147B3C825DA8245C132A44) |

全部 58 篇文章頁本次 HTTP 200；以下列表端點部分失敗，其餘列表請求 HTTP 200。失敗端點不被「列表有文章」掩蓋：

- ltn：HTTP 404 [https://news.ltn.com.tw/rss/people.xml](https://news.ltn.com.tw/rss/people.xml)
- ttv：HTTP 403 [http://www.ttv.com.tw/rss/RSSHandler.ashx?d=news&t=D](http://www.ttv.com.tw/rss/RSSHandler.ashx?d=news&t=D)
- ttv：HTTP 403 [http://www.ttv.com.tw/rss/RSSHandler.ashx?d=news&t=E](http://www.ttv.com.tw/rss/RSSHandler.ashx?d=news&t=E)
- ttv：HTTP 403 [http://www.ttv.com.tw/rss/RSSHandler.ashx?d=news&t=H](http://www.ttv.com.tw/rss/RSSHandler.ashx?d=news&t=H)
- ttv：HTTP 403 [http://www.ttv.com.tw/rss/RSSHandler.ashx?d=news&t=L](http://www.ttv.com.tw/rss/RSSHandler.ashx?d=news&t=L)

已依公開 HTML 加入站別內文規則：TVBS `.article-editor-content`、FTNN `.news-body`、上報／太報 `.news-box-text`（包含非 p 的 div 或 br 段落）、央廣 `.text.ivu-mt`。央廣作者連結使用 `a[href*="newsauthorlist"]`；報導者使用 `a[href^="/authors/"]`。蕃新聞 `.inner-content`／`.reporter` 僅存在此稽核工具的樣本規則。

本次 TVBS 第二篇只有 104 字，實際可見內容維持 short，沒有把 meta description 當全文補齊。另一次較早的固定網址檢查，鏡新聞影片頁 [20261003sot1508001](https://www.mnews.tw/story/20261003sot1508001) 只有 55 字（short）；最終列表更新後兩篇鏡新聞抽樣均達 ok。蕃新聞首頁樣本可能很舊，本次只證明公開頁面可擷取；其未登錄／排除統計狀態不變。

台視 ASP.NET 頁面的主新聞位於版面 form 內；修正排除規則後，仍刪除內文的表單控制項，但允許擷取版面 form 裡的文章。最終兩篇台視均為 ok。

## 後續正文品質複查（同日）

上表保留第一輪 URL 與當時結果。後續檢查改用 UDN 的 `.article-content__editor`，移除會員登入與相關專題文字；第一篇 UDN 樣本實際正文為 185 字，改標 `short`，署名為林媛玲。另一篇 [中央社轉載](https://udn.com/news/story/6809/9792612) 有 814 字，保留「中央社／曼谷3日專電」署名，沒有虛構具名記者。

自由的 iStyle／3C／軍武頻道補上 `.content940 .text`：驗證 [iStyle](https://istyle.ltn.com.tw/article/41216)、[3C](https://3c.ltn.com.tw/news/67790)、[軍武一](https://news.ltn.com.tw/news/def/breakingnews/5594307)、[軍武二](https://news.ltn.com.tw/news/def/breakingnews/5594322) 均取得正文。另 [台視一篇](https://news.ttv.com.tw/news/11510020029900L) 雖回傳 HTTP 200，頁面沒有標題與正文，維持 `missing`，不能將連線成功算作全文成功。

初次實際入庫執行涵蓋 28 家啟用媒體、793 篇文章；它是有限補抓，不代表所有歷史新聞均已取得正文。新 worker 會持續處理未嘗試文章，並保留每批 20% 名額處理最早的待抓文章。擷取、儲存、分頁、保留期限與比對亦另以隔離 MariaDB 整合測試驗證。
