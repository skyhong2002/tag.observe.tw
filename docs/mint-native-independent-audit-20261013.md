# Mint native-r2 independent static audit — 2026-10-13

The existing nonauthor reviewer `/root/mint_candidate_portability` executed the
admitted guard command on Mint. Worker recalculation completed at UTC
12:07:33.359Z; parent final acceptance at UTC 12:07:38.264Z. These are actual
readonly inventory/readelf results, not UI review or native loader receipt.

APP: `677a0c793eeda0c4d850c81ac574c95508d08e0a`; execution OPS:
`51c2db60f0f58ec3a25c66bb28cfe93e9a1f4920`; remote base:
`a89908a650c42a1224d657e6c908d5fd3c7be5a0`; BUILD_ID:
`PmjYScQDDoJKBr43SLkhd`.

Recomputed new runtime inventory:
`5bfc700a09b63d8144f77df8aa6e65f36f783c9d2296b0643de6979b5eb9c714`.
The older `831dc44f…` inventory does not validate the new bytes. Manifest bytes
remain SHA256 `648eac2ef76f05aa23561379b0ea68bd2d40761a97c30d61c460d6dcadf41f47`.
Runtime: `/var/lib/observe-worker/tag/candidate-677a0c79-home-fix.native-runtime-r2`.

All 15 ELF files / 45 real readelf commands passed; the reviewer independently
reparsed the raw headers, version needs and dynamic paths. Highest GLIBC
requirement is 2.30, below the 2.39 ceiling. Every RPATH/RUNPATH resolves within
the artifact. A file with no GLIBC requirements is not thereby proven loadable.

| ELF path | Max required GLIBC | RPATH / RUNPATH | Availability |
|---|---|---|---|
| `node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.7` | 2.28 | `$ORIGIN/` | static only; loader pending |
| `node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | 2.17 | `$ORIGIN/../../sharp-libvips-linux-x64/lib` | static only; loader pending |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.abi115.glibc.node` | 2.3 | none | non-target alternative; not loaded |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.abi115.musl.node` | none recorded | none | non-target alternative; not loaded |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.napi.glibc.node` | 2.3 | none | static only; loader pending |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.napi.musl.node` | none recorded | none | non-target alternative; not loaded |
| `node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime.so.1` | 2.28 | `$ORIGIN` | static only; loader pending |
| `node_modules/onnxruntime-node/bin/napi-v6/linux/x64/onnxruntime_binding.node` | 2.14 | `$ORIGIN/` | static only; loader pending |
| `web/.next/standalone/web/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.7` | 2.28 | `$ORIGIN/` | static only; loader pending |
| `web/.next/standalone/web/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | 2.17 | `$ORIGIN/../../sharp-libvips-linux-x64/lib` | static only; loader pending |
| `web/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.7` | 2.28 | `$ORIGIN/` | static only; loader pending |
| `web/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | 2.17 | `$ORIGIN/../../sharp-libvips-linux-x64/lib` | static only; loader pending |
| `web/node_modules/@next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node` | 2.30 | none | static only; loader pending |
| `web/node_modules/@tailwindcss/oxide-linux-x64-gnu/tailwindcss-oxide.linux-x64-gnu.node` | 2.14 | none | static only; loader pending |
| `web/node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node` | 2.14 | none | static only; loader pending |

The three ABI115/musl msgpackr alternatives are explicitly non-target and have
not been loaded. Installed loader resolve-only on Node24/ABI137/glibc2.39 chose
`node.napi.glibc.node`; resolve-only is not native smoke. An exclusive target
copy may omit these exact alternatives with hash/reason provenance, retain all
originals, and must receive fresh inventory/ELF and actual loader evidence.

Private evidence directory (0700; files 0600):
`/tmp/babysit/mint-queue/tag-independent-audit-reviewer-20261013T1207Z/`.
- result SHA256: `f8e6356f762a8d6a7aa2fa0d637118d12f92f0109f26022f511c0628fa8f7994`.
- acceptance SHA256: `4ac7306a1facbabc60834f00275e85455b39890870819c2d040d0073ab726dfd`.
- raw-readelf.jsonl: 408,004 bytes; SHA256
  `6ebff0e9e49e2a49d4b4751da72e4cb91fd4fb66471185aebeba6c5f01f86861`.

The common lock was released. No artifact was modified, loader/browser started,
production traffic switched or GA event sent. Deployment eligibility remains
false; actual Mint/SM loader and all 65 UI routes remain pending. Each next
execution command requires babysit admission; no new build is required.


## Final Node24/glibc target copy — actual independent audit

The same existing nonauthor reviewer personally recalculated the exclusive
`-r2.target-runtime` copy. Worker UTC **12:44:51.496Z**, final acceptance
**12:44:54.418Z**; original/target variant checks UTC **12:45:29.628Z**.
Execution OPS is `c70425b007bdac9fdbef62b935811ee0d7f30d18`; APP and BUILD_ID
remain as above. The target inventory is
`f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`;
manifest SHA256 is
`76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`.
Neither the original `831dc44f…` nor the `-r2` `5bfc700a…` verifies this copy.

**12 ELF files / 8 .node bindings / 36 real readelf calls passed.** The
reviewer independently reparsed all raw outputs; maximum GLIBC requirement
is 2.30 and every RPATH/RUNPATH resolves within this target artifact. The
above 15-row table describes `-r2`; the target has those same entries except
the three explicitly excluded msgpackr variants below.

| Not copied into target | Original SHA256 | Reason |
|---|---|---|
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.abi115.glibc.node` | `c40b24b5dddd16128ff070cf1a0f3b0647622ec039e20419b4cb80e7f11b39b6` | ABI115 differs from Node24 ABI137 |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.abi115.musl.node` | `19ec49a6e7b3b9d61ae81232a05851bffa142ac9d3cb509190579341b82a4a9b` | Wrong ABI and libc |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.napi.musl.node` | `dff6aa6f86cc3e36d7e9bf34abda45a9120a42e66b863b1ae067061ca09471f6` | musl differs from target glibc |

