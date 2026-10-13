# Backup v2 proposal — 2026-10-13

Status: source and mock tests for review only. No export, upload, restore,
installation, database creation, scheduling, deletion, or deployment performed.
Existing `runtime/tag-backup.*` and existing backup mutation code stay untouched.
The currently user-disabled `tag-backup.timer` must remain untouched during review.
Do not inspect or kill the running backup while evaluating this proposal.

## Why change

The current approximately 8.3 GB compressed backup corresponds to about 66 GiB
of database storage. A local restore drill took approximately 8.3 hours and
requires roughly 76 GiB plus a 25 GiB reserve, causing production-host pressure
and freezing. Publication should not depend on a production-host restore drill.

## Daily production export

Off-peak: export with `--single-transaction --quick`, compress immediately,
then `zstd -t`, SHA-256, upload to ggss-nas, read the uploaded bytes back and
compare SHA-256. Only after matching readback publish a `nas-verified` receipt.
This does not claim restoration success. Publish artifacts under unique names;
NAS latest selection must use verified receipts, never directory timestamps or
partial uploads. Manifest should also capture source table inventory, normalized
schema hash (remove AUTO_INCREMENT counters), and selected count observations.
Counts from a changing production database need a documented consistent snapshot
strategy; otherwise record observation times and do not claim exact comparison.

Retain 1–2 compressed copies locally; NAS is authoritative. At the copy limit,
stop and alert for owner review. No pressure reclaim, automatic rotation, or
existing-file deletion is authorized. Any future retention deletion must be a
separate explicit owner-approved manual plan, with exact file list and receipts.
An interrupted output is preserved for review; never treat it as verified.

## Weekly mint-mbp restoration

Run on mint-mbp using its own MariaDB 11.4, not the production host. Fetch the
latest NAS artifact with verified manifest, check its compressed integrity and
hash, restore into a separately approved isolated database with event scheduling
disabled, and produce table list, normalized schema hash, selected sample counts,
source/NAS checksum, comparison outcome, start/end times and MariaDB version.
Return that receipt to NAS. A mismatch, missing evidence, insufficient space,
NAS failure, or offline host is an alert and failed/pending run, never a pass.

Track scheduled and successful weekly timestamps on NAS. When mint-mbp returns,
catch up the oldest pending drill using latest verified backup, then acknowledge
the pending run only after the returned receipt is verified. Alert on a missed
weekly run and on stale last-success age; retries must have bounded attempts and
backoff. Receipt freshness monitoring must be independent of the offline laptop.
Do not enable scheduling until that monitor and catch-up dispatcher are reviewed.

## Read-only preflight results

2026-10-13 Tailscale reports `Mint-MBP`, `mint-mbp.tailf76d1d.ts.net`,
`100.108.108.109`, online. This is control-plane visibility, not SSH/NAS access.
One bounded SSH attempt used BatchMode, ConnectTimeout=5, ConnectionAttempts=1,
StrictHostKeyChecking=yes, and outer timeout=10 seconds. It stopped because no
trusted ED25519 host key is known. No host-key bypass or installation was used.
Therefore available disk space (target about 100 GiB), MariaDB version,
SSH login rights and mint-mbp/NAS read/write receipt permissions remain
**unverified**. Execution readiness is blocked; proposal review is unaffected.
Before authorization, establish trusted host identity out of band, then perform
read-only `df -Pk` and `mariadb --version` (or bounded Docker version inspection)
and a non-mutating NAS permissions probe. Do not create a database or run restore
as a preflight. With 66 GiB source storage, 100 GiB free is marginal relative to
76 GiB restore + 25 GiB reserve + compressed input; require measured headroom.

## Reviewable implementation boundary

`tools/nearline/backup-v2.py` is one opt-in orchestrator. Default CLI only prints a
plan. Mutation requires both `--execute` and reviewed configuration. Adapter argv
arrays avoid shell-string injection and isolate environment-specific credentials,
NAS paths, exporters and approved restore target. Credential files belong outside
Git; arguments and SQL are never printed on failures. No delete command exists.
Daily publication does not call restore. Weekly execution rejects configs that do
not explicitly identify mint-mbp and MariaDB 11.4. Space and copy limits stop work.

This is staged source, not a complete deployable service: adapters must be supplied
and reviewed, host/version verified at execution time, continuous free-space gates
added for long-running jobs, NAS adapter bandwidth limits verified (readback already has a one-hour deadline and 30-second stall limit),
source snapshot metadata capture and restore inspection adapters configured, and external
alert/catch-up delivery configured before execution. The current nonzero exit and
`ALERT` stderr must be wired to a real monitored alert channel; stderr alone is not
an operational alert. The orchestrator independently compares tables, schema SHA-256 and sample counts
against the separately fetched NAS manifest; it ignores adapter `matches_expected`
assertions. Empty inventory/counts, invalid hashes and mismatches fail. Archive,
manifest and receipt publication all require NAS readback hashes. Do not mark this
proposal production-ready.

Example plan configuration (intentionally non-executable; replace REVIEW_REQUIRED
with reviewed argv arrays and absolute paths, never shell commands):

