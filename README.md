# 新文易數

**同一件事，各家怎麼說。** 網站：[tag.observe.tw](https://tag.observe.tw)

追蹤台灣新聞媒體的標籤、事件與議題，並排比較各家標題。每 9 到 60 分鐘爬取約一百家媒體，整理成：

- **新聞總覽**：當下最重要的事件，以及政治事件藍綠媒體的標題對照
- **關鍵字排行**：過去 24 小時各媒體報導的標籤分數與爆發力，可依分類（新聞、財經、科技、藍營、綠營…）篩選
- **事件表**：同時爆發的標籤分群成事件，每小時封存，可看單一事件的趨勢與各家報導時間線
- **議題表**：各媒體新推出的專題頁，附站內相關報導
- **媒體**：每家媒體的收錄量與爬取狀態
- **新聞相似度**：`/similarity/` 比較跨媒體內文、署名與明示引用，呈現媒體及國外來源國家關係圖
- **站內閱讀**：`/media/<media>/` 統一瀏覽媒體報導與保存內文，`/article/<id>/` 閱讀文章；只有標示 ↗ 的原站連結會離開本站

## 資料取用

- **公開 API**：<https://tag.observe.tw/api/>（免金鑰、CORS 開放、每 IP 每分鐘 240 次；[OpenAPI 規格](https://tag.observe.tw/api/v1/openapi.json)、[Markdown 版](docs/api.md)）
- **RSS**：新聞事件 `https://tag.observe.tw/feeds/events.xml`；單一標籤 `https://tag.observe.tw/feeds/tag/<標籤>.xml`
- **Web App**：網站頁尾「安裝 Web App」

## 架構

```
Cloudflare Tunnel → tag.observe.tw
  Fastify gateway      公開 API、RSS、sitemap、舊網址轉址、圖片白名單
    └→ Next.js SSR     網頁（React、Tailwind、ECharts）
  Worker（BullMQ）      爬蟲、內文標籤、排行（每 10 分）、事件分群、議題、標籤統計、資料保留
  MariaDB、Redis、Prometheus、Loki、Grafana（infra/compose.yml）
```

Node.js 24（直接執行 TypeScript）、Fastify 5、Next.js 16、Drizzle ORM、BullMQ。

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

部署：commit → Gitleaks → push → `scripts/install-service.sh`（以 commit 建立固定版本並切換）。

## 文件

- [架構與維運](docs/architecture.md)：服務、排程、演算法、資料保留、部署與回退
- [公開 API](docs/api.md)
- [爬蟲](docs/crawlers.md)：引擎、來源規格與各來源的處理紀錄
- [內文與相似度](docs/similarity.md)：保存期限、比對方法、引用證據與各媒體實測
- [安全](docs/security.md)
- [沿革](docs/history.md)

## 授權

程式碼以 [MIT](LICENSE) 授權。新聞標題、圖片與內文的著作權屬各媒體；內文頁提供保留期間內已擷取的文字與原站連結。