All three original files remain present and hash-identical in `-r2`.
`node.napi.glibc.node` remains in the target, unchanged at
`48bb0acaf5881374699e37ead45dd7aa867ec8b31591d99425eb8b925c9c8deb`.
No artifact was modified during independent audit.

Actual private evidence:
`/tmp/babysit/mint-queue/tag-target-independent-audit-reviewer-20261013T1245Z/`.
- result SHA256: `31d02b011d81d97b4f07a97ba3fed6fdce1c5d8c0e0789f94dbcdd3800e56491`.
- acceptance SHA256: `ae435dd0ffd324e461501442c6d0bbc5a9951a3f42d29c1900f77bcca838be1b`.
- raw-readelf.jsonl: 394,987 bytes; SHA256
  `a401d9adac8ab3dc8389ef901c7163f15cad1ac3b347b1c7e563e512a828a960`.
- `actual-variant-preservation.json`: reviewer personally checked preserved
  originals, omitted target variants and retained NAPI/glibc hash.

The shared lock is released. **Mint and SM native loaders, image processing,
all candidate screenshot/UI review and deployment remain pending.** There
are still 65 main UI routes, 0 complete passes and 65 pending for APP677.
Actual loader commands will be independently source-reviewed and handed to
babysit before execution; no new Next build is planned.


## Next loader admission — source evidence only

The owner-private Mint loader driver was independently reviewed by the same
existing nonauthor reviewer at UTC12:58:16.595Z. SHA256:
`775ebd8ae71182eb2b5e3ce1bdbe1ebc4b947e90cb3d98777baf6f4b5e98d9bb`.
Mock evidence:
`/tmp/babysit/mint-queue/tag-mint-loader-source-mock-review-2026-10-13T12-58-16-595Z.json`.
Outer/embedded syntax, eight fake addon calls and JSON-marker parsing passed;
no real native loader or image codec was executed. The proposed actual step
requires all eight target addons, Sharp and ONNX Runtime, then only a tiny
self-generated in-memory PNG/WebP/AVIF codec test. Full artifact hashes remain
unchanged; actual Mint glibc2.39 will be recorded separately from SM2.41.

Read-only probe UTC12:58:55 had blog curl exit56 despite HTTP200 and was
rejected. A new probe at UTC13:00:32.365 passed all three HTTP200/curl0 checks:
tag1.024416s, blog5.102216s, YT0.903499s; Mint load0.31/free143.37GiB, no
lock holder/build/browser. All raw probe files are preserved in the private
queue; observation does not grant execution. Exact command, pending input
and source hashes are in `/tmp/babysit/mint-queue/tag.md` for babysit admission.

The SM worker preparation separately passed independent source review and
three pure tests; its actual Mint guarded SSH adapter is not connected and
there is no executable admission claim. No SM transfer or loader took place.
Mint and SM loaders, codec, UI and deployment remain pending.


## Actual Mint-only loader and small Sharp codec smoke

