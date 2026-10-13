# Mint F1 execution adapter contract (pending implementation)

`mint-f1-candidate-plan.js` is an offline planner, not an executable build runner.
Operator JSON records assertions; it is not authenticated evidence and never
unlocks execution. `--execute` always fails. No dependency installation, SSH,
public probing, build, capture, restore or deployment occurs in this tool.

The follow-up implementation can add independent modules rather than asking an
operator to edit this planner:

- `mint-f1-host-adapter.js`: `verifyHost()` must read the real Linux hostname,
  machine identity, CPU architecture/count, Node24 and resolved npm PATH. Compare
  against operator-reviewed Mint identity and deny the SM identity. `verifySource`
  must run a fresh `git fetch origin`, resolve exact APP_SHA, require
  `origin/main` ancestry and clean tracked/untracked source. APP_SHA and OPS_SHA
  identify separately archived application and reviewed tooling commits; do not
  silently substitute HEAD. Enforce exclusive new candidate paths.
- `mint-f1-sm-adapter.js`: `probeSM()` returns `observedHost: 'SM'`, SM
  `machineId`, `measuredFromMachineId` (the actual SM probe location), `ageMs`,
  `load1`, `homeAvailableBytes` from SM `/home`, and `sites` containing the three
  baseline URLs with `exitCode`, HTTP `status`, `ttfb` and end-to-end `total`.
  The transport must be explicitly configured, reviewed, read-only and bounded;
  no guessed SSH host, credentials, local Mint fallback or cached success.
  Validate actual identity, freshness (at most 30 seconds), numeric values and
  completeness. Failed transport must pause/abort through the existing monitored
  process-group guard. Persist the SM raw evidence and decision in the audit log.
- `mint-f1-execution.js`: use a real shared Mint host-wide nonblocking lock only
  after formal all-site slot handoff. Hold it across dependency install and build.
  Reuse `runStage` only with exact APP_SHA and a sanitized environment: never
  inherit production DB credentials or `.env`; explicitly supply isolated Mint
  `TAG_API_ORIGIN` and required safe build variables. Any native install scripts
  need prior review (`npm ci --ignore-scripts` alone may leave native packages
  unusable). Monitor SM through the adapter plus separate Mint resource/competing
  build checks; local measurements never satisfy SM gates. Keep nice 19, ionice
  class 3, cpus 2 and static generation concurrency 1. Retain failed artifacts.
- `mint-f1-artifact.js`: require compatible Linux architecture, Node native ABI
  and libc before accepting native binaries. Record exact APP_SHA and OPS_SHA,
  BUILD_ID, both lockfile hashes, platform/runtime/native ABI, source archive hash
  and per-file SHA256 tree (including standalone/static/public and app source).
  Reject missing/unexpected files, unsafe symlinks, hash mismatch and incompatible
  artifacts. Deployment is a separate independently reviewed action.

Follow-up mock tests must cover forged/unavailable/stale SM identity, Mint-data
substitution, all service and 40→30 GiB/load gates, lock collision, changed source
or ancestor after fetch, environment credential leakage, early build exit,
SIGSTOP/CONT/TERM process-group cleanup, native ABI mismatch and checksum
corruption. Adapter tests inject transports/process/filesystem fixtures; they do
not use actual SSH, public URLs, dependency installation or build execution.

Current tests:
`node --test tools/mint-f1-candidate-plan.test.js`

The default first application source is
`677a0c793eeda0c4d850c81ac574c95508d08e0a`; the actual OPS_SHA is the final
independently reviewed operations commit. Mint readiness and operator handoff
are still pending. No infrastructure provisioning is performed here.
