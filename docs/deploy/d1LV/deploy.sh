#!/usr/bin/env bash
set -euo pipefail
umask 077
# Proposal only: run after babysit admits exact commit/hash and the fresh probe.
control=/home/deck/Projects/tag-sm-f1-release
source_root=/home/deck/tag-analysis-private/f1-release/deployable-d1LV-cache-free-001
release=/home/deck/.local/share/tag-analysis/releases/aff5c0289c4863fedb37368b4942884ccc068d77-d1LVsC3sk6p04uOyWUx5T
backup=/home/deck/tag-analysis-private/f1-release/deploy-backup-d1LV-001
old=/home/deck/.local/share/tag-analysis/releases/0dd38b629621e27ccb40260a27b27cf2d7202519
exec 9<>/home/deck/.local/share/tag-analysis/deploy.lock
flock -n 9
# Operator must have just recorded median3 gate, load<12 and >=40GiB.
# BLOCKED until the routing owner admits this local NAT transaction and makes
# this exact command available. Check before any copy or service mutation.
sudo -n /usr/bin/nft --check -f "$control/docs/deploy/d1LV/switch.nft"
test "$(readlink -f /home/deck/.local/share/tag-analysis/current)" = "$old"
test "$(cat "$source_root/COMMIT")" = aff5c0289c4863fedb37368b4942884ccc068d77
test "$(cat "$source_root/web/.next/BUILD_ID")" = d1LVsC3sk6p04uOyWUx5T
test ! -e "$release"
test ! -e "$backup"
mkdir -m 700 "$backup"
cp --archive /home/deck/.config/systemd/user/tag-analysis.service /home/deck/.config/systemd/user/tag-web.service /home/deck/.config/systemd/user/tag-worker.service "$backup/"
cp --archive /home/deck/.config/systemd/user/tag-analysis.service.d "$backup/"
readlink /home/deck/.local/share/tag-analysis/current > "$backup/current-target.txt"
systemctl --user is-enabled tag-backup.timer > "$backup/backup-timer-status.txt" || true
mkdir -m 700 "$release"
nice -n 19 ionice -c3 rsync --archive --no-owner --no-group "$source_root/" "$release/"
# Retain immutable URLs referenced by already cached old HTML; never overwrite new files.
nice -n 19 ionice -c3 rsync --archive --ignore-existing --no-owner --no-group "$old/web/.next/standalone/web/.next/static/" "$release/web/.next/standalone/web/.next/static/"
install -m 644 "$control/docs/deploy/d1LV/tag-f1-web-d1lv.service" "$control/docs/deploy/d1LV/tag-f1-api-d1lv.service" "$control/docs/deploy/d1LV/tag-f1-worker-d1lv.service" /home/deck/.config/systemd/user/
mkdir -m 700 /home/deck/.config/systemd/user/tag-f1-api-d1lv.service.d
cp --archive /home/deck/.config/systemd/user/tag-analysis.service.d/. /home/deck/.config/systemd/user/tag-f1-api-d1lv.service.d/
systemctl --user daemon-reload
systemctl --user start tag-f1-api-d1lv.service tag-f1-web-d1lv.service
# A bounded startup allowance, followed by real HTTP verification below.
sleep 2
# These are private production-data prewarm requests; no fixture origin or GA execution.
curl --fail --silent --show-error --max-time 20 -H 'DNT: 1' http://127.0.0.1:18230/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations > "$backup/new-relations.json"
curl --fail --silent --show-error --max-time 20 -H 'DNT: 1' http://127.0.0.1:18230/ > "$backup/new-home.html"
curl --fail --silent --show-error --max-time 20 -H 'DNT: 1' http://127.0.0.1:18230/tag/%E6%9F%AF%E6%96%87%E5%93%B2/ > "$backup/new-tag.html"
# Stop old consumers before exposing reader uploads; old gateway/web stay up.
systemctl --user stop tag-worker.service
systemctl --user start tag-f1-worker-d1lv.service
systemctl --user is-active --quiet tag-f1-api-d1lv.service tag-f1-web-d1lv.service tag-f1-worker-d1lv.service
# PRIVILEGED ROUTING OWNER: check transaction syntax and exclusive table first.
# This agent currently cannot sudo without a password. No routing mutation has run.
sudo -n /usr/bin/nft --check -f "$control/docs/deploy/d1LV/switch.nft"
sudo -n /usr/bin/nft -f "$control/docs/deploy/d1LV/switch.nft"
# Old current symlink and old gateway/web remain intact for immediate rollback.
# No timer enable/restart, migration, data deletion, npm, Next build, or Cloudflare change.
# This is a provisional runtime-routing proposal. It is not reboot-persistent;
# do not call deployment complete until the routing owner resolves that point.
