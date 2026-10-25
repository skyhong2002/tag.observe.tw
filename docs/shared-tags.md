# 共用標籤：盤點與投稿審核（F1）

基底為 `75f1445`。本批沿用 thread 9f0aa980 的 `/admin/tags/`；不修改或複製完整詞庫、爬蟲寫入路徑、文章正文、Cloudflare 或 WAF。

## 既有功能與保留方式

| 功能 | 既有實作與來源／權限／去重 | 本批補充 |
| --- | --- | --- |
| tag-groups | `tag_group_defs` 有穩定 ID、kind、parentId、軟刪除與異動 log；`tag_group_members` 以 tag/groupId 唯一，允許多重分類；來源 legacy/admin/person/wikidata/section/ai，auto/confirmed 公開、review/rejected 隱藏。管理員及同源 Origin 才可編輯，移動防循環。 | 投稿上位分類若精確對應既有群組，保留群組 ID，核准寫回同一 membership、member log 與 writing projection。群組本身的上下層仍在既有分類編輯器操作。 |
| person | `tag_people` 保留 Wikidata、身分事實、檢查／人工覆蓋時間、管理員紀錄；非人物更正 nonhuman 保留。 | 不新增人物資料庫，不把共同出現当身分證據。 |
| avatar | `tag_avatar_candidates` 保留處理後 WebP、辨識評分、Commons 出處／授權／作者、讀者 userId／時間；管理員 chosen/hidden 優先。 | 讀者處理結果先進私人佇列，核准後才成候選；原圖仍不保存。 |
| visual | `tag_visuals`、`tag_visual_candidates` 保留地圖、旗幟、logo、emoji 及來源授權；auto/chosen/voted 可公開，AI review 不公開；人工操作有 log。 | 同一去背／裁切／轉色管線與權利勾選，增加處理後圖片 SHA-256 去重及先審。 |
| admin/tags | 分類與群組、文章關係、人物頭像、其他圖像四個既有分頁；gateway requireAdmin 為實際授權。 | 增加「投稿審核」分頁，待審／已通過／未採納、30 筆游標分頁、審核理由與受保護圖片預覽。 |
| 文章關係 | `tag-groups/relations.ts` 從匹配標籤的文章 ID 查詢文章；article_tags 與 article_writing 的標記／引用／轉述證據分開。 | 不將這裡的文章關係誤作標籤的 is-a／related／alias。 |
| article_tag_edits | 編輯者 email／editedAt 鎖定人工文章標籤；`article_tag_log` 記每次 add/remove。爬蟲不覆寫，直到管理員要求 refetch。 | 原樣保留；新標籤關係不改文章標記。 |
| 讀者權限與圖片 | 原有登入 SessionUser、同源 Origin、每天20張、上傳 body15MiB、sharp 支援格式及原有圖片處理限制；每標籤每人一票。舊流程先公開候選且上傳自投。 | 新投稿核准前沒有候選或票；核准後才接回原投票。已公開舊候選保留。待處理 avatar worker job 原本在完成後才計入每天上傳額度，本批同樣如此；完成後 pending/rejected 都計入，核准不重複計數。 |
| 原 reader_reports | 針對特定文章的更正審核，articleId 必填。 | 不塞入虛構文章 ID；新增小型 tag_submissions 共用佇列，放在同一 tag admin 下。 |

## 關係與同步契約

- `/api/v1/tags/{tag}/relations` 回公開語義關係。`tagId` 為原始 UTF-8 標籤的 SHA-256，與完整詞庫相同；字形、大小寫不合併。`group:<id>` 直接沿用群組 ID。新標籤欄位使用 utf8mb4_bin，避免資料庫不分大小寫比較導致串詞。
- `is-a` 是有方向的上位分類，允許多重；分類祖先另以 inherited/depth 標示。既有群組的分類包含身分類型、組織歸屬等原站維護的分類，不宣稱這些全是嚴格本體學的職業型別。topic 大類不投影為 is-a。
- 新 tag→tag 分類最多讀取8層、200筆語義關係，達到邊界回 `truncated: true`，不偽稱完整；完整詞庫快照的完整性契約不受此端點限制影響。
- `related` 與 `alias` 是對稱的；雙向投稿以同一去重 key 保存。alias 不會自動合併文章篇數、詞條或 ID。共現統計完全不進此 API。
- 上位分類若對應既有 group，投稿時綁定 targetGroupId；改名後 ID 仍固定。刪除／拒絕既有 membership 後公開端不會被歷史投稿重新復活。分類名本身要改上層請用既有群組編輯器，不繞過其防循環機制。
- 每筆新關係／圖片保存來源、createdBy、createdAt、審核狀態及 reviewer/time/reason，`tag_submission_log` 追加投稿與審核事件。私人作者 ID 與自由文字理由不出現在公開 API。旧群組未保存原始建立者／建立時間，不能補造；公開 createdAt 為 null，既有 reviewedBy/At 等稽核繼續保留。
- 登入 POST `/auth/tags/{tag}/relations` 提出 `{type,target,reason}`，每人每天20筆；同名／控制字元／過長／自指拒絕。未核准不公開。拒絕後重複投稿回既有結果，不覆寫審核。
- 管理 GET `/auth/admin/tag-submissions?status=pending&before=ID`；PUT `/:id` 必填 approved/rejected 與 reason；只有待審可決定。併發核准鎖住自己的小型 `tag_relation_lock`，防止 A→B 與 B→A 同時通過；不鎖爬蟲熱點、不建 trigger。缺鎖列即停止審核。
- 圖片預覽 `/auth/admin/tag-submissions/:id/image` 必須管理員登入，只回處理後 WebP；投稿佇列不回 image blob。核准後維持既有 public 圖片 API 與署名方式。
- 公開匿名成功快取60秒；四種敏感標頭及錯誤延用 gateway no-store。審核後通知 web 重建 tag 頁；通知失敗則等既有短期快取到期。OpenAPI 為 docs/api.md、/api/、/api/status 的唯一來源。

## 遷移與回滾

0038 僅建立三個小表及索引，不 ALTER 正式 articles/article_tags，不改 crawler。部署前备份 schema 及既有分類／圖片資料、確認 `/home` >10GiB。原 release、備份與原始碼全部保留。回滾應用至上一正式 release 即可；新表保留以免遺失投稿稽核，切勿自動 DROP。回滾舊版會恢復舊圖片直接公開政策，應在交接中特別說明。

UI 逐頁驗收見 `ui-review-ledger.md`；程式測試通過或 HTTP 200 不等於視覺／權限工作流程已完成，待 babysit 實際瀏覽驗收。