Babysit explicitly admitted the reviewed driver775ebd8a. The guarded task
acquired the nonblocking shared Mint kernel lock and exited0. Worker UTC
**2026-10-13T13:13:34.994Z**, parent acceptance **13:13:39.979Z**. A subsequent
read-only kernel-lock observation at **13:14:17.543Z** found no lock holders.
APP677 / OPSc704 / BUILD_ID `PmjYScQDDoJKBr43SLkhd` and the final target bytes
remain the same; no Next or npm task was run.

Actual Mint runtime: Linux x64, Node24.15.0 / modules ABI137 / glibc2.39,
machine `f80413057e6d4a179e248e5f8c08cac6`. This is not SM glibc2.41 proof.
All eight target `.node` bindings below were actually required successfully,
followed by `sharp` and `onnxruntime-node` module imports:

| Actual loaded target binding | SHA256 | Outcome |
|---|---|---|
| `node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | `424b1b51429833b1147fceec1cbdda04fecea5aadab964c43239394e6aaf8333` | loaded |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.napi.glibc.node` | `48bb0acaf5881374699e37ead45dd7aa867ec8b31591d99425eb8b925c9c8deb` | loaded |
| `node_modules/onnxruntime-node/bin/napi-v6/linux/x64/onnxruntime_binding.node` | `ccdc60b981d93a490cf9513d3f583547252b6e285b72988a96a494f2f006c7b8` | loaded |
| `web/.next/standalone/web/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | `424b1b51429833b1147fceec1cbdda04fecea5aadab964c43239394e6aaf8333` | loaded |
| `web/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | `424b1b51429833b1147fceec1cbdda04fecea5aadab964c43239394e6aaf8333` | loaded |
| `web/node_modules/@next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node` | `656b65a26c717add90617027b410977dde62234c350e33b972b776bc41f1113e` | loaded |
| `web/node_modules/@tailwindcss/oxide-linux-x64-gnu/tailwindcss-oxide.linux-x64-gnu.node` | `cc1d852b9d8bdca43db28aff578de9628ca54a960e10297a3f100a32bf5a9be3` | loaded |
| `web/node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node` | `2024f99789a601c7438b387117032ba07594cbba9b784064b47cdc60a0972326` | loaded |

A self-generated32×24 RGBA PNG was resized to16×12 and encoded/decoded in
memory as WebP (**98 bytes**) and AVIF (**464 bytes**). WebP metadata reported
`webp`; AVIF metadata reported `heif` and the output had the `ftypavif` brand.
Width/height assertions passed for both. No image file was written. This
validates tiny codec operations, **not user image upload, avatar queue worker,
ONNX model inference, Next image optimizer, PSI or candidate UI**.

The driver performed full `verifyArtifact` before and after module/codec
loading and asserted manifest bytes unchanged:
- Before and after inventory: `f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`.
- Before and after manifest SHA256: `76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`.

Private actual evidence directory:
`/tmp/babysit/mint-queue/tag-mint-loader-actual-20261013T1313Z/`:
- `result.json`: `acc0841d5498b7ab2946d42365ce0e2466ab2d9569b93b727ebe5db67ef8f299`.
- `acceptance.json`: `87b65aae655487ab780bcd3a486872eb482035bc8885e9bc36e159307e818edd`.
- `native-loader.raw.json`: `91a45ebef570eb5cd9043f8fe13496ef13dacd1144251297f65b8b032105732b` (actual subprocess status0, no signal/error).
- `guard.jsonl`, `lease.json`, `stage.log`: actual gates and execution record.
- Reviewed driver: `775ebd8ae71182eb2b5e3ce1bdbe1ebc4b947e90cb3d98777baf6f4b5e98d9bb`.
- Authorized input: `55603860ac08d91eff1bf42322025774fdc7a405a19930d885de393680bf304e`.

No artifact was modified, Google transport/browser was started, account or
permission added, or deployment performed. SM native loader still requires
its connected guarded adapter, independent source review and separate babysit
command admission. `deployEligible:false`; candidate UI remains65 main
routes /0 complete passes /65 pending for APP677. The existing reviewer is
separately inspecting these actual raw receipts without rerunning the loader.


UTC13:16:29.340449Z: the existing nonauthor reviewer independently read the
actual Mint raw/receipts offline, matched driver/input hashes, the receipt hash
chain, exact eight binding paths/hashes against the immutable manifest and
earlier independently audited target, and parsed the original single JSON
marker. Actual status0, empty stderr, codec metadata/bytes and guarded exit0
matched. The source assertions cover full pre/post inventory and unchanged
manifest; no loader or host probe was rerun by the reviewer. Independent PASS
receipt:
`/tmp/babysit/mint-queue/tag-mint-loader-offline-independent-review-2026-10-13T13-16-29-340449+00-00.json`.
The UTC13:14:17 lock observation is attributed to the owner, not the reviewer.
This accepts only Mint loader/tiny codec evidence; SM/UI/deploy remain pending.


