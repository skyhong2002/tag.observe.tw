#!/usr/bin/env bash
set -euo pipefail
umask 077
backup=${1:?pass deployment backup directory}
units=/home/deck/.config/systemd/user
# Restore only the gateway override saved before this deployment. The accepted
# d1LV API/web and F1 worker were never stopped or changed.
test -f "$backup/zz-f1-d1lv.conf"
cp --archive "$backup/zz-f1-d1lv.conf" "$units/tag-analysis.service.d/zz-f1-d1lv.conf"
systemctl --user daemon-reload
systemctl --user restart tag-analysis.service
systemctl --user disable --now tag-ranking-pool-api.service tag-ranking-pool-web.service
printf '%s\n' "$(date -u +%FT%T.%NZ)" >> "$backup/rollback.utc"
