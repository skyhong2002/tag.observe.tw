# 登入（Google）

讀者與管理員都用 Google 帳號登入。整個流程由 gateway（`app/src/auth/`）處理，Next.js 頁面維持靜態、可快取，只在瀏覽器端呼叫 `/auth/me` 決定 header 顯示「登入」或帳號選單。

## 設定

`.env`：

| 變數 | 說明 |
| --- | --- |
| `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` | Google Cloud 的 Web application OAuth client。兩者都不設就關閉登入（`/auth/me` 回 `enabled: false`，header 不顯示登入）。 |
| `TAG_PUBLIC_ORIGIN` | 預設 `https://tag.observe.tw`。callback 為 `$TAG_PUBLIC_ORIGIN/auth/google/callback`，必須登錄在 OAuth client 的「已授權的重新導向 URI」。 |
| `TAG_ADMIN_EMAILS` | 逗號分隔的管理員 Email（不分大小寫）。角色不存進資料庫，每次請求依此名單判斷，改名單後重啟 gateway 即生效。 |

## 端點

| 路徑 | 說明 |
| --- | --- |
| `GET /auth/google?next=/path/` | 導向 Google（PKCE + state + nonce，暫存在 10 分鐘的 httpOnly cookie）。`next` 只接受本站路徑。 |
| `GET /auth/google/callback` | 換 token、檢查 ID token（iss、aud、exp、nonce、`email_verified`），建立 30 天 session 後導回 `next`；失敗導到 `/login/?error=…`。 |
| `POST /auth/logout` | 需本站 `Origin`；刪除 session。 |
| `GET /auth/me` | `{ enabled, user: { id, email, name, picture, role } \| null }`，`role` 為 `admin` 或 `reader`。 |
| `GET /auth/users` | 管理員限定：登入過的帳號清單（`/admin/` 頁使用）。 |
| `GET /auth/admin/lookup?url=` | 管理員限定：新聞網址屬於哪家媒體（已收錄的文章優先，其次比對各媒體已知網域，含子網域），並回傳本站收錄的這篇文章。 |
| `GET /auth/admin/media`、`GET /auth/admin/media/:media` | 管理員限定：所有媒體與標籤；單一媒體的標籤、爬蟲排程、最近幾次 crawl_runs 與修改紀錄。 |
| `PUT /auth/admin/media/:media/categories` | 管理員限定、需本站 `Origin`：`{ categories: [...] }` 整組取代這家媒體的標籤，寫入 `media_category_log`。 |
| `POST /auth/admin/categories` | 管理員限定、需本站 `Origin`：`{ label, key? }` 新增標籤（中文名稱沒給代碼時自動編成 `tagN`）。 |
| `POST /auth/admin/media/:media/refetch` | 管理員限定、需本站 `Origin`：`{ url }` 立刻抓這一篇（沒收錄就先收錄），並以新抓到的標籤取代舊的。 |
| `POST /auth/admin/media/:media/crawl` | 管理員限定、需本站 `Origin`：`{ stage: 'index' \| 'articles' }` 排一個 worker 的 `crawl-media` 工作；同媒體同階段已在排隊就沿用。 |
| `GET /auth/admin/jobs/:id` | 管理員限定：`crawl-media` 工作的狀態與結果。 |
| `GET /auth/admin/articles/:id` | 管理員限定：單篇文章的標籤、抓取狀態、誰手動改過與標籤修改紀錄。 |
| `PUT /auth/admin/articles/:id/tags` | 管理員限定、需本站 `Origin`：`{ tags: [...] }`（最多 40 個、每個最多 60 字）整組取代這篇的標籤，同步 `articles.tags` 與 `article_tags`，寫入 `article_tag_log`，並在 `article_tag_edits` 標記為手動修改。 |

這些路徑不在 `/api/` 底下，因此沒有公開 API 的 `access-control-allow-origin: *`。

## 資料

- `users`：Google `sub`、Email、名字、大頭貼網址、首次與最近登入時間。
- `user_sessions`：只存 session cookie（`tag_session`，HttpOnly、SameSite=Lax、HTTPS 時 Secure）的 SHA-256；過期列在下次有人登入時清掉。

## 媒體設定（`/admin/media/`）

