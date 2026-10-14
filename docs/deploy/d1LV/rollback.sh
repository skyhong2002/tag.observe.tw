#!/usr/bin/env bash
set -euo pipefail
# Exact application rollback: old gateway/web are still alive on their original ports.
# Only the named local origin-routing table is removed; no schema/data rollback.
sudo -n /usr/bin/nft delete table ip tag_f1_d1lv
systemctl --user is-active --quiet tag-analysis.service tag-web.service
# Close the new gateway's old keep-alive connections after returning new
# connections to the old origin. The old gateway and web remain running.
systemctl --user stop tag-f1-api-d1lv.service
# Keep the F1 worker for safely draining userId-bearing private image jobs.
# Do not restart the old image consumer while such jobs can remain.
# All new/old releases, backups, current symlink and new submission rows remain.
