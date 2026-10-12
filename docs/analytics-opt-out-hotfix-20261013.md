# Analytics opt-out privacy hotfix and navigation evidence

## Deployment and scope

- Frontend release **`0dd38b629621e27ccb40260a27b27cf2d7202519`**, pushed to `origin/main`.
- Switch started **2026-10-12 19:34:22.267895502 UTC**; frontend PID/cwd and origin response verified **19:34:24.447674007 UTC**.
- The clean detached worktree was created from fetched `origin/main` **`7cf2ba3ebe3d64a6a6a247efa06f20121f979837`**. Commit `9b25299` reverted F1 before this release; `b911fb0`, `a7193e7`, and `0dd38b6` contain the privacy fix and tests. Compared with running `48083b5`, backend source and runtime dependency manifests are unchanged. **F1 is not deployed.**
- Only `tag-web.service` restarted. Gateway PID 114409 and worker PID 114174 were preserved, with their unchanged `48083b5` code. Current symlink and frontend PID 325597 point to `0dd38b6`.
- Disk before/after: approximately 149 GiB available; old releases, backups and worktrees retained. No production database migration, account creation, permission change, Cloudflare change, or GA data deletion.
- **This switch was not interruption-free:** gateway logs record 22 failed frontend connections from **19:34:22.407 to 19:34:23.413 UTC**, including our probes. Do not describe this deployment as zero downtime. Backend remained running. The original rollout monitor incorrectly called `Response.status()` and used `/healthz`; its raw failed artifact is retained and is **not** availability proof. Corrected post-deployment monitoring used `/_migration/health` and the opt-out page: 292 requests, all HTTP 200, over 15 seconds.
- Deployment artifact directory: `/home/deck/tag-analysis-private/f1-release/privacy-deployment-20261012T193417Z/` (timestamps, previous unit/link, process identities, smoke, HTML/headers and gateway switch log).
- Rollback release: **`48083b58c4ee3d16f2072206f1da3df332f34143`**, still fully present at `/home/deck/.local/share/tag-analysis/releases/48083b58c4ee3d16f2072206f1da3df332f34143`. With the deployment lock held, atomically replace `current` with a symlink to that directory and restart **only** `tag-web.service`; verify frontend cwd, `/_migration/health` and `/observe/opt-out/`. Gateway/worker and database need no rollback. The deploy script automatically does this if its post-switch check fails. Reverting to the old release also reintroduces this privacy bug; use only when operationally necessary.

## Defect, impact conditions and period

`PrefsSync` previously treated the account preference as authoritative. When a signed-in browser had local `tag-analytics-opt-out=1` but the account returned `analyticsOptOut=false`, it removed the local key. The current document's analytics runtime could still retain its sticky opt-out / `ga-disable=true`, producing **local key null with GA disabled**. A subsequent document without that local key could become eligible if production, automation, DNT/GPC, private-route and other guards all allowed it. This is a reproducible source defect; the old native-preview observation lacked writer traces and account state, so its particular cause is not conclusively attributed.

Code introduction: **`84d5671726af046f111fe05421bda53b62c15c08`**, author/commit UTC **2026-10-10 15:30:56**. This is **not evidence of the first deployment time**. The exact first live deployment of PrefsSync is **not recorded in the evidence available for this audit**. The affected code is confirmed in later live releases including `4aa4d41` and `48083b5`; the latter remained live until the switch above. Thus the exposure window is from the first deployment containing `84d5671` (start unknown) until this hotfix reaches the browser. Already-open pages or cached older JavaScript may retain old behavior until a fresh document loads the new assets.

Affected conditions: signed-in preference synchronization, an existing browser opt-out, and an account `false` (including a delayed response to a newer local choice). Anonymous readers do not apply an account preference; account `true` does not clear local opt-out; independent automation/DNT/GPC/route guards still suppress analytics. We did **not** query users or estimate affected user/event counts. Existing GA data is retained; the user decides whether any further action is appropriate.

