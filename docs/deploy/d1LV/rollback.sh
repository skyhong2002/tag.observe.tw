#!/usr/bin/env bash
set -euo pipefail
umask 077
# May also be called by deploy.sh while its deployment lock is already held.
units=/home/deck/.config/systemd/user
backup=/home/deck/tag-analysis-private/f1-release/deploy-backup-d1LV-simple-001
old=/home/deck/.local/share/tag-analysis/releases/0dd38b629621e27ccb40260a27b27cf2d7202519
systemctl --user is-active --quiet tag-web.service
[[ $(readlink -f /home/deck/.local/share/tag-analysis/current) == "$old" ]]
# Replacing only our own override restores the original release/origin;
# existing nearline/vocabulary drop-ins are left intact. All releases, unit
# source files, backups and data are retained.
cat > "$units/tag-analysis.service.d/zz-f1-d1lv.conf" <<'UNIT'
[Service]
WorkingDirectory=/home/deck/.local/share/tag-analysis/releases/0dd38b629621e27ccb40260a27b27cf2d7202519
ExecStart=
ExecStart=/usr/bin/env PORT=18130 UI_ORIGIN=http://127.0.0.1:18132 /home/deck/.local/bin/node app/src/server.js
UNIT
systemctl --user daemon-reload
printf '%s\n' "$(date -u +%FT%T.%NZ)" >> "$backup/rollback-started.utc"
systemctl --user restart tag-analysis.service
# Only connection refusal during the intentionally accepted restart is retried.
for attempt in {1..40}; do
  rc=0
  status=$(curl --silent --show-error --max-time 1 -H 'DNT: 1' -o /dev/null \
    -w '%{http_code}' http://127.0.0.1:18130/api/v1/openapi.json) || rc=$?
  if [[ $rc == 0 && $status == 200 ]]; then break; fi
  [[ $rc == 7 && $status == 000 && $attempt != 40 ]] || exit 2
  sleep 0.25
done
status=$(curl --silent --show-error --max-time 20 -H 'DNT: 1' -D "$backup/rollback-home.headers" \
  -o "$backup/rollback-home.body" -w '%{http_code}' http://127.0.0.1:18130/)
[[ $status == 200 ]]
printf '%s\n' "$(date -u +%FT%T.%NZ)" >> "$backup/rollback-ready.utc"
# New API/web are no longer the public origin; the old web was never stopped.
systemctl --user disable --now tag-f1-web-d1lv.service tag-f1-api-d1lv.service
# Keep the existing enabled F1 worker override to drain private image jobs.
# No schema rollback, backup timer changes, current change, or deletion.
