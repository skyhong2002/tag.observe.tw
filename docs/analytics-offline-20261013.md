# GA 撤回合成流量後的驗收

使用者選擇維持 DNT、等待一般訪客的自然流量。本次起不關閉瀏覽器 DNT，不繞過 webdriver、bot、GPC、opt-out，不向正式 GA property 送任何合成事件。沒有更改正式隱私判斷或 GA 後台設定。

## 先前已送出的流量

先前確實送出了合成流量，對造成資料污染致歉。保留的紀錄可還原 UTC 2026-10-12 17:17:24.257–17:23:16.014、17:54:11.041–17:56:39.387 的 31 筆請求，包括 page_view、select_content、web_vital，以及沒有 GA 識別／事件欄位的連線探測。另有較早 debug log 記錄 4 筆（首頁 page_view 兩筆、web_vital 一筆、空探測一筆），檔案最後修改時間為 UTC 17:16:13.785，未記逐筆 UTC，不能補造精確時間。未留存的請求無法排除，因此 35 筆是從現存紀錄還原的數量，不聲稱是絕對完整總數。

[去識別明細](analytics-synthetic-disclosure-20261013.json) 只保留 UTC、en、dl/dr 的 path+query、dt 和可取得的 HTTP 狀態，沒有 cid/sid。來源重複檔案已去重。HTTP 204 只代表請求的網路回應，不證明 GA 後台報表已收錄。舊驗收文件加上撤回註記，沒有抹去歷史紀錄；不自行刪改 GA 後台資料。

## 純程式驗收

UTC 2026-10-12 18:05:47–18:05:50：analytics-consent、analytics-runtime、tracking-availability、reader-presence **40 項通過**；同輪 API 文件一致性 13 項通過。另以 in-memory window/history/dataLayer 和不載入外部腳本的 loadScript stub 記錄 **22 個情境**，fetch 明確禁止。使用測試 measurement ID，不啟動瀏覽器、不修改任何瀏覽器設定檔。結果見 [離線呼叫 JSON](analytics-offline-20261013.json)。

| 情境 | 程式行為／提供給 gtag 的欄位 |
| --- | --- |
| 首頁落地 | config 一次；page_location=`https://tag.observe.tw/`、page_title=`新文易數`；referrer 僅 origin |
| history 切公開標籤頁、上一頁 | 更新 set 的公開 path；不重複 config、不手動 event page_view |
| 私人頁落地 | `/admin/*`、`/login`、`/me`、`/my/*`、`/observe/opt-out/`、`/search`、`/article/query` 均不載腳本、零命令／事件 |
| 自由文字或其他 query | 目前採更保守的空白名單：帶任何 query 的頁面都不量測，包含 q/query/search/credit；欄位不含 query/fragment |
| 已配置 GA 的公開 document 切私人頁再返回 | 在 history 更新前停送；同一 document 保持停送，防 Google enhanced history 把前一私人 URL 帶入 dr |
| 私人落地首次轉公開頁／新的公開 document | 可開始一次 config；referrer 僅 origin，不含搜尋字串或私人頁 path/title |
| liveboard、liveboard/setting | page_title 固定 `即時看板`，不讀 document.title 的設定狀態 |
| DNT、GPC、webdriver、bot、opt-out | 所有情境 blocked=true，零腳本／零命令／零事件 |

這些是程式行為證據，**不是 Google 實際收到事件的證據**。Google 腳本自己的 enhanced history 事件數與欄位不可由 mock 證明；GA 實際收到與否沿用後台既有 Realtime 驗證，以及後續未開 DNT 的自然訪客流量。本次沒有新送 g/collect。

程式來源：`web/src/lib/analytics-consent.mts`、`analytics-runtime.mts`；單測來源：`app/test/analytics-consent.spec.ts`、`analytics-runtime.spec.ts`、`tracking-availability.spec.ts`、`reader-presence.spec.ts`。4aa4d41 admin 修正來源與事後審查仍見 [原驗收紀錄](analytics-privacy-20261012.md#4aa4d41來源與補審)：共用 Git 作者無法識別 thread，主 checkout 五個未提交檔案沒有混入。
