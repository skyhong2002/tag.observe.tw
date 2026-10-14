# SM008 截圖收尾修正（source／mock）

007 已保存16張實圖，但最後一張之後 proxy 的 denied audit 遇 ENOENT，capture 為 partial。原診斷未留下具體 filesystem 操作或路徑，不能把這次失敗唯一歸因於 Singleton 檔；原失敗資料與 source snapshot 都保留。

本批在最後PNG完成或fatal停止時先 quiesce proxy：拒絕新的 GET、CONNECT、upgrade、socket，停止既有自有連線，再關 context/profile。關閉期間事件暫存於最多1MiB journal，profile停止、事件drain後依序flush、關proxy、核對raw counters。每個收尾動作失敗仍嘗試後續動作；flush失敗的事件另存私有exclusive檔、結果仍partial。filesystem診斷只記操作與path分類，不記完整路徑或秘密。

沒有擴大原ENOENT例外、忽略5xx、變更候選期限、放寬foreign-origin阻擋或runtime完整性檢查。最終96MiB、ownership、health、runtime hash、Google/raw一致性檢查仍必要。proxy quiesce之後的零新egress是source／mock結論，不能當成新browser的transport證據。

既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol 審查六個工具檔及root兩處產品class修正，43 pure/mock與3 syntax通過；root另做112 pure/mock回歸通過（排除兩個實際process-group測試）。私有review JSON：`/home/deck/tag-analysis-private/f1-release/sm-008-cleanup-independent-20261014.json` SHA `752838df7d4482aafa1d4e0d31845a91adc61610cb74ee753fb8f0db39ca3051`；同名txt transcript SHA `dd2f4c2d777197afc1a217494d96b791b22ad0cfc45b28f10e11665beb7b984e`。root回歸log：`/home/deck/tag-analysis-private/f1-release/sm-008-root-source-check-20261014/tools-regression.log`。

這些工具仍pin原APP677／BUILD Pmj／inventory f166，不代表產品對比修正已進runtime。actual008未執行；不因source通過重用過期007許可。下一次實際建置／candidate／capture仍先交exact命令與fresh probe給babysit；新產品artifact須重新綁SHA／BUILD_ID／inventory並真圖驗證。未部署。所有原artifact、failed job、backup、release、worktree保留。
