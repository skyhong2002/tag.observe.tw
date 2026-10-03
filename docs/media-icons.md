# 媒體圖示

現有 283 個圖示已逐一比對官方 favicon、touch icon、頁首標誌及可取得的品牌素材，儲存於 `web/public/favicons/`。輸出統一為 192 × 192 PNG，保留比例與原有透明度，供關係圖、媒體列表和文章頁共用。

來源與人工挑選結果記錄在 `app/data/favicon-local.json`：

- `source`、`fetchedAt`：實際下載網址與日期。
- `sourceWidth`、`sourceHeight`：原圖尺寸；輸出為 192px 不代表小原圖增加了細節。
- `transparent`：來源圖本身是否透明。優先選擇原生透明標誌，保留品牌原有色塊；沒有以色鍵去背刪除標誌內的白色。
- `curated`：已人工比對的來源。更新工具會固定使用此網址，下載失敗或尺寸下降時保留舊檔，不自動改用其他 favicon。
- `revision`：PNG 內容的 SHA-256 前 12 碼。API 與前端以此更新圖片 URL，避免舊快取。
- `dark`：`invert` 僅用於經檢查的單色深色標誌；`outline` 在深色背景替深色筆畫加淡描邊，維持彩色標誌的原色。原始圖檔維持原色與透明度。
- `note`：特殊選擇原因及原圖解析度限制。

原生透明素材包括華視新聞、聯合新聞網、工商時報、國家地理、硬是要學等。BBC 改用帶字母的標誌，Everyday Object 改用官網的 EO 標誌，避免原 favicon 的黑塊。蘋果仁目前官方宣告的圖示就是藍色人像，採用其 512px 原檔，未臆造替代商標。

少數標誌來自維基媒體，來源頁如下；品牌權利仍屬各媒體：

- [BBC Logo 2021](https://commons.wikimedia.org/wiki/File:BBC_Logo_2021.svg)
- [中央通訊社](https://zh.wikipedia.org/wiki/File:Central_News_Agency_logo.svg)
- [中視新聞](https://zh.wikipedia.org/wiki/File:CTV_News_logo.png)
- [中天新聞](https://zh.wikipedia.org/wiki/File:CTI_News_Logo.jpg)

部分網站封鎖自動下載或沒有發布較大的獨立標誌。目前仍有 57 個來源小於 64px，已在 `note` 標示；日後取得更佳素材時更新來源再重新下載。新增但尚未人工檢查的媒體仍使用既有的圖示 fallback。

```sh
node tools/fetch-favicons.ts bbc cts udn  # 更新指定來源
node tools/fetch-favicons.ts --all       # 更新全部；保留人工選擇
npx vitest run app/test/media-icons.spec.ts
```

更換來源後應同時檢查 24px、64px 在白底與深色底的顯示效果；不要只依網址中的尺寸或有無 alpha channel 判斷品質。資料抓取的頁首也可能包含合作方、社群平台、廣告或紀念活動標誌，須先人工確認品牌。

## 本次覆蓋與缺漏

共 283 個本地圖示，其中 173 個來源具有原生透明度。含原有 142 個圖示的品質整理，以及新增媒體來源的 141 個圖示。

下列 8 個已登錄來源尚未取得可確認的品牌圖示，保留既有文字備援；不以其他媒體或平台圖示代替。

| 來源 | 狀態 |
| --- | --- |
| 蘋果日報 (`apple`) | 已檢查官網、宣告圖示及圖示快取，未取得可驗證的媒體標誌。 |
| tnews 大台灣新聞 (`tnews`) | 已檢查官網、宣告圖示及圖示快取，未取得可驗證的媒體標誌。 |
| 台灣海外網 / 20 (`taiwanus`) | 已檢查官網、宣告圖示及圖示快取，未取得可驗證的媒體標誌。 |
| 無界 /5 (`wujie`) | 來源清單沒有可確認的官方網址。 |
| 中華鱻傳媒 ccsn0405 (`ccsn0405`) | 官網只提供 Blogger 通用圖示；保留名稱備援。 |
| 恆春半島 jdanews.com (`jdanews`) | 已檢查官網、宣告圖示及圖示快取，未取得可驗證的媒體標誌。 |
| 自立晚報 idn.com.tw (`idn`) | 已檢查官網、宣告圖示及圖示快取，未取得可驗證的媒體標誌。 |
| amm新聞 ammtw.com (`ammtw`) | 已檢查官網、宣告圖示及圖示快取，未取得可驗證的媒體標誌。 |
