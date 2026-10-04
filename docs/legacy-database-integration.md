# 母站資料副本與整合分析（2026-10-04）

本次已透過既有 SSH 連線取得母站 `tag` 的核心資料，並在獨立 MariaDB 11.4 容器成功還原。新站正式資料庫未匯入或覆寫任何資料。使用者確認本階段先做核心副本與分析；完整歷史備份尚未執行。

## 容量與保存位置

- 母站 MySQL 5.6.51：可盤點的 279 張表，資料與索引共 235,891,215,614 bytes（219.69 GiB）；其中 278 張 MyISAM、1 張 InnoDB。列數約 5.6 億，屬引擎 metadata，不是逐表精確計數。
- 本機開始時約剩 183 GiB，不足以還原全庫；完整還原另需暫存、索引建置及引擎版本差異的餘裕。
- GGSS-NAS 的 SMB `Archive` 已驗證可讀寫，檢查時剩 1,920,535,769,088 bytes（約 1.75 TiB）。容量足以保存完整備份，但不代表已取得全庫。
- NAS 核心副本：`Archive/tag.analysis.tw/2026-10-04/`。
- 本機私有副本：`/home/deck/tag-analysis-private/legacy-2026-10-04/`。SQL、盤點、分析 JSON、擷取程式、manifest 與 SHA-256 清單均放在私有目錄。
- 隔離還原容器：`tag-legacy-analysis-20261004`，無網路與公開埠、停用 event scheduler；資料目錄在私有副本的 `restore-data/`。還原憑證不存入 NAS 或 Git。

## 實際取得及驗證的範圍

`schema.sql.gz` 保存 279 張可讀表的結構；`core.sql.gz` 保存以下完整核心資料，共 **153,051 筆**：

| 舊表 | 還原筆數 | 用途 |
| --- | ---: | --- |
| tags | 116,294 | 標籤統計、分類層級、人工 no_tag |
| tags_noequal | 390 | 事件關聯排除詞與期限 |
| media_list | 242 | 舊媒體 ID、代號、分類 |
| catalogue | 15 | 分類定義 |
| catalogue_tag | 29,455 | 分類標籤關係 |
| tag_group | 28 | 標籤群組 |
| topic_list | 10 | 舊議題設定 |
| topic_tag | 66 | 議題標籤 |
| topic_news | 53 | 議題文章資料 |
| tags_url | 2,991 | 標籤網址 |
| acattag_topic | 3,507 | 媒體專題／議題頁 |

`samples.sql.gz` 另保存下列 14 張大表各 100 筆，共 1,400 筆：`tag_cna`、`tag_ltn`、`tag_udn`、`tag_news`、`tag_news_2024`、`show_history`、`show_events`、`show_events_history`、`show_relation`、`show_tag_cloud`、`show_event_news`、`show_mvp_news`、`tag_relation`、`media_news`。

樣本使用無排序的 `LIMIT 100`，多數是早期資料；不是最新、隨機或具代表性的統計樣本。已通過 gzip 解壓、三份 SQL 還原、279 張結構及各表實際筆數驗證。核心筆數與擷取前的 MyISAM metadata 相符。還原成功不代表舊資料在業務語意上完整有效。

擷取使用 `--skip-lock-tables --quick`，未停機或要求全域讀鎖，未擷取 triggers、routines、events。MyISAM 在線資料仍可能變動，這份是供分析的副本，**不是跨表同一時間點的一致性備份**。

另有 `show_tag_hour`：`SHOW TABLES` 與後續 metadata 可見，伺服器上有 `.frm`／`.ibd`，但 `mysqldump` 的 `SHOW CREATE TABLE` 回覆 1146「doesn't exist」。本次未修復來源，未納入可還原 SQL；只保留已取得的欄位 metadata。279 張結構不應被宣稱為毫無缺漏的全庫結構。

## 新舊欄位與規則對照

