# 安全

2026-09-29 檢查並修正的項目；規則至今有效。新的公開端點若會揭露內部資訊，要用 `isExternal`（請求帶 `cf-connecting-ip`）判斷。

| 問題 | 發現方式 | 修正 | 驗證（公開站） |
| --- | --- | --- | --- |
| `/_next/image` 是開放圖片代理，可替任何公開網址抓圖並回傳 | 實測 google.com、github.com 圖片皆 200 | 圖片主機白名單（`tools/gen-image-hosts.ts` 由資料庫實際出現的圖片主機與媒體 favicon 產生，約 260 筆；共用 CDN 只允許精確主機，S3／GCS path-style 限定 bucket）。Next 的 `remotePatterns` 上限 50，所以在 Fastify 閘道檢查（Next 只聽 127.0.0.1，閘道是唯一公開入口）；`SafeImage` 不渲染白名單外的圖 | google／github → 400；媒體圖片 → 200 JPEG |
| `/metrics` 公開（23 KB 內部指標） | curl 公開網址 | 帶 `cf-connecting-ip`（經 Cloudflare 進來）的請求回 404；Prometheus 本機抓取不受影響 | 404；Prometheus targets 全 up |
| `/_migration/health` 對外揭露來源、讀取額度、每路由指標 | 同上 | 對外只回 `{"status":"ok"}` | 對外只剩 status |
| 爬蟲會抓 feed／sitemap 中任意網址（SSRF） | 程式審查 | 每一跳（含轉址）解析 DNS，拒絕私有、loopback、link-local、CGNAT、metadata（169.254.169.254）、`.internal` 等；socket 釘在檢查過的位址（防 DNS rebinding）；curl 備援逐跳 `--resolve` 釘選 | 169.254.169.254 → EBLOCKED；本機服務 0 次命中；真實站台與轉址、Cloudflare→curl 正常 |
| API 無速率限制 | 程式審查 | `@fastify/rate-limit`，以 `cf-connecting-ip` 為鍵：`/api` 60 次／分（帶有效個人 API 金鑰時改以金鑰計，1000 次／分）、其他 1200 次／分；本機呼叫（Next SSR、Prometheus）豁免 | 回應帶 `x-ratelimit-*`；測試第 61 次為 429 |
| UI 缺安全標頭 | — | nosniff、Referrer-Policy、X-Frame-Options SAMEORIGIN、Permissions-Policy | 首頁回應已帶 |

測試：`app/src/crawl/fetch.spec.ts`（位址分類、解析、拒絕本機）、`app/test/gateway.spec.ts`（metrics／health／速率限制、被拒圖片不會到達 Next）、`app/test/image-allowlist.spec.ts`（閘道與前端比對一致、重複 url 參數、`//` 協定相對網址）。

維護：新媒體或新 CDN 的圖片不在白名單時不會顯示；重跑 `node --env-file=.env tools/gen-image-hosts.ts` 後提交即可。

事故紀錄：第一次提交把 260 筆主機放進 `remotePatterns`，Next build 失敗；部署腳本在切換前中止，線上維持前一版，隔次提交修正。

## 新增公開端點的邊界

2026-10 新增的公開功能沿用 gateway 的速率限制、CORS 與外部請求判斷：

- `/api/v1/liveboard` 只回傳已收錄文章的標題、來源、公開期限內可顯示的正文片段、相似配對與彙整發稿量；回應快取 15 秒，不把資料庫欄位或內部工作狀態直接暴露給瀏覽器。
- `/api/v1/site-observation` 只讀 `site_metrics` 的彙整結果，網站程序不持有 Google 憑證；回應快取 60 秒，不保存搜尋字詞。
- `/api/v1/reader-presence` 的 GET 只讀取單一 gateway 記憶體中的匿名計數，回應 `no-store`；POST 僅接受正式站同源請求、固定格式的 UUID、256 bytes body，並以 50,000 個在線識別碼為上限。識別碼與最後回報時間不寫入資料庫，最多 90 秒後清除。

這些端點的測試分別覆蓋 `app/src/v1/` 的輸入驗證與快取標頭、`app/test/reader-presence.spec.ts` 的同源／容量限制，以及 `app/test/tracking-availability.spec.ts` 的防追蹤條件。新增 endpoint 仍需同步更新 `app/src/v1/openapi.ts`、`docs/api.md` 與 gateway 測試，不能只在前端加入呼叫。
