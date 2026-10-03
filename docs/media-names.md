# 媒體名稱核對紀錄

核對日期：2026-10-03。範圍：全站 294 個來源紀錄（含 1 筆排除的解析殘留）（含非新聞分類、未排程與引文通訊社），以及 8 個月份試算表的所有新聞列。首次核對修正 175 個既有顯示名稱，另補齊 7 個原本只顯示英文代碼的舊來源名稱。

## 顯示與匯入規則

- `app/data/media-names.json` 是人工核對的名稱表，記錄名稱、舊稱、證據網址與核對狀態。以品牌自身的名稱為準；中文統一繁體，保留必要的語言版本區別。
- 官網首頁、品牌標誌、關於頁或官方帳號互相核對；頁面標題中的口號、網域、流量除數、地區備註都不放進名稱。
- `favicon-catalog.json` 的 title 由 `node tools/sync-media-names.ts` 同步，供 API、媒體列表、圖表與文章閱讀共用。使用 `--check` 可檢查是否漂移。
- `sync-news-source-metadata.ts` 同樣採用人工名稱表；新媒體未核對前拒絕同步，避免把原表註解當成名稱。
- `media-traffic.json` 與 `news-source-catalog.json` 保留原表名稱和別名，作為來源對應依據。來源與流量頁使用核對後的顯示名稱，舊稱收在「原表名稱」，搜尋同時支援兩者；排序以顯示名稱為準。
- 本次不改媒體 ID、文章歸屬、政治分類、流量數字或 Google 試算表。不同語言／頻道不因共用品牌合併。

## 核對狀態

- 官方名稱已核對：283 筆。
- 歷史品牌：2 筆。
- 保留既有名稱，官網待複核：7 筆。
- 名稱待確認：1 筆。
- 解析器殘留空白項目：1 筆（ctit），維持排除，不當成媒體。

蘋果日報與 every little d 保留歷史來源身份。遇到停站、轉手或異常頁面，不使用新頁面標題覆蓋舊品牌。

## 全部名稱