| 舊資料 | 新站落點 | 轉換與限制 |
| --- | --- | --- |
| tag_<media>、tag_news、tag_news_2024 | articles + article_tags | 舊 newsid 只在來源表內有意義；新 id 重新配置，保存來源表／舊主鍵對照。統一媒體代號、沿用各來源 urlKey 規則去重；跨表可能重複，不可逐表直接 append |
| create_time / ctime | published_at / crawled_at | 舊 PHP 使用 Asia/Taipei；MySQL 主機為 BST，不能用主機時區推算 datetime。新站連線以 UTC 解讀，須明確將台北牆上時間轉成 UTC；保留原值與匯入時間 |
| tags、tags_cat、tags_user | articles.tags + article_tags | 舊格式是 `[詞][詞]`；先分欄解析並保留來源意義，再決定合併規則。不要直接把三種標籤都算入新排行 |
| description | articles.description | 不是全文，不能設 body_status=ok 或產生全文相似度。缺少作者資料也不能從 creator 強制推論全部 authors |
| tags | tag_stats；另增規則保存處 | tag/media_type/level 可對照 tag/category/level；first_hour、last_hour、max_hour 需核實舊 ctime 的語意與異常值。新表沒有 no_tag 欄位，不能在匯入時丟掉 |
| tags_noequal | 事件／補標籤排除規則 | 保存 period_time 的期限、NULL 與零日期語意；不應直接當成永久的排行排除詞 |
| acattag_topic | topics | media/url/title/image/cat 對應既有欄位，ctime 可作歷史 first_seen。全部 3,507 筆 mtime 缺值或零日期，不能偽造最近一次觀察時間；須記錄來源缺值，或重新探測後才填 last_seen |
| show_history.chart_text | ranking_snapshots + ranking_entries | 先解讀舊 JSON 的 weight、每媒體次數、截斷範圍與分數尺度。保留原始 JSON／演算法來源，不能直接標成新站固定媒體基準 |
| show_events、show_events_history | event_snapshots、events、event_threads | 拆解 JSON、處理舊 equal_to 與 combined_from/to、重建 ID 關係；舊 history 含 `all` 與台北小時鍵，需要分別轉換 |
| show_relation、tag_relation、show_tag_cloud | 獨立歷史資料區，或日後重算 | 舊關聯分析不等於新站全文相似度，不可匯入 similarity_pairs 冒充文字比對結果 |
| Facebook 紀錄、media_news | 獨立歷史資料區 | 不應計入新站自行收錄量或當成文章正文；需要功能時再設計模型 |

### 已查證的語意差異

1. `tags.no_tag=1` 有 666 列、354 個不同詞，包含「台灣」「台北」「電影」等。母站 `api/tag_hot_rank.php:119`、`api/tag_hot_rank_media.php:120` 使用同詞的 `MAX(no_tag)`；`api/tag_json.php:42` 則接受 0 或 NULL。`maint/notags.php:35` 的 `no_tag<1` 又不包含 NULL。這是不同功能的不同規則，不能把整份名單套進新站全域 `isTagNoise()`。
2. 母站 `maint/no_equal.php:5` 依 `period_time` 是零日期、NULL 或尚未到期選詞，該查詢沒有以 `del_flag` 過濾。390 筆中 `del_flag` 有 NULL、0、1 三種值；需要保留原規則，不能只憑欄位名稱判斷是否啟用。
3. 議題樣本其實是完整 3,507 筆，來自 7 個媒體，ctime 範圍 2023-02-27 至 2026-09-29。先前已存在的議題應標 backlog，不能把匯入日當成新議題發生日。
4. 文章樣本中 `tag_ltn.create_time` 出現 `1970-01-01 08:00:00`；`tag_news_2024` 樣本從 2014 年開始，不能根據表名把它解讀成只含 2024 年。無效日期必須進入隔離清單，不可硬填現在時間。
5. 五種已抽查的 JSON 欄位均能解碼，但 `show_history` 首筆只有 weight，`show_relation` 首筆是 JSON null。可解碼不等於有完整排行／關聯資料；缺項也不代表零分。
6. 舊文章匯入若採 `source=legacy`，可保持新站 `source=own` 的收錄統計意義。但目前 retention 會刪除「超過 14 天、從未抓取、無標籤」文章；大量舊文章符合條件。正式匯入前須定義歷史保存策略，避免下一次排程刪掉資料。

## 建議整合順序

1. 保留這份原始副本，先新增 staging／來源對照資料模型，記錄來源表、舊主鍵、擷取批次、原始時間、轉換問題。先 dry-run 輸出新增／重複／不合法／規則差異清單。
2. 優先處理媒體對照、人工標籤規則及議題；規則分成排行、事件連結、標題補標籤等適用範圍。議題須處理無 last_seen 與 backlog 後，才可進正式 topics。
3. 用文章樣本驗證 URL 去重、台北轉 UTC、空值／長度／編碼及來源關係，再分媒體、時間範圍擷取完整文章。已存在的新站文章保留新站資料，舊來源關係另存，避免覆寫全文或把 own 改成 legacy。
4. 歷史排行與事件先提供獨立歷史查詢。新站固定媒體基準、爆發力與舊版基準分開；未確認可比較前不直接接成一條時間序列。
5. 再評估是否需要約 50 GiB 的 Facebook 表與約 116.52 GiB 的 show_* 表。NAS 可解決保存空間，不能消除母站 dump 的讀取負擔或 MyISAM 一致性問題。

完整備份可分表壓縮後串流到 NAS，以 `.partial` 標示未完成檔，逐表記錄結束狀態、大小與 SHA-256，讀回驗證後才標完成。若要求可災難還原的一致性全庫備份，須另安排可接受的停寫／一致性儲存快照流程，並納入 show_tag_hour 缺口及 triggers/routines/events。不要把運作中的 MyISAM 原始檔直接複製後稱為可靠備份，也不要直接在 SMB 分享上啟動 MariaDB 資料目錄。