The fix makes synchronization privacy-preserving: it can strengthen opt-out but cannot silently clear an existing browser opt-out. A choice made after a preference request wins over that stale response, disposed effects ignore late responses, the store returns its latest value and cannot overwrite a newer PUT with the initial GET, and explicit choices survive same-document remount. Same-tab opt-out events refresh the visible status. Explicit restoration remains a user action; it was **not** clicked during browser verification.

Tests: `app/test/analytics-preference.spec.ts`, `app/test/analytics-runtime.spec.ts`, `app/test/analytics-consent.spec.ts`, `web/test/reader-store.spec.ts`: **38 passed**; root, frontend and frontend-test TypeScript checks passed. The store test was moved to frontend module settings in `0dd38b6` after an earlier root TypeScript check failed. No earlier failure is counted as a pass.

Independent reviewer: **GPT-6.1 Sol, `/root/ui_review_last`**. It found the stale-store/remount issue in the initial fix; follow-up source review and candidate browser evidence review found no blocking issue. Logs: `/home/deck/tag-analysis-private/ui-review/f1/privacy-independent-code-review.log` and `privacy-independent-reviewed.diff`. Limits: rapid explicit toggles/PUT ordering, storage failures and full reload before a failed explicit restore PUT are not claimed as fully covered browser scenarios; privacy-preserving local opt-out remains protected.

## Safe browser evidence (not GA receipt evidence)

Playwright used an independent fresh Chromium profile with **native `enable_do_not_track=true` and `channel: chromium`**, DNT header 1, Sec-GPC header 1, default headless UA and unchanged `navigator.webdriver=true`. No navigator override, no account login and no production preference write. Before the first site navigation, context routing blocked Google Analytics, Tag Manager and Google transports. Reader session and preference requests were fulfilled by isolated fixtures, including every PUT. The account fixture deliberately kept returning `false` on each new document.

Earlier attempts that set only the DNT HTTP header, or used headless-shell with a profile preference, reported `navigator.doNotTrack=null` and failed the DNT assertion. They remain preserved, are not DNT acceptance evidence, and still had the automation guard and network block; no Google request occurred. A DNT header alone must not be reported as native browser DNT.

| Evidence | UTC range | Result / private directory |
| --- | --- | --- |
| Old live `48083b5` + isolated account=false | 19:31:57–19:32:00 | Local opt-out is cleared; GA stays blocked by guards. `privacy-browser-2026-10-12T19-31-57-265Z/` |
| Candidate `0dd38b6` | 19:31:58–19:32:33 | 13 steps preserve local opt-out; commands/scripts/Google attempts/completions all zero. `privacy-browser-2026-10-12T19-31-58-481Z/` |
| Deployed public `https://tag.observe.tw` + isolated account fixture | 19:34:32–19:35:17 | Same 13 steps pass, opt-out retained, Google attempts/completions zero. `privacy-browser-2026-10-12T19-34-32-548Z/` |

Directories above are under `/home/deck/tag-analysis-private/f1-release/`, each with `report.json`, `requests.json` and `network.har`. Every step records UTC, path/query, document referrer/title, random document ID, `performance.timeOrigin`, lifecycle events, dataLayer commands, guard values and script URLs. `window.gtag` is not exposed by the product; actual calls are represented by the runtime's dataLayer arguments. All browser command arrays are empty under the preserved guards. These are **program/browser behavior evidence, not proof that GA received anything**.

Steps: account sync after local opt-out; reload; client navigation to home; native search submission and back; `/admin/`, `/login/`, `/observe/opt-out/` each to public home; `/liveboard/`; new tab. No real admin session was used. Public deployed verification also used intercepted fixture responses and did not inspect private user data.

Independent visual review: `/home/deck/tag-analysis-private/ui-review/f1/privacy-ui-2026-10-12T19-32-40-681Z/independent-review.log`. Reviewer actually viewed six full-page screenshots comparing old/candidate 1280 px and 390 px, before/after opting out and mobile reload. No blocking layout/status issue. This pass is scoped to the privacy page and does not complete F1 or the full UI ledger.

## Search return: artifact provenance and chronology

