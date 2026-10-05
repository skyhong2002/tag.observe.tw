# 記者署名爬取稽核（2026-10-06）

本輪對 app/data/news-crawl-audit.json 中所有具有文章樣本且 status=verified 的 199 個媒體設定，各讀取第一篇公開文章。這是媒體樣本稽核，不代表每個媒體的所有文章版型均已驗證；資料中也含封存來源和同站不同媒體 ID。初輪 196 個請求收到回應：191 HTTP 200、5 HTTP 403；另外 2 個逾時、1 個轉址過多。HTTP 200 也可能包含驗證頁或缺少內文，不能視為抽取成功。

修正固定欄位：自由時報新版文章上方 article_edit、鏡新聞多個 author meta、公視正文記者連結、信傳媒與梅花新聞網可見署名、Taipei Times 主文章署名。Newtalk 和觀傳媒指定正文容器，避免推薦卡片的記者污染署名。共用解析器涵蓋媒體名稱前綴、不同記者字序、沒有分隔符的城市報導、中央社電頭、多人署名，並優先採用主文的明確記者證據。

app/src/crawl/reporter-media.spec.ts 保留公開文章的精簡開頭樣本（最多 160 字）、固定欄位版型，以及推薦署名和 UI 文字的回歸案例；測試不連線。樣本有署名時，預期值來自實際正文或主文章署名，不從標題、照片或推薦文章推測。

另對 registry 中未包含在初輪的 87 個啟用設定做限制請求數的唯讀文章發現（每媒體最多 4 個列表請求，只取一篇樣本），包含 article.enabled=false 而仍由 feature 流程處理的來源。合計涵蓋目前全部 284 個啟用設定；另外保留初輪 2 個非啟用設定供比較。Google News／動態網是發現器，中視是影片來源，沒有一般文章署名抽取，明確記錄為略過。另以資料庫唯讀 SELECT 取得未找到樣本媒體的最新既有文章 URL，重新讀取公開頁；一筆 ldope URL 實際是作者封存頁，已排除，不能當文章樣本。受本輪請求預算限制而找不到樣本不代表生產爬蟲故障。 最終紀錄共 286 個媒體設定：279 個收到 HTTP 回應（272 HTTP 200、7 非 200）、4 個未取得有效文章樣本、3 個發現器或影片來源略過。未取得樣本的是立報、商業周刊、LDope、報呱；其中 LDope 最新既有 URL 是作者封存頁，已拒絕採用。HTTP 200 仍須檢查版型與正文，不能宣稱 284 個啟用來源全部抽取成功。

## 抽取值變化

下表是相同下載 HTML 在改動前後的結果（36 個媒體）；未改變不表示先前署名一定正確。編輯部、通訊社及 staff writer 等無具名記者的署名保留原始性質。

