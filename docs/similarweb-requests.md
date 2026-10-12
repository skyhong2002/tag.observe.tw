# 其他服務的 Similarweb 查詢

這台主機只有一個對外 IP，Similarweb 大約連續 20 次就會開始拒絕（403）。所以本機所有對 `data.similarweb.com` 的請求都只由 tag worker 的 `media-traffic` 工作發出（每小時 :35，`MEDIA_TRAFFIC_CRON`）。其他服務（目前是 blog.observe.tw）把網域交給 tag，再讀結果，自己不打 Similarweb。程式：`app/src/media-traffic/external.ts`、`external-routes.ts`；資料表 `traffic_external_requests`（migration 0035）。

## 預算

每一輪：

1. 先跑 tag 自己的媒體網域（照舊：到期的才抓，3 秒間隔，401/403/429 立刻停，5 分鐘上限）。
2. 只有在 tag 這輪**沒被拒絕、不是全部失敗**、**自己的網域都處理完**、而且**六小時內沒有任何一筆外部請求被拒**（`refused_at`）時，才處理外部請求，數量是下面三者的最小值：
   - `TAG_SIMILARWEB_RUN_BUDGET`（預設 15）減去 tag 這輪已送出的請求數；
   - `TAG_SIMILARWEB_EXTERNAL_PER_RUN`（預設 3）；
   - `TAG_SIMILARWEB_EXTERNAL_PER_DAY`（預設 30）減去今天（台北時間）已送出的外部請求數（每送一次記一筆在 `traffic_external_sends`，同一網域重試也算）。
3. 外部請求依提交時間先後處理，每個網域只送一次 `/api/v1/data`，同一個網域的流量與相似網站兩種結果一起寫入。每筆之前都先等 3 秒（包括緊接在 tag 最後一筆之後）。送出前先把該網域的下次嘗試時間往後押 15 分鐘，兩輪同時跑也不會重複送。
4. 任何 401/403/429：立刻停止，那個網域標為 `blocked` 並記下 `refused_at`，六小時後再試；這六小時內所有外部請求都暫停，重新提交也不會清掉等待。其他錯誤（沒有資料、網路錯誤）隔天重試，三次後標為 `no-data`。

## API（只限本機＋服務 token）

位址：`http://127.0.0.1:18130/internal/similarweb/…`（tag 閘道的本機埠）。公開網址 `tag.observe.tw/internal/…` 一律 404。

認證：`Authorization: Bearer <token>`。token 從環境變數 `TAG_SIMILARWEB_TOKEN_<請求者>` 讀（例如 `TAG_SIMILARWEB_TOKEN_BLOG`，至少 32 字元），不進 Git；token 決定請求者（`blog`），每個請求者只看得到自己的請求。另外只接受直接連到 loopback、而且沒有 `cf-connecting-ip`、`x-forwarded-for` 等轉送 header 的連線（經 Cloudflare 或其他代理進來的都不算）。不符合時回 404，不透露路由存在。

| 路由 | 用途 |
| --- | --- |
| `POST /internal/similarweb/requests` | `{"domain": "example.com", "kind": "similar_sites"}`（`kind` 為 `traffic` 或 `similar_sites`，省略時是 `similar_sites`）。新排入回 202，已經有（且結果不到 30 天）回 200 與目前狀態；超過 30 天的會重新排入。錯誤：400 `invalid_domain`／`invalid_kind`，429 `daily_limit`（每個請求者每天 `TAG_SIMILARWEB_SUBMIT_PER_DAY`，預設 200 筆） |
| `GET /internal/similarweb/results?domain=example.com` | 這個網域的結果：`source`（`similarweb-extension`）、`fetchedAt`、`requests`（每種 kind 的 `status`：`pending`／`ok`／`no-data`／`blocked`，`attempts`、`nextAttemptAt`）、`traffic`（`monthly` 月造訪數、`globalRank`、`countryRank`、`category`、`topCountries`；沒有流量資料時為 null）、`similarSites`（網域清單）。沒提交過回 404 `not_requested` |

網域會正規化（小寫、去掉 `www.`、協定、路徑、埠）。拒絕：IP、localhost、單一標籤、`.local`、`.internal`、`.lan`、`.test`、`.example`、`.invalid`、`.arpa`、`.onion`、`.ts.net`、`observe.tw` 本身，以及帶帳密、空白、反斜線或超過 253 字元的。

## 注意

- 相似網站來自 `/api/v1/data` 回應裡的 `Competitors.TopSimilarityCompetitors`。2026-10-12 實測 `/api/v1/similar-sites` 端點是 404，`cna.com.tw`、`medium.com` 的相似網站也都是空的，所以 `similar_sites` 多半會是 `no-data`。這是供應商的候選，不是權威分類。
- tag 自己的流量資料與頁面完全不變；外部結果只存在這張表，不進 `media-traffic-live.json`，也不進流量歷史。
- 回滾：blog 停止呼叫即可；移除 tag 端只需拿掉這兩支程式與路由，資料表可以留著。
