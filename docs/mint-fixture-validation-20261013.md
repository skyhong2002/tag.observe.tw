# Mint isolated fixture validation — 2026-10-13

This is runtime integration evidence, not a candidate UI review, native loader
certificate, build authorization, production deployment, or GA receipt.

## Fixed source and provenance

- APP: `677a0c793eeda0c4d850c81ac574c95508d08e0a`.
- Reviewed executable OPS: `8e183c35c6cb54e56c98acb616f4bb89a9bfbb80`.
- Fetched remote base: `a89908a650c42a1224d657e6c908d5fd3c7be5a0` (`origin/main`, APP ancestor).
- Mint clean OPS checkout: `/home/sky/observe-worker/sources/tag-mint-e27db220`.
  Its historical directory name does not assert the current commit.
- Foundation owner supplied a copy of the existing isolated
  `tag_f1_semantic_test` fixture, not a production export. SQL is 151,556 bytes,
  SHA-256 `91bea9f994fc11e25f909ea6d2ea4f0edba6810fcc9fb9bfd2bbec696ac8094b`.
- Source engine was MariaDB 11.4.12; actual Mint target is MariaDB
  10.11.14-MariaDB-0ubuntu0.24.04.1. These are different versions. No assertion
  of complete engine equivalence or the backup proposal's 11.4 restore check.

The owner adopted the foundation owner's already-running private database,
loopback port 18306, without restarting it or changing its datadir. The reviewed
executor lock was acquired for validation/API startup and for semantic tests,
then released after each operation. No accounts, permissions, OAuth sessions,
API keys or feed tokens were created. Only existing repo fixture actors
701/702/703 were selected; fixture review adds an isolated proposal and relation,
which remain retained.

## Actual results

- UTC `09:53:34.050Z`: actual private schema inventory has 63 tables and 39
  migration records. Existing actors and empty sensitive credential/session/
  role-log tables were checked. Metadata checksum describes the target schema;
  it is not a claim that all source and target engine metadata are identical.
- The provided APP source was checked against 1,231 Git-derived file hashes,
  plus direct runtime dependency versions against the fixed lockfile. This is
  not a complete dependency-byte/native integrity certificate.
- UTC `09:53:41.361Z`: actual loopback readiness returned HTTP 200 with exact
  APP, Mint machine ID, isolation receipt, `databaseScope: isolated`, and
  `productionDatabase: false`. Source/API checks use real SQL connections.
- UTC `10:03:38.978Z`–`10:03:50.752Z`: **14/14** real isolated HTTP/SQL cases
  passed: two-level public relation graph; anonymous submission denied;
  reader admin queue denied; reader submission; duplicate returns 200 with the
  same ID; pending relation stays private; existing fixture admin approval;
  approved inherited graph; repeated review conflict; four invalid credential
  header cases; control-character tag rejected. Public relation payloads were
  checked for fixture email and private audit fields.

The four credential cases exercise this isolated bridge's unconditional
`private, no-store` responses and credential stripping. They do not independently
validate the production application cache branches. Jobs are disabled, so image
queue/ONNX processing is not passed. Articles and rankings are empty: future
screenshots of those tables can only prove empty states, not loaded/many-data
states. No browser or Google transport was started in this validation.

## Retained evidence

All paths below are private, outside the repo. No DB credential configuration is
included in this document or the babysit queue.

| Evidence | Mint path | SHA-256 |
|---|---|---|
| Root-supplied transfer provenance | `/var/lib/observe-worker/tag/private/fixture-transfer-receipt.json` | `c507a1c088aa490e4f00aa1b6556cad56cbca0c111375953e596c5fd4095641d` |
| Actual target schema | `/var/lib/observe-worker/tag/private/fixture-schema-compatibility.json` | `05e43152988f5e1d647f70fa4a5229ebd9d8200e3059f9564f6f7cab530074e6` |
| Actual API process/readiness | `/var/lib/observe-worker/tag/private/api-process.json` | `1f95e4afd1439d95d4eb5eb1ba3babd11bb93359ab763825dd10b343b22ab77c` |
| Real semantic cases and before/after gates | `/var/lib/observe-worker/tag/private/semantic-compatibility-2026-10-13T10-03-38.978Z.json` | `4c56b756710a494eed9100bada9342d71609d89a591bc527cd6c269447c7195d` |

