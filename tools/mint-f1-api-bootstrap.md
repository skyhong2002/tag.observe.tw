# Mint real fixture API startup recipe

This is a source recipe. It does not claim Mint SQL/API readiness, start a
service, acquire the build lock, or authorize a job. The source owner remains
the tag thread. Infrastructure owner prepares the real isolated SQL service
after the existing root-owned restore releases the common lock.

## Inputs and provenance

- APP: `677a0c793eeda0c4d850c81ac574c95508d08e0a`, from Git archive/clean clone.
- OPS: use the exact reviewed commit recorded in `/tmp/babysit/mint-queue/tag.md`;
  do not assume `e27db220` already contains this bootstrap or ELF correction.
- Mint Node 24.15.0/npm 11.12.1:
  `/home/sky/observe-worker/toolchain/node-v24.15.0-linux-x64/bin`.
- Dedicated real MariaDB, loopback `127.0.0.1:18306`, database
  `tag_f1_semantic_test`. No production database/API relay. No Docker assumed.
  Read-only `--version` of the foundation owner's portable binary at
  `/home/sky/observe-worker/db-tools/root/usr/sbin/mariadbd` observed
  **10.11.14-MariaDB-0ubuntu0.24.04.1**, not 11.4. Pin actual `VERSION()`
  in the SQL receipt; schema import and F1 semantic integration on that engine
  remain required, not assumed. This does not fulfill or relax the separate
  backup proposal's MariaDB 11.4 weekly-restore requirement.
- Reuse a copy of the **existing isolated fixture database**, not production
  data. Existing users are exactly 701/702/703, all `@fixture.test`; roles are
  the same reader/other/admin fixture roles already used in isolated testing.
  No new accounts, sessions, grants or permission changes.
- Existing SM fixture metadata read only: 63 tables, 39 migration records,
  estimated allocated table storage 2,457,600 bytes. This is a storage estimate,
  **not a measured SQL transfer size or an exported artifact**.
  Existing fixture has groups, semantic submissions/logs and generated WebP
  test images. Its articles/rankings tables are empty; such captures must be
  labeled empty-state evidence, never loaded/many-data evidence.

The foundation owner must prepare a private, bounded fixture transfer receipt:
actual SQL/file SHA-256, size (maximum 8 MiB for SQL), original isolation identity,
63-table/schema inventory and existing actor IDs. Use a read-only, consistent
copy of the already isolated DB only; no full production export/restore on SM.
Check there are no other users, OAuth sessions, API keys, service credentials or
real visitor data. If present, stop instead of silently dropping records or
transferring them. Reuse its existing migration records; do not execute the
integration suite's TRUNCATE/account-seeding setup as a bootstrap command.

Copy only the five explicitly generated `fixture-image-*.webp` files from
`/home/deck/tag-analysis-private/f1-release/candidate-fixtures/`, with checksums.
Do not copy the containing directory, `db.env.json`, cookies or old production
GET relay code. Rewrite copied Mint fixture image paths to its private fixture
store only, and record the exact mapping in the transfer receipt. The SM DB
and images stay unchanged. No SQL/transfer has been run by this recipe.

## Private configuration

All JSON inputs must be sky-owned regular files, mode 0600, in private Mint
directories. Do not put passwords in the queue, CLI arguments, logs or Git.

`db.json`: names `host`, `port`, `database`, `user`, `password`; the first three
are the dedicated loopback identity above. The foundation owner supplies an
existing isolated credential, never a production credential.

`readiness.json` follows `mint-f1-readiness-v1` in `mint-f1-readiness.md`:
reviewed/current expiration, real Mint/SM machine IDs, APP SHA, source receipt
ID, isolation receipt ID, exact source root, `appModulePath: app/src/app.js`,
complete Git-derived source hashes and pinned lockfile hashes, this bootstrap's
real path/SHA-256, `productionRelayDisabled: true`, `mode: isolated-database`,
actors `[701,702,703]`, API origin and actual SQL connection/server ports plus
`database.serverVersion` from actual `VERSION()` (exact string). Startup checks
it against the dedicated real connection, never against an invented 11.4 value.
With a direct Mint SQL listener both ports are 18306; do not copy SM's forwarded
server-port 3306 without measuring Mint's `@@port`.

