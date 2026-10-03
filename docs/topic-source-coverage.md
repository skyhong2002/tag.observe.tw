# 議題來源盤點

2026-10-03 第二輪：由完整媒體目錄開始盤點，共 293 個項目（292 個嘗試查找官方入口、1 個已知網域遭替換而排除）。已接入 **55 家媒體、63 個官方入口**；即時測試共取得 **1,571 個去重連結**，63 個入口皆有結果。這是目前接入範圍，不能解讀成全網只有 55 家媒體提供專題。

## 驗證方法

1. 依官方品牌清單逐站讀取首頁，找專題、系列、議題、專輯等導覽入口，記錄失敗或轉址；不能只對既有的 TOPIC_RULES 重跑後就宣稱完整。
2. 查閱候選官方列表，確認卡片實際是編輯整理的專題頁，並核對標題、封面、一般文章和分類連結的差別；例如端傳媒採用「系列」，不用一般議題分類。
3. 為確認的列表設定精確路徑和卡片範圍；多入口各自記錄健康，抓不到資料視為失敗。
4. 完整即時重抓，再執行持久化與重複抓取驗證。原始的首次發現日期不會改成此次抓取時間。

機器可讀證據見 [topic-source-audit.json](topic-source-audit.json)。首頁盤點的 configured 只表示已設定；實際入口健康以 verified.sources 為準。needs-review 僅是候選，不是已證實的專題；unconfirmed 是尚未確認，不能當作該媒體沒有專題。

## 已接入來源

