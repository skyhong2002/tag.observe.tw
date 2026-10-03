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
| 其他媒體列表 `crawl-index hourly` | 每 60 分鐘 |
| 內文與標籤 `crawl-articles` | 每 19 分鐘 |
| 排行 `ranking` | 每 10 分鐘（以整點小時存 `ranking_snapshots`） |
| 事件分群 `events` | 每小時 :04、:34 |
| 議題 `topics` | 每小時 :50 |
| 標籤統計 `tag-stats` | 每小時 :53 |
| 爬蟲健康 `crawl-health` | 每 15 分鐘 |
| 資料保留 `retention` | 每日 04:15 |
| 停用來源探測 `source-probe` | 每週一 05:30 |

時間都可用環境變數覆寫（`CRAWL_NEWS_MINUTES`、`EVENTS_CRON`…）。

## 演算法

- **排行**（`jobs/ranking-compute.ts`，移植自舊站 index.php）：過去 24 小時，每篇文章的每個標籤 count +1；同一媒體第 n 篇乘 0.5^(n−1)。正規化分數 = 分數 ÷ 當時有發稿的媒體數。爆發力 = 與 3／6／12／24／48 小時前正規化分數的差，以 0.92／0.84／0.7／0.5／0.25 加權。
- **事件**（`jobs/events-compute.ts`）：依爆發力排序的標籤做共現分群，取主要標籤與代表文章；與 6 小時內的事件串比對延續（`event_threads`）。
- **藍綠**：依 `app/data/media-catalog.json` 的 blue／green 名單，以媒體為單位，不判斷單篇立場。

## 資料保留（每日 04:15，`jobs/retention-job.ts`）

- 文章 `description` 90 天後清空（標題、網址、標籤保留供排行）。
- 從未抓取且無標籤、超過 14 天的文章刪除。
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