## Reviewed combined SM staging/loader source — not executed

The existing writer completed the isolated SM guarded parent/worker and root
independently reviewed its fixed v4 sources. The existing nonauthor reviewer
independently reviewed root's Mint controller and pure evidence contract at
UTC13:53:26.518Z: **19/19 pure/source tests passed**, Node syntax and four
Python templates compiled only, hashes reread after testing. All are source
evidence; no SM transfer, native execution or candidate UI capture occurred.

Frozen Mint controller SHA256:
`486793910f255844730e58a640f0f95587dce716bb608a40310e8d0ec08f0b00`;
pure contract SHA256:
`c8af3708d703a26a348166a2278686114435ffd6b2b683a3d8470eafe694ab99`.
Independent source receipt:
`/tmp/babysit/mint-queue/tag-mint-sm-controller-source-independent-review-2026-10-13T13-53-26-518380+00-00.json`.
SM source review:
`/tmp/babysit/mint-queue/tag-sm-guarded-source-independent-review-20261013-v4.json`.

The planned operation copies unchanged f166 bytes via limited8MiB/s rsync into
a new exclusive private SM target (4GiB reserved), retaining all originals.
Both hosts measure actual resources; Mint reads its candidate volume at
`/var/lib/observe-worker`. SM independently checks the real specific Mint
kernel lock and self/input/plan/PID-bound current controller lease, including
API readiness. Paused/stale control lease stops SM's own native group; fatal
source/expiry errors terminate only that group. Four-minute native admission
expires before the five-minute SSH wait; final controller deadline forbids
late acceptance. SHA bytes are locally recomputed from returned original raw
files, with complete nativeEligibility and pre/post inventory validation.

True admission is **not created**: pending plan reviewedfalse and execution
input permissionfalse remain in `/tmp/babysit/mint-queue/tag.md`, alongside the
exact conditional command/source hashes and read-only probe at UTC13:54:48.559Z.
That probe has three HTTP200/curl0 totals1.399661/3.162408/1.058198s, Mint load0.43
and143.36GiB free, no holder/build/browser. It is an observation, not permission.
The actual caller must reacquire nonblocking lock and fresh gates after separate
babysit SM-scope approval. Mint-only approval does not authorize this step.

Executable operational drivers stay in private evidence directories, bound by
independent review and exact SHA256. Repository changes in this batch document
these proofs; APP677 and artifact OPSc704 remain unchanged. SM loader and all65
UI routes remain pending; no production release was switched.


## First SM copy succeeded; native task failed before module load

With explicit babysit SM copy/native approval, frozen controller48679391 and
inputd9c30118 took the real Mint kernel lock and fresh gates. Limited rsync
completed at UTC **14:09:16.310Z**, status0. The new isolated runtime and all
original/failed files remain retained; no release or backup was removed.

SM worker exited1 at `before-inventory`; outer guard finished at
**14:09:26.610Z**, exit1. There is no `native-evidence` directory, so the eight
`.node`, Sharp and ONNX module loads were **not reached**. Full SM inventory
verification and Mint post-operation verification were also not reached. Do
not label this a SM f166 inventory or native PASS merely because copy exited0.
The owner subsequently observed no common kernel-lock holders.

The original worker logged only successfully validated Mint proofs. It rejected
one proof before logging its raw response, so the actual failing timestamp is
unavailable and must not be invented. Earlier successful worker/parent proofs
match the specific kernel PID/device/inode/startticks/cmdline/admission, plus
controller self/input/plan/lease bindings. The failing stack is the generic
`verifyMintObservation` predicate, which directly compares a raw Mint timestamp
with the SM clock and rejects any positive remote offset.

A separate **readonly clock-only SSH diagnostic** retained twelve raw replies;
all status0, round trips228–245ms. Every Mint timestamp was2–4ms ahead of the SM
receipt clock. This proves a reproducible cross-clock source defect and is
strongly consistent with the failure. It does **not** record the missing failed
RPC's delta or prove its exact rejected predicate by itself. No clocks were
changed, kernel lock acquired, artifact modified or native loader rerun by the
diagnostic.

Actual retained evidence:
- `/tmp/babysit/mint-queue/tag-sm-native-failure-20261013T1409Z/failure-summary.json`
  indexes all original logs/raw bytes/hashes; SM originals remain in its private
  `native-smoke-job`, Mint originals in `native-sm-target-job-c70425b0`.
