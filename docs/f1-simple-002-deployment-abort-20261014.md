# d1LV002 deployment stopped before worker/public cutover

Executed admitted OPS `e2ef53dc5f55d7d00be141774418a226b4b34168`, APP `aff5c0289c4863fedb37368b4942884ccc068d77`, BUILD_ID `d1LVsC3sk6p04uOyWUx5T`, via the admitted commands.md deploy line. New log `/home/deck/tag-analysis-private/f1-release/deploy-d1LV-simple-002.log`;001 evidence remains.

**Result: exit1, not deployed.** Formal release stays `0dd38b629621e27ccb40260a27b27cf2d7202519`. Formal gateway/web/worker PIDs114409/325597/114174 and current pointer stayed unchanged; neither gateway nor worker override was installed. No migration, backup timer, Cloudflare/WAF or legacy web action occurred.

All16 serial API warm GETs were200/curl0. Private homepage2.137656s, tag0.995802s, relations0.002714s, repeated complete homepage0.007968s. Thus the explicit warm readiness conditions passed; this does not observe every SSR subrequest or prove a root cause for prior500s.

The before-worker fresh gate (UTC13:16:50.931–13:17:13.581) rejected **load1=16.77>12**. All nine trial GETs were200/curl0; medians tag1.547947/blog5.875654/YT1.173083s stayed within their respective limits. Blog's third9.826045s sample was not individually treated as a latency rejection because the user requires median3; load was the rejecting gate. No worker stop, gateway cutover or acceptance stage followed. Script cleanup disabled/stopped private18230/18232; their PIDs0 and listeners closed. Web failed/status143 is the observed stop state, not an asserted OOM/root cause.

While load21.85 was observed earlier, the owner tried finding the in-flight private warm curl to interrupt. That request had already finished; no signal was sent. The existing before-worker gate was already measuring and subsequently rejected; automatic script cleanup did the stop. No additional wrapper or guard was added.

## Requested handoff results

- Restart-to-first200: **n/a**, gateway never restarted. Do not turn this into a measured0-second outage.
- Six origin/public home/tag/relations acceptance GETs: **all not-run**, cutover never reached. Post-probe homepage200s are separate health observations, not substitutions for those acceptance GETs.
- `warm-timings.tsv` and `http.tsv`: `/home/deck/tag-analysis-private/f1-release/deploy-backup-d1LV-simple-002/`, complete20 explicit warm requests and their UTC/status/exit/body/header evidence.
- Success-stage `deployed-units.txt`: **not produced**. Actual state is `aborted-units.txt`, with listeners and enabled-state evidence in the same backup.
- Result `execution-aborted.json` SHA256 `e1cd65088da4ce64f1a73fd2463f5a04b4d005170ddd2db29673431eae78cdaa` retains paths/hashes and explicit non-success scopes.

Post-execution probe UTC13:19:12.846: nine200/curl0; medians tag1.327227/blog2.780173/YT1.062106s, load4.92, disk46.17GiB, MemAvailable4.39GiB. Raw receipt and summary `/tmp/babysit/mint-queue/tag-deploy-simple-d1LV-002-20261014/post-execution-probe{.raw.jsonl,.json}`. This health recovery is not a deployment retry permission.

## New cold-API risk / retained state

Media-stats warm GET took **53.921323s**, unlike the earlier14.06s isolated sample. The actual first-call runtime can exceed the public20s limit; earlier14s is not an upper bound. Warming18230 does not warm process-local caches of18130 after restarting it. This evidence invalidates a claim that cold public endpoints are safely bounded below20s. Shared load increased in the same attempt; no causal attribution to an individual query/process is established.

The original20s timeout and prior9 internal500s remain without confirmed root cause. No automatic repeat is attempted.001 and002 releases/backups/logs/all unit sources remain; installed private unit sources now point to002 and are disabled. The admitted script's exclusive002 paths now exist, and its old-unit comparator references001, so it must not be blindly rerun. Any new executable plan requires fresh gates and babysit admission. No new UI pass or formal F1 completion is claimed; full65-route review remains pending.
