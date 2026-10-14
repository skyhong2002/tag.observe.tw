# Homepage outlet grid: web-only rollout

The source requested by tag-analysis-tw-31 was built and deployed, preserving F1 and windowed ranking pools. `79ab873bce4cfd3009c63d566784c58b32755ea6` merges remote main `d23e6b2b3b5d502fffe2187adac11e3559f61d7c`; its only frontend difference from accepted F1 `aff5c028` is removing the five-line coarse-pointer44px override. Desktop and touch devices now use the existing26×26 grid. The expand button remains44px high. Shared main was not modified.

## Deployed artifact

- APP: `79ab873bce4cfd3009c63d566784c58b32755ea6` (pushed).
- BUILD_ID: `Plhg1ikqckL3KpTvPiwbs`.
- Release: `/home/deck/.local/share/tag-analysis/releases/79ab873bce4cfd3009c63d566784c58b32755ea6-web-Plhg1ikqckL3KpTvPiwbs-20261015-001`.
- Original inventory: `db81985c71d5eee51187c243e73333b9b28c8d505514ae0e5aac0599e1fc8146`; 3,057 entries,83,071,468 file bytes. Every original file was rehashed after deployment; none changed. Additional runtime caches are separate.
- Build UTC16:26:19.701–16:27:28.235 on2026-10-14, exit0. Direct Next compile, nice19/ionicec3, two workers, static generation concurrency1. Retained dependencies were copied; no install, DB or migration. Peak RSS unavailable; an in-build MemAvailable sample was2.5GiB.
- The already-running build was explicitly allowed to finish when babysit withdrew its35GiB admission. Future builds again require40GiB; below30GiB cancels. No files were deleted.
- Switch requested UTC2026-10-14T16:46:23.689862713Z; first confirmed200/new BUILD16:46:28.839365034Z.5.149502321s is the request-to-confirmation upper bound, not exact customer outage. The readiness curl initially observed503 and then recovered through its ordinary retry.

Only `tag-ranking-pool-web.service` was restarted (new PID1237321), through persistent `zz-home-grid.conf`. Gateway PID1151832 and private data API PID1109420 stayed unchanged, on backend `dc7b814e220606202a408d21e73b1d6e7c61fe16`. Old static chunks were copied without replacing new chunks. All old web services/releases/backups/current remain intact. No CF/WAF or tag-backup action.

## Verification and evidence

Private job: `/home/deck/tag-analysis-private/f1-release/home-grid-79ab873b-20261015-001`.

- `home-tests.log`:29/29 homepage tests passed. Sharp0.35.5 memory-only16×12 WebP smoke passed.
- `switch-probe.json`:all nine requests200/exit0, medians tag0.472901/blog2.774290/YT0.228896s, load4.24,37.69GiB available.
- `deploy-http.tsv`:origin/public homepage, `/tag/柯文哲/`, and relations API six GETs200. `live-public-fresh.html` confirms the new BUILD over public HTTPS.
- `postdeploy-probe.json`:nine requests200, medians0.255852/2.681938/0.166330s, load3.09. Measurements are full HTML `time_total`, including edge and network, not isolated origin rendering.
- `formal-cache-boundary.json`:anonymous articles API public,max-age60; fake Cookie/Authorization/X-Service-Token/X-Api-Key each private,no-store; all200 and HSTSmax-age86400.
- `capture-r2/capture-manifest.json`:candidate eight PNGs,1280×800 and touch/coarse390×844, light/dark, top and media-grid views. Native DNT1, webdrivertrue, GPCnull. An initial capture timed out during a load22 spike and a separate tag GET returned500; own candidate stopped, no cutover, evidence preserved. Successful retry waited for DOM content instead of networkidle.
- `live-capture/capture-manifest.json`:same eight views on the production gateway; images/avatars loaded. Both HARs, request JSON and pre-launch proxy records show Google requests/outgoing0. No GA transport or synthetic event; no GA receipt claim.
- `outlet-grid-review.json`:GPT-6.1 Sol `/root` (different instance from CSS author tag-analysis-tw-31) actually viewed16 candidate/production PNGs. Requested grid change passes; full homepage states/full65-route review are not implied. Candidate's direct web port lacks API-image routing, so its missing avatars are explicitly not production evidence.
- Babysit formal acceptance UTC16:50:390 grid26×26, GA0, three sites200. Separate homepage topic/error whitespace issue remains under investigation.

Public verification URL: https://tag.observe.tw/

## Immediate rollback

`bash /home/deck/tag-analysis-private/f1-release/home-grid-79ab873b-20261015-001/rollback-web.sh`

This changes only the owned web WorkingDirectory drop-in back to the retained dc7b release's `web/.next/standalone/web` (BUILDd1LV), daemon-reloads and restarts this web service on18332. API/gateway/worker stay unchanged. Original unit and before-PID receipt are in `web-unit-backup/`; deploy and rollback scripts/logs remain private. It does not remove anything or restore a DB.
