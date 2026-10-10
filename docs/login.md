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

這些路徑不在 `/api/` 底下，因此沒有公開 API 的 `access-control-allow-origin: *`。

## 資料

- `users`：Google `sub`、Email、名字、大頭貼網址、首次與最近登入時間。
- `user_sessions`：只存 session cookie（`tag_session`，HttpOnly、SameSite=Lax、HTTPS 時 Secure）的 SHA-256；過期列在下次有人登入時清掉。

## 之後加管理功能

新的管理端點在 handler 開頭呼叫 `registerLogin()` 回傳的 `requireAdmin(request, reply)`：未登入回 401、非管理員回 403，通過時回傳目前使用者。管理頁面放在 `web/src/app/(site)/admin/`。
