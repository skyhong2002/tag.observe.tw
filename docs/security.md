# 安全

2026-09-29 檢查並修正的項目；規則至今有效。新的公開端點若會揭露內部資訊，要用 `isExternal`（請求帶 `cf-connecting-ip`）判斷。

| 問題 | 發現方式 | 修正 | 驗證（公開站） |
| --- | --- | --- | --- |
| `/_next/image` 是開放圖片代理，可替任何公開網址抓圖並回傳 | 實測 google.com、github.com 圖片皆 200 | 圖片主機白名單（`tools/gen-image-hosts.ts` 由資料庫實際出現的圖片主機與媒體 favicon 產生，約 260 筆；共用 CDN 只允許精確主機，S3／GCS path-style 限定 bucket）。Next 的 `remotePatterns` 上限 50，所以在 Fastify 閘道檢查（Next 只聽 127.0.0.1，閘道是唯一公開入口）；`SafeImage` 不渲染白名單外的圖 | google／github → 400；媒體圖片 → 200 JPEG |
| `/metrics` 公開（23 KB 內部指標） | curl 公開網址 | 帶 `cf-connecting-ip`（經 Cloudflare 進來）的請求回 404；Prometheus 本機抓取不受影響 | 404；Prometheus targets 全 up |
| `/_migration/health` 對外揭露來源、讀取額度、每路由指標 | 同上 | 對外只回 `{"status":"ok"}` | 對外只剩 status |
| 爬蟲會抓 feed／sitemap 中任意網址（SSRF） | 程式審查 | 每一跳（含轉址）解析 DNS，拒絕私有、loopback、link-local、CGNAT、metadata（169.254.169.254）、`.internal` 等；socket 釘在檢查過的位址（防 DNS rebinding）；curl 備援逐跳 `--resolve` 釘選 | 169.254.169.254 → EBLOCKED；本機服務 0 次命中；真實站台與轉址、Cloudflare→curl 正常 |
| API 無速率限制 | 程式審查 | `@fastify/rate-limit`，以 `cf-connecting-ip` 為鍵：`/api` 240 次／分、其他 1200 次／分；本機呼叫（Next SSR、Prometheus）豁免 | 回應帶 `x-ratelimit-*`；測試第 241 次為 429 |
| UI 缺安全標頭 | — | nosniff、Referrer-Policy、X-Frame-Options SAMEORIGIN、Permissions-Policy | 首頁回應已帶 |

測試：`app/src/crawl/fetch.spec.ts`（位址分類、解析、拒絕本機）、`app/test/gateway.spec.ts`（metrics／health／速率限制、被拒圖片不會到達 Next）、`app/test/image-allowlist.spec.ts`（閘道與前端比對一致、重複 url 參數、`//` 協定相對網址）。

維護：新媒體或新 CDN 的圖片不在白名單時不會顯示；重跑 `node --env-file=.env tools/gen-image-hosts.ts` 後提交即可。

事故紀錄：第一次提交把 260 筆主機放進 `remotePatterns`，Next build 失敗；部署腳本在切換前中止，線上維持前一版，隔次提交修正。
