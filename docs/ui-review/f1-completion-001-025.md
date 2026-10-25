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


## Offline historical image review update — 2026-10-12 21:41 UTC

Reviewer: GPT-6.1 Sol. No browser, capture, build, deployment or image mutation was performed. Actual original-image inputs and their read times are recorded in `/home/deck/tag-analysis-private/ui-review/f1/completion-001-025-review.log`; this update uses historical SHA `48083b58c4ee3d16f2072206f1da3df332f34143`, not current candidate source HEAD or a revalidation of its fixes.

Newly read historical section full-page pairs: 001,002,004,005,006,007,008,009,010,011,012,013 (24 PNGs). Four stable-state 023 images were also actually input: unknown article query and reversed date interval, each at1280/390. Exact filenames and UTC are retained in the log. Source directory is private `playwright-sections-001-025/`; 023 uses `playwright-stable-states-v2/`. Path mentions in a capture index are not proof of visual review. The log includes an explicit correction to the preliminary inventory: only actual image-read records and identical SHA256 reuse count as reviewed evidence.

001 mobile historical full image contains actual broken-image glyphs in the word-cloud region. This is a confirmed **historical pictured-state issue**, not a proof that current candidate dba9325 still has it. Recommendation for the current candidate main row is **pending**, with this historical issue carried as an unresolved image-loading check; do not silently turn old evidence into a current-build issues/pass result. Blank charts and lazy placeholders on other images remain observations requiring stable-load evidence, rather than being asserted as product failures.

Very long originals (010 media,012 topic,013 feature and005 mobile event) were actual image inputs, but the renderer reduces long-image text. Their overall spacing/footer can be assessed; not every tiny row/metadata label can be read. Continuous readable viewport evidence remains missing. Existing middle/bottom images cover only their actual regions. HTTP200 or full-page PNG existence does not complete this gap.

