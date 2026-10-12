# GA 優先驗收：實際切頁與去識別 Network

UTC 2026-10-12 **17:54:10–17:56:41**，正式 release `adf47ee84fda870592bdf50d42694a1e396bcb5c`，包含4aa4d41；`git diff 4aa4d41..adf47ee -- web/src/lib/analytics* web/src/components/SiteAnalytics.tsx web/src/components/ReaderPresence.tsx` 為空。沒有為驗收降版。依使用者指示採主機上的獨立 Chromium、一般 UA、DNT=0/GPC=false 測試設定檔，沒有修改正式 DNT 判斷。

以下均為真實 Google g/collect，回應 HTTP 204。只保存 en、dl 的 path+query、dt、dr 的 path+query、UTC 和 HTTP 狀態；cid/sid 在擷取時直接丟棄，不寫入任何報告。完整逐筆紀錄（包括公開頁的自訂事件和無欄位連線探測）見 [Network JSON](analytics-priority-network-20261013.json)。

| UTC（2026-10-12） | 操作 | en | dl（去 host） | dt | dr（去 host） |
| --- | --- | --- | --- | --- | --- |
| 17:56:03.285Z | 首頁落地 | page_view | / | 新文易數 | 未送出 |
| 17:56:11.782Z | 點站內標籤連結，同一 document | page_view | /tag/%E6%B2%88%E4%BC%AF%E6%B4%8B/ | 新文易數 | / |
| 17:56:19.352Z | 瀏覽器上一頁 | page_view | / | 新文易數 | /tag/%E6%B2%88%E4%BC%AF%E6%B4%8B/ |
| 17:56:39.387Z | 實際搜尋表單送出「測試」後按上一頁 | page_view | / | 新文易數 | 未送出 |
| 17:55:24.676Z | 開 /liveboard/ | page_view | /liveboard/ | 即時看板 | 未送出 |

- `/search/?q=測試` 實際切入及直接落地：零 collect（含空白連線探測）。搜尋返回的 dl/dr 沒有 q 或任何 query。
- `/admin/`：17:54:59–17:55:06，零 collect、零 Google 腳本。
- `/login/`：17:55:07–17:55:14，零 collect、零 Google 腳本。
- `/observe/opt-out/`：17:55:14–17:55:22，零 collect、零 Google 腳本。
- 公開路徑上述各一次 page_view，沒有重複。這份實測透過真實表單導頁，不把 history.pushState 模擬操作當成表單行為。

初次測試把「按下搜尋送出」當成私人頁計數起點，在 URL 尚未抵達私人頁的等待期看見一筆無任何 GA 欄位的 endpoint probe；因當時未保存 requestPath，未把它當作已驗證的私人頁請求。第二次補記每個 request 的實際 path，確認搜尋頁期間連 probe 都沒有。公開頁的 probe 仍在 JSON 中列明，沒有刪去不便的資料。

先前的純 SPA 私人 history 測試仍適用保守 taint 規則：已載 Google 的 document 一旦切到私人 URL，該 document 後續停送；真實搜尋表單／瀏覽器返回本次產生了乾淨的公開頁 page_view。不可將兩種 navigation 方式混稱為相同行為。未聲稱已操作 GA 後台 DebugView，以上 UTC 可供後台比對。

## 4aa4d41 admin 修正

不是本工作的提交。Git author／committer 都是共用 Sky Hong，沒有 thread/session 身分，無法僅憑 Git 指定是哪位協助者。它只改 `app/src/tag-groups/relations.ts`：先求符合標籤的文章候選 ID，再 join articles；參數綁定、管理員驗證、UNION 去重、游標與 no-store 皆保留。

已事後補審，UTC 17:18:30 獨立 MariaDB fixture 的 writing.spec.ts 6 項通過；沒有證據宣稱另一工作部署前已做哪些審查。主 checkout 原先五個未提交檔案仍原樣存在，8df2828..4aa4d41 的這五個路徑沒有提交，沒有混進 release。詳細檔案清單與審查限制见 [前次紀錄](analytics-privacy-20261012.md)。
