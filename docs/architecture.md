# 架構與維運

## 系統

```
Cloudflare Tunnel → tag.observe.tw
  Fastify gateway :18130（tag-analysis.service）
    /api/v1/*          公開 API（自家 MariaDB）；/api/ 是文件頁（Next）
    /feeds/*.xml       RSS（新聞事件、單一標籤）；/sitemap.xml、/robots.txt
    舊網址              301 到最接近的新頁（app/src/legacy-redirects.js）；舊 /api/*.php → 410
    /metrics、health   只對本機（帶 cf-connecting-ip 的外部請求 404／精簡）
    /_next/image       圖片主機白名單在閘道檢查（見 security.md）
    其他                → Next.js 16 SSR :18132（tag-web.service）
  Worker :18133 metrics（tag-worker.service，BullMQ + Redis）
  infra/compose.yml：MariaDB 11.4 :13306、Redis :16379、Prometheus :19090、Loki :13100、Alloy、Grafana :13000
                     （全部只綁 127.0.0.1；Grafana 管理密碼在 infra/.env；告警送 Discord）
  tag-backup.timer：每日 04:30 備份與還原演練（scripts/backup-db.sh，保留 14 天，在 ~/tag-analysis-private/backups）
```

執行期不連線舊站 tag.analysis.tw 或其資料庫。

## 程式位置

| 路徑 | 內容 |
| --- | --- |
| `app/src/app.js` | 閘道：路由註冊、速率限制、CORS、舊網址、UI 代理 |
| `app/src/v1/` | 公開 API；`openapi.ts` 是端點說明的唯一來源（見 [api.md](api.md)） |
| `app/src/feeds.ts` | robots.txt、sitemap.xml、RSS |
| `app/src/crawl/` | 爬蟲引擎（見 [crawlers.md](crawlers.md)） |
| `app/src/jobs/` | 排程工作：排行、事件分群、議題、標籤統計、健康檢查、資料保留、來源探測 |
| `app/src/db/` | Drizzle schema 與 migrations（`app/src/db/migrations`） |
| `app/data/` | 媒體規格、分類（含藍綠名單 `media-catalog.json`）、停用清單、favicon |
| `web/` | Next.js UI（SSR，ECharts） |
| `tools/` | 一次性工具與產生器（`gen-api-docs.ts`、`check-openapi.ts`、`gen-image-hosts.ts`、`gen-pwa-icons.py`、`brand-assets.py`…） |

## 排程（`app/src/worker.ts`）

| 工作 | 時間 |
| --- | --- |
| 新聞類列表 `crawl-index news` | 每 9 分鐘 |
| 其他媒體列表 `crawl-index hourly` | 每 30 分鐘啟動一輪（`CRAWL_HOURLY_RUN_MINUTES`），每個來源仍以 60 分鐘為週期 |
| 內文與標籤 `crawl-articles` | 每 19 分鐘 |
| 排行 `ranking` | 每 10 分鐘（以整點小時存 `ranking_snapshots`） |
| 事件分群 `events` | 每小時 :04、:34 |
| 議題 `topics` | 每小時 :50 |
| 標籤統計 `tag-stats` | 每小時 :53 |
| 相似度索引 `similarity` | 每 10 分鐘（`SIMILARITY_INDEX_MINUTES`） |
| 爬蟲健康 `crawl-health` | 每 15 分鐘 |
| 資料保留 `retention` | 每日 04:15 |
| 停用來源探測 `source-probe` | 每週一 05:30 |

時間都可用環境變數覆寫（`CRAWL_NEWS_MINUTES`、`EVENTS_CRON`…）。

兩個 `crawl-index` 工作每輪不是照固定順序跑完整組：先從 `crawl_runs` 取每個來源最近一次完成的列表抓取時間，依由舊到新排序（沒抓過的最前面），距上次完成不到該組週期八成的來源（news 約 7 分鐘、hourly 約 48 分鐘）這輪跳過。部署重啟 worker 或一輪跑超過週期時，下一輪會從沒輪到的來源接著跑，不會有來源長期沒抓（`app/src/jobs/crawl-job.ts` 的 `orderDueSources`）。

部署時 worker 收到 SIGTERM 會先中止派發：`crawl-index` 與 `crawl-articles` 不再開始新的來源，只把進行中的抓完後正常結束工作（`stopped` 記錄沒輪到的數量；systemd `TimeoutStopSec=50`）。新 worker 啟動時立刻排入一次 news 與 hourly 的 `crawl-index`，靠到期過濾只補沒輪到的來源，所以連續部署期間抓取只會暫停幾秒，不會有來源被跳過或等到下一個整點。

## 議題來源與更新驗證

