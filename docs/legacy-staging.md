# 母站封存資料適配新站

## 決策

沿用 nearline 原始封存，增加獨立的「整理候選資料」產物。原始 SQL 是可重跑的來源，整理後 JSONL 保留原始每列與來源追溯，符合格式的列仍只是候選，不等於已批准匯入正式 articles。

本階段已完成 **每媒體文章表的分包整理工具**，實跑 `tag_cna` 第一包 50,000 筆；沒有向正式資料庫寫入資料，也沒有修改線上的 retention 排程。備份與 10 小時觀察繼續執行。尚未把所有來源表自動接進整理排程，避免未確認語意的表被批次誤轉。

## 整理流程

```text
NAS 原始 SQL 物件＋manifest
  → fetch 指定表／分包，驗證 SHA-256、大小、gzip
  → SSD 上隔離 MariaDB，無網路、無排程，還原該包
  → 逐列 JSON 匯出（大整數主鍵保留字串）
  → 共用新站 urlKey、媒體設定與 normalizeTag
  → articles.jsonl.gz ＋ report.json ＋ source-manifest.json
  → NAS prepared/ 的獨立衍生資料
```

每包整理上限 256 MiB 原始 SQL；MariaDB 使用 1 GiB tmpfs、2 GiB 記憶體上限、1 CPU，結束移除容器。保留本機 10 GiB 空間。此工具目前只適用欄位與舊 `tag_cna` 類似的 `tag_<media>` 文章表；每個新媒體仍需抽樣審核。`tag_news` 等混合來源表不會自動推定媒體。

```sh
python3 tools/nearline/prepare.py \
  --package /home/deck/tag-analysis-private/nearline-drill-20261004/tag_cna \
  --media cna \
  --out /home/deck/tag-analysis-private/nearline-staging/new-output-directory
```

輸入是 `pipeline.py fetch` 的輸出目錄，輸出目錄須不存在或為空。腳本會先再次驗證檔案，再還原、轉換、核對還原筆數與輸出筆數。需要本機 Docker、mariadb:11.4 映像、Node 24、gzip 與專案相依套件。工具不需要正式資料庫帳密。

## 欄位語意

| 母站資料 | 整理後資料 | 規則 |
| --- | --- | --- |
| table + newsid | lineage.sourceKey | 保存母站／資料庫／表／舊 ID；不拿舊 ID 覆寫新站 articles.id，也不誤當 media_id |
| SQL 分包 | lineage.generation / objects | 指回已驗證的 NAS 原始物件；source-manifest 另存主鍵範圍與擷取時間 |
| create_time | article.publishedAt | 對本試點的現代台灣日期以 UTC+08 轉 UTC；零日期、1970、非法日期、超出擷取時間一天的未來日期進隔離 |
| ctime | article.crawledAt | 保留原站收錄時間，不把搬資料日期偽裝成收錄日期；原值無效則隔離 |
| url | article.url / urlKey | 使用新站來源設定與同一套 urlKey；檢查 http(s)、帳密與媒體網域。歷史別名需明確審核，不自動接受其他媒體網址 |
| tags | article.tags | 解析 `[詞][詞]`、沿用 normalizeTag、去除同列重複詞 |
| tags_cat / tags_user | legacyTagFields | 各自保存，不能直接混成新站標籤或全域排除詞 |
| description | article.description | 是摘要，不假裝是正文；body、bodyStatus、contentFetchedAt 都保持未取得 |
| creator | article.creator | 不自動推定為記者；authors 保留 null |
| 母站文章 | article.source=legacy | 與 source=own 的新站收錄統計區分 |
| 原始列 | raw + rawSha256 | 完整保留；欄位過長、異常值不靜默截斷或丟棄 |

本適配器僅接受 1990 年以後的台灣日期；更早年代需額外時區規則。`fetchedAt` 不會為了繞過 retention 而偽造為已抓取。候選物件是待匯入的欄位資料，並非可直接對 ORM 執行的程式物件（時間是 ISO 字串）。

包內重複只標註 duplicateOf，原始列仍保留。此階段的重複計算是程式內精確 urlKey 比較；尚未做跨包、正式庫或資料庫 collation 的完整衝突分析。report 明列 productionCompared=false、productionWritten=false。

report 記錄適配器、文字處理程式、實際來源設定與輸出檔 SHA-256，讓後續可辨別規則變動並重新產生候選資料。格式錯誤的列標為 quarantine；不能把「未被隔離」解讀為已完成所有業務語意審核。

## 第一包實際結果

- 來源：generation `20261004T104058Z-2f94afe6`，`tag_cna` 第一包（主鍵至 50,000）。
- 還原 50,000 筆、輸出 50,000 筆，筆數一致；全部通過本次格式檢查，包內精確 urlKey 重複 0。
- **48,891 筆**没有 tags，且都是超過 14 天的舊文章。若以目前候選欄位直接匯入 articles，會符合現行 retention 的刪除條件。
- 這是早期主鍵範圍的試點，不能推論其他媒體／年代／表也沒有異常。

## 接入新站前的具體工作

1. 建立持久來源對照：以 `(source, table, legacy_id)` 記錄每個原始版本、整理版本與新站 article_id。不同來源指到同篇文章時保留多個 lineage，不覆蓋新站全文或 source=own。
2. 在 staging 索引 `media + urlKey`，另核對 `media + url` 與正式庫 collation；同 URL 不同標題／日期列為衝突，避免任意取最後一筆。
3. 定義歷史資料保留政策。建議把原始摘要與欄位長期留在 NAS 衍生資料區，正式 articles 採需用才匯入。若希望舊文章永久可查，需在部署匯入器前修改 retention，明確區分 legacy 歷史文章與新站 sitemap 雜訊；不能只靠 source 標記就假設已有保護。
4. 同時檢查 crawler 是否會把大量 legacy 候選排入重抓、歷史資料是否影響即時排行，以及 API 是否須顯示來源／歷史日期。原站摘要不能進入正文相似度索引。
5. 在上述規則通過實際衝突與保留測試後，再建立冪等、分批、可回溯的正式匯入步驟。原始封存與整理產物不因匯入完成而刪除。

## 其他表的處理方向

| 資料群 | 新站用途 | 還需要處理 |
| --- | --- | --- |
| media_list、catalogue | 媒體別名、分類對照 | 舊 ID 不直接覆蓋新站設定；合併停用媒體與網域別名 |
| tags、tags_noequal | 獨立規則與歷史統計 | no_tag、期限、零日期及功能範圍各自保存；不直接套成全站排除詞 |
| acattag_topic | topics 候選 | 舊議題標 backlog；缺 last_seen 不能填匯入日，需要重新驗證或保留缺值於 staging |
| tag_news、tag_news_2024 | 跨媒體文章候選 | 逐列辨識媒體、與各媒體表去重；表名不代表單一發布年份 |
| show_history、show_events* | 獨立歷史排行／事件 | JSON 結構、演算法版本、台北小時鍵與事件關係需專用轉換 |
| show_relation、Facebook 紀錄 | 近線分析資料 | 不冒充新站全文相似度；按研究需求產生 Parquet 等衍生格式 |

後續自動化可以訂閱「已驗證的 manifest 分包」作為輸入，用 `(原始物件 SHA-256, 適配器版本, 設定 hash)` 去重排程；先將產物與報告寫入 prepared，再標記該包整理完成。不得因少數表尚未能適配而阻擋原始備份，也不得在未通過上述匯入條件前自動寫入正式庫。
