# 媒體流量與收錄

`/media/sources/` 同頁分欄呈現媒體、本站收錄篇數、Similarweb 自動抓取估算訪問量、Cloudflare Radar 全球排名／級距與 GeneHong 整理表。兩份月資料各自顯示最近三個可取得月份的數值與趨勢線；Radar 顯示最新一期排名。手機可橫向捲動表格。媒體名稱與 icon 連至站內；原表連結標示外連圖示。

## 閱讀方式

- 本站收錄固定顯示最新統計月份至今的已抓取篇數，欄頭列出年月；不是累計總量或媒體完整發稿量，不把缺資料當零。
- Similarweb 與 GeneHong 各自預設最新可取得月份，可分別切換排序月份；欄頭標示各自單位。它們與收錄量是不同指標、可能不同月份，不是精確 page views，不計算每篇閱讀量或全台市占。
- 自動抓取只顯示外掛來源的 `EstimatedMonthlyVisits`（估算訪問次數），缺資料留白；失敗時保留各網域最後成功資料與更新日期。GeneHong 原表歷史值在獨立欄顯示，不填入自動來源的缺值。舊 `source=reference` 網址也呈現全部來源。
- Radar 顯示全球 POPULAR 名次或「前 N 名」級距，標明 API 回傳期間與成功抓取日期；同級距無法判定先後，不提供精確排序，也不合計、換算成訪問量或瀏覽數。
- 比照 `/media/` 一次列出全部媒體，不分頁；搜尋與四個欄頭排序，缺值排最後。預設依本站收錄篇數降冪（`sort=articles&dir=desc`）。搜尋、排序及非最新月份保存在網址；Similarweb 使用 `month`，GeneHong 使用 `referenceMonth`。
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

`python3 tools/import-media-traffic.py --months auto` 會直接抓公開試算表，偵測最新的三個 `YYYYMM` 工作表並更新候選 JSON，同時保留既有歷史月份；也可明列月份：

```sh
python3 tools/import-media-traffic.py --months 202608 202607 202606
```

可用 `--input /path/to/source.xlsx` 或 `--output /tmp/media-traffic.json` 先產生候選檔。`--months` 明列保留月份，不自行增加；完整驗證成功才寫入匯入時間、SHA-256、來源 URL 與月資料。

這個整理表更新器仍依賴人工整理來源；自動抓取器則直接讀外掛資料。Similarweb 的 visits 是網域月訪問量估算，不是即時或逐篇 page views。Cloudflare Radar 的網域排名也不能換算為瀏覽人次。

### 自動抓取 Similarweb 外掛資料

`app/src/jobs/media-traffic-job.ts` 每小時第 35 分（可用 `MEDIA_TRAFFIC_CRON` 調整）呼叫外掛使用的公開 `data.similarweb.com/api/v1/data?domain=…` 端點，抓來源網域的 `EstimatedMonthlyVisits`，只保留近三個月份，結果寫在 Git 工作目錄外的 `TAG_MEDIA_TRAFFIC_FILE`（預設 `~/.local/share/tag-analysis/media-traffic-live.json`）。API `GET /api/v1/media-traffic-live` 提供狀態與各網域最近成功時間給頁面；自動抓取欄使用這份快照，`blocked`／`failed` 仍可顯示最後成功值。

- **請求標頭**：CloudFront 只放行外觀與外掛相同的請求，必須同時帶瀏覽器 User-Agent、`Origin: chrome-extension://hoklmmgfnpapgjgcpechhaamimifchmp` 與 `x-extension-version`（`extensionHeaders`）。缺任何一項都回 HTTP 403。外掛改版後若再度全面 403，先更新版本號重測。這是模仿外掛的非官方用法，Similarweb 可能隨時改變規則。
- **分批輪替**：2026-10-10 實測連續約 20 次請求後被 403 限流，約 11 分鐘後解除。每次排程只抓「到期」網域：從未成功者優先，其次是最舊資料；7 天內成功的不重抓，無資料的網域（記在快照 `failedAt`，不對外公開）一天後才重試。請求間隔 3 秒，收到 401／403／429 立即停止，下一小時從未完成處續抓；連續三次 HTTP／網路錯誤或批次超過五分鐘也停止。限流但已有進度的批次不算 job 失敗。
- 單網域驗證保留其他網域歷史快照，不覆蓋 GeneHong。

