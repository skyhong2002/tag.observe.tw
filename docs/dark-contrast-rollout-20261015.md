# Dark contrast rollout — 2026-10-15 (Taipei)

## Status

Source fixes are committed/pushed, but not yet deployed. Production remains web `7dc59c3c17f6d6420354c3d4df733549071f2bb4`, BUILD_ID `4nl3B-BcT4mA9uh47rm0Z`; API `dc7b814e220606202a408d21e73b1d6e7c61fe16` is unchanged. Fresh remote base `origin/main=d23e6b2b3b5d502fffe2187adac11e3559f61d7c` is an ancestor of the owner branch; the shared main checkout was not modified.

The requested `58cdab2d`/`72491ab8` candidate compiled successfully in65s (exit0), BUILD_ID `1BFXLn0tEjdB-V0S8d4ve`. Direct nice19/ionicec3 Next CLI, two workers; no install, DB migration, fixture, account or API code change. Seventy-three relevant accessibility/images/ranking/home-recovery/privacy/cache tests passed. Start disk54.46GiB/MemAvailable3.27GiB; recorded running sample54.29GiB/MemAvailable3.14GiB. Actual maxRSS was not obtained.

## Candidate724 actual independent review (not production)

Private job `/home/deck/tag-analysis-private/f1-release/dark-72491ab8-20261015-001` contains two four-route batches,64 original1280/390 light/dark viewport/full PNGs. Existing non-author GPT-6.1 Sol `/root/unfreeze_independent_review` personally viewed all64 originals, plus8 SHA-bound detail crops, with actual old formal7dc reference images. Candidate source/runtime inventory `2357b2bc2bd5d614901a5c40b3f2a6a3ad7d47911d8ccf8fc732be8b6256b0b6` is unchanged after capture; own listeners18334/18338 and PIDs1945611/1945610 stopped at22:20:29–30UTC. Formal services were untouched.

- `candidate-batch001-independent-review.{json,txt}` SHA256 `a7d80d30bea5bb8f4542039d8fa3d7876f8deb44a3367031a4d6ce3866157dfe`: ranking labels/table header and tag history sampled6.75–7.59:1; daily event first-card time remained3.67:1.
- `candidate-batch002-independent-review.{json,txt}` SHA256 `4c8c82a3f74f5f5a2a55ae97c8b1f67fbcbea55ce6739c1599a4f0240c0769b3`: media/header, article-list hashtags and topic coverage sampled6.75–7.59:1; the main-event hashtag and single-article tag counts remained3.67:1.
- Both remain **ISSUES**, never promoted to a UI pass or deployed.

Each batch has `manifest.json`, `network-1280.har`, `network-390.har`, `requests.json`, `transport.json`. Request/HAR counts1040/1040 and1412/1412; all recorded DNT1, page native DNT1, GPCnull, webdrivertrue; browser GA/GTM requests0 and transport admitted Google0. Chrome made blocked CONNECT attempts (99/92); zero outgoing does not mean zero attempts, and none of this is GA receipt/natural-visitor evidence. Candidate anonymous GET/HEAD only, fixed loopback, no credentials/account; API/image requests used existing anonymous public-read gateway. This is separate from formal HTTPS review.

## Minimal follow-up

`8aafad93` adds dark400 to residual event card/hourly page secondary labels; `bd1d21f7` covers the actual daily caption in `EventDayView`, folded hours and tier count. `9eb733706f70dccfa5b9ea5ebf59be7b3cbab0a4` covers `PeriodEvents` hero hashtags/neutral attribution, `ArticleTags` counts and shared event index labels. These preserve light colours, layout, data and actions. Existing installed-palette AA/source regression now covers those components;5/5 targeted tests pass. No new collision wrapper or mock framework.

The new exact source is prepared in `/home/deck/tag-analysis-private/f1-release/dark-9eb73370-20261015-001`; existing dependency copies and root/web lockfiles are unchanged. Build and same-artifact reshoot remain pending. Only `tag-ranking-pool-web.service` will switch after technical checks and non-author image review. Backups and direct rollback will restore the current7dc web drop-in/restart this unit; API/gateway/worker/current remain unchanged. Other routes and dynamic/error/auth states remain pending in the65-main-route ledger.
