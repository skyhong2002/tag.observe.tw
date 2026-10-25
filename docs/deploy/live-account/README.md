# live.observe.tw 帳號 API 部署紀錄

2026-10-25 18:42（Asia/Taipei）。

- 看板 live.observe.tw 仍在 Mint-MBP，`live-observe.service`、127.0.0.1:3000，應用版本 `39e9296`。
- 原站 gateway 在 skyhong-sm；由 `6d52a1626374391aea80073d92c7f8fd95d978e3` 更新為 `fdf8b8bf50443db57eccd384c79c730eb4d2a528`。後者已推送 `origin/main` 與 `origin/live/account-sync-20261025`。
- 僅六個 runtime 帳號檔案變更，package/lock/web/app data 與基底相同。使用部署鎖，以 hardlink 複製不可變 release；覆蓋前先 unlink 六個檔案及 COMMIT，避免更動舊 release。候選 Chromium、306 個圖示、gateway/legacy/source-path smoke 通過後才原子切換 current。
- 只重啟 `tag-analysis.service`。gateway PID 3572653；web PID 3041602、worker PID 3041616 保持不變，所有服務 active。共享專案 checkout 沒有修改。
- 舊 release 完整保留；部署腳本含失敗時回復 current 與重啟 gateway 的流程，未修改 systemd unit、環境、cookie 網域或資料表 schema。

## 正式入口驗證

- 原站 `/auth/me`：200，僅 live origin 的 credentialed CORS。
- `/auth/me/live-observe` OPTIONS：204，允許 GET/PUT、Content-Type。
- 未登入 GET/PUT：401；不受信任 Origin 的 PUT/OPTIONS：403、無允許來源 header。
- 既有 `/auth/me/prefs` 仍要求登入；原站首頁：200。
- 從正式 live 設定頁瀏覽器，credentialed fetch 成功得到 `enabled:true,user:null`；帳號區正確顯示「未登入」與登入連結。
- 實際點擊登入後到達 Google 帳號輸入頁，使用原站 callback 與 live 設定頁返回目標。瀏覽器沒有已登入 Google 的測試身分；沒有代填使用者帳密。因此正式個人帳號的 OAuth 完成、帳號儲存與第二台實體裝置讀回仍待使用者實測。
- 前一輪隔離 MariaDB、API、模擬 Google callback 與兩個獨立 browser profile 的讀寫／衝突測試見 `docs/live-observe-account.md`。

`deploy-20261025.sh` 是這次已執行腳本的快照，不是通用安裝器；依賴 `/tmp` 中由該 git commit 封存的六檔 archive、sha256 manifest 與原版 `tools/release-smoke.js`。其 base precondition 可防止在別的版本上誤用，已部署後不應重跑。
