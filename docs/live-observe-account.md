# 原站帳號與跨裝置設定

2026-10-25。對應原站基底 `6d52a1626374391aea80073d92c7f8fd95d978e3`。

## 登入與儲存契約

瀏覽器沿用 `tag.observe.tw` 的 host-only、HttpOnly、SameSite=Lax `tag_session`。不擴大 cookie 網域、不向 live 伺服器傳送登入 token。本站 CSP 允許連接原站，帳號請求使用 `credentials: include`；原站只對 `https://live.observe.tw` 的指定帳號介面開 credentialed CORS。

登入入口為 `https://tag.observe.tw/auth/google?next=https%3A%2F%2Flive.observe.tw%2Fliveboard%2Fsetting%2F`。Google callback 保持原站；登入後只允許返回 live 首頁或設定頁。登出使用原站 `POST /auth/logout`，會登出同一帳號工作階段。

原站新增：

- `GET /auth/me/live-observe`：登入者的 `{settings, revision, updatedAt}`。尚未有本站設定時為 null；若有原版 `liveboard` 偏好，另回傳 `legacy` 供首次載入。
- `PUT /auth/me/live-observe`：JSON `{userId, revision, settings}`。首次 revision 為 null，之後必須帶上讀取的 UUID。userId 必須符合目前 session。成功回傳新的 revision 與時間；版本或帳號不符回 409。
- `settings` 是完整的 33 欄設定，包含來源、27 鏡頭、卡片順序、歷史、樣式、配色與內容篩選；欄位與大小均經驗證。
- `OPTIONS` 僅接受上述 live origin 的 GET/PUT、Content-Type；`/auth/me` 僅 GET，`/auth/logout` 僅 POST。既有 `/auth/me/prefs` 不開跨站寫入。

設定存於既有 `user_prefs.prefs.liveObserve`：`{version:1,settings,revision,updatedAt}`，不需新增資料表。原站原有 `liveboard`、theme、history 等欄位保留；兩種設定 writer 共同鎖住 users 資料列，再讀取、合併並寫入，避免初次儲存與跨裝置同時寫入互相覆蓋。

## 瀏覽器行為

- 未登入：使用原有裝置儲存、分享及匯入／匯出。
- 已登入：首次載入帳號設定並保留裝置副本；設定頁按儲存後同步；看板操作延遲 650ms 合併上傳。可見頁面每 60 秒、回到線上或 BFCache 恢復時重新同步。
- 草稿與預覽不自動上傳。URL 設定優先於帳號設定，只有明確儲存才改帳號。
- 離線變更與基準 revision 存在獨立、綁定 userId 的待同步紀錄；恢復後只有帳號版本相同才上傳。
- 版本衝突或載入時已有未存草稿，提供「載入帳號設定」或「以此裝置設定更新帳號」。不自動覆蓋另一台裝置的新設定。
- 偵測帳號切換，舊帳號的待同步資料不會上傳至新帳號；PUT 再驗證 userId，以防 session 在讀寫之間切換。
- 本機儲存不可用時仍可載入帳號；已登入者可儲存帳號版本並收到裝置副本無法保留的提示。

## 驗證與部署狀態

- live：15 項同步測試，涵蓋雙裝置、完整設定、離線恢復、衝突、晚到回應、帳號切換與登出；全套 180 項（179 通過，1 opt-in 外網測試略過）。
- 原站：登入/API/CORS/DB 並行 14 項通過；既有 reader 真實 DB 回歸 13 項通過，TypeScript、限定變更檔案 Biome 檢查通過。使用獨立 MariaDB 10.11.14 測試資料庫。
- 瀏覽器：實際設定頁配模擬帳號服務，修改 scale 後儲存，再以獨立 incognito profile 讀到同一版本。這不等於正式 Google 帳號已驗證。
- 原站程式位於 `/home/sky/Projects/tag-live-account-integration`，分支 `live/account-sync-20261025`。原站部署尚待 `deck@skyhong-sm` 的 Tailscale SSH 額外驗證；此狀態下正式帳號同步尚未開通。

部署順序：先部署原站 backend，再驗證正式 OPTIONS/CORS、登入返回與帳號 API，最後驗證 live 的真實登入與跨裝置同步。原站部署應使用隔離 release，保留既有 Next UI、worker、環境與回滾路徑；不要重設共享 checkout。
