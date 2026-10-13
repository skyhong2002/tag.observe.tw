# F1 解凍後待重拍清單（不是 review 證據）

目標 source SHA：`2331fa8a136ed0271d1f001cf8a2e780a1b8377d`。此清單只排程缺少的驗收；沒有新增 capture、build、probe 或任何 pass。歷史圖仍保留在主 ledger，不能替代本 SHA。

**65 個主 route：0 review、0 pass、65 pending／missing（待重拍）。** 9 個平行 notes 實作與 3 個邊界狀態另外列在主 ledger，不增加 route 數。每個 route 都需要 1280 與 390 真圖、實際 URL／SHA／UTC、啟動前網路層封鎖 GA/GTM 與原始 network artifact，以及非作者的獨立 GPT-6.1 Sol／Opus review transcript。

只能在使用者明確解凍及安全閘門通過後執行。禁止新增帳號／權限；admin workflow 只用既有授權 session 或既有隔離 fixture。DNT、GPC、webdriver、bot、opt-out 都維持，不送 GA 合成事件。未達標的頁／狀態繼續 pending，不能因一次 build 目標而略過。

| 列 | 主 route | 此目標 SHA 狀態 |
|---|---|---|
| 001 | `/` | pending／missing：待重拍 1280／390、獨立 review |
| 002 | `/tag/[tag]/` | pending／missing：待重拍 1280／390、獨立 review |
| 003 | `/tag/[tag]/picture/` | pending／missing：待重拍 1280／390、獨立 review |
| 004 | `/ranking/` | pending／missing：待重拍 1280／390、獨立 review |
| 005 | `/event/` | pending／missing：待重拍 1280／390、獨立 review |
| 006 | `/eve/[id]/` | pending／missing：待重拍 1280／390、獨立 review |
| 007 | `/eve/[id]/headlines/` | pending／missing：待重拍 1280／390、獨立 review |
| 008 | `/article/[id]/` | pending／missing：待重拍 1280／390、獨立 review |
| 009 | `/search/` | pending／missing：待重拍 1280／390、獨立 review |
| 010 | `/media/` | pending／missing：待重拍 1280／390、獨立 review |
| 011 | `/article/` | pending／missing：待重拍 1280／390、獨立 review |
| 012 | `/topic/` | pending／missing：待重拍 1280／390、獨立 review |
| 013 | `/feature/` | pending／missing：待重拍 1280／390、獨立 review |
| 014 | `/admin/tags/` | pending／missing：待重拍 1280／390、獨立 review |
| 015 | `/admin/` | pending／missing：待重拍 1280／390、獨立 review |
| 016 | `/admin/avatars/` | pending／missing：待重拍 1280／390、獨立 review |
| 017 | `/admin/media/` | pending／missing：待重拍 1280／390、獨立 review |
| 018 | `/admin/tag-groups/` | pending／missing：待重拍 1280／390、獨立 review |
| 019 | `/admin/tag-visuals/` | pending／missing：待重拍 1280／390、獨立 review |
| 020 | `/admin/writing/` | pending／missing：待重拍 1280／390、獨立 review |
| 021 | `/api/` | pending／missing：待重拍 1280／390、獨立 review |
| 022 | `/api/status/` | pending／missing：待重拍 1280／390、獨立 review |
| 023 | `/article/query/` | pending／missing：待重拍 1280／390、獨立 review |
| 024 | `/byline/` | pending／missing：待重拍 1280／390、獨立 review |
| 025 | `/byline/[key]/` | pending／missing：待重拍 1280／390、獨立 review |
| 026 | `/cat/[type]/` | pending／missing：待重拍 1280／390、獨立 review |
| 027 | `/crawlers/` | pending／missing：待重拍 1280／390、獨立 review |
| 028 | `/crawlers/traffic/` | pending／missing：待重拍 1280／390、獨立 review |
| 029 | `/demo/` | pending／missing：待重拍 1280／390、獨立 review |
| 030 | `/demo/compare/` | pending／missing：待重拍 1280／390、獨立 review |
| 031 | `/event/archive/` | pending／missing：待重拍 1280／390、獨立 review |
| 032 | `/feature/[media]/` | pending／missing：待重拍 1280／390、獨立 review |
| 033 | `/feature/[media]/[id]/` | pending／missing：待重拍 1280／390、獨立 review |
| 034 | `/group/` | pending／missing：待重拍 1280／390、獨立 review |
| 035 | `/group/[id]/` | pending／missing：待重拍 1280／390、獨立 review |
| 036 | `/journalist/` | pending／missing：待重拍 1280／390、獨立 review |
| 037 | `/journalist/[name]/` | pending／missing：待重拍 1280／390、獨立 review |
| 038 | `/liveboard/` | pending／missing：待重拍 1280／390、獨立 review |
| 039 | `/liveboard/setting/` | pending／missing：待重拍 1280／390、獨立 review |
| 040 | `/liveboard/settings/` | pending／missing：待重拍 1280／390、獨立 review |
| 041 | `/login/` | pending／missing：待重拍 1280／390、獨立 review |
| 042 | `/media/[media]/` | pending／missing：待重拍 1280／390、獨立 review |
| 043 | `/media/[media]/articles/` | pending／missing：待重拍 1280／390、獨立 review |
| 044 | `/media/[media]/references/` | pending／missing：待重拍 1280／390、獨立 review |
| 045 | `/media/crawlers/` | pending／missing：待重拍 1280／390、獨立 review |
| 046 | `/media/sources/` | pending／missing：待重拍 1280／390、獨立 review |
| 047 | `/media/traffic/` | pending／missing：待重拍 1280／390、獨立 review |
| 048 | `/method/` | pending／missing：待重拍 1280／390、獨立 review |
| 049 | `/my/` | pending／missing：待重拍 1280／390、獨立 review |
| 050 | `/my/following/` | pending／missing：待重拍 1280／390、獨立 review |
| 051 | `/my/reading/` | pending／missing：待重拍 1280／390、獨立 review |
| 052 | `/my/saved/` | pending／missing：待重拍 1280／390、獨立 review |
| 053 | `/my/settings/` | pending／missing：待重拍 1280／390、獨立 review |
| 054 | `/observe/` | pending／missing：待重拍 1280／390、獨立 review |
| 055 | `/observe/opt-out/` | pending／missing：待重拍 1280／390、獨立 review |
| 056 | `/readers/` | pending／missing：待重拍 1280／390、獨立 review |
| 057 | `/similarity/` | pending／missing：待重拍 1280／390、獨立 review |
| 058 | `/similarity/about/` | pending／missing：待重拍 1280／390、獨立 review |
| 059 | `/similarity/daily/` | pending／missing：待重拍 1280／390、獨立 review |
| 060 | `/similarity/reposts/` | pending／missing：待重拍 1280／390、獨立 review |
| 061 | `/similarity/sources/` | pending／missing：待重拍 1280／390、獨立 review |
| 062 | `/topic/[media]/` | pending／missing：待重拍 1280／390、獨立 review |
| 063 | `/topic/[media]/[id]/` | pending／missing：待重拍 1280／390、獨立 review |
| 064 | `/writing/` | pending／missing：待重拍 1280／390、獨立 review |
| 065 | `/writing/titles/` | pending／missing：待重拍 1280／390、獨立 review |