| 媒體 | 官方入口 | 本次取得 |
| --- | --- | ---: |
| Newtalk新聞 | [入口 1](https://newtalk.tw/news/topics/list) | 20 |
| 三立新聞網 | [入口 1](https://www.setn.com/Plist.aspx) | 30 |
| 華視新聞網 | [入口 1](https://news.cts.com.tw/topic/) | 9 |
| 東森新聞 | [入口 1](https://news.ebc.net.tw/topic) | 6 |
| 中央社 | [入口 1](https://www.cna.com.tw/list/newstopic.aspx)、[入口 2](https://www.cna.com.tw/project/project_list/api/specialfeature.json) | 76 |
| TVBS新聞網 | [入口 1](https://news.tvbs.com.tw/pack/packnews)、[入口 2](https://news.tvbs.com.tw/topics) | 36 |
| 公視新聞 | [入口 1](https://news.pts.org.tw/hotTopic)、[入口 2](https://news.pts.org.tw/curation) | 30 |
| 聯合新聞網 | [入口 1](https://topic.udn.com/issue/index)、[入口 2](https://udn.com/topic/index) | 31 |
| 自由時報 | [入口 1](https://news.ltn.com.tw/)、[入口 2](https://features.ltn.com.tw/)、[入口 3](https://features.ltn.com.tw/special_topic) | 26 |
| 壹蘋新聞網 | [入口 1](https://news.nextapple.com/collection/topic)、[入口 2](https://special.nextapple.com/) | 50 |
| CTWANT | [入口 1](https://www.ctwant.com/topic/) | 5 |
| 太報 | [入口 1](https://www.taisounds.com/special/topiclist) | 10 |
| 上報 | [入口 1](https://www.upmedia.mg/tw/project) | 17 |
| 民視新聞網 | [入口 1](https://www.ftvnews.com.tw/) | 7 |
| 報導者 | [入口 1](https://www.twreporter.org/topics) | 5 |
| 鏡報 | [入口 1](https://www.mirrordaily.news/topic) | 12 |
| ETtoday 新聞雲 | [入口 1](https://www.ettoday.net/feature/index)、[入口 2](https://docs.google.com/spreadsheets/d/e/2PACX-1vSC8DHP42p7MvVh8FXxjEJwZejAS3lzw7hvNAU4zeVP82zZCmefGCLWXOqeqanUrbvokw3UxKn7uzDm/pub?output=csv) | 40 |
| 鏡週刊 | [入口 1](https://www.mirrormedia.mg/section/topic) | 12 |
| 遠見雜誌 | [入口 1](https://www.gvm.com.tw/topic) | 7 |
| 天下雜誌 | [入口 1](https://www.cw.com.tw/special) | 12 |
| 數位時代 | [入口 1](https://www.bnext.com.tw/topics) | 12 |
| INSIDE | [入口 1](https://www.inside.com.tw/features) | 5 |
| NOWnews今日新聞 | [入口 1](https://www.nownews.com/topics/) | 3 |
| 工商時報 | [入口 1](https://www.ctee.com.tw/) | 10 |
| 中時新聞網 | [入口 1](https://www.chinatimes.com/album/) | 28 |
| 台視新聞網 | [入口 1](https://news.ttv.com.tw/Projs/) | 7 |
| 關鍵評論網 | [入口 1](https://www.thenewslens.com/feature) | 20 |
| FTNN新聞網 | [入口 1](https://www.ftnn.com.tw/topic_index) | 6 |
| 鏡新聞 | [入口 1](https://www.mnews.tw/topic) | 13 |
| 知新聞 | [入口 1](https://www.knews.com.tw/realtime/topic) | 10 |
| 放言 | [入口 1](https://www.fountmedia.io/topic) | 10 |
| 科技新報 | [入口 1](https://technews.tw/topics/) | 72 |
| TechOrange 科技報橘 | [入口 1](https://techorange.com/) | 9 |
| iThome | [入口 1](https://www.ithome.com.tw/feature) | 12 |
| 環境資訊中心 | [入口 1](https://e-info.org.tw/feature) | 35 |
| 苦勞網 | [入口 1](https://www.coolloud.org.tw/topics) | 10 |
| 食力 | [入口 1](https://www.foodnext.net/topic) | 265 |
| 鉅亨網 | [入口 1](https://news.cnyes.com/projects/cat/all) | 16 |
| ShoppingDesign | [入口 1](https://www.shoppingdesign.com.tw/topic) | 12 |
| 運動視界 | [入口 1](https://www.sportsv.net/feature) | 11 |
| 健康2.0 | [入口 1](https://health.tvbs.com.tw/topic) | 21 |
| 食尚玩家 | [入口 1](https://supertaste.tvbs.com.tw/topic) | 33 |
| 女人迷 | [入口 1](https://womany.net/collections) | 175 |
| 地球圖輯隊 | [入口 1](https://dq.yam.com/topic/list/1) | 12 |
| MPlus云閱讀 | [入口 1](http://www.mplus.com.tw/topic/all) | 12 |
| PChome Online新聞 | [入口 1](https://news.pchome.com.tw/features/) | 89 |
| 新唐人亞太電視台 | [入口 1](https://www.ntdtv.com.tw/topic) | 90 |
| 聯合早報 | [入口 1](https://www.zaobao.com.sg/special) | 23 |
| Global Voices 繁體中文 | [入口 1](https://zht.globalvoices.org/specialcoverage/) | 17 |
| 基督教今日報 | [入口 1](https://cdn-news.org/TopicNewsMain.aspx) | 16 |
| 今周刊 | [入口 1](https://www.businesstoday.com.tw/) | 6 |
| 端傳媒 | [入口 1](https://theinitium.com/series/) | 24 |
| Heho健康 | [入口 1](https://heho.com.tw/medical-feature-stories) | 27 |
| 早安健康 | [入口 1](https://edh.tw/special) | 13 |
| every little d | [入口 1](https://www.roomie.tw/special) | 6 |

## 尚未確認與限制

- 首頁掃描中有 111 項出現待審查連結，102 項尚未發現符合條件的入口，24 項因 HTTP 回應、逾時或跨網域轉址而未完成，另排除 1 個已知被替換的網域。這些數字描述首頁掃描，不代表專題存在與否；候選可能只是文章、標籤、活動或一般分類。
- 台視、FTNN、部分歷史內容較多的網站，官方列表最新一頁也可能包含長期專題；本站不把這次補收時間稱為上架日期。
- 此輪也核對 RTI、桃園電子報、法廣等候選頁，不能把其分類中的每篇一般新聞都當作新專題。共同社的專題總覽以無文字圖片連結為主，DIGITIMES 列表以個別報導／分組為主，尚未加入可靠的專題辨識規則。
- 工商時報僅能由公開首頁發現部分專題，專題內頁有防爬限制。未處理登入後內容，不保證歷史分頁或未列在官方入口的專題能被發現。
- 已接入來源每小時 :50 重抓；媒體新設入口仍需重新盤點並驗證。

## 重跑

```sh
node tools/discover-topic-sources.ts --out=/tmp/topic-directory.json
node tools/topics-once.ts
node tools/topics-once.ts --media=ttv,tnl,technews
node --env-file=.env tools/topics-once.ts --apply
```
