# 記者署名更新

文章擷取會辨識獨立署名、結構化作者與正文開頭的記者署名。只有媒體／編輯部署名時，仍保留該組織身分；重新擷取找不到署名時，不會清空既有作者。

已完成擷取的文章不會因規則更新而自動重抓。使用修復工具先預覽差異：

```bash
node --env-file=.env tools/repair-article-authors.ts --media ltn,udn --limit 100
```

工具預設重新抓取最近 90 天收錄的文章，每批最多 100 篇，只比對署名、不寫入。所有媒體都要更新時省略 `--media`；`--hours 0` 包含更早的歷史資料；`--ids 123,456` 可驗證指定文章。

正文仍保存且記者只出現在文章開頭時，可以先離線預覽，避免重抓：

```bash
node --env-file=.env tools/repair-article-authors.ts --stored-body --limit 1000
```

`--stored-body` 僅從儲存正文開頭推斷記者，最多檢查前三段並跳過開頭的圖片說明；遇到一般敘事段落即停止。它不能補回正文外的獨立署名，也不會把文中後段提到的記者當成作者。

預覽符合預期後，用相同範圍加入 `--apply`。可選擇 `--backup` 在每次更新前保存原始署名：

```bash
node --env-file=.env tools/repair-article-authors.ts --stored-body --limit 1000 --apply --backup /private/path/article-authors.jsonl
```

每批最後一行回傳 `lastId`，下一批以 `--after-id` 接續，並保留相同的媒體／時間範圍。HTTP 429 會停止該批，`lastId` 不會跨過尚未處理的文章；等待後從此游標重試。其他失敗會輸出文章 ID，可用 `--ids` 重試。

修復只更新 `authors` 與 `creator`，不更動正文、保存期限、爬取時間或引用。更新條件會檢查原署名仍相同；正文模式也會檢查正文沒有被並行爬取替換。空擷取結果或只有組織署名的結果不會覆蓋既有個人署名。

## 2026-10-06 實際修復紀錄

- 全部 129,364 篇保存正文的文章完成離線掃描；第一輪更新 90 個媒體、4,355 筆署名。
- 對 10 個已調整署名規則的媒體再重抓 30 篇歷史文章；有效修正 7 筆。重抓時發現兩篇 Vogue 舊版署名混入推薦作者，已用原署名備份恢復，再補兩種 header 版型並重新驗證，兩篇皆維持正確作者。
- 最終正文重新掃描僅剩 3 筆新支援的圖文共同署名，已補寫並對這 3 筆再次 dry run，沒有剩餘差異。合計 4,365 筆署名修正；沒有重抓全部歷史文章，正文外的署名仍需用 refetch 模式更新。
- 原始署名與逐筆結果保存在 `/home/deck/.local/share/tag-analysis/author-repair/20261006/`。工具只更新 `authors`、`creator`，本次沒有變更正文或引用。
- 擷取程式修正在工作樹；本次沒有部署或重啟正式 worker。執行中的 worker 使用 `/home/deck/.local/share/tag-analysis/current` 的獨立 release，需部署本次程式後，後續排程才會採用新規則。

## 使用者截圖追加驗證

初輪來源抽查和正文回填不足以證明每一篇文章已正確。使用者截圖進一步找到媒體前綴後空格、中央社文章末尾編譯、複合作者／編譯及看板標示問題；本次已用各篇原文新增回歸測試，沒有把攝影或責任編輯推斷成文章作者。

- 補正截圖對應的 8 筆署名，另 1 篇原已是正確署名。
- 更新修復工具：正文開頭、明確末尾編譯及已保存的角色署名都可比對；再掃描 129,747 篇正文，補正 1,486 筆。
- 重新處理大紀元保存正文的 1,735 篇，另修正 16 筆複合署名，包括 Amy Denney、朱緯。備份及結果保存在同一目錄，以 screenshots／compound 為檔名前綴。
- 看板的 Reporters 元件改用中性「署名」標示，具名文字先依 personNames 正規化。公司、媒體、部門、匿名通訊社電頭仍保留原署名，不會一律標成「記者」。
- 看板修正在 `/home/deck/.cache/tag-reporter-signatures` 的 `fix/reporter-signatures` 分支，基於正式 release 的版本建立並整合 origin/main；保留 main 中其他未提交工作。前端 production build、TypeScript 及相關測試通過。正式版本由 `scripts/install-service.sh` 建置、驗證並切換 release。
- 追加截圖確認大紀元日期電頭後的「大紀元記者陸希休斯頓報導」。解析器新增日期電頭、休斯頓及複合地名處理；歷史資料回填另外保存為 epoch-date-original.jsonl／epoch-date-apply.jsonl。
