# UI review fix backlog (2026-10-15, f62 formal review)

Issues found by non-author reviewers on formal f62 screenshots, collected to be fixed together.
Status: open / fixed@<sha> / wontfix (reason).

| # | Route | Severity | Issue | Status |
|---|---|---|---|---|
| 1 | 037 `/journalist/方承業/` | blocking | Page is 197k px (1280) / 284k px (390): all 1,180 similar pairs render with full diffs, no paging; the 501-article list is unreachable. | fixed in source 280e582a (newest 20 groups / 100 articles, 顯示全部 ?all=1) |
| 2 | 037 `/journalist/方承業/` | minor | 390px: numbers wrap away from units (「對方多 0」/「字」, 「共 1,180」/「組」). | fixed in source 280e582a (whitespace-nowrap) |
| 3 | 025 `/byline/organization:…/` | minor | Each row says 「原文署名：民間全民電視公司」 then 「未署名」 — contradictory. | fixed in source 280e582a |
| 4 | 042 `/media/cnews/` | minor | Desktop sidebar 「媒體關係」 shows 「暫時無法取得」 to anonymous readers. | fixed in source 280e582a (Suspense stream, 25 s budget) |
| 5 | 042 `/media/cnews/` | minor | 「最新收錄」 first page mixes 2017 articles shown as 7/2, 10/27 without a year (looks like a future date). | fixed in source 280e582a (taipei() adds the year outside the current year) |
| 6 | 001 `/` (via 029 `/demo/`) | minor | 「讀者關注」 ranks 01/04/05 all read 「新文易數」 — page names fall back to the site name. | fixed in source 68b8200f (API: ignore generic GA titles, name from path) |
| 7 | 001 `/` | minor | 390px: 「最近更新的議題」 outlet icon on its own line, 「篇相關」 wraps to 「篇相／關」; focus-card sparkline alone on a line. | fixed in source 3e73f344 |
| 8 | 001 `/` | note | Dark mode: line-art avatars/maps in the word cloud have white backgrounds. | open (note; artwork assets, not code) |
| 9 | 021 `/api/` | minor | Endpoint list links truncated to 「GET /api/v1/arti…」 (390: 「GET /ap…」); inline code and outline break mid-word; 390 page 49,914px with the outline after all sections. | fixed in source 3d424653 (PathBreaks, index wraps) |
| 10 | 022 `/api/status/` | minor | 390px: endpoint paths break at any character (「curren／t」). | fixed in source 3d424653 |
| 11 | 028 `/crawlers/traffic/` | minor | 390px: the Cloudflare Radar column is off-screen and months cut to 「202」 with no horizontal-scroll cue. | no change: already the shared TableScroller with right-edge fade; a still screenshot cannot show it |
| 12 | 011 `/article/` (via 009) | minor | 「過去 24 小時」 numbers disagree on one page (sidebar 244 media, footer 245) and with the home page (8,440 vs 18,269; camp split 44/14/42 vs 23/58/20) with no note on the different scopes. | open (needs a scope note per counter; product wording decision) |
| 13 | 023 `/article/query/` | minor | 390px: buttons wrap 「查詢文／章」「清除條／件」; 「18:13 *」 asterisk unexplained; two 知新聞 titles contain body text. | buttons fixed in source 3d424653; asterisk/知新聞 titles open |
| 14 | 055 `/observe/opt-out/` | minor | When already opted out the primary button still reads 「這個瀏覽器不計入統計」 and the intro mentions a switch that is not there; 1280 footer showed stale 「2,203 篇 · 227 家」. | button fixed in source 3d424653; stale footer fixed by #16 |
| 15 | 054 `/observe/` | blocking | 「熱門頁面」 7 rows and 「讀者關注」 5 rows all titled 「新文易數」 (same cause as #6). | fixed in source 68b8200f (API) |
| 16 | 039 `/liveboard/setting/` and others | minor | Footer first shows 「今天已收錄 2,203 篇・227 家」, then 13,967 / 245 seconds later — stale number in the initial render. | fixed by API e2769539: the footer fetch (4 s budget) timed out on the 50–60 s media-stats and kept the build-time value; at 18:24 all sampled pages show today’s count |
| 17 | 059→060 `/similarity/reposts/` | blocking | Daily stats stay on 「載入每日統計中…」 when `/api/v1/similarity/daily` is slow: no timeout, error or retry. | fixed in source 3d424653 (30 s timeout + 重試) |
| 18 | 060 `/similarity/reposts/` | minor | 390px: legend 「比對篇數」 overlaps the y-axis title; six y ticks crammed; 13,632px page listing every zero-count outlet; outlet names with parsing residue (「・以上言論由東森…」「作者：財訊雙週刊」). | open |
| 19 | 054 `/observe/` | minor | Live card 「0 位讀者・1 次瀏覽」; Google Search clicks/impressions all 0 while 「從哪裡來」 lists Google 9 times, no note on Search Console status. | open (Search Console connection is an owner/data question) |
| 20 | 049–053 `/my/*` | minor | 390px: the last tab 「設定」 touches the container edge, no scroll cue; anonymous sub-tabs reuse the generic login text. | fixed in source 3e73f344 (SectionTabs wrap) |
| 21 | 014/015 `/admin/*` | minor | Anonymous message is only 「請先 登入 。」 (stray spaces) and does not say admin rights are needed. No admin data leaked. | fixed in source 3e73f344 |
| 22 | 060 `/similarity/reposts/` | blocking | Root cause of #17: `/api/v1/similarity/daily` (30 days) takes 30–53 s. | fixed in source 5b01afdb (settled days cached; 3.9 s after restart, identical output) |