Byte-identical 0600 copies have prefix `tag-` in
`/tmp/babysit/mint-queue/`. Startup logs, including the initial rejected
schema-declaration check, remain retained on Mint. No failed artifact was
rewritten or deleted.

Independent source review uses the existing GPT-6.1 Sol instance
`/root/mint_candidate_portability`; actual hashes, UTC and conclusions are in
`/home/deck/tag-analysis-private/f1-release/mint-handoff-independent-review-20261013.log`.
This instance did not author the owner's setup/semantic probe. The semantic
script reviewed hash is
`f596b2155b51a04f59c8be3ff5a3cb26769a76d23e51ceb3614c6573b2a45e5f`.

## Remaining admission and acceptance

Actual API readiness does not modify the foundation capability file's historical
false flags or grant the global build slot. New cross-host observation and
readiness receipts go to babysit for confirmation before the first Next build.
The runner must then reacquire the kernel lock and fresh gates itself.

Mint is truthfully glibc 2.39; SM is 2.41. The reviewed ELF-requirement policy,
foreign ONNX platform exclusion, actual ELF inventory and isolated SM native
smoke remain required for the artifact. No BUILD_ID or built artifact exists yet.
Candidate capture/review and same-artifact deployment are still pending.
The APP UI ledger remains **65 main routes, 0 complete passes, 65 pending**.

## First build attempt and diagnostic fix

Following the explicit babysit slot acknowledgement at UTC 10:10, exact OPS
8e183c35 / APP 677a0c79 obtained the common kernel lock and fresh Mint/SM gates.
The recorded start probe has all three sites HTTP 200 and within their budgets.
The first Next 16.3.6 Turbopack compile exited 1; no BUILD_ID or native artifact
was produced. The guard released its own lock. The failed directory remains
`/var/lib/observe-worker/tag/candidate-677a0c79-first` and is not reused, removed
or overwritten. Byte-identical original stage/guard/trace/diagnostics evidence
and checksums are indexed in `/tmp/babysit/mint-queue/tag-first-build-failure.json`.

The old executor buffered but discarded child stdout/stderr on failure, so the
compiler diagnostic is unavailable. The error's underlying cause is **not yet
established**. A small source fix now streams both outputs to the private stage
log before checking exit status, preserving prior log entries and closing its
own descriptor on spawn/exit failures. Error summaries do not echo child output
or inherited environment secrets. It changes no APP, Next command, slot, API
identity or resource gate. Existing independent reviewer source PASS, UTC
10:15:12; relevant execution/artifact tests 29/29, including actual tiny child
stdout/stderr preservation on failure. These are not another Next build.

The logging fix requires its own exact OPS commit and a new admission handoff
before another guarded build. There has been no fallback build, capture,
production deployment or new account/permission creation.

## Logging-enabled retry: confirmed Next root boundary

Babysit explicitly acknowledged OPS f4438e76 / unchanged APP 677a0c79. The
reviewed guard acquired its own lock and fresh gates, then retained the retry at
`/var/lib/observe-worker/tag/candidate-677a0c79-retry-logging`. Compile exited 1;
no BUILD_ID, artifact or native smoke was produced. Both failed trees remain.
The private failure inventory is
`/tmp/babysit/mint-queue/tag-logging-retry-failure.json`.

This time the retained compiler log identifies the problem: Next 16.3.6 rejects
the root lockfile because the executor placed HOME within the candidate. It
selects web/ as the workspace root, then fails to resolve sibling app/src and
app/data imports. The referenced files were checked and exist in the archive.
No missing-file or APP workaround is applied.

