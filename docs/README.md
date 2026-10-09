# 文件

## 核心架構

- [architecture.md](architecture.md)：系統架構、排程、演算法、資料保留、開發、部署與回退
- [api.md](api.md)：公開 API（由 `app/src/v1/openapi.ts` 產生，請勿手改；網站版 <https://tag.observe.tw/api/>）
- [crawlers.md](crawlers.md)：爬蟲引擎、來源規格、成功條件與處理紀錄
- [analytics.md](analytics.md)：GA4、Search Console、Web Vitals、網站觀測與匿名讀者回報
- [security.md](security.md)：來源、圖片、API 與服務安全規則
- [history.md](history.md)：從 tag.analysis.tw 遷移至本站的決定與里程碑

## 網站功能與資料口徑

- [similarity.md](similarity.md)：正文保存、相似度、引用證據、記者統計與媒體關係圖
- [tag-discovery.md](tag-discovery.md)：關鍵字升溫、跨媒體門檻與相似稿訊號
- [media-reading.md](media-reading.md)：媒體列表、站內文章閱讀與內文期限
- [liveboard-stability.md](liveboard-stability.md)：即時看板輪詢、資料缺口與穩定性
- [media-traffic.md](media-traffic.md)：媒體流量與分類來源、月份快照及人工更新方式
- [mobile-performance.md](mobile-performance.md)：行動裝置效能量測與限制
- [seo.md](seo.md)：SSR、快取、metadata 與搜尋引擎檢查
- [web-vitals-fixes.md](web-vitals-fixes.md)：網站效能修正與驗證紀錄

## 來源與品質稽核

- [news-source-references.md](news-source-references.md)：Similarweb 來源對照、官方入口與政府來源驗證
- [reporter-crawl-audit.md](reporter-crawl-audit.md)：文章署名、作者／編譯欄位與來源樣本稽核
- [article-authors.md](article-authors.md)：正文署名抽取、作者與編譯判定及回歸案例
- [media-collection-audit.json](media-collection-audit.json)：媒體目錄收錄盤點快照
- [topic-source-coverage.md](topic-source-coverage.md)：議題與專題入口的涵蓋範圍
- [topic-source-audit.json](topic-source-audit.json)：議題來源盤點資料
- [similarity-crawl-audit.md](similarity-crawl-audit.md)：相似度來源正文抽取稽核
- [similarity-sources.md](similarity-sources.md)：相似文章引用來源與媒體國別
- [media-icons.md](media-icons.md)：媒體圖示來源、尺寸與產生方式
- [media-names.md](media-names.md)：媒體名稱、別名與顯示規則
- [crawl-restoration.md](crawl-restoration.md)：舊站文章來源恢復與逐站證據
- [news-thread-watchdog.md](news-thread-watchdog.md)：事件串與新聞來源監看

## 內容保留、備份與舊站資料

- [content-nearline-cache.md](content-nearline-cache.md)：正文／摘要 nearline 快取、封存與取回
- [nearline-archive.md](nearline-archive.md)：歷史資料封存與 NAS 物件索引
- [site-database-backup.md](site-database-backup.md)：每日資料庫備份、隔離還原與校驗
- [legacy-ownership.md](legacy-ownership.md)：legacy 與 own 文章的資料界線
- [legacy-article-import.md](legacy-article-import.md)：舊站文章匯入規則與來源對照
- [legacy-integration-runner.md](legacy-integration-runner.md)：歷史資料全量整合執行器
- [legacy-database-integration.md](legacy-database-integration.md)：舊資料庫整合設計
- [legacy-staging.md](legacy-staging.md)：舊資料 staging 與隔離驗證
- [article-typography.md](article-typography.md)：正文標點、結構化資料與修復原則
