#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
control=/home/deck/Projects/tag-sm-f1-release
sha=dc7b814e220606202a408d21e73b1d6e7c61fe16
release=/home/deck/.local/share/tag-analysis/releases/$sha-ranking-pools-20261014T153930Z
backup=/home/deck/tag-analysis-private/f1-release/ranking-pools-deploy-20261014T153930Z-resume-001
units=/home/deck/.config/systemd/user
old=/home/deck/.local/share/tag-analysis/releases/aff5c0289c4863fedb37368b4942884ccc068d77-d1LVsC3sk6p04uOyWUx5T-simple-002
[[ $(cat "$release/COMMIT") == "$sha" ]]
[[ $(cat "$release/web/.next/BUILD_ID") == d1LVsC3sk6p04uOyWUx5T ]]
[[ $(systemctl --user show tag-analysis.service -p WorkingDirectory --value) == "$old" ]]
[[ $(systemctl --user show tag-ranking-pool-api.service -p WorkingDirectory --value) == "$release" ]]
[[ $(systemctl --user show tag-ranking-pool-web.service -p WorkingDirectory --value) == "$release/web/.next/standalone/web" ]]
test ! -e "$backup"
exec 9<>/home/deck/.local/share/tag-analysis/deploy.lock
flock -n 9
mkdir -m 700 "$backup"
cp --archive "$units/tag-analysis.service.d/zz-f1-d1lv.conf" "$backup/"
cp --archive "$units/tag-analysis.service.d" "$backup/"
readlink /home/deck/.local/share/tag-analysis/current > "$backup/current-target.txt"
cutover=0; started=0
cleanup() {
 local rc=$?; trap - ERR
 if ((cutover)); then bash "$control/docs/deploy/ranking-pools/rollback.sh" "$backup" || exit 2
 elif ((started)); then systemctl --user disable --now tag-ranking-pool-api.service tag-ranking-pool-web.service || exit 2
 fi
 exit "$rc"
}
trap cleanup ERR
for url in https://tag.observe.tw/ https://weblog.tw/ https://youtube.observe.tw/; do
 [[ $(curl -sS --max-time 20 -H 'DNT: 1' -o /dev/null -w '%{http_code}' "$url") == 200 ]]
done
! ps -eo args | awk '/[n]ext build|[d]ocker build|[b]uildx build/ && !/awk/ { found=1 } END { exit !found }'
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
# Prime the retained producer first; its cold query may exceed the relay20s
# budget. This single private warm-up waits120s; no second DB scan is made.
get shared-producer-ready http://127.0.0.1:18230/api/v1/media-stats 120
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
