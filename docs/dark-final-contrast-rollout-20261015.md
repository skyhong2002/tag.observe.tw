# Dark contrast follow-up web rollout (2026-10-15)

APP `f62abfb5a99f3f8d9700ed4914faef8823349c55`, BUILD_ID `08ItzUxu99m4XSoNcfGsu`, API `dc7b814e220606202a408d21e73b1d6e7c61fe16` unchanged. Remote-main base `d23e6b2b3b5d502fffe2187adac11e3559f61d7c`; own branch includes the requested58cdab2d/72491ab8 fixes and consolidated follow-up. Source commits ffeaaac6/f62abfb5 pushed. No migration; only tag-ranking-pool-web.service changed, current/API/worker untouched.

## Same artifact and checks

- Direct nice19/ionicec3 Next build, workers2, exit0,41.58s (UTC00:05:06–00:05:47). `83090459` published bytes; inventory `514c60c9b197cbe65eb21a047fa81559eb483f61025fa8c08d2b93eee7bc6cc1`. Release `/home/deck/.local/share/tag-analysis/releases/f62abfb5a99f3f8d9700ed4914faef8823349c55-web-08ItzUxu99m4XSoNcfGsu-20261015-001`. Original build and previous releases retained.
- Build completed before the first RSS sample: maxRSS/peak memory not measured. Post-build MemAvailable4.61GiB; do not call this a mid-build measurement.
- 64/64 focused tests and test TypeScript pass; independent source review `ed37e041399913776f9f98970760c7c7d3dde354c84bdc1b68b4bfa44650140d`. Sharp16×12 memory-only WebP/AVIF codec smoke passes.
- 20 actual SSR/RSC responses HTTP200. Named private/canary markers absent in compiled paths checked. This limited scan is not a universal secrets audit.
- Initial candidate homepage inner topics API returned500; final HTML200. Later private/public topics GETs200 (5.026s/2.037s), diagnostic journal had0entries. Root cause is unconfirmed; do not equate later200 with a confirmed fix.

## Actual independent candidate review

GPT-6.1 Sol non-author `/root/unfreeze_independent_review` personally viewed64originalPNG at1280/390 light/dark, original paths/hashes/viewUTC and network retained:

- `/home/deck/tag-analysis-private/f1-release/dark-final-f62abfb5-20261015-001/candidate-batch001-independent-review.json` (same-nameTXT), SHA `fb47185750192e3bbd528dc91f8921563cff4f807d2bdeb99916557cc4a6a8e7`: home/tag/picture/ranking scopedPASS, not authenticated upload flow.
- `/home/deck/tag-analysis-private/f1-release/dark-final-f62abfb5-20261015-001/candidate-batch002-independent-review.json`, SHA `48adcf3e70152110f3f3663eebf857c5b03d236f9c6fa6657ec511bfc8f30f55`: liveboard tick actual4.5817 contrast (previous1.7754), loaded graph and selected camp presentation scopedPASS. Daily statistics8PNG all loading,2HAR requests incomplete(-1): loaded zero/legend PENDING, root cause not determined.
- Candidate uses anonymous public-read API. Its disabled-login picture hint differs from formal authenticated capability; candidate evidence never substitutes formal review. NativeDNT1/GPCnull/webdrivertrue, browser GoogleURL0/admittedGoogle0; denied background CONNECTs preserved. Not GA receipt or TLS-packet/server-egress evidence.

## Executed web-only rollout

UTC `2026-10-15T00:28:55.461167+00:00`, restart-to-first200 `1.8672s`, MainPID `2246829`. Six origin/public home/tag/relations GETs HTTP200. Default origin immediately had new BUILD; public default initially old cachedBUILD, naturally refreshed UTC00:29:43 without Cloudflare changes. Retained initial failed canonical-check evidence, not rewritten as PASS.

Private execution/backup/rollback root `/home/deck/tag-analysis-private/f1-release/dark-final-f62abfb5-20261015-001`: `rollout.py`, `deployment-result.json`, `warm-timings.json`, `deployed-units.txt`, `web-unit-backup/`, `canonical-home-check-r2.json`, `postdeploy-probe.json`. Warm only private candidate; own warm process stopped before switch.

Post9curls HTTP200/exit0; median tag `0.082s`, blog `2.479s`, YT `0.153s`; load `3.42`, /home `49.02GiB`. Full HTML total includes origin+edge+network. Existing gates tag2/blog6.17/YT2, /home40→30, load12 unchanged.

Immediate rollback restores8cf/Qyaa drop-in and restarts only the web:

```sh
bash /home/deck/tag-analysis-private/f1-release/dark-final-f62abfb5-20261015-001/rollback.sh
```

## Formal review status

New production review must use f62/08Itz actual images; previous8cf sixteen observed route reviews remain historical. Full65-route/state scope is not complete. [Authoritative ledger](ui-review-ledger.md); four-route production batches proceed with nativeDNT1, prelaunch Google transport barrier, raw HAR and non-author review. Daily loaded/zero/legend and admin/authenticated/error/interaction states remain pending until actually verified.
