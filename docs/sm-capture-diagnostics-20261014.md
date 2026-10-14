# SM capture 診斷小批：source 與實際驗收的界線

這批接續 [004 的失敗與停止證據](sm-paired-004-completion-20261014.md)。保持 APP `677a0c793eeda0c4d850c81ac574c95508d08e0a`、BUILD_ID `PmjYScQDDoJKBr43SLkhd`、inventory `f1660cad…`、manifest `76142c…`；不修改或重建產物，也不新增 fixture、帳號、權限或正式資料查詢。

## 改變與原因

- 既有 SELECT-only wrapper 保持拒絕寫入、transaction、prepare、複合 SQL 與副作用。新增 owner-only 0600 的 SQL failure JSONL，最多 64 KiB，只留 operation、phase 與白名單 driver error code；不留 SQL、參數、錯誤 message 或憑證。記錄失敗不會變成成功 response。
- API 的 wrapper 503 新增 bounded 私有 cause 分類：sql-latched、expired、handler-error，加上固定 route class／request index，避免再從兩筆沒有 body 的 HAR 猜原因。這不代表目前 fixture 已修好；如果 APP 自己回錯誤，仍須依實際證據判讀。
- proxy 必須先成功保存 admission／denial 的 raw event 才增加計數；保存失敗仍停止所有 upstream，保留固定 error-code enum，不能吞掉失敗。拒絕目標只存 candidate／Google／other 的分類，不寫自由文字 hostname、完整 URL 或 query。Google 類別包含 google-analytics.com、analytics.google.com、googletagmanager.com 及子網域，測試 HTTPS／CONNECT 與惡意相似 suffix。
- capture 在第一次 `goto` 前記錄真實 navigator DNT／GPC 是否存在及值／webdriver；不 override navigator、UA、cookie 或 guard。partial 也可保留這份紀錄。HAR 缺失、proxy audit 失敗及 raw／counter 不一致分開回報，任何一項仍使本批失敗。
- 下一個配對入口固定為 exclusive `sm-batch-005`；不允許任意 session／路徑、不覆寫 004。原始900秒上限、capture540秒、16圖／96MiB與自己的 cleanup 邊界均不放寬。

## 為何尚不能宣稱修好

004 的 admitted69／raw68 與原 proxy「先加計數、再 emit」程式一致，能證明有一次 admission log 沒留 row；原檔沒保留寫入 error code，不能證是動態 profile ENOENT、磁碟或其他原因。因此本批沒有改 `bytesIn` 去吞掉 ENOENT 或 security 例外。

004 兩個 GET503 有多個可能分支，缺 SQL failure event 與 response body，不能唯一確診。本批是補去識別診斷與修 audit 一致性；**不是已證明修好資料根因，也不是盲目重跑的授權**。下一次需新 exact OPS／兩 input／完整命令／fresh 三次中位數 probe，交 babysit 核對後才可啟動。若仍失敗，依新原始診斷定位，再提出必要的最小修正。

## source review 與測試

初版九檔實體 bytes 保存於私有 `/home/deck/tag-analysis-private/f1-release/sm-005-diagnostic-source-v1-20261014/`；原 freeze JSON SHA `288d2bc0…`。既有非作者 GPT-6.1 Sol 初審找到 analytics.google.com 被錯分 other，issues JSON `/home/deck/tag-analysis-private/f1-release/sm-005-diagnostic-independent-initial-issues-20261014.json`（SHA `1a61899c…`），沒有將初版標 PASS。

修正後 v2 freeze `/home/deck/tag-analysis-private/f1-release/sm-005-diagnostic-source-freeze-v2-20261014.json`（SHA `f3ee90ba46a5dde226d398893913908da44924af33c5f5d8ac57c8411415250a`）；相較初版只改 proxy 與分類測試。測試不連 DB、HTTP、不取鎖、不開程序或 browser。source/mock 結果不是實際 candidate、privacy/B0、零外送、UI 或部署證據。

所有 004 失敗目錄、原 runtime、release、rollback、備份及 Mint 原檔保留。APP677 的 UI 仍為65主route／0完整pass／65pending，未部署。

既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol v2 最終 source/mock 審查通過：66項 targeted mock／4項語法檢查；JSON `/home/deck/tag-analysis-private/f1-release/sm-005-diagnostic-independent-20261014.json`（SHA `cc964250b2411fb1f0654691cf70d0404e460eac8ebbf74c3543d20478b15000`），同名txt transcript（SHA `9343e918db196a49e68210b83f09d8460a9e9ddf7e100676dbb1a5e30fc8c4b2`）。Root同v2另跑100項pure/mock回歸通過，私有原log `/home/deck/tag-analysis-private/f1-release/sm-005-root-regression-v2-20261014.log`；明確排除兩個真processgroup整合測試，不冒充actualguard。