| 媒體 | 改動前 | 改動後 | 公開樣本 |
| --- | --- | --- | --- |
| ltn | 自由時報電子報 | 黃子暘 | [文章](https://news.ltn.com.tw/news/politics/breakingnews/5594440) |
| newtalk | 文/中央社 | 黎建忠 | [文章](https://newtalk.tw/news/view/2026-10-03/1063427) |
| mnews | 楊旂 | 楊旂、康鈺偉 | [文章](https://www.mnews.tw/story/20261003sot1822001) |
| taipeitimes | 台北時報 | Staff writer, with agencies | [文章](https://www.taipeitimes.com/News/front/archives/2026/10/03/2003865308) |
| cmmedia | 空白 | 信傳媒編輯部 | [文章](https://www.cmmedia.com.tw/home/articles/63139) |
| cnews | 王 佐銘 | 王佐銘 | [文章](https://cnews.com.tw/%e4%b8%8d%e8%ae%93%e7%99%8c%e7%97%87%e6%a1%86%e4%bd%8f%e4%ba%ba%e7%94%9f%ef%bc%81%e7%99%be%e4%bd%8d%e4%b9%b3%e7%99%8c%e7%97%85%e5%8f%8b%e7%99%bb%e3%80%8c%e6%84%9b%e6%b3%a2%e8%88%9e%e5%90%8e%e3%80%8d/) |
| i_meihua | 梅花新聞網 洪子苓/綜合報導 | 洪子苓 | [文章](https://www.i-meihua.com/Article/Detail/57033) |
| thehubnews | 爆料網 | 記者爆料網 | [文章](https://www.thehubnews.net/archives/671502) |
| lai_media | 空白 | 周庭慶 | [文章](https://lai-media.net/news_view.php?new_sn=144958&new_csn=3104) |
| i_media | 空白 | 洪子苓 | [文章](https://i-media.tw/Article/Detail/51186) |
| policenews | 警政時報 趙靜姸 | 趙靜姸 | [文章](https://www.tcpttw.com/local/2026/10/03/316867/) |
| anntw | 空白 | 呂翔禾 | [文章](https://www.anntw.com/articles/20261001-BSy0) |
| news886 | 金雷鳴 | 劉至程 | [文章](https://886.news/archives/365077) |
| innews | 嫣蔚 陳 | 陳嫣蔚 | [文章](https://innews.com.tw/%e3%80%8c2026%e6%96%b0%e7%ab%b9%e5%b8%82%e8%8d%89%e5%9c%b0%e6%95%85%e4%ba%8b%e7%af%80%e3%80%8d%e9%96%8b%e8%b7%91%ef%bc%81%e5%8c%97%e5%a4%a7%e5%85%ac%e5%9c%92%e5%8c%96%e8%ba%ab%e3%80%8c%e9%96%b1/) |
| owlting | 民生好報 | 范麗玉 | [文章](https://news.owlting.com/articles/1465126) |
| new_report | 賴傳媒 | 周庭慶 | [文章](https://new-reporter.com/news/280329/) |
| enn | 廖 宥婷 | 廖宥婷 | [文章](https://17news.net/archives/340971) |
| greatnews | 大成報 | 于郁金 | [文章](https://greatnews.com.tw/news_pagein.php?iType=1010&n_id=315270) |
| nvns | 空白 | 羅蔚舟 | [文章](https://nvns.net/news_view.php?new_sn=144960&new_csn=1977) |
| bo6s | 牧迪網頁設計 | 范曉龍 | [文章](https://www.bo6s.com.tw/news_detail.php?NewsID=117213) |
| focusnews | 今傳媒 JNEWS | 李祖東 | [文章](https://focusnews.com.tw/2026/10/724107/) |
| taiwanpost | 採訪中心 | 吳瀛洲 | [文章](https://taiwanpost.net/2026/local/173263/) |
| life | 爆料網 | 記者爆料網 | [文章](https://life.tw/article/%E5%BF%AB%E8%A8%8A%E7%96%91%E5%BE%AE%E9%9B%BB%E8%BB%8A%E8%B5%B7%E7%81%AB-%E9%AB%98%E9%9B%84%E4%BD%8F%E5%AE%85%E5%86%92%E6%BF%83%E7%85%99-%E5%B1%8B%E4%B8%BB%E9%80%81%E9%86%AB-3168440) |
| matsu_idv | 空白 | 陳子榮 | [文章](http://www.matsu.idv.tw/topicdetail.php?f=1&t=344504) |
| taiwanenews | 空白 | 盧思綸 | [文章](https://www.taiwanenews.com/docs/20260930101.php) |
| idn | 卓羽榛臺北報導 | 卓羽榛 | [文章](https://www.idn.com.tw/news/news_content.aspx?catid=1&catsid=2&catdid=0&artid=20261002carey100008) |
| mknews | 天天上新聞 | 李祖東 | [文章](https://mknews.com.tw/2026/10/1001048/) |
| 17news | 廖 宥婷 | 廖宥婷 | [文章](https://17news.net/archives/340971) |
| ltvnews | 新 頭條 | 蔡佳坊 | [文章](https://www.ltvnews.net/archives/201364) |
| tmnu | TMNU台灣多媒體新聞聯合網 | 陳們明 | [文章](https://www.tmnu.org.tw/news/4840) |
| vogue | Nicole Lee、Chara Yu、王靚雯、Chen Yu、Inna Chou、Connor Sturges、Wendy Sister、Andrea Zendejas、Kieron Marchese、Ángela Moreno Vallejo | Nicole Lee、Chen Yu、Avril Chen | [文章](https://www.vogue.com.tw/article/2026-october-cover-lin-chi-ling) |
| housefun | 好房網News | 李彥穎 | [文章](https://www.myhousing.com.tw/n/n01/south-taiwan/kaohsiung-estate/297341/) |
| ithome | 空白 | 李建興 | [文章](https://www.ithome.com.tw/news/179415) |
| coolloud | 空白 | 陳韋綸 | [文章](http://www.coolloud.org.tw/node/99536) |
| eventsinfocus | 空白 | 王子豪 | [文章](https://eventsinfocus.org/news/7148483) |
| digitimes | 空白 | 徐宏民 | [文章](https://www.digitimes.com.tw/col/article/?id=18320) |

## 全部讀取結果

署名欄列出解析結果；空白表示這個樣本沒有找到可採用的署名，並非該媒體沒有記者。未經其他版型測試的來源仍靠共用欄位和主文解析；未以猜測填入人名。被封鎖的站需沿用已設定的公開 RSS、API 等路徑另行驗證。

| 媒體 | HTTP／讀取狀態 | 目前抽取署名 | 公開樣本 |
| --- | --- | --- | --- |
| ettoday | 200 | 李依琳 | [文章](https://www.ettoday.net/news/20261003/3248494.htm) |
| chinatimes | 200 | 洪靖宜 | [文章](https://www.chinatimes.com/realtimenews/20261003002835-260407) |
| udn | 200 | 中央社／ 台北3日電 | [文章](https://udn.com/news/story/6885/9792813) |
| setn | 200 | 陳思妤 | [文章](https://www.setn.com/news/1916867) |
| mirror | 200 | 蘇育宣 | [文章](https://www.mirrormedia.mg/story/20261003edi024) |
| ltn | 200 | 黃子暘 | [文章](https://news.ltn.com.tw/news/politics/breakingnews/5594440) |
| storm | 200 | 陳得馥 | [文章](https://www.storm.mg/lifestyle/11158678) |
| tvbs | 200 | 林坤緯 | [文章](https://news.tvbs.com.tw/entertainment/jk-pop/4031218) |
| nownews | 200 | 金武鳯 | [文章](https://www.nownews.com/news/6880360) |
| ebc | 200 | 責任編輯 柏淨予 | [文章](https://news.ebc.net.tw/news/business/574071) |
| cna | 200 | 陳至中 | [文章](https://www.cna.com.tw/news/ahel/202610030169.aspx) |
| msn | 200 | 空白 | [文章](https://www.msn.com/zh-tw/sports/%E4%B8%80%E8%88%AC/%E4%BA%9E%E9%81%8B-%E7%B6%B2%E7%90%83%E5%A5%B3%E9%9B%99-%E8%AC%9D%E8%A9%B9%E5%A4%A7%E6%88%B0-%E7%88%AD%E9%87%91-%E8%AC%9D%E6%B7%91%E8%96%87%E7%B5%84%E5%90%88%E9%A6%96%E7%9B%A4%E5%BE%8C%E4%BE%86%E5%B1%85%E4%B8%8A/ar-AA2dtw0I) |
| upmedia | 200 | 上報快訊／林士芬 | [文章](https://www.upmedia.mg/tw/focus/politics/270449) |
| ctitv | 200 | 李培睿 | [文章](https://ctinews.com/news/items/BexXVyqyWb) |
| nextapple | 200 | 曾宛如 | [文章](https://news.nextapple.com/entertainment/20261003/0CBE348353A6FA245DF8CC55FB995574) |
| hk01 | 200 | 凌逸德 | [文章](https://www.hk01.com/%E7%AA%81%E7%99%BC/60396061/%E9%A3%9B%E9%B5%9D%E5%B1%B1%E5%A2%AE%E5%B4%96%E4%BA%A1-%E6%95%91%E8%AD%B7%E7%B8%BD%E9%9A%8A%E7%9B%AE%E6%9B%BE%E5%8F%83%E8%88%87%E5%9C%9F%E8%80%B3%E5%85%B6%E9%9C%87%E7%81%BD%E6%90%9C%E6%95%91-%E5%90%8C%E8%A2%8D-%E5%80%BC%E5%BE%97%E5%B0%8A%E6%95%AC) |
| ftv | 200 | 民間全民電視公司 | [文章](https://www.ftvnews.com.tw/news/detail/2026A03W0377) |
| mirrordaily | 200 | 鄭宏斌 | [文章](https://www.mirrordaily.news/story/89453) |
| taisounds | 200 | 周志豪 | [文章](https://www.taisounds.com/news/content/70/292015) |
| ftnn | 200 | 邱梓欣 | [文章](https://www.ftnn.com.tw/news/584275) |
| ctwant | 200 | 陳頡 | [文章](https://www.ctwant.com/article/500731/) |
| newtalk | 200 | 黎建忠 | [文章](https://newtalk.tw/news/view/2026-10-03/1063427) |
| pts | 200 | 姜筑 | [文章](https://news.pts.org.tw/article/829786) |
| mnews | 200 | 楊旂、康鈺偉 | [文章](https://www.mnews.tw/story/20261003sot1822001) |
| tnl | 200 | 讀者投書 | [文章](https://www.thenewslens.com/article/270359) |
| cts | 200 | 綜合報導 | [文章](https://news.cts.com.tw/cts/general/202610/202610033085869.html) |
| reporter | 200 | 空白 | [文章](https://www.twreporter.org/a/podcast-2026-10-02) |
| rti | 200 | 新聞編輯 | [文章](https://www.rti.org.tw/news?uid=3&pid=235549) |
| rfi | 200 | 東京特約記者 楚良一 | [文章](https://www.rfi.fr/tw/%E5%9C%8B%E9%9A%9B/20261003-%E6%99%AE%E4%BA%AC%E5%91%BC%E7%B1%B2%E6%97%A5%E4%BF%84%E5%8F%8B%E5%A5%BD-%E6%97%A5%E6%9C%AC%E8%A1%A8%E7%A4%BA%E7%95%99%E6%84%8F%E6%99%AE%E4%BA%AC%E7%99%BC%E8%A8%80) |
| knews | 200 | CC | [文章](https://www.knews.com.tw/news/143C66748E1853748F22503AA9B75964) |
| bbc_global | 200 | Mark Savage | [文章](https://www.bbc.com/news/articles/c5398kkx27ewo) |
| taipeitimes | 200 | Staff writer, with agencies | [文章](https://www.taipeitimes.com/News/front/archives/2026/10/03/2003865308) |
| epochtimes | 200 | 李擷瓔 | [文章](https://www.epochtimes.com/b5/26/10/3/n14862680.htm) |
| nikkei | 200 | 王 征 | [文章](http://cn.nikkei.com/politicsaeconomy/politicsasociety/64123-2026-09-30-14-09-37.html) |
| oncc | 200 | 空白 | [文章](https://hk.on.cc/hk/bkn/cnt/news/20261003/bkn-20261003160015910-1003_00822_001.html) |
| people | 200 | 黃 瑛琦 | [文章](https://www.peoplenews.tw/articles/healthcare/59069) |
| bccnews | 403 | 空白 | [文章](https://bccnews.com.tw/archives/820627) |
| yahoo | 200 | 潘鈺楨 | [文章](https://tw.news.yahoo.com/%E8%A2%AB%E9%A6%AC%E6%96%AF%E5%85%8B%E7%84%A1%E9%A0%90%E8%AD%A6%E5%88%86%E6%89%8B%EF%BC%81-%E4%BC%B4%E4%BE%B6%E8%AD%89%E5%AF%A6%E6%83%85%E6%96%B7%E6%9B%AC%E5%B0%8D%E8%A9%B1%E3%80%8C%E4%B8%80%E5%91%A8%E5%89%8D%E9%82%84%E8%AA%AA%E6%84%9B%E6%88%91%E3%80%8D-094255027.html) |
| taiwannet | 200 | 南華大學 | [文章](https://news.taiwannet.com.tw/news/222118/%E5%8D%97%E8%8F%AF%E5%A4%A7%E5%AD%B8%E8%B5%B4%E7%BE%A9%E5%A4%A7%E5%88%A9%E5%9C%8B%E9%9A%9B%E6%85%A2%E9%A3%9F%E7%9B%9B%E6%9C%83-%E8%AE%93%E4%B8%96%E7%95%8C%E7%9C%8B%E8%A6%8B%E5%8F%B0%E7%81%A3%E8%BE%B2%E7%94%A2%E8%88%87%E9%A3%B2%E9%A3%9F%E6%96%87%E5%8C%96.html) |
| cmmedia | 200 | 信傳媒編輯部 | [文章](https://www.cmmedia.com.tw/home/articles/63139) |
| soundofhope | 200 | 空白 | [文章](https://www.soundofhope.org/post/945672) |
| peopo | 200 | 空白 | [文章](https://www.peopo.org/news/859280) |
| ustv | 200 | 非凡新聞 | [文章](https://news.ustv.com.tw/newsdetail/20261003A017) |
| cnews | 200 | 王佐銘 | [文章](https://cnews.com.tw/%e4%b8%8d%e8%ae%93%e7%99%8c%e7%97%87%e6%a1%86%e4%bd%8f%e4%ba%ba%e7%94%9f%ef%bc%81%e7%99%be%e4%bd%8d%e4%b9%b3%e7%99%8c%e7%97%85%e5%8f%8b%e7%99%bb%e3%80%8c%e6%84%9b%e6%b3%a2%e8%88%9e%e5%90%8e%e3%80%8d/) |
| hakkanews | 200 | 李 宥妍 | [文章](https://hakkanews.tw/2026/10/03/305648/) |
| agriharvest | 200 | 轉載自農傳媒；文：莊曉萍 | [文章](https://www.e-info.org.tw/node/220413) |
| mdnkids | 200 | 空白 | [文章](https://www.mdnkids.com/content.asp?Link_String_=24A300000VTNXSO) |
| aboluowang | 200 | 大紀元 | [文章](https://tw.aboluowang.com/2026/1003/2441170.html) |
| ttv | 200 | TTV | [文章](https://news.ttv.com.tw/news/11510030001900W) |
| i_meihua | 200 | 洪子苓 | [文章](https://www.i-meihua.com/Article/Detail/57033) |
| pinview | 200 | 空白 | [文章](https://www.pinview.com.tw/News/63293.html) |
| tyenews | 200 | 陳儒賢 | [文章](https://tyenews.com/2026/10/1413850/) |
| ct | 200 | lumiere-app.com | [文章](https://ct.org.tw/html/news/3-3.php?cat=9&article=1404529) |
| voachinese | 200 | 李逸华 | [文章](https://www.voachinese.com/a/republican-senator-u-s-and-china-should-avoid-decoupling-taiwan-policy-should-stay-the-course-20261002/8207236.html) |
| thehubnews | 200 | 記者爆料網 | [文章](https://www.thehubnews.net/archives/671502) |
| civilmedia | 200 | 社運 發電機 | [文章](https://www.civilmedia.tw/archives/141377) |
| guancha | 200 | 空白 | [文章](https://www.guancha.cn/SaturdayAtelier/2026_10_03_903043.shtml) |
| thepaper | 200 | 空白 | [文章](https://www.thepaper.cn/newsDetail_forward_34194280) |
| winnews | 403 | 空白 | [文章](https://www.winnews.com.tw/282049/) |
| theinitium | 200 | 龔玨 | [文章](https://theinitium.com/20261002-international-mr-nobody-against-putin/) |
| ydn | 200 | 蕭宇廷 | [文章](https://www.ydn.com.tw/tw/News/ugC_News_Detail.aspx?ID=646985) |
| hsnews | 200 | 空白 | [文章](https://hsnews.com.tw/lifestyle-and-community/wan-jian-qi-fa-ge-wu-tong-qing-2026tai-ping-yang-yuan-zhu-min-chuan-tong-she-jian-xun-hui-sai-feng-lin-zhan-xi-yin-chao-guo400ming-she-shou.html) |
| lai_media | 200 | 周庭慶 | [文章](https://lai-media.net/news_view.php?new_sn=144958&new_csn=3104) |
| bannedbook | 200 | 編輯團隊 | [文章](https://www.bannedbook.org/bnews/zh-tw/bannedvideo/20261003/2366155.html) |
| hakkatv | 200 | 空白 | [文章](https://www.hakkatv.org.tw/news-detail/1790937069354858) |
| grinews | 200 | 空白 | [文章](https://grinews.com/news/%e6%b0%91%e4%b8%bb%e6%b3%95%e6%b2%bb%e6%ad%aa%e6%a8%93%e6%a1%88%e4%be%8b%e4%b8%89%e5%89%87/) |
| singular | 200 | 商傳媒 提供 | [文章](https://www.scooptw.com/sunmedia/535361/%E5%91%8A%E5%88%A5%E6%89%8B%E5%8B%95%E6%95%B4%E7%90%86-rom-%E6%AA%94-%E5%BE%A9%E5%8F%A4%E9%81%8A%E6%88%B2%E8%A8%AD%E5%AE%9A%E4%B9%9F%E8%83%BD%E8%BC%95%E9%AC%86%E6%B5%81%E6%9A%A2/) |
| secretchina | 200 | 空白 | [文章](https://www.secretchina.com/news/gb/2026/10/03/1105627.html) |
| daai | 200 | 空白 | [文章](https://www.daai.tv/news/599609) |
| bigmedia | 200 | 林瀚 | [文章](https://www.bigmedia.com.tw/article/1790922361133) |
| i_media | 200 | 洪子苓 | [文章](https://i-media.tw/Article/Detail/51186) |
| newspie | 200 | admin | [文章](https://www.newspie.com.tw/motocycle-202609-20261002/) |
| policenews | 200 | 趙靜姸 | [文章](https://www.tcpttw.com/local/2026/10/03/316867/) |
| anntw | 200 | 呂翔禾 | [文章](https://www.anntw.com/articles/20261001-BSy0) |
| yesmedia | 200 | 孟倩玉 | [文章](https://www.yesmedia.com.tw/%E7%B0%A1%E6%96%87%E7%A7%80%E5%8D%97%E8%87%BA%E8%80%81%E9%97%86%E5%A8%98%E5%8D%94%E6%9C%83%E5%97%A8%E5%94%B1%E3%80%8C%E6%88%91%E6%98%AF%E6%9C%9B%E6%98%A5%E9%A2%A8%E3%80%8D%EF%BC%8110-7%E6%99%9A/) |
| news886 | 200 | 劉至程 | [文章](https://886.news/archives/365077) |
| tcnews | 200 | 空白 | [文章](https://www.tcnews.com.tw/news/item/30805.html) |
| miin | 200 | 空白 | [文章](https://miin.cc/story/7830314) |
| watchmedia01 | 200 | 郭 嘉 | [文章](https://www.watchmedia01.com/archives/554984) |
| innews | 200 | 陳嫣蔚 | [文章](https://innews.com.tw/%e3%80%8c2026%e6%96%b0%e7%ab%b9%e5%b8%82%e8%8d%89%e5%9c%b0%e6%95%85%e4%ba%8b%e7%af%80%e3%80%8d%e9%96%8b%e8%b7%91%ef%bc%81%e5%8c%97%e5%a4%a7%e5%85%ac%e5%9c%92%e5%8c%96%e8%ba%ab%e3%80%8c%e9%96%b1/) |
| owlting | 200 | 范麗玉 | [文章](https://news.owlting.com/articles/1465126) |
| newstaiwan | 200 | 好報 編輯 | [文章](https://newstaiwan.net/?p=485764) |
| taro | 200 | 芋傳媒 | [文章](https://taronews.tw/2026/10/03/1209423/) |
| new_report | 200 | 周庭慶 | [文章](https://new-reporter.com/news/280329/) |
| enn | 200 | 廖宥婷 | [文章](https://17news.net/archives/340971) |
| kingtop | 200 | 空白 | [文章](https://www.kingtop.com.tw/detail.php?type=lastest&id=54378) |
| greatnews | 200 | 于郁金 | [文章](https://greatnews.com.tw/news_pagein.php?iType=1010&n_id=315270) |
| nvns | 200 | 羅蔚舟 | [文章](https://nvns.net/news_view.php?new_sn=144960&new_csn=1977) |
| kamalan_news | 200 | 譚杰、趙奇濤 | [文章](https://www.kamalan-news.com/political/22/19155) |
| fclnews | 200 | 王俊欽 | [文章](https://www.fclnews.com/229512/) |
| globalnewstv | 200 | easontian | [文章](https://globalnewstv.com.tw/202609/237827/) |
| pronews | 200 | 李 堂安 | [文章](https://pronews.tw/2026/10/03/317345/) |
| bo6s | 200 | 范曉龍 | [文章](https://www.bo6s.com.tw/news_detail.php?NewsID=117213) |
| taidaily | 200 | 很角色時報 | [文章](https://taidaily.com/2026/10/03/583457/) |
| lihpao | TimeoutError: The operation was aborted due to timeout | 空白 | [文章](https://www.limedia.tw/fea/74375/?utm_source=rss&utm_medium=rss&utm_campaign=%25e7%259f%25b3%25e6%25a2%25af%25e5%259d%25aa%25e8%25bf%258emakotaay%25e8%2597%259d%25e8%25a1%2593%25e5%25ad%25a3%25e3%2580%2580%25e6%25bb%25bf%25e6%259c%2588%25e3%2580%2581%25e8%2588%25b9%25e9%259a%258a%25e8%2588%2587%25e6%25b5%25b7%25e9%25a2%25a8%25e9%259f%25b3%25e6%25a8%2582%25e5%2590%258c%25e5%25a0%25b4) |
| focusnews | 200 | 李祖東 | [文章](https://focusnews.com.tw/2026/10/724107/) |
| macaodaily | 200 | 空白 | [文章](https://www.macaodaily.com/html/2026-10/03/content_1937722.htm) |
| tnews | 200 | 邱仁武 | [文章](https://tnews.cc/06/News/View/1198091) |
| travelnews | 200 | T T | [文章](https://fearless.cool/mag/%e9%81%8a%e5%ae%a2%e6%9d%b1%e6%be%b3%e7%8d%a8%e6%9c%a8%e8%88%9f%e6%ad%b7%e9%9a%aa%e8%a8%98-%e6%b3%a2%e9%ba%97%e5%a3%ab%e8%a7%a3%e5%8d%b1-%e5%ae%9c%e8%98%ad%e6%96%b0%e8%81%9e%e7%b6%b2/) |
| rise_mediacorp | 403 | 空白 | [文章](https://rise-mediacorp.com/archives/149650) |
| nchn | 200 | 環境部 | [文章](https://nchn.news/archives/166175) |
| pnn | 200 | 空白 | [文章](https://pnn5.aotter.net/viewer/4317a6a5-5911-4dcf-8808-a2003b8e2e98) |
| homeplus | 200 | 空白 | [文章](https://news.homeplus.net.tw/single/332833) |
| st_media | 200 | 空白 | [文章](https://news.st-media.com.tw/news/63233) |
| right_media | 200 | 墨新聞 | [文章](https://www.right-media.news/archives/237121) |
| j_media | 200 | 空白 | [文章](https://j-media.tw/Article/Detail/38650) |
| tristarnews | 200 | 陳昌毅 | [文章](https://n.yam.com/Article/20261003705049) |
| taiwanus | 200 | 空白 | [文章](https://www.taiwanus.net/news/press/2026/202610021038091660.htm) |
| lifenews | 200 | 健康醫療網 | [文章](https://lifenews.com.tw/591535) |
| news586 | 200 | 點傳媒 | [文章](https://news.586.com.tw/2026/10/655052/) |
| taiwanpost | 200 | 吳瀛洲 | [文章](https://taiwanpost.net/2026/local/173263/) |
| chengpou | 200 | 正報 | [文章](https://www.chengpou.com.mo/dailynews/263092.html) |
| taipeipost | 200 | 商傳媒 | [文章](https://taipeipost.org/396136/) |
| yaya_news | 200 | 徐義雄 | [文章](https://yayanews.com.tw/33855/) |
| firenews | 200 | 商傳媒 | [文章](https://firenews.com.tw/2026/10/03/%E7%90%A5%E7%8F%80%E6%B2%B9%E9%A6%99%E7%AB%B6%E8%B3%BD%E8%90%BD%E5%B9%95-30%E5%9C%98%E9%9A%8A%E5%8C%AF%E8%81%9A%E8%87%BA%E5%8C%97%E5%BB%9A%E8%97%9D%E4%BA%A4%E6%B5%81%E5%B1%95%E7%8F%BE%E5%8F%B0/) |
| hiilan | 200 | tsu ainsley | [文章](https://www.crushonyilan.com.tw/hiking-hurt/) |
| rwnews | 200 | 民間全民電視公司 | [文章](https://www.ftvnews.com.tw/news/detail/2025929W0334) |
| ccsn0405 | 200 | 空白 | [文章](https://www.ccsn0405.com/2026/10/blog-post_752.html) |
| bbc | 200 | 葛蕾絲·狄恩 （Grace Dean） | [文章](https://www.bbc.com/zhongwen/articles/cq62yr0ndd5zo/trad?at_medium=RSS&at_campaign=rss) |
| yam | 200 | 蕃新聞 | [文章](https://n.yam.com/Article/20251003889446) |
| tpnews | 200 | TPN新聞 實習編輯 | [文章](https://tpnews.org/tpnews-international-news-collection/%e5%9c%8b%e9%9a%9b%e6%96%b0%e8%81%9e%e4%be%86%e6%ba%90rss/prn/2026/10/03/122252/%e6%8a%80%e5%98%89-ai-top-atom-64gb-%e7%b5%b1%e4%b8%80%e8%a8%98%e6%86%b6%e9%ab%94%e7%89%88%e6%9c%ac%e7%99%bb%e5%a0%b4%ef%bc%8c%e6%8b%93%e5%b1%95%e6%a1%8c%e4%b8%8a%e5%9e%8b-ai-%e9%96%8b%e7%99%bc/) |
| news_yahoo | 200 | オリコン | [文章](https://news.yahoo.co.jp/pickup/6597428) |
| taiwandaily | 200 | 美洲台灣日報 | [文章](https://vigormedia.tw/%e5%b0%88%e6%ac%84-%e5%82%ac%e7%94%9f%e5%8f%b0%e7%81%a3%e5%9c%8b%e5%ae%b6%e5%8d%9a%e7%89%a9%e9%a4%a8-769787299ef4/) |
| cn_nytimes | 200 | 王月眉2026年9月29日 | [文章](https://cn.nytimes.com/china/20260929/china-zion-church-pastor-detained-family/) |
| cdn_news | 200 | 空白 | [文章](https://cdn-news.org/News.aspx?EntityID=News&PK=00000000a49ac9e3a6e8bd95d1044e4592fe656c3ca3b6ec) |
| stheadline | 200 | 空白 | [文章](https://www.stheadline.com/breaking-news/3622868/%E5%B1%AF%E9%96%80%E5%85%AC%E8%B7%AF4%E8%BB%8A%E7%9B%B8%E6%92%9E-%E6%B6%892%E7%9A%84%E5%A3%AB2%E7%A7%81%E5%AE%B6%E8%BB%8A-3%E4%BA%BA%E8%BC%95%E5%82%B7%E9%80%81%E9%99%A2) |
| news_pchome | 200 | 中央社 | [文章](https://news.pchome.com.tw/finance/cna/20261003/index-17910219061872018003.html) |
| cnn | 200 | Rikka Altland | [文章](https://www.cnn.com/cnn-underscored/reviews/best-product-launches-2026-10-02) |
| taiwannews | 200 | 空白 | [文章](https://taiwannews.com.tw/en/news/6446539) |
| ifeng | 200 | 网通社 | [文章](https://auto.ifeng.com/c/8wptdeW3015) |
| news_qq | 200 | 深度文娱2026-10-03 18:15发布于黑龙江 | [文章](https://news.qq.com/rain/a/20261003A088ME00) |
| reuters | 200 | Simon Scarr | [文章](https://www.reuters.com/graphics/ISRAEL-PALESTINIANS/HEZBOLLAH-PAGERS/mopawkkwjpa/) |
| cdns | 200 | 楊文琳 | [文章](https://www.cdns.com.tw/articles/1469337) |
| dw | 200 | Marcel Fürstenau | [文章](https://www.dw.com/zh/%E7%BB%9F%E4%B8%8036%E5%B9%B4%E4%B8%9C%E8%A5%BF%E5%BE%B7%E4%BB%8D%E6%9C%89%E9%9A%90%E5%BD%A2%E9%B8%BF%E6%B2%9F/a-79529462) |
| focustaiwan | 200 | Focus Taiwan - CNA English News | [文章](https://focustaiwan.tw/sci-tech/202610030013) |
| ntdtv | 200 | 新唐人電視台 | [文章](https://www.ntdtv.com/b5/2026/10/03/a104138636.html) |
| cctv | 200 | 空白 | [文章](https://news.cctv.com/2026/10/02/ARTIg5zpNGB2PXGoc9g5vO5Z261002.shtml) |
| life | 200 | 記者爆料網 | [文章](https://life.tw/article/%E5%BF%AB%E8%A8%8A%E7%96%91%E5%BE%AE%E9%9B%BB%E8%BB%8A%E8%B5%B7%E7%81%AB-%E9%AB%98%E9%9B%84%E4%BD%8F%E5%AE%85%E5%86%92%E6%BF%83%E7%85%99-%E5%B1%8B%E4%B8%BB%E9%80%81%E9%86%AB-3168440) |
| scmp | 200 | William Zheng | [文章](https://www.scmp.com/news/china/military/article/3369657/chinese-troops-line-russias-tsentr-2026-exercise-military-ties-tighten) |
| cn_wsj | 200 | 魏玲灵 | [文章](https://china.createsend1.com/t/j-e-ydlrkkiy-hynykddkd-r/) |
| merit_times | 200 | 人間福報 | [文章](https://www.merit-times.com.tw/NewsPage.aspx?unid=943663) |
| nexttv | 200 | 壹電視編輯中心 | [文章](https://www.nexttv.com.tw/NextTV/News/Home/Society/2026-10-03/2485033.html) |
| taiwanhot | 200 | 空白 | [文章](https://taiwanhot.net/news/focus/1149826/%E6%B8%85%E5%A2%83%E8%BE%B2%E5%A0%B4%E8%BF%8E%E5%9C%8B%E6%85%B6+%E7%B5%90%E5%90%88%E7%89%A7%E5%A0%B4%E6%B7%B1%E5%BA%A6%E9%AB%94%E9%A9%97+10-10%E5%85%A8%E7%A5%A8%E4%BA%AB210%E5%85%83%E5%84%AA%E5%BE%85%E5%83%B9+/69/%E6%97%85%E9%81%8A) |
| today_line_me | 200 | 鏡週刊 Mirror Media | [文章](https://today.line.me/tw/v3/article/oqp17MW) |
| fountmedia | 200 | 鍾榮峰 | [文章](https://www.fountmedia.io/article/430753) |
| twline365 | 200 | 友站新聞 | [文章](https://twline365.com/2026/10/1240997/) |
| zaobao | 200 | 姜贵瑛 | [文章](https://www.zaobao.com.sg/news/world/story20261003-9778339) |
| worldjournal | 200 | 娛樂新聞組／即時報導 | [文章](https://www.worldjournal.com/wj/story/121233/9792199) |
| matsu_idv | 200 | 陳子榮 | [文章](http://www.matsu.idv.tw/topicdetail.php?f=1&t=344504) |
| leho | 200 | 柯宗鑫 | [文章](https://leho.com.tw/archives/395690) |
| matsu_news | 200 | 空白 | [文章](https://www.matsu-news.gov.tw/news/article/244944) |
| mingpao | 200 | 明報新聞網 | [文章](https://news.mingpao.com/ins/%e5%85%a9%e5%b2%b8/article/20261003/s00004/1791019595647/%e3%80%8c%e5%85%a8%e4%b8%96%e7%95%8c%e9%83%bd%e7%9f%a5%e9%81%93%e4%b8%ad%e5%9c%8b%e4%ba%ba%e6%94%be%e5%81%87%e4%ba%86%e3%80%8d%e7%86%b1%e6%90%9c%e7%ac%ac%e4%b8%80-%e9%81%8a%e5%ae%a2-%e7%86%b1%e9%96%80%e6%99%af%e9%bb%9e%e4%b9%9d%e6%88%90%e5%90%8c%e8%83%9e-%e5%83%8f%e6%b2%92%e5%87%ba%e5%9c%8b) |
| sunmedia | 200 | 何映辰 | [文章](https://sunmedia.tw/news/technology/1790983025-%E6%A8%82%E9%AB%98%E8%81%AF%E5%90%8D%E9%81%8A%E6%88%B2%E7%AB%99%E6%A8%A1%E5%9E%8B%E6%98%8E%E6%97%A5%E9%96%8B%E8%B3%A3%20%E7%B4%B0%E7%AF%80%E9%87%8D%E7%8F%BE%E5%88%9D%E4%BB%A3%E6%A9%9F%E6%87%B7%E8%88%8A%E9%AD%85%E5%8A%9B) |
| eracom | 200 | 年代電視編輯中心 | [文章](https://www.eracom.com.tw/EraNews/Home/HotNews/2026-10-03/2484984.html) |
| sinchew | 200 | 星洲网 | [文章](https://www.sinchew.com.my/news/20261003/nation/7907957) |
| taiwanplus | 200 | TaiwanPlus | [文章](https://www.taiwanplus.com/news/taiwan-news/sports/261003009/hsieh-and-liang-take-gold-in-asian-games-all-taiwan-tennis-doubles-final) |
| news_sina | 200 | 新华社 | [文章](https://news.sina.cn/gn/2026-10-03/detail-initxspz3933925.d.html) |
| taiwan | 200 | 中国台湾网 | [文章](https://news.sina.cn/znl/2026-09-24/detail-inisxhnx5304571.d.html) |
| ksnews | 200 | 劉 怡伶 | [文章](https://www.ksnews.com.tw/e/146492) |
| zmedia | 200 | UDIGIT TECHNOLOGY CO.,LTD. | [文章](https://www.zmedia.com.tw/Document/NewsDetail/44493) |
| taiwanenews | 200 | 盧思綸 | [文章](https://www.taiwanenews.com/docs/20260930101.php) |
| wenweipo | 200 | 空白 | [文章](https://www.wenweipo.com/a/202610/03/AP6ac0bfb6e4b01d54a285c064.html) |
| xinhuanet | 200 | 空白 | [文章](http://www.news.cn/sci-tech/20260922/a5b3411743f44f368b657f669cc6d38a/c.html) |
| news_163 | 200 | 网易 | [文章](https://www.163.com/news/article/L83BH1KR000181BR.html) |
| more_news | 200 | 張 游舜 | [文章](https://more-news.tw/734359/) |
| tkww | 200 | 空白 | [文章](https://www.tkww.hk/a/202610/03/AP6ac03ce1e4b0e1e2ee728b4a.html) |
| hk_crntt | 200 | 空白 | [文章](https://hk.crntt.com/doc/1072/4/0/4/107240423.html?coluid=2&kindid=4&docid=107240423&mdate=1003123915) |
| enews | 200 | 空白 | [文章](https://enews.tw/article/1265522) |
| rfa | 200 | 记者：刘保罗 | [文章](https://www.rfa.org/mandarin/yataibaodao/2026/10/02/taiwandongshacross-straitchinese-fishing-vessel/) |
| vigormedia | 200 | 鍾和風 | [文章](https://vigormedia.tw/%e6%8e%a8%e5%8b%95%e7%b6%a0%e8%89%b2%e6%97%85%e9%81%8a%e5%89%b5%e8%a8%ad%e3%80%8c%e9%ab%98%e9%9b%84%e6%b0%b8%e7%ba%8c%e8%aa%8d%e8%ad%89%e6%a8%99%e7%ab%a0%e3%80%8d%e3%80%80%e9%ab%98%e9%9b%84%e8%a7%80/) |
| jdanews | 200 | 空白 | [文章](http://jdanews.com/03_000030.php) |
| my_formosa | 200 | 空白 | [文章](https://my-formosa.com.tw/KM/News.asp?Did=229656) |
| huanqiu | 200 | 空白 | [文章](https://www.huanqiu.com/article/4TSO7327GjX) |
| biao_news | 200 | 空白 | [文章](https://www.biao-news.com/news_view.php?new_sn=144926&new_csn=2713) |
| idn | 200 | 卓羽榛 | [文章](https://www.idn.com.tw/news/news_content.aspx?catid=1&catsid=2&catdid=0&artid=20261002carey100008) |
| contentplatform_info | 200 | 空白 | [文章](https://www.contentplatform.info/articles/524276/%e9%9d%92%e5%b9%b4%e7%99%be%e5%84%84%e6%b5%b7%e5%a4%96%e5%9c%93%e5%a4%a2%e5%9f%ba%e9%87%91%e9%9b%b2%e5%98%89%e5%a0%b4%e6%88%90%e6%9e%9c%e5%b1%95%e3%80%80%e9%8c%84%e5%8f%96%e4%ba%ba%e6%95%b8%e5%80%8d/) |
| mknews | 200 | 李祖東 | [文章](https://mknews.com.tw/2026/10/1001048/) |
| 17news | 200 | 廖宥婷 | [文章](https://17news.net/archives/340971) |
| ltvnews | 200 | 蔡佳坊 | [文章](https://www.ltvnews.net/archives/201364) |
| lifetoutiao_news | 200 | 中華超傳媒 | [文章](https://www.lifetoutiao.news/356763/) |
| i_news | 403 | 空白 | [文章](https://i-news.com.tw/2026/10/459817/) |
| yimedia | 200 | ctwant | [文章](https://yimedia.com.tw/lifestyle/1079079/) |
| newday | 200 | 林 曉君 | [文章](https://newsday.tw/news/585068) |
| readr | 200 | 劉怡馨 | [文章](https://www.readr.tw/post/3057) |
| peponews | 200 | 陳世宗 | [文章](https://www.peponews.tw/2026/10/03/287020/) |
| videoland | 200 | 吳嘉倪 | [文章](https://news.videoland.com.tw/article/4eb35491-c89e-49ad-b8e3-7f03974fc9ec.html) |
| newsmarket | 403 | 空白 | [文章](https://www.newsmarket.com.tw/blog/243171/) |
| funnews | 200 | 陳夏恩 | [文章](https://funnews.tw/n/serv/art/02c52894b2164e17bb7513d0ce204165) |
| tmnu | 200 | 陳們明 | [文章](https://www.tmnu.org.tw/news/4840) |
| people_cn | 200 | 103977 | [文章](http://politics.people.com.cn/n1/2026/1003/c461001-40808997.html) |
| xinhua | 200 | 空白 | [文章](http://www.news.cn/sci-tech/20260922/a5b3411743f44f368b657f669cc6d38a/c.html) |
| ntdtv_tw | 200 | 空白 | [文章](https://www.ntdtv.com.tw/b5/20261002/video/411505.html) |
| yonhap | 200 | 邊龍珠 | [文章](https://cb.yna.co.kr/gate/big5/cn.yna.co.kr/view/ACK20261003000100881) |
| kyodo | 200 | 共同社 | [文章](https://tchina.kyodonews.net/articles/-/14406) |
| nhk | 200 | NHK WORLD | [文章](https://www3.nhk.or.jp/nhkworld/zt/news/nd-20261001de53699/) |
| afp | 200 | 空白 | [文章](https://factcheck.afp.com/doc.afp.com.C9962NR) |
| ap | 200 | The Associated Press | [文章](https://www.ap.org/news-highlights/elections/2026/most-americans-blame-trump-for-high-prices-as-midterms-approach-a-new-ap-norc-poll-finds/) |
| iw_times | 200 | 空白 | [文章](https://www.iw-times.com/news_view?new_sn=144912) |
| ammtw | 200 | 空白 | [文章](https://ammtw.com/173274) |
| cnyes | 200 | 鉅亨網新聞中心 | [文章](https://news.cnyes.com/news/id/6622154) |
| ctv | 略過（發現器或影片來源） | 空白 | 請見 news-crawl-audit.json 原始樣本 |
| udnmoney | 200 | 拉哥斯5日綜合外電報導 | [文章](https://money.udn.com/money/story/5599/9796788) |
| 1111 | 200 | 1111人力銀行 \| 全球華人股份有限公司 | [文章](https://www.1111.com.tw/news/jobns/167675) |
| cool3c | 200 | Chevelle.fu | [文章](https://www.cool3c.com/article/252676) |
| sportsv | 200 | 掰咖老師 | [文章](https://www.sportsv.net/articles/128890) |
| moneydj | 200 | MoneyDJ新聞 | [文章](https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=14b87200-41a3-4e7e-ae31-852c4fa34bce&utm_source=9666565796965957181826576716&utm_medium=RSS) |
| vogue | 200 | Nicole Lee、Chen Yu、Avril Chen | [文章](https://www.vogue.com.tw/article/2026-october-cover-lin-chi-ling) |
| housefun | 200 | 李彥穎 | [文章](https://www.myhousing.com.tw/n/n01/south-taiwan/kaohsiung-estate/297341/) |
| nius | 200 | PRSTANd | [文章](https://www.niusnews.com/=P3jfpi803) |
| technews | 200 | 台北 天文館 | [文章](https://technews.tw/2026/10/05/star-collision_extreme-debris-disk/) |
| soft4fun | 200 | 手哥 HANDBRO | [文章](https://www.soft4fun.net/tech/defence-tech/spacex-starshield-explainer-overview.htm) |
| kocpc | 200 | 達小編 | [文章](https://www.kocpc.com.tw/archives/671196) |
| saydigi | 200 | 尼力 | [文章](https://www.saydigi.com/2026/10/1455880.html) |
| elle | 200 | Michelle Yang | [文章](https://www.elle.com/tw/life/foodie/g74002187/tokyo-wakan/) |
| womany | 200 | 品牌生活快訊 | [文章](https://womany.net/read/article/33519?ref=rss) |
| gamme | 200 | 鯛魚 | [文章](https://news.gamme.com.tw/1775034) |
| wyc | 200 | 袁維翎 | [文章](https://dq.yam.com/post/17061) |
| pansci | 200 | PanSci、鳥苷三磷酸 (PanSci Promo) | [文章](https://pansci.asia/archives/382306) |
| ithome | 200 | 李建興 | [文章](https://www.ithome.com.tw/news/179415) |
| babyou | 200 | 黃語汐 綜合報導 | [文章](https://babyou.me/sex-love-afraid-261005) |
| daman | 200 | 數位策展員 - Lupi | [文章](https://www.damanwoo.com/node/98021) |
| bnext | 200 | 數位時代 BusinessNext | [文章](https://www.bnext.com.tw/article/90908/chatgpt-image-2-prompt-guide-complete) |
| healthnews | 200 | 黃嫊雰 | [文章](https://www.healthnews.com.tw/article/69869) |
| inside | 200 | MoneyDJ理財網 | [文章](https://www.inside.com.tw/article/42569-cxmt-dram-tech-gap-market-share-25-percent) |
| techorange | 200 | 廖紹伶 | [文章](https://techorange.com/2026/10/05/kawasaki-kaleido-physical-ai/?utm_source=rss&utm_medium=feed&utm_campaign=techorange_rss) |
| bw | TypeError: fetch failed | 空白 | [文章](https://www.businessweekly.com.tw/business/blog/3022468) |
| techbang | 200 | IFENG | [文章](https://www.techbang.com/posts/133546-fujifilm-lto-10-tape-100tb-cold-storage) |
| top1health | 200 | 黃曼瑩 | [文章](https://www.top1health.com/Article/248/96209) |
| einfo | 200 | 李蘇竣 | [文章](https://e-info.org.tw/node/243931) |
| techcrunch | 200 | Sarah Perez | [文章](https://techcrunch.com/2026/10/05/instinct-brings-its-ai-agent-to-group-chats-even-for-friends-without-an-account/) |
| cw | 200 | 李如龍律師 | [文章](https://www.cw.com.tw/article/5142765?rec=es) |
| coolloud | 200 | 陳韋綸 | [文章](http://www.coolloud.org.tw/node/99536) |
| edh | 200 | 早安健康編輯部 | [文章](https://edh.tw/articles/p2yaBoT) |
| tsna | 200 | 吳政紘 | [文章](https://tsna.com/article/203849) |
| hbr | 200 | 王毓茹 Vera Wang | [文章](https://www.hbrtaiwan.com/article/25232/compal-ai-quality-control-500-sites) |
| nom | 200 | 空白 | [文章](https://nommagazine.com/%e7%b2%be%e5%93%81%e5%86%b0%e6%b7%87%e6%b7%8b-double-v-%e8%81%af%e6%89%8b%e6%b2%81%e5%b3%af%e9%a4%8a%e8%9c%82%e5%a0%b4-%e6%8e%a8%e5%87%ba%e6%9c%9f%e9%96%93%e9%99%90%e5%ae%9a%e5%86%b0%e5%93%81/) |
| pantravel | 200 | 旅飯 | [文章](https://pantravel.life/archives/23703) |
| cheers | 200 | 蘇欣儀 | [文章](https://today.line.me/tw/v3/article/EXwBnoQ) |
| eventsinfocus | 200 | 王子豪 | [文章](https://eventsinfocus.org/news/7148483) |
| newcongress | 200 | 空白 | [文章](https://newcongress.tw/?p=38129) |
| punchline | 200 | Punch | [文章](https://punchline.asia/archives/63542) |
| gv | 200 | Sangita Swechcha | [文章](https://zht.globalvoices.org/2026/05/15/37282/) |
| ldope | Stored latest URL is an author archive, excluded from article validation | 空白 | [文章](https://ldope.com/author/coman/) |
| ngm | 200 | 空白 | [文章](https://www.natgeomedia.com/environment/article/content-19442.html) |
| dacota | 200 | 雲爸 | [文章](https://dacota.tw/blog/post/gezi-quark-downloader) |
| applealmond | 200 | Ted | [文章](https://applealmond.com/posts/327817) |
| mrmad | 200 | 瘋先生 | [文章](https://mrmad.com.tw/mrt-drink-spill-online-report) |
| newmobilelife | 200 | Andy | [文章](https://www.newmobilelife.com/2026/10/06/macos-golden-gate-beta-3/) |
| hypesphere | 200 | JL | [文章](https://hypesphere.com/breaking-news/tommccarthy_spotlight_astatement/) |
| ctee | 200 | 鄭勝得 | [文章](https://www.ctee.com.tw/news/20261005702047-430701) |
| mplus | 404 | 空白 | [文章](https://www.mplus.com.tw//article/4513) |
| musou | 200 | 空白 | [文章](https://watchout.tw/reports/cfQ1ORe7lYAGkaX0Oqpr) |
| 4gamers | 200 | 薯泥 | [文章](https://www.4gamers.com.tw/news/detail/82430/kamiina-botan-yoheru-sugata-wa-yuri-no-hana-taiwan-exhibition) |
| pourquoi | No stored article body URL | 空白 | 請見 news-crawl-audit.json 原始樣本 |
| beauty321 | 200 | Orli | [文章](https://www.beauty321.com/post/73417?utm_source=googlenews&utm_medium=sourceurl&utm_campaign=exchange) |
| eld | 200 | アンザイ サヤ | [文章](https://www.roomie.tw/posts/170248) |
| foodnext | 200 | 食力 foodNEXT | [文章](https://www.foodnext.net/news/newsnow/paper/6591145578) |
| digitimes | 200 | 徐宏民 | [文章](https://www.digitimes.com.tw/col/article/?id=18320) |
| femin | 200 | 空白 | [文章](https://thefemin.com/2026/10/lush-zofriends/) |
| flipermag | 200 | 侯瀚 | [文章](https://flipermag.com/2026/10/05/mickey/) |
| tvbswoman | 200 | 王彥智 | [文章](https://woman.tvbs.com.tw/constellation/67569) |
| tvbshealth | 200 | 丁彥伶 | [文章](https://health.tvbs.com.tw/life/364738) |
| supertaste | 200 | 食尚玩家 | [文章](https://supertaste.tvbs.com.tw/hot/361787) |
| commonhealth | 200 | 趙俐雯 | [文章](https://www.commonhealth.com.tw/article/94699) |
| heho | 200 | 阿塔 | [文章](https://heho.com.tw/archives/387694) |
| gq | 200 | Aldair Téllez | [文章](https://today.line.me/tw/v3/article/Yapwyep) |
| marieclaire | 200 | jessie | [文章](https://www.marieclaire.com.tw/fashion/snapshots/96326) |
| gamer | 200 | Sam | [文章](https://gnn.gamer.com.tw/detail.php?sn=312915) |
| gvm | 200 | 廖綉玉 | [文章](https://www.gvm.com.tw/article/133501) |
| mamaclub | 403 | 空白 | [文章](https://mamaclub.com/learn/%e3%80%90%e5%8f%b0%e4%b8%ad%e8%a5%bf%e5%b1%af%e4%be%bf%e7%95%b6%e6%8e%a8%e8%96%a6%e3%80%91%e5%be%a1%e9%a6%99%e4%ba%ad%e7%b2%be%e7%b7%bb%e4%be%bf%e7%95%b6%ef%bd%9c%e5%85%ac%e5%8f%b8%e8%a1%8c%e8%99%9f/) |
| livio | 200 | Iris Tsai | [文章](https://livio.com.tw/260259/) |
| hypebeast | 200 | Gabriella Koppelman | [文章](https://hypebeast.com/zh/2026/10/ampparito-brings-the-streets-of-madrid-indoors) |
| agentm | 200 | 電影神搜 | [文章](https://news.agentm.tw/365226/) |
| shoppingdesign | 200 | 林品蓁 | [文章](https://www.shoppingdesign.com.tw/post/view/13831) |
| everydayobject | 200 | Maggy | [文章](https://www.everydayobject.us/8-gordini-concept-by-renault/) |
| bazaar | 200 | Tracy Lee | [文章](https://www.harpersbazaar.com/tw/life/food/g74023304/melrose-taipei/) |
| cosmopolitan | 200 | Amber Lin | [文章](https://www.cosmopolitan.com/tw/lifestyle/hot-topics/g74024085/starbucks-halloween-2026/) |
| businesstoday | 200 | 葛林 整理 | [文章](https://www.businesstoday.com.tw/article/category/183030/post/202610040006/) |
| gamebase | 200 | 遊戲基地 | [文章](https://news.gamebase.com.tw/news/detail/99441623) |
| google_news | 略過（發現器或影片來源） | 空白 | 請見 news-crawl-audit.json 原始樣本 |
| dongtaiwang | 略過（發現器或影片來源） | 空白 | 請見 news-crawl-audit.json 原始樣本 |
| voicettank | 200 | 呂曜志 | [文章](https://voicettank.org/20261005-2/) |
| dramaqueen | 200 | 空白 | [文章](https://www.dramaqueen.com.tw/news/20260618/001.html) |
| viewpointtaiwan | 200 | viewpointtaiwan | [文章](http://www.viewpointtaiwan.com/columnist/%e5%8f%b0%e7%a9%8d%e9%9b%bb%e8%88%87%e6%97%a5%e6%9c%ac%e5%90%88%e4%bd%9c%e6%b7%b1%e5%8c%96%e5%bf%ab%e8%b7%91%ef%bc%8c%e6%98%af%e5%9b%a0%e7%82%ba%e7%be%8e%e5%9c%8b%e5%8a%a9%e6%8e%a8%ef%bc%9f/) |
| asiatatler | 200 | Alec Zhan | [文章](https://www.tatlerasia.com/power-purpose/wealth/2026-tatler-ball-zh-winner-hant) |
| adaymag | 200 | 空白 | [文章](https://www.adaymag.com/2026/09/23/anne-hathaway-shiseido-skincare-fortw.html) |

## Vogue 多版型補驗

另外重新抓取標準 header（content-header__accreditation）的兩篇公開文章，與封面 split-screen header（content-header-text）各自取得主文章署名。

| 文章 | 預期及實際署名 |
| --- | --- |
| [NOT A HOTEL](https://www.vogue.com.tw/article/not-a-hotel-%E5%AE%89%E8%97%A4%E5%BF%A0%E9%9B%84-tadao-ando-herzog-de-meuron) | Silvia Sun |
| [Valentino 2027](https://www.vogue.com.tw/article/valentino-spring-summer-2027-antibiblioteca-concept) | Marthe Mabille、Kuan Lin（Translated and Adapted by） |

這兩篇 header 外也含多個推薦或內嵌文章的 byline，主文章 selector 不採用那些名字。兩個版型均有獨立 regression fixture；reporter-media.spec.ts 目前共 32 個通過案例。

## 使用者提供案例再驗證（2026-10-06）

原先逐媒體一篇樣本的稽核未涵蓋下列署名格式，不能把「抽样成功」視為其他文章全部正確。此次重新讀取原始公開頁，補上亞太新聞網前綴、Lai 傳媒品牌和人名之間的空格，以及中央社轉載文章結尾的具名編譯；正文證據優先於媒體或發布帳號署名。警政時報與聯合報兩個例子的最新解析器本來能讀出人名，但既有資料仍是舊署名，需另外更新。

| 實際原始文章 | 原署名問題 | 已驗證人名 |
| --- | --- | --- |
| [樂聯網桃園金品獎](https://leho.com.tw/archives/396994) | 亞太新聞網取代正文記者 | 范文濱 |
| [新頭條桃園金品獎](https://new-reporter.com/news/280576/) | 既有署名仍是警政時報 | 范文濱 |
| [自由時報奈及利亞軍機](https://news.ltn.com.tw/news/world/breakingnews/5596642) | 文章開頭只有中央社，結尾另有具名編譯 | 陳彥鈞 |
| [OwlNews 藏壽司火警](https://news.owlting.com/articles/1466446) | 品牌與記者姓名間沒有斜線 | 金東天 |
| [新頭條藏壽司火警](https://new-reporter.com/news/280582/) | 同上 | 金東天 |
| [新頭條客家紀錄片](https://new-reporter.com/news/280580/) | 既有署名仍是警政時報 | 薛秀蓮 |
| [聯合新聞網 DeepSeek](https://udn.com/news/story/7333/9796647) | 既有署名未拆開媒體、編譯及地區 | 葉亭均 |
| [聯合新聞網同篇另一分類](https://udn.com/news/story/6811/9796647) | 同上 | 葉亭均 |
| [自由時報桃園金品獎](https://news.ltn.com.tw/news/life/breakingnews/5596583) | 記者在主文章上方的新版固定欄位 | 李容萍 |

結尾署名只接受文章末尾的明確「（編譯：人名）」及可選日期；不從責任編輯、攝影、內文中提及的記者或無具名的媒體署名推測記者。新增使用者案例與反例後，byline.spec.ts、reporter-media.spec.ts、article-content.spec.ts、article-authors.spec.ts、article-content-review.spec.ts 共 209 個測試通過。資料庫更新由主要修復流程執行，此稽核只讀取資料。

## 匿名署名與作者／編譯再驗證

以下四篇原文均於本輪重新讀取，回應 HTTP 200。三篇沒有具名作者，維持原始通訊社、媒體或編輯部署名；不能把照片中的攝影記者或責任編輯替代為文章作者。第四篇則同時有原作者及編譯，必須保留兩人。畫面應採用「署名」標籤，因為純人名也無法證明此人的角色是記者而非作者或編譯。

| 文章 ID／原文 | 直接署名證據 | 正確抽取結果 |
| --- | --- | --- |
| 29701350／[世界新聞網林郁婷](https://www.worldjournal.com/wj/story/121479/9796785) | 主文署名「中央社台北5日電」；陳正興只在照片說明中標示攝影 | 中央社台北5日電 |
| 29869653／[民視葉門摩卡港](https://www.ftvnews.com.tw/news/detail/2026A06W0029) | 正文開頭「AFP 法新社報導」，author meta「民間全民電視公司」，未見具名作者 | 民間全民電視公司 |
| 29694202／[大紀元更年期眼睛乾澀](https://www.epochtimes.com/b5/26/10/4/n14863184.htm) | 可見署名與 JSON-LD 均為「文／Amy Denney 編譯／朱緯」 | Amy Denney、朱緯 |
| 21072522／[央廣東航空服員](https://www.rti.org.tw/news?uid=3&pid=235850) | 作者「新聞編輯」、新聞引據「中央社」、責任編輯「張芯瑜」分別標示 | 新聞編輯 |

複合署名只拆解明確「文／作者 編譯／編譯人」兩個角色，保留兩人；不把責任編輯當成作者。新增後上述五個相關測試檔共 217 個測試通過，其中媒體原始版型測試共 41 個。

## 追加截圖確認

- 大紀元文章 29694201 的正文開頭為「【大紀元2026年10月06日訊】（大紀元記者陸希休斯頓報導）」，正確人名為陸希。補上精確日期電頭、地名變體及國家／城市複合電頭，重新掃描大紀元 1,735 篇並修正 187 筆，原署名保存在 epoch-date-original.jsonl。
- TVBS 文章 28792276（https://news.tvbs.com.tw/health/4030065）可見欄位明確為「作者：網路溫度計｜責任編輯：鄒昀孝」，不能將責任編輯列為作者。
- MSN 文章 30100922 的 TVBS新聞網、高鈺婷為媒體及具名署名；新唐人文章 30116821 的新聞直擊內容沒有具名記者，製作組及責任編輯不能推測成記者。看板統一使用「署名」標籤。
