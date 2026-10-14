# d1LV conditional origin switch proposal — not executed

Exact APP `aff5c0289c4863fedb37368b4942884ccc068d77`, BUILD_ID `d1LVsC3sk6p04uOyWUx5T`. These are ordinary shell/systemd proposal files, not a new executor or guard. Current public release is `0dd38b629621e27ccb40260a27b27cf2d7202519`.

Do not execute until babysit admits the exact files and a fresh median3 probe AND the existing routing owner supplies a reviewed, available, reboot-safe origin switch. `sudo -n nft` currently fails because it requires a password; no firewall/routing mutation or NFT dry-run has occurred. The proposed NFT file only redirects local origin connections; it does not change Cloudflare or filter public traffic. Its persistence and old keep-alive drain remain unresolved, so this is **not deployment ready**.

- `deploy.sh`: root routing preflight first, own deployment lock, new exclusive release/backup, preserve all old bytes; no build/install/migration; reuse existing environment file and gateway drop-ins without copying secrets into release. Start private new gateway/web and perform DNT1 GETs. Stop old worker before starting F1 worker. Only then propose an atomic local routing change.
- `rollback.sh`: propose removal of just the newly named table, verify old API/web remain alive and stop new gateway connections. Keep F1 worker to safely handle already-enqueued private image jobs. No table/data/release deletion.
- The runtime `current` pointer remains the old release in this provisional proposal; this is intentional rollback protection, **not** a claim that reboot runs the new release.
- Allocate at most 1 GiB for the new copy and retained old immutable static files. The source cache-free copy is approximately 0.803 GiB allocated; the old static directory is approximately 3.1 MiB. No stale generated page/cache data is copied from the old release.
- Run `bash -n deploy.sh rollback.sh` and `systemd-analyze --user verify ./*.service` offline. These checks passed; they do not prove privileged routing, production startup, or production data prewarm.

Migration is **not needed**: the production 0038 journal/schema was inspected read-only and matches this APP. No backup timer, restore, DDL/down, account/permission change, or removal of backups/worktrees is part of this proposal.

Full technical evidence and limitations: [handoff](../../f1-deployment-technical-handoff-20261014.md).
