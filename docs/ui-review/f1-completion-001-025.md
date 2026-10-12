# F1 001–025 completion evidence

Reviewer: GPT-6.1 Sol, independent of these page implementations. This document records actual work, and does not convert a prepared checklist into a visual pass.

## Candidate and first attempt

- Exact candidate source: `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`; its private release `COMMIT` was read directly.
- Target is the internal candidate entry, not external production acceptance.
- 2026-10-12 20:08:34 UTC batch was blocked before browser launch by an erroneous private-script 153 GiB threshold. Actual free bytes: 150719029248; actual browser parents: 0; load1: 8.0034. No candidate screenshots, page requests, or visual reviews were produced by this attempt.
- Both before and after-no-capture gate artifacts remain at `/home/deck/tag-analysis-private/ui-review/f1/next-batch-2026-10-12T20-08-34-928Z/`. The before gate measured tag/blog/youtube HTTP 200 and TTFB 0.026465/0.023044/0.025121 seconds.
- Parent clarified that the user requires 10 GiB, not 153 GiB. The private script was corrected and checks the actual 10 GiB threshold before and during image generation. Provenance: `/home/deck/tag-analysis-private/ui-review/f1/capture-space-guard-correction.json`.

## Historical remaining scope at 20:08 UTC (superseded by current table below)

| Index | Route | Minimum remaining work | Cardinality and permission applicability | Status |
|---|---|---|---|---|
| 021 | `/api/` | Candidate schema full document at both sizes, outline jumps and response details; isolated cold-load schema failure | Many/few/empty user query results N/A: explanatory schema document; load failure applies. Page-specific permission N/A: public page has no AdminGate/ReaderGate. | pending |
| 022 | `/api/status/` | Full table and refresh; isolated healthy/degraded/unavailable SSR data | Fixed service contract makes arbitrary many/few/empty counts N/A; availability variations apply. Public permission N/A. | pending |
| 016 | `/admin/avatars/` | Query-preserving redirect, anonymous/disabled/nonadmin/session failure destination gate | Alias has no own collection; destination admin collections remain applicable and pending, not waived. Isolated fixtures do not establish real-admin acceptance. | pending |
| 018 | `/admin/tag-groups/` | Same states, independently navigated redirect evidence | Same alias rationale; do not transfer another route's pass. | pending |
| 019 | `/admin/tag-visuals/` | Same states, independently navigated redirect evidence | Same alias rationale; do not transfer another route's pass. | pending |
| 020 | `/admin/writing/` | Same states plus duplicate gate comparison | Existing two-gate source confirmed at exact candidate SHA; patch prepared privately, not applied or fixed. | issues |

At that time, other 001–025 routes retained the previously reviewed screenshot evidence and explicit remaining state list in `f1-remaining-001-025.md` from the shared review worktree and private `/home/deck/tag-analysis-private/ui-review/f1/remaining-scope-001-025.json`. This first-attempt historical entry raised no pass; later actual reviews below supersede its pending states.

## Actual candidate visual review, 20:11–20:14 UTC

Reviewer/model: GPT-6.1 Sol. Exact SHA remains `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`.

- 021: actually viewed 1280 failure screenshot. Parent verified bridge `/api/v1` index was rejected with 405, while the candidate spec endpoint worked; this is bridge incompatibility, not a proven product bug. The nonexistent quickstart action then timed out. Browser closed in finally; raw network/HAR preserved. Mobile and normal schema remain pending.
- 022: actually viewed every healthy table segment (1280: 6, 390: 11), then every segment after the actual refresh click at each width. All methods/paths/descriptions, F1 relations/groups endpoints, two normal service badges, and footer are legible. Long mobile paths wrap, sometimes the final fragment resumes at the cell left; no text or usage column is lost. Healthy/refresh scope passes; degraded/unavailable/notes are pending.
- 016, 018, 019: each independently navigated at both widths; all four segments per route actually viewed. Redirect retained `tag=柯文哲` and selected avatars/groups/visuals respectively. Anonymous login prompt, title, explanation, mobile tab wrap and footer are readable. No private admin data displayed. This is only anonymous scope; disabled/nonadmin/session errors and real admin collection workflows remain pending.
- 020: each width and footer actually viewed. Redirect retains tag and selects relations. Two login prompts remain, so issue remains open; no fix claimed.

Evidence for healthy status and four aliases: private `next-batch-2026-10-12T20-11-52-046Z/`, including every full/segment PNG, `report.json`, `network-raw.json`, `network.har`, and before/after resource JSON. Actual native DNT=`1`, webdriver=`true`, 1280/390 verified; Google attempts/completions both zero. Before/after gate load1 and three-site TTFB are preserved in those JSONs (after load1 8.252). Browser closed normally.

Actual image-read log: `/home/deck/tag-analysis-private/ui-review/f1/completion-001-025-review.log` records individual route, UTC, model, SHA, exact image paths and observations. At the time of that 20:11–20:14 entry, no complete-route pass had yet been raised; see the current table below.

Transport audit correction: the two completed batches used a script that blocked every GA/GTM resource type, but blocked only external documents for other hosts. Actual raw network records in these two batches contain no non-candidate-origin requests; this does not establish zero external traffic for earlier collectors. Later script versions block all non-candidate origins before navigation. Exact old/new source and per-batch script hashes are retained in private `external-transport-policy-audit.json`. Native DNT was verified as `1`; HTTP Sec-GPC=`1` does not imply native `navigator.globalPrivacyControl` is true (actual value is retained in each report).

