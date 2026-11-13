# 設計評審截圖清單

每一輪都照這份清單截圖，ID 與 `tools/states.mjs` 一致。每個狀態截兩張（54 個狀態，共 108 張）：

| 尺寸 | 視窗 | 像素比 | 截圖高度 |
|---|---|---|---|
| `desktop` | 1440 × 900 | 1 | 從頁首起，最多 2400 px |
| `mobile` | 390 × 844（觸控） | 2 | 從頁首起，最多 1688 CSS px |

固定條件：

- **資料**：公開 API 在 2026-11-12 18:24 UTC 的快照，只讀一次，存在 `~/.cache/tag-hc/snapshot/`（不進 Git）。錄製時一次一個請求，間隔至少 1.3 秒（公開上限每分鐘 60 次）；之後每一輪只重播快照，不再讀正式 API。快照沒有的路徑回 404，會列在 `/__fixture/misses`。
- **快照缺的鍵**：快照錄的是 72 小時搜尋，這版 `web/` 搜 31 天（`hours=744`）。`tools/snapshot-aliases.json` 用快照裡同一關鍵字的真實回應回答這幾個鍵（「黃仁勳」用 72 小時的標籤列表配上關鍵字搜尋的統計；「zzqxv」回零筆），不讀正式 API，基準與新版拿到同一份。
- **時鐘**：Next 伺服器以 `tools/fake-now.cjs` 從快照時間起算，瀏覽器以 Playwright clock 從同一時間起算，所以「幾小時前」和資料延遲提示每一輪都一樣。
- **登入**：`/auth/me*` 由 fixture 回答，帳號是虛構的「林小美」（`tools/make-reader.py`），收藏、追蹤指向快照中的真實文章與事件；沒有連到任何真實帳號。
- **外觀**：淺色，另列深色狀態；減少動態效果；時區 Asia/Taipei；`DNT: 1`。GA／GTM 與所有非 loopback 請求都擋掉，只放行新聞縮圖與媒體圖示這類圖片。
- **基準**：`perf/frontend-20261112`（PR #34）的 `ffd6a5aa`。這輪的 PR 疊在它上面。

## 頁面與狀態

★ 表示在盲測評審集裡；其餘每輪一樣截，供維護者自己檢查有沒有退步。

| ID | 頁面 | 狀態 | 重現方式 | 評審 |
|---|---|---|---|---|
| `home` | 首頁 `/` | 有資料 | — | ★ |
| `home-dark` | 首頁 | 深色 | `prefers-color-scheme: dark` | ★ |
| `home-signed-in` | 首頁 | 登入後的頁首，只截視窗 | session in | ★ |
| `home-empty` | 首頁 | 空資料 | data empty；首頁是 ISR，先請求一次讓它重新產生 | |
| `event` | 事件表 `/event/` | 今日事件 | — | ★ |
| `event-dark` | 事件表 | 深色 | — | |
| `event-hour` | 事件表 | 單一小時快照 | `?view=hour` | ★ |
| `event-empty` | 事件表 | 空資料 | data empty | ★ |
| `event-loading` | 事件表 | 載入中（3 秒） | API 25 秒才回 | ★ |
| `event-error` | 事件表 | 載入錯誤 | API 回 500 | |
| `eve` | 單一事件 `/eve/4128/` | 有資料 | — | ★ |
| `eve-dark` | 單一事件 | 深色 | — | ★ |
| `eve-error` | 單一事件 | 載入錯誤 | API 回 500 | ★ |
| `topic` | 議題表 `/topic/` | 有資料 | — | ★ |
| `topic-story` | 單一議題 `/topic/setn/3656074/` | 有資料 | — | ★ |
| `topic-empty` | 議題表 | 空資料 | data empty | |
| `topic-loading` | 議題表 | 載入中 | API 25 秒才回 | |
| `tag` | 標籤 `/tag/黃仁勳/` | 有資料 | — | ★ |
| `tag-dark` | 標籤 | 深色 | — | |
| `tag-camp` | 標籤 | 篩選綠營媒體 | `?camp=green` | ★ |
| `tag-empty` | 標籤 | 空資料 | data empty | |
| `tag-error` | 標籤 | 載入錯誤 | API 回 500 | |
| `media` | 媒體來源 `/media/` | 有資料 | — | ★ |
| `media-camp` | 媒體來源 | 篩選綠營 | `?camp=green` | |
| `media-outlet` | 單一媒體 `/media/udn/` | 有資料 | — | ★ |
| `media-outlet-dark` | 單一媒體 | 深色 | — | ★ |
| `media-error` | 媒體來源 | 載入錯誤 | API 回 500 | |
| `ranking` | 關鍵字排行 `/ranking/` | 有資料 | — | ★ |
| `ranking-dark` | 關鍵字排行 | 深色 | — | ★ |
| `ranking-blue` | 關鍵字排行 | 藍營分類 | `?category=blue` | ★ |
| `ranking-empty` | 關鍵字排行 | 空資料 | data empty | |
| `ranking-loading` | 關鍵字排行 | 載入中 | API 25 秒才回 | |
| `ranking-error` | 關鍵字排行 | 載入錯誤 | API 回 500 | ★ |
| `similarity-daily` | 每日相似 `/similarity/daily/` | 有資料 | — | ★ |
| `similarity-daily-empty` | 每日相似 | 空資料 | data empty | |
| `similarity-reposts` | 轉載統計 `/similarity/reposts/` | 有資料 | — | ★ |
| `similarity-reposts-dark` | 轉載統計 | 深色 | — | |
| `journalist` | 記者 `/journalist/` | 有資料 | — | ★ |
| `journalist-person` | 單一記者 `/journalist/廖賢龍/` | 有資料 | — | ★ |
| `journalist-empty` | 記者 | 空資料 | data empty | |
| `article` | 文章 `/article/103767383/` | 有擷取正文 | — | ★ |
| `article-dark` | 文章 | 深色 | — | |
| `article-signed-in` | 文章 | 登入後（收藏按鈕），只截視窗 | session in | |
| `search` | 搜尋 `/search/` | 還沒輸入 | — | ★ |
| `search-results` | 搜尋 | 有結果 | `?q=黃仁勳` | ★ |
| `search-none` | 搜尋 | 沒有結果 | `?q=zzqxv` | ★ |
| `search-loading` | 搜尋 | 載入中 | API 25 秒才回 | |
| `search-error` | 搜尋 | 載入錯誤 | API 回 500 | |
| `my-saved-out` | 我的收藏 `/my/saved/` | 登入前 | session out | ★ |
| `my-saved` | 我的收藏 | 登入後有收藏 | session in | ★ |
| `my-saved-empty` | 我的收藏 | 登入後沒有收藏 | session in、data empty | ★ |
| `my-following` | 我的追蹤 `/my/following/` | 登入後有追蹤 | session in | ★ |
| `my-following-dark` | 我的追蹤 | 深色 | session in | |
| `my-following-empty` | 我的追蹤 | 登入後沒有追蹤 | session in、data empty | |

