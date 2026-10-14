# SM006 source：修正已觀測的 Chrome 快取掃描競態

接續 [005 實際失敗](sm-paired-005-completion-20261014.md)。本批不改 APP677、BUILD Pmj、runtime bytes、DB、poolSize2／queueLimit64、SELECT-only 或 Google/foreign 拒絕規則；不 build、不啟動 candidate/capture，不把 source/mock 當正式驗收。

## 容量掃描修正

005 原始 manifest／first-evidence-write-failure／proxy-failure 明確記錄 Chrome 在掃描期間刪除 `profile/Default/Cache/Cache_Data/todelete_*`，使 `stat` 報 ENOENT。`bytesIn` 改為 lstat 身分檢查：只有 readdir 的 Dirent 已是 regular file，且路徑恰為 `profile/Default/Cache/Cache_Data/todelete_<16個小寫hex>_<digits>_<digits>`，才容許 lstat 時的 ENOENT 跳過。這代表已被刪除的瞬時檔案，不是對一般檔案缺失或掃描錯誤放行。

root／directory／HAR與evidence／其他profile檔缺失、EACCES／EPERM等、UID／permissions不符、目錄realpath不符、regular file被換成symlink／directory或反向替換、大小超限，仍然失敗。Chrome profile根部三個固定Singleton連結只計link文字、不follow；任意其他symlink拒絕。未刪任何檔案，也沒有關掉budget或5xx檢查。

## SQL 診斷

005兩筆query/driver/unknown與API sql-latched已實測，但不能分schema／權限／client錯誤。讀 installed mysql2 source 並以 mock 重現：queueLimit滿時可能產生沒有code的固定 `Queue limit reached.` 錯誤，同一error也可能經callback/promise兩層重複報告。**這是source/mock可行性，不是005的實際queue-limit確診**；沒有因此增加pool或queue。

新的私有enum-only記錄辨識三個固定client錯誤（queue-limit／pool-closed／promise-client-callback），只輸出enum，不輸出message。error cause最多四層、循環停止，name與drivercode只有白名單，process-local errorId用來辨識重複事件。64KiB cap與寫入失敗的fail-closed規則維持。沒有SQL、參數、自由文字錯誤訊息、URL query或secret。

下一個配對入口固定exclusive006；原005及修前source bytes保存。執行仍須新exact OPS、paired/candidate input、fresh三次中位數probe與babysit核對，不沿用005的許可。

## 獨立 source/mock review

修前實體bytes：`/home/deck/tag-analysis-private/f1-release/sm-006-diagnostic-source-v1-20261014/`。freeze JSON `/home/deck/tag-analysis-private/f1-release/sm-006-diagnostic-source-freeze-20261014.json` SHA `8fe28d365adc9ad88cd196f4ec32d3cbd6a29bc81d69957276ec4d1fa74baa4a`。

既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol審查通過：8檔hash、69 targeted mock／3 syntax、額外5項memory-only安全assertion；JSON `/home/deck/tag-analysis-private/f1-release/sm-006-diagnostic-independent-20261014.json` SHA `345dc2df0f924091462aca1b2e256b32ef9db748eda19356182401cc21486519`，同名txt transcript SHA `6270037ca18c54fa3b6297f151c80f409653f1a75a7718881bbdbe76b6da8983`。Root另跑103 pure/mock回歸通過，原log `/home/deck/tag-analysis-private/f1-release/sm-006-root-regression-20261014.log`；排除兩項真processgroup測試，不冒充實際guard驗收。

未執行actual006／SQL／probe／browser／native loader／取鎖；未部署。APP677仍65主route／0完整UIpass／65pending。既有產物、失敗目錄、所有release、rollback、備份、worktree、Mint原檔全保留。
