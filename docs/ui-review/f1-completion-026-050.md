# 026–050 完整範圍補審

Reviewer：`/root/ui_review_completion_middle`／GPT-6.1 Sol。獨立 UI review，未編寫受審 UI。既有基準 `48083b58c4ee3d16f2072206f1da3df332f34143` 的 50 張 1280×800／390×844 首屏已於本輪逐張重新使用 `functions.exec/tools.view_image` 觀看；基準只有首屏，不沿用為完整 pass。候選目標 `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`，正式 frontend 仍為 `0dd38b6`；候選與正式不可混稱。

私有 review log：`/home/deck/tag-analysis-private/ui-review/f1/completion-026-050-review.log`。所有 PNG、raw network、HAR、browser profile 留在私有目錄，未進 repository。此檔持續補審中；第一批026–032已真capture並closed，後續等待主agent完成必要新build，不將離線source/discovery當真UIpass。

本輪來源盤點：`TopicMediaView` 有 empty/notFound；feature detail 有 ArticleView 與 TopicStoriesView 兩分支；group detail 有 ranking/empty/notFound；journalist detail 有 pairs/empty/missing/暫不可取得；media content 有記事列表/搜尋 empty/暫不可取得/SourceProfile fallback；SourceProfile 有 incoming/outgoing、unknown notFound、全文資料或 evidence 不可取得兩類錯誤。公共閱讀分支沒有頁級角色門檻；追蹤、收藏與回報的動作才受匿名 gate。`ReaderGate` 則明確區分 loading/disabled/anonymous/reader，session GET error 被映射至 disabled。

提交狀態：本 reviewer 未 commit，依主 agent 明示交由其整合後統一提交。部署狀態：本 reviewer 未部署；本文件不是正式驗收。

第一批全域資源證據：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/before-resources.json` 與 `/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/after-resources.json`；before实际browser parents 0、load 9.9375；after parents 1、load 9.041015625。每檔包含rawpgrep、uptime、三站TTFB、free disk与build parents；中途load>12時candidate每張段圖休息6秒，未正式capture。

## 026 /cat/news/

alias source單一 permanentRedirect：actual兩寬皆 /ranking/?category=news。新聞媒體chip選中、標題/方法pointer/keyword雲正常；手機chip右側裁切仍與基準相同。本alias URLmapping與兩寬目的画面 scope pass；目的ranking其他branch歸主route審查。

Reviewer／UTC／版本：GPT-6.1 Sol；review `2026-10-12T20:33:46.529071+00:00`；capture `2026-10-12T20:26:45.599Z`–`2026-10-12T20:27:01.089Z`；UI `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`。URL：`http://127.0.0.1:18180/ranking/?category=news`。Viewport：1280×800、390×844。

真看PNG：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/026-1280-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/026-390-initial-segment-0.png`。

原始證據：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/report.json`（完整capture inventory/DOM/interaction）；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.json`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.jsonl`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network.har`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-zero-egress-audit.json`；review log如上。

## 027 /crawlers/

已真看兩寬首/表格中段/最後列及完整footer；297來源正常、cnews篩選4來源、不存在查詢0來源。搜尋及清除入口正常。1280 empty文案完整；390 empty文案被寬table colSpan中央位置裁切，只露片段，issue需修/復驗。手機右側欄位需水平捲且無提示，與基準相同。多/少/空branch已實測；SSRservice error/排序/水平捲恢復仍pending，公開閱讀權限N/A（CrawlersPage無gate）。

Reviewer／UTC／版本：GPT-6.1 Sol；review `2026-10-12T20:33:46.529071+00:00`；capture `2026-10-12T20:27:31.758Z`–`2026-10-12T20:28:08.798Z`；UI `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`。URL：`http://127.0.0.1:18180/crawlers/`。Viewport：1280×800、390×844。

真看PNG：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-1280-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-1280-initial-segment-1.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-1280-initial-segment-2.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-1280-action-0-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-1280-action-1-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-390-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-390-initial-segment-1.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-390-initial-segment-2.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-390-action-0-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/027-390-action-1-segment-0.png`。

原始證據：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/report.json`（完整capture inventory/DOM/interaction）；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.json`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.jsonl`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network.har`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-zero-egress-audit.json`；review log如上。

## 028 /crawlers/traffic/

已真看兩寬標題、兩batch狀態卡、表格中段、shared domain末列與footer；cnews少筆、零結果empty文案兩寬完整可讀，搜尋suggestion popup正常。手機Cloudflare欄位需右捲且無提示，與基準相同。桌209 domains／手機294 domains是本批資料差異，未判因；不能用此對宣稱內容完全相同。多/少/空UI scope pass；SSR不可取得/排序/右捲互動pending，公開權限N/A（TrafficCollectionPage無gate）。

Reviewer／UTC／版本：GPT-6.1 Sol；review `2026-10-12T20:33:46.529071+00:00`；capture `2026-10-12T20:28:29.891Z`–`2026-10-12T20:28:58.365Z`；UI `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`。URL：`http://127.0.0.1:18180/crawlers/traffic/`。Viewport：1280×800、390×844。