`bootstrap.json` fields:

```json
{
  "schema": "mint-f1-api-bootstrap-v1",
  "reviewed": true,
  "sourceRoot": "/var/lib/observe-worker/tag/app-source",
  "databaseConfigPath": "/var/lib/observe-worker/tag/private/db.json",
  "readinessReceiptPath": "/var/lib/observe-worker/tag/private/readiness.json",
  "apiOrigin": "http://127.0.0.1:18131",
  "publicOrigin": "http://100.108.108.109:18196"
}
```

The paths/origins are the proposed isolated allocation, not proof a listener is
running or a user-facing preview is reachable. Source root must contain the
fixed APP's root runtime dependencies installed from its exact lockfile. Any
dependency installation uses the common slot, low priority and current gates.

## Startup and actual readiness (after infrastructure/slot handoff)

```sh
env -i HOME=/home/sky LANG=C TZ=UTC NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
  PATH=/home/sky/observe-worker/toolchain/node-v24.15.0-linux-x64/bin:/usr/bin:/bin \
  /usr/bin/nice -n 19 /usr/bin/ionice -c3 \
  /home/sky/observe-worker/toolchain/node-v24.15.0-linux-x64/bin/node \
  /home/sky/observe-worker/sources/tag-mint-e27db220/tools/mint-f1-api-bootstrap.js \
  --start /var/lib/observe-worker/tag/private/bootstrap.json
```

The OPS directory must first be checked out cleanly at the new exact OPS SHA;
its historical directory name is not a SHA assertion. No environment `.env`
autoload, real OAuth, crawler, ranking worker, Redis or service token. The bridge
only listens on loopback and uses the fixed APP's real Fastify/Drizzle handlers
and real isolated SQL. It strips real incoming cookies/credentials and only
selects the already existing fixture identity using `x-f1-fixture-actor`.
All bridge replies are private/no-store; no account/grant endpoints are exposed.

On Mint, record actual GET `/internal/mint-f1-readiness` response/status/UTC,
loopback listener, machine ID, `DATABASE()` and `@@port`, source/bridge hashes
and fixture transfer receipt. Executor requires `mint-f1-isolated` plus
`databaseScope: isolated`; mock readiness is deliberately rejected. Its
dedicated readonly identity connection is cancelled on timeout without
destroying the application's separate SQL pool.

This bridge disables jobs. Therefore relation submission/approval and public
SQL reads can be tested, but an image queue/worker or real ONNX processing
**cannot be called passed**. Complete image processing still needs the separate
reviewed isolated worker/store recipe. Readiness is source/connection identity,
not a whole-workflow or UI-review certificate.

## Shutdown and validation scope

SIGTERM/SIGINT close only this bridge's loopback listener, app and isolated SQL
connections. Do not kill root's restore, change its lock, or start a second DB
against its datadir. Keep transfer/config receipts and fixture source.

`node --test tools/mint-f1-api-bootstrap.test.js tools/mint-f1-readiness.test.js`
uses injected fake SQL, import and HTTP adapters only; it creates no listener,
browser, database, account, capture or build. These tests are source behavior
evidence, not the still-required live Mint isolated database/API readiness.

## Execution input and gate receipts

Do not make a runnable input by filling `reviewed`/`mintReady`/`globalBuildSlot`
with invented truth values. Babysit must acknowledge the actual source review,
live API readiness and slot handoff; the kernel lock must also be free. All
receipt IDs refer to retained real evidence paths/IDs, with current expiration.

`execution.json` is owner-private, and contains only:

- `appSha`, `opsSha`: exact fixed APP and final reviewed OPS full hashes.
- `repo`: clean exact OPS checkout above; `candidate`: new private absolute
  working directory; `estimateGiB`: positive combined working/runtime estimate.
