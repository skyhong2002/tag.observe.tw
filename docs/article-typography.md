# 原文標點與段落

JSON-LD 的 `articleBody` 不一定等同讀者看到的正文。東森的結構化資料會將全形標點改成半形、將括號和書名號改成引號，並把標題與小標合併到內文。

擷取時，已驗證的站台正文選擇器優先。共用邏輯也會優先使用與 JSON-LD 文字相同的 DOM 正文（允許 JSON-LD 開頭多一份 `headline`）；NFKC 和去標點只用於比對，不改寫輸出的文字。DOM 只有部分摘要、內容不同或混入其他文字時，不因它較長就直接採用。完整的 JSON-LD 仍可作為備援。

東森使用 `.article_main > .article_content`，避免結構化資料中插入的標題影響比對。未達 200 字的短文也使用相同的選擇邏輯；東森已確認是完整正文的容器設有 `preferShortBody`，即使 JSON-LD 因加入標題或轉載聲明超過 200 字，仍保留原本短文與 `short` 狀態。

## 既有內容修復

`tools/repair-article-typography.ts` 重新抓取保留期內仍有正文、來源為 `ld+json` 的文章。預設只比對，不寫入：

```sh
node --env-file=.env tools/repair-article-typography.ts --limit 1000
node --env-file=.env tools/repair-article-typography.ts --apply --limit 100000 --backup /private/path/article-typography.jsonl
```

可用 `--media ebc,moneydj` 篩選、`--ids 9664691,12345` 重試指定文章，或以輸出的 `lastId` 配合 `--after-id` 分批掃描。每個主機最多兩個請求，收到 429 便停止該主機本輪請求。失敗、受限或仍只有 JSON-LD 的文章保持原樣；既有短文可以用原站短文修復。一般不將完整正文換成短文，只有已驗證 `preferShortBody` 容器可以修正原先由附加文字造成的虛假完整狀態。

每次更新前以 JSONL 保存原始資料列並同步寫入磁碟；更新使用正文與抓取時間的樂觀鎖，避免蓋過同期爬蟲修改。更新不改發布日期，也不延長公開節錄期。原有 `attributions` 保留，包括位於正文段落之外的授權聲明。只變標點時保留相似度索引；正文有實質差異（如移除混入的標題）時，清除舊的相似配對、sketch 與引用索引，交由正常排程重建。新抓取的東森文章則另外讀取 `.rss_box` 的授權來源。