不適用、刻意不列的格：

- 首頁沒有載入中、錯誤：它是預先產生的 ISR 頁，API 失敗時繼續提供上一版。各區塊自己的載入與重試不在這次範圍。
- 單一事件、標籤、文章、單一媒體、單一記者沒有載入中：這些路由會 `notFound()`，PR #34 刻意不放 `loading.tsx`，以免 404 先回 200。
- `my` 頁面沒有錯誤狀態：讀者資料由瀏覽器讀取，失敗時與未登入相同。
- 登入前後只在有差別的地方截：首頁頁首、文章的收藏按鈕、`/my/`。其他頁面的頁首與首頁相同。

## 參考對手

第一輪截一次，之後每輪重用同一組檔案（`tools/capture.mjs references`）。Ground News 的 CDN 會擋 UA 含 `HeadlessChrome` 的請求，所以只有對手組用同版本的一般 `Chrome` UA，每頁只讀一次；AllSides 對任何自動化瀏覽器都要求 Cloudflare 真人驗證，改用同類的偏向比較站 Verity。

| ID | 網址 | 對應的我方頁面 |
|---|---|---|
| `ground-news-home` | https://ground.news/ | 首頁、事件 |
| `ground-news-story` | https://ground.news/interest/nvidia | 標籤、單一事件 |
| `verity-home` | https://www.improvethenews.org/ | 陣營對照（原訂 AllSides，見下） |
| `google-news-tw` | https://news.google.com/home?hl=zh-TW&gl=TW&ceid=TW:zh-Hant | 首頁、搜尋 |

## 重現

主機負載有明文規定（`docs/unfreeze-gates-20261013.md`）：全站同時最多一個建置、兩個截圖瀏覽器，load1 超過 12 就停。閘門與工作分成兩步，閘門不通過就等。

**換機器（2026-11-13）**：sky-server 長時間 load >10，閘門一直不放行，基準只拍到 27/110，所以整輪（基準、新版、對手）改在開發機 skyhong-SM（12 核、16 GB）從頭重拍，分數只在同一台機器拍的截圖之間比較。正式站仍在 sky-server，這台不是正式主機。

- 閘門門檻依核心數：16 核以上沿用 sky-server 的 10／12；其餘放行 0.75 × 核心數、停在 1 × 核心數（skyhong-SM：9／12）。可用 `GATE_LOAD_OK`、`GATE_LOAD_STOP` 覆寫。一個建置、兩個瀏覽器的上限不變。
- 工作資料夾 `TAG_HC_ROOT`，預設 `~/.cache/tag-hc`（skyhong-SM 的 `/tmp` 是記憶體 tmpfs）：快照、截圖組 `sets/`、盲測 `rounds/`、對應表 `private/`、伺服器記錄 `logs/`。
- Playwright 預設 `~/.cache/tag-hc/pw`（`npm i playwright@1.63.0` 後 `npx playwright install chromium`），或用 `PLAYWRIGHT_MODULE` 指定。

```bash
T=docs/design-review/tools
export SNAPSHOT_T0=2026-11-12T18:24:00Z
# 1. 快照 API 與前門（重播；第一次錄製時加 --record）
node $T/fixture-api.mjs --snapshot ~/.cache/tag-hc/snapshot
# 2. 建置（先等閘門，再建置）
$T/gate.sh build && $T/web.sh build /path/to/checkout/web
# 3. 截圖（先等閘門，再截圖；每個資料狀態會重啟一次 Next）
$T/gate.sh capture && node $T/capture.mjs site /path/to/checkout/web OUT_DIR
$T/gate.sh capture && node $T/capture.mjs references OUT_DIR
# 4. 組一輪盲測
python3 $T/make_round.py 1 ~/.cache/tag-hc/sets/baseline NEW_DIR ~/.cache/tag-hc/sets/reference
```