| Artifact / version | Recorded provenance and time | Interpretation |
| --- | --- | --- |
| `analytics-privacy-network-20261013.json` (B) | Own `deployment` field: `4aa4d41624adf46be21f2735e5afe12fc131a638`; 17:17:22.445–17:23:16.107 UTC. Deployment notes identify that live version. | Historical synthetic requests with HTTP 204. Audit only, not natural traffic or GA reporting evidence. |
| `analytics-priority-network-20261013.json` (C) | Own `release` field: `adf47ee84fda870592bdf50d42694a1e396bcb5c`; 17:54:09.947–17:56:41.269 UTC. `docs/mobile-performance-20261013.md` records deployment at 17:45:04. Original runner agrees. | DNT=0, general UA and overridden automation guards: outside the user's authorization. Retained for audit, never rerun or used for acceptance. |
| `analytics-offline-20261013.json` | `utc=2026-10-12T18:06:36.206Z` and in-memory mode; **release not recorded**. Runner imports mutable worktree paths, not pinned Git objects. | Do not infer `adf47ee` as the executed release. Twenty-two mock cases cannot prove Google receipt or native browser navigation. |
| `48083b5` | Deployment notes: 18:20:30 UTC ready. | Previous live version. |
| `b911fb0` | Git commit 19:14:36 UTC. | Initial confirmed opt-out fix; not independently deployed. |
| `7cf2ba3` | Git commit 19:14:39 UTC. | F1 with that fix; not deployed; F1 reverted for the privacy batch. |
| `0dd38b6` | Git commit 19:23:12 UTC; deployed 19:34:22–24. | Standalone privacy batch after independent review. |

Across `4aa4d41`, `adf47ee`, `48083b5`, `b911fb0`, and `7cf2ba3`, the analytics runtime/consent/SiteAnalytics Git blobs are identical (`9e61ae7…`, `b616b3b…`, `77ad2f1…`). Their source semantics do not differ on private-to-public transitions. This is source evidence, **not a missing release identifier for the old offline artifact**.

C's search submission was recorded at 17:56:34.148 UTC with no collect. On return, the two responses were an **empty-field availability probe at 17:56:37.271** and **one homepage `page_view` at 17:56:39.387** (both 204); the state record was 17:56:41.252. It was not two page_views. The runner only checked same-document identity on home→tag, not search/back, and did not record timeOrigin, document requests or BFCache/pageshow identity there. Its `ok:true` checked query/private leakage, not a tainted-state assertion. Historical search/back document identity is therefore **not recorded**.

The old offline test used a single in-memory window with pushState/popstate. Once an already-configured document visits a private/query page, it is intentionally disabled for the rest of that document. A new public document may configure once with sanitized fields; a private landing document that never configured may start on its first public page. These are different scenarios.

The new candidate browser explicitly observed a new document on native search submit (`47a72153…`, timeOrigin `1791833525188.6`) and another on back (`d6772320…`, `1791833535237`). Private `/admin/` and `/login/` → public link navigation retained their document IDs. This establishes the behavior **in this run**, not the historical C run. All browser commands were zero under DNT/automation/opt-out.

Independent, network-disabled four-version mock comparison (`48083b5`, `b911fb0`, `7cf2ba3`, `0dd38b6`) covers 28 version/scenario steps. Files: `/home/deck/tag-analysis-private/ui-review/f1/offline-versions/{review.mjs,result.json,review.log}`. They pin Git source, record fixture document IDs/times, URL/referrer/title and commands; all field assertions pass. Same-document configured public→private→public stays disabled; private landing→first public and new-document public each issue one config with safe page_location, origin-only page_referrer and fixed public title. Liveboard analytics title is `即時看板`; the visible document title may include the site suffix. No manual duplicate page_view is emitted. **Google's enhanced-history engine is not executed, so these mocks cannot prove its actual event count.**

Conclusion: no evidence identifies a version regression between the requested versions. The recorded difference is compatible with distinct document lifecycles, but C's missing navigation identity prevents a definitive historical cause. The confirmed PrefsSync defect was fixed independently without changing analytics guards. Search query/private path/title never enter the mock outgoing fields; guarded browser runs emit none. Historical originals remain preserved under `/home/deck/tag-analysis-private/ui-review/f1/search-return-originals/` with SHA-256 checksums; independent audit is `search-return-independent-audit.log`.