真看PNG：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-1280-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-1280-initial-segment-1.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-1280-initial-segment-2.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-1280-initial-segment-3.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-1280-action-0-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-1280-action-1-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-390-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-390-initial-segment-1.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-390-initial-segment-2.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-390-initial-segment-3.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-390-initial-segment-4.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-390-action-0-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/028-390-action-1-segment-0.png`。

原始證據：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/report.json`（完整capture inventory/DOM/interaction）；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.json`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.jsonl`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network.har`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-zero-egress-audit.json`；review log如上。

## 029 /demo/

純alias /demo/ 兩寬actual→/。首屏首頁版型、card比例及字雲層級與基準一致；1280部分tag圖片broken，raw sameorigin avatar/visual-image HTTP500，390正常；不是外部transport阻擋（外部attempt0）。redirect基本行為pass，目的首頁圖片失敗及本alias q branch待補，overall pending。

Reviewer／UTC／版本：GPT-6.1 Sol；review `2026-10-12T20:33:46.529071+00:00`；capture `2026-10-12T20:29:04.630Z`–`2026-10-12T20:29:10.471Z`；UI `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`。URL：`http://127.0.0.1:18180/`。Viewport：1280×800、390×844。

真看PNG：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/029-1280-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/029-390-initial-segment-0.png`。

原始證據：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/report.json`（完整capture inventory/DOM/interaction）；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.json`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.jsonl`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network.har`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-zero-egress-audit.json`；review log如上。

## 030 /demo/compare/

純alias /demo/compare/ 兩寬actual→/。字雲圖片、焦點圖/card與三色比例兩寬正常，1280亦沒有029暫態broken圖。normal redirect視覺scope pass；valid event query branch待補，overall pending。

Reviewer／UTC／版本：GPT-6.1 Sol；review `2026-10-12T20:33:46.529071+00:00`；capture `2026-10-12T20:29:16.491Z`–`2026-10-12T20:29:22.318Z`；UI `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`。URL：`http://127.0.0.1:18180/`。Viewport：1280×800、390×844。

真看PNG：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/030-1280-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/030-390-initial-segment-0.png`。

原始證據：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/report.json`（完整capture inventory/DOM/interaction）；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.json`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.jsonl`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network.har`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-zero-egress-audit.json`；review log如上。

## 031 /event/archive/

純alias /event/archive/ 兩寬actual→/event/。每日chip/68件/比例、日期列、desktop右索引及mobile accordion正常；mobile日期列左端裁切與基準相同。normal alias scope pass；day query branch待補，目的event資料所有業務分支另審。

Reviewer／UTC／版本：GPT-6.1 Sol；review `2026-10-12T20:33:46.529071+00:00`；capture `2026-10-12T20:29:28.746Z`–`2026-10-12T20:29:34.923Z`；UI `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`。URL：`http://127.0.0.1:18180/event/`。Viewport：1280×800、390×844。

真看PNG：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/031-1280-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/031-390-initial-segment-0.png`。

原始證據：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/report.json`（完整capture inventory/DOM/interaction）；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.json`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.jsonl`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network.har`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-zero-egress-audit.json`；review log如上。

## 032 /feature/setn/

多筆正常34專題；真看full-page圖整體排序與各唯一區塊、首段、列表中段、最後專題/方法accordion/footer。兩寬thumbnail/metadata/related summary有/無分支、標題與URL換行、desktop來源靠右/mobile截略的版型正常；未見頁級overflow。full-page初拍含未滾入的lazy圖片placeholder，後續section18/36已載入，不把初拍placeholder判產品錯誤。多筆模板視覺scope pass；少/空/不存在與服務error待後續真URL，公開閱讀權限N/A（TopicMediaView無gate；MethodLink為#method）。

Reviewer／UTC／版本：GPT-6.1 Sol；review `2026-10-12T20:33:46.529071+00:00`；capture `2026-10-12T20:30:18.674Z`–`2026-10-12T20:31:06.573Z`；UI `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`。URL：`http://127.0.0.1:18180/feature/setn/`。Viewport：1280×800、390×844。

真看PNG：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-1280-initial-full.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-1280-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-1280-initial-segment-1.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-1280-initial-segment-18.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-1280-initial-segment-36.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-1280-initial-segment-37.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-390-initial-full.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-390-initial-segment-0.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-390-initial-segment-1.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-390-initial-segment-18.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-390-initial-segment-36.png`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/032-390-initial-segment-37.png`。