## 必驗功能與狀態

- `/tag/[tag]/`：多／少／空資料、API error／truncated、60 字長標籤、直接／繼承 is-a／相關／別名、圖片公開邊界；登入前返回 anchor，投稿成功／重複／錯誤／未授權／晚到回應。
- `/tag/[tag]/picture/`：人物／非人物、候選多／少／空、載入錯誤重試、管理員鎖定、投票連點、同意授權／未同意、上傳處理中／成功待審／失敗／逾時、切頁取消；私人 pending 不得出現在公開 API／頁面。
- `/admin/tags/`：loading、匿名／reader 權限不足、admin；單一 gate、待審／核准／拒絕列表、篩選／下一頁／空／error、必填理由、圖片授權、重複審核、過期結果，以及核准後公開頁只顯示核准內容。
- 四項既有 UI issues：002 長 chip；020 重複 gate；027 crawler 空資料；028 SuggestInput popup 與 sticky header。source/test 通過仍需雙寬重驗。
- 每個動態模板：主 ledger 的多／少／空／error／權限矩陣逐格驗，發現差異就擴樣。公開頁沒有某權限分支時記 n/a 與 source 證據，不自行填 pass。
- 每頁：首屏到頁尾、導航、responsive、資料來源／計算方式、loading／empty／error、鍵盤操作及圖片載入；notes 與 404／framework error 另驗。共用 component review 不取代逐頁。

非 UI 項目只列 n/a-ui：`app/test/f1-offline-contract.spec.ts`、`app/test/picture-vote-race.spec.ts`、`web/test/f1-frontend-flow.spec.ts`、`web/test/four-issue-ui.spec.ts` 等 mock/source 證據，不算此表完成數。