`/admin/` 提供「設定這家媒體」書籤（`javascript:` 書籤把目前網址帶到 `/admin/media/?url=…`）。在任何新聞頁按下去，會辨認媒體並開啟設定頁：勾選或取消標籤、新增標籤、增減這一篇的標籤、重抓這一篇、跑這家媒體的 index 或內文抓取。在本站的 `/article/<id>/` 頁按書籤也可以，會直接對應到那一篇。沒登入時會先導去登入，登入後回到同一個網址。

媒體標籤存在 `media_category_defs`（代碼、名稱、順序）與 `media_categories`（媒體 × 標籤）。資料表是空的時候，gateway 或 worker 啟動時會從 `app/data/media-catalog.json` 匯入一次，之後以資料庫為準。兩個程序每分鐘重新讀取一次，管理員存檔後 gateway 也會立刻重讀（`app/src/media-categories.ts`）。`blue`／`green` 決定陣營，兩個都勾時算藍營。新增的標籤沒有固定排行名單（`ranking-baseline.json`），所以不會出現在 `/ranking/`。

## 資料庫（`/admin/db/`）

`/admin/db/` 是 Adminer（`infra/compose.yml` 的 `tag-adminer`），由 gateway（`app/src/admin/db-console.ts`）轉送：沒登入導去登入，非管理員回 403，POST 需本站 `Origin`。轉送時只帶 `adminer_*` cookie（`tag_session` 不會送給 Adminer），並加上 `X-Tag-Admin-Email` 與共用密鑰 `X-Tag-Adminer-Secret`；Adminer 的 plugin（`infra/adminer/tag-gateway.php`）核對密鑰後，以這位管理員自己的 MariaDB 帳號登入。網址上改成別的帳號也一樣會用本人帳號連線；名單上沒有帳號的 Email 回 403。不帶密鑰的請求（tailnet 的 `:11443`）維持原本的 Adminer 登入表單。gateway log 記下每次開啟的頁面（`db console`，含管理員 Email）。

每位管理員一個 DB 帳號（`adm_<Email 帳號名>`），密碼只存在 `infra/.env` 的 `TAG_ADMINER_ACCOUNTS`（`email=帳號:密碼`，逗號分隔），管理員不用輸入：

```sh
scripts/adminer-account.sh someone@example.com           # 唯讀（SELECT、SHOW VIEW）
scripts/adminer-account.sh someone@example.com --write   # 加上 INSERT、UPDATE、DELETE
scripts/adminer-account.sh someone@example.com --revoke  # 刪除帳號
cd infra && docker compose up -d --no-deps adminer       # 讓 Adminer 讀到新名單
```

再跑一次同一個 Email 會換密碼並重設權限。DDL（`ALTER`、`DROP`…）不開放，結構變更走 migration。第一次執行時會產生 `TAG_ADMINER_SECRET`，同時寫進 `infra/.env` 與 `.env`，需重啟 gateway；`.env` 沒有這個值時 `/admin/db/` 不會掛上。

### 稽核紀錄

MariaDB 的 `server_audit` plugin 記下 `tag_observe`（應用程式）與 `healthcheck` 以外所有帳號的連線與 SQL（`infra/mariadb/audit.cnf`），寫在資料目錄的 `server_audit.log`（`infra/data/mariadb/`，100 MB 輪替、保留 10 份）。plugin 以 `INSTALL SONAME 'server_audit'` 安裝一次（存在 `mysql.plugin`），設定檔在 tag-db 下次重建時生效；在那之前用 `SET GLOBAL server_audit_*` 套用同樣的值。

```sh
docker exec tag-db tail -f /var/lib/mysql/server_audit.log   # 時間,主機,帳號,來源,連線,查詢編號,動作,資料庫,SQL,結果
```

手動改過標籤的文章記在 `article_tag_edits`：排程的 index（feed 標籤）、內文重試和從標題補標籤都不會再改它的標籤。管理員按「重抓這一篇」時會清掉這個標記，改用網頁上的標籤。排行與事件在下一輪計算時使用新標籤，已存的快照不會回頭改。

## 之後加管理功能

新的管理端點在 handler 開頭呼叫 `registerLogin()` 回傳的 `requireAdmin(request, reply)`：未登入回 401、非管理員回 403，通過時回傳目前使用者。管理頁面放在 `web/src/app/(site)/admin/`。