原始證據：`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/report.json`（完整capture inventory/DOM/interaction）；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.json`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-raw.jsonl`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network.har`；`/home/deck/tag-analysis-private/ui-review/f1/completion-middle-2026-10-12T20-26-13-759Z/network-zero-egress-audit.json`；review log如上。

## 033 /feature/setn/50/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/033-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/feature/[media]/[id]/page.tsx；components/TopicStoriesView.tsx；components/article/FeatureStories.tsx`。有content→ArticleView、無content→TopicStoriesView；wrong media/missing→404、kind article→article redirect、kind topic→topic redirect；stories0時FeatureStories為null。公開頁級permission無gate，保存/回報有reader限制。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 034 /group/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/034-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/group/page.tsx`。days1/7/30；busy有top cards、quiet0新聞link清單；API失敗catch[]呈兩個空section，沒有獨立服務error提示；不可將讀取失敗當真群組0。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 035 /group/1/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/035-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/group/[id]/page.tsx；GroupRankingTable.tsx`。group null→404；numeric id、days1/7/30；ranking有排序表或empty文案，children/subgroup欄依資料；公開無page gate。候選isolateddb目前1tags/0ranking，完整多/少尚無新真UI例。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 036 /journalist/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/036-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/journalist/JournalistOverview.tsx；JournalistTable.tsx`。API null→明示暫無資料且不代表無具名文章；正常名單可client搜尋/媒體/排序/關係/進階filter/load more。公開無page gate。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 037 /journalist/方承業/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/037-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/journalist/[name]/page.tsx`。missing→404；null→稍後重新整理；正常含summary、sidebar主題/索引/移除說明、pairs/0pairs、署名文章；讀取公開，追蹤需reader。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 038 /liveboard/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/038-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/liveboard/page.tsx；BoardSwitch.tsx；SimpleBoard.tsx；LiveBoard.tsx`。forced simple/full或saved mode；simple歷史/鏡頭/字雲輪換、empty frame跳鏡頭並30秒休息；full feed/event/topic/reading及pane輪換；SSR optional failures保留null/empty，client polling保留先前資料，不代表每種error有獨立訊息。公開無page gate。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 039 /liveboard/setting/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/039-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/liveboard/setting/SettingsForm.tsx；web/src/app/liveboard/useSettings.ts`。simple/full、draft dirty、鏡頭排序/停播、scale/history等、至少一鏡頭validation；匿名save到localStorage，reader savePrefs至account，catch存檔失敗。匿名的操作可限定於本review profile。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 040 /liveboard/settings/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/040-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/liveboard/settings/page.tsx`。單一permanentRedirect /liveboard/setting/；query忽略為明確source行為。目的設定所有業務分支另列。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 041 /login/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/041-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/login/page.tsx；LoginPanel.tsx；web/src/lib/session.ts`。loading/disabled/anonymous/reader；error query state/cancelled/invalid/failed/unknown五訊息可直接URL呈現，不需OAuth；GET /auth/me失敗會映射disabled。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 042 /media/cnews/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/042-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/media/[media]/page.tsx`。invalid readingQuery→404；API400→404、404→SourceProfile，非ok→文章暫不可取得；正常cloud/sidebar/關係/寫法/文章、qempty/clear、pagination/summary checkbox。公開read無page gate，FollowButton reader gate。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 043 /media/cnews/articles/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/043-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/media/[media]/articles/page.tsx；web/src/lib/reading.mts`。純redirect保留有效hours/cursor/q；invalid query→notFound。目的media template另審，不重做所有業務state。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 044 /media/cnews/references/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/044-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/components/SourceProfile.tsx`。incoming/outgoing，pagepagination；unknown media且有graph→404；!data與node&&!evidence兩個error文案；list0有0則counter；公開無page gate。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 045 /media/crawlers/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/045-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/media/crawlers/page.tsx`。純permanentRedirect /crawlers/；逐key保留多值query。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 046 /media/sources/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/046-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/media/sources/page.tsx`。純permanentRedirect /media/traffic/；逐key保留多值query。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 047 /media/traffic/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/047-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/media/traffic/page.tsx；load.ts；web/src/components/TrafficComparison.tsx`。data/weekly/output並行、loadComparison有各來源fallback；client搜尋/月份/數值vs月變化/排序與empty；public無page gate，normal209/294資料差不依source臆測具體原因。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 048 /method/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/048-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/method/page.tsx；MethodToc.tsx；web/src/components/MethodNotes.tsx`。固定GROUPS正文與內部錨點/各頁links；main正文沒有API load/empty/error/permission分支，這些為N/A（footer共用收錄數另屬global）。需要兩寬整頁與錨點真review。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 049 /my/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/049-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/my/ReaderGate.tsx；MyFeed.tsx；web/src/lib/session.ts；web/src/lib/reader.ts`。ReaderGate loading/disabled/anonymous/reader；feed多/少/no follows/有follows無articles/APIerror；events可進行/沉寂，hiddenMedia filter；API actualfixture或response fixture需精確標示，不是真OAuth驗收。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 050 /my/following/

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/050-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。

Source適用性：`web/src/app/(site)/my/ReaderGate.tsx；following/Following.tsx；web/src/lib/reader.ts`。ReaderGate同上；following多/少/empty，readonlysuggestions；store GETerror不set value→可能持續loading，需真503圖確認；寫入追蹤不在本次read-only授權scope。 此段是離線來源盤點，沒有將未真capture分支自動提升pass。

## 049 穩定匿名gate補審

基準：`/home/deck/tag-analysis-private/ui-review/f1/playwright-internal-current-live/049-*.png`，1280／390 首屏已真看；capture JSON 與對應 `*-network.json`、`network.har` 保留。候選完整內容、互動與適用分支補審：pending，待 slot。
