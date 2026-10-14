# Homepage topics: transient failure and oversized empty panel

## Observed evidence

Babysit UTC2026-10-14T16:50 reported `議題資料整理中。` with a320px blank region while direct public topics API returned200 with data. The accepted d1LV and new79 frontend's `page.tsx`, `lib/demo.ts` and `lib/pages.ts` are byte-identical: only the unrelated outlet-grid CSS changed. Both already used `fetchTopics(120)` → `/api/v1/topics?limit=120&kind=topic`,300s data revalidation, a fresh retry after an HTTP failure, and a null/error message inside an unconditional `min-h-80` wrapper. A transport exception previously went straight to null. Empty data and fetch failure were distinguished internally, but the failure wording incorrectly suggested data preparation.

This establishes that the failure path and whitespace defect predate the CSS change. It does **not** establish that the old live d1LV actually displayed the error at a particular historical time: that fetch helper silently discarded errors and no request-specific log was retained.

At UTC16:52–16:53 serial read-only measurements of exactly the SSR URL:

| API | First GET | Second GET | Status/data |
| --- | ---: | ---: | --- |
|18330 (new web's SSR origin)|1.415349s|0.561981s|both200;55 media,120feed|
|18130 (public gateway)|0.667227s|0.742536s|both200;55media,120feed|
|18230 (retained F1 API)|7.381028s|1.124197s|both200;55media,120feed|

These are direct API timings, not instrumented historical SSR timings, and first GET does not prove a fully cold DB/cache. Source shows no explicit fetch timeout for this endpoint, so a timeout cannot be asserted from the error text alone. Retained build data-cache entry was200 at UTC16:27:17.552. API logs contained three generic DB `Queue limit reached` warnings at UTC15:50–16:05, before the web switch. They were for media baseline/category refresh, not a captured topics request, so they are a possible shared resource symptom, not proof of the topics failure's cause.

UTC16:55:46 direct old d1LV18232/home was200 in0.917790s; new18332/home200 in0.010919s; neither contained the unavailable message. Both still reserved320px. The issue had recovered without an API or DB change. Private raw timings/responses, cache observation and two SSR HTML snapshots: `/home/deck/tag-analysis-private/f1-release/home-grid-79ab873b-20261015-001/topics-*`.

## Source correction (not deployed yet)

- Keep reserved space for pending/loaded topics, but collapse it when the resolved direct child is the empty/error notice. No fixed320px empty gap.
- Failure now says temporarily unavailable and links to the topic table; genuine empty data still says no recent updates.
- Add one uncached retry for a topics transport interruption, matching the existing HTTP-failure retry. Persistent failure is bounded at two attempts; other page transport behaviour stays unchanged.
- Topics requests log successful, recovered or unavailable status, elapsed milliseconds and a fixed failure category. No URL/query, title, body, SQL, credentials or arbitrary exception message is logged. Invalid JSON is never logged as successful recovery.

Tests: `web/test/home-topics-recovery.spec.ts` plus existing homepage suites:34/34 passed; frontend typecheck and focused Biome checks passed. Candidate visual review and deployment are pending a new build; disk start threshold remains40GiB and current available space is approximately37.7GiB. Existing accepted79/Plhg web stays live. Root cause of the historical server failure remains unconfirmed; this source correction handles recovery and presentation without claiming to fix every possible backend failure.


## Post-admission runtime correction

Human authorized deleting exactly11 named unused old releases. Effective/configured WorkingDirectory, current, Docker mounts and all-UID cwd were checked;562 readable cwd,0 permission errors and0 matches. A temporary read-only/no-network helper used an existing local image solely to read cwd; no persistent privileges or services changed. Directory write bits were enabled only inside the authorized targets to allow removal; hard-linked file modes were not changed.6,689,583,104 bytes of free space recovered, leaving43.726GiB. No other release/backup/worktree/timer changed. Receipts: `/home/deck/tag-analysis-private/f1-release/topics-c58858fa-20261015-001/cleanup-{preflight,completion}.json`.

The first c58858fa build succeeded (BUILD `8kpG3CZGGUjbQP4PZU9Ck`) after a Next prerender retry, but was not deployed. A new test using the installed Next `cloneResponse` reproduced a hang in the newly added awaited cancellation: canceling one tee branch waits for the retained branch. Removed these cancellation waits. This was caught before production and the failed test log is preserved.

Installed Next16 `dedupe-fetch.js` also explicitly excludes `cache` from the memoization key and bypasses memoization when a signal is present. Consequently the legacy HTTP retry's `cache:no-store` alone was not sufficient to guarantee a new origin request in SSR. The topics retry now includes its own10s AbortSignal, bypassing request memoization and bounding only this retry. Normal cached reads and other page retries are unchanged. This explains a recovery defect, not the original historical API failure. Tests include the real Next cloned response, transport/HTTP recovery, empty data, invalid JSON and query/body redaction. A new build and actual candidate state checks are required; c588 bytes were not switched into production.