UTC 10:21:12.949Z: a read-only call to the **installed Next root-finder** reproduces
both cases on the same retained tree: candidate/.home gives root=web and a home
boundary; candidate.home (exclusive sibling) gives root=candidate, both lockfiles,
and no boundary. This invokes no compiler or build. Receipt:
`/tmp/babysit/mint-queue/tag-next-root-cause-reproduction.json`, SHA-256
`d3184e45cae25b82cc820aa90cb624c4aed2a4f48b12b5daa30c9d67f5934a9a`.

The source fix gives the low-priority child an exclusive 0700 sibling HOME,
normalizing trailing-slash candidate inputs. It does not use the account home,
inherit credentials, or change APP, Next commands, API identity or resource
gates. Another guarded build is pending independent review and babysit admission;
no repeated blind retry has been launched.

## Next completed; original runtime native proof blocked

With explicitly admitted OPS a0911a78 and unchanged APP 677a0c79, Next compiled
in 9.8 seconds, completed TypeScript in 14.9 seconds and generated 64/64 static
pages in 3.1 seconds. Actual BUILD_ID: `PmjYScQDDoJKBr43SLkhd`. The stage's Mint
Sharp/ONNX imports completed before runtime derivation. Work tree size is
1,513,406,464 bytes; exclusive runtime size is 1,004,961,792 bytes. Previous
failed trees remain retained.

Strict full-artifact ELF inspection rejects Sharp 0.35.5's upstream alternative
Yarn RPATH escaping the artifact. The actual Mint loader selected its internal
libvips, but this does not relax the strict proof or prove the SM target. No
final artifact manifest was published; no SM native loader or browser ran.

A separate reviewed read-only operation acquired the common lock, confirmed
fresh real Mint/API/SM gates, recomputed Git-pinned source and runtime inventory,
and released the lock. Observation is retained at Mint
`/var/lib/observe-worker/tag/private/built-artifact-observation-1791887860520.json`
and its byte-identical 0600 SM copy
`/tmp/babysit/mint-queue/tag-built-artifact-observation.json` (8,705,059 bytes).
Receipt SHA-256: `4ab410dccd3e777654030ba99fb4ae9fd8f541d9c027623ac94220edf493f7e6`.
Original unmodified runtime inventory SHA-256:
`831dc44f130c96d039e1747e300135987aeeb229df89df76151004ddcc9d9edb`
(32,460 entries). This is an observed checksum, not native/UI/deployment approval.
Final observation gates: all three homepages HTTP 200 and totals
0.249894/2.734888/0.180161 seconds; Mint load 0.38 and available about 146 GiB.

Next build slot was returned to babysit. Source-only repair tooling preserves
all originals and makes a new exclusive same-BUILD native runtime, shortens only
the three exact reviewed Sharp RPATHs, verifies unchanged dependency/version/
symbol/text contracts, and reruns strict full ELF plus actual Mint/SM loaders.
The portable tool uses signed Ubuntu metadata and private extraction; it is
not installed globally. Source tests are mock/parser evidence; no download,
extraction, native mutation or new Next run has occurred. The implementation and
real guarded packaging adapter require independent review and admission before
execution. All 65 UI routes remain pending, no production deployment occurred.

The native repair helper is now prepare-only: it cannot publish
`mint-artifact.json`. A separate parent publisher checks the completed worker,
exact APP/OPS/BUILD and driver/input checksums, rehashes the new inventory and
verifies its ELF proof before fresh live gates, input and kernel checks and a
single exclusive private manifest write. False and asynchronous final proof
verifiers are rejected. The related source/mock suite has 58 passing tests;
this is not evidence that native repair, loader smoke or UI review has run.

The admitted OPS 9710259b native attempt failed before patching with
`Unparseable text bytes`: real GNU readelf separates its hex and printable ASCII
columns with one space, whereas the previous parser expected two spaces.
Read-only post-failure checks found all three Sharp bindings still at the
original pinned checksum and no final manifest. The failed derived tree and
private log remain retained. Parsing now uses the fixed 35-column hex area with
real-format regressions, and a separately admitted retry may use only an
explicit same-parent `-r2` destination. No retry has been executed yet.