- `/tmp/babysit/mint-queue/tag-sm-mint-clock-readonly-diagnostic-20261013.json`,
  SHA256 `5bc9aa5ace05e6ca4c29cd62e2e08144c5fce2a21284c9efa43bc74aa78fe266`.
- Existing nonauthor offline review UTC14:21:43.833864Z:
  `/tmp/babysit/mint-queue/tag-sm-native-failure-offline-independent-review-2026-10-13T14-21-43-833864+00-00.json`.

The proposed repair keeps raw remote timestamps intact, saves every raw proof
**before** validation, measures RPC age using local SM before/after timestamps,
and measures controller lease age using Mint's own clock. Identity, private
source hashes, API readiness, timeouts and expiry remain strict. It does not add
an arbitrary clock-skew allowance or change system clocks. A separately reviewed
smoke-only retry will use the already-copied runtime and a new exclusive `-r2`
job; no second rsync or deletion. New exact hashes/command/fresh gate receipt
require babysit admission before retry. Mint-only prior smoke remains valid;
SM native/UI/deploy remain pending, 65 main UI routes /0 complete passes.

## SM clock-envelope source repair; smoke-only r2 awaiting admission

The admitted first copy completed at `2026-10-13T14:09:16.310Z`, but
the worker failed before inventory/native loading. The old target and all
failed evidence remain; neither SM native loading nor its whole inventory
has passed. The missing failed RPC bytes cannot be reconstructed.

The existing separate writer prepared the SM v6 fix. Root independently
reviewed this code and ran 25/25 pure source/mock tests at UTC
`2026-10-13T14:36:57.093965+00:00`; evidence:
`/tmp/babysit/mint-queue/tag-sm-guarded-clock-source-independent-review-20261013-v6.json`,
raw `/tmp/babysit/mint-queue/tag-sm-r2-root-source-test-output-v6.txt`.
This is n/a-ui source evidence, not an executed retry.

Every RPC saves bounded original stdout/stderr bytes, exit status and local
SM start/end times before validation. Mint timestamps are retained unchanged.
The transport is source/input-bound; same-Mint controller lease age plus
the complete SM RPC and cached-reply duration must remain at most 30 seconds.
This conservative sum rejects the previously separable 29-second lease plus
9-second cache. Exact 30-second boundaries and positive/negative host clock
offsets are covered without changing system clocks or relaxing lock, expiry
or resource checks.

The proposed new controller reuses the existing isolated SM runtime and creates
exclusive `native-smoke-job-r2` evidence. It performs no rsync, Next build,
npm install, browser capture, inference, production action or deletion.
Whole inventories before/after and the unchanged manifest are prerequisites
for acceptance; Mint's full post-operation verification must also pass.
New receipt budget is 0.05 GiB; deployEligible and manifestPublished stay false.
The original driver and every failed job remain. The actual retry command
and new fresh real probe require babysit admission before execution.

Final independent source review by existing nonauthor reviewer completed
at `2026-10-13T14:40:12.353770+00:00`: 25/25 pure tests, Node syntax checks
and five embedded Python compile-only checks. Receipt `/tmp/babysit/mint-queue/tag-sm-r2-controller-final-independent-source-review-20261013T1439Z.json`,
SHA256 `20c814d3e1bb394b4dd89671b5c7f6658db9d9555d781bb25a82864144fed075`. Root reviewed the separate writer's SM source;
the nonauthor reviewer reviewed root's Mint controller. Both fixed drivers
were passively copied to Mint with mode 0600 and identical hashes:
controller `f26cc070ce8624905739914ff0510d0688e104999b8c48ae0c9a9b9b53c8d62f`,
pure contract `2076ccc55d3e49feb7a4eff006272c9ea2adc63f7da0bed8d16a8973274cfc40`. No execution, lock, native
or browser operation occurred during this source review/upload.

The genuine admission probe `/tmp/babysit/mint-queue/tag-sm-smoke-r2-admission-probe-20261013T143715Z.json`
(SHA256 `f5234758a2a376620d6d4994502d0b79e533191afd586491fa426442cf327d33`) observed all three sites 200/curl0 at UTC
14:37:15.001: tag 1.652168s, blog 3.507840s, YT 0.870980s; Mint load1
1.15 with 143.36 GiB free, no lock holder/build/browser; SM load1 2.847
with 61.48 GiB free and no local build. Actual isolated API returned 200.
This remains observationOnly/executionPermission=false; execution guard
must measure again. Exact conditional command and pending-false inputs
are in `/tmp/babysit/mint-queue/tag.md` and
`/tmp/babysit/mint-queue/tag-sm-smoke-r2-retry-packet.json`.
New retry admission is pending; SM native, UI and deployment are not passed.
