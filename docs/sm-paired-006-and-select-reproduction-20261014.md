# SM006 結果與隔離 DB 序列 SELECT 查因

執行 OPS `01c75995f0c2fd7f75de8abd76f2f56d682824a7` 已推送；來源基於已fetch的remote default ancestor `a89908a650c42a1224d657e6c908d5fd3c7be5a0`。APP677／BUILD `PmjYScQDDoJKBr43SLkhd`／inventory f166／manifest761不變，沒有重建或部署，不碰共享主checkout或正式DB。

## actual006

babysit UTC2026-10-14 00:42核准後執行。candidate exit0、capture exit1、paired exit1、0PNG。SQL原始兩筆同 `errorId=1`，`operation=query / phase=driver / clientClass=queue-limit / driverCode=unknown`，是同一個mysql2 client queue-limit錯誤被兩層wrapper報告；不是兩個獨立SQL失敗，也不是MariaDB1146/1142/1054。後續API sql-latched，捕捉到的兩個HTTP503使capture停止。

本次不再發生profile ENOENT／proxy audit錯誤。proxy raw56 admitted／56 response／13 denied（allother）與closedStats／manifest一致；HAR117與rawrequest117吻合，48個200、2個503、67個-1，rawresponse50。Google attempt0／denyGoogle0／proxy outgoing0，可列為**本次capture window內已閉合proxy/request/HAR紀錄的transport證據**；不是全系統封包零流量、正常GA收件、完整16圖、UI或B0驗收。

首頁1280/light的導航前state：DNT1、GPC不存在/value=null、webdriver=true；HAR117個request有DNT1。其他route／viewport沒有截圖或state，不能外推逐頁結果。

candidate parent3468924 started00:42:22.097，worker3469271 started00:42:33.620；API3469461／18197、Next3469529／18198、frontdoor3469556／18199只綁127.0.0.1。cleanup-start00:42:58.893，frontdoor00:42:58.900、Next00:42:58.909（TERM143）、API00:42:58.928全退出，00:42:58.945 allExited，guard00:43:06.607 exit0。capture parent3469704 ended00:43:08.446 exit1，candidate parent00:43:20.010 exit0，paired-failed00:43:20.013。

worker／owner完整before/after inventory f166／manifest761相同。UTC00:46:24.749375當下kernel rawTCP/fullrawlocks確認ownportsclosed／鎖holder0／legacy18196 inode215996810保留；owner觀測9ownPID/profilebrowser0。這是當下觀測，不重建精確listener bind/stop syscall時間。

原始job：`/home/deck/tag-analysis-private/f1-release/{paired-sm-batch-006,sm-capture-sm-batch-006,mint-native-target-c70425b0/local-candidate-sm-batch-006}/`。既有非作者GPT-6.1 Sol actual離線review：`/home/deck/tag-analysis-private/f1-release/sm-paired-006-independent-20261014.json` SHA `5a17039681ee2b36ab7170af45ebdd8c91b6770fba67cb1e7a95c13857c2fda3`，同名txt SHA `75897f0e6c1997e0e02f8eeea9d6cf32014c3e2c6f2b0809def66b6772536f4d`；115原始top-level hash/input/sourceGitblob/stage/artifact鏈核對，不是reviewer新live操作。

## 已預先放行的唯讀 DB 重現

006失敗後依babysit預放行，用同一份private DB設定（hash綁006 input）連127.0.0.1:18306/tag_f1_semantic_test、MariaDB11.4。沿用pool2/mysqlqueue64，在owner查因工具中將真正SELECT序列執行，peak1；只取metadata/shape hash/table names/row count/errorcode，不保存SQL、參數、row內容或帳號值。不開API/Next/browser，不寫資料、不EXPLAIN、不seed或修改schema/account/grants。

- 第一job `sm-006-isolated-select-reproduction-20261014`：173 SELECT全部成功；owner腳本誤寫`media/stats` route，找不到handler而退出1；finally關connection，後段未執行，不能把第一輪當完整cohort通過。
- 第二job `sm-006-isolated-select-reproduction-20261014-r2`：改成source裡的`media-stats`，只補跑剩餘123 SELECT，全部成功、退出0、connection關閉，peak1。
- 合計296 SELECT（包含兩次identity SELECT），SQLerror0，未觀察到1146表不存在／1142權限不足／1054欄位不存在。這只涵蓋所列首頁loader，不是整個schema/API/permission全驗證。
- `topicSourceChecks`有110 SELECT，`latestTopicPerMedia`55，`media-stats`115；source中的Promise.all會把同一handler的多筆查詢同時送入pool。實際006 queue-limit加上序列SELECT皆成功，支持在隔離候選API入口限制SQL併發；不增加底層pool/queue，也不假稱已測新的actual併發。
- news/blue/green/all ranking與news events loader回null，表示此隔離資料沒有所查snapshot。這些是empty fixture資料界線，不是loaded UI pass，也不為本次填資料或假造API成功。

兩job都位於 `/home/deck/tag-analysis-private/f1-release/`，原program/plan/identity/queries/result都保存，第一輪失敗沒有覆寫。既有非作者離線DB證據核對：`sm-007-isolated-select-evidence-independent-20261014.json` SHA `f70b6e3ebc89ab77bcc3912c66b6671dc61bdfedf21c3e4424e755e481b1ebe9`；核query/hash/indices/selectedsource與APP677 Gitblob，沒有由reviewer重跑SQL。connectionClosed只來自owner receipt，不能報成reviewer獨立即時觀測。

下一批007需source/mock獨審、exact OPS/命令/freshprobe另核對；仍要真runtime結果與主要頁面實圖審查才可推進部署。**APP677仍65主routes／0完整UIpass／65pending，未部署。** 所有原始、失敗job、runtime、release、rollback、備份、worktree、Mint資料保留。
