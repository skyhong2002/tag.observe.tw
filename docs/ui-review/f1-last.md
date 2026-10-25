# F1 末段獨立 UI review

Reviewer GPT-6.1 Sol；基準 48083b58c4ee3d16f2072206f1da3df332f34143。圖片來自同版本內部服務，不是正式 domain 實際網路入口；view_image 已逐張看圖。此輪只記基準 pictured state，沒有任何頁完整宣告 pass；F1候選仍待後續比較。私有逐圖 log：`/home/deck/tag-analysis-private/ui-review/f1/review-last.log`。

|列|1280/390實際觀察|狀態|
|---|---|---|
|051|登入gate：desktop閱讀報告active清楚，手機五tab可讀；login提示/六項清單正常換行，method accordion閉合。登入後資料/多寡/empty/error均pending。|pending：完整頁與F1候選尚未覆蓋|
|052|登入gate：收藏active白色卡面與陰影清楚，兩寬login清單行距正常；無圖片表格，footer手機堆疊。收藏實際資料/多寡/empty/error pending。|pending：完整頁與F1候選尚未覆蓋|
|053|登入gate：設定active清楚；390右側active tab背景右邊緣被容器裁切，文字仍可讀，需候選確認水平tab scroll/focus。登入後設定功能未覆蓋pending。|pending：完整頁與F1候選尚未覆蓋|
|054|網站觀測：desktop四KPI並列、手機2×2，日期/資料方法link换行正常；每日柱狀圖手機底部在viewport外未檢查全圖，長列表與empty/error待覆蓋。|pending：完整頁與F1候選尚未覆蓋|
|055|optout既有baseline：desktop中欄寬672，手機card与button均完整；灰點狀態/環境阻擋说明讀得清楚，四bullet換行正常，資料方法閉合；僅未設localoptout環境狀態，toggle/restore/storageerror/accountsync未於此圖驗。|pending：完整頁與F1候選尚未覆蓋|
|056|/readers實際導向observe頁中段：stickyheader正常，列表手機單行省略可辨類別与計數；來源card從desktop右欄改手機堆疊。截圖非讀者獨立首屏，導向行為及頁全部其他狀態仍pending。|pending：完整頁與F1候選尚未覆蓋|
|057|desktop graph媒體logo/連線清楚但部分文字被線覆蓋；手機graph緊密logo/標籤重疊較多，需zoom互動實測；篩選/進階controls正常包行，底部圖例多色小字。只default資料，少/empty/error與互動pending。|pending：完整頁與F1候選尚未覆蓋|
|058|實際擷取為擷取狀態表：desktop7欄可見及比例bar；手機只見前三欄且媒體truncate，後四欄需水平scroll證據（未測）；tab与日期方法正常。排序/缺漏少與error/empty待測。|pending：完整頁與F1候選尚未覆蓋|
|059|兩寬僅載入每日統計中，未取得實際chart/data；30/90/365控制及日期method排版正常但不可pass loaded頁。loading/loaded/empty/error全頁與互動pending。|pending：完整頁與F1候選尚未覆蓋|
|060|兩尺寸轉載統計僅loading；期間pill與methodlink可讀，空白高度完整，但實際每日表/圖未載不可pass。|pending：完整頁與F1候選尚未覆蓋|
|061|來源排行桌表五欄/媒體logo整齊，手機表頭右側截「被註明篇」且後兩欄不見，需水平scroll可達性證據；query表單手機查詢button另行，正常。多/少/empty/error互動pending。|pending：完整頁與F1候選尚未覆蓋|
|062|/topic/newtalk桌截圖全白（未有nav/錯誤），390有404找不到頁面與搜尋/六入口cards，手機error清楚；桌blank需重擷取與正常媒體index例，不可pass正常頁。|pending：完整頁與F1候選尚未覆蓋|
|063|議題家暴虐童修法實際8文章：桌右側thumbnail、手機64px圖與標題多行排列無擠字，meta URL/tag較小淺灰；列表摘要checkbox未測，其他多/少/empty/error待覆蓋。|pending：完整頁與F1候選尚未覆蓋|
|064|轉述社群貼文desktop KPI+role兩欄、手機stack，曲線薄但可讀；說明角色比例可重疊清楚；媒體table不在手機首屏未看完整，其他states pending。|pending：完整頁與F1候選尚未覆蓋|
|065|標題用詞desktop3card手機stack，橘線selected可辨；定義文字換行正常，desktop媒體表numeric對齊，mobile表未進viewport；filter/sort/empty/error pending。|pending：完整頁與F1候選尚未覆蓋|

