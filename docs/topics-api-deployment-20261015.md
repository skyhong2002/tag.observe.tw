# Topics API concurrency fix deployment (2026-10-15)

Source commit `cb4ef914349e8a52b972d156a9b892d81438265b` limits `/api/v1/topics` source-status work to two concurrent outlet sequences. The existing web (`f62abfb5` / `08ItzUxu99m4XSoNcfGsu`) and gateway were not rebuilt or restarted.

## Build and release

- Pre-build fresh gate UTC `2026-10-15T02:46:42Z`: tag/blog/YouTube medians `0.250/3.438/0.184s`, all nine HTTP 200/curl exit 0; load1 `3.00`; `/home` `46.39 GiB`; MemAvailable `3.41 GiB`.
- Existing API release was copied without npm install or DB migration; only `app/src/jobs/topics-job.ts` was overlaid. New release: `/home/deck/.local/share/tag-analysis/releases/cb4ef914e4f8-topics-concurrency-20261015-001`; source file SHA256 `fd3e0f6ebee2921f412d0a592323f1b7023afe7a1be0429762c4d145c59f4e83`.
- Candidate API on loopback port 18340 returned `/api/v1/topics?limit=120&kind=topic` HTTP 200, 262186 bytes, 6.106s cold; it was stopped before deployment.

## Deployment and rollback

UTC `2026-10-15T02:55:15Z` the API unit switched by adding a persistent user drop-in `zz-topics-cb4.conf` with only `WorkingDirectory`. Web, gateway, worker, current symlink, DB and Cloudflare were untouched. The previous unit/drop-ins/current target are in the private backup directory:

`/home/deck/tag-analysis-private/topics-api-deploy-20261015T1045/backup/`

Rollback removes the new drop-in, reloads systemd and restarts only the API:

```sh
bash /home/deck/tag-analysis-private/topics-api-deploy-20261015T1045/rollback.sh
```

## Verification

- The new API process is PID `2560582` with the new release as its working directory.
- Twenty sequential public DNT=1 topic requests from UTC `02:57:31–02:57:42` all returned HTTP 200/curl exit 0; the final request was `0.094s`. Raw receipt: `observe-topics.json` (SHA256 `ec997089f8bcd605078613f2deaa07d1f8348b632f6c72ec10b3fc137582ce8d`).
- Journal captured from switch through observation contains **zero** `Queue limit reached` and zero error/exception/failed-query lines. Raw journal SHA256 `00d74875bbdfb8bbe5ac9ba2ce9afbb7bf7c4396f77a752dd020a20e0d7e36d3`.
- Post-deploy three-site gate UTC `2026-10-15T02:59:47Z`: medians tag/blog/YouTube `0.077/3.050/0.079s`, load1 `2.82`, `/home` `46.31 GiB`, MemAvailable `3.13 GiB`; all requests were HTTP 200/curl exit 0.

The observation shows the deployed service remained healthy during this window. It does not claim that unrelated historical queue saturation elsewhere in the shared process has been eliminated.

## Follow-up observation

At UTC 2026-10-15T05:33:21Z, ten additional sequential DNT=1 public topic requests all returned HTTP 200/curl exit 0; the last was 0.187s. The final journal slice from the switch through this observation still contains zero `Queue limit reached` and zero error/exception/failed-query lines. Homepage and `/tag/柯文哲/` also returned HTTP 200 (0.876s and 3.203s). Final topic receipt SHA256 `3c2d95a3cc703a5cda936d280877b762d66313af8a2ffb2adaaf05a5ce61d52c`; final journal SHA256 remains `00d74875bbdfb8bbe5ac9ba2ce9afbb7bf7c4396f77a752dd020a20e0d7e36d3`.
