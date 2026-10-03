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
- 標題、圖片與內文著作權屬原媒體；本 API 提供標題、連結、統計及保存期間內的擷取文字。使用資料請註明「資料來源：新文易數 tag.observe.tw」。
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
| [`GET /api/v1/articles/{id}/content`](#api-v1-articles-id-content) | 單篇已保存內文 |
| [`GET /api/v1/media/{media}/content`](#api-v1-media-media-content) | 媒體內文庫列表 |
| [`GET /api/v1`](#api-v1) | API 索引 |
| [`GET /api/v1/openapi.json`](#api-v1-openapi-json) | OpenAPI 3.1 規格 |
| [`GET /api/v1/categories`](#api-v1-categories) | 排行分類 |
| [`GET /api/v1/ranking`](#api-v1-ranking) | 標籤排行（每 10 分鐘更新） |
| [`GET /api/v1/articles`](#api-v1-articles) | 文章搜尋 |
| [`GET /api/v1/tags/{tag}/articles`](#api-v1-tags-tag-articles) | 帶有某標籤的最新文章 |
| [`GET /api/v1/tags/{tag}/series`](#api-v1-tags-tag-series) | 標籤每小時的分數與文章數 |
| [`GET /api/v1/tags/{tag}/stats`](#api-v1-tags-tag-stats) | 標籤長期統計 |
| [`GET /api/v1/events`](#api-v1-events) | 目前的事件排行（每小時） |
| [`GET /api/v1/events/threads`](#api-v1-events-threads) | 某一天的所有事件串 |
| [`GET /api/v1/events/threads/{id}`](#api-v1-events-threads-id) | 單一事件串 |
| [`GET /api/v1/events/threads/{id}/series`](#api-v1-events-threads-id-series) | 事件串的每小時趨勢 |
| [`GET /api/v1/events/threads/{id}/coverage`](#api-v1-events-threads-id-coverage) | 同一事件的各家標題對照 |
| [`GET /api/v1/topics`](#api-v1-topics) | 各媒體的議題／專題 |
| [`GET /api/v1/media`](#api-v1-media) | 所有媒體代碼與名稱 |
| [`GET /api/v1/media/{media}`](#api-v1-media-media) | 單一媒體最近的文章與熱門標籤 |
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
| `snapshot.weight` | number | 正規化用的權重（有發文的媒體數） |
| `snapshot.articleCount` | integer | 視窗內文章數 |
| `snapshot.mediaCount` | integer | 視窗內有發文的媒體數 |
| `snapshot.historyAvailable` | integer[] | 有歷史快照可比較的小時數 |
| `order` | "burst" \| "score" |  |
| `entries` | object[] |  |
| `entries[].rank` | integer | 依原始分數的名次 |
| `entries[].position` | integer | 在本次回應排序中的位置（從 1 起） |
| `entries[].tag` | string | 標籤 |
| `entries[].score` | number | 原始分數：每篇文章 +1，同一媒體的第 2、3… 篇遞減為 0.5、0.25… |
| `entries[].count` | integer | 過去 24 小時帶這個標籤的文章數 |
| `entries[].media` | {鍵: integer} | 各媒體的文章數 |
| `entries[].normalized` | number | 以發文媒體數正規化後的分數 |
| `entries[].burst` | number | 爆發力：與 3/6/12/24/48 小時前正規化分數比較的加權差（權重 0.92/0.84/0.7/0.5/0.25） |
| `entries[].history` | {鍵: number \| null} | N 小時前的正規化分數（鍵為 3、6、12、24、48；當時沒有快照為 null） |

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

**單篇已保存內文**

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
| `article.publishedAt` | string (ISO 時間) |  |
| `article.tags` | string[] |  |
| `article.description` | string \| null |  |
| `article.authors` | string[] |  |
| `article.publisher` | object |  |
| `article.publisher.media` | string |  |
| `article.publisher.name` | string |  |
| `article.publisher.country` | string |  |
| `article.publisher.countryCode` | string |  |
| `content` | object |  |
| `content.status` | "ok" \| "short" \| "missing" \| "blocked" \| "error" \| "not_fetched" \| "expired" |  |
| `content.body` | string \| null | 保留期間內已抓取的文字；不保證原站目前仍存在 |
| `content.chars` | integer |  |
| `content.source` | string \| null | 擷取方式 |
| `content.fetchedAt` | string (ISO 時間) \| null |  |
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

取自每小時的排行快照；該小時沒進排行時 score 與 count 為 0、rank 為 null。

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
| `points` | object[] |  |
| `points[].t` | string (ISO 時間) | 小時（UTC） |
| `points[].score` | number | 正規化分數 |
| `points[].count` | integer | 文章數 |
| `points[].rank` | integer \| null | 名次 |

錯誤：`404` 未知分類。

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
| `events` | object[] |  |
| `events[].rank` | integer |  |
| `events[].score` | number |  |
| `events[].major` | string[] | 主要標籤 |
| `events[].tags` | object[] | 事件內所有標籤與爆發力 |
| `events[].tags[].tag` | string |  |
| `events[].tags[].burst` | number |  |
| `events[].news` | object[] | 代表新聞（最多 6 則） |
| `events[].news[].id` | integer \| null | 文章 id（舊資料可能為 null） |
| `events[].news[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |
| `events[].news[].title` | string | 標題 |
| `events[].news[].url` | string | 原文網址 |
| `events[].news[].image` | string \| null | 代表圖網址 |
| `events[].relatedEventPk` | string \| null | = threadId 的字串形式（相容舊版） |
| `events[].threadId` | integer \| null | 事件串 id，可查 /api/v1/events/threads/{id} |

錯誤：`400` `at` 格式錯誤；`404` 該時間以前沒有快照；`503` 尚無任何快照。

<a id="api-v1-events-threads"></a>

### `GET /api/v1/events/threads`

**某一天的所有事件串**

台北時間某一天內曾出現的事件串，依最高分排序（最多 300 個）。`days` 列出所有有資料的日期。

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
| `threads` | object[] |  |
| `threads[].id` | integer |  |
| `threads[].firstTime` | string (ISO 時間) |  |
| `threads[].lastTime` | string (ISO 時間) |  |
| `threads[].hours` | integer | 出現的小時數 |
| `threads[].majorTags` | string[] |  |
| `threads[].maxTag` | string \| null | 分數最高的標籤 |
| `threads[].maxScore` | number |  |
| `threads[].bestRank` | integer \| null | 最佳名次 |
| `threads[].news` | object[] |  |
| `threads[].news[].title` | string |  |
| `threads[].news[].url` | string |  |
| `threads[].news[].image` | string \| null |  |
| `threads[].news[].media` | string | 媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media |

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

錯誤：`400` id 格式錯誤；`404` 找不到。

<a id="api-v1-events-threads-id-series"></a>

### `GET /api/v1/events/threads/{id}/series`

**事件串的每小時趨勢**

事件主要標籤（最多 6 個）每小時的排行分數，以及藍／綠／其他媒體每小時的報導數；前後各多 12 小時。

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
| `tags` | string[] |  |
| `from` | string (ISO 時間) |  |
| `to` | string (ISO 時間) |  |
| `points` | object[] |  |
| `points[].t` | string (ISO 時間) |  |
| `points[].blue` | integer | 藍營傾向媒體文章數 |
| `points[].green` | integer | 綠營傾向媒體文章數 |
| `points[].other` | integer | 其他媒體文章數 |
| `points[].tags` | {鍵: object} \| null |  |
| `points[].tags.{鍵}.score` | number |  |
| `points[].tags.{鍵}.rank` | integer \| null |  |

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

不給 `media`：跨媒體合併的議題流（`feed`，新到舊，附站內相關報導 `coverage`）與各媒體最近議題（`media`）。給 `media`：只回該媒體最新議題。每小時 :50 更新。

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
| `feed[].coverage` | object \| null | 站內相關報導 |
| `feed[].coverage.tags` | string[] | 議題對應到的站內標籤 |
| `feed[].coverage.basis` | string | title＝從議題名稱比對到的標籤；page＝議題名稱比對不到時，該媒體專題頁所列自家文章共有的標籤 |
| `feed[].coverage.count` | integer | 過去 3 天同時帶有這些標籤的文章數 |
| `feed[].coverage.capped` | boolean | count 達上限 500 |
| `feed[].coverage.mediaCount` | integer |  |
| `feed[].coverage.latest` | object[] |  |
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
| `topics` | object[] |  |
| `topics[].id` | string | 議題 id |
| `topics[].time` | string (ISO 時間) | 首次看到的時間 |
| `topics[].backlog` | boolean | true 表示開始追蹤該媒體時就已上架，time 只是開始追蹤的時間 |
| `topics[].title` | string | 議題名稱 |
| `topics[].url` | string | 媒體的專題頁網址 |
| `topics[].image` | string \| null |  |

錯誤：`404` 該媒體沒有追蹤議題。

## 媒體與爬蟲狀態

<a id="api-v1-media-media-content"></a>

### `GET /api/v1/media/{media}/content`

**媒體內文庫列表**

以文章 id 遞減分頁；僅回傳內文狀態與長度，單篇內文另由 content API 取得。

| 參數 | 位置 | 型別 | 說明 |
| --- | --- | --- | --- |
| `media` | 路徑 | string | 媒體代碼，例：`cna` |
| `limit` | query | integer | 每頁筆數，1–100，預設 `40` |
| `cursor` | query | string | 上一頁 nextCursor |

範例：

```sh
curl -s 'https://tag.observe.tw/api/v1/media/cna/content'
```

回應欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `media` | string |  |
| `title` | string |  |
| `publisher` | object |  |
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
| `articles[].publishedAt` | string (ISO 時間) |  |
| `articles[].tags` | string[] |  |
| `articles[].description` | string \| null |  |
| `articles[].authors` | string[] |  |
| `articles[].publisher` | object |  |
| `articles[].publisher.media` | string |  |
| `articles[].publisher.name` | string |  |
| `articles[].publisher.country` | string |  |
| `articles[].publisher.countryCode` | string |  |
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

<a id="api-v1-media-stats"></a>

### `GET /api/v1/media-stats`

**各媒體收錄量與爬蟲狀態**

today 為台北時間今天 0 點起。status：ok 正常、stale 太久沒有新文章、failing 近 3 小時爬取全部失敗、disabled 已停用。

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
| `media[].category` | string \| null |  |
| `media[].categoryLabel` | string \| null |  |
| `media[].camp` | "blue" \| "green" \| "other" | 政治傾向分組：blue 藍營傾向、green 綠營傾向、other 其他（依 app/data/media-catalog.json） |
| `media[].schedule` | string | 爬取頻率 |
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