議題表收官方編輯整理的專題／議題入口，不把一般新聞分類、每篇文章標籤或外站連結當作新專題。`app/src/crawl/topics.ts` 集中管理來源；2026-10-03 第二輪實測接入 55 家媒體、63 個入口，並不代表只有 55 家媒體有專題。盤點範圍改為完整媒體目錄，而非只測試既有爬蟲清單；檢查結果、尚待確認的來源與限制見 [議題來源盤點](topic-source-coverage.md)。

中央社同時讀取新聞專題與數位專題館公開 JSON；ETtoday 深度專題讀取官方頁面實際使用的公開 CSV（不使用頁面的靜態備援資料）。自由、TVBS、公視、聯合、壹蘋同時追蹤多個專題入口。今周刊首頁專題卡片的短網址只允許已知短址服務，解析後仍須回到媒體官方網域；失敗時回報部分失敗，不把短網址或第三方目的地直接入庫。工商時報使用首頁推薦專題，專題總覽仍有驗證頁限制。

每小時 :50 更新。每個入口分開記錄成功、零筆或失敗；部分入口失敗仍保存其他入口的結果，既有資料不刪除。重複網址維持原始首次發現時間，更新名稱及有效封面。API `check` 與頁面來源狀態顯示最近檢查、最近完整成功、筆數及延遲（超過三小時）；一次仍有部分入口失敗不能算完整成功。

頁面依「最後更新」排序：專題頁上最新一則報導的時間（每 6 小時重讀專題頁）。報導日期依序取本站收錄的發布時間、專題頁標示的日期、先前檢查存下的日期、網址中的日期；仍無日期時讀報導本身頁面（最新兩則與最舊一則，每次執行最多 150 頁，議題優先，日期存回 page_keys，每則只讀一次）。沒有報導日期的用本站首次發現時間；補收舊頁不代表原站新上架，首次追蹤一間媒體時的既有頁面標示為已上架，這類頁面沒有報導日期時更新時間不明、排在最後，有新報導則照常排到前面。爬蟲只保證檢查已設定的公開入口：未列在入口的專題、歷史分頁或需要登入的內容不保證涵蓋。需要新增媒體或入口時，先核對官方列表與最新卡片，再加入來源規則和回歸測試。

```sh
# 盤點完整媒體目錄；候選連結必須人工驗證，不會自動啟用
node tools/discover-topic-sources.ts --out=/tmp/topic-directory.json
# 唯讀實測所有已設定入口（最多 3 個並行），任一入口失敗會以非零狀態退出
node tools/topics-once.ts
# 選擇來源，或立即補收；不觸發正文擷取
node tools/topics-once.ts --media=cna,ltn,ettoday
node --env-file=.env tools/topics-once.ts --apply
```

## 演算法

- **關鍵字過濾**（`tag-noise.ts`）：排行榜在計算及讀取既有快照時排除分類詞（地方、生活、地方生活等）、以 新聞／要聞／匯流／總覽 結尾的欄目與品牌詞（國際新聞、台灣要聞、快新聞；假新聞除外）與單獨西元／民國年份（2015、115年、全形與中文數字年份）。同規則用於事件共現、標題補標籤與媒體關鍵字；保留來源文章的原始標籤。0050、0056、2026大選等完整代碼／主題不因含數字而排除。這份分類詞規則與舊 `no_equal` 不同；後者含台灣、政黨等可用排行詞，只限制事件關聯及補標籤，不能整份套在排行榜。舊 `tags.no_tag` 的資料庫名單並未完整匯入，不能視為已恢復全部舊站人工設定。
- **每小時篇數與移動平均**（`v1/tag-series.ts`）：復原舊 `tag_series.php` 的 Day 線，當小時及前 23 小時收錄篇數總和除以 24。從文章標籤索引按發布時間及固定基準媒體統計，與是否進入前 500 名無關；顯示前額外讀取 23 小時，基準收錄開始前留白；開始後無收錄的時段為 0，滿 24 小時才顯示平均及分數，只畫已結束的小時。標籤頁提供逐時篇數與平均線；排行榜 `trend=1` 提供最近 49 個等距點，趨勢排序比較相隔 48 小時的平均值。這是篇數平均，與爆發力的加權分數分開，沒有再次平均既有 24 小時分數。數字代表目前收錄，並非保證各來源每小時均成功抓取，也不是補抓前的歷史資料快照。
- **排行**（`jobs/ranking-compute.ts`，移植自舊站 index.php）：過去 24 小時，每篇文章的每個標籤 count +1；同一媒體第 n 篇乘 0.5^(n−1)。正規化分數 = 分數 ÷ 固定基準媒體數 × 50。爆發力 = 現在分數 + 與 3／6／12／24／48 小時前分數的差，依序以 0.92／0.84／0.7／0.5／0.25 加權。所有比較使用同一基準；缺少任一步歷史、基準不相容或截斷榜單無法證明零時，爆發力為 null（介面顯示「—」）。事件分群在沒有爆發力時退回現在分數。
- **固定基準**（`app/data/ranking-baseline.json`）：首版 all 為 111 家，分類名單一併凍結。選取凍結前至少 72 小時已成功取得非空列表、最近 3 小時仍成功且啟用的非 discovery 來源；記錄首次成功後的下一完整小時為 coverageFrom，所有成員開始後滿 24 小時為 validFrom。這只是收錄起點，不能證明中間沒有故障。新爬蟲不自動改名單或分母，未發稿成員也不移除；調整名單必須另版並重新檢查歷史，不能直接接線比較。API 公開基準版本、名單及可用起點。
- **歷史相容**：舊排行快照以保存的每媒體篇數重算同一基準的分子和分母，保留原快照不覆寫；未保存的 top-500 以外關鍵字無法恢復，所以舊榜仍可能漏詞且不能把缺值視為零。舊快照總文章數／活躍媒體數無法完整恢復時回 null。標籤頁與事件上方曲線則由文章資料重算固定名單的逐時分數，不受舊排行榜截斷影響；事件下方報導篇數仍涵蓋所有媒體。
- **事件**（`jobs/events-compute.ts`）：依爆發力排序的標籤做共現分群，取主要標籤與代表文章；與 6 小時內的事件串比對延續（`event_threads`）。某媒體（至少 8 篇）有 80% 以上文章都帶的標籤視為該站模板詞（青年日報的 國防部／國軍／空軍），只從該媒體的文章移除；只來自單一媒體且達 8 篇的標籤視為該站欄目／品牌詞（東網、Rti、盤中速報），不參與共現。包含較短標籤且有 30% 以上文章同時帶著它的較長標籤（名古屋亞運→亞運、天氣預報→天氣）併入較短標籤，no_equal 名單中的標籤不吸收他人；文章要同時帶有事件至少 2 個標籤才算該事件的文章；代表文章依所帶標籤的爆發力加總排序，先每家媒體一篇。`tools/events-compare.ts` 可在正式資料庫上離線重跑舊規則與現行規則，比較各事件標題的凝聚度。
- **藍綠**：依 `app/data/media-catalog.json` 的 blue／green 名單，以媒體為單位，不判斷單篇立場。

