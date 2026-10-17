# AI 產生的爬取規則

媒體改版後，手寫的爬取規則會失效：列表抓不到新文章、抽不到內文，或抽不到標籤。worker 會自動挑出這些媒體，請 ai-gateway 的 `sky-quality` 模型寫該站的規則，用真實頁面驗證，通過就直接上線。

**AI 不碰資料庫。** 模型只產生規則，存在 `TAG_GENERATED_RULES_DIR`（預設 `~/.local/share/tag-analysis/generated-rules/`）的 JSON 檔裡，從來不寫進 DB，也拿不到 DB。寫進 `articles` 的資料一律是既有爬蟲照規則抓下來的頁面內容。

程式在 `app/src/crawl/rules/`，排程是 `app/src/jobs/crawl-rules-job.ts`。

## 規則長什麼樣

規則是宣告式資料，形狀和手寫的 `NewsSiteRules`（`app/src/crawl/news-site-rules.ts`）及 `SourceSpec.list` 相同，不會執行模型寫的程式碼。

- **`hostRules`**：依「網域加網址 regex」比對文章頁。可設定的欄位：
  - `bodySelector`、`bodyExcludeSelector`
  - 標題：`titleSelector`／`titlePattern`
  - 作者：`authorSelector`／`authorPattern`
  - 發布時間：`publishedSelector`、`publishedAttribute`、`publicationPattern`、`publicationFormat`
  - `tagSelector`、`plainTextBody`
- **`listing`**：取代原本的列表。內容是列表頁或 feed 網址，加上 `discoverPattern`、`include`。原本的 `articleId` 和 user agent 保留，同一篇文章不會因為換規則就被當成新文章。
- **`render: true`**：這家媒體的頁面改由無頭瀏覽器渲染後再讀（`app/src/crawl/render.ts`）。

套用順序：

- **AI 規則優先於手寫規則**，因為它就是在手寫規則壞掉時產生的。
- 抽出的內文 `body_source` 會記成 `selector:gen`，方便量測命中率。
- API 和 worker 每分鐘重讀一次規則檔。管理員重抓文章是在 API 裡跑的，所以 API 也要讀。

### 安全檢查（`contract.ts`）

- **網域**：只能是這家媒體自己的網域，也就是設定裡的網址和近 14 天文章的網域。
- **共用平台不產生規則**：例如 youtube.com、yahoo.com、msn.com、facebook.com、medium.com，以及兩個以上來源共用的網域。規則是依網域套用的，寫給一家，其他家也會被改到。只在這些平台發文的媒體（例如 YouTube 頻道）完全不處理。
- **regex**：
  - 長度上限 300 字
  - 拒絕巢狀量詞，例如 `(a+)+`，避免回溯爆炸
  - 拒絕 backreference
- **selector**：必須能被 cheerio 解析。
- **試用規則隔離**：驗證中的規則只在那次驗證的 async context 裡生效（`withTrialSiteRules`，AsyncLocalStorage），同時進行的爬取不會用到還沒驗證的規則。

## 什麼時候產生（`targets.ts`）

每 30 分鐘一輪（`TAG_AI_RULES_MINUTES`），只有 `TAG_AI_RULES_ENABLED=1` 時才排程。依下列順序挑目標：

1. **AI 規則又壞了**：已有 AI 規則的媒體再次符合下面任一條件。規則上線後 4 天內不判斷，讓統計先反映新規則。
2. **列表失效**，符合任一：
   - 近 12 小時至少 3 次列表抓取全部失敗。
   - 已經超過「平均發文間隔 × 5」沒有新文章，而且至少 48 小時；平均發文間隔以過去 28 天計算，至少要有 10 篇。
3. **內文抽不到**：近 4 天至少 8 篇，其中一半以上是 `missing`/`short`。付費牆、challenge（`blocked`）和抓取錯誤不算，因為改 selector 修不好。
4. **缺標籤**：近 4 天內文正常的至少 8 篇，其中 60% 以上沒有關鍵字標籤。
5. **新來源**：目錄裡沒通過審核（`group: 'off'`）的自動探索來源。驗證通過就排進每小時組。

失敗後要等一段時間才會再試：列表和內文 14 天，標籤和新來源 30 天。

## 驗證（`validate.ts`）

- **列表類**（列表失效、新來源，或規則帶了 listing）：
  - 列表要有至少 3 篇近 14 天的文章。
  - 抽 3 篇，每篇都要符合：
    - HTTP 200
    - 標題 ≥ 4 字，而且出現在頁面的 `<title>`、og:title 或 h1 裡
    - 發布時間在 14 天內，且不晚於現在 +1 小時
    - 內文 `ok`，至少 200 字