- `hostReceipt`: schema `mint-f1-host-v1`; `reviewed`, `mintReady`,
  `globalBuildSlot`, `executionReviewed` are booleans backed by actual evidence;
  `reviewReceiptId`, `slotReceiptId`, `executionReviewReceiptId`, `expiresAt`,
  `globalLockPath: /run/lock/mint-global-build.lock`, actual `smMachineId`.
  `mint` includes actual machineId/hostname/platform/arch/cpuCount,
  nodeVersion/nodeModulesAbi/libc/nodePath/npmPath/npmVersion. `npmPath` is its
  **resolved CLI file**, not an assumed symlink. `noninteractivePath` is the
  explicit toolchain-first PATH. `smAbi` is SM's actual Linux/x64/137/glibc-2.41;
  Mint remains truthfully glibc-2.39. `api` includes origin, actual Mint machineId,
  real isolationReceiptId, isolatedDatabase true and productionDatabase false.
  `nativePolicy` uses the reviewed `mint-f1-native-policy-v1` strategy
  `elf-requirements-and-sm-target-smoke`, a genuine reviewReceiptId,
  buildAllowed true and maxGlibcRequired `2.39`; it does not declare native pass.
- `smReceipt`: until Mint→SM Tailscale authentication is available, the reviewed
  root-specific `mint-f1-sm-relay-v1` receipt selects `sm-origin-relay`, with
  `authorization: root-2026-10-13-sm-origin-relay`, channel `existing-owner-ssh`,
  channelReceiptId, actual SM/Mint IDs, private relayPath, current expiresAt,
  reviewed reviewReceiptId and acknowledged globalBuildSlot/slotReceiptId.
  It uses the existing authenticated SM→Mint alias, no new key or permission.

The raw SM sample must state observedHost SM, machineId/measuredFromMachineId SM,
actual start/finish timestamps, load1, `/home` available bytes,
localSmBuildCount and three complete numeric homepage measurements. It is
**measured on SM**, then privately/atomically relayed; never call it a Mint probe.
Age over 30 seconds, relay failure or stale evidence pauses without fallback.
Keep the actual source receipt and SSH-channel/private-owner trust record;
content SHA256 is not a cryptographic signature.

The pre-start combined receipt must also record actual Mint load/free bytes,
competing build PIDs, browser roots/process count, the current lock owner and
global slot handoff (SM-only process counts cannot prove remote YT is idle).
Mint/SM gates are separate. Start SM `/home` at least 40 GiB; below 30 GiB pause.
Mint candidate estimate must leave at least 30 GiB. Load above 12 or any site 5xx
pauses. Approved SM DNT1/HTML five-sample baselines from
2026-10-13T05:47:30Z–05:48:30Z: tag 0.256s→2.0s; blog 3.085s→6.17s;
YT 0.289s→2.0s. This is end-to-end total, including rendering, edge and network;
it is not an exact origin-rendering measurement. Global maximum remains one
build and two capture browsers. Initial capture is a separately admitted small
batch, DNT1 and network-layer GA/GTM block, not part of this API startup.

After the receipts exist and babysit confirms, the full Mint runner command is:

```sh
env -i HOME=/home/sky LANG=C TZ=UTC \
  PATH=/home/sky/observe-worker/toolchain/node-v24.15.0-linux-x64/bin:/usr/bin:/bin \
  /usr/bin/nice -n 19 /usr/bin/ionice -c3 \
  /home/sky/observe-worker/toolchain/node-v24.15.0-linux-x64/bin/node \
  /home/sky/observe-worker/sources/tag-mint-e27db220/tools/mint-f1-execution.js \
  --execute /var/lib/observe-worker/tag/private/execution.json
```

The runner acquires the already provisioned common lock nonblockingly; do not
wrap it in another flock holder of the same file. Never steal root's restore
lock. Next workers are fixed at cpus 2 and static-generation concurrency 1.
Record real BUILD_ID/artifact hash when produced, release the slot to babysit,
and separately complete ELF/SM native loading plus actual candidate screenshot
review. Do not rebuild on SM or infer deployment approval from success output.