| 識別 | 原顯示名稱 | 核對後名稱 | 狀態 | 名稱依據 |
|---|---|---|---|---|
| 1111 | 1111人力銀行 | 1111人力銀行 | 官方名稱已核對 | [1111人力銀行-找工作、找人才，最用心服務的求職徵才網站！](https://www.1111.com.tw/) |
| ettoday | 東森新聞雲 | ETtoday 新聞雲 | 官方名稱已核對 | [ETtoday新聞雲](https://www.ettoday.net/) |
| setn | 三立新聞網 | 三立新聞網 | 官方名稱已核對 | [三立新聞網 SETN.com ／ 讓世界看見台灣的美好](https://www.setn.com/) |
| chinatimes | 中時電子報 | 中時新聞網 | 官方名稱已核對 | [中時新聞網](https://www.chinatimes.com/) |
| nownews | NOWnews | NOWnews今日新聞 | 官方名稱已核對 | [NOWnews今日新聞](https://www.nownews.com/) |
| tvbs | TVBS | TVBS新聞網 | 官方名稱已核對 | [TVBS新聞網](https://news.tvbs.com.tw/) |
| cts | 華視新聞 | 華視新聞網 | 官方名稱已核對 | [華視新聞網 - 即時新聞、影音、專題、直播](https://news.cts.com.tw/) |
| ttv | 台視新聞 | 台視新聞網 | 官方名稱已核對 | [台視新聞網](https://news.ttv.com.tw/) |
| ctee | 工商時報 | 工商時報 | 官方名稱已核對 | [工商時報](https://www.ctee.com.tw/) |
| newtalk | 新頭殼 | Newtalk新聞 | 官方名稱已核對 | [Newtalk新聞](https://newtalk.tw/) |
| tnl | 關鍵評論網 | 關鍵評論網 | 官方名稱已核對 | [TNL The News Lens 關鍵評論網](https://www.thenewslens.com/) |
| storm | 風傳媒 | 風傳媒 | 官方名稱已核對 | [風傳媒｜Storm.mg](https://www.storm.mg/) |
| ltn | 自由時報 | 自由時報 | 官方名稱已核對 | [自由時報電子報](https://news.ltn.com.tw/) |
| udn | UDN 聯合新聞網 | 聯合新聞網 | 官方名稱已核對 | [聯合新聞網](https://udn.com/news/) |
| upmedia | 上報 | 上報 | 官方名稱已核對 | [上報 Up Media - 上報 UpMedia](https://www.upmedia.mg/) |
| mirror | 鏡傳媒 | 鏡週刊 | 官方名稱已核對 | [鏡週刊 Mirror Media](https://www.mirrormedia.mg/) |
| cmmedia | 信傳媒 | 信傳媒 | 官方名稱已核對 | [信傳媒](https://www.cmmedia.com.tw/) |
| rti | 中央廣播電台 | 中央廣播電臺 | 官方名稱已核對 | [Rti 中央廣播電臺](https://www.rti.org.tw/) |
| ebc | 東森新聞 | 東森新聞 | 官方名稱已核對 | [東森新聞](https://news.ebc.net.tw/) |
| rfi | 法國國際廣播電台 | 法國國際廣播電台 | 官方名稱已核對 | [RFI - 法國國際廣播電台](https://www.rfi.fr/tw/) |
| bbc | 英國公共廣播電台 | BBC News 中文 | 官方名稱已核對 | [BBC News 中文](https://www.bbc.com/zhongwen/trad) |
| nikkei | 日本經濟新聞中文版 | 日經中文網 | 官方名稱已核對 | [日經中文網--日本經濟新聞中文版](https://zh.cn.nikkei.com/) |
| taro | 芋傳媒 | 芋傳媒 | 官方名稱已核對 | [芋傳媒 TaroNews](https://taronews.tw/) |
| epochtimes | 大紀元 | 大紀元 | 官方名稱已核對 | [大紀元 www.epochtimes.com](https://www.epochtimes.com/) |
| cna | 中央社 | 中央社 | 官方名稱已核對 | [中央社 CNA](https://www.cna.com.tw/) |
| apple | 蘋果日報 | 蘋果日報 | 歷史品牌 | 舊網域已轉至不同內容站，撤下連結並保留歷史名稱。 |
| ctwant | 時報周刊/周刊王 | CTWANT | 官方名稱已核對 | [CTWANT](https://www.ctwant.com/) |
| ftv | 民視 | 民視新聞網 | 官方名稱已核對 | [民視新聞網](https://www.ftvnews.com.tw/) |
| nextapple | 壹蘋新聞網 | 壹蘋新聞網 | 官方名稱已核對 | [壹蘋新聞網](https://news.nextapple.com/) |
| cti | 中天新聞 | 中天新聞網 | 官方名稱已核對 | [中天新聞網](https://ctinews.com/) |
| bccnews | 中廣新聞 | 中廣新聞網 | 官方名稱已核對 | [BCCnews - 中廣新聞網](https://bccnews.com.tw/) |
| cnews | 匯流新聞 | 匯流新聞網 | 官方名稱已核對 | [匯流新聞網](https://cnews.com.tw/) |
| ftnn | 鋒燦傳媒 | FTNN新聞網 | 官方名稱已核對 | [FTNN 新聞網｜傾聽不同立場的聲音，開啟對話的正面力量](https://www.ftnn.com.tw/) |
| taiwandom | 洞傳媒 | 洞傳媒 | 官方名稱已核對 | [洞傳媒 官方首頁](https://taiwandomnews.com/) |
| nius | 妞新聞 | 妞新聞 | 官方名稱已核對 | [妞新聞 niusnews｜女孩的心動發現](https://www.niusnews.com/) |
| vogue | Vogue | Vogue Taiwan | 官方名稱已核對 | [Vogue Taiwan](https://www.vogue.com.tw/) |
| womany | 女人迷 | 女人迷 | 官方名稱已核對 | [女人迷 Womany](https://womany.net/) |
| babyou | 姊妹淘 | 姊妹淘 | 官方名稱已核對 | [Babyou 姊妹淘｜華人第一女性媒體](https://babyou.me/) |
| marieclaire | 美麗佳人 | Marie Claire 美麗佳人 | 官方名稱已核對 | [Marie Claire 美麗佳人](https://www.marieclaire.com.tw/) |
| beauty321 | 美人圈 | BEAUTY美人圈 | 官方名稱已核對 | [beauty美人圈](https://www.beauty321.com/) |
| elle | ELLE | ELLE | 官方名稱已核對 | [ELLE](https://www.elle.com/tw/) |
| femin | the FEMIN | The Femin | 官方名稱已核對 | [The Femin](https://thefemin.com/tw) |
| tvbswoman | 女人我最大 | 女人我最大 | 官方名稱已核對 | [女人我最大](https://woman.tvbs.com.tw/) |
| bazaar | 哈潑時尚 | 哈潑時尚 | 官方名稱已核對 | [Harper's BAZAAR](https://www.harpersbazaar.com/tw/) |
| cosmopolitan | 柯夢波丹 | 柯夢波丹 | 官方名稱已核對 | [Cosmopolitan](https://www.cosmopolitan.com/tw/) |
| cool3c | 癮科技 | Cool3c 癮科技 | 官方名稱已核對 | [關於癮科技](https://www.cool3c.com/article/28631) |
| technews | 科技新報 | 科技新報 | 官方名稱已核對 | [TechNews 科技新報](https://technews.tw/) |
| soft4fun | 硬是要學 | 硬是要學 | 官方名稱已核對 | [硬是要學](https://www.soft4fun.net/) |
| kocpc | 點子王阿達 | 電腦王阿達 | 官方名稱已核對 | [電腦王阿達](https://www.kocpc.com.tw/) |
| saydigi | 點子生活 | 點子生活 | 官方名稱已核對 | [SayDigi ／ 點子科技生活](https://www.saydigi.com/) |
| bnext | 數位時代 | 數位時代 | 官方名稱已核對 | [數位時代 BusinessNext／台灣最具影響力的科技財經媒體](https://www.bnext.com.tw:443/) |
| ithome | itHome | iThome | 官方名稱已核對 | [iThome ／ iThome Online 是臺灣第一個網路原生報，提供IT產業即時新聞、企業IT產品報導與測試、技術專題、IT應用報導、IT書訊，以及面向豐富的名家專欄](https://www.ithome.com.tw/) |
| inside | InSide | INSIDE | 官方名稱已核對 | [INSIDE](https://www.inside.com.tw/) |
| techorange | 科技報橘 | TechOrange 科技報橘 | 官方名稱已核對 | [TechOrange 科技報橘](https://techorange.com/) |
| techbang | T客邦 | T客邦 | 官方名稱已核對 | [T客邦](https://www.techbang.com/) |
| dacota | 雲爸的私處 | 雲爸的私處 | 官方名稱已核對 | [雲爸的私處](https://dacota.tw/) |
| applealmond | 蘋果仁 | 蘋果仁 | 官方名稱已核對 | [蘋果仁 - 果仁 iPhone/iOS/好物推薦科技媒體](https://applealmond.com/) |
| mrmad | 瘋先生 | 瘋先生 | 官方名稱已核對 | [瘋先生 - 蘋果iPhone、iOS技術科技媒體](https://mrmad.com.tw/) |
| newmobilelife | 流動日報 | 流動日報 | 官方名稱已核對 | [流動日報](https://www.newmobilelife.com/) |
| gamme | 宅宅新聞卡卡洛普 | 宅宅新聞卡卡洛普 | 官方名稱已核對 | [宅宅新聞 ／ 卡卡洛普](http://news.gamme.com.tw/) |
| newsmarket | 上下游 | 上下游新聞 | 官方名稱已核對 | [上下游新聞](https://www.newsmarket.com.tw/) |
| wyc | 地球圖輯隊 | 地球圖輯隊 | 官方名稱已核對 | [DQ 地球圖輯隊](https://dq.yam.com/) |
| punchline | 娛樂重擊 | 娛樂重擊 | 官方名稱已核對 | [Punchline 娛樂重擊 — Punchline](https://punchline.asia/) |
| pansci | 泛科學 | 泛科學 | 官方名稱已核對 | [PanSci 泛科學](https://pansci.asia/) |
| housefun | 好房新聞 | 好房新聞 | 官方名稱已核對 | [好房網News](https://news.housefun.com.tw/) |
| cw | 天下 | 天下雜誌 | 官方名稱已核對 | [天下雜誌](https://www.cw.com.tw/) |
| einfo | 環境資訊中心 | 環境資訊中心 | 官方名稱已核對 | [環境資訊中心](https://e-info.org.tw/) |
| coolloud | 苦勞網 | 苦勞網 | 官方名稱已核對 | [苦勞網](https://www.coolloud.org.tw/) |
| civilmedia | 公庫報導 | 公民行動影音紀錄資料庫 | 官方名稱已核對 | [公民行動影音紀錄資料庫](https://www.civilmedia.tw/) |
| cheers | 快樂工作人 | Cheers快樂工作人 | 官方名稱已核對 | [天下學習 Cheers快樂工作人](https://www.cheers.com.tw/) |
| newcongress | 新公民議會 | 新公民議會 | 保留既有名稱，官網待複核 | [官網未能提供可核對的名稱；保留既有品牌並清除原表附註。](https://newcongress.tw/) |
| viewpointtaiwan | 觀策站 | 觀策站 | 官方名稱已核對 | [觀策站](http://www.viewpointtaiwan.com/) |
| buzzorange | 報橘 | 報橘 | 官方名稱已核對 | [報橘 官方首頁](https://www.buzzorange.com/) |
| agriharvest | 農傳媒 | 農傳媒 | 官方名稱已核對 | [農傳媒](https://www.agriharvest.tw/) |
| taisounds | 太報 | 太報 | 官方名稱已核對 | [太報 TaiSounds](https://www.taisounds.com/) |
| pourquoi | 報呱 | 報呱 | 官方名稱已核對 | [pourquoi 報呱](https://pourquoi.tw/) |
| foodnext | 食力 | 食力 | 官方名稱已核對 | [食力 foodNEXT](https://www.foodnext.net/) |
| gvm | 遠見 | 遠見雜誌 | 官方名稱已核對 | [遠見雜誌 - 40年來陪你前進的動力](https://www.gvm.com.tw/) |
| cnyes | 鉅亨網 | 鉅亨網 | 官方名稱已核對 | [鉅亨網](https://www.cnyes.com/) |
| businesstoday | 今週刊 | 今周刊 | 官方名稱已核對 | [今周刊 - 今周刊 - 在今天看見明天](https://www.businesstoday.com.tw/) |
| ustv | 非凡新聞 | 非凡新聞 | 官方名稱已核對 | [非凡新聞台](https://news.ustv.com.tw/) |
| daman | 大人物 | 大人物 | 官方名稱已核對 | [大人物](https://www.damanwoo.com/) |
| nom | NOM Magazine | NOM Magazine | 官方名稱已核對 | [NOM Magazine](https://nommagazine.com/) |
| overdope | overdope | overdope | 歷史品牌 | 原網域已變質為文件下載站，撤下連結。 |
| ldope | L.Dope | L.DOPE | 官方名稱已核對 | [L.DOPE](https://ldope.com/) |
| eld | Every Little D | every little d | 歷史品牌 | [官方公告 every little d 整併至 Roomie；原品牌仍列為作者。保留歷史來源名稱，不合併文章歸屬。](https://www.roomie.tw/posts/50784) |
| gq | GQ Taiwan | GQ Taiwan | 官方名稱已核對 | [GQ Taiwan](https://www.gq.com.tw/) |
| flipermag | FLiPER | FLiPER | 官方名稱已核對 | [FLiPER - 生活藝文誌](https://flipermag.com/) |
| livio | Livio | Livio生活網 | 官方名稱已核對 | [Livio 生活網 – 豐富每一個小日子](https://livio.com.tw/) |
| hypebeast | HYPEBEAST | HYPEBEAST | 官方名稱已核對 | [Hypebeast - 時尚、球鞋、藝術、設計與文化](https://hypebeast.com/zh) |
| shoppingdesign | Shopping Design | ShoppingDesign | 官方名稱已核對 | [ShoppingDesign](https://www.shoppingdesign.com.tw/) |
| everydayobject | Everyday Object | EVERYDAY OBJECT | 官方名稱已核對 | [EVERYDAY OBJECT](https://www.everydayobject.us/) |
| asiatatler | Taiwan Tatler | Tatler Taiwan | 官方名稱已核對 | [Tatler Asia](https://www.tatlerasia.com/) |
| hypesphere | HypeSphere | Hypesphere狂熱球電影資訊網 | 官方名稱已核對 | [hypesphere5](https://hypesphere.com/) |
| agentm | 電影神搜 | 電影神搜 | 官方名稱已核對 | [電影神搜](https://news.agentm.tw/) |
| dramaqueen | 電視迷 | DramaQueen電視迷 | 官方名稱已核對 | [DramaQueen電視迷 - 歐美影集新聞、熱門影集推薦](https://www.dramaqueen.com.tw/) |
| top1health | 華人健康網 | 華人健康網 | 官方名稱已核對 | [華人健康網](https://www.top1health.com/) |
| tvbshealth | 健康2.0 | 健康2.0 | 官方名稱已核對 | [健康2.0](https://health.tvbs.com.tw/) |
| edh | 早安健康 | 早安健康 | 官方名稱已核對 | [早安健康-每天都做得到的健康！](https://edh.tw:443/) |
| commonhealth | 康健 | 康健 | 官方名稱已核對 | [康健雜誌](https://www.commonhealth.com.tw/) |
| heho | HEHO | Heho健康 | 官方名稱已核對 | [Heho健康](https://heho.com.tw/) |
| healthnews | 健康醫療網 | 健康醫療網 | 官方名稱已核對 | [健康醫療網 - 最關心大眾健康的醫藥網路媒體](http://healthnews.com.tw/) |
| sportsv | 運動視界 | 運動視界 | 官方名稱已核對 | [運動視界 Sports Vision](https://www.sportsv.net/) |
| pantravel | 旅飯 | 旅飯 | 官方名稱已核對 | [旅飯 - Pantravel](https://pantravel.life/) |
| supertaste | 食尚玩家 | 食尚玩家 | 官方名稱已核對 | [食尚玩家](https://supertaste.tvbs.com.tw/) |
| ngm | 國家地理雜誌 | 國家地理雜誌 | 官方名稱已核對 | [國家地理雜誌官方網站｜探索自然、科學與文化的最佳權](https://www.natgeomedia.com/) |
| reporter | 報導者 | 報導者 | 官方名稱已核對 | [報導者 The Reporter](https://www.twreporter.org/) |
| people | 民報 | 民報 | 官方名稱已核對 | [民報](https://www.peoplenews.tw/) |
| yahoo | 雅虎新聞 | Yahoo新聞 | 官方名稱已核對 | [Yahoo新聞](https://tw.news.yahoo.com/) |
| bw | 商業週刊 | 商業周刊 | 官方名稱已核對 | [商周 -商業周刊 - 商周｜先進觀念．輕鬆掌握](https://www.businessweekly.com.tw/) |
| theinitium | 端傳媒 | 端傳媒 | 官方名稱已核對 | [端傳媒 Initium Media](https://theinitium.com/) |
| hbr | 哈佛商業評論 | 哈佛商業評論 | 官方名稱已核對 | [哈佛商業評論・與世界一流管理接軌](https://www.hbrtaiwan.com/) |
| eventsinfocus | 焦點事件 | 焦點事件 | 官方名稱已核對 | [焦點事件](https://eventsinfocus.org/) |
| pts | 公視新聞 | 公視新聞 | 官方名稱已核對 | [公視新聞 PNN](https://news.pts.org.tw/) |
| mplus | MPlus | MPlus云閱讀 | 官方名稱已核對 | [MPlus｜云閱讀](http://www.mplus.com.tw/) |
| gamebase | 遊戲基地 | 遊戲基地 | 官方名稱已核對 | [首頁 ／ 遊戲基地 Gamebase](https://news.gamebase.com.tw/) |
| 4gamers | 4GAMERS | 4Gamers | 官方名稱已核對 | [4Gamers 官方網站](https://www.4gamers.com.tw/) |
| gamer | 巴哈姆特 | 巴哈姆特 GNN | 官方名稱已核對 | [巴哈姆特電玩資訊站](https://gnn.gamer.com.tw/) |
| ctit | （未設定） | （維持空白） | 排除 | 舊解析器殘留，沒有來源設定；不建立同名媒體。 |
| want | 旺報 | 旺報 | 官方名稱已核對 | [中時新聞網](https://www.chinatimes.com/newspapers/2603) |
| ctitv | 中天新聞 | 中天新聞網 | 官方名稱已核對 | [中天新聞網](https://ctinews.com/) |
| ctv | 中視新聞 | 中視新聞 | 官方名稱已核對 | [中視全球資訊網](https://www.ctv.com.tw/News) |
| taipeitimes | Taipei Times | Taipei Times | 官方名稱已核對 | [Taipei Times](https://www.taipeitimes.com/) |
| udnmoney | 經濟日報 | 經濟日報 | 官方名稱已核對 | [經濟日報：不僅新聞速度 更有脈絡深度](https://money.udn.com/) |
| moneydj | MoneyDJ理財網 | MoneyDJ理財網 | 官方名稱已核對 | [MoneyDJ理財網 - 理財、財經綜合資訊網](https://www.moneydj.com/) |
| peopo | PeoPo 公民新聞 | PeoPo 公民新聞 | 官方名稱已核對 | [首頁 ／ PeoPo 公民新聞](https://www.peopo.org/) |
| mamaclub | 媽媽經 | 媽媽經 | 官方名稱已核對 | [媽媽經](https://mamaclub.com/) |
| mirrordaily | 鏡報 | 鏡報 | 官方名稱已核對 | [鏡報](https://www.mirrordaily.news/) |
| mnews | 鏡新聞 | 鏡新聞 | 官方名稱已核對 | [鏡新聞](https://www.mnews.tw/) |
| knews | 知新聞 | 知新聞 | 官方名稱已核對 | [知新聞](https://www.knews.com.tw/) |
| google_news | Google News | Google 新聞 | 官方名稱已核對 | [Google 新聞](https://news.google.com/home?hl=zh-TW&gl=TW&ceid=TW:zh-Hant) |
| msn | MSN 新聞 zh-tw | MSN新聞 | 官方名稱已核對 | [MSN](https://www.msn.com/zh-tw/news) |
| hk01 | HK01 /8 | 香港01 | 官方名稱已核對 | [香港01](https://www.hk01.com/) |
| bbc_global | BBC /200 | BBC News | 官方名稱已核對 | [BBC News - Breaking news, video and the latest top stories from the U.S. and around the world](https://www.bbc.com/news) |
| oncc | 東網 /20 | on.cc東網 | 官方名稱已核對 | [on.cc東網](https://hk.on.cc/hk/news/index.html) |
| taiwannet | 台灣產經新聞 taiwannet.com.tw | 台灣產經新聞網 | 官方名稱已核對 | [台灣產經新聞網 - Taiwan Business News](https://news.taiwannet.com.tw/) |
| soundofhope | 希望之聲 /3 | 希望之聲 | 官方名稱已核對 | [希望之声 www.soundofhope.org](https://www.soundofhope.org/) |
| tyenews | 桃園電子報 | 桃園電子報 | 官方名稱已核對 | [桃園電子報](https://tyenews.com/) |
| dongtaiwang | 動態網 /15 | 動態網 | 官方名稱已核對 | [动态网](https://dongtaiwang.com/loc/phome.php?v=0) |
| mdnkids | 國語日報 | 國語日報 | 官方名稱已核對 | [財團法人國語日報社](https://www.mdnkids.com/) |
| hakkanews | 客新聞 | 客新聞 | 官方名稱已核對 | [客新聞 HakkaNews](https://hakkanews.tw/) |
| aboluowang | 阿波羅網 / 8 | 阿波羅新聞網 | 官方名稱已核對 | [阿波羅新聞網](https://tw.aboluowang.com/index.html) |
| i_meihua | 梅花新聞網 | 梅花新聞網 | 官方名稱已核對 | [梅花新聞網](https://i-meihua.com/) |
| pinview | 品觀點 | 品觀點 | 官方名稱已核對 | [品觀點](https://www.pinview.com.tw/) |
| voachinese | 美國之音 voachinese /10 | 美國之音中文網 | 官方名稱已核對 | [美国之音](https://www.voachinese.com/) |
| ct | 論壇報 | 基督教論壇報 | 官方名稱已核對 | [基督教論壇報](https://ct.org.tw/html/news/) |
| guancha | 觀察者網 /50 | 觀察者網 | 官方名稱已核對 | [观察者网](https://www.guancha.cn/) |
| lai_media | 賴傳媒 | Lai傳媒 | 官方名稱已核對 | [Lai傳媒](https://lai-media.net/) |
| thehubnews | 新頭條hubnews | 新頭條 | 官方名稱已核對 | [新頭條-TheHubNews](https://www.thehubnews.net/) |
| ydn | 青年日報 | 青年日報 | 官方名稱已核對 | [青年日報](https://www.ydn.com.tw/tw/home/) |
| thepaper | 澎湃新聞 /80 | 澎湃新聞 | 官方名稱已核對 | [澎湃新闻 官方首頁](https://www.thepaper.cn/) |
| winnews | 威傳媒 | 威傳媒 | 官方名稱已核對 | [威傳媒新聞-WinNews](https://www.winnews.com.tw/) |
| secretchina | 中國secretchina.com /5 | 看中國 | 官方名稱已核對 | [看中国](https://www.secretchina.com/news/gb/index.html) |
| hsnews | 花蓮最速報 | 花蓮最速報 | 官方名稱已核對 | [花蓮最速報](https://hsnews.com.tw/) |
| watchmedia01 | 觀傳媒 watchmedia01 | 觀傳媒 | 官方名稱已核對 | [關於我們 - 觀傳媒](https://www.watchmedia01.com/about) |
| bannedbook | 禁聞網/6 | 禁聞網 | 官方名稱已核對 | [禁聞網](https://www.bannedbook.org/bnews/zh-tw/) |
| singular | 獨家報導 | 獨家報導 | 官方名稱已核對 | [獨家報導](https://www.scooptw.com/) |
| lihpao | 立報 | 立報傳媒 | 官方名稱已核對 | [立報傳媒 ／ 教育．傳播．科技．影視文化新聞](https://www.limedia.tw/) |
| hakkatv | 客家電視 | 客家電視台 | 官方名稱已核對 | [客家電視台](https://www.hakkatv.org.tw/) |
| grinews | 草根 grinews | 草根影響力新視野 | 官方名稱已核對 | [草根影響力新視野](https://grinews.com/news/) |
| newspie | 新聞派 newspie | News Pie | 官方名稱已核對 | [News Pie](https://www.newspie.com.tw/) |
| daai | 大愛 (電視) | 大愛電視 | 官方名稱已核對 | [大愛電視](https://www.daai.tv/news/) |
| nvns | 視傳媒 nvns | 視傳媒 | 官方名稱已核對 | [視傳媒](https://nvns.net/) |
| bigmedia | BigMedia 鉅聞 | 鉅聞天下 | 官方名稱已核對 | [鉅聞天下](https://www.bigmedia.com.tw/) |
| i_media | 愛傳媒 i-media | 愛傳媒 | 官方名稱已核對 | [i-media 愛傳媒](https://i-media.tw/) |
| policenews | 警政時報 | 警政時報 | 官方名稱已核對 | [警政時報](https://www.tcpttw.com/) |
| news886 | 886.news | 台灣新聞雲 | 官方名稱已核對 | [台灣新聞雲](https://886.news/) |
| anntw | 醒報 anntw | 台灣醒報 | 官方名稱已核對 | [台灣醒報 Awakening News Networks](https://www.anntw.com/) |
| yesmedia | 是新聞 yesmedia | 是新聞 | 官方名稱已核對 | [是新聞 YesMedia ／ 網路原生即時新聞](https://www.yesmedia.com.tw/) |
| miin | 台灣miin迷因 | Miin | 官方名稱已核對 | [Miin](https://miin.cc/) |
| tcnews | 慈善新聞tcnews | TCnews慈善新聞網 | 官方名稱已核對 | [TCnews慈善新聞網](https://www.tcnews.com.tw/) |
| new_report | 記者爆料網 | 記者爆料網 | 官方名稱已核對 | [記者爆料網](https://new-reporter.com/) |
| owlting | Owlnews 奧丁丁新聞 | 奧丁丁新聞 | 官方名稱已核對 | [OwlNews](https://news.owlting.com/) |
| innews | 引新聞 innews | 引新聞 | 官方名稱已核對 | [引新聞](https://innews.com.tw/) |
| newstaiwan | 好報 newstaiwan | 台灣好報 | 官方名稱已核對 | [台灣好報](https://newstaiwan.net/) |
| tnews | tnews 大台灣新聞 | 大台灣新聞網 | 官方名稱已核對 | [新聞網](https://tnews.cc/Main) |
| taiwandaily | 美洲台灣日報 /2 | 美洲台灣日報 | 官方名稱已核對 | [美洲台灣日報](https://www.taiwandaily.net/) |
| enn | enn台灣電報 | ENN台灣電報 | 官方名稱已核對 | [ENN台灣電報](https://enn.tw/) |
| kingtop | 台灣華報 kingtop | 台灣華報 | 官方名稱已核對 | [台灣華報](https://www.kingtop.com.tw/) |
| greatnews | 大成報 greatnews | 大成報 | 官方名稱已核對 | [大成報](https://greatnews.com.tw/) |
| kamalan_news | 葛瑪蘭新聞 | 葛瑪蘭新聞網 | 官方名稱已核對 | [葛瑪蘭新聞網](https://www.kamalan-news.com/) |
| fclnews | 台灣新聞雲報 fclnews.com | 台灣新聞雲報 | 官方名稱已核對 | [台灣新聞雲報](https://www.fclnews.com/) |
| globalnewstv | 寰宇新聞網 | 寰宇新聞網 | 官方名稱已核對 | [寰宇新聞網](https://globalnewstv.com.tw/) |
| pronews | 創新聞pronews | 創新聞 | 官方名稱已核對 | [創新聞](https://pronews.tw/) |
| bo6s | 波新聞 bo6s | 波新聞 | 官方名稱已核對 | [波新聞](https://www.bo6s.com.tw/) |
| taidaily | 很角色傳媒taidaily | 很角色傳媒 | 官方名稱已核對 | [很角色傳媒 Tough Guy Media](https://taidaily.com/) |
| travelnews | 宜蘭新聞網travelnews | 宜蘭新聞網 | 官方名稱已核對 | [宜蘭新聞網｜LINE 官方帳號，連回 travelnews.tw](https://page.line.me/sbc0424c) |
| focusnews | 今傳媒Focusnews | 今傳媒 | 官方名稱已核對 | [今傳媒 JNEWS](https://focusnews.com.tw/) |
| macaodaily | 澳門日報 /5 | 澳門日報 | 官方名稱已核對 | [澳門日報電子版](https://www.macaodaily.com/html/2026-10/03/node_1.htm) |
| taiwanus | 台灣海外網 / 20 | 台灣海外網 | 官方名稱已核對 | [台灣海外網](https://www.taiwanus.net/news/default.php) |
| rise_mediacorp | 崛起新傳媒 rise-mediacorp.com | 崛起新傳媒 | 官方名稱已核對 | [崛起新傳媒](https://rise-mediacorp.com/) |
| pnn | 鄉民晚報 | 鄉民晚報 | 官方名稱已核對 | [鄉民晚報](https://pnn.tw/) |
| st_media | 台灣生活新聞 st-media | 台灣生活新聞 | 官方名稱已核對 | [首頁 - 鑫傳國際多媒體科技股份有限公司 TDN台灣生活新聞](https://news.st-media.com.tw/) |
| nchn | 全國大小事 nchn.news | 全國大小事新聞網 | 官方名稱已核對 | [全國大小事新聞網 ／ NCHN](https://nchn.news/) |
| homeplus | 中嘉 (新聞) | 中嘉新聞網 | 官方名稱已核對 | [中嘉 ／ 新聞網](https://news.homeplus.net.tw/) |
| j_media | j-media 聚 | 聚傳媒 | 官方名稱已核對 | [J-media 聚傳媒](https://j-media.tw/) |
| taiwanpost | taiwanpost 台灣郵時 | 臺灣郵報 | 官方名稱已核對 | [臺灣郵報](https://taiwanpost.net/) |
| right_media | 睿 right-media.news | 睿傳媒 | 官方名稱已核對 | [睿傳媒 Rightmedia - 睿智新聞深得你心! 我們自許為獨立客觀的新媒體，以獨特觀點帶給讀者全新閱聽體驗!](https://www.right-media.news/) |
| tristarnews | 三星傳媒 | 三星傳媒 | 官方名稱已核對 | [關於我們 - 三星傳媒](https://www.tristarnews.com.tw/about.html) |
| firenews | 火報 firenews | 火報 | 官方名稱已核對 | [火報](https://firenews.com.tw/) |
| lifenews | 民生電子報 lifenews | 民生電子報 | 官方名稱已核對 | [民生電子報](https://lifenews.com.tw/) |
| news586 | 586 傳媒 (台中彰化) | NEWS586 | 官方名稱已核對 | [NEWS586](https://news.586.com.tw/) |
| ccsn0405 | 中華鱻傳媒 ccsn0405 | 中華鱻傳媒 | 官方名稱已核對 | [中華鱻傳媒](https://www.ccsn0405.com/) |
| chengpou | 正報 /3 | 正報 | 官方名稱已核對 | [正報新闻 - 第14408號](https://www.chengpou.com.mo/) |
| yaya_news | 鴉鴉新聞 | 鴨鴨新聞 | 官方名稱已核對 | [鴨鴨新聞 Yaya News](https://yayanews.com.tw/) |
| taipeipost | 台北郵報 taipeipost | 台北郵報 | 官方名稱已核對 | [台北郵報 ／ The Taipei Post](https://taipeipost.org/) |
| hiilan | Hi宜蘭 | Hi宜蘭新聞 | 官方名稱已核對 | [宜蘭痴](https://www.crushonyilan.com.tw/category/hi-yilan-news/) |
| tpnews | 台灣商務新聞網  tpnews.org | 台灣商務新聞網 | 官方名稱已核對 | [TPNEWS台灣商務新聞網｜產業、政策、地方、永續與國際新聞](https://tpnews.org/) |
| twline365 | 台灣線報 twline365.com | 台灣線報 | 官方名稱已核對 | [台灣線報](https://twline365.com/) |
| rwnews | 菱傳媒 | 菱傳媒 | 保留既有名稱，官網待複核 | [原網址未能確認為原媒體；保留歷史品牌菱傳媒，不採用異常轉址或無關站名。](https://rwnews.tw/) |
| news_yahoo | Yahoo 新聞日本 /1000 | Yahoo!ニュース | 官方名稱已核對 | [Yahoo!ニュース](https://news.yahoo.co.jp:443/) |
| yam | 蕃新聞 | 蕃新聞 | 官方名稱已核對 | [蕃新聞](https://n.yam.com/) |
| cnn | CNN /400 | CNN | 官方名稱已核對 | [CNN](https://edition.cnn.com/) |
| stheadline | 星島頭條 /20 | 星島頭條 | 官方名稱已核對 | [星島頭條｜最新最全面即時新聞平台，港聞突發，政情及專題報道](https://www.stheadline.com/) |
| cn_nytimes | 紐時中文 /5 | 紐約時報中文網 | 官方名稱已核對 | [紐約時報中文網 國際縱覽](https://cn.nytimes.com/zh-hant/) |
| cdn_news | 基都教今日報 | 基督教今日報 | 官方名稱已核對 | [基督教今日報](https://cdn-news.org/) |
| ifeng | 鳳凰網 /100 | 鳳凰網 | 官方名稱已核對 | [凤凰网](https://www.ifeng.com/) |
| taiwannews | Taiwannews 台灣英文新聞 /2 | Taiwan News | 官方名稱已核對 | [Taiwan News](https://www.taiwannews.com.tw/) |
| news_pchome | PCHome 新聞 | PChome Online新聞 | 官方名稱已核對 | [PChome Online 新聞](https://news.pchome.com.tw/) |
| reuters | 路透社 /200 | 路透社 | 保留既有名稱，官網待複核 | [官網未能提供可核對的名稱；保留既有品牌並清除原表附註。](https://www.reuters.com/) |
| news_qq | 騰訊新聞 /30 | 騰訊新聞 | 官方名稱已核對 | [腾讯网](https://news.qq.com/) |
| ntdtv | 新唐人/3 | 新唐人電視台 | 官方名稱已核對 | [NTDChinese](https://www.ntdtv.com/) |
| cdns | 中華新聞雲/中華日報 | 中華新聞雲 | 官方名稱已核對 | [中華新聞雲 / China Daily News](https://www.cdns.com.tw/) |
| cctv | 央視 cctv.com /150 | 央視網 | 官方名稱已核對 | [央视网_世界就在眼前](https://www.cctv.com/) |
| dw | DW 德廣 /100 | 德國之聲 | 官方名稱已核對 | [德國之聲官方中文首頁](https://www.dw.com/zh/) |
| focustaiwan | focustaiwan.tw /3 | Focus Taiwan | 官方名稱已核對 | [Focus Taiwan - CNA English News](https://focustaiwan.tw:443/) |
| cn_wsj | 華爾街日報中文 /5 | 華爾街日報中文網 | 保留既有名稱，官網待複核 | [官網未能提供可核對的名稱；保留既有品牌並清除原表附註。](https://cn.wsj.com/) |
| life | life生活網 | LIFE生活網 | 官方名稱已核對 | [LIFE 生活網](https://life.tw/) |
| merit_times | 人間福報 | 人間福報 | 官方名稱已核對 | [人間福報電子報](https://www.merit-times.com.tw/) |
| scmp | 南華早報 /50 | 南華早報 | 官方名稱已核對 | [South China Morning Post](https://www.scmp.com/) |
| nexttv | 壹電視 | 壹電視 | 官方名稱已核對 | [壹電視](https://www.nexttv.com.tw/NextTV/News/) |
| taiwanhot | 台灣好新聞 | 台灣好新聞 | 官方名稱已核對 | [台灣好新聞 TaiwanHot](https://taiwanhot.net/) |
| fountmedia | 放言 | 放言 | 官方名稱已核對 | [放言Fount Media](https://www.fountmedia.io:443/) |
| matsu_idv | 馬祖資訊 | 馬祖資訊網 | 官方名稱已核對 | [馬祖資訊網 ／ 馬祖的入口網站](http://matsu.idv.tw/topiclist.php?f=1) |
| worldjournal | 世界新聞 /10 | 世界新聞網 | 官方名稱已核對 | [世界新聞網 : 一網帶您看遍世界](https://www.worldjournal.com:443/) |
| today_line_me | Line Today/2 | LINE TODAY | 官方名稱已核對 | [LINE TODAY](https://today.line.me/tw/v3/tab) |
| zaobao | 聯合早報 /20 | 聯合早報 | 官方名稱已核對 | [首页 ／ 联合早报 - 享誉新加坡与国际的新闻媒体](https://www.zaobao.com.sg/) |
| mingpao | 明報 /25 | 明報新聞網 | 官方名稱已核對 | [明報新聞網](https://news.mingpao.com/insindex.htm) |
| leho | 樂聯網 leho.com.tw | 樂聯網 | 官方名稱已核對 | [樂聯網](https://leho.com.tw/) |
| matsu_news | 馬祖日報 | 馬祖日報 | 官方名稱已核對 | [馬祖日報](https://www.matsu-news.gov.tw/) |
| news_sina | 新浪新聞 /80 | 新浪新聞 | 官方名稱已核對 | [新闻中心首页_新浪网](https://news.sina.com.cn/) |
| taiwan | 中國台灣網 taiwan.cn /8 | 中國台灣網 | 官方名稱已核對 | [中国台湾网](https://www.taiwan.cn/) |
| sunmedia | 商傳媒 | 商傳媒 | 官方名稱已核對 | [商傳媒](https://sunmedia.tw/) |
| eracom | 年代 | 年代新聞 | 官方名稱已核對 | [年代電視台](https://www.eracom.com.tw/EraNews/) |
| sinchew | 星洲網 /100 | 星洲網 | 官方名稱已核對 | [星洲网 Sin Chew Daily Malaysia Latest News and Headlines](https://www.sinchew.com.my/) |
| taiwanplus | Taiwan + /2 | TaiwanPlus | 官方名稱已核對 | [TaiwanPlus – Bringing Taiwan to the World](https://www.taiwanplus.com/) |
| vigormedia | 銳傳媒 vigor | 銳傳媒 | 官方名稱已核對 | [銳傳媒 ／ VigorMedia](https://vigormedia.tw/) |
| zmedia | 震傳媒 | 震傳媒 | 官方名稱已核對 | [震傳媒](https://www.zmedia.com.tw/) |
| taiwanenews | 台灣e新聞 | 台灣e新聞 | 官方名稱已核對 | [Taiwan eNews：台灣e新聞](https://taiwanenews.com/) |
| ksnews | 更生 ksnews.com.tw | 更生新聞網 | 官方名稱已核對 | [更生新聞網](https://www.ksnews.com.tw/) |
| wenweipo | 文匯報 wenweipo.com /8 | 香港文匯報 | 官方名稱已核對 | [香港文匯報](https://www.wenweipo.com/) |
| more_news | 墨新聞 more-news.tw | 墨新聞 | 官方名稱已核對 | [墨新聞 MORE News](https://more-news.tw/) |
| news_163 | 網易 news.163.com /50 | 網易新聞 | 官方名稱已核對 | [网易新闻](http://news.163.com/) |
| contentplatform_info | 報新聞 contentplatform.info/ | 報新聞 | 官方名稱已核對 | [報新聞 Mega News ／ 報新聞 Mega News：立足台灣、鏈結全球的數位影響力樞紐](https://www.contentplatform.info/) |
| xinhuanet | 新華網 xinhuanet.com /100 | 新華網 | 官方名稱已核對 | [新华网_让新闻离你更近](https://www.xinhuanet.com/) |
| hk_crntt | 中評 hk.crntt.com /2 | 中國評論新聞 | 官方名稱已核對 | [中國評論新聞](https://hk.crntt.com/) |
| tkww | 大公文匯 tkww.hk /15 | 大公文匯網 | 官方名稱已核對 | [大公文匯網](https://www.tkww.hk/) |
| rfa | rfa.org /30 | 自由亞洲電台 | 官方名稱已核對 | [聯絡我們 - RFA 自由亞洲電台](https://www.rfa.org/cantonese/about/contact.html) |
| huanqiu | 環球網 huanqiu.com /50 | 環球網 | 官方名稱已核對 | [环球网](https://huanqiu.com/) |
| enews | enews.tw | ENews新聞網 | 官方名稱已核對 | [ENews新聞網](https://enews.tw/) |
| jdanews | 恆春半島 jdanews.com | 恆春半島在地新聞網 | 官方名稱已核對 | [恆春半島在地新聞網](http://jdanews.com/) |
| my_formosa | 美麗島電子報 my-formosa.com.tw | 美麗島電子報 | 官方名稱已核對 | [美麗島電子報](https://my-formosa.com.tw/) |
| biao_news | 彪網媒 biao-news.com | 彪網媒 | 官方名稱已核對 | [彪網媒](https://www.biao-news.com/) |
| newday | 好視新聞 newday.tw | 好視新聞網 | 官方名稱已核對 | [好視新聞網 - 好視新聞網提供台灣在地新聞、生活消費、店家情報、產業觀察與影音內容，掌握最新焦點與實用資訊。](https://newsday.tw/) |
| lifetoutiao_news | 民生頭條 lifetoutiao.news | 民生頭條 | 官方名稱已核對 | [民生頭條](https://www.lifetoutiao.news/) |
| yimedia | 壹傳媒 (毅傳媒) yimedia.com.tw | 壹傳媒 | 官方名稱已核對 | [壹傳媒](https://yimedia.com.tw/) |
| idn | 自立晚報 idn.com.tw | 自立晚報 | 官方名稱已核對 | [自立晚報 -](https://www.idn.com.tw/news/news_list.aspx?catid=1&catsid=2) |
| mknews | 天天上新聞 mknews.com.tw | 天天上新聞 | 官方名稱已核對 | [天天上新聞](https://MKnews.com.tw/) |
| 17news | 民生好報 17news.net | 民生好報 | 官方名稱已核對 | [17news民生好報](https://17news.net/) |
| peponews | 台灣人民報 peponews.tw | 臺灣人民報 | 官方名稱已核對 | [臺灣人民報](https://www.peponews.tw/) |
| ltvnews | 在地人 ltvnews.net | 在地人新聞 | 官方名稱已核對 | [在地人新聞 LTVNews](https://www.ltvnews.net/) |
| i_news | 享新聞 i-news.com.tw | 享新聞 | 官方名稱已核對 | [首頁 - 享新聞](https://i-news.com.tw/) |
| iw_times | 國際環宇時報 iw-times.com | 國際環宇時報 | 官方名稱已核對 | [國際環宇時報](https://www.iw-times.com/) |
| ammtw | amm新聞 ammtw.com | AMM娛樂新聞 | 官方名稱已核對 | [AMM 娛樂新聞 - AMM娛樂新聞為亞視旗下OTT之娛樂影視新聞平台，主要範圍包括台灣.香港.新加坡.馬來西亞四大區域，跨國製作及代理音樂會.綜藝節目.戲劇.直播的多媒體網路影音平台](https://ammtw.com/) |
| tmnu | 台灣多媒體 tmnu.org.tw | 台灣多媒體新聞聯合網 | 官方名稱已核對 | [TMNU台灣多媒體新聞聯合網](https://www.tmnu.org.tw/) |
| readr | Readr+ | READr 讀+ | 官方名稱已核對 | [READr 讀+](https://www.readr.tw/) |
| videoland | 緯來 (新聞) | 緯來新聞網 | 官方名稱已核對 | [緯來新聞網](https://news.videoland.com.tw/) |
| funnews | 花花日報 funnews.tw | 花花日報 | 保留既有名稱，官網待複核 | [官網未能提供可核對的名稱；保留既有品牌並清除原表附註。](https://funnews.tw/) |
| people_cn | 人民網 /30 | 人民網 | 官方名稱已核對 | [人民网_网上的人民日报](https://www.people.com.cn/) |
| ntdtv_tw | 新唐人亞太 ntdtv.com.tw | 新唐人亞太電視台 | 官方名稱已核對 | [新唐人亞太電視台](https://www.ntdtv.com.tw/) |
| afp | 法新社 | 法新社 | 官方名稱已核對 | [AFP 官方網站；通訊社識別使用法新社](https://www.afp.com/) |
| ap | 美聯社 | 美聯社 | 官方名稱已核對 | [The Associated Press 官方網站；通訊社識別使用美聯社](https://www.ap.org/) |
| nhk | NHK | NHK | 保留既有名稱，官網待複核 | [NHK；官網存取受限，保留既有名稱](https://www3.nhk.or.jp/nhkworld/zh/) |
| kyodo | 共同社 | 共同社 | 保留既有名稱，官網待複核 | [共同社；官網存取受限，保留既有名稱](https://tchina.kyodonews.net/) |
| yonhap | 韓聯社 | 韓聯社 | 官方名稱已核對 | [韓聯社（南韓聯合通訊社）](https://cb.yna.co.kr/gate/big5/cn.yna.co.kr/) |
| xinhua | 新華社 | 新華社 | 官方名稱已核對 | [新華社官方新華網；保留通訊社識別，與 xinhuanet 網站來源分開](https://www.news.cn/) |
| digitimes | digitimes（未登記名稱） | DIGITIMES電子時報 | 官方名稱已核對 | [DIGITIMES 官方常見問題提及 DIGITIMES電子時報](https://www.digitimes.com.tw/svc/faq/faq.asp) |
| dongtw | dongtw（未登記名稱） | 動網 | 官方名稱已核對 | [Dongtw 官方頻道介紹使用「動網 DONG」](https://www.dailymotion.com/user/Dongnews) |
| gv | gv（未登記名稱） | Global Voices 繁體中文 | 官方名稱已核對 | [Global Voices 繁體中文；全球之聲](https://zht.globalvoices.org/) |
| kairos | kairos（未登記名稱） | 風向新聞 | 官方名稱已核對 | [風向新聞 Kairos.news 官方頻道](https://www.youtube.com/channel/UCyzvQs8trbxQXcJRKgQkgZA) |
| musou | musou（未登記名稱） | 沃草 | 官方名稱已核對 | [沃草官方報導；既有 musou 來源保留識別](https://watchout.tw/reports/V4KMK7s5sp9qhadabgc5) |
| tsna | tsna（未登記名稱） | TSNA體育新聞團隊 | 官方名稱已核對 | [首頁 - TSNA體育新聞團隊](https://tsna.com/) |
| voicettank | voicettank（未登記名稱） | 思想坦克 | 官方名稱已核對 | [思想坦克｜Voicettank](https://voicettank.org/) |

2026-10-03 使用者指定顯示名稱：`ettoday` 使用「ETtoday 新聞雲」、`gamer` 使用「巴哈姆特 GNN」、`housefun` 使用「好房新聞」；官方品牌名稱仍保留為別名及核對證據。旺報停止排程與列表顯示，保留歷史文章。

2026-10-04：韓聯社改用完整繁體中文入口；DW 改用官方中文首頁。蘋果日報與 overdope 舊網域已不再代表原新聞品牌，撤下連結並保留歷史名稱。詳見 [全媒體來源核對](news-source-references.md#2026-10-04全媒體收錄盤點與國際來源補齊)。
