# 搜尋與分享預覽

- `web/src/lib/seo.ts` 統一 canonical、Open Graph URL、標題與描述；主要索引頁與事件、標籤、媒體、記者、議題／專題媒體頁均有專屬 metadata。
- Canonical 去除排序、顯示方式、UTM 等變體，保留排行榜分類、事件存檔日期／小時與媒體文章分頁游標。媒體站內搜尋變體與全站搜尋頁不建立索引。
- 根 layout 提供 WebSite JSON-LD；事件、標籤及媒體頁提供麵包屑。標籤頁的 ItemList 對應畫面上前十篇報導，不宣稱本站為原始新聞出版者，也不把新聞事件誤標成可參加的 Event。
- JSON-LD 使用 JSON 序列化並跳脫 `<`；頁面資料不直接拼接成 HTML。

## 分享卡片成本

事件、標籤使用 `next/og` 在伺服器產生 1200×630 PNG，只有抓取分享圖片時才執行。使用固定文字版型與本機中文字型，不啟動瀏覽器、不畫即時圖表，也不抓取新聞配圖。其他頁面保留全站預設圖；文章頁保留既有配圖設定。

路由明確設定 `force-static` 與 6 小時 revalidate；瀏覽器快取 1 小時，共用快取 6 小時。卡片不放即時數字，避免快取期間的數字被誤認為目前值。社群平台另有自己的快取，重新部署不保證既有貼文立刻換圖。

圖片網址交由 Next 的檔案 metadata 產生（含 route group 的雜湊），不要自行猜測 `/opengraph-image` 路徑。字型約 7.1 MiB，只部署在伺服器；一般網頁不下載它。代表性標籤卡片本機實測約 42 KiB，首次生成約 270 ms，Next 快取命中約 4 ms；實際成本視標題長度、API、機器負載及冷啟動而變化。

## 驗收

檢查 SSR HTML 的 canonical、description、og:url、og:image、twitter:image，以及 JSON-LD 是否可解析；測試中文參數、日期／分類與 UTM 的正規化。沿著實際圖片 metadata URL 取圖，確認回應為 1200×630 PNG、中文字可讀、standalone release 包含字型、重複請求命中快取。不存在的事件／標籤不應產生任意內容卡片。

GSC 可針對首頁、排行榜、事件及標籤重做 URL 檢查。麵包屑／結構化資料是否顯示搜尋強化項目由 Google 決定，不保證收錄、排名或 rich result。
