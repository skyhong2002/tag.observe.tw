#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
control=/home/deck/Projects/tag-sm-f1-release
old=/home/deck/.local/share/tag-analysis/releases/aff5c0289c4863fedb37368b4942884ccc068d77-d1LVsC3sk6p04uOyWUx5T-simple-002
sha=${1:?exact source commit}
stamp=${2:?unique UTC stamp}
release=/home/deck/.local/share/tag-analysis/releases/$sha-ranking-pools-$stamp
backup=/home/deck/tag-analysis-private/f1-release/ranking-pools-deploy-$stamp
units=/home/deck/.config/systemd/user
[[ $sha =~ ^[a-f0-9]{40}$ && $stamp =~ ^[0-9]{8}T[0-9]{6}Z$ ]]
[[ $(git -C "$control" rev-parse HEAD) == "$sha" ]]
test -z "$(git -C "$control" status --porcelain)"
test ! -e "$release"; test ! -e "$backup"
for name in tag-ranking-pool-api tag-ranking-pool-web; do
 [[ $(systemctl --user show "$name.service" -p MainPID --value 2>/dev/null || printf 0) == 0 ]]
done
[[ $(systemctl --user show tag-analysis.service -p WorkingDirectory --value) == "$old" ]]
# This copies ~0.81GiB, no build/npm/migration. Preserve every previous directory.
[[ $(df --output=avail -B1 /home | tail -1) -ge $((40*1024**3)) ]]
exec 9<>/home/deck/.local/share/tag-analysis/deploy.lock
flock -n 9
mkdir -m 700 "$backup"
cp --archive "$units/tag-analysis.service" "$backup/"
cp --archive "$units/tag-analysis.service.d/zz-f1-d1lv.conf" "$backup/"
cp --archive "$units/tag-analysis.service.d" "$backup/"
for name in tag-ranking-pool-api tag-ranking-pool-web; do
 if [[ -f "$units/$name.service" ]]; then cp --archive "$units/$name.service" "$backup/"; fi
 if [[ -d "$units/$name.service.d" ]]; then cp --archive "$units/$name.service.d" "$backup/"; fi
done
readlink /home/deck/.local/share/tag-analysis/current > "$backup/current-target.txt"
cutover=0; started=0
cleanup() {
 local rc=$?
 trap - ERR
 if ((cutover)); then bash "$control/docs/deploy/ranking-pools/rollback.sh" "$backup" || exit 2
 elif ((started)); then systemctl --user disable --now tag-ranking-pool-api.service tag-ranking-pool-web.service || exit 2
 fi
 exit "$rc"
}
trap cleanup ERR
# Three homepages must return200 immediately before creating the new release.
for url in https://tag.observe.tw/ https://blog.observe.tw/ https://youtube.observe.tw/; do
 status=$(curl -sS --max-time 20 -H 'DNT: 1' -o /dev/null -w '%{http_code}' "$url")
 [[ $status == 200 ]]
done
! ps -eo args | awk '/[n]ext build|[d]ocker build|[b]uildx build/ && !/awk/ { found=1 } END { exit !found }'
cp --archive "$old" "$release"
git -C "$control" archive "$sha" app/src | tar -x -C "$release"
printf '%s\n' "$sha" > "$release/COMMIT"
printf '%s\n' aff5c0289c4863fedb37368b4942884ccc068d77 > "$release/WEB_COMMIT"
[[ $(cat "$release/web/.next/BUILD_ID") == d1LVsC3sk6p04uOyWUx5T ]]
cat > "$units/tag-ranking-pool-api.service" <<UNIT
[Unit]
Description=tag window ranking pool loopback API
After=network-online.target
[Service]
Type=simple
WorkingDirectory=$release
ExecStart=/usr/bin/env PORT=18330 UI_ORIGIN=http://127.0.0.1:18332 /home/deck/.local/bin/node app/src/server.js
Environment=NODE_ENV=production
EnvironmentFile=/home/deck/Projects/tag.analysis.tw/.env
Environment=UV_THREADPOOL_SIZE=2
Environment=VIPS_CONCURRENCY=1
Environment=TAG_MEDIA_STATS_SHARED_ORIGIN=http://127.0.0.1:18230
Restart=always
RestartSec=3
PrivateTmp=yes
NoNewPrivileges=yes
[Install]
WantedBy=default.target
UNIT
# Copy Environment-only drop-ins, preserving existing ones and their backup.
mkdir -p "$units/tag-ranking-pool-api.service.d"
for file in "$units/tag-analysis.service.d/"*.conf; do
 [[ $(basename "$file") != zz-f1-d1lv.conf ]] || continue
 cp --archive "$file" "$units/tag-ranking-pool-api.service.d/"
