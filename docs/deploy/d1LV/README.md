# d1LV simple user-service deployment proposal — awaiting admission

User decision: brief gateway interruption is accepted. Packet `83f5cf29…` and its NAT proposal are withdrawn. **No privileged routing or sudo is used.** The old proposal is retained in Git history; `switch.nft` now contains comments only and is never used by either script.

APP `aff5c0289c4863fedb37368b4942884ccc068d77`, BUILD_ID `d1LVsC3sk6p04uOyWUx5T` are unchanged. No rebuild, dependency install, migration, Cloudflare/WAF change, backup timer action, or cleanup is included.

## Persistent topology

- Existing gateway `tag-analysis.service`, port18130: a new `zz-f1-d1lv.conf` pins the new release and `UI_ORIGIN=18232` via explicit ExecStart environment. Existing nearline/vocabulary drop-ins are preserved. Only this gateway restarts at cutover.
- New frontend `tag-f1-web-d1lv.service`, loopback18232: enabled user unit, exact reviewed standalone build. Old `tag-web.service` stays running at18132 and keeps its old current/release.
- New loopback data API `tag-f1-api-d1lv.service`, port18230: same APP and production DB/environment. It is needed to warm the relations endpoint before public gateway cutover because 0dd has no F1 relations route. This is an ordinary existing API unit, not a new adapter or controller. Only anonymous DNT1 GETs are issued during deployment.
- Existing enabled worker `tag-worker.service`: stop the old consumer, add a release/metrics override, then start F1 before exposing uploads. The new private image policy persists after reboot. The historical `tag-f1-worker-d1lv.service` file is not installed.
- `current` remains the original 0dd target. Actual deployed gateway/worker release is determined by their drop-ins and WorkingDirectory, not by the legacy current symlink. Gateway Wants/After and enabled API/web units make the topology survive a reboot. No reboot is performed for this test.

## Exact steps

After babysit admission, run `bash docs/deploy/d1LV/deploy.sh` from the pinned clean control checkout. The script:

1. Takes the existing tag deployment lock and creates new exclusive `-simple-002` backup/release paths. If the two retained private units exist, cmp requires their exact previously admitted b448432b repository content before proceeding. Saves original three units plus retained private units/drop-ins, readlink target and timer state before installing new002 units. The001 release/backup remain untouched.
2. Uses the reviewed three-trial median probe before copying, again before worker changes and again immediately before public cutover. Every raw trial is saved privately. A failed trial or resource gate stops the script; an initial gate rejection preserves timestamped raw receipts without creating a backup/release that blocks a clean retry.
3. Copies cache-free source into a new release and merges only old immutable static assets with `--ignore-existing`. No stale HTML/RSC/cache is copied; no new asset is overwritten.
4. Enables/starts new private API/web; serially checks the16 main homepage API keys for200, then privately warms homepage/tag/relations (max120s). A repeated full homepage must finish<=2s before worker replacement. Public six checks retain20s. See `docs/f1-warm-diagnostic-20261014.md` for measured cold-process limits and prior internal500s.
5. Installs only its own gateway override, daemon-reloads and **restarts tag-analysis.service once**. No stop/restart/disable of legacy tag-web.service appears in either script.
6. Immediately GETs homepage, tag and relations both at18130 and at public HTTPS. Every one must be200/curl0, without acceptance retries. Any failure invokes rollback immediately. Startup only retries ECONNREFUSED, at most40×250ms; actual HTTP/curl errors fail.
7. Saves headers/bodies/UTC/results, unit WorkingDirectory/PID and full deployed inventory after old static assets were added. The source59468 hash is not reused as the final release hash.

Allocation: approximately0.803 GiB source plus3.1 MiB old static, capped planning estimate1 GiB. All old/new artifacts, releases, backups and test evidence are retained.

## Downtime and rollback

`restart-started.utc`, `restart-ready.utc` and `restart-to-first-200-upper-bound.ns` record restart request → first successful origin OpenAPI response. This is a **measured upper bound**, including service startup/polling, not an invented exact outage duration. Post-switch route bodies/headers and each request's UTC/exit/status are in `http.tsv`.

`bash docs/deploy/d1LV/rollback.sh` rewrites only our gateway override to absolute0dd release and `UI_ORIGIN18132`, reloads and restarts gateway once. Legacy web never stopped. It validates old origin then disables/stops only the newly introduced API/web; their unit sources/releases/evidence stay on disk. F1 worker override remains enabled to safely drain already-enqueued userId/private image jobs. No table/data rollback or current change occurs.

## Verification scope

`tools/sm-simple-deploy.test.mjs` uses tiny fresh private files and command mocks only; it never binds ports, calls network/DB, or manages real services. It covers successful sequencing/static preservation/persistence configuration, six independent HTTP failure points, curl timeout, gateway restart failure, prewarm failure, and gate failures. Temporary fixtures are retained. Pre-cutover cleanup errors are reported as failed/unconfirmed with exit2; a partly failed worker stop still attempts recovery.

Independent source review and syntax checks are recorded in the new admission packet. Actual deployment/readiness/downtime/reboot behavior remain unexecuted until babysit admission. Prior54 same-artifact privacy/cache tests, original native smoke and012 actual main-page review remain applicable; none of these prove full65-route UI completion or GA receipt.


## Warm revision after aborted prepared release

The failed first attempt retained its001 release, backup and disabled API/web unit files. The002 namespace revision uses a new exclusive release/backup; it compares retained units to Git commit b448432b before backing them up and installing updated002 WorkingDirectory versions. Existing private API drop-in directory is reused with mkdir -p and backed up first. No001 release/backup is overwritten or deleted. Deploy and rollback logs use new002 filenames. The exact namespace diff/checksums must be admitted before execution; no additional diagnostic, capture or build is required. This remains source/mock evidence, not a deployment or warm-readiness pass.
