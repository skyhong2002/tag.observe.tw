# 新文易數

**同一件事，各家怎麼說。**

網站：[tag.observe.tw](https://tag.observe.tw) · [GitHub](https://github.com/skyhong2002/tag.observe.tw)

新文易數收集台灣與部分國際新聞來源的公開文章，將標籤、事件、議題、媒體與署名整理成可以互相比較的資料。網站的重點是把「同一件事」放在一起看：哪些標籤正在升溫、各家標題怎麼寫、事件如何延續，以及文章之間有哪些內文相似或明示引用關係。

## 網站功能

- **首頁**：焦點事件、關鍵字升溫榜、藍綠媒體標題對照、記者動態、新聞關係圖與最近更新的議題。
- **最新文章**（[`/article/`](https://tag.observe.tw/article/)）：依發布時間瀏覽近期收錄文章，也可以搜尋標題與標籤。
- **關鍵字排行**（[`/ranking/`](https://tag.observe.tw/ranking/)）：以過去 24 小時的收錄資料計算分數與爆發力，可依新聞、財經、科技及媒體分類篩選；頁面也提供升溫、首次收錄與相似稿比對等訊號。
- **事件表**（[`/event/`](https://tag.observe.tw/event/)）：將同時爆發的標籤分成事件，每小時保存快照。單一事件頁可看趨勢、報導時間線、各家標題與事件前後的延續關係。
- **議題與專題**（[`/topic/`](https://tag.observe.tw/topic/)、[`/feature/`](https://tag.observe.tw/feature/)）：整理媒體官方的議題頁、專題頁與新聞包，並連到本站已收錄的相關報導。
- **媒體來源**（[`/media/`](https://tag.observe.tw/media/)）：查看各家媒體的文章、標籤、收錄量、爬蟲狀態、流量比較與來源範圍。
- **新聞關係圖**（[`/similarity/`](https://tag.observe.tw/similarity/)）：比較跨媒體內文相似、共同署名與明示引用，呈現媒體及來源國家的關係圖、文章證據與每日統計。
- **記者**（[`/journalist/`](https://tag.observe.tw/journalist/)）：從公開署名整理人名與筆名，列出刊登媒體、文章數、常寫主題，以及同期間的跨媒體相似報導。
- **站內閱讀**：[`/media/<media>/`](https://tag.observe.tw/media/) 統一瀏覽媒體報導，[`/article/<id>/`](https://tag.observe.tw/article/) 閱讀仍在公開期限內的擷取正文；標示 ↗ 的連結才會離開本站回到原站。
- **即時看板**（[`/liveboard/`](https://tag.observe.tw/liveboard/)）：適合常駐螢幕，輪播新進文章、事件、各家標題對照、相似報導組與近期發稿量，亦可安裝成獨立 Web App。
- **網站觀測**（[`/observe/`](https://tag.observe.tw/observe/)）：公開每日瀏覽、來源管道、搜尋表現、熱門內容與近期使用體驗；頁面提供讓目前瀏覽器退出統計的選項。

## 資料取用

- **公開 API**：<https://tag.observe.tw/api/>。免金鑰、唯讀、CORS 開放，每個 IP 每分鐘最多 240 次請求；[OpenAPI JSON](https://tag.observe.tw/api/v1/openapi.json) 與 [API 文件](docs/api.md) 均由程式產生。
- **RSS**：新事件 <https://tag.observe.tw/feeds/events.xml>；單一標籤使用 `https://tag.observe.tw/feeds/tag/<標籤>.xml`（標籤需 URL 編碼）。
- **網站地圖**：<https://tag.observe.tw/sitemap.xml>。
- **Web App**：網站頁尾可以安裝一般網站 App；即時看板有自己的全螢幕 Web App。
- **討論與回報**：[Telegram @tag_observe_tw](https://t.me/tag_observe_tw)；程式碼、issue 與移除請求在 [GitHub](https://github.com/skyhong2002/tag.observe.tw)。

### API 快速開始

```sh
# 目前爆發力最高的 10 個新聞標籤
curl -s 'https://tag.observe.tw/api/v1/ranking?category=news&limit=10' \
  | jq '.entries[] | {tag, burst, count}'

# 搜尋近 3 天標題含「颱風」的文章
curl -sG 'https://tag.observe.tw/api/v1/articles' \
  --data-urlencode 'q=颱風' --data-urlencode 'hours=72' --data-urlencode 'limit=50'

# 讀取目前排名第一的事件及各家標題對照
id=$(curl -s 'https://tag.observe.tw/api/v1/events?limit=1' | jq -r '.events[0].threadId')
curl -s "https://tag.observe.tw/api/v1/events/threads/$id/coverage"
```

## 資料邊界

爬蟲每 9 分鐘探索新聞來源，每 30 分鐘啟動其他來源的一輪排程；來源的實際週期依設定為 9 到 60 分鐘。排行約每 10 分鐘更新，事件、議題與標籤統計每小時更新。列入來源名單不代表每次都能成功取得文章，個別網站的限制與故障會反映在媒體頁與爬蟲狀態中。

排行是依本站目前收錄文章和固定媒體基準計算的相對指標，不是各家媒體完整發稿量。藍、綠分類套用在媒體，不判斷單篇文章立場。

相似度表示兩篇可取得正文的直接文字比對結果；引用關係只在文章明確提及來源時建立。相似、刊登先後、共同署名或引用都不能單獨證明原始稿源、轉載授權或抄襲。文章正文公開閱讀期限為發布後 7 天，標題、日期、標籤、來源連結與統計資料另依各自保留規則保存。

網站觀測只使用彙整資料；「本站線上讀者」是同源 gateway 近期匿名回報的瀏覽器數，不保存使用者識別資料或歷史軌跡。可在 [`/observe/opt-out/`](https://tag.observe.tw/observe/opt-out/) 讓目前瀏覽器不送出 Google Analytics 與線上讀者回報。

## 架構

```
Cloudflare Tunnel → tag.observe.tw
  Fastify gateway      公開 API、RSS、sitemap、速率限制、舊網址轉址、圖片白名單
    └→ Next.js SSR     網頁（React、Tailwind、ECharts）
  BullMQ worker        爬蟲、內文與標籤、排行、事件、議題、相似度、分析與資料保留
  MariaDB + Redis      文章、索引、快取與工作佇列
  Prometheus + Loki + Grafana（infra/compose.yml）
```

主要程式碼位於 `app/src/`（gateway、API、爬蟲、worker、資料庫）與 `web/`（Next.js 網站）。API 端點的唯一來源是 `app/src/v1/openapi.ts`；`docs/api.md` 是由它產生的 Markdown 文件。

使用 Node.js 24（`>=24 <25`）、Fastify 5、Next.js 16、Drizzle ORM、BullMQ、MariaDB 11.4 與 Redis。

## 開發

需求：Node.js 24、Docker Compose，以及可連線的 MariaDB 和 Redis（本機開發可直接使用 `infra/compose.yml`）。

```sh
# 啟動 MariaDB、Redis 與觀測服務
docker compose -f infra/compose.yml --env-file infra/.env up -d

# 設定環境與安裝 gateway／worker 依賴
cp .env.example .env
npm ci
npm run db:migrate

# 分別在終端機啟動 worker、gateway 與網站
npm run worker
npm run dev
cd web && npm ci && npm run dev
```

常用檢查：

```sh
npm test
npm run typecheck
npm run lint
```

整合測試需要另設 `TEST_DB_URL`，且測試資料庫必須是可清空的 MariaDB；CI 設定見 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。完整的排程、環境變數、資料保留、部署與回退流程請看 [架構與維運](docs/architecture.md)。

## 文件

- [架構與維運](docs/architecture.md)：服務、排程、演算法、資料保留、開發、部署與回退
- [公開 API](docs/api.md)：端點、參數、快取與資料定義
- [爬蟲](docs/crawlers.md)：探索引擎、來源規格、成功條件與處理紀錄
- [相似度](docs/similarity.md)：正文保存、比對、引用證據、記者統計與媒體關係圖
- [網站觀測](docs/analytics.md)：GA4、Search Console、匿名讀者回報與退出統計
- [安全](docs/security.md)：來源、圖片、API 與服務安全規則
- [沿革](docs/history.md)：從 tag.analysis.tw 遷移至本站的決定與里程碑
- [文件索引](docs/README.md)：其他維運、來源稽核與資料保留文件

## 授權

程式碼以 [MIT](LICENSE) 授權。新聞標題、摘要、圖片與內文的著作權屬各媒體；本站提供收錄資訊、統計、原站連結，以及符合公開期限的擷取文字。
