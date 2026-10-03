# 新聞修復對話自動續跑

`tools/watch-news-thread.mjs` 監督本機 T3 對話
`2a7609c4-4904-4604-b0aa-16e297e96559`。每分鐘讀取唯讀狀態，對話閒置、
中斷或失敗後透過 T3 的正常 `orchestration.dispatchCommand` 介面續跑。
運作中的對話不重複啟動；兩次續跑至少間隔五分鐘。每次附上使用者授權的
多模型／子代理分工，以及最新舊文收錄規則。

本機設定、token 與執行狀態位於已忽略的 `artifacts/news-thread-watchdog/`。
token 透過 `t3 auth session issue` 建立，有效期限 30 天；到期需重新簽發。
憑證只會傳往 loopback T3 服務。T3 資料庫僅供讀取，不直接修改對話資料。
傳送前先保存 command ID，傳送結果不明時重用同一 ID 並查核 receipt，避免重複送出。

安裝的 systemd user timer 為 `news-thread-watchdog.timer`。本機／T3 必須運作；
主機關機期間不會執行，重新開機登入後 timer 恢復檢查。

```sh
systemctl --user status news-thread-watchdog.timer
journalctl --user -u news-thread-watchdog.service -n 20
# 停止自動續跑
systemctl --user disable --now news-thread-watchdog.timer
# 驗證監督器
node --test tools/watch-news-thread.test.mjs
```

完成時原對話須先更新逐站入庫／站內閱讀證據，再把 `state.json` 的 `stopped`
設為 `true`，並填入 `completionEvidence`。監督器不自行判讀「已啟用」為成功。
待使用者輸入或核准時不自動續跑；最新使用者訊息以「停止／暫停／不要再／stop／pause」
開頭時也會停止。其他停止表述由原對話處理，或直接停用 timer。

手動設定 `stopped=false` 並啟動 timer 可恢復監督。`--steer` 僅供明確傳遞新指示，
可向執行中的對話送入訊息，不用於 timer 的例行檢查。