- **內文和標籤類**：拿 DB 裡最近抽不到的文章試，至少 2 篇要通過。
- **不同文章的標題不能相同**：相同代表抓到的是頁面上的固定元素，不是標題。
- **標籤**（`tagProblem`）：
  - 一定要來自 `tagSelector`。
  - 每篇最多 15 個，每個不超過 20 字。
  - 至少一個標籤出現在標題或內文裡。
  - 各篇的標籤不能完全相同，否則代表抓到的是選單。
- **不能弄壞原本正常的文章**：另外抽 2 篇目前讀得到的文章，換新規則後也必須正常。
- **請求量**：每次驗證最多 30 個請求，請求之間間隔 0.4 秒。

最多 3 輪。沒通過就把驗證報告回饋給模型。原始 HTML 幾乎沒有文字，或列不出文章時，下一輪改看渲染後的頁面。模型判斷這個站沒有文章、驗證也列不出文章時，就提早結束。

## 額度（`app/src/ai/quota.ts`）

剩餘額度讀自 status.skyhong.tw 的公開 JSON（`/api/status`），不需要金鑰，每 5 分鐘更新。做法：

- 每個 Codex 帳號只算一次，取各帳號剩餘額度的平均。
- 停用、登入被拒或回報超過 20 分鐘的帳號不算。
- 讀不到時當作沒有額度。

| 剩餘額度 | 每輪處理的媒體數 |
| --- | --- |
| ≥ 80% | 4 |
| 50–80% | 2 |
| 20–50% | 1 |
| < 20% 或讀不到 | 0 |

- 每次呼叫模型前都會重新檢查，額度掉到 20% 以下就中途停下。
- 另有防失控上限：一天最多 100 個媒體、300 次模型呼叫。
- tag-groups 的 AI 步驟和 tag-visuals 的 AI 挑圖也套用同一個 20% 門檻：低於門檻就跳過 AI 那一步，其他步驟照跑。

## 無頭瀏覽器

- **瀏覽器**：Playwright 的 headless shell（`~/.cache/ms-playwright/chromium_headless_shell-<rev>`），或用 `TAG_RENDER_CHROME` 指定。設 `TAG_RENDER=0` 可以關掉渲染。
- **資源隔離**：Chromium 跑在自己的 systemd scope 裡（`render-scope.sh`，640M、CPU 50%），開啟 Chromium 自己的沙箱，閒置 60 秒後自動關閉。
- **抓取限制**：
  - 每一頁都先經過 `fetchText`：公開位址檢查、轉址、大小上限。
  - 不載入圖片、影音、字型。
  - 每個子請求的網域都要通過公開位址檢查。
  - 主頁面不能跳到別的網站。

## robots.txt

爬蟲不遵守 robots.txt。`robots` job 每天 04:40（`ROBOTS_CRON`）把每個媒體網域的 robots.txt 讀一次，存進 `robots_observations`，只用來顯示在 `/admin/media/`。這是爬蟲寫入的資料，不是 AI 產生的。

依 RFC 9309 分類：

| 狀態 | 意思 |
| --- | --- |
| `allowed` | 允許 |
| `missing` | 4xx 或沒有檔案，視為允許 |
| `partial` | `*` 有部分 Disallow |
| `disallowed` | `*` 整站禁止；另外記錄是否只允許 Googlebot |
| `unreachable` | 5xx、429 或連不上 |

## 管理與回滾

- **`/admin/media/` 表格**：多了「robots.txt」和「AI 規則」兩欄。
- **媒體詳情頁**：顯示使用中的規則、驗證抽樣、各版歷史和最近的產生紀錄。
- **停用**：按「停用 AI 規則」會把這一版標成 `rejected`，一分鐘內就回到手寫規則。之後這家媒體如果又符合觸發條件，會重新產生規則。
- **手動處理**：

```sh
npm run rules:once -- --quota                 # 目前額度、每輪處理幾家
npm run rules:once -- --signals               # 現在符合條件的媒體、下一輪會挑哪些
npm run rules:once -- --media mnews           # 產生並驗證，只印出結果，不上線
npm run rules:once -- --media mnews --apply   # 通過就上線
npm run rules:once -- --media x --trigger tags   # 指定觸發原因
```

- **完全關閉**：拿掉 `TAG_AI_RULES_ENABLED` 並重啟 worker；已上線的規則照常使用。要讓某家媒體回到手寫規則，就停用它的規則。
