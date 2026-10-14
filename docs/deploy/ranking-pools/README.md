# Backend-only windowed pool release

Base remote main: a89908a650c42a1224d657e6c908d5fd3c7be5a0; continues the accepted F1 branch. No migration, new DB account or production env edit. Copy the accepted F1 release to a new directory (~0.81GiB), overlay committed app/src, preserve the same frontend BUILD_ID d1LVsC3sk6p04uOyWUx5T. Retain old d1LV API/web/worker and every release/backup.

After three-homepage200/no-other-build inspection, run:

```sh
bash docs/deploy/ranking-pools/deploy.sh "$(git rev-parse HEAD)" "$(date -u +%Y%m%dT%H%M%SZ)"
```

New loopback API18330/web18332 warm serially. Complete today/week manifest/page/checksum checks precede gateway restart and repeat through public HTTPS afterward. Existing credential/error no-store hooks are unchanged; formal header checks follow. Public acceptance failure restores the saved gateway override immediately. Only gateway changes; accepted F1 worker remains on its release.

Rollback (substitute the actual private backup directory reported by deploy):

```sh
bash docs/deploy/ranking-pools/rollback.sh /home/deck/tag-analysis-private/f1-release/ranking-pools-deploy-<UTC-stamp>
```

This restores accepted F1 backend aff5c028/d1LV with UI origin18232, restarts gateway once, stops only the new pool API/web and preserves their units/artifacts. It does not switch back to pre-F1 0dd38b6, change current, touch backup timer or delete files.

Source checks: 58/58 relevant tests; backend typecheck; bash syntax; concentrated independent Sol source/mock PASS, receipt `/home/deck/tag-analysis-private/f1-release/ranking-pools-independent-final-20261014.json` SHA25622d2c4a1bf93604745ac21d7ceae02133a9adb5f0bd9e8741787f4c5be9e3673. These are not formal runtime evidence. Completion receipt records live SHA, snapshot IDs/checksums and media-stats query timings after execution.

PrivateAPI/gateway set the fixed shared media-stats origin18230 during rollout; the accepted F1 API remains the public statistics producer. This avoids duplicate historical scans and preserves its existing data/cache semantics. Source/privacy review and timing limits are in ranking-pools-media-stats-cold-20261014.md. Existing inactive units from a failed attempt are backed up before replacement; no aborted artifact is overwritten.