## 資料保留（每日 04:15，`jobs/retention-job.ts`）

- nearline 保留規則（0016 migration 已於 2026-10-05 套用）：正文／摘要依最後使用或取得時間，平常閒置 90 天後先封存 NAS、讀回校驗、寫入版本索引，才釋放本機快取；容量壓力時可縮成閒置 7 天，仍保護公開閱讀期。未配置／無法驗證 NAS 時保留本機內容。對外全文仍只提供刊登後 7 天，標題、網址、日期、標籤與来源保留。詳見 [nearline 快取與啟用狀態](content-nearline-cache.md)。
- 全文清除時一併清空該篇的相似度 sketch；`similarity_pairs`、`article_citations` 與 `article_sketches` 的列永久保留，供每日統計與單篇查詢（見 similarity.md）。
- 新版只刪除 source=own、未抓取、無標籤、超過 14 天、沒有正文／摘要／封存版本／來源對照的文章；legacy 歷史文章保留。
- 超過兩年的排行快照只留前 100 名。
- `crawl_runs`、`job_runs`、`source_probes`、`rejected_urls` 保留 30 天；Prometheus、Loki 各 30 天。
- 異地備份尚未設定。

## 開發

```sh
docker compose -f infra/compose.yml --env-file infra/.env up -d
cp .env.example .env   # 填 TAG_DB_URL
npm ci && npm run db:migrate
npm run worker         # 爬蟲與排程
npm run dev            # gateway
cd web && npm ci && npm run dev
npm test && npm run typecheck && npm run lint
```

整合測試（`app/test/integration.spec.ts`）需要 `TEST_DB_URL`，會清空資料表，拒絕指向正式資料庫。CI：`.github/workflows/ci.yml`。

## 部署與回退

1. commit（只加自己的檔案；其他 session 可能有未提交的修改）。
2. Gitleaks：`docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.30.1 git /repo --log-opts="-1"`。
3. push 到 `origin/main`。
4. `scripts/install-service.sh`：工作目錄必須乾淨且等於 `origin/main`；以 commit 建立固定 release（`~/.local/share/tag-analysis/releases/<commit>`）、建置 Next、切換並重啟服務。

其他 session 有未提交修改時，可在同一個 repository 建立乾淨的 detached worktree，從該 worktree 執行部署腳本。仍需先掃描並 push 該 commit，且部署版本必須等於 `origin/main`。腳本會檢查 standalone 目錄內每個媒體 PNG 是否與 manifest 的版本相符；切換失敗時會將網頁、爬蟲與 API 一起切回前一版本。

回退：重新部署前一個 commit（release 目錄保留）；`systemctl --user stop tag-worker.service` 停止所有排程，既有資料仍可讀。