| Route index | This update's evidence / explicit remaining evidence | Current candidate recommendation |
|---|---|---|
| 001 | Historical whole-page hierarchy and footer read; mobile broken word-cloud images. Need candidate stable image loading, notes/navigation, many/few/empty/error states applicable to datasets. Public permission N/A: no admin account gate. | pending; historical issue noted |
| 002 | Historical full list/matrix/footer read; trend frame blank. Candidate long-label issue is independently recorded in last reviewer fragment; source fix is not revalidation. Need stable trend, matrix scroll/modes, pagination/follow and many/few/empty/error. FollowButton, signed-in PictureLink and TagRelationSubmission loading/disabled/anonymous/signed-in/error interactions remain pending; public readability is not account-workflow acceptance. | issues (existing candidate long-label evidence) |
| 003 | Existing first-screen/section evidence remains bounded; no new full-picture input this update. Need complete readable picture layout and candidate normal/few/empty/error, navigation. Permission branches remain pending: PictureVote session loading, sign-in disabled, anonymous login prompt, signed-in voting/upload/review-result workflow. No new login/account or write operation was performed. | pending |
| 004 | Historical50 ranking rows read; right-hand mobile table columns and sort/filter/more/state interactions not covered. Public permission N/A. | pending |
| 005 | Whole-page event layout input; long mobile tiny fields not fully readable. Need continuous segments, date/index filters and many/few/empty/error. Public permission N/A. | pending |
| 006 | Event details/KPIs/chart/matrix/headlines/footer read; mobile right columns, expand controls, stable chart and valid many/few/empty/error instances missing. Public read has no permission gate, but FollowButton/SaveButton session-disabled/anonymous/signed-in and busy/error branches remain pending. | pending |
| 007 | Historical44 grouped headlines read. Need expand/highlight toggle and meaningful few/empty/error instance evidence. Public permission N/A. | pending |
| 008 | Both widths show temporary article-content failure, not loaded article or genuine404. Need valid loaded article, absent article distinction and recovery. Many/few N/A for a single article resource; public read has no gate, but ArticleView SaveButton/ReportButton reader permissions and AdminFullText admin/nonadmin branches remain pending. | pending |
| 009 | No-query destination article layout read; real GET query submit, clear, results/empty/error not covered. Public permission N/A. | pending |
| 010 | Long media table overview only; readable complete row segments/right scroll/sort/filter/many/few/empty/error missing. Public permission N/A. | pending |
| 011 | Historical30 latest articles and footer read; date/filter/more and many/few/empty/error missing. Public permission N/A. | pending |
| 012 | Long topic overview only; readable complete body, query/filter/sidebar, many/few/empty/error missing. Public permission N/A. | pending |
| 013 | Long feature overview only; readable complete body, filters/related expansion, many/few/empty/error missing. Public permission N/A. | pending |
| 014 | Existing anonymous gate only; candidate admin collection workflows, existing authorized/nonadmin permissions and many/few/empty/error remain missing. No new account/login performed. | pending |
| 015 | Existing anonymous admin gate only; authorized/nonadmin/session-error branches remain missing. Many/few N/A for the gate itself; dataset workflows belong to their routes. | pending |
| 016 | Complete pure redirect scope already independently passed at225fa38; destination dataset branches belong to014. No new revalidation this update. | retain pass at recorded225 SHA |
| 017 | Existing anonymous admin-media gate only; actual authorized/nonadmin/session-error and media dataset states missing. | pending |
| 018 | Complete pure redirect scope already passed225fa38; destination workflows tracked014. | retain pass at recorded225 SHA |
| 019 | Complete pure redirect scope already passed225fa38; destination workflows tracked014. | retain pass at recorded225 SHA |
| 020 | Duplicate anonymous gates confirmed225fa38; fixed source is unreviewed candidate, and author must not self-review fix. Pure alias cardinality N/A; destination workflows tracked014. | issues until independent new-build revalidation |
| 021 | Candidate225 normal document116 readable segments already reviewed. Code horizontal scroll, lower expanded response fields and isolated cold-cache schema failure still missing. Many/few N/A for generated fixed schema contract; public permission N/A. | pending |
| 022 | Meaningful healthy/degraded/unavailable, notes/refresh/tab navigation already completed225fa38; cardinality and public permission N/A per fixed contract/source. | retain pass at recorded225 SHA |
| 023 | Unknown-query desktop is query failure, not proven empty result. Reversed date desktop has clear red validation with retained values. Both mobile images are English503 fallback, not mobile validation evidence. Need actual mobile form, valid normal/few/empty/error and clear/navigation. Public permission N/A. | pending |
| 024 | Existing screenshots only; no newly read evidence this update. Need remaining readable body/control interactions and source-applicable dynamic normal/few/empty/error. No completion inferred from shared components. | pending |
| 025 | Existing screenshots only; no newly read evidence this update. Need remaining readable body/control interactions and source-applicable dynamic normal/few/empty/error. No completion inferred from shared components. | pending |

Unreviewed historical formal captures, unread section primary/full images and additional-state images remain pending; this small offline batch does not claim their coverage. Their source48083 cannot substitute for candidate dba9325 acceptance. No main-ledger counts are changed by this historical update. Resource gate: parent reports2026-10-12 21:42UTC free112.756GiB below its current113GiB capture threshold; capture remains paused. This reviewer did not independently rerun the resource gate or produce new artifacts.

Commit status for this update: not committed by this reviewer; parent will integrate the owned fragment. Deployment status: none; historical48083 and candidate225 evidence only, no claim of new candidate or formal deployment acceptance.


Permission applicability correction — source-only review: 003 is not permission N/A. `web/src/app/(site)/tag/[tag]/picture/PictureVote.tsx:50–62` explicitly distinguishes session loading, sign-in disabled, anonymous login prompt and signed-in Board; voting/upload outcomes remain unreviewed. Also corrected002(tag follow/picture/relation submission),006(event follow/save),008(article save/report/admin full text). “Public permission N/A” elsewhere means only ungated page data/read scope; shared AccountMenu session branches are not implicitly passed by these rows. No login, account creation, write request or screenshot capture occurred in this correction. Source inspection does not elevate any route status or revalidate a source fix.
