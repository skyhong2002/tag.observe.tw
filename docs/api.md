# 新文易數 API

台灣新聞媒體的標籤排行、事件分群、各家標題對照與議題追蹤資料，全部公開、免金鑰、唯讀。

本文件由 `tools/gen-api-docs.ts` 依 `app/src/v1/openapi.ts` 產生，請勿手改。網站上的版本：<https://tag.observe.tw/api/>；機器可讀規格：<https://tag.observe.tw/api/v1/openapi.json>；端點索引：<https://tag.observe.tw/api/v1>。

## 使用規則

- 基底網址 `https://tag.observe.tw`，所有端點都是 `GET`（也接受 `HEAD`），回傳 UTF-8 JSON。
- 不需要 API 金鑰。每個 IP 每分鐘最多 240 次 API 請求，超過回 `429`；回應帶 `x-ratelimit-limit`、`x-ratelimit-remaining`、`x-ratelimit-reset` 標頭。
- 允許跨網域（CORS `Access-Control-Allow-Origin: *`），瀏覽器前端可直接呼叫。
- 時間一律是 UTC 的 ISO 8601（例如 `2026-09-30T21:00:00.000Z`）；「一天」指台北時間（UTC+8）的日曆日。
- 回應帶 `cache-control`，資料本身每 10 分鐘（排行）到每小時（事件、議題）更新，請勿以高於此的頻率輪詢。
- 錯誤回 `{"error": "..."}`，搭配 HTTP 狀態碼：`400` 參數錯誤、`404` 找不到、`405` 非 GET、`429` 太頻繁、`5xx` 伺服器問題。
- 路徑參數（標籤、媒體代碼）請 URL 編碼，例如 `/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/articles`。路徑結尾不要加 `/`。
- `v1` 內只做向後相容的變更（新增欄位、新增端點）；移除或改名會先在本文件公告。
- 標題、圖片與內文著作權屬原媒體；本 API 提供標題、連結、統計及刊登 7 天內的擷取文字。使用資料請註明「資料來源：新文易數 tag.observe.tw」。
- 舊站 tag.analysis.tw 的 `/api/*.php` 在本站回 `410`，JSON 內 `replacement` 指向對應的 v1 端點。
- 不寫程式也能追：RSS `/feeds/events.xml`（新事件）與 `/feeds/tag/<標籤>.xml`（某標籤的最新報導，標籤需 URL 編碼）；全站網址清單在 `/sitemap.xml`。

## 快速開始

命令列（curl + jq）：

```sh
# 新聞媒體目前爆發力最高的 10 個標籤
curl -s 'https://tag.observe.tw/api/v1/ranking?category=news&limit=10' | jq '.entries[] | {tag, burst, count}'

# 過去三天標題含「颱風」的文章；有下一頁時把 nextCursor 放進 cursor
curl -s 'https://tag.observe.tw/api/v1/articles?q=%E9%A2%B1%E9%A2%A8&hours=72&limit=50' | jq -r '.nextCursor'
curl -s 'https://tag.observe.tw/api/v1/articles?q=%E9%A2%B1%E9%A2%A8&hours=72&limit=50&cursor=<nextCursor>'

# 現在排第一的事件，藍綠各家怎麼報
id=$(curl -s 'https://tag.observe.tw/api/v1/events?limit=1' | jq '.events[0].threadId')
curl -s "https://tag.observe.tw/api/v1/events/threads/$id/coverage" | jq '.camps, .blindspot'
```

JavaScript（瀏覽器或 Node 18+）：

```js
const res = await fetch('https://tag.observe.tw/api/v1/ranking?category=news&limit=10');
const { snapshot, entries } = await res.json();
for (const e of entries) console.log(e.position, e.tag, e.burst.toFixed(1));
```

Python：

```python
import requests

r = requests.get("https://tag.observe.tw/api/v1/articles", params={"q": "颱風", "hours": 72})
for a in r.json()["articles"]:
    print(a["publishedAt"], a["mediaTitle"], a["title"])
```

## 端點一覽

