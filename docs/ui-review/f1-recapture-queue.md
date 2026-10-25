# F1 解凍後待重拍清單（不是 review 證據）

前一批 source SHA：`2331fa8a136ed0271d1f001cf8a2e780a1b8377d`（以下65列保留歷史排程）。最新目標 `e68987fb2e5adaf92c07a92931b04ebb089710a6` 的展開矩陣與預算見後文。此清單只排程缺少的驗收；沒有新增 capture、build、probe 或任何 pass。歷史圖仍保留在主 ledger，不能替代本 SHA。

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


## 離線展開矩陣與解凍後容量計畫（2026-10-13）

新增計畫 source：`e68987fb2e5adaf92c07a92931b04ebb089710a6`，本轮已凍結此產品source（未建置）；本節沒有修改上方 `2331fa8` 未建置歷史紀錄。離線盤點基底為 `ed1607b8f9a695b3035238375842d80defb76948`。逐格清單：[f1-recapture-matrix.csv](f1-recapture-matrix.csv)。

主 route 仍為 **65**；CSV共2312個計畫格：route 2180、notes 108、邊界24。逐格新增 `applicability`、`source_path`、`applicability_reason`、`capture_scope`，回讀65個page source及列名子元件後分類為 **496 applicable、1300 conditional、516 n/a**。applicable僅表示source確定有對應UI／導航義務；conditional表示待最終source與既有fixture逐格確認，**尚不能認定可capture**；n/a不擷取、不給pass。0 review、0 pass。每個state均列1280×800／390×844 × light／dark四格。

14個直接redirect（含既有admin aliases與media articles）原本自身loading／empty／error／image／many等格保留但改n/a，另列導航與query保留驗證及目的地UI；`capture_scope=destination-ui`必須歸屬目的地route與SHA，不能宣稱redirect有自身UI。條件redirect的article/search/feature維持本身UI狀態conditional。固定API文件／方法頁的非同步集合狀態為n/a，設定／opt-out無empty集合及自身圖片狀態為n/a，其表單error等仍conditional。公開動態page無page role gate者permission-insufficient為n/a；tag投稿與picture分支另conditional。

notes catch-all `NoNotes`實際return null，anchor內容／自身replacement為n/a，只保留條件式切頁clear驗證；其餘8個notes的實際內容applicable，切頁兩端選例conditional。3個not-found/framework邊界均conditional，必須先證明fixture真正觸發對應邊界。Admin只用已授權fixture或既有session，不新增帳號／權限。分類不是UI驗收，正常loaded不得用error圖替代。

### 僅 metadata 的歷史容量樣本

私人根目錄 `/home/deck/tag-analysis-private/ui-review/f1/`，只列目錄及 stat 既有正常檔案（跳過symlink），不讀圖、HAR或network內容、不hash大檔。PNG/JPG/JPEG/WebP與HAR／檔名含network的JSON/JSONL分組；p50/p95採nearest-rank。這是歷史混合版本／分段／批次樣本，不能當每格等尺寸或HAR每張分攤。

| 樣本 | 檔數 | 總bytes | p50 bytes | p95 bytes | 最大bytes |
|---|---:|---:|---:|---:|---:|
| image | 1067 | 261758636 | 102988 | 957399 | 5322787 |
| HAR | 20 | 51766842 | 330339 | 7385313 | 31304899 |
| network JSON/JSONL | 237 | 8073728 | 20855 | 77377 | 797124 |

總樣本1324檔／321599206 bytes（306.701 MiB）。HAR最大29.855 MiB且歷史圖最大5.076 MiB，表示p95不是硬上限；使用現有小批guard的 **每張4 MiB上限、超限拒存並分段重規劃**，每批最多16張。每批保留32 MiB profile／network／logs＋16×4 MiB圖片＝**96 MiB**，另依既有工具保留8 MiB final-evidence headroom，不計為可消耗額度。未來每批須實測artifact總量並驗完整network證據；歷史HAR的p95 7.043 MiB不表示允許本模式新增HAR，凍結小批模式原規定2 MiB append-only raw log、無HAR仍保留。

容量只作規劃上限，不能稱2312格全可capture或最低136批。排除516個n/a，496個source確定義務的單張配置為31批／2976 MiB（2.906 GiB）；再把1300個尚未確認conditional全部計入，規劃範圍上限1796格，ceil(1796÷16)＝113批，每批96 MiB，共 **10848 MiB（10.594 GiB）配置上限**。這是假設每格一張的估算配置，不是實際artifact硬上限：條件不成立會減少，長頁分段／重試／新增狀態會增加，屆時必須重算。redirect導航artifact與目的地UI分別記錄、可去重但不預先抵扣。image p95的純圖比較為1796×957399＝1719488604 bytes（1.601 GiB），不替代保守批額。build／release／Docker／匯出皆未計入。

**目前全面凍結未解除。10 GiB最低線不能替代協調者明確解凍、當時磁碟可用量／backup保留線、batch budget、全域browser/build數量、load與三站HTTP/TTFB重新gate。** 本節未做df、capture、build、probe、DB、清理、staging或backup操作；没有新UI review。解凍後須用即時headroom及本批預算決定可否執行，不能以本文件或歷史112.756／107.80 GiB樣本當當前許可。

首頁PSI候選另加7個conditional狀態各兩寬×兩色（28格）：camp-summary pending／unavailable-retry、圖片missing/error fallback、rankNew/rankUp與hover、topic72／story65／hero75圖片高DPR清晰度及載入先後；fixture及最終source仍待確認，無新增capture或UI pass。
