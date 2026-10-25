# SM007 隔離候選 SELECT 調度修正

接續 [actual006與序列DB查因](sm-paired-006-and-select-reproduction-20261014.md)：同errorId1的mysql2 queue-limit已記錄，296筆同帳號序列SELECT沒有SQLerror，其中media-stats有115筆讀取。修正只在SM隔離候選工具，APP677／BUILD Pmj／inventory f166／manifest761不變，不改正式API環境或底層pool2／mysqlqueue64，不重建、不改fixture或帳號。

`scheduleFixtureSelects`只包最外PromisePool query/execute入口，最多兩筆真正delegate active、JS等待queue最多256；內層callback/Core Query契約不改。所有SELECT-only admission、callback拒絕、容量／契約錯誤、preexpiry abort仍呼叫failure latch，APP捕捉錯誤後不能以fallback200冒充成功。到期／abort拒queued與caller，但不宣稱已取消正在執行的SQL；active真正settle前不釋放slot，避免超過兩筆。close有限等待drain，未確認完成仍失敗；audit錯誤不能阻止其他caller清理，也不能變成綠色成功。

配對入口固定exclusive007，所有004–006原job、失敗紀錄、Mint／runtime／release／rollback／備份保留。沒有新SQL/服務/瀏覽器/取鎖或actual007執行。需要新exact OPS、fresh三次中位數probe及babysit核對後才啟動。

初版source實體保留 `/home/deck/tag-analysis-private/f1-release/sm-007-scheduler-initial-v1-20261014/`，初審發現外層assertSelect同步throw未latch，可能被APP捕捉後fallback200。初審issues JSON `/home/deck/tag-analysis-private/f1-release/sm-007-scheduler-independent-initial-issues-20261014.json` SHA `962201256a0c0abea472131b2ef38d798d3e4ae0c2fc6478361ac37180fd54b9`；沒有將初版標PASS。

v2修正上述缺口與abort/audit失敗清理；freeze SHA `0b69c5a809c2e5a30817a6c56c46a6c30a6f9abcbf6416ef6b676a2f259af77b`。既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol55 targeted mock／2 syntax通過；final JSON `/home/deck/tag-analysis-private/f1-release/sm-007-scheduler-independent-20261014.json` SHA `1e7f1095df6db1598104a625b12c422bc35772f01708864f09e03ca2a2037efb`，同名txt transcript SHA `71cb725cf74ec7f7d16b370d6b100759eb18168fae59858a317ecda22be0cc9d`。Root另跑109 pure/mock回歸通過，私有log `sm-007-root-regression-v2-20261014.log`，排除兩個真processgroup測試。

這是source/mock PASS，尚未在真正candidate測新的併發、latency、頁面或header。隔離DB沒有所查news/blue/green/all ranking與news events snapshot，UI可能呈現empty/recovery；不能把空fixture當完整loaded F1 review。真正privacy/B0/SSR/RSC、主要頁面非作者實圖審查與部署仍pending。APP677維持65主routes／0完整UIpass／65pending，未部署。