## Pure redirect route completion

Parent clarified scope according to each actual route's function. Routes 016 `/admin/avatars/`, 018 `/admin/tag-groups/`, and 019 `/admin/tag-visuals/` contain only redirects, not their own admin datasets/workflows. Their **complete alias scope is pass** at candidate `225fa38`: each route was independently visited at 1280 and 390, actual resulting URLs retain `tag=柯文哲`, correct destination tab and both complete destination gate/footer layouts were actually viewed. Source files independently establish the fixed destination and scalar query forwarding. This does not make `/admin/tags/` (014) workflow pass: destination admin permissions, many/few/empty collections, approval/error operations remain tracked there.

020 `/admin/writing/` remains **issues** because its independently reviewed destination still displays duplicate gates. Prepared private patch is not applied and has no fixed/pass status.

021 v3 normal document evidence: private `next-batch-2026-10-12T20-17-24-415Z/` contains full-page images, 49 desktop and 67 mobile overlapping segments; all 116 initial segments were individually input through `view_image` and read. Normal document includes F1 relations/groups API descriptions; parameter tables, endpoint headings, rules, code blocks and footer are readable. Desktop quickstart anchor and both widths' first response details actually clicked/read. Code horizontal scroll and lower expanded fields remain pending; sidebar outline is mobile N/A because source intentionally hides it. This is normal initial whole-document scope pass, not complete-route pass. HAR/raw request list and actual DNT1/webdrivertrue/viewport evidence retained; Google attempted/completed both zero.

## Current completion status at 2026-10-12 20:26 UTC

All results here refer to candidate SHA `225fa38a08fb4c3ecd4733b75266a0dbf11830e8`, clean anonymous browser, light theme, actual 1280/390 CSS viewports. They do not assert external production deployment or true-admin acceptance.

| Index | Actual route function | Current status | Evidence and remaining scope |
|---|---|---|---|
| 016 | Avatar admin legacy redirect | pass | Independently visited both widths, actual destination `view=avatars` retains tag; destination gate/footer viewed. Source is only redirect. Destination business states remain in014. |
| 018 | Tag-group admin legacy redirect | pass | Independently visited both widths, actual `view=groups` retains tag; gate/footer viewed. Alias has no collection of its own. |
| 019 | Tag-visual admin legacy redirect | pass | Independently visited both widths, actual `view=visuals` retains tag; gate/footer viewed. Destination workflow not passed by this alias result. |
| 020 | Writing admin legacy redirect | issues | Correct redirect but duplicate anonymous gate persists at both widths. Private patch not applied. |
| 021 | Public API documentation | pending | Candidate normal initial full document 116 segments actually viewed; quickstart and first details opening viewed. Horizontal code scroll, expanded lower response fields and controlled cold-cache failure still remaining. Earlier bridge failure is only scoped fallback evidence. |
| 022 | Public API service status | pass | Healthy full endpoint table and refresh at both widths; degraded full endpoint table, unavailable complete fallback, expanded notes and actual docs tab navigation at both widths. Explicit isolated SSR fixtures. |

022 cardinality N/A is based on the actual fixed API/Nearline service contract, not missing tests: healthy/degraded/unavailable are its meaningful state branches, all captured and read. Public permission N/A: status page has no AdminGate/ReaderGate or page account operations. Its notes are the generic SourceMethod selected by FooterMethod's default; there is no API-specific @notes route. After actual docs tab navigation, `#method` count remains1 and the same intended source block remains; an open accordion persists. This does not prove other dynamic notes routes clear correctly.

Degraded evidence: private `next-batch-2026-10-12T20-20-40-241Z/`; every initial table segment read (1280:6,390:11), plus every new expanded notes section (1280:segments4–5;390:9–11), and both actual docs-navigation viewport images. API badge green normal, Nearline amber unavailable, clear partial-failure message. Duplicate initial table regions in expanded screenshots were not falsely counted as new review.

Unavailable evidence: private `next-batch-2026-10-12T20-22-42-797Z/`; all11 initial/expanded/actual navigation segments individually viewed. Clear Chinese retry message with no misleading normal status badges or stale endpoint table. Source/media-card notes and footer remain legible.

Both batches closed normally with complete HAR and raw request/response/failure JSON; actual native DNT1, default webdrivertrue and requested viewport widths verified; Google attempts/completions each0. Before/after load1: degraded8.9824/4.9023; unavailable3.7144/11.9966. Full three-site homepage HTTP/TTFB and browser-parent measurements remain in each before/after resources JSON. Scenario was atomically restored to healthy/normal after close. No further browser batch launched; slots yielded for parent coordination.

This fragment now completes4 actual routes (016/018/019/022), retains020 issues and021 pending. Other001–025 routes keep their previous scoped screenshot reviews and explicit remaining-state matrix; this is not a25-route blanket pass.

Commit status: this fragment is included in the specifically authorized documentation commit with the ledger and RSC audit; parent handles integration/push. The hash is reported in the handoff and Git history. Deployment status: not deployed by this reviewer; candidate UI evidence only.
