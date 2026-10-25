# SM candidate003 completion (actual service lifecycle, n/a-ui)

Actual control OPS `412c1143aeaed7278604ded6ca73eb25536a777c`; APP `677a0c793eeda0c4d850c81ac574c95508d08e0a`; BUILD_ID `PmjYScQDDoJKBr43SLkhd`; inventory `f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`; manifest `76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`. The user/babysit admitted packet fcc524dd/input03df91c8; the owner executed that exact candidate command once, without a build. Dirty shared checkout and original releases/backups/runtime remain untouched.

## Actual timeline

All times below are UTC2026-10-13, from retained event/readiness receipts unless explicitly marked filesystem metadata or new current check.

- Low-priority guarded worker group3239519 started22:33:51.139; own parent3239043 and kernel-lock holder3239265 are recorded in owner-launch.json.
- Actual isolated API readiness HTTP200 at22:34:00.279–22:34:00.313. Real fixture endpoint is127.0.0.1:18306/tag_f1_semantic_test, never production tag-db. Anonymous actor, no production fallback/queue/accounts/grants or mutations.
- Complete started receipt file mtime is22:34:01.472388. This is receipt-file metadata, not the first listen syscall timestamp. A later original live kernel/FD snapshot in the capture proposal also verifies all three own loopback listeners. Exact first/last bind milliseconds were not recorded, so no exact listener uptime is claimed.
- Planned stop22:44:33.248; actual cleanup-start22:44:33.481 (233ms later). SIGTERM was recorded for all three own service children at22:44:33.483. No foreign/legacy PID was signaled.

| Service | PID / start ticks | Own bind | Recorded exit UTC | Exit code |
| --- | --- | --- | --- | --- |
| API | 3239718 /428788261 | 127.0.0.1:18197 | 22:44:33.617 | 0 |
| Next16.3.6 | 3239817 /428788470 | 127.0.0.1:18198 | 22:44:33.528 | 143 (normal SIGTERM shutdown) |
| Frontdoor | 3239876 /428788526 | 127.0.0.1:18199 | 22:44:33.535 | 0 |

- cleanup-done at22:44:33.635 explicitly records allExited=true; no own-signal error or worker-failed artifact.
- Worker stopped receipt at22:44:57.471 follows full runtime postverification and health check. Guard finished22:44:57.559, worker0/exitCode0. Group duration666.420seconds includes startup, service, checks and cleanup; it is not listener uptime.
- All126 retained guard decisions were run, max sampled load8.12. There was no recorded guard failure/pause. These probes verify health/resource decisions, not frontend UI or cache/privacy behavior.
- Both worker after and owner after full inventory proof equal runtime-before, including f166/761 and physical COMMIT/two BUILD_ID checks. The final owner-session-ended receipt reports wholeRuntimeUnchanged=true.
- New owner raw kernel check at23:31:57.966703 confirms six owned PIDs absent, no18197–18199 listener, no matching lock holder, and legacy18196 still inode215996810. This is a real current check, not a reconstruction of22:44 kernel state. Babysit independently reported the same absence at23:30.
- The original exec tool session61331 is no longer addressable. The completion verdict and exit0 are read from retained guarded events and actual owner receipts; no synthetic replacement exec output is created.

## Original receipts

Private directory `/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/local-candidate-sm-batch-003/`:

- `completed-owner-summary.json`, SHA256 `64f0c336b0321641438682384dd94722be7c5e181901c159467526bb4edef9e2`: hashes all829 original files (7,435,399bytes before summary), retains actual event timeline and evidence limits.
- `candidate-started.json`, SHA256 `fe6d8009166406f806ca66e2671aa8715dc2f8ad24414605cb9fec0a04798022`.
- `candidate-stopped.json`, `owner-session-ended.json`, `runtime-before.json`, `owner-launch.json`, `candidate-events.jsonl`, `api-readiness.raw.json`, all original homepage raw/decoded probes and health generations remain retained.
- `owner-poststop-kernel-current-20261014.json`, SHA256 `691d3c340e5ca244876d4d59bc6c0a63b5c685338d112f76b6d48f1e48f76cbf`: raw actual current /proc locks/TCP/TCP6 and process absence observations.
- Original live snapshot and expired capture proposal remain in `/tmp/babysit/mint-queue/tag-sm-capture-003-admission-20261013T223617Z/`. The user/babysit did not approve capture before expiry22:43:33.248, so no capture command was executed. The capture job does not exist.

## Acceptance boundary and next batch

This is an actual successful isolated API/Next/frontdoor lifecycle and unchanged-artifact result. It is not UI/B0/SSR/RSC/privacy acceptance, not natural GA traffic evidence and not deployment. No browser, HAR or screenshot was created; Google request counters were therefore not measured. APP677 remains65mainroutes/0completeUIpass/65pending.

The user now requests a single proposal for candidate plus capture. The next batch must retain actual startup proof: do not prefill a future PID or started-receipt hash. A reviewed single-host sequence may start the separately pinned candidate command, derive the capture input/hash only from its real admitted started receipt, execute the separately pinned capture command inside the same original candidate deadline, and retain bounded cleanup/output evidence. DNT1/native guards/prebrowser GA+foreign-origin network blocking, four routes16PNG and96MiB budget remain unchanged. Source/mock review and exact command/fresh probe admission are required before either command is run. Current proposal preparation does not authorize execution.

## Independent original-evidence review

Existing nonauthor GPT-6.1 Sol independently verified all829 original file hashes and lengths, recomputed all126 retained median probe verdicts, matched the before/worker-after/owner-after inventory proofs and lifecycle events, and parsed the current raw kernel record offline. No reviewer live kernel probe, full runtime rehash, SQL, browser or service execution occurred. The verdict is actual isolated lifecycle verification from retained originals, n/a-ui, not B0/privacy/deployment acceptance.

- JSON: `/home/deck/tag-analysis-private/f1-release/sm-candidate-003-independent-20261014.json`, SHA256 `1604a89d2056d3ab8d1f9dfa1b9f542f6604f7dda810806c2f8f6e55500722f2`.
- Transcript: `/home/deck/tag-analysis-private/f1-release/sm-candidate-003-independent-20261014.txt`, SHA256 `488b25292878cb48e1e3a8eee9f289dffc5a38bac71b5708fcb611daf8646104`.

Commit status: root records this independently checked operational evidence in a documentation commit; actual003 control remains the pushed412c1143. Deployment status: not deployed, no formal release switch.
