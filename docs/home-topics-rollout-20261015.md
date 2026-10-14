# Homepage topics recovery rollout — 2026-10-15 Taipei

## Current deployment and scope

Web APP `7dc59c3c17f6d6420354c3d4df733549071f2bb4`, BUILD_ID `4nl3B-BcT4mA9uh47rm0Z` deployed at `2026-10-14T18:32:13.887156+00:00` (UTC2026-10-14; Taipei2026-10-15). Code is committed and pushed on `feat/sm-f1-candidate-capture`; remote-main base is `d23e6b2b3b5d502fffe2187adac11e3559f61d7c` (fresh fetched, ancestor of APP). No shared checkout edits. This completion document is a subsequent documentation commit, not another compiled version.

Only `tag-ranking-pool-web.service` restarted; PID `1467888`. Restart to first full200 homepage: **1.677s**. API/gateway/worker PIDs1151832/1109420/1152036 remained unchanged. No migration, API change, backup timer or Cloudflare/WAF change. All six local/public home, tag and relations GETs200; public home contained the new BUILD_ID. See `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/deployment-result.json` and `deployed-units.txt`. Babysit's independent formal browser acceptance remains pending; full65-route scope stays0complete/65pending.

## Behaviour and diagnosis limits

The unavailable/320px whitespace path predates the CSS-only79 rollout; historical d1LV failure time and first backend cause are not established. The installed Next memoizer can reuse a failed response when only cache:no-store is changed; topics retries now bypass it with a bounded signal and never wait on one cloned-body cancellation. A cached failure document also needs its own recovery: the new client panel runs only for missing SSR data, issues one same-origin public topicsGET, and permits an explicit retry without polling. Valid empty data remains distinct. Existing site cookies may accompany the default same-origin fetch; credentialed responses are no-store.

During normal candidate SSR, the private topics endpoint returned500 twice (187ms combined) while browser public API recovery produced five cards. Controlled SSR503/public200 also recovered in all four viewport/theme combinations. Warm-up later logged topics200 in1524ms; full warm homepage1.675506s, second0.006856s. Fixed outcome/status/timing logs omit query/body/arbitrary exception details. These are actual current observations, not proof of the original failure cause. Detailed history: [diagnosis](home-topics-diagnosis-20261015.md).

## Same build, runtime and technical evidence

Release: `/home/deck/.local/share/tag-analysis/releases/7dc59c3c17f6d6420354c3d4df733549071f2bb4-web-4nl3B-BcT4mA9uh47rm0Z-20261015-003`. Inventory SHA256 `df189309b680a47d69e674aa324fe50c3a5ede2765b7d2d12198e9a5385c5a0e`: 3056 entries/81,535,992 bytes. Publication omitted only seven generated home cache files (`index.html`, `index.rsc`, `index.meta`, four segment files), following the accepted cache-free d1LV shape; compiled JS/CSS/native bytes were not modified. Original build remains in `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/artifact`. Postcapture original files hash-identical, no extra runtime files. This derived inventory is the actual reviewed/deployed one.

- Homepage suites38/38; frontend typecheck and focused lint passed. Privacy/consent/preference/cache suites37/37 passed. Initial attempted wrong test paths found no tests, exit1; corrected paths ran the actual37 tests.
- Same-runtime SSR200/text-html and RSC200/text-x-component; no canary or Google script tags. Generated server/static output had0 private-canary matches and0 private-origin client-chunk matches.
- Sharp0.35.5 in-memory16×12 WebP/AVIF roundtrips passed. This tests codec availability; it does not claim the production Next image format changed to AVIF.
- Anonymous API200/public max-age60; fake Cookie, Authorization, X-Service-Token and X-Api-Key each200/private no-store. All five HSTS max-age86400. Raw results: `postdeploy-api-cache.json`.

