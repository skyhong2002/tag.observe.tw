# d1LV002 namespace revision — awaiting babysit diff admission

Same APP aff5c0289c4863fedb37368b4942884ccc068d77 / BUILD_ID d1LVsC3sk6p04uOyWUx5T, same immutable cache-free source. No build/capture/probe/service mutation is performed to prepare this revision.

Minimal changes from b448432b:

- Deployment release and backup change from-simple-001 to-simple-002; both exclusive path tests remain. Rollback receipts use the002 backup.
- Gateway/worker overrides and private API/web unit WorkingDirectory point to002. Ports, environment, worker/cutover order, warm120/ready2/public20 timing and rollback behavior do not change.
- Existing private API/web units must cmp equal the **previously admitted b448432b Git versions** before continuing. Comparing them directly to updated002 units would necessarily fail: installed originals point to001. The Git-to-cmp pipeline runs under the existing `set -Eeuo pipefail`, so failure before or after emitting matching bytes is refused. Git failure or any unexpected retained content refuses before creating backup/copying/changing services. After this check, both original units and any drop-ins are copied into002 backup before updated units are installed. No unit file is deleted.
- Existing private API drop-in directory uses mkdir -p. Its originals are backed up; nearline/vocabulary settings are preserved.
- All001 releases/backups/evidence remain. Logs use new002 filenames and noclobber. No source artifact is changed; the new copy gets its own inventory after old static assets are merged.

Only this revised diff and its new file hashes are being handed off for approval. No deploy is attempted before that approval. On admission, the same deploy command is used with a new002 log; the script records a fresh median3 gate before copying, before worker switch and before gateway cutover. No external acceptance timeout is relaxed.

Source mocks cover accepted retained001 units (saved original bytes, updated002 units, old release/backup preserved) and rejected unexpected content (no copy/backup/service change). Existing failure/rollback/privacy boundaries remain covered by previous evidence; these are source mocks, not production verification.

Inference boundary remains unchanged: the original20s timeout was not reproduced;9 internal500s happened in the same cold fan-out batch, but no causal relationship or exact root cause is established. Admission is based on actual warm endpoints all returning200 and a complete homepage<=2s, not a claimed diagnosis. Public six GETs still use20s and roll back on failure.

Independent existing non-author GPT-6.1 Sol reviewer: source/mock r2PASS, personally23/23 mocks and Bash syntax. Reports `/home/deck/tag-analysis-private/f1-release/simple-deploy-002-independent-r2-20261014.{json,txt}`, SHA256 `ec1a878c39f10b48c56ef255d6fcd5eccaf0e48dccb06aa517bd829bf94d1cb8`. Initial process-substitution ISSUES retained; the revised Git-to-cmp pipeline uses existing pipefail and adds both Git failure regressions. This is not deployment or UI acceptance.
