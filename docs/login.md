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
| `GET /auth/admin/media/:media/taiwan-share` | 管理員限定：這家媒體目前的台灣占比修正與最近 20 筆修改紀錄。 |
| `PUT /auth/admin/media/:media/taiwan-share` | 管理員限定、需本站 `Origin`：`{ share, note }` 以 0–1 的值取代 Similarweb 的台灣占比（理由必填），`share: null` 清除；寫入 `media_taiwan_share_log`（[媒體流量](media-traffic.md#台灣占比與台灣讀者)）。 |

### 讀者端點

以下都需要登入（未登入回 401），寫入需本站 `Origin`，回應一律 `cache-control: no-store`（`app/src/reader/routes.ts`）。

| 路徑 | 說明 |
| --- | --- |
| `GET/PUT /auth/me/follows` | 追蹤清單。`PUT { kind, target, follow }`：`kind` 為 `tag`、`media`、`journalist`、`event`（事件以 thread id），每人最多 200 項。 |
| `GET /auth/me/feed` | 我的動態：近 7 天符合追蹤標籤、媒體、記者的報導（最多 150 篇，排除隱藏的媒體），加上追蹤事件的最新標題。 |
| `GET /auth/me/suggestions` | 推薦追蹤：`starter`（焦點事件、升溫標籤、熱門媒體）、`related`（依已追蹤項目）、`reading`（只在開啟閱讀紀錄時有值，含 `otherSide`）。見下方〈推薦〉。 |
| `GET/POST/DELETE /auth/me/feed-token` | 私人 RSS 網址 `/feeds/u/<token>.xml`；`POST` 建立或換新（舊網址立刻失效），`DELETE` 停用。 |
| `GET/PUT /auth/me/saves` | 收藏。`PUT { kind: 'article' \| 'event', id, saved, note? }`，註記最多 500 字，每人最多 500 項。 |
| `GET/PUT /auth/me/prefs` | 偏好（部分更新）：`theme`（`light`、`dark`、`null`）、`analyticsOptOut`、`hiddenMedia`、`history`。`history: false` 會刪除閱讀紀錄。 |
| `POST /auth/me/history`、`DELETE /auth/me/history`、`GET /auth/me/history/report` | 閱讀紀錄（`history` 開啟才記錄 `{ articleId }`）、清除、近 30 天報告。 |
| `GET/POST /auth/me/api-keys`、`DELETE /auth/me/api-keys/:id` | 個人 API 金鑰，每人最多 3 把；`POST { label }` 回傳的 `key` 只出現這一次。 |
| `GET/POST /auth/me/reports` | 回報文章錯誤：`{ articleId, kind: 'tags' \| 'byline' \| 'media' \| 'other', tags?, message }`，每人每天最多 20 次。 |
| `GET /auth/admin/reports?status=open` | 管理員限定：讀者回報與待處理數。 |
| `PUT /auth/admin/reports/:id` | 管理員限定、需本站 `Origin`：`{ status: 'accepted' \| 'rejected' \| 'open', resolution? }`。套用建議標籤走 `PUT /auth/admin/articles/:id/tags`（`/admin/` 的「套用建議標籤並採納」兩個都會呼叫）。 |

這些路徑不在 `/api/` 底下，因此沒有公開 API 的 `access-control-allow-origin: *`。

## 資料

- `users`：Google `sub`、Email、名字、大頭貼網址、首次與最近登入時間。
- `user_sessions`：只存 session cookie（`tag_session`，HttpOnly、SameSite=Lax、HTTPS 時 Secure）的 SHA-256；過期列在下次有人登入時清掉。

## 讀者功能（`/my/`）

讀者登入後，帳號選單多出「我的動態」「我的收藏」「閱讀報告」「設定」。頁面都是靜態的，資料在瀏覽器向上面的 `/auth/me/*` 取得；`/my/` 與 `/feeds/u/` 列在 robots.txt 的 Disallow，頁面也設 noindex。

- **追蹤**：標籤、媒體、記者頁標題旁，以及事件頁有「追蹤」按鈕；未登入時按鈕會帶去登入再回到原頁。`/my/following/` 可以直接輸入標籤追蹤。
- **我的動態**（`/my/`）：追蹤事件的現況，以及近 7 天的相關報導，每篇標出是哪個追蹤帶進來的；「隱藏這家」把媒體加進 `hiddenMedia`。
- **推薦**（`app/src/reader/suggestions.ts`）：還沒追蹤任何東西時，「我的動態」改成「從這裡開始」：最新一小時事件表的前 8 個事件、排行（新聞類）中至少 3 家媒體報導且爆發力最高的 12 個標籤，以及這些熱門標籤報導量最多的 12 家媒體；追蹤至少一項後按按鈕進入動態。這部分對所有人相同，快取 5 分鐘。已有追蹤時，動態下方列出：
  - 你可能也想追蹤：已追蹤標籤近 7 天共同出現至少 3 篇的標籤（沿用 `loadRelatedTags`）、已追蹤記者近 14 天至少 2 篇的標籤（每個名字快取 6 小時，因為是 LIKE 掃描）、已追蹤事件的主要標籤。
  - 你常讀但還沒追蹤（需開啟閱讀紀錄）：近 30 天讀過至少 2 篇的標籤。
  - 換個角度看（需開啟閱讀紀錄）：近 30 天讀的藍綠報導至少 5 篇、其中一方占 75% 以上時，列出另一方媒體近 3 天對讀者最常讀的 10 個標籤的報導（排除讀過的，先每個標籤一篇，最多 6 篇）。
  - 探索今天的熱門：同上方的開始清單，預設收合。
  雜訊標籤（`isTagNoise`）與媒體自己的品牌標籤不推薦；已追蹤的項目不再出現。
- **私人 RSS**：`/my/settings/` 建立。token 以明文存在 `user_feed_tokens`，讓設定頁能再次顯示網址（外流頂多洩漏追蹤清單）；`cache-control: private`。
- **收藏**：文章頁與事件頁的「收藏」，`/my/saved/` 可加註記。
- **偏好同步**：右上角深淺色切換與 `/observe/opt-out/` 的統計退出，登入時存進 `user_prefs`。帳號裡已有值時以帳號為準，第一次則把這個瀏覽器的設定存上去（`web/src/components/reader/PrefsSync.tsx`）。
- **閱讀報告**（`/my/reading/`）：預設關閉。開啟後，登入時打開本站文章頁（`/article/<id>/`）才會記錄，到原站閱讀不會；報告列出近 30 天的媒體、藍綠陣營（依媒體標籤，兩個都勾算藍營）、來源國家與常見標籤。關閉時刪除所有紀錄。
- **API 金鑰**：只存 SHA-256（`user_api_keys`）。gateway 的 rate limit 遇到有效的 `x-api-key` 時改用 `key:<id>` 計數，每分鐘 1000 次（沒帶金鑰時每個 IP 60 次）；查詢結果快取 60 秒，所以撤銷最晚 1 分鐘後在其他程序生效（同一個程序立即生效），`last_used_at` 每 10 分鐘最多更新一次（`app/src/reader/api-keys.ts`）。
- **回報錯誤**：文章頁「回報錯誤」可選標籤（附建議的完整標籤）、署名、媒體歸屬或其他。`/admin/` 最上方的「讀者回報」列出待處理項目，標籤回報會標示建議新增與移除的標籤；讀者在 `/my/settings/` 看得到處理結果與管理員的說明。

資料表（migration `0025_reader-accounts`）：`user_follows`、`user_saves`、`user_prefs`、`user_feed_tokens`、`user_api_keys`、`reader_history`、`reader_reports`，全部以 `user_id` 對應 `users.id`。

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
