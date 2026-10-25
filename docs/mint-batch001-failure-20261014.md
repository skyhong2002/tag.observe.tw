# Batch001 failed startup — retained evidence, not UI acceptance

The user/babysit approved the four-route anonymous candidate plus Mint capture
at UTC2026-10-13 19:31. Control OPS was
`a4713d9cab2bc3d97343c3aa6ba8aa580b61fba2`, APP
`677a0c793eeda0c4d850c81ac574c95508d08e0a`, BUILD_ID
`PmjYScQDDoJKBr43SLkhd`. The fixed f166 target/761 manifest were retained.
This execution was not a deployment and did not complete candidate readiness.

## Admission and original failure

The original proposed capture expiry was nearly reached. Same-scope renewal was
explicitly authorized; new files were created exclusively, preserving proposals.
The UTC19:32:29.626 actual Mint-to-SM probe returned three HTTP200/curl0, HTML
end-to-end totals tag0.409292/blog3.133477/YT0.093568 seconds, zero builds and
browser roots, an empty Mint lock, and isolated API200. This is not precise
origin rendering time. Both real guards checked current samples again.

New candidate deadline UTC19:48:02.165, capture deadline UTC19:42:02.165:

- Plan SHA256 `85bbb5186519d2eb5bc4110ff08de45e4fc8893fa2806e49c5352817932f4444`.
- Input SHA256 `12c42084cbc06a180fd3ac89ad06d65e770751ac4bf21e115efbac7882018264`.
- Frontdoor config SHA256 `2e9376239fff0efb1b3fb99f2a66af9f59d1d63271cf15320daf9a92a5ec71fc`.
- Command SHA256 `71c9ed4629a2357871091e5af086deca0458b5ec605d8b370da513c410cb7566`.

At UTC19:33:55.124 the Mint guard saved `gate-error-24.json` with
`Isolated API readiness unavailable`. Its bound lease was fail-closed:
`pause`, `apiReady:false`. The actual SM `before-next` Mint RPC finished at
UTC19:33:55.500, with matching raw hash and lease age378ms. Therefore this was
not a stale lease diagnosis: the worker rejected its paused decision and
stopped before starting Next. The generic readiness handler suppresses error
causes; its concurrency/busy branch is a hypothesis requiring an offline
reproduction, not a proven reason for this particular HTTP failure.

Only the tunnel on127.0.0.1:18131 (PID2902143, startTicks427707412) had started.
No Next18195, Tailscale frontdoor18196, Chromium, screenshot or HAR started.
No Google-zero/HAR or UI success claim can be made from this failed operation.
All65 primary routes remain pending; there is no successful acceptance file.

## Actual cleanup and manual owner resolution

SM shutdown TERM/exit/confirmation was recorded at UTC19:33:55.501–.525.
Original stopped receipt UTC19:34:05.128 records owner2900616/startTicks427705520,
input SHA332507e319b6f63731884ea40adad8dcb4033e54ce66122403d724252dc4fc67,
and unchanged original runtime. Because no startup/end proof had been created,
the conservative outer cleanup could not claim normal successful completion.
It retained the lock awaiting owner resolution instead of fabricating receipts.

At UTC19:36:08.152 the owner actually read SM/proc: both recorded identities
were absent, no matching candidate process remained, and all three exact owned
endpoints were empty. Existing127.0.0.1:18196 retained inode215996810. After that
observation, at UTC19:36:40.845 the owner validated its Mint controller UID,
PID2529048/startTicks449616097, command hash and exact input path, then sent
SIGTERM only to that idle controller. This was necessary failed-session cleanup,
not a successful guard acceptance or a new runtime operation.

UTC19:36:54.484 actual Mint/proc showed controller and holder2529125 absent and
kernel holders empty; the isolated API returned200 again. The transport exited255
as expected for the terminated owner, not0. No old listener, artifact, backup,
release, database or unrelated process was stopped or removed. The slot was
returned; a fresh sample is still required before any future operation.

## Private evidence and independent review

Owner packet and all original raw copies:
`/tmp/babysit/mint-queue/tag-capture-batch001-approved-20261013T193302Z/`.
Its `mint-original-job-evidence.tar` is993280bytes, SHA256
`e41b55257383cba8c579b9bb9a0ce79d85fe681ee2f79b2dca01443f71982d4a`.
The223 copied files were independently compared byte-for-byte with the tar.
SM originals remain at
`/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/candidate-batch-001/`.
Mint originals remain at
`/var/lib/observe-worker/tag/candidate-sm-c70425b0-batch-001/`.

Existing nonauthor GPT-6.1 Sol independently reviewed original admission,
raw RPC/failure, stop, owner-resolution and post-resolution evidence:
`/home/deck/tag-analysis-private/f1-release/mint-capture-batch001-failed-session-independent-20261014.transcript.json`,
SHA256 `a7bb46f7054e6cffbe0bcd5f8187c8e5ae5f58cb3f48188d51b72712879afa05`.
The same basename `.transcript.txt` has SHA256
`e40d88305cf51ad1e7df062676f39a01c899353df23a8fd13f14315da2789365`.
This was an offline evidence review; the reviewer did not make a second live
kernel observation. It confirms failed-start cleanup and slot return at the
recorded time, not all-health PASS, UI PASS or authorization of a retry.

Any retry must preserve this job and use a separate exclusive namespace,
reviewed source, exact command, fresh probe and separately checked permission.
The updated user deployment policy allows remaining UI reviews after deployment,
but main-page actual image review and technical privacy/SSR/RSC checks are still
prerequisites. They have not been satisfied by this batch.

## Subsequent fixed-APP source regressions

With product source verified equal to APP677, the owner ran four existing
Fastify injection/in-memory suites at UTC19:47:41.664–19:47:45.585:
cache-control2, analytics-runtime24, analytics-consent7 and analytics-preference4,
total37/37 passing. Private original log and command receipt are
`fixed-app-privacy-source-regression.log` and `.json` in the owner packet above.
No environment file or production credentials were supplied. These are source
regressions only; they neither verify the final candidate SSR/RSC visibility
barrier nor Google receiving any data. The actual candidate and main-page
independent image prerequisites remain pending.
