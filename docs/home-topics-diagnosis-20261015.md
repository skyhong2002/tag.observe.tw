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

## Initial source correction (historical pre-build stage)

- Keep reserved space for pending/loaded topics, but collapse it when the resolved direct child is the empty/error notice. No fixed320px empty gap.
- Failure now says temporarily unavailable and links to the topic table; genuine empty data still says no recent updates.
- Add one uncached retry for a topics transport interruption, matching the existing HTTP-failure retry. Persistent failure is bounded at two attempts; other page transport behaviour stays unchanged.
- Topics requests log successful, recovered or unavailable status, elapsed milliseconds and a fixed failure category. No URL/query, title, body, SQL, credentials or arbitrary exception message is logged. Invalid JSON is never logged as successful recovery.

Tests: `web/test/home-topics-recovery.spec.ts` plus existing homepage suites:34/34 passed; frontend typecheck and focused Biome checks passed. Candidate visual review and deployment are pending a new build; disk start threshold remains40GiB and current available space is approximately37.7GiB. Existing accepted79/Plhg web stays live. Root cause of the historical server failure remains unconfirmed; this source correction handles recovery and presentation without claiming to fix every possible backend failure.


## Post-admission runtime correction

Human authorized deleting exactly11 named unused old releases. Effective/configured WorkingDirectory, current, Docker mounts and all-UID cwd were checked;562 readable cwd,0 permission errors and0 matches. A temporary read-only/no-network helper used an existing local image solely to read cwd; no persistent privileges or services changed. Directory write bits were enabled only inside the authorized targets to allow removal; hard-linked file modes were not changed.6,689,583,104 bytes of free space recovered, leaving43.726GiB. No other release/backup/worktree/timer changed. Receipts: `/home/deck/tag-analysis-private/f1-release/topics-c58858fa-20261015-001/cleanup-{preflight,completion}.json`.

The first c58858fa build succeeded (BUILD `8kpG3CZGGUjbQP4PZU9Ck`) after a Next prerender retry, but was not deployed. A new test using the installed Next `cloneResponse` reproduced a hang in the newly added awaited cancellation: canceling one tee branch waits for the retained branch. Removed these cancellation waits. This was caught before production and the failed test log is preserved.

Installed Next16 `dedupe-fetch.js` also explicitly excludes `cache` from the memoization key and bypasses memoization when a signal is present. Consequently the legacy HTTP retry's `cache:no-store` alone was not sufficient to guarantee a new origin request in SSR. The topics retry now includes its own10s AbortSignal, bypassing request memoization and bounding only this retry. Normal cached reads and other page retries are unchanged. This explains a recovery defect, not the original historical API failure. Tests include the real Next cloned response, transport/HTTP recovery, empty data, invalid JSON and query/body redaction. A new build and actual candidate state checks are required; c588 bytes were not switched into production.


## Actual candidate/production DOM and cached fallback evidence

At UTC17:50–18:00, candidate normal topics fetch logged200 (5.032s), while the browser had no topic list; the preserved production-reference DOM explicitly contained `議題資料整理中。`. Direct APIs were200 (18330:1.721s;18130:5.208s). The candidate815 build's `index.html` explicitly contains the unavailable message and its prerender manifest declares a complete static homepage with60s revalidation. Thus a cached HTML error state can outlive the individual API failure; a fresh successful API request does not itself update a document already showing that state.

Accepted d1LV's cache-free release has no `index.html`; live79 has that file, but its original build file does **not** contain the old unavailable text. This is a packaging difference, not proof that79 originally shipped an erroneous topic snapshot. The transient failure's first cause and why the particular background revalidation did not promptly replace the production error remain unconfirmed. Raw comparison/DOM/network data are preserved in the815 private job; first two captures are incomplete and not UI passes.

The final source follows the existing homepage ranking recovery pattern: only when SSR data is missing, a small client panel performs one public `/api/v1/topics?limit=120&kind=topic` GET (no browser cache,10s timeout), without changing GA/consent or cache policy. It uses the same topic summary and card rendering as SSR. Success updates the existing document; persistent failure stays compact and offers explicit retry/topic-table navigation; valid empty data stays distinct. Pending client recovery also stays compact, while the ordinary SSR loading/list reserve remains. There is no timer polling, invented topic, new DB/API contract or migration. Candidate will cover normal, recovered, empty and persistent-failure states at1280/390 and light/dark before this source is deployed.

## Completed current rollout

APP `7dc59c3c17f6d6420354c3d4df733549071f2bb4`, BUILD `4nl3B-BcT4mA9uh47rm0Z` is live from2026-10-14 UTC18:32:13. Only web restarted; API/worker unchanged.38 homepage tests,37 privacy/cache tests, independent source review and16 target＋4 reference actual screenshots passed. In a normal candidate run the private SSR API actually returned500 twice (187ms total); the public browser recovery still produced five cards. The controlled SSR503/public200 state also recovered in every viewport/theme. These are current recovery evidence, not identification of the original historical500's cause.

Persistent-failure panel measured78px, valid-empty47.59375px; the old fixed320px empty reserve is removed. The client fetch defaults to same-origin credentials, so a signed-in browser may send its existing site cookie; credentialed source responses retain private/no-store. No new foreign transport, GA event, consent change or authenticated test account was introduced.

The published runtime omits seven generated homepage cache files only, matching the accepted d1LV cache-free publication shape; compiled JS/CSS/native bytes are unchanged from the successful build. The original build is retained. The reviewed runtime inventory, actual screenshots, HARs, public formal checks, rolling cleanup and immediately executable79 rollback are recorded in [the completion receipt](home-topics-rollout-20261015.md). Babysit's formal browser acceptance and the full65-route review remain pending.
