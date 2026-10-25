# Dark contrast rollout — 2026-10-15 (Taipei)

## Status

Deployed web `9eb733706f70dccfa5b9ea5ebf59be7b3cbab0a4`, BUILD_ID `VhzeqqvJy2S0rYlvetwKX`, UTC2026-10-14T22:43:40.978625. Only `tag-ranking-pool-web.service` restarted; API `dc7b814e`/gateway/worker/current untouched. First200 in1.90s, six origin/public GETs200; canonical homepage also carries newBUILD. Fresh pre/post probes pass. No migration needed. Source fixes committed/pushed. Fresh remote base `origin/main=d23e6b2b3b5d502fffe2187adac11e3559f61d7c` is an ancestor of the owner branch; shared main checkout untouched. Previous web7dc retained as rollback. Formal screenshot review is separate and continues in [current9eb ledger](ui-review/current-live-9eb-20261015.md).

The requested `58cdab2d`/`72491ab8` candidate compiled successfully in65s (exit0), BUILD_ID `1BFXLn0tEjdB-V0S8d4ve`. Direct nice19/ionicec3 Next CLI, two workers; no install, DB migration, fixture, account or API code change. Seventy-three relevant accessibility/images/ranking/home-recovery/privacy/cache tests passed. Start disk54.46GiB/MemAvailable3.27GiB; recorded running sample54.29GiB/MemAvailable3.14GiB. Actual maxRSS was not obtained.

## Candidate724 actual independent review (not production)

Private job `/home/deck/tag-analysis-private/f1-release/dark-72491ab8-20261015-001` contains two four-route batches,64 original1280/390 light/dark viewport/full PNGs. Existing non-author GPT-6.1 Sol `/root/unfreeze_independent_review` personally viewed all64 originals, plus8 SHA-bound detail crops, with actual old formal7dc reference images. Candidate source/runtime inventory `2357b2bc2bd5d614901a5c40b3f2a6a3ad7d47911d8ccf8fc732be8b6256b0b6` is unchanged after capture; own listeners18334/18338 and PIDs1945611/1945610 stopped at22:20:29–30UTC. Formal services were untouched.

- `candidate-batch001-independent-review.{json,txt}` SHA256 `a7d80d30bea5bb8f4542039d8fa3d7876f8deb44a3367031a4d6ce3866157dfe`: ranking labels/table header and tag history sampled6.75–7.59:1; daily event first-card time remained3.67:1.
- `candidate-batch002-independent-review.{json,txt}` SHA256 `4c8c82a3f74f5f5a2a55ae97c8b1f67fbcbea55ce6739c1599a4f0240c0769b3`: media/header, article-list hashtags and topic coverage sampled6.75–7.59:1; the main-event hashtag and single-article tag counts remained3.67:1.
- Both remain **ISSUES**, never promoted to a UI pass or deployed.

Each batch has `manifest.json`, `network-1280.har`, `network-390.har`, `requests.json`, `transport.json`. Request/HAR counts1040/1040 and1412/1412; all recorded DNT1, page native DNT1, GPCnull, webdrivertrue; browser GA/GTM requests0 and transport admitted Google0. Chrome made blocked CONNECT attempts (99/92); zero outgoing does not mean zero attempts, and none of this is GA receipt/natural-visitor evidence. Candidate anonymous GET/HEAD only, fixed loopback, no credentials/account; API/image requests used existing anonymous public-read gateway. This is separate from formal HTTPS review.

## Minimal follow-up

`8aafad93` adds dark400 to residual event card/hourly page secondary labels; `bd1d21f7` covers the actual daily caption in `EventDayView`, folded hours and tier count. `9eb733706f70dccfa5b9ea5ebf59be7b3cbab0a4` covers `PeriodEvents` hero hashtags/neutral attribution, `ArticleTags` counts and shared event index labels. These preserve light colours, layout, data and actions. Existing installed-palette AA/source regression now covers those components;5/5 targeted tests pass. No new collision wrapper or mock framework.

The new exact source is prepared in `/home/deck/tag-analysis-private/f1-release/dark-9eb73370-20261015-001`; existing dependency copies and root/web lockfiles are unchanged. Build35.19s/exit0 and same-artifact two four-page reshoots completed; existing non-author personally viewed64 originals, specified text6.75–7.59:1 scoped visual PASS. Only `tag-ranking-pool-web.service` switched after technical checks and fresh deployment gate. Backups and direct rollback restore7dc web drop-in/restart onlythis unit; API/gateway/worker/current remain unchanged. Other routes and dynamic/error/auth states remain pending in the65-main-route ledger.


## Published artifact and rollout evidence

Job `/home/deck/tag-analysis-private/f1-release/dark-9eb73370-20261015-001`: `artifact.json`, `release-inventory.json` SHA256 `6a77cff770a1dc2dd48b22454c8556698be56d7a538502c1f93d106ac6c44d03`,81,717,807bytes/3061entries. Same original build, published cache-free (only seven generated homepage cache files omitted; original build preserved), old static files copied without clobbering new ones. Inventory unchanged after candidate. NativeSharp0.35.5 WebP/AVIF16×12 decode smoke passed;14 actual SSR/RSC final responses200, named fixture/canary scan and client private-origin scan empty. No universal secret or GA receipt claim. Actual maxRSS not obtained; startMemAvailable3.49GiB, observed21s sample2.36GiB, no claim that sampled values are a true peak.

New candidate `candidate-batch001-independent-review.{json,txt}` SHA `a61e757761f1f7ec20cd391b4015c49f6c31da5f08cf98bfadb6fc57c7b49906`, batch002 SHA `f0313b31125d24d5913915816b6030dd744d433a014196c9dfcd1f5b3b95a7d7`. Raw1063/1063 and1411/1411 request/HAR, DNT1, browserGoogle0 and transportGoogle outgoing0; blocked Chrome background attempts remain recorded. Second batch is **not all-gates-pass**: monitor measuredload12.53 at22:37:25, lastPNG22:38:02, completed22:38:03, result read22:38:11; own candidate stopped22:38:43. No new capture/deploy began until a fresh gate passed. Raw contains aborted/404 subresources and12 candidate-response-failed; visual PASS does not mean every image loaded or every resource succeeded. These exceptions and original724 ISSUES are retained.

`deployment-result.json`, `warm-timings.json`, `deployed-units.txt`, `predeploy-probe.json`, `postdeploy-probe.json`, `default-homepage-build.json` hold real times/units/gates. Postdeploy nine curls200/exit0; medians tag0.0461/blog1.8942/YT0.0413s, load2.57, disk51.76GiB, MemAvailable4.21GiB. Anonymous API remainspublic60; four sensitive-header kindsprivate,no-store, HSTS86400 (postdeploy-api-cache.json: allfive repeated22:47UTC200/exit0, unchanged backend).

Rollback (execute the saved, immediate web-only script): `bash /home/deck/tag-analysis-private/f1-release/dark-9eb73370-20261015-001/rollback.sh`. It restores the exact saved7dc drop-in, daemon-reloads and restarts onlythe web; original gateway/API/worker and protectedcurrent0dd stay. `web-unit-backup` retains unit/drop-ins/current target. No Cloudflare/WAF, backup timer/restore, DB or account changes.
