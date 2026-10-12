# Shared-host build guard and observed service timing

## Enforced build path

`scripts/install-service.sh` now runs `tools/guard-next-build.js` instead of an unguarded `next build`. The current task's private candidate runner v3 uses the same guard. The wrapper starts a dedicated Linux process group under `ionice -c3 nice -n19`; it never signals another session's build or service. `web/next.config.ts` (`821711c`) limits static generation to two workers and one page per worker. This does not bound every fetch within a page or every compiler thread.

Before launch and every 30 seconds, two parallel curl probes record the tag and blog homepages, response status, TTFB, total time, curl exit code, UTC and 1-minute load. Each probe has a 10-second network deadline. Any 5xx, transport failure, failed probe or load above 16 pauses the entire build process group with SIGSTOP. Once paused, it waits until load is strictly below 10 and probes no longer fail, then sends SIGCONT. The deployment lock remains held while paused. No browser or analytics request is used for these probes.

Private JSONL logs are written under `~/.local/share/tag-analysis/build-logs/` for normal deployment and `/home/deck/tag-analysis-private/f1-release/build-guards/` for this task's candidates. They record actual pause/resume signals and the target process group, not inferred pauses. Curl's TTFB may describe an HTTP 103 early hint; a final timeout is still a failed probe and must not be described as a healthy fast response.

SIGINT/SIGTERM resumes a stopped group before termination. On controller completion or failure, remaining workers in its dedicated group are killed even if their leader already exited. Independent review reproduced a missed-descendant cleanup bug in the first draft using local fake processes; the fix and regression test are included. No real Next build was used to test STOP/CONT.

Relevant checks: `node --test tools/guard-next-build.test.js`, `node --check tools/guard-next-build.js`, `bash -n scripts/install-service.sh`. The tests cover thresholds/hysteresis, service/transport errors, a real local descendant stopping and resuming with its parent, actual nice=19, and cleanup of a worker left behind by an exiting parent. Independent review records are indexed in `ui-review/f1-candidate.md`.

## Historical observation — not a causal estimate

All times below are UTC on 2026-10-12. Both completed build attempts preceded the new nice=19 / automatic STOP instruction. They used nice=15 and ionice class 3. They were not retroactively protected by the new monitor, and no pause/resume is claimed for them.

| Time | Build / service observation | Evidence |
| --- | --- | --- |
| 20:32:25.779–20:36:42.706 | `e0eb4dd` workflow log creation to last write; 11 static workers, several 60-second retries, final `/admin/media` failure. Script exit 1 was observed before the 20:39 probe. These filesystem times bound logged activity; the log has no per-line timestamps. | Private `f1-build-e0eb4dd.log`, `build-timeout-20261012T2039.json` |
| 20:39:00.930 probe start | load 14.29; tag 200 / 0.417 s, blog **500** / 0.022 s, YT 200 / 0.092 s. This was after the failed build's final log write, not proof of a 500 during its active compilation. | `resource-gates/2026-10-12T20-39-00-929981+00-00-build-failure-pause.json` |
| 20:42:09.735 probe start | No new build yet; load 15.66, all three sites 200. Blog TTFB 0.024 s. | `resource-gates/2026-10-12T20-42-09-735243+00-00-bounded-build-recheck.json` |
| 20:43:53.074 probe start | No new build yet; load 13.25, all three sites 200. Blog TTFB 0.076 s. | `resource-gates/2026-10-12T20-43-53-074390+00-00-bounded-build-ready.json` |
| 20:45:06.513–20:48:51.868 | `dba9325` workflow log creation to final successful write; two workers × one page, one retried static page, build exit 0. Earlier completed test frontend processes were stopped; their files remain. | Private `f1-build-dba9325.log` |
| 20:46:27 | During the second build, `uptime` reported load 21.31. The new automatic STOP rule had not yet been received or installed; this run did **not** pause. | Command observation in this thread; no separate raw resource JSON for this sample |
| 20:49:06.497 probe start | After the successful build, load 14.86; tag/YT 200. Blog returned an early 103 but timed out at 15 seconds without a final page (curl exit 28), not a successful 0.022-second homepage. | `resource-gates/2026-10-12T20-49-06-496710+00-00-post-build-before-smoke.json` |

Artifact paths above are relative to `/home/deck/tag-analysis-private/f1-release/`. Original logs and failed candidates remain intact. Sampling was not every 30 seconds during those historical builds; missing intervals cannot be reconstructed or filled with invented measurements. Shared-host background work and memory/IO pressure also existed, so temporal proximity alone cannot assign the blog errors exclusively to this build. The new guard responds to observed impact regardless of attribution.

The successful UI candidate remains `dba9325`; it has not been publicly deployed. Adding this operational guard does not itself launch another build or switch any public service.
