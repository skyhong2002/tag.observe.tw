# 自家服務的 API 額度

公開 API 對一般呼叫者是每個 IP 每分鐘 60 次，帶個人 API key 是每分鐘 1000 次（`app/src/reader/api-keys.ts`）。有影儀表板（youtube.observe.tw）和部落格觀察（blog.observe.tw）在背景同步，會碰到 60 次的上限，所以它們可以表明身分，改用自己的額度。程式：`app/src/service-clients.ts`，接在 `app/src/app.js` 的限流前面。

## 表明身分

1. **服務 token（主要）**：請求帶 header `x-service-token: <token>`。tag 只存 token 的 SHA-256：

   ```
   TAG_SERVICE_TOKENS=youtube:<sha256 hex>,blog:<sha256 hex>
   ```

   明文只放在呼叫端：本機 `~/.config/observe-tag/youtube-token`、`~/.config/observe-tag/blog-token`（權限 600），以及 skyhong-blog 上有影儀表板的 Dokploy env。都不進 Git。換 token：產生新的明文、算 `sha256sum`、改 `.env` 後重啟 `tag-analysis`。token 不對時當一般呼叫者處理（仍是 60 次），並在日誌記一筆 `unknown service token`（每分鐘最多一筆）。這個 header 不會轉給 Next。

2. **來源 IP（輔助）**：

   ```
   TAG_TRUSTED_CLIENT_IPS=blog=217.142.232.200
   ```

   格式是 `服務名=IP`，比對 `cf-connecting-ip`。目前只列 skyhong-blog；本機 skyhong-SM 的對外 IP 是學校網段、可能和別人共用，不列，本機服務改用 token 或直接連 `127.0.0.1:18130`（本機連線本來就不限流）。

   **前提**：`cf-connecting-ip` 只在請求經過 Cloudflare 時可信。閘道只聽 127.0.0.1，公開流量只會從 cloudflared 進來，而 cloudflared 會覆寫這個 header，所以外面偽造不了。如果閘道哪天改聽公開位址，就必須拿掉這份 IP 清單。本機（或經 tailnet 直接轉到 18130）的呼叫者可以自己帶這個 header，但他們不帶的話本來就不限流，冒用只會讓自己被算進 blog 的額度。

## 額度

| 呼叫者 | 每分鐘 |
| --- | --- |
| 一般（每個 IP，`/api/`） | 60 |
| 個人 API key | 1000 |
| 每個自家服務（`SERVICE_MAX_PER_MINUTE`） | 6000 |
| 所有自家服務加總（`SERVICE_TOTAL_MAX_PER_MINUTE`，防自家程式出 bug） | 9000 |

超過時回 429。共用上限只計算在各服務自己額度內的請求，所以一個服務失控被擋下時，不會吃掉其他服務的份。超過加總上限的回應是 `{"error":"too many requests","scope":"services"}`，帶 `retry-after: 60`。從本機帶 token 的請求也算進服務額度；不帶 token 的本機請求照舊不限。

## 紀錄

- Prometheus：`tag_service_requests_total{service, via, outcome}`，`via` 是 `token` 或 `ip`，`outcome` 是 `ok`、`limited`，token 不符的記在 `service="unknown", outcome="bad-token"`。
- 日誌：啟動時記一筆 `service allowlist`（服務名稱）；被限流時每個服務每分鐘最多記一筆 `service rate-limited`。
