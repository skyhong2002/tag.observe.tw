# 沿革

## 時間線

| 日期 | 事件 |
| --- | --- |
| 2026-09-26〜27 | 以 Fastify 在 tag.observe.tw 前置舊站；17 條 `/api/*.php` 與主要頁面逐路由改寫為 Node，每條都與舊站逐 byte 比對（PHP 5.4／MySQL 5.6 本機 oracle、正式站快照），並保留逐路由回退到 PHP |
| 2026-09-28 | 解除「介面不變」限制：自家 MariaDB＋Drizzle、BullMQ worker、Next.js SSR 新介面、ECharts、Prometheus／Loki／Grafana、CI。190 支 PHP 爬蟲以 Node 重寫；事件分群、議題、標籤統計移植到 worker |
| 2026-09-29 | 切斷舊站依賴：移除 SSH tunnel、舊資料庫憑證與反向代理；舊網址 301、舊 API 410。安全修正（圖片代理白名單、metrics、SSRF、速率限制） |
| 2026-09-30〜10-01 | 品牌定為「新文易數」；藍綠標題對照、事件封存與趨勢；公開 API（`/api/v1`）、RSS、sitemap、Web App |

舊站 tag.analysis.tw 與其資料庫全程未更動，仍在原網域獨立運作。

## 仍有效的決定

- **不移植** merge.php（`articles` 本身就是全媒體合併表）、make_series.php／tag_hour.php（由 `ranking_snapshots` 取代）、social.php（來源已無資料）、內文抓取歷史表（`articles.fetched_at`／`fetch_status` 只記最後一次）。
- **排行正規化**（2026-09-29，已由 2026-10-04 固定基準取代）：分數除以該 24 小時內實際有發稿的媒體數，不再用 2015 年的固定常數（`all` 為 14）。舊快照依其記錄的媒體數比較（`effectiveWeight()`）。
- **Yahoo 只收自製內容**；不收 LINE TODAY（全是合作媒體）。
- **議題表**是跨媒體合併成一個列表，不分媒體卡片。
- **公開 API** 以 `/api/v1` 發布（不使用 `/api/v2`）。

## 早期歷史

本 repo 自 2026-10-01 公開前以單一 commit 重新開始。完整開發歷史，包括遷移期間的逐路由改寫紀錄、parity／rollback／snapshot JSON、議題草稿、交接紀錄，以及舊站 PHP 副本，保存在私有的 `skyhong2002/tag.observe.tw-archive`（`docs/` 精簡前的最後狀態為該 repo 的 `e61babf`）。待辦事項以 GitHub issues 為準。

- **固定媒體基準**（2026-10-04）：修正新來源加入造成分數斷崖的問題，分子與分母使用同一份版本名單。24 小時平均及逐時分數按固定媒體重算；尚未完成的小時不畫，收錄起點不足及不可比較的爆發力留空。詳見 architecture.md。
