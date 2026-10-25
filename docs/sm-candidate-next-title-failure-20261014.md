# SM candidate 002: Next process title and cleanup failure

This records an actual failed candidate operation, not a UI or privacy acceptance. APP `677a0c793eeda0c4d850c81ac574c95508d08e0a`, BUILD_ID `PmjYScQDDoJKBr43SLkhd`, artifact inventory `f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7` and manifest `76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0` remain unchanged. Control OPS was `72b09fa7062f93af809dbfa89cd59dd897999908`; input SHA256 `b51621b157665863a3b24ddbeaa7d606cc5afee88e7831de4968df0c95e76212`. Babysit authorized this exact retry at UTC 2026-10-13 21:37.

## Actual sequence and limits

- Guard group `3136821` began at `2026-10-13T21:37:19.693Z`, nice 19 / idle IO. Its parent `3136326` and own kernel-lock holder `3136556` were bound in owner-launch.json.
- API child `3137061`, start ticks `428449118`, used the existing isolated `127.0.0.1:18306/tag_f1_semantic_test` database. Actual server version was `11.4.12-MariaDB-ubu2404`, server port 3306, existing fixture actors 701/702/703. Production fallback and queue were false; no new user/grant or seed was added.
- Actual API readiness HTTP 200 was observed during `2026-10-13T21:37:28.551Z–21:37:28.577Z`; original response bytes and SHA were retained before parsing. This is API readiness only.
- Next child `3137107`, start ticks `428449296`, printed Next 16.3.6 / Ready / loopback port 18198. The installed immutable Next start-server source sets `process.title` to `next-server (v16.3.6)`. Startup polling cached the initial argv hash before the listener existed; Next then changed its command line, causing both listener validation and cleanup to reject that same owned process.
- Cleanup began `21:37:48.609Z`. API exited normally at `21:37:48.647Z`; own Next signaling failed identity validation twice. At `21:37:53.652Z`, cleanup explicitly recorded `allExited:false`. The worker printed failure and set exitCode, but its live child kept the event loop alive; the parent guard kept sampling instead of learning this worker failure.
- Owner recorded a real private kernel/process snapshot at `21:44:45.860840Z`: Next still had its original start ticks, parent/group 3136821, pinned Node exe, canonical standalone cwd, and loopback listener 18198 inode 224237686. Original argv had changed to the exact Next title. This is not a reconstructed initial-listener timestamp.
- Owner rechecked the actual parent UID, start ticks and exact admitted command-line hash, then sent only that parent SIGTERM at `21:44:52`. Existing guard sent SIGCONT/SIGTERM to its own dedicated group. Next exited at `21:44:52.962Z`; guard finished at `21:44:56.510Z` (exit 130, worker code 1). Guard duration was 456.817 seconds, not the listener lifetime.
- A new raw kernel snapshot at `21:45:07.097030Z` showed all five owned PIDs absent, no loopback listeners 18197–18199, and legacy 18196 still inode 215996810. The original snapshots/lock bytes were retained. Exact first/last listener milliseconds were not recorded and are not inferred from the guard duration.
- A subsequent low-priority read-only full runtime inventory check matched the original f166/761 pins and both physical BUILD_ID files. No artifact or production service was modified.

No frontdoor, candidate-started/stopped success receipt, browser, HAR, screenshot, GA transport, candidate UI acceptance, SSR/RSC privacy acceptance, or deployment resulted. The 65 main route reviews remain pending for APP677. The original failed directory is retained; another attempt requires a new exclusive directory and exact new source admission.

## Private evidence

All paths are under `/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/local-candidate-sm-batch-002/` and are private. No DB secrets or GA identifiers are published here.

- `failure-owner-summary.json`: SHA256 `85a17a5feab8edf7040a35c0acfaf8a09854d8662e3f3d736ab8f0ef94f4b0db`; includes hashes of the 582 preexisting original files, actual event timeline and evidence limits.
- `owner-stuck-process-snapshot-20261013T2144.json`: actual current raw /proc process/FD/lock/TCP evidence before operator stop.
- `owner-operator-stop-request-20261013T2145.json`: exact parent ownership checks and targeted signal receipt.
- `owner-kernel-postcheck-current.json`: SHA256 `aed5f4af29b0cc38744e18d1db09f2b4f1c4766c7f1362a29f13a25b2b2aa5a5`; actual post-stop raw snapshot, not historical reconstruction.
- `owner-postfailure-inventory.json`: SHA256 `5b0ff616fe17036a108073517c2e196d730348d9578e42ca271382602ce4c303`; actual full runtime post-check by owner, not an independent rehash.
- `worker-stage.log`, `candidate-events.jsonl`, `api-runtime.json`, `api-readiness.raw.json`, all original homepage probe raw/decoded files and health generations are retained.

## Required source correction

Child ownership must use start ticks, UID, parent/group, canonical pinned executable/cwd, and only exact launch argv or this pinned Next title. A changing command-line hash cannot be the sole cleanup authority. Socket/FD ownership and loopback-only checks remain required. Worker startup or cleanup failure must be communicated to its existing guarded parent, which reaps only its dedicated group rather than continuing until expiry. Negative mock tests and the existing nonauthor independent source review are required before a new exact OPS/input can be submitted. These changes do not widen the scope or grant execution permission.

## Independent source/mock review

Existing nonauthor GPT-6.1 Sol independently checked the seven-file v2 freeze, ran all74 pure/mock tests and3 syntax checks, and verified all582 original evidence hashes. The snapshot UTC documentation error was corrected to21:44:45.860840Z; v1 freeze remains retained. The reviewer also verified offline that the exact fixed Next title plus NUL padding reproduces the original /proc command-line hash. He parsed the original process/FD/TCP/locks evidence, without a new live kernel probe or whole-runtime rehash. This is source/mock and original failed-evidence acceptance, not candidate/UI/B0 success.

- Freeze v2: `/home/deck/tag-analysis-private/f1-release/sm-next-title-source-freeze-v2-20261014.json`, SHA256 `1ba83220e770c284b2fd48b00c3d29f17a561e49ea81637aba24ed9c600c5c27`.
- Independent JSON: `/home/deck/tag-analysis-private/f1-release/sm-next-title-independent-20261014.json`, SHA256 `c70a43de9a6ebe10cb7aa2d0a9726f184a1fa50743423a763c909ce5d9cf6f8b`.
- Transcript: `/home/deck/tag-analysis-private/f1-release/sm-next-title-independent-20261014.txt`, SHA256 `b8b3b32f60536defa4e3d6ae8c8fc37860fdd3eb895d05ee268b4c074ebdf791`.
- Independent offline title/hash consistency receipt: `/home/deck/tag-analysis-private/f1-release/sm-next-title-independent-title-padding-20261014.json`, SHA256 `e195b659bac6ffa212f4538c34504bfea6d82f8b627925619a482338bfdc7b86`.

Commit status: root includes these independently reviewed source bytes and evidence metadata in the next correction commit. Deployment status: not deployed; formal release has not been changed by this operation. A new exact OPS, exclusive003 input and fresh actual probe must be admitted by babysit before another execution.
