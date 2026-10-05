# 匯入資料與新站自行收錄的界線

母站匯入的 `source=legacy` 文章可保留原始發布／收錄日期，即使是近期資料，也不因匯入就排入新站爬取。自動正文抓取、即時排行、事件計算、近期標題補標籤及其詞彙表只使用 `source=own`。

若新站的正常來源索引之後再次找到同一 `media + urlKey`，該文章會轉為 `own`，並以這次真正的索引發現時間更新 `crawled_at`。原始發布日期、既有內容及母站 origins 不因轉換而覆寫；母站原始收錄時間仍保存在 NAS 的原始列。後續頁面抓取依正常來源、provider 與重試規則進行，不偽造 `fetched_at` 或 `content_fetched_at`。

worker 的 loopback `/health` 回傳 `legacyOwnershipPolicy: own-indexed-v1`。一次性匯入器必須確認實際執行中的 worker 回傳此值，才可解除近期資料暫留限制；只看到磁碟上的新程式檔不算已部署。

驗證涵蓋：近期 legacy 不會觸發 HTTP 抓取；正常索引重新發現後才開始正常抓取；原日期與摘要保留；即時排行／事件／標題詞彙不因匯入近期 legacy 增加；既有 own 正文與保留期限不改變。