手動驗證單一網域：

```sh
node tools/media-traffic-once.ts udn.com
```

2026-10-09 不帶外掛標頭時此主機實測回 HTTP 403（CloudFront）。2026-10-10 補上外掛標頭後成功取得 udn.com、ettoday.net、news.ltn.com.tw 等網域 2026-07～09 的月訪問量估算；首輪抓到 22 個網域後被限流，其餘由每小時排程補齊。

### Cloudflare Radar 官方 API

- [授權文件](https://developers.cloudflare.com/radar/get-started/first-request/)要求 Custom API Token 權限 **Account → Radar → Read**。設定伺服器端 `CLOUDFLARE_RADAR_API_TOKEN`，勿使用 `NEXT_PUBLIC_*` 或提交 Token。Gateway 與 worker 都須載入同一設定。未設定時 API 明確回 `unconfigured`；worker 不排程，頁面不偽造排名。
- 端點是 `GET https://api.cloudflare.com/client/v4/radar/ranking/domain/{domain}?rankingType=POPULAR&format=JSON`，使用 Bearer Token。與 2026-10-10 官方 OpenAPI schema 核對 `result.details_0.rank`、`bucket` 與 `result.meta.dateRange[0]`。前 100 名以名次顯示，其餘 bucket 以「前 N 名」顯示；實測 `>200000` 另存為 `bucketLowerBound=200000`，顯示「未入前 200,000 名」，不能反轉成前 200,000 名。沒有排名與級距時留白。
- [來源方法](https://developers.cloudflare.com/radar/investigate/domain-ranking-datasets/)主要基於 1.1.1.1 DNS 查詢。精確前 100 排名包含最近 24 小時、每日更新；全球級距資料包含最近七天、每週更新。本站每日檢查不代表上游資料即時，也不產生三個月訪問量。
- `app/src/jobs/media-radar-job.ts` 使用與 Similarweb 相同的官方來源網域清單，排程預設 `MEDIA_RADAR_CRON=45 3 * * *`（worker 所在時區）。獨立快照為 `TAG_MEDIA_RADAR_FILE`，預設 `~/.local/share/tag-analysis/media-radar.json`，在 Git 工作目錄外。
- API `GET /api/v1/media-radar` 僅讀快照，回 `scope=global`、批次狀態與各網域的資料期間、成功更新時間；過濾排除媒體與發現來源，不公開 Token。錯誤摘要不包含上游回應內容或授權標頭。
- 失敗保留最後成功資料；401／403／429 停止整批，其他連續三次失敗或超過五分鐘亦停止。單網域驗證保留其他網域資料，不覆蓋 Similarweb 或 GeneHong。

```sh
node --env-file-if-exists=.env tools/media-radar-once.ts udn.com
```

2026-10-10 已在此主機 `.env` 設定 Radar Read Token，並以本專案抓取器完成 udn.com 真實資料驗證：全球前 20,000 名級距、無精確名次，API 標記資料日期為 2026-10-05（startTime 與 endTime 相同，不自行擴成七天期間）。實測也取得 ettoday.net 前 10,000 名與 news.ltn.com.tw「未入前 200,000 名」。預覽 API 已重啟載入 Token；頁面每次伺服器渲染直接讀取自動來源快照，不沿用舊的未設定狀態。正式服務的 release 尚未包含此整合，未部署前單純重啟正式服務不會啟用 Radar。

檢查 diff 的月份、列數、缺值、人工調整及身份對照。原表插列可能改動對照表列號，必須核對，不能只覆蓋快照。分類或覆蓋率基準另行審核。

```sh
python3 -m unittest discover -s tools -p 'test_import_media_traffic.py'
npx vitest run app/src/media-traffic/radar.spec.ts app/src/media-traffic/live.spec.ts app/test/media-traffic.spec.ts app/test/traffic-comparison.spec.ts app/src/v1/media-traffic-comparison.spec.ts app/src/crawl/traffic-coverage.spec.ts app/test/api-docs.spec.ts
```