```json
{
  "reviewed": false,
  "directory": "/review-required/local-backups",
  "execution_host": "mint-mbp",
  "mariadb_series": "11.4",
  "local_copy_limit": 2,
  "required_free_bytes": {"daily": 37580963840, "weekly": 118111600640},
  "commands": {
    "export": ["REVIEW_REQUIRED", "{archive}"],
    "source_metadata": ["REVIEW_REQUIRED", "{archive}"],
    "upload": ["REVIEW_REQUIRED", "{archive}"],
    "readback": ["REVIEW_REQUIRED", "{archive}"],
    "upload_manifest": ["REVIEW_REQUIRED", "{manifest}"],
    "readback_manifest": ["REVIEW_REQUIRED", "{manifest}"],
    "fetch_manifest": ["REVIEW_REQUIRED", "{manifest}"],
    "fetch_latest": ["REVIEW_REQUIRED", "{manifest}", "{archive}"],
    "restore": ["REVIEW_REQUIRED", "{archive}"],
    "inspect": ["REVIEW_REQUIRED", "{archive}", "{inspection}"],
    "upload_receipt": ["REVIEW_REQUIRED", "{receipt}"],
    "readback_receipt": ["REVIEW_REQUIRED", "{receipt}"]
  }
}
```

Exporter/fetch adapters emit compressed SQL to stdout. Readback adapters emit NAS
bytes. `source_metadata` and `inspect` emit JSON to stdout: nonempty unique `tables`,
64-character lowercase hex `schema_sha256`, nonempty `sample_counts` mapping known
tables to nonnegative integer counts. Source metadata additionally requires
`snapshot_binding: "export-snapshot"`; the reviewed export and source-metadata
adapters must actually share that snapshot. Without this capability execution
remains blocked; the binding field alone is not proof of snapshot correctness.
Daily manifests add `archive_key` and SHA-256. `fetch_manifest` selects only a
manifest committed by a NAS-verified daily receipt; `fetch_latest` reads that exact
manifest and streams its `archive_key`, never independently selecting latest SQL.
The orchestrator compares the archive bytes to the independent manifest hash
before restoring, and compares restored metadata to the manifest itself.
Restore consumes the named archive. All adapters must exit nonzero for incomplete
evidence. Uploads must be non-overwriting (for example rclone `copyto --immutable
--bwlimit 8M`) and use a restricted NAS destination. Receipt readback must match
its local hash before the CLI returns success. A locally written receipt alone
is not authoritative; NAS receipt acceptance must validate published artifacts.
Every subprocess is created in its own session; timeout cleanup sends TERM then
KILL only to that invocation's process group, including descendants. No existing
backup process is inspected or killed.

## Resource limits and proposed schedule (not enabled)

All invoked commands use `nice -n 19 ionice -c 3`. Proposed daily slot: 04:30
Asia/Taipei; weekly laptop slot: Sunday 02:00 Asia/Taipei, subject to owner choice.
Use export pipe `pv -L 8m` with pipefail or an equivalent reviewed bounded pipeline,
NAS rclone `--bwlimit 8M` / rsync `--bwlimit=8192`, and systemd `Nice=19`,
`IOSchedulingClass=idle`, `IOWeight=1`, measured-device `IOReadBandwidthMax` and
`IOWriteBandwidthMax` ceilings. Verify actual cgroup/device support first.
Provide per-command timeouts and no unbounded SSH retry. Schedule `Persistent=true`
only after explicit catch-up behavior and stale-receipt alerts are implemented.
No units are installed or enabled by this change.

## Cutover and rollback (future authorization required)

1. Review adapter commands, credentials scope, trusted host identities, available
   space, MariaDB 11.4, NAS permissions, alert delivery and manifest semantics.
2. Review mock tests, then approve a separately bounded staging dry run and NAS
   receipt verification. Do not interfere with the current running backup.
3. Once legacy work completes naturally, owner approves v2 scheduling and resolves
   any overlap using distinct new units. Leave user-disabled legacy timer disabled.
4. Validate first daily NAS-readback receipt and first mint-mbp restore receipt,
   then explicitly authorize continuing v2 scheduling.
5. Rollback: disable only newly approved v2 units, preserve all artifacts and NAS
   receipts, revert v2 configuration/source to the prior reviewed commit. Any
   reactivation of legacy scheduling requires explicit owner authorization; do not
   automatically enable the user-disabled timer. Do not delete backups to rollback.

Validation: thirteen pure mock tests cover plan-only behavior, daily archive/manifest/
receipt readback verification without restore, archive or receipt readback failure,
valid weekly comparison, fake/empty/nonhex receipt evidence rejection, table/schema/
count mismatch despite a fake match assertion, independent manifest hash mismatch
blocking restore, low-space stopping without mutation, weekly host guard, strict
1–2-copy configuration, and both normal-exit and timeout cleanup of only the new process group.
Fixtures are tiny; no real database, NAS mutation, restore, deletion, subprocess,
or large file generation occurs.

## Independent source review and additional read-only check

Final proposal-stage source review passed by a non-author GPT-6.1 Sol instance;
13 pure mock tests pass. Transcript with findings, resolutions, UTC and source
hashes: `/home/deck/tag-analysis-private/f1-release/backup-redesign-independent-review-20261013.log`.
The early false-positive restore receipt and orphan process findings were fixed.
This does not approve configuration, live backup execution or timer activation.

A second bounded read-only attempt used `tailscale ssh deck@mint-mbp` (coordination
server host-key verification, no bypass) and requested only disk/version checks.
It also stopped at missing trusted ED25519 host-key verification before login.
No remote command ran; disk, MariaDB version and NAS permissions remain unverified.
No public/private key contents or credentials are needed in Git or this proposal.

Before applying, obtain trusted mint-mbp host identity through the owner's existing
trusted channel, verify available headroom and MariaDB 11.4, and configure reviewed
NAS/export/manifest/restore adapters plus the independent missed-run alert and
catch-up mechanism. Source snapshot binding is an explicit remaining gate; do not
replace it with an unverified configuration flag.
