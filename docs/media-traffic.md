# 媒體流量與收錄

`/media/sources/` 以清單呈現媒體 icon／名稱、本站收錄篇數與 Similarweb 流量；每列在流量欄顯示最近三個可取得月份的數值與迷你趨勢線。媒體名稱與 icon 連至站內；原表連結標示外連圖示。

## 閱讀方式

- 本站收錄固定顯示最新統計月份至今的已抓取篇數，欄頭列出年月；不是累計總量或媒體完整發稿量，不把缺資料當零。
- Similarweb 預設最新匯入月份，表格同時顯示最近三個可取得月份，可切換排序月份；欄頭清楚標示期間與原表值。它與收錄量是不同指標、可能不同月份，不是精確 page views，不計算每篇閱讀量或全台市占。
- 比照 `/media/` 一次列出全部媒體，不分頁；所有媒體均可搜尋，三個欄頭可以排序，缺值排最後。預設依本站收錄篇數降冪（`sort=articles&dir=desc`）。搜尋、排序及非最新的流量月份保存在網址；最新月份不帶 `month`，舊圖表參數不再使用。
- 缺少網域時，依來源對照表的官方網址及名稱登記檔的核對網址補顯示網域；不回寫歷史原表。未確認與已停用網域明確標註，發現來源也顯示網域。
- 使用本站現有媒體 icon 與深色主題設定；尚無圖檔者使用名稱首字的佔位圖示。

## Similarweb 資料

- 原始來源：[Similar Web 新聞](https://docs.google.com/spreadsheets/d/1B5RsSVZSrjKSUFDFZ-2VVlU3-tpTN49J1YzLGOohalM/edit?usp=sharing)。來源表維持唯讀。
- `app/data/media-traffic.json` 目前保存 202601–202608 明確標有「網站名」「流量」「成長」的工作表，最新月份含 198 原始列。每月取主題欄含「新聞」的列，包括缺流量者；`python3 tools/import-media-traffic.py --months auto` 會從公開匯出自動選取最新三個月份並保留既有歷史月份，產生新的候選快照。
- 更早工作表欄位定義不同，尚未匯入，不猜測流量欄位。每列保留列號、原名、網域、超連結、分類、名次、流量、成長與公式註記；只讀取匯出公式快取，不執行公式。
- 新聞流量欄未明示單位，因此顯示「原表值」，不推定百萬人次。小數最多七位，月增減依第一個「成長」欄。缺值、公式錯誤不補零。
- 名稱結尾 `/倍數` 或「原表流量公式：」註記表示人工調整。保留原值於資料與提示，但不作為流量數字顯示；例如 MSN 202607 的 `452.1*0` 不能當成真實零流量。URL 中的 `/17news` 不構成調整標記。
- `news-source-catalog.json` 的明確別名對應歷月媒體身份，詳見[來源對照](news-source-references.md)。品牌全站與新聞子頻道可能重疊：使用對照表明確命名的主要列，不相加；沒有主要列且多筆值相異時標示「待核對」。
- 流量匯入不修改政治分類；頁面亦不把人工政治標記當成 Similarweb 評分。既有覆蓋率的 29 家基準與排除規則仍由 `traffic-baseline.json` 控制。

## 本站收錄資料

- `/api/v1/media-traffic-comparison` 以台北時間的真實發布月份統計 `articles.source=own`，排除未取得日期而以抓取時間代填的紀錄及未來日期；不包含 legacy 匯入量。資料是目前已收錄紀錄，並非媒體完整發稿量。
- 本站自行抓取從 **2026-09-28** 開始；9/27 屬 legacy。每家媒體也有各自的 `firstAcquiredAt`。開始收錄前有文章的月份標示「補收」，沒有資料則留空；開始收錄後的零筆保留為零。第一個收錄月及當月均非完整期間。
- Google 新聞、動態網為發現來源，以 `article_discoveries` 關聯的原媒體文章計數；不改全文歸屬，也不重複計入全站篇數。
- API 提供原表月份與最近最多 24 個連續月份，較舊原表月份保留；四組批次查詢與 300 秒成功快取避免逐媒體查詢。前端最多等待 8 秒，API 失敗仍可查看流量數字，收錄欄顯示缺資料而非零。
- 全文保存期限不作為發稿月份或流量分母；流量資料與站內文章紀錄各自保留日期意義。

## 更新來源

需要 Python 3，無額外套件：

```sh
`python3 tools/import-media-traffic.py --months auto` 會直接抓公開試算表，偵測最新的三個 `YYYYMM` 工作表並更新候選 JSON，同時保留既有歷史月份；也可明列月份：

```sh
python3 tools/import-media-traffic.py --months 202608 202607 202606
```
```

可用 `--input /path/to/source.xlsx` 或 `--output /tmp/media-traffic.json` 先產生候選檔。`--months` 明列保留月份，不自行增加；完整驗證成功才寫入匯入時間、SHA-256、來源 URL 與月資料。

這個更新器抓的是公開的 Similarweb 整理表，不是登入瀏覽器外掛。Similarweb 外掛頁面需要使用者登入狀態，且沒有穩定、授權給伺服器使用的公開端點；把瀏覽器 cookie 放進 worker 會讓資料來源失效也會暴露帳號。若要拿到官方近即時的 visits／page views，應改用 Similarweb API 金鑰（API 的 quota 與方案由 Similarweb 控制）。Cloudflare Radar 可做網域相對熱度趨勢，但不提供單站絕對瀏覽人次，因此不能替代 page views。

檢查 diff 的月份、列數、缺值、人工調整及身份對照。原表插列可能改動對照表列號，必須核對，不能只覆蓋快照。分類或覆蓋率基準另行審核。

```sh
python3 -m unittest discover -s tools -p 'test_import_media_traffic.py'
npx vitest run app/test/media-traffic.spec.ts app/test/traffic-comparison.spec.ts app/src/v1/media-traffic-comparison.spec.ts app/src/crawl/traffic-coverage.spec.ts
```
