# 媒體來源與流量

公開頁面 `/media/sources/`：月份切換、原表分類篩選、媒體／網域搜尋、欄位排序、前十名流量橫條圖。`/media/` 與來源頁共用媒體分頁導覽。

## 資料與口徑

- 原始來源：[Similar Web 新聞](https://docs.google.com/spreadsheets/d/1B5RsSVZSrjKSUFDFZ-2VVlU3-tpTN49J1YzLGOohalM/edit?usp=sharing)。來源表維持唯讀；更新本站不修改 Google Sheet。
- `app/data/media-traffic.json` 保存 202601–202608 明確標有「網站名」「流量」「成長」的工作表。每月取主題欄含「新聞」的列，包含缺流量的來源；預設顯示原表全部新聞來源（202608 共 198 列）；仍可切換 `traffic-baseline.json` 的 29 家歷史基準。
- 其他舊月份的欄位與定義不同，尚未匯入。匯入器遇到無法確認的欄位就失敗，不猜測「網站」等欄位是流量。
- 每列保留工作表列號、媒體原名、原始網域、儲存格超連結、原始分類、原表名次、流量、月增減與相關公式註記。原始公式只保存成文字；顯示值來自 Google 匯出的公式快取，不在本站求值。
- 沒有網域的歷月資料以 `news-source-catalog.json` 的明確別名對照，包含「中天」「民視」舊名；官方核對網址另列，不把現有網域寫回歷史紀錄。197 個去重來源涵蓋最新 198 列與歷史獨有來源；詳見 [來源對照](news-source-references.md)。
- 流量未推定單位。保留匯出數值精度，頁面顯示至小數七位；月增減依原表第一個「成長」欄、以百分比顯示。缺值、公式錯誤不是零。原表 `/倍數` 等人工調整不還原。
- 顯示的「原表分類」屬所選月份；「本站目前分類」直接讀 `media-catalog.json`。基準 29 家於 `traffic-baseline.json.retrievedAt` 所示日期採用試算表分類；其他媒體保留既有設定。匯入流量不自動修改政治分類。
- 爬蟲驗證讀取 `news-crawl-audit.json`，提供狀態篩選、驗證時間、發現方式、失敗說明與實際文章樣本。只有官方入口吻合且確有近期標題、日期、內文樣本才顯示成功；未驗證與失敗仍保留在名單。
- 本站收錄狀態獨立讀取 `/api/v1/media-stats`，沿用其 120 秒快取，請求最多等待 4 秒；服務失敗時仍可查看來源快照。收錄狀態是目前資料，不是歷史月份的收錄情況。
- 此頁不計算全台市占；網域與子網域可能重疊。既有爬蟲流量覆蓋率的分母、三位小數精度與排除規則仍由 `traffic-baseline.json` 控制，不能拿此頁篩選後數值替換。

## 人工更新

需要 Python 3，無額外套件。從專案根目錄執行：

```sh
python3 tools/import-media-traffic.py --months 202608 202607 202606 202605 202604 202603 202602 202601
```

也可以用 `--input /path/to/source.xlsx` 讀取已下載的原始匯出，或 `--output /tmp/media-traffic.json` 先產生候選檔。`--months` 明確列出要保留的工作表，不會自行加入新月份。正式輸出包含匯入時間、原始工作簿 SHA-256、來源 URL 與各月資料；整份解析驗證成功才寫入。

每次更新檢查 git diff，確認月份、列數、缺值、分類及人工調整。首次增加月份時也要更新頁面資料範圍說明與測試樣本。若分類或覆蓋率基準需更新，另行核對修改對應檔案，不能把流量匯入視為已審核分類變更。

```sh
python3 -m unittest discover -s tools -p 'test_import_media_traffic.py'
npx vitest run app/test/media-traffic.spec.ts app/src/crawl/traffic-coverage.spec.ts
```