066–076 所有 notes 分段與錯誤圖皆已逐張 view_image 真看（沒有以首屏代替footer）；077 看過1280實際Next錯誤，390同錯誤仍缺。notes首次總標題普遍被sticky header遮住；所有client navigation notes清除/替換仍待實測，F1候選尚未審。

提交：本review分片未commit，交root整合。部署：無，本review不構成部署驗收。

|列|notes/error具體觀察|狀態|
|---|---|---|
|66|已看article fallback方法全部：最新文章/藍綠分布/主要與相關事件、媒體分類/完整方法link及footer；桌定義雙欄手機直排行距可讀。第一張方法總標題被stickyheader遮；notes清除切頁未實測，不能判pass。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|67|已看headlines footer全段：400則與快照fallback、每家一則、文字高亮兩處/四分之一以及媒體分類；兩寬定義排版清楚、橘link可辨。method anchor總標題被stickyheader遮，navigation更換待驗。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|68|已看5段圖完整notes：單一事件含標籤/時間/報導量/標題對照/相關事件、事件表清洗/分群/文章歸屬、媒體分類/媒體摘要。桌dt/dd對齊、手機各標題與文字垂直流正常；第一張anchor標題被stickyheader遮，後段scroll切上緣正常。clientnotes更換待測。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|69|專題完整3圖皆真看：46家入口/收錄時序、議題專題分類、40關鍵字、keyword時間/90天、依媒體/更新狀態；桌長段落寬限，手機換行行高正常；首張sticky遮anchor總標題，notes切頁未驗。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|70|媒體traffic5圖真看全內容：Similarweb完成與CF部分未更新日期、估月visits非精確pageview、台灣占比導流/每篇訪問算法、CF排名及缺值失敗、GeneHong原sheet/politicalbasis/摘要卡。桌definition兩欄、手機直排清楚；首段總標題sticky遮，navnotes換頁未驗。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|71|8段真圖：升溫/門檻/空白/標記/相似稿/篇媒體分數/爆發力/變動/共同關鍵字/字雲/趨勢與110基準清單完整範圍。桌dt/dd手機堆疊，數學文字可讀；第一段總標題sticky遮。手機最後圖食尚玩家hover卡仍loading且擋清單部分（其餘desktop可看）；完整無遮mobile名單/notesnavigation pending。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|72|16段圖全真看：keyword排行/首次上榜/圖表時間與鍵盤、keyword變化/報導/相關事件/110固定基準、完整ranking公式、群組Wikidata/人工確認/五分鐘重算、圖片人物/其他/讀者投票授權與摘要。兩寬文字和媒體logowrap正常，長API字串手機可换行；notes甚長但各h3/dt層級清楚。sticky遮首次總標題；clientnotes清除與F1新方式仍待測。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|73|圖片notes兩真圖完整人物Wikimedia授權、其他行政圖/NaturalEarth/Wikidata去背、上傳支持和每日20票/鎖定/原圖不保存/授權移除link；只有PictureMethod而無排行群組，scope正確。兩寬文字換行正常，sticky遮總標題，clientnav待測。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|74|topicnotes三真圖完整35家入口、收錄/停更時序/keyword40/90天/依媒體/更新狀態；桌定義雙欄手機直排，橘link清楚，首總標題sticky遮；切頁更換待測。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|75|實際/article/999999999999圖兩寬顯示暫時無法取得文章內容，請稍後重新整理，而非找不到頁面/404版型；只有header/footer，無retrybutton，錯誤文可讀且無溢位。此artifact不能驗site-notfound，仍pending需真正site404。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|76|兩寬真正404找不到這個頁面：desktop672px中欄sixcards2欄，手機stack，搜尋input/button同列可用尺寸；說明字體/contrast正常。手機最末card底部在首屏外，互動恢復入口未點；rootnotfound與site版本識別待source/route核對。|notes expanded baseline reviewed; client navigation cleanup and candidate pending|
|77|真實Next英文servererror fallback：中央警示icon/title/body/reloadbutton，無本站header/nav/footer，digest4196365417底部；布局可讀但非繁中產品錯誤。390同route下一次200無同錯誤圖，非隔離故障fixture。|pending mobile same error/candidate/retry|