Source independent reviewer existing non-author GPT-6.1 Sol `/root/unfreeze_independent_review`: `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/source-independent-review.json` SHA256 `51630c4fbc24d00aefa2d1791bd592d53ce5d676f103431959d2bb9d37e86755`. Actual screenshot review: `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/ui-independent-review.json` and `.txt`, SHA256 `0d7641da2f83b2b063c80e985b230eab43d10123cadbc4bff0e95d6fbeb4eed4`. Source/test pass does not substitute for UI.

## Actual screenshot evidence (private, outside repo)

Capture manifest `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/capture-manifest.json`, SHA256 `301d5a6703288292ac66d789ab9dae433a32529c9edffd8c6546bd2c6eb2fc59`. Non-author reviewer personally opened and hash-checked all16 candidate＋4 old79 reference PNGs. Four topics states passed at1280×800 and390×844, light/dark. Error panel78px; valid-empty47.59375px; normal/recoveredfive cards. No scope promotion for the rest of homepage, auth/admin states or65routes.

| State | Width/theme | PNG path | SHA256 |
| --- | --- | --- | --- |
| reference | 1280/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-reference-1280-light.png` | `2f3940eb9ea23af0228772e3e9bf56fb5b7046ebbd7c1223d9eea2789bad33e2` |
| reference | 1280/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-reference-1280-dark.png` | `4aba6ad6c7cfd68ec955d4b61a04d01226255eb4063871ddcf623cb296be8eaa` |
| reference | 390/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-reference-390-light.png` | `bdf9c499c62dc551f37a642c6e9132a391cf563b54ab967330f0f7e61fbf2bfd` |
| reference | 390/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-reference-390-dark.png` | `45124c044c9f9e5491c7144f29a982226b19e7d46f3ded995354e6b511d67d88` |
| normal | 1280/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-normal-1280-light.png` | `6f7c612bb19c3b41409624acbe856ccb66bbd18eb071ec374d3b9d46b33d36a4` |
| normal | 1280/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-normal-1280-dark.png` | `a157dbb9509129f12c5965063ccd8070353281802460ad719733ac366dc1ecc2` |
| normal | 390/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-normal-390-light.png` | `08c6383d7bc4d15497f7e491b0ae11d3ef7d0a6911270e4ca97a46e91018f18b` |
| normal | 390/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-normal-390-dark.png` | `1252b7ecf926c5c1c2de25f1cb16157f04a240bf791d5b2831cbe213189e3e3b` |
| recovered | 1280/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-recovered-1280-light.png` | `423460689f0758d2c4a06d2b48b81be60b2d8ac8934fde5cd21bcb40c6b5bf76` |
| recovered | 1280/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-recovered-1280-dark.png` | `943c89a1fe8329d3786ab4176ab9a3dc66c2d0930ebd2754156ecc71a12da737` |
| recovered | 390/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-recovered-390-light.png` | `169123ef2108bd7b51b7d2beee02fca67212a64e8a65bcd2c0ff056ce444e8e8` |
| recovered | 390/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-recovered-390-dark.png` | `80c63b540a69bb9e2363363e9ced5f6a0548d668d10298c3ec050d670f76750d` |
| error | 1280/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-error-1280-light.png` | `e94d2cfecaf0fb8e051d8ef0f395876b93f644aee5c59e38ec0429bd0c42d0ac` |
| error | 1280/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-error-1280-dark.png` | `aae81a05015de9148593290728cecec4470f5ab06aec6f03c89837e166aa6c1c` |
| error | 390/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-error-390-light.png` | `a7c664866cde3fd4df10a0b9e0e01198c5633b8ace1aea9106307c2bc6e4763d` |
| error | 390/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-error-390-dark.png` | `fd34e2c18850443949210cfa1fec032dc1b5b066cd18a4ca263cfea473c0b165` |
| empty | 1280/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-empty-1280-light.png` | `8c8fdc1c1d83b9ad3fe489af9cbf38b867960d4af3fc08d55e3a7e58b09d3183` |
| empty | 1280/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-empty-1280-dark.png` | `413e8c6fc9b60a4d33f2a28446079bc506e11b5e18eb79c1b16db23c24511966` |
| empty | 390/light | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-empty-390-light.png` | `e4c2d65281d87d3c6c9cc8276b699b17c3661eddd7ab418ddbd55a07056b61bc` |
| empty | 390/dark | `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/topics-empty-390-dark.png` | `ebd89f371004fcc19256282a55ce030531ce40dceff3248c8e2900abfd2155f5` |

The four additional post-deploy PNGs under `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/formal-capture/` show five cards at both widths/themes. They read the production18130 gateway via the same anonymous origin-only proxy; they are owner formal-origin checks, not a second independent UI review or Cloudflare/browser acceptance from the user's machine. Public HTTPS curl separately confirmed the new BUILD. Formal-origin capture manifest SHA256 `66320b329e2035a7a2243303a0557cb741b22dcf1141ee41ef2a3b48caddb283`.

All captures installed an origin-only network proxy before Chromium launch, then context routing before page creation. Native DNT1, webdrivertrue, GPCnull (not supplied by browser); no navigator/consent bypass. Candidate HAR2450 requests allDNT1, observed Google requests0/outgoing0; raw requests/proxy records retained. Formal-origin capture also0Google requests/outgoing. These prove saved UI/program behaviour with DNT/bot guards active, not GA receipt or a sole-guard attribution. No synthetic GA sent. Candidate PID/port stop evidence in `candidate-listeners.json`;18334–18338 closed afterward.

## Gates, disk cleanup and rollback

Build low-priority nice19/ionicec3, Nextworkers2/static concurrency1;73s, exit0. Started above40GiB and3GiB MemAvailable. During-build fullHTML probe finished UTC18:25:28 with blog median8.220342s (200 but >6.17s), five seconds after build had already completed UTC18:25:23; no build process remained to cancel. New capture/deploy waited for passing probes. No original500 causal claim.

Final SM-local DNT fullHTML probe `2026-10-14T18:35:38.583474+00:00`: tag `0.082299s`, blog `3.597360s`, YT `0.055884s`; nine trials200/curl0, three-per-site medians against2.0/6.17/2.0. Load `4.38`, /home `59.83GiB`, MemAvailable `3.75GiB`. time_total includes origin/edge/network, not precise origin rendering.

Authorized11 old releases freed `6,689,583,104` bytes (6.23GiB). Rolling cleanup additionally freed `4,766,396,416` bytes (4.44GiB), after effective/configured WD/current/Docker mounts/all-UID cwd checks:551readable,0permission errors,0matches. Additional targets: a76 ranking release, aff simple001, unpublished815 web release, three obsolete git-archive build artifact caches. Three failed transient warm-diagnostic units had MainPID0; reset-failed let systemd collect them before the aff001 delete. No running service stopped for cleanup. All screenshot/HAR/log/review/backup receipts preserved. Git worktrees and source checkouts untouched; no DB backup/formal data or tag-backup deletion. Current build dependency symlink now points to the retained7dc build rather than the deleted old79 build cache. Receipt `rolling-cleanup-completion.json`; final df60G available.

Retained releases:7dc currentweb,79 immediateweb rollback,dc currentAPI,aff002 active shared-stats/worker/retainedweb,0dd protectedcurrent/legacyweb. These remaining releases serve different still-referenced components; they cannot all be treated as obsolete web releases. `deploy.lock` kept.

Immediate rollback (saved79 drop-in; only web restart):

```bash
/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/rollback.sh
```

Backup `/home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/web-unit-backup` preserves prior unit/drop-ins/current-target. Deployment used `python3 /home/deck/tag-analysis-private/f1-release/topics-7dc59c3c-20261015-003/rollout.py`; exact scripts, warm timings and raw GET results retained. No rebuild on deploy.