done
cat > "$units/tag-ranking-pool-web.service" <<UNIT
[Unit]
Description=tag retained d1LV frontend with window-pool API
After=network-online.target tag-ranking-pool-api.service
Wants=tag-ranking-pool-api.service
[Service]
Type=simple
WorkingDirectory=$release/web/.next/standalone/web
ExecStart=/home/deck/.local/bin/node server.js
Environment=NODE_ENV=production
Environment=PORT=18332
Environment=HOSTNAME=127.0.0.1
Environment=TAG_API_ORIGIN=http://127.0.0.1:18330
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=UV_THREADPOOL_SIZE=2
Environment=VIPS_CONCURRENCY=1
Restart=always
RestartSec=3
PrivateTmp=yes
NoNewPrivileges=yes
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
started=1
systemctl --user enable --now tag-ranking-pool-api.service tag-ranking-pool-web.service
for attempt in {1..40}; do
 rc=0; status=$(curl -sS --max-time 1 -H 'DNT: 1' -o /dev/null -w '%{http_code}' http://127.0.0.1:18330/api/v1/openapi.json) || rc=$?
 if [[ $rc == 0 && $status == 200 ]]; then break; fi
 [[ $rc == 7 && $attempt != 40 ]]; sleep .25
done
get() {
 local name=$1 url=$2 timeout=${3:-20} code
 code=$(curl -sS --max-time "$timeout" -H 'DNT: 1' -D "$backup/$name.headers" -o "$backup/$name.body" -w '%{http_code}\t%{time_total}' "$url")
 printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%T.%NZ)" "$name" "$code" "$url" >> "$backup/http.tsv"
 [[ ${code%%$'\t'*} == 200 ]]
}
# Serial cold warm-up. Private endpoints only get the120s allowance.
paths=(
'/api/v1/media' '/api/v1/media-stats' '/api/v1/events?limit=24' '/api/v1/events?limit=30'
'/api/v1/events/threads' '/api/v1/topics?limit=120&kind=topic'
'/api/v1/journalists?hours=48&threshold=0.65&limit=6' '/api/v1/similarity?hours=24&threshold=0.65'
'/api/v1/ranking?category=news&order=score&limit=16&trend=1'
'/api/v1/ranking?category=blue&order=score&limit=1' '/api/v1/ranking?category=green&order=score&limit=1'
'/api/v1/ranking?category=all&order=growth&limit=500&gate=all'
'/api/v1/ranking?category=all&order=score&limit=500&gate=all'
'/api/v1/tag-avatars' '/api/v1/tag-visuals' '/api/v1/site-observation?days=7'
)
for i in "${!paths[@]}"; do get "warm-api-$i" "http://127.0.0.1:18330${paths[$i]}" 120; done
get warm-metrics http://127.0.0.1:18330/metrics
get warm-home http://127.0.0.1:18332/ 120
get warm-tag http://127.0.0.1:18332/tag/%E6%9F%AF%E6%96%87%E5%93%B2/ 120
get warm-relations http://127.0.0.1:18330/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations 120
get warm-home-ready http://127.0.0.1:18332/ 2
# Verify the newly registered API without cold simultaneous generation.
get new-schema http://127.0.0.1:18330/api/v1/openapi.json
node --input-type=module - "$backup/new-schema.body" <<'JS'
import fs from 'node:fs';const spec=JSON.parse(fs.readFileSync(process.argv[2]));
if(!spec.paths['/api/v1/ranking-pools'])throw Error('new API absent');
JS
cutoff=$(date -u +%FT%T.000Z)
printf '%s\n' "$cutoff" > "$backup/cutoff.txt"
/home/deck/.local/bin/node "$control/tools/verify-ranking-pools.ts" http://127.0.0.1:18330 "$backup/prepared-pools" "$cutoff"
# Both old d1LV API/web and the F1 worker remain running for instant rollback.
cutover=1
cat > "$units/tag-analysis.service.d/zz-f1-d1lv.conf" <<UNIT
[Unit]
Wants=tag-ranking-pool-api.service tag-ranking-pool-web.service
After=tag-ranking-pool-api.service tag-ranking-pool-web.service
[Service]
WorkingDirectory=$release
ExecStart=
ExecStart=/usr/bin/env PORT=18130 UI_ORIGIN=http://127.0.0.1:18332 TAG_MEDIA_STATS_SHARED_ORIGIN=http://127.0.0.1:18230 /home/deck/.local/bin/node app/src/server.js
UNIT
systemctl --user daemon-reload
date -u +%FT%T.%NZ > "$backup/switch-start.utc"
systemctl --user restart tag-analysis.service
for attempt in {1..40}; do
 rc=0; status=$(curl -sS --max-time 1 -H 'DNT: 1' -o /dev/null -w '%{http_code}' http://127.0.0.1:18130/api/v1/openapi.json) || rc=$?
 if [[ $rc == 0 && $status == 200 ]]; then break; fi
 [[ $rc == 7 && $attempt != 40 ]]; sleep .25
done
date -u +%FT%T.%NZ > "$backup/switch-ready.utc"
for origin in origin public; do
 base=http://127.0.0.1:18130; [[ $origin != public ]] || base=https://tag.observe.tw
 get "$origin-home" "$base/"
 get "$origin-tag" "$base/tag/%E6%9F%AF%E6%96%87%E5%93%B2/"
 get "$origin-relations" "$base/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations"
done
systemctl --user show tag-analysis.service tag-ranking-pool-api.service tag-ranking-pool-web.service tag-worker.service -p Id -p MainPID -p WorkingDirectory -p ActiveState > "$backup/deployed-units.txt"
printf '%s\n' "$release" > "$backup/release.txt"
# The public reader must see the same complete private generations/checksums.
/home/deck/.local/bin/node "$control/tools/verify-ranking-pools.ts" https://tag.observe.tw "$backup/public-pools" "$cutoff"
node --input-type=module - "$backup" <<'JS'
import fs from 'node:fs';
const base=process.argv[2], a=JSON.parse(fs.readFileSync(base+'/prepared-pools/summary.json')), b=JSON.parse(fs.readFileSync(base+'/public-pools/summary.json'));
if(a.reports.some((r,i)=>r.snapshotId!==b.reports[i].snapshotId||r.checksum!==b.reports[i].checksum))throw Error('public generation differs');
JS
cutover=0; trap - ERR
printf 'DEPLOYED backend=%s web=d1LVsC3sk6p04uOyWUx5T backup=%s\n' "$sha" "$backup"