| 端點 | 說明 |
| --- | --- |
| [`GET /api/v1/similarity`](#api-v1-similarity) | 內文相似與明確引用關係 |
| [`GET /api/v1/journalists`](#api-v1-journalists) | 期間內具名記者一覽 |
| [`GET /api/v1/journalists/{name}`](#api-v1-journalists-name) | 單一記者的文章、刊登媒體與針對性相似比對 |
| [`GET /api/v1/articles/{id}/content`](#api-v1-articles-id-content) | 單篇內文（刊登 7 天內） |
| [`GET /api/v1/media/{media}/keywords`](#api-v1-media-media-keywords) | 媒體報導關鍵字 |
| [`GET /api/v1/media/{media}/content`](#api-v1-media-media-content) | 媒體內文庫列表 |
| [`GET /api/v1`](#api-v1) | API 索引 |
| [`GET /api/v1/openapi.json`](#api-v1-openapi-json) | OpenAPI 3.1 規格 |
| [`GET /api/v1/categories`](#api-v1-categories) | 排行分類 |
| [`GET /api/v1/ranking`](#api-v1-ranking) | 標籤排行（每 10 分鐘更新） |
| [`GET /api/v1/articles`](#api-v1-articles) | 文章搜尋 |
| [`GET /api/v1/tags/{tag}/articles`](#api-v1-tags-tag-articles) | 帶有某標籤的最新文章 |
| [`GET /api/v1/tags/{tag}/series`](#api-v1-tags-tag-series) | 標籤每小時的分數與文章數 |
| [`GET /api/v1/tags/{tag}/status`](#api-v1-tags-tag-status) | 標籤目前狀態 |
| [`GET /api/v1/tags/{tag}/stats`](#api-v1-tags-tag-stats) | 標籤長期統計 |
| [`GET /api/v1/events`](#api-v1-events) | 目前的事件排行（每小時） |
| [`GET /api/v1/events/threads`](#api-v1-events-threads) | 某一天的所有事件串 |
| [`GET /api/v1/events/threads/{id}`](#api-v1-events-threads-id) | 單一事件串 |
| [`GET /api/v1/events/threads/{id}/series`](#api-v1-events-threads-id-series) | 事件串的每小時趨勢 |
| [`GET /api/v1/events/threads/{id}/coverage`](#api-v1-events-threads-id-coverage) | 同一事件的各家標題對照 |
| [`GET /api/v1/topics`](#api-v1-topics) | 各媒體的議題／專題 |
| [`GET /api/v1/media`](#api-v1-media) | 所有媒體代碼與名稱 |
| [`GET /api/v1/media/{media}`](#api-v1-media-media) | 單一媒體最近的文章與熱門標籤 |
| [`GET /api/v1/media-traffic-comparison`](#api-v1-media-traffic-comparison) | 本站爬蟲跨月收錄量 |
| [`GET /api/v1/media-stats`](#api-v1-media-stats) | 各媒體收錄量與爬蟲狀態 |

## API 本身

<a id="api-v1"></a>

### `GET /api/v1`

**API 索引**

列出所有端點與文件位置。

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `name` | string |  |
| `version` | string |  |
| `docs` | string | 人看的文件 |
| `openapi` | string | OpenAPI 3.1 規格 |
| `endpoints` | object[] |  |
| `endpoints[].method` | string |  |
| `endpoints[].path` | string |  |
| `endpoints[].summary` | string |  |
| `endpoints[].example` | string |  |

快取：1 小時。

<a id="api-v1-openapi-json"></a>

### `GET /api/v1/openapi.json`

**OpenAPI 3.1 規格**

可匯入 Swagger UI、Postman、openapi-generator 等工具。

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/openapi.json'
```

快取：1 小時。

## 標籤排行與分類

<a id="api-v1-categories"></a>

### `GET /api/v1/categories`

**排行分類**

可用於 `category` 參數的分類，含 blue／green 兩個政治傾向分類。

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/categories'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `[].key` | string | 分類代碼 |
| `[].label` | string | 中文名稱 |
| `[].media` | integer | 分類內媒體數 |

<a id="api-v1-ranking"></a>

### `GET /api/v1/ranking`

**標籤排行（每 10 分鐘更新）**

過去 24 小時各媒體文章標籤的排行，每 10 分鐘重算一次、以整點小時存快照。`order=burst`（預設）依爆發力排序，`order=score` 依正規化分數排序。`at` 可取過去某個時間點的快照。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `category` | query | string | 排行分類，見 /api/v1/categories，預設 `all`，例：`news` |
| `order` | query | "burst" \| "score" | 排序：burst 爆發力／score 分數，預設 `burst`，例：`score` |
| `limit` | query | integer | 筆數，1–500，預設 `50`，例：`20` |
| `at` | query | string (ISO 時間) | 取這個時間（ISO 8601）以前最新的快照，例：`2026-09-30T12:00:00+08:00` |
| `trend` | query | "0" \| "1" | 1 表示附上每小時篇數與 24 小時移動平均；截至快照計算時間前的最後完整小時，例：`1` |
| `related` | query | "0" \| "1" | 1 表示附上每個標籤最常一起出現的標籤，例：`1` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/ranking?category=news&limit=20'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `snapshot` | object |  |
| `snapshot.id` | integer |  |
| `snapshot.category` | string |  |
| `snapshot.hourStart` | string (ISO 時間) | 快照所屬小時（UTC） |
| `snapshot.computedAt` | string (ISO 時間) | 計算時間 |
| `snapshot.weight` | number | 固定基準名單的媒體數 |
| `snapshot.basis` | object |  |
| `snapshot.basis.id` | string | 固定媒體名單版本 |
| `snapshot.basis.media` | string[] |  |
| `snapshot.basis.coverageFrom` | string (ISO 時間) | 所有基準來源開始收錄後的第一個完整小時 |
| `snapshot.basis.validFrom` | string (ISO 時間) | 收錄開始後滿 24 小時；更早的移動平均及分數為 null |
| `snapshot.available` | boolean | 是否已滿足基準的 24 小時收錄範圍 |
| `snapshot.articleCount` | integer \| null | 視窗內基準媒體文章數；舊快照無法完整重建時為 null |
| `snapshot.mediaCount` | integer \| null | 視窗內基準媒體中有發文的家數；舊快照為 null |
| `snapshot.historyAvailable` | integer[] | 有歷史快照可比較的小時數 |
| `order` | "burst" \| "score" |  |
| `entries` | object[] |  |
| `entries[].rank` | integer | 依原始分數的名次 |
| `entries[].position` | integer | 在本次回應排序中的位置（從 1 起） |
| `entries[].tag` | string | 標籤 |
| `entries[].score` | number | 原始分數：每篇文章 +1，同一媒體的第 2、3… 篇遞減為 0.5、0.25… |
| `entries[].count` | integer | 過去 24 小時帶這個標籤的文章數 |
| `entries[].media` | {鍵: integer} | 各媒體的文章數 |
| `entries[].normalized` | number | 原始分數 ÷ 固定基準媒體數 × 50 |
| `entries[].burst` | number \| null | 爆發力：與同一基準 3/6/12/24/48 小時前分數比較的加權差；缺值、舊榜截斷或基準不相容為 null |
| `entries[].history` | {鍵: number \| null} | N 小時前的正規化分數（鍵為 3、6、12、24、48；沒有可比較資料為 null） |
| `entries[].rank24h` | integer \| null | 24 小時前依原始分數的名次；沒有可比較快照、基準不同或當時不在榜上為 null |
| `entries[].new` | boolean | 24 小時前的完整快照中沒有這個標籤 |
| `entries[].related` | object[] | related=1 時回傳：同一視窗、同一基準媒體中最常與這個標籤同時出現的標籤，最多 5 個，依共同文章數排序 |
| `entries[].related[].tag` | string | 一起出現的標籤 |
| `entries[].related[].count` | integer | 視窗內同時帶兩個標籤的文章數 |
| `entries[].related[].share` | number | 佔這個標籤文章數的比例（0–1） |
| `entries[].trend` | object[] | trend=1 時回傳 49 個等距小時點，涵蓋 48 小時變化 |
| `entries[].trend[].t` | string (ISO 時間) |  |
| `entries[].trend[].hourlyCount` | integer \| null | 該完整小時收錄篇數 |
| `entries[].trend[].average24h` | number \| null | 當小時及前 23 小時篇數總和 ÷ 24（篇／小時）；歷史不足為 null |
| `entries[].trend[].score` | number \| null | 固定基準 24 小時分數 |
| `entries[].trend[].count` | integer \| null | 固定基準 24 小時累計篇數 |

錯誤：`400` `at` 格式錯誤；`404` 未知分類，或該時間以前沒有快照。

## 文章搜尋

<a id="api-v1-similarity"></a>

### `GET /api/v1/similarity`

**內文相似與明確引用關係**

僅比較可用內文，排除「內容」聯播來源。取期間內最新最多 10000 篇，最多回傳 2000 對；sample 揭露截斷。相似連線無方向；citation 由刊登媒體指向明確提及來源，並不保證最初作者。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `hours` | query | integer | 回溯小時，1–168，預設 `48` |
| `threshold` | query | number | 最低 Dice 相似度，0.5–1，預設 `0.65` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/similarity'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `generatedAt` | string (ISO 時間) |  |
| `hours` | integer |  |
| `threshold` | number |  |
| `method` | string |  |
| `coverage` | object[] |  |
| `coverage[].media` | string |  |
| `coverage[].name` | string |  |
| `coverage[].total` | integer |  |
| `coverage[].fetched` | integer |  |
| `coverage[].usable` | integer |  |
| `coverage[].withAuthors` | integer |  |
| `coverage[].missing` | integer |  |
| `coverage[].pending` | integer |  |
| `coverage[].enabled` | boolean |  |
| `coverage[].excludedFromStatistics` | boolean |  |
| `sample` | object |  |
| `sample.available` | integer |  |
| `sample.analyzed` | integer |  |
| `sample.limit` | integer |  |
| `sample.truncated` | boolean |  |
| `sample.pairLimit` | integer |  |
| `sample.pairsTruncated` | boolean |  |
| `sample.from` | string (ISO 時間) \| null | 樣本中最早的刊登時間；截斷時早於此的文章不在樣本內 |
| `pairs` | object[] |  |
| `pairs[].id` | string |  |
| `pairs[].a` | object |  |
| `pairs[].a.id` | integer |  |
| `pairs[].a.media` | string |  |
| `pairs[].a.mediaTitle` | string |  |
| `pairs[].a.country` | string |  |
| `pairs[].a.countryCode` | string |  |
| `pairs[].a.title` | string |  |
| `pairs[].a.url` | string |  |
| `pairs[].a.publishedAt` | string (ISO 時間) |  |
| `pairs[].a.authors` | string[] |  |
| `pairs[].a.bodyLength` | integer |  |
| `pairs[].a.attributions` | object[] |  |
| `pairs[].a.attributions[].media` | string |  |
| `pairs[].a.attributions[].name` | string |  |
| `pairs[].a.attributions[].country` | string |  |
| `pairs[].a.attributions[].countryCode` | string |  |
| `pairs[].a.attributions[].evidence` | string |  |
| `pairs[].a.attributions[].kind` | "explicit" |  |
| `pairs[].b` | object |  |
| `pairs[].b.id` | integer |  |
| `pairs[].b.media` | string |  |
| `pairs[].b.mediaTitle` | string |  |
| `pairs[].b.country` | string |  |
| `pairs[].b.countryCode` | string |  |
| `pairs[].b.title` | string |  |
| `pairs[].b.url` | string |  |
| `pairs[].b.publishedAt` | string (ISO 時間) |  |
| `pairs[].b.authors` | string[] |  |
| `pairs[].b.bodyLength` | integer |  |
| `pairs[].b.attributions` | object[] |  |
| `pairs[].b.attributions[].media` | string |  |
| `pairs[].b.attributions[].name` | string |  |
| `pairs[].b.attributions[].country` | string |  |
| `pairs[].b.attributions[].countryCode` | string |  |
| `pairs[].b.attributions[].evidence` | string |  |
| `pairs[].b.attributions[].kind` | "explicit" |  |
| `pairs[].score` | number | 正規化內文五字片段的 Dice 相似度 |
| `pairs[].containment` | number | 共同片段占較短文章片段的比例 |
| `pairs[].sharedShingles` | integer |  |
| `pairs[].kind` | "identical" \| "high" |  |
| `pairs[].evidence` | string | 最多 100 字的連續相同片段 |
| `citations` | object[] |  |
| `citations[].article` | object |  |
| `citations[].article.id` | integer |  |
| `citations[].article.media` | string |  |
| `citations[].article.mediaTitle` | string |  |
| `citations[].article.country` | string |  |
| `citations[].article.countryCode` | string |  |
| `citations[].article.title` | string |  |
| `citations[].article.url` | string |  |
| `citations[].article.publishedAt` | string (ISO 時間) |  |
| `citations[].article.authors` | string[] |  |
| `citations[].article.bodyLength` | integer |  |
| `citations[].article.attributions` | object[] |  |
| `citations[].article.attributions[].media` | string |  |
| `citations[].article.attributions[].name` | string |  |
| `citations[].article.attributions[].country` | string |  |
| `citations[].article.attributions[].countryCode` | string |  |
| `citations[].article.attributions[].evidence` | string |  |
| `citations[].article.attributions[].kind` | "explicit" |  |
| `citations[].source` | object |  |
| `citations[].source.media` | string |  |
| `citations[].source.name` | string |  |
| `citations[].source.country` | string |  |
| `citations[].source.countryCode` | string |  |
| `citations[].source.evidence` | string |  |
| `citations[].source.kind` | "explicit" |  |
| `nodes` | object[] |  |
| `nodes[].id` | string |  |
| `nodes[].name` | string |  |
| `nodes[].country` | string |  |
| `nodes[].countryCode` | string |  |
| `nodes[].articles` | integer |  |
| `nodes[].external` | boolean |  |
| `edges` | object[] |  |
| `edges[].source` | string |  |
| `edges[].target` | string |  |
| `edges[].kind` | "similarity" \| "citation" |  |
| `edges[].count` | integer |  |
| `edges[].score` | number \| null |  |

錯誤：`400` 參數無效。

快取：1 分鐘。

<a id="api-v1-articles-id-content"></a>

### `GET /api/v1/articles/{id}/content`

**單篇內文（刊登 7 天內）**

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `id` | 路徑 | integer | 文章 id，例：`1` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/articles/1/content'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `article` | object |  |
| `article.id` | integer |  |
| `article.media` | string |  |
| `article.mediaTitle` | string |  |
| `article.title` | string |  |
| `article.url` | string |  |
| `article.image` | string \| null |  |
| `article.publishedAt` | string (ISO 時間) | 排序用時間；若另有 publishedDate，刊期只有日精度，不代表確知時分 |
| `article.publishedDate` | string | 經官方證據核實的日期；原站未公開發刊時分 |
| `article.publishedDatePrecision` | "day" |  |
| `article.tags` | string[] |  |
| `article.description` | string \| null |  |
| `article.authors` | string[] |  |
| `article.publisher` | object |  |
| `article.publisher.media` | string |  |
| `article.publisher.name` | string |  |
| `article.publisher.country` | string |  |
| `article.publisher.countryCode` | string |  |
| `article.discoverySources` | object[] |  |
| `article.discoverySources[].media` | string | 文章發現來源代碼，非刊登媒體 |
| `article.discoverySources[].title` | string | 發現來源名稱 |
| `article.discoverySources[].url` | string | 實際發現文章的公開頁面網址 |
| `article.discoverySources[].discoveredAt` | string (ISO 時間) | 首次經此來源發現文章的時間，不取代刊登時間 |
| `content` | object |  |
| `content.status` | "ok" \| "short" \| "missing" \| "blocked" \| "error" \| "not_fetched" \| "expired" |  |
| `content.body` | string \| null | 刊登 7 天內已抓取的文字；之後為 null。不保證原站目前仍存在 |
| `content.chars` | integer |  |
| `content.source` | string \| null | 擷取方式 |
| `content.fetchedAt` | string (ISO 時間) \| null |  |
| `content.expiresAt` | string (ISO 時間) \| null | 站內提供正文的期限：刊登後 7 天。之後 body 為 null、chars 為 0、status 為 expired。未取得正文時為 null |
| `content.attributions` | object[] |  |
| `content.attributions[].media` | string |  |
| `content.attributions[].name` | string |  |
| `content.attributions[].country` | string |  |
| `content.attributions[].countryCode` | string |  |
| `content.attributions[].evidence` | string |  |
| `content.attributions[].kind` | "explicit" |  |

錯誤：`400` 文章 id 無效；`404` 文章不存在。

快取：1 分鐘。

<a id="api-v1-articles"></a>

### `GET /api/v1/articles`

**文章搜尋**

依時間窗、關鍵字（標題、摘要或標籤）、媒體、分類、政治傾向、標籤篩選所有爬到的文章，新到舊排序。本站不儲存內文，關鍵字只比對標題、摘要與標籤。給 `facets=1` 會另外回傳整個查詢（不限本頁）依媒體與政治傾向的篇數。時間窗預設為過去 24 小時，最長 31 天。還有下一頁時 `nextCursor` 不為 null，把它原樣放進 `cursor` 參數（其他參數不變）取下一頁。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `q` | query | string | 標題或摘要包含這段文字，或文章帶有完全相同的標籤（最多 60 字），例：`颱風` |
| `media` | query | string | 媒體代碼，逗號分隔（最多 50 個），例：`cna,pts` |
| `category` | query | string | 排行分類（例如 news、blue、green），與 media 同時給則取交集，例：`green` |
| `camp` | query | "blue" \| "green" \| "other" | 政治傾向：blue、green 或 other（不在藍綠名單的媒體），例：`blue` |
| `tag` | query | string | 文章帶有這個標籤（完全相符），例：`賴清德` |
| `since` | query | string | 起始時間（含）：ISO 8601，或 YYYY-MM-DD 表示台北時間當天 0 點，例：`2026-09-30` |
| `until` | query | string | 結束時間（不含），格式同 since；預設現在，例：`2026-10-01` |
| `hours` | query | number | 沒給 since 時，從 until 往前幾小時，預設 `24`，例：`72` |
| `limit` | query | integer | 每頁筆數，1–200，預設 `50`，例：`20` |
| `cursor` | query | string | 上一頁回應的 nextCursor |
| `facets` | query | "0" \| "1" | 1 表示回傳 facets（整個查詢的總數、各政治傾向與各媒體篇數），例：`1` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/articles?q=%E9%A2%B1%E9%A2%A8&hours=72&limit=20'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `query` | object |  |
| `query.q` | string \| null |  |
| `query.media` | string[] \| null |  |
| `query.category` | string \| null |  |
| `query.tag` | string \| null |  |
| `query.camp` | "blue" \| "green" \| "other" \| null | 政治傾向分組：blue 藍營傾向、green 綠營傾向、other 其他（依 app/data/media-catalog.json） |
| `query.since` | string (ISO 時間) |  |
| `query.until` | string (ISO 時間) |  |
| `query.limit` | integer |  |
| `count` | integer | 本頁筆數 |
| `facets` | object | 只有 facets=1 時出現 |
| `facets.total` | integer | 整個查詢的篇數 |
| `facets.camps` | object | 各政治傾向篇數 |
| `facets.camps.blue` | integer |  |
| `facets.camps.green` | integer |  |
| `facets.camps.other` | integer |  |
| `facets.media` | object[] | 各媒體篇數，多到少 |
| `facets.media[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `facets.media[].count` | integer |  |
| `nextCursor` | string \| null | 下一頁的 cursor；沒有下一頁為 null |
| `articles` | object[] |  |
| `articles[].id` | integer |  |
| `articles[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `articles[].mediaTitle` | string | 媒體名稱 |
| `articles[].camp` | "blue" \| "green" \| "other" | 政治傾向分組：blue 藍營傾向、green 綠營傾向、other 其他（依 app/data/media-catalog.json） |
| `articles[].title` | string |  |
| `articles[].description` | string \| null | 摘要（媒體提供的 description） |
| `articles[].url` | string |  |
| `articles[].image` | string \| null |  |
| `articles[].publishedAt` | string (ISO 時間) | 發布時間（UTC） |
| `articles[].datePending` | boolean | true 表示來源沒有提供發布時間、內文尚未抓取，publishedAt 暫為首次看到的時間 |
| `articles[].section` | string \| null | 媒體自己的分類／欄目 |
| `articles[].tags` | string[] |  |

錯誤：`400` 參數錯誤（未知媒體、分類或政治傾向、時間格式、時間窗超過上限、cursor 無效）。

## 記者署名與跨媒體相似

<a id="api-v1-journalists"></a>

### `GET /api/v1/journalists`

**期間內具名記者一覽**

從文章署名整理出人名或筆名（排除媒體、部門、通訊社、職稱、電頭與責任編輯），列出各自的刊登媒體與篇數。相似統計取自同期間、同門檻的 similarity 樣本；樣本有篇數上限，inSample 與 sample.from 揭露實際涵蓋。同名不同人不會分開；較晚刊登只是閱讀線索，不是抄襲判定。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `hours` | query | integer | 回溯小時，1–168，預設 `48` |
| `threshold` | query | number | 最低 Dice 相似度，0.5–1，預設 `0.65` |
| `limit` | query | integer | 最多回傳人數（依篇數排序），1–3000，預設 `500` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/journalists?hours=48&limit=50'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `generatedAt` | string (ISO 時間) |  |
| `hours` | integer |  |
| `threshold` | number |  |
| `method` | string |  |
| `sample` | object |  |
| `sample.available` | integer |  |
| `sample.analyzed` | integer |  |
| `sample.limit` | integer |  |
| `sample.truncated` | boolean |  |
| `sample.pairLimit` | integer |  |
| `sample.pairsTruncated` | boolean |  |
| `sample.from` | string (ISO 時間) \| null |  |
| `totals` | object |  |
| `totals.journalists` | integer | 具名人數 |
| `totals.articles` | integer | 有人名署名的文章數 |
| `totals.credited` | integer | 有任何署名欄位的文章數 |
| `limit` | integer |  |
| `journalists` | object[] |  |
| `journalists[].name` | string | 署名整理出的人名或筆名 |
| `journalists[].articles` | integer | 期間內署名文章數 |
| `journalists[].media` | object[] | 刊登媒體，篇數多者在前 |
| `journalists[].media[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `journalists[].media[].name` | string | 媒體名稱 |
| `journalists[].media[].count` | integer | 期間內署名篇數 |
| `journalists[].withBody` | integer | 有可比對正文的篇數 |
| `journalists[].cited` | integer | 內文明示引用其他媒體的篇數 |
| `journalists[].latest` | string (ISO 時間) | 最近一篇刊登時間 |
| `journalists[].inSample` | integer | 落在相似度樣本內的可比對篇數 |
| `journalists[].similar` | object |  |
| `journalists[].similar.pairs` | integer | 至少一端是此記者文章的相似配對數 |
| `journalists[].similar.articles` | integer | 有相似配對的自家文章數（去重） |
| `journalists[].similar.later` | integer | 自家文章比對方晚至少一分鐘刊登的配對數；不含同署名跨站 |
| `journalists[].similar.earlier` | integer | 自家文章比對方早至少一分鐘刊登的配對數；不含同署名跨站 |
| `journalists[].similar.sameAuthor` | integer | 對方文章也署同一名字的配對數（同一人跨媒體刊登） |
| `journalists[].similar.identical` | integer | 正規化內文完全相同的配對數 |

錯誤：`400` 參數無效。

快取：2 分鐘。

<a id="api-v1-journalists-name"></a>

### `GET /api/v1/journalists/{name}`

**單一記者的文章、刊登媒體與針對性相似比對**

列出期間內署此名字的文章（以站方署名欄位比對，再以同一套人名整理規則確認）。相似比對只拿此人有正文的文章（最多 100 篇）與前後 48 小時內、至少共用一個標籤的他站文章（每篇最多 40 篇候選、合計 3000 篇）比對，排除「內容」聯播來源；沒有標籤的文章不會有候選。同署名的跨站版本另計為 sameAuthor。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `name` | 路徑 | string | 人名或筆名（2–40 字），例：`彭巧蓁` |
| `hours` | query | integer | 回溯小時，1–720，預設 `168` |
| `threshold` | query | number | 最低 Dice 相似度，0.5–1，預設 `0.65` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/journalists/%E5%BD%AD%E5%B7%A7%E8%93%81?hours=168'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `name` | string |  |
| `generatedAt` | string (ISO 時間) |  |
| `hours` | integer |  |
| `threshold` | number |  |
| `method` | string |  |
| `stats` | object |  |
| `stats.articles` | integer |  |
| `stats.withBody` | integer |  |
| `stats.averageChars` | integer \| null | 可讀正文的平均字元數 |
| `stats.cited` | integer |  |
| `stats.tags` | object[] | 最多 30 個常見標籤 |
| `stats.tags[].tag` | string |  |
| `stats.tags[].count` | integer |  |
| `stats.similar` | object |  |
| `stats.similar.pairs` | integer | 至少一端是此記者文章的相似配對數 |
| `stats.similar.articles` | integer | 有相似配對的自家文章數（去重） |
| `stats.similar.later` | integer | 自家文章比對方晚至少一分鐘刊登的配對數；不含同署名跨站 |
| `stats.similar.earlier` | integer | 自家文章比對方早至少一分鐘刊登的配對數；不含同署名跨站 |
| `stats.similar.sameAuthor` | integer | 對方文章也署同一名字的配對數（同一人跨媒體刊登） |
| `stats.similar.identical` | integer | 正規化內文完全相同的配對數 |
| `media` | object[] |  |
| `media[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `media[].name` | string | 媒體名稱 |
| `media[].count` | integer | 期間內署名篇數 |
| `articles` | object[] | 期間內署名文章，最新在前，最多 1000 篇 |
| `articles[].id` | integer |  |
| `articles[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `articles[].mediaTitle` | string |  |
| `articles[].title` | string |  |
| `articles[].url` | string |  |
| `articles[].image` | string \| null |  |
| `articles[].publishedAt` | string (ISO 時間) |  |
| `articles[].tags` | string[] |  |
| `articles[].bodyStatus` | "ok" \| "short" \| "missing" \| "blocked" \| "error" \| "not_fetched" \| "expired" |  |
| `articles[].bodyChars` | integer | 站內可讀的正文字元數；超過刊登後 7 天為 0 |
| `articles[].byline` | string[] | 站方原始署名欄位，未經整理 |
| `articles[].coauthors` | string[] | 同篇其他具名作者 |
| `articles[].attributions` | object[] | 內文明示引用的媒體 |
| `articles[].attributions[].media` | string |  |
| `articles[].attributions[].name` | string |  |
| `articles[].attributions[].country` | string |  |
| `articles[].attributions[].countryCode` | string |  |
| `articles[].attributions[].evidence` | string |  |
| `articles[].attributions[].kind` | "explicit" |  |
| `articles[].matches` | integer | 這篇在針對性比對中找到的他站相似文章數 |
| `articles[].compared` | boolean | 是否納入針對性比對（需有可用正文，且不超過比對上限） |
| `pairs` | object[] | 相似度高者在前 |
| `pairs[].own` | object |  |
| `pairs[].own.id` | integer |  |
| `pairs[].own.media` | string |  |
| `pairs[].own.mediaTitle` | string |  |
| `pairs[].own.country` | string |  |
| `pairs[].own.countryCode` | string |  |
| `pairs[].own.title` | string |  |
| `pairs[].own.url` | string |  |
| `pairs[].own.publishedAt` | string (ISO 時間) |  |
| `pairs[].own.authors` | string[] |  |
| `pairs[].own.bodyLength` | integer |  |
| `pairs[].own.attributions` | object[] |  |
| `pairs[].own.attributions[].media` | string |  |
| `pairs[].own.attributions[].name` | string |  |
| `pairs[].own.attributions[].country` | string |  |
| `pairs[].own.attributions[].countryCode` | string |  |
| `pairs[].own.attributions[].evidence` | string |  |
| `pairs[].own.attributions[].kind` | "explicit" |  |
| `pairs[].other` | object |  |
| `pairs[].other.id` | integer |  |
| `pairs[].other.media` | string |  |
| `pairs[].other.mediaTitle` | string |  |
| `pairs[].other.country` | string |  |
| `pairs[].other.countryCode` | string |  |
| `pairs[].other.title` | string |  |
| `pairs[].other.url` | string |  |
| `pairs[].other.publishedAt` | string (ISO 時間) |  |
| `pairs[].other.authors` | string[] |  |
| `pairs[].other.bodyLength` | integer |  |
| `pairs[].other.attributions` | object[] |  |
| `pairs[].other.attributions[].media` | string |  |
| `pairs[].other.attributions[].name` | string |  |
| `pairs[].other.attributions[].country` | string |  |
| `pairs[].other.attributions[].countryCode` | string |  |
| `pairs[].other.attributions[].evidence` | string |  |
| `pairs[].other.attributions[].kind` | "explicit" |  |
| `pairs[].score` | number | 正規化內文五字片段的 Dice 相似度 |
| `pairs[].containment` | number |  |
| `pairs[].sharedShingles` | integer |  |
| `pairs[].kind` | "identical" \| "high" |  |
| `pairs[].evidence` | string | 最多 100 字的連續相同片段 |
| `pairs[].minutes` | integer | 對方刊登時間減自家刊登時間（分鐘）；正值表示自家較早 |
| `pairs[].relation` | "later" \| "earlier" \| "same" | later 自家較晚、earlier 自家較早、same 一分鐘內 |
| `pairs[].sameAuthor` | boolean | 對方文章署同一名字 |
| `pairs[].ownCitesOther` | boolean | 自家文章明示引用對方媒體 |
| `pairs[].otherCitesOwn` | boolean | 對方文章明示引用自家媒體 |
| `sample` | object |  |
| `sample.focus` | integer | 納入比對的自家文章數 |
| `sample.focusLimit` | integer |  |
| `sample.focusTruncated` | boolean |  |
| `sample.candidates` | integer | 依共同標籤挑出的他站候選文章數 |
| `sample.candidateLimit` | integer |  |
| `sample.candidatesTruncated` | boolean |  |

錯誤：`400` 參數無效；`404` 期間內沒有文章署此名字。

快取：5 分鐘。

## 單一標籤

<a id="api-v1-tags-tag-articles"></a>

### `GET /api/v1/tags/{tag}/articles`

**帶有某標籤的最新文章**

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `tag` | 路徑 | string | 標籤（URL 編碼），例：`賴清德` |
| `hours` | query | integer | 往前幾小時，1–336，預設 `48`，例：`24` |
| `limit` | query | integer | 筆數，1–200，預設 `60`，例：`20` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/articles?limit=20'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `tag` | string |  |
| `hours` | integer |  |
| `articles` | object[] |  |
| `articles[].id` | integer | 文章 id |
| `articles[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `articles[].title` | string | 標題 |
| `articles[].url` | string | 原文網址 |
| `articles[].image` | string \| null | 代表圖網址 |
| `articles[].publishedAt` | string (ISO 時間) | 發布時間（UTC） |
| `articles[].tags` | string[] | 文章標籤 |
| `articles[].mediaTitle` | string | 媒體名稱 |

<a id="api-v1-tags-tag-series"></a>

### `GET /api/v1/tags/{tag}/series`

**標籤每小時的分數與文章數**

每個完整小時一點。hourlyCount 從收錄文章按發布時間統計，average24h 為當小時及前 23 小時篇數總和 ÷ 24，無報導小時以 0 計，並讀取顯示範圍前 23 小時。整條曲線只使用 basis 的固定媒體，score/count 也從文章重算 24 小時加權分數／累計篇數。rank 是該小時排行快照中依原始分數的名次（同一分類）；該小時沒有快照或未進入儲存的榜單時為 null。coverageFrom 前的篇數、validFrom 前的平均與分數均為 null；收錄開始後的空小時以零計。歷史篇數反映目前資料庫收錄，可包含後來補抓的文章。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `tag` | 路徑 | string | 標籤（URL 編碼），例：`賴清德` |
| `category` | query | string | 排行分類，見 /api/v1/categories，預設 `all`，例：`news` |
| `hours` | query | integer | 往前幾小時，1–336，預設 `72`，例：`168` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/series?hours=168'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `tag` | string |  |
| `category` | string |  |
| `hours` | integer |  |
| `basis` | object |  |
| `basis.id` | string | 固定媒體名單版本 |
| `basis.media` | string[] |  |
| `basis.coverageFrom` | string (ISO 時間) | 所有基準來源開始收錄後的第一個完整小時 |
| `basis.validFrom` | string (ISO 時間) | 收錄開始後滿 24 小時；更早的移動平均及分數為 null |
| `points` | object[] |  |
| `points[].t` | string (ISO 時間) | 完整小時起點（UTC） |
| `points[].score` | number \| null | 24 小時正規化分數 |
| `points[].count` | integer \| null | 固定基準 24 小時累計篇數，非單小時篇數 |
| `points[].rank` | integer \| null | 該小時快照中依原始分數的名次；沒有快照或未入榜為 null |
| `points[].hourlyCount` | integer \| null | 該小時收錄篇數；收錄開始前為 null |
| `points[].average24h` | number \| null | 24 小時移動平均（篇／小時）；歷史不足為 null |

錯誤：`404` 未知分類。

<a id="api-v1-tags-tag-status"></a>

### `GET /api/v1/tags/{tag}/status`

**標籤目前狀態**

關鍵字頁的摘要：這個標籤在新聞媒體排行榜上的名次、分數、爆發力、24 小時變動與報導媒體家數（不在榜上為 null）、最常一起出現的標籤、最近 72 小時含這個標籤的事件串，以及長期統計的首次上榜與高峰。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `tag` | 路徑 | string | 標籤（URL 編碼），例：`賴清德` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/status'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `tag` | string |  |
| `ranking` | object \| null |  |
| `ranking.category` | string | 排行分類；目前固定為 news |
| `ranking.hourStart` | string (ISO 時間) | 快照所屬小時 |
| `ranking.position` | integer | 依爆發力的名次 |
| `ranking.rank` | integer | 依原始分數的名次 |
| `ranking.normalized` | number | 正規化分數 |
| `ranking.burst` | number \| null | 爆發力 |
| `ranking.count` | integer | 過去 24 小時文章數 |
| `ranking.mediaCount` | integer | 報導的基準媒體家數 |
| `ranking.basisMediaCount` | integer | 基準媒體總數 |
| `ranking.rank24h` | integer \| null | 24 小時前依分數的名次 |
| `ranking.new` | boolean | 24 小時前不在完整榜單上 |
| `related` | object[] | 最多 8 個，依共同文章數排序 |
| `related[].tag` | string |  |
| `related[].count` | integer | 共同文章數 |
| `related[].share` | number | 佔這個標籤文章數的比例（0–1） |
| `threads` | object[] | 最近 72 小時內含這個標籤的 news 事件串，最多 6 個，最近活動的在前 |
| `threads[].id` | integer | 事件串 id；頁面為 /eve/{id}/ |
| `threads[].maxTag` | string \| null | 事件串的代表標籤 |
| `threads[].majorTags` | string[] |  |
| `threads[].firstTime` | string (ISO 時間) |  |
| `threads[].lastTime` | string (ISO 時間) |  |
| `threads[].hours` | integer | 出現在事件榜的小時數 |
| `threads[].maxScore` | number | 最高分 |
| `history` | object \| null | news 分類的長期統計 |
| `history.level` | integer | 2 或 3；優先回傳 3 |
| `history.firstHour` | string (ISO 時間) | 首次上榜小時 |
| `history.lastHour` | string (ISO 時間) | 最近上榜小時 |
| `history.hoursCount` | integer | 上榜小時數 |
| `history.maxHour` | string (ISO 時間) | 文章數最多的小時 |
| `history.maxCount` | integer | 該小時文章數 |

<a id="api-v1-tags-tag-stats"></a>

### `GET /api/v1/tags/{tag}/stats`

**標籤長期統計**

這個標籤在各分類第一次／最後一次上榜的小時、上榜小時數與最高峰。level 2：至少 2 家媒體各提到 2 次以上；level 3：另需至少 3 家媒體、其中一家 3 次以上（news 分類的門檻，其他分類較寬）。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `tag` | 路徑 | string | 標籤（URL 編碼），例：`賴清德` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/stats'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `tag` | string |  |
| `stats` | object[] |  |
| `stats[].category` | string |  |
| `stats[].level` | integer |  |
| `stats[].firstHour` | string (ISO 時間) |  |
| `stats[].lastHour` | string (ISO 時間) |  |
| `stats[].hoursCount` | integer | 上榜小時數 |
| `stats[].maxHour` | string (ISO 時間) | 文章數最多的小時 |
| `stats[].maxCount` | integer | 該小時文章數 |

## 事件（同一件事，各家怎麼說）

<a id="api-v1-events"></a>

### `GET /api/v1/events`

**目前的事件排行（每小時）**

把同時爆發的標籤分群成「事件」，每小時 :04 與 :34 重算。`prev`／`next`／`dayHours` 可用於翻閱歷史小時（放進 `at`）。`stale` 為 true 表示最新快照超過 3 小時未更新。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `limit` | query | integer | 事件數，1–30，預設 `30`，例：`10` |
| `at` | query | string (ISO 時間) | 取這個時間（ISO 8601）以前最新的一小時，例：`2026-09-30T12:00:00Z` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/events?limit=10'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `hour` | string (ISO 時間) | 快照小時（UTC） |
| `builtAt` | string (ISO 時間) |  |
| `stale` | boolean |  |
| `prev` | string (ISO 時間) \| null | 上一個有快照的小時 |
| `next` | string (ISO 時間) \| null | 下一個有快照的小時；最新時為 null |
| `dayHours` | string (ISO 時間)[] | 同一台北日內所有有快照的小時 |
| `dayStats` | object[] | 同一台北日內每個快照小時的概況 |
| `dayStats[].hour` | string (ISO 時間) |  |
| `dayStats[].top` | number | 該小時第 1 名的爆發力 |
| `dayStats[].count` | integer | 該小時事件數 |
| `baseline` | object | 各陣營的整體基準，用來判斷單一事件的藍綠比例是否異常；其他只計排行榜用的新聞媒體 |
| `baseline.outlets` | object | 事件窗口（過去 24 小時）內有發稿的媒體家數 |
| `baseline.outlets.blue` | integer |  |
| `baseline.outlets.green` | integer |  |
| `baseline.outlets.other` | integer |  |
| `baseline.articles` | object | 同窗口內各陣營文章數 |
| `baseline.articles.blue` | integer |  |
| `baseline.articles.green` | integer |  |
| `baseline.articles.other` | integer |  |
| `events` | object[] |  |
| `events[].rank` | integer |  |
| `events[].score` | number |  |
| `events[].major` | string[] | 主要標籤 |
| `events[].tags` | object[] | 事件內所有標籤與爆發力 |
| `events[].tags[].tag` | string |  |
| `events[].tags[].burst` | number |  |
| `events[].news` | object[] | 代表新聞（最多 6 則），各附媒體陣營 camp |
| `events[].news[].id` | integer \| null | 文章 id（舊資料可能為 null） |
| `events[].news[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `events[].news[].title` | string | 標題 |
| `events[].news[].url` | string | 原文網址 |
| `events[].news[].image` | string \| null | 代表圖網址 |
| `events[].news[].camp` | string | 媒體陣營 blue／green／other（只在 /api/v1/events 回傳） |
| `events[].relatedEventPk` | string \| null | = threadId 的字串形式（相容舊版） |
| `events[].threadId` | integer \| null | 事件串 id，可查 /api/v1/events/threads/{id} |
| `events[].prevRank` | integer \| null | 前一個快照的名次（依事件串或主要標籤比對）；null 表示本小時新上榜 |
| `events[].hours` | integer \| null | 事件串到這個小時為止已出現的小時數 |
| `events[].rankTrail` | integer \| null[] \| null | 事件串在截至本小時的 24 個快照小時的名次（最舊在前）；不在榜上的小時為 null |
| `events[].firstTime` | string (ISO 時間) \| null | 事件串第一次上榜的小時 |
| `events[].coverage` | object |  |
| `events[].coverage.outlets` | object[] | 過去 24 小時寫過此事件主要標籤的媒體，依篇數排序 |
| `events[].coverage.outlets[].media` | string |  |
| `events[].coverage.outlets[].camp` | string | blue／green／other |
| `events[].coverage.articles` | integer | 報導篇數 |
| `events[].coverage.camps` | object | 各陣營媒體家數 |
| `events[].coverage.camps.blue` | integer |  |
| `events[].coverage.camps.green` | integer |  |
| `events[].coverage.camps.other` | integer |  |
| `events[].coverage.share` | object \| null | 藍綠之間的家數百分比（不含其他） |
| `events[].coverage.share.blue` | integer |  |
| `events[].coverage.share.green` | integer |  |
| `events[].coverage.lean` | number \| null | 藍綠家數比相對於 baseline 的 log2；0 為平常比例，正偏藍、負偏綠 |
| `events[].coverage.tilt` | string \| null | 明顯偏向的陣營（\|lean\| ≥ 0.8，約 1.75 倍，且藍綠合計 ≥ 5 家） |
| `events[].coverage.blindspot` | string[] | 盲點：幾乎沒報導的陣營（該陣營 ≤ 1 家而另一陣營 ≥ 4 家）。blue 表示藍營讀者看不到這件事 |

錯誤：`400` `at` 格式錯誤；`404` 該時間以前沒有快照；`503` 尚無任何快照。

<a id="api-v1-events-threads"></a>

### `GET /api/v1/events/threads`

**某一天的所有事件串**

台北時間某一天內曾出現的事件串，依最高分排序（最多 300 個）。`days` 列出所有有資料的日期。藍綠報導（`coverage`、`baseline`）的窗口是到當天結束為止的 24 小時，也就是當天整天；今天則是到現在為止的 24 小時，與 /api/v1/events 相同。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `day` | query | string | 台北日期 YYYY-MM-DD，預設今天，例：`2026-09-30` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/events/threads?day=2026-09-30'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `day` | string |  |
| `days` | string[] |  |
| `dayHours` | string (ISO 時間)[] | 當天所有有快照的小時 |
| `dayStats` | object[] | 當天每個快照小時的概況 |
| `dayStats[].hour` | string (ISO 時間) |  |
| `dayStats[].top` | number | 該小時第 1 名的爆發力 |
| `dayStats[].count` | integer | 該小時事件數 |
| `baseline` | object | 各陣營的整體基準，用來判斷單一事件的藍綠比例是否異常；其他只計排行榜用的新聞媒體 |
| `baseline.outlets` | object | 事件窗口（當天）內有發稿的媒體家數 |
| `baseline.outlets.blue` | integer |  |
| `baseline.outlets.green` | integer |  |
| `baseline.outlets.other` | integer |  |
| `baseline.articles` | object | 同窗口內各陣營文章數 |
| `baseline.articles.blue` | integer |  |
| `baseline.articles.green` | integer |  |
| `baseline.articles.other` | integer |  |
| `threads` | object[] |  |
| `threads[].id` | integer |  |
| `threads[].firstTime` | string (ISO 時間) |  |
| `threads[].lastTime` | string (ISO 時間) |  |
| `threads[].hours` | integer | 出現的小時數 |
| `threads[].majorTags` | string[] |  |
| `threads[].maxTag` | string \| null | 分數最高的標籤 |
| `threads[].maxScore` | number |  |
| `threads[].bestRank` | integer \| null | 最佳名次 |
| `threads[].rankTrail` | integer \| null[] \| null | 到 trailEnd 為止 24 個快照小時的名次（最舊在前）；不在榜上的小時為 null |
| `threads[].trailEnd` | string (ISO 時間) \| null | 名次走勢的最後一小時：事件串當天最後在榜的小時 |
| `threads[].coverage` | object |  |
| `threads[].coverage.outlets` | object[] | 當天寫過此事件主要標籤的媒體，依篇數排序 |
| `threads[].coverage.outlets[].media` | string |  |
| `threads[].coverage.outlets[].camp` | string | blue／green／other |
| `threads[].coverage.articles` | integer | 報導篇數 |
| `threads[].coverage.camps` | object | 各陣營媒體家數 |
| `threads[].coverage.camps.blue` | integer |  |
| `threads[].coverage.camps.green` | integer |  |
| `threads[].coverage.camps.other` | integer |  |
| `threads[].coverage.share` | object \| null | 藍綠之間的家數百分比（不含其他） |
| `threads[].coverage.share.blue` | integer |  |
| `threads[].coverage.share.green` | integer |  |
| `threads[].coverage.lean` | number \| null | 藍綠家數比相對於 baseline 的 log2；0 為平常比例，正偏藍、負偏綠 |
| `threads[].coverage.tilt` | string \| null | 明顯偏向的陣營（\|lean\| ≥ 0.8，約 1.75 倍，且藍綠合計 ≥ 5 家） |
| `threads[].coverage.blindspot` | string[] | 盲點：幾乎沒報導的陣營（該陣營 ≤ 1 家而另一陣營 ≥ 4 家）。blue 表示藍營讀者看不到這件事 |
| `threads[].news` | object[] | 最佳名次那一小時的代表新聞（最多 6 則），各附媒體陣營 camp |
| `threads[].news[].id` | integer \| null | 文章 id（舊資料可能為 null） |
| `threads[].news[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `threads[].news[].title` | string | 標題 |
| `threads[].news[].url` | string | 原文網址 |
| `threads[].news[].image` | string \| null | 代表圖網址 |
| `threads[].news[].camp` | string | 媒體陣營 blue／green／other（只在 /api/v1/events 回傳） |

錯誤：`400` 日期格式錯誤。

<a id="api-v1-events-threads-id"></a>

### `GET /api/v1/events/threads/{id}`

**單一事件串**

事件串的整體資訊與逐小時紀錄（最多 72 小時，新到舊）。`thread.history` 的鍵是台北時間 `YYYY-MM-DD HH:00:00`。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `id` | 路徑 | integer | 事件串 id（/api/v1/events 的 threadId），例：`365` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/events/threads/365'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `thread` | object |  |
| `thread.id` | integer |  |
| `thread.category` | string |  |
| `thread.firstTime` | string (ISO 時間) |  |
| `thread.lastTime` | string (ISO 時間) |  |
| `thread.hours` | integer |  |
| `thread.allTags` | string[] |  |
| `thread.majorTags` | string[] |  |
| `thread.maxTag` | string \| null |  |
| `thread.maxScore` | number |  |
| `thread.history` | {鍵: {鍵: number}} | 台北時間小時 → 標籤 → 分數 |
| `thread.combinedFrom` | integer[] | 併入本串的事件串 |
| `thread.combinedTo` | integer[] | 本串併入的事件串 |
| `thread.hoursTotal` | integer \| null |  |
| `thread.equalFirstTime` | string (ISO 時間) \| null |  |
| `thread.equalLastTime` | string (ISO 時間) \| null |  |
| `related` | integer[] | 相關事件串 id |
| `hours` | object[] |  |
| `hours[].hourStart` | string (ISO 時間) |  |
| `hours[].rank` | integer |  |
| `hours[].score` | number |  |
| `hours[].major` | string[] |  |
| `hours[].tags` | [string, number][] | [標籤, 爆發力] |
| `hours[].news` | object[] |  |
| `hours[].news[].id` | integer \| null | 文章 id（舊資料可能為 null） |
| `hours[].news[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `hours[].news[].title` | string | 標題 |
| `hours[].news[].url` | string | 原文網址 |
| `hours[].news[].image` | string \| null | 代表圖網址 |
| `hours[].news[].camp` | string | 媒體陣營 blue／green／other（只在 /api/v1/events 回傳） |

錯誤：`400` id 格式錯誤；`404` 找不到。

<a id="api-v1-events-threads-id-series"></a>

### `GET /api/v1/events/threads/{id}/series`

**事件串的每小時趨勢**

事件主要標籤（最多 6 個）以固定媒體基準重算每小時分數，歷史不足為 null；藍／綠／其他報導數則涵蓋所有媒體。前後各多 12 小時，只畫已完成小時。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `id` | 路徑 | integer | 事件串 id（/api/v1/events 的 threadId），例：`365` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/events/threads/365/series'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `threadId` | integer |  |
| `basis` | object |  |
| `basis.id` | string | 固定媒體名單版本 |
| `basis.media` | string[] |  |
| `basis.coverageFrom` | string (ISO 時間) | 所有基準來源開始收錄後的第一個完整小時 |
| `basis.validFrom` | string (ISO 時間) | 收錄開始後滿 24 小時；更早的移動平均及分數為 null |
| `tags` | string[] |  |
| `from` | string (ISO 時間) |  |
| `to` | string (ISO 時間) |  |
| `points` | object[] |  |
| `points[].t` | string (ISO 時間) |  |
| `points[].blue` | integer | 藍營傾向媒體文章數 |
| `points[].green` | integer | 綠營傾向媒體文章數 |
| `points[].other` | integer | 其他媒體文章數 |
| `points[].tags` | {鍵: object} \| null |  |
| `points[].tags.{鍵}.score` | number \| null |  |
| `points[].tags.{鍵}.rank` | integer \| null | 固定為 null |

錯誤：`400` id 格式錯誤；`404` 找不到。

<a id="api-v1-events-threads-id-coverage"></a>

### `GET /api/v1/events/threads/{id}/coverage`

**同一事件的各家標題對照**

帶有事件主要標籤的所有文章，依媒體與藍／綠／其他分組。`blindspot` 列出「對方陣營有報、這一方完全沒報」的陣營。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `id` | 路徑 | integer | 事件串 id（/api/v1/events 的 threadId），例：`365` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/events/threads/365/coverage'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `threadId` | integer |  |
| `majorTags` | string[] |  |
| `from` | string (ISO 時間) |  |
| `to` | string (ISO 時間) |  |
| `articles` | integer | 文章總數 |
| `outlets` | integer | 媒體數 |
| `camps` | object[] |  |
| `camps[].camp` | "blue" \| "green" \| "other" | 政治傾向分組：blue 藍營傾向、green 綠營傾向、other 其他（依 app/data/media-catalog.json） |
| `camps[].label` | string |  |
| `camps[].outlets` | integer |  |
| `camps[].articles` | integer |  |
| `blindspot` | "blue" \| "green" \| "other"[] |  |
| `byOutlet` | object[] |  |
| `byOutlet[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `byOutlet[].title` | string |  |
| `byOutlet[].icon` | string \| null |  |
| `byOutlet[].camp` | "blue" \| "green" \| "other" | 政治傾向分組：blue 藍營傾向、green 綠營傾向、other 其他（依 app/data/media-catalog.json） |
| `byOutlet[].articles` | object[] |  |
| `byOutlet[].articles[].id` | integer |  |
| `byOutlet[].articles[].title` | string |  |
| `byOutlet[].articles[].url` | string |  |
| `byOutlet[].articles[].image` | string \| null |  |
| `byOutlet[].articles[].publishedAt` | string (ISO 時間) |  |
| `byOutlet[].articles[].hits` | integer | 這篇文章帶了幾個事件主要標籤 |

錯誤：`400` id 格式錯誤；`404` 找不到。

## 各媒體的議題／專題

<a id="api-v1-topics"></a>

### `GET /api/v1/topics`

**各媒體的議題／專題**

不給 `media`：跨媒體合併的議題流（`feed`，新到舊，附站內相關報導 `coverage`）與各媒體最近議題（`media`）。給 `media`：只回該媒體最新議題（同樣附 `coverage`）。依首次發現時間排序，不代表原站發布時間。每小時 :50 檢查官方入口，`check` 顯示各媒體檢查狀態；部分入口失敗時保留成功結果與既有資料。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `media` | query | string | 只取這家媒體（須為有追蹤議題的媒體），例：`pts` |
| `limit` | query | integer | 筆數：有 media 時預設 20、最多 200；否則為 feed 筆數，預設 60、最多 120，例：`20` |
| `per` | query | integer | 沒給 media 時，每家媒體附幾則最近議題，1–10，預設 `4`，例：`2` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/topics?limit=20'
```

回應（不給 media）：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `media` | object[] |  |
| `media[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `media[].title` | string |  |
| `media[].icon` | string \| null |  |
| `media[].link` | string | 媒體議題列表頁 |
| `media[].check` | object |  |
| `media[].check.checkedAt` | string (ISO 時間) \| null | 最近一次完成檢查時間 |
| `media[].check.lastSuccessAt` | string (ISO 時間) \| null | 最近一次所有入口成功的時間 |
| `media[].check.status` | string | ok、partial、failed、running 或 pending |
| `media[].check.fetched` | integer | 本次取得的去重專題數 |
| `media[].check.stale` | boolean | 超過三小時未完整更新，或尚未成功 |
| `media[].count` | integer | 該媒體累計追蹤到的議題數 |
| `media[].latest` | object \| null |  |
| `media[].latest.id` | string | 議題 id |
| `media[].latest.time` | string (ISO 時間) | 首次看到的時間 |
| `media[].latest.backlog` | boolean | true 表示開始追蹤該媒體時就已上架，time 只是開始追蹤的時間 |
| `media[].latest.title` | string | 議題名稱 |
| `media[].latest.url` | string | 媒體的專題頁網址 |
| `media[].latest.image` | string \| null |  |
| `media[].recent` | object[] |  |
| `media[].recent[].id` | string | 議題 id |
| `media[].recent[].time` | string (ISO 時間) | 首次看到的時間 |
| `media[].recent[].backlog` | boolean | true 表示開始追蹤該媒體時就已上架，time 只是開始追蹤的時間 |
| `media[].recent[].title` | string | 議題名稱 |
| `media[].recent[].url` | string | 媒體的專題頁網址 |
| `media[].recent[].image` | string \| null |  |
| `feed` | object[] |  |
| `feed[].id` | string | 議題 id |
| `feed[].time` | string (ISO 時間) | 首次看到的時間 |
| `feed[].backlog` | boolean | true 表示開始追蹤該媒體時就已上架，time 只是開始追蹤的時間 |
| `feed[].title` | string | 議題名稱 |
| `feed[].url` | string | 媒體的專題頁網址 |
| `feed[].image` | string \| null |  |
| `feed[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `feed[].mediaTitle` | string |  |
| `feed[].icon` | string \| null |  |
| `feed[].mediaImage` | string \| null |  |
| `feed[].coverage` | object \| null | 站內相關報導；比對不到站內標籤時為 null |
| `feed[].coverage.tags` | string[] | 議題對應到的站內標籤 |
| `feed[].coverage.basis` | string | title＝從議題名稱比對到的標籤；page＝議題名稱比對不到時，該媒體專題頁所列自家文章共有的標籤 |
| `feed[].coverage.count` | integer | 過去 3 天同時帶有這些標籤的文章數 |
| `feed[].coverage.capped` | boolean | count 達上限 500 |
| `feed[].coverage.mediaCount` | integer |  |
| `feed[].coverage.latest` | object[] |  |
| `feed[].coverage.latest[].id` | integer |  |
| `feed[].coverage.latest[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `feed[].coverage.latest[].mediaTitle` | string |  |
| `feed[].coverage.latest[].title` | string |  |
| `feed[].coverage.latest[].url` | string |  |
| `feed[].coverage.latest[].time` | string (ISO 時間) |  |

回應（給 media）：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `title` | string |  |
| `link` | string |  |
| `mediaImage` | string \| null |  |
| `check` | object |  |
| `check.checkedAt` | string (ISO 時間) \| null | 最近一次完成檢查時間 |
| `check.lastSuccessAt` | string (ISO 時間) \| null | 最近一次所有入口成功的時間 |
| `check.status` | string | ok、partial、failed、running 或 pending |
| `check.fetched` | integer | 本次取得的去重專題數 |
| `check.stale` | boolean | 超過三小時未完整更新，或尚未成功 |
| `count` | integer | 該媒體累計追蹤到的議題數 |
| `topics` | object[] |  |
| `topics[].id` | string | 議題 id |
| `topics[].time` | string (ISO 時間) | 首次看到的時間 |
| `topics[].backlog` | boolean | true 表示開始追蹤該媒體時就已上架，time 只是開始追蹤的時間 |
| `topics[].title` | string | 議題名稱 |
| `topics[].url` | string | 媒體的專題頁網址 |
| `topics[].image` | string \| null |  |
| `topics[].coverage` | object \| null | 站內相關報導；比對不到站內標籤時為 null |
| `topics[].coverage.tags` | string[] | 議題對應到的站內標籤 |
| `topics[].coverage.basis` | string | title＝從議題名稱比對到的標籤；page＝議題名稱比對不到時，該媒體專題頁所列自家文章共有的標籤 |
| `topics[].coverage.count` | integer | 過去 3 天同時帶有這些標籤的文章數 |
| `topics[].coverage.capped` | boolean | count 達上限 500 |
| `topics[].coverage.mediaCount` | integer |  |
| `topics[].coverage.latest` | object[] |  |
| `topics[].coverage.latest[].id` | integer |  |
| `topics[].coverage.latest[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `topics[].coverage.latest[].mediaTitle` | string |  |
| `topics[].coverage.latest[].title` | string |  |
| `topics[].coverage.latest[].url` | string |  |
| `topics[].coverage.latest[].time` | string (ISO 時間) |  |

錯誤：`404` 該媒體沒有追蹤議題。

## 媒體與爬蟲狀態

<a id="api-v1-media-media-keywords"></a>

### `GET /api/v1/media/{media}/keywords`

**媒體報導關鍵字**

統計期間內最新最多 2000 篇的標籤與標題關鍵詞，排除新聞分類與通用詞；每篇每詞計一次。標題詞彙沿用近 7 天跨媒體標籤字典。與文章列表分頁無關。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `media` | 路徑 | string | 媒體代碼，例：`rti` |
| `hours` | query | integer | 回溯刊登小時，1–168，預設 `168` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/media/rti/keywords'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `media` | string |  |
| `hours` | integer |  |
| `from` | string (ISO 時間) |  |
| `to` | string (ISO 時間) |  |
| `sampledArticles` | integer | 實際取樣文章數 |
| `capped` | boolean | 期間文章超過 2000 篇，僅取最新文章 |
| `terms` | object[] |  |
| `terms[].label` | string |  |
| `terms[].count` | integer | 包含此詞的文章數 |

錯誤：`400` 參數無效；`404` 媒體不存在。

快取：2 分鐘。

<a id="api-v1-media-media-content"></a>

### `GET /api/v1/media/{media}/content`

**媒體內文庫列表**

以文章 id 遞減分頁；僅回傳內文狀態與長度，單篇內文另由 content API 取得。google_news 與 dongtaiwang 列出經該來源發現的文章；sourceKind 為 discovery、publisher 為 null，每篇文章仍歸屬原刊登媒體。discoverySources 記錄發現來源及網址。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `media` | 路徑 | string | 媒體代碼，例：`cna` |
| `limit` | query | integer | 每頁筆數，1–100，預設 `40` |
| `cursor` | query | string | 上一頁 nextCursor |
| `q` | query | string | 標題、摘要或完整標籤關鍵字（最多 60 字元） |
| `hours` | query | integer | 僅列出近幾小時刊登的文章；省略則不限時間，1–168 |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/media/cna/content'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `media` | string |  |
| `title` | string |  |
| `sourceKind` | "discovery" \| "publisher" | discovery 為文章發現來源；publisher 為刊登媒體 |
| `publisher` | object \| null |  |
| `publisher.media` | string |  |
| `publisher.name` | string |  |
| `publisher.country` | string |  |
| `publisher.countryCode` | string |  |
| `limit` | integer |  |
| `count` | integer |  |
| `nextCursor` | string \| null |  |
| `articles` | object[] |  |
| `articles[].id` | integer |  |
| `articles[].media` | string |  |
| `articles[].mediaTitle` | string |  |
| `articles[].title` | string |  |
| `articles[].url` | string |  |
| `articles[].image` | string \| null |  |
| `articles[].publishedAt` | string (ISO 時間) | 排序用時間；若另有 publishedDate，刊期只有日精度，不代表確知時分 |
| `articles[].publishedDate` | string | 經官方證據核實的日期；原站未公開發刊時分 |
| `articles[].publishedDatePrecision` | "day" |  |
| `articles[].tags` | string[] |  |
| `articles[].description` | string \| null |  |
| `articles[].authors` | string[] |  |
| `articles[].publisher` | object |  |
| `articles[].publisher.media` | string |  |
| `articles[].publisher.name` | string |  |
| `articles[].publisher.country` | string |  |
| `articles[].publisher.countryCode` | string |  |
| `articles[].discoverySources` | object[] |  |
| `articles[].discoverySources[].media` | string | 文章發現來源代碼，非刊登媒體 |
| `articles[].discoverySources[].title` | string | 發現來源名稱 |
| `articles[].discoverySources[].url` | string | 實際發現文章的公開頁面網址 |
| `articles[].discoverySources[].discoveredAt` | string (ISO 時間) | 首次經此來源發現文章的時間，不取代刊登時間 |
| `articles[].bodyStatus` | string |  |
| `articles[].bodyChars` | integer |  |
| `articles[].contentFetchedAt` | string (ISO 時間) \| null |  |

錯誤：`400` 參數無效；`404` 媒體不存在。

快取：1 分鐘。

<a id="api-v1-media"></a>

### `GET /api/v1/media`

**所有媒體代碼與名稱**

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/media'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `{鍵}.title` | string \| null | 媒體名稱 |
| `{鍵}.icon` | string \| null | favicon 網址；已存放在本站的為 https://tag.observe.tw/favicons/<媒體代碼>.png（64×64 PNG） |
| `{鍵}.camp` | "blue" \| "green" \| "other" | 政治傾向分組：blue 藍營傾向、green 綠營傾向、other 其他（依 app/data/media-catalog.json） |

<a id="api-v1-media-media"></a>

### `GET /api/v1/media/{media}`

**單一媒體最近的文章與熱門標籤**

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `media` | 路徑 | string | 媒體代碼，例：`cna` |
| `hours` | query | integer | 往前幾小時，1–168，預設 `24`，例：`24` |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/media/cna'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `title` | string |  |
| `icon` | string \| null |  |
| `hours` | integer |  |
| `articleCount` | integer | 期間內文章數（最多計 200） |
| `topTags` | object[] | 最多 50 個 |
| `topTags[].tag` | string |  |
| `topTags[].count` | integer |  |
| `articles` | object[] | 最新 60 篇 |
| `articles[].id` | integer |  |
| `articles[].title` | string |  |
| `articles[].url` | string |  |
| `articles[].image` | string \| null |  |
| `articles[].publishedAt` | string (ISO 時間) |  |
| `articles[].tags` | string[] |  |

錯誤：`404` 未知媒體。

<a id="api-v1-media-traffic-comparison"></a>

### `GET /api/v1/media-traffic-comparison`

**本站爬蟲跨月收錄量**

依台北時間發布月份統計本站自行抓取（source=own）的文章，排除發布日期待定與未來文章，不限正文狀態。包含新聞來源清單與媒體目錄的所有來源，供介面對照原始 Similarweb 月份資料；本端點不提供流量數字。月份升冪排列，從參考表最舊月份延續至當月；連續區間最多保留近 24 個月，另保留較早的原表月份。當月只統計截至 generatedAt 的資料。早於首次收錄月份的正數是補收舊文章，並非完整歷史月；零筆也不代表當時沒有發稿。發現來源透過關聯統計原媒體文章，不改變文章歸屬，跨來源加總時應排除 discovery 避免重複計算。

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/media-traffic-comparison'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `generatedAt` | string (ISO 時間) | 統計產生時間；所有月份均為此時間點的已收錄資料 |
| `collectionStartedAt` | string (ISO 時間) \| null | 本站自行抓取文章的最早收錄時間；不含 legacy 匯入，沒有紀錄時為 null |
| `months` | string[] | 可用比較月份，升冪排列 |
| `media` | object[] |  |
| `media[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `media[].sourceKind` | "publisher" \| "discovery" | publisher 為原刊登媒體；discovery 為文章發現來源 |
| `media[].firstAcquiredAt` | string (ISO 時間) \| null | 刊登媒體為首次自行抓取時間，發現來源為首次發現時間；不受月份範圍限制，從未收錄為 null |
| `media[].monthly` | object[] | 每個可用月份皆有一筆；無文章時回傳 0，不以 null 取代已知筆數 |
| `media[].monthly[].month` | string | 對應 months 的台北發布月份 |
| `media[].monthly[].articles` | integer | 目前資料庫中該來源、該發布月的文章數；0 表示零筆已收錄文章，不保證歷史收錄完整 |

快取：5 分鐘。

<a id="api-v1-media-stats"></a>

### `GET /api/v1/media-stats`

**各媒體收錄量與爬蟲狀態**

列出已登錄媒體，包含未啟用抓取與僅作為引用來源者，排除重複代碼。發現來源的個別列依文章關聯計量；全站文章總數僅計原刊登媒體，避免重複計算。today 為台北時間今天 0 點起。status：ok 正常、stale 太久沒有新文章、failing 近 3 小時爬取全部失敗、disabled 未啟用定期抓取（含停用）。

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/media-stats'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `generatedAt` | string (ISO 時間) |  |
| `todayStart` | string (ISO 時間) |  |
| `totals` | object |  |
| `totals.today` | integer |  |
| `totals.last24h` | integer |  |
| `totals.publishingMedia24h` | integer |  |
| `totals.pendingDate` | integer |  |
| `totals.activeSources` | integer |  |
| `totals.disabledSources` | integer |  |
| `totals.taggedShare24h` | number | 24 小時內有標籤的文章比例（0–1） |
| `totals.statusCounts` | {鍵: integer} |  |
| `media` | object[] |  |
| `media[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `media[].title` | string |  |
| `media[].icon` | string \| null |  |
| `media[].sourceKind` | "discovery" \| "publisher" | discovery 為文章發現來源，篇數透過關聯計算；publisher 為刊登媒體，全站文章總數不重複計入發現來源 |
| `media[].category` | string \| null |  |
| `media[].categoryLabel` | string \| null |  |
| `media[].camp` | "blue" \| "green" \| "other" | 政治傾向分組：blue 藍營傾向、green 綠營傾向、other 其他（依 app/data/media-catalog.json） |
| `media[].schedule` | string | 爬取頻率；未啟用時為 off |
| `media[].country` | string | 媒體營運／在地發行版本的國家或地區，不是報導發生地 |
| `media[].countryCode` | string | 國家或地區代碼；INT 跨國、ZZ 待確認 |
| `media[].crawler` | object |  |
| `media[].crawler.methods` | string[] |  |
| `media[].crawler.transport` | string \| null | HTTP、curl 或瀏覽器工具 |
| `media[].crawler.body` | string | 正文或標題摘要收錄方式 |
| `media[].crawler.lastVerifiedMethod` | string \| null | 最近匹配目前入口的成功驗證方式 |
| `media[].crawler.links` | object[] |  |
| `media[].crawler.links[].label` | string |  |
| `media[].crawler.links[].url` | string | GitHub 設定或解析程式連結 |
| `media[].today` | integer |  |
| `media[].last24h` | integer |  |
| `media[].last7d` | integer |  |
| `media[].collectingSince` | string (ISO 時間) \| null |  |
| `media[].pendingDate` | integer | 尚未確定發布時間的文章數 |
| `media[].taggedShare24h` | number \| null |  |
| `media[].lastArticle` | string (ISO 時間) \| null |  |
| `media[].lastCrawlOk` | string (ISO 時間) \| null |  |
| `media[].status` | "ok" \| "stale" \| "failing" \| "disabled" |  |

## 舊站 API 對照

舊站 tag.analysis.tw 的 `/api/*.php` 是舊網頁自己用的 AJAX 端點，從未公開文件化；新站不再提供，呼叫會回 `410 Gone`，JSON 的 `replacement` 欄位指向下表的替代端點（舊 API 仍在舊網域運作）。

| 舊端點 | 替代 |
| --- | --- |
| `/api/tag.php` | `/api/v1/ranking` |
| `/api/tag_burst.php` | `/api/v1/ranking?order=burst` |
| `/api/show_index.php` | `/api/v1/ranking?order=score` |
| `/api/show_history.php` | `/api/v1/tags/{tag}/series` |
| `/api/social.php` | 已淘汰（資料來源已不存在） |
| `/api/social_rank.php` | 已淘汰（資料來源已不存在） |
| `/api/news.php` | `/api/v1/media/{media}` |
| `/api/news_data.php` | `/api/v1/tags/{tag}/articles` |
| `/api/media.php` | `/api/v1/media` |
| `/api/favicon.php` | `/api/v1/media` |
| `/api/events.php` | `/api/v1/events` |
| `/api/group.php` | 已淘汰（資料來源已不存在） |
| `/api/youtube.php` | 已淘汰（資料來源已不存在） |
| `/api/facebook_id.php` | 已淘汰（資料來源已不存在） |
| `/api/queue.php` | 已淘汰（資料來源已不存在） |
