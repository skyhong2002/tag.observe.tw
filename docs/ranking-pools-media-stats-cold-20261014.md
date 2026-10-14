# media-stats cold read and retained producer

Private pre-cutover warmup, UTC2026-10-14T15:17:55–15:19:01: `/api/v1/media-stats`200 in65.398515s. Server measured client wall-clock query stages:

| Stage | Seconds |
| --- | ---: |
| Recent publication/summary counts |6.883|
| Historical own article counts and earliest crawl time |49.510|
| Discovery articles |0.101|
| Crawl run history |8.217|
| Topic checks/counts |0.225|

The historical query `SELECT media, MIN(crawled_at), COUNT(*) FROM articles WHERE source='own' GROUP BY media` uses articles_source_media_published, estimated500718 rows, Extra Using index condition / Using where. There is no crawled_at covering index. This identifies the dominant observed stage, not proof of a particular disk/CPU bottleneck. No index/migration was added.

At approximately15:18:36–15:18:40Z, a routine external blog homepage check returned500/time2.079083s; exact request start/end were not saved for that check. New private API/web were stopped before gateway cutover. The original accepted F1 gateway, web, API and worker remained active. All aborted artifacts/units/backups are retained. A subsequent blog check returned200/time6.554889; another saved check at15:32:40–15:32:59 returned200/time19.278257. These readings cannot establish that the tag warmup caused blog500, and are not deployment approval.

Evidence: `/home/deck/tag-analysis-private/f1-release/ranking-pools-deploy-20261014T151700Z/http.tsv`, service journal query-timing message, `/home/deck/tag-analysis-private/f1-release/ranking-pool-verification-20261014/media-stats-historical-plan.json`, after-abort-sites.json and retained deploy log. No restore, backup timer change, production migration or deletion occurred.

The succeeding backend can share the existing accepted F1 public stats producer (18230), using the fixed optional shared origin documented in ranking-pools.md. This avoids *additional* historical scans when starting new backend/API services. It preserves payload/timestamps and existing120s producer cache, never forwards credentials, and fails closed on redirect/status/timeout/size error. It does not shorten the original producer's49.5s historical query, and depends on retaining that F1 API. Full query optimization is a separate follow-up; no stale historical count or approximate earliest date is substituted.

Checks for the concentrated shared-producer change:42/42 relevant tests in one single-worker run, backend typecheck0, independent existing Sol10/10/source PASS. Receipt `/home/deck/tag-analysis-private/f1-release/media-stats-shared-independent-final-20261014.json`, SHA2561f558992ee4c2049b6cc1569ab8caf2b331fef1007b72cc19ac791bd66afa34a. Earlier failed9/10 test receipts remain; the corrected assertion measures additional stats SQL after existing startup/category bootstrap, not zero SQL for the whole app.
