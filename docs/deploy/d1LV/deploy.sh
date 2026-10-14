#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
# Execute only after babysit admits the exact files/commit and a fresh probe.
control=/home/deck/Projects/tag-sm-f1-release
source_root=/home/deck/tag-analysis-private/f1-release/deployable-d1LV-cache-free-001
release=/home/deck/.local/share/tag-analysis/releases/aff5c0289c4863fedb37368b4942884ccc068d77-d1LVsC3sk6p04uOyWUx5T-simple-001
backup=/home/deck/tag-analysis-private/f1-release/deploy-backup-d1LV-simple-001
old=/home/deck/.local/share/tag-analysis/releases/0dd38b629621e27ccb40260a27b27cf2d7202519
units=/home/deck/.config/systemd/user
gateway_override=$units/tag-analysis.service.d/zz-f1-d1lv.conf
worker_override=$units/tag-worker.service.d/zz-f1-d1lv.conf
exec 9<>/home/deck/.local/share/tag-analysis/deploy.lock
flock -n 9
cutover=0
private_services=0
worker_stopped=0

on_error() {
  local rc=$? cleanup_failed=0
  trap - ERR
  if (( cutover )); then
    /usr/bin/bash "$control/docs/deploy/d1LV/rollback.sh" || {
      printf 'ROLLBACK FAILED; retain evidence and notify babysit immediately.\n' >&2
      exit 2
    }
  elif (( private_services )); then
    if (( worker_stopped )); then
      if ! systemctl --user start tag-worker.service; then
        printf 'Worker recovery failed/unconfirmed; notify babysit.\n' >&2
        cleanup_failed=1
      fi
    fi
    if ! systemctl --user disable --now tag-f1-web-d1lv.service tag-f1-api-d1lv.service; then
      printf 'Private API/web cleanup failed/unconfirmed; notify babysit.\n' >&2
      cleanup_failed=1
    fi
    if (( cleanup_failed )); then exit 2; fi
  fi
  exit "$rc"
}
trap on_error ERR

get_200() {
  local name=$1 url=$2 status rc=0 started ended
  started=$(date -u +%FT%T.%NZ)
  status=$(curl --silent --show-error --max-time 20 -H 'DNT: 1' \
    -D "$backup/$name.headers" -o "$backup/$name.body" -w '%{http_code}' "$url") || rc=$?
  ended=$(date -u +%FT%T.%NZ)
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$started" "$ended" "$rc" "$status" "$url" >> "$backup/http.tsv"
  [[ $rc == 0 && $status == 200 ]]
}

# Only ECONNREFUSED while a Type=simple service starts is retried. HTTP errors
# or other curl errors fail immediately; none of the six acceptance GETs retry.
wait_listening() {
  local port=$1 path=${2:-/api/v1/openapi.json} status rc attempt
  for attempt in {1..40}; do
    rc=0
    status=$(curl --silent --show-error --max-time 1 -H 'DNT: 1' -o /dev/null \
      -w '%{http_code}' "http://127.0.0.1:$port$path") || rc=$?
    if [[ $rc == 0 && $status == 200 ]]; then return 0; fi
    [[ $rc == 7 && $status == 000 ]] || return 1
    sleep 0.25
  done
  return 1
}

fresh_gate() {
  # Reuse the reviewed median3 probe; no lease, readiness executor or wrapper.
  nice -n 19 ionice -c3 /home/deck/.local/bin/node --input-type=module - "$1" <<'JS'
import fs from 'node:fs';
import {observeSM,requireGate} from '/home/deck/Projects/tag-sm-f1-release/tools/sm-f1/probe.mjs';
const prefix=process.argv[2],raw=[];
const sample=await observeSM(row=>raw.push(row));
fs.writeFileSync(prefix+'.raw.jsonl',raw.map(row=>JSON.stringify(row)).join('\n')+'\n',{flag:'wx',mode:0o600});
fs.writeFileSync(prefix+'.json',JSON.stringify(sample,null,2)+'\n',{flag:'wx',mode:0o600});
requireGate(sample,{starting:false});
// No new browser/build is added; retain the actual two-browser global cap.
if(prefix.endsWith('before-copy') && (sample.availableBytes<40*1024**3 || sample.memoryAvailableBytes<2.5*1024**3))
  throw Error('Deployment start requires >=40GiB disk and >=2.5GiB memory');
JS
}

test "$(readlink -f /home/deck/.local/share/tag-analysis/current)" = "$old"
test "$(cat "$source_root/COMMIT")" = aff5c0289c4863fedb37368b4942884ccc068d77
test "$(cat "$source_root/web/.next/BUILD_ID")" = d1LVsC3sk6p04uOyWUx5T
test ! -e "$release"
test ! -e "$backup"
test ! -e "$gateway_override"
test ! -e "$worker_override"
test ! -e "$units/tag-f1-api-d1lv.service"
test ! -e "$units/tag-f1-web-d1lv.service"
systemctl --user is-enabled --quiet tag-analysis.service
systemctl --user is-enabled --quiet tag-worker.service
# A rejected gate retains its raw receipt without creating a poisoned backup
# or touching release/service state; a later retry can use a new timestamp.
start_probe=/home/deck/tag-analysis-private/f1-release/deploy-d1LV-start-$(date +%s%N)-before-copy
fresh_gate "$start_probe"
mkdir -m 700 "$backup"
cp --archive "$units/tag-analysis.service" "$units/tag-web.service" "$units/tag-worker.service" "$backup/"
for name in tag-analysis tag-web tag-worker; do
  if [[ -d "$units/$name.service.d" ]]; then cp --archive "$units/$name.service.d" "$backup/"; fi
done
readlink /home/deck/.local/share/tag-analysis/current > "$backup/current-target.txt"
systemctl --user is-enabled tag-backup.timer > "$backup/backup-timer-status.txt" || true
cp --archive "$start_probe.json" "$backup/before-copy.json"
cp --archive "$start_probe.raw.jsonl" "$backup/before-copy.raw.jsonl"
mkdir -m 700 "$release"
nice -n 19 ionice -c3 rsync --archive --no-owner --no-group "$source_root/" "$release/"
# Old immutable asset URLs only, never old HTML/RSC/cache or replacement bytes.
nice -n 19 ionice -c3 rsync --archive --ignore-existing --no-owner --no-group \
  "$old/web/.next/standalone/web/.next/static/" "$release/web/.next/standalone/web/.next/static/"
install -m 644 "$control/docs/deploy/d1LV/tag-f1-web-d1lv.service" "$control/docs/deploy/d1LV/tag-f1-api-d1lv.service" "$units/"
mkdir -m 700 "$units/tag-f1-api-d1lv.service.d"
cp --archive "$units/tag-analysis.service.d/." "$units/tag-f1-api-d1lv.service.d/"
systemctl --user daemon-reload
private_services=1
systemctl --user enable --now tag-f1-api-d1lv.service tag-f1-web-d1lv.service
wait_listening 18230
wait_listening 18232 /favicon.ico
# Private warmup only. The public acceptance helper remains max-time 20.
warm_200() {
  local name=$1 url=$2 timeout=${3:-120} metrics status elapsed rc=0 started ended
  case "$url" in http://127.0.0.1:18230/*|http://127.0.0.1:18232/*) ;; *) return 1 ;; esac
  started=$(date -u +%FT%T.%NZ)
  metrics=$(curl --silent --show-error --max-time "$timeout" -H 'DNT: 1' \
    -D "$backup/$name.headers" -o "$backup/$name.body" -w '%{http_code}\t%{time_total}' "$url") || rc=$?
  IFS=$'\t' read -r status elapsed <<< "$metrics"
  ended=$(date -u +%FT%T.%NZ)
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$started" "$ended" "$rc" "$status" "$url" >> "$backup/http.tsv"
  printf '%s\t%s\t%s\n' "$name" "$elapsed" "$timeout" >> "$backup/warm-timings.tsv"
  [[ $rc == 0 && $status == 200 && "$elapsed" =~ ^[0-9]+([.][0-9]+)?$ ]] &&
    awk -v elapsed="$elapsed" -v timeout="$timeout" 'BEGIN { exit !(elapsed <= timeout) }'
}
# Serial requests prime the cold DB/cache without the homepage's fan-out.
# Check real HTTP status; a recoverable SSR panel failure is still a failed warmup.
warm_paths=(
  '/api/v1/media'
  '/api/v1/media-stats'
  '/api/v1/events?limit=24'
  '/api/v1/events?limit=30'
  '/api/v1/events/threads'
  '/api/v1/topics?limit=120&kind=topic'
  '/api/v1/journalists?hours=48&threshold=0.65&limit=6'
  '/api/v1/similarity?hours=24&threshold=0.65'
  '/api/v1/ranking?category=news&order=score&limit=16&trend=1'
  '/api/v1/ranking?category=blue&order=score&limit=1'
  '/api/v1/ranking?category=green&order=score&limit=1'
  '/api/v1/ranking?category=all&order=growth&limit=500&gate=all'
  '/api/v1/ranking?category=all&order=score&limit=500&gate=all'
  '/api/v1/tag-avatars'
  '/api/v1/tag-visuals'
  '/api/v1/site-observation?days=7'
)
for index in "${!warm_paths[@]}"; do
  warm_200 "warm-api-$index" "http://127.0.0.1:18230${warm_paths[$index]}"
done
warm_200 warm-home http://127.0.0.1:18232/
warm_200 warm-tag http://127.0.0.1:18232/tag/%E6%9F%AF%E6%96%87%E5%93%B2/
warm_200 warm-relations http://127.0.0.1:18230/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations
# Full HTML download (not just TTFB) must finish within two seconds.
warm_200 warm-home-ready http://127.0.0.1:18232/ 2
fresh_gate "$backup/before-worker"
# The existing enabled worker receives a persistent release override.
# Never expose new uploads to the old consumer.
worker_stopped=1
systemctl --user stop tag-worker.service
mkdir -p -m 700 "$units/tag-worker.service.d"
install -m 644 "$control/docs/deploy/d1LV/worker-d1lv.conf" "$worker_override"
systemctl --user daemon-reload
systemctl --user start tag-worker.service
systemctl --user is-active --quiet tag-worker.service
wait_listening 18133 /metrics
get_200 worker-metrics http://127.0.0.1:18133/metrics
fresh_gate "$backup/before-cutover"
# Persist the gateway's release and UI origin without changing current or old web.
cutover=1
install -m 644 "$control/docs/deploy/d1LV/gateway-d1lv.conf" "$gateway_override"
systemctl --user daemon-reload
restart_start_ns=$(date +%s%N)
printf '%s\n' "$(date -u +%FT%T.%NZ)" > "$backup/restart-started.utc"
systemctl --user restart tag-analysis.service
wait_listening 18130
restart_ready_ns=$(date +%s%N)
printf '%s\n' "$(date -u +%FT%T.%NZ)" > "$backup/restart-ready.utc"
printf '%s\n' "$((restart_ready_ns-restart_start_ns))" > "$backup/restart-to-first-200-upper-bound.ns"
# Immediate acceptance: no retry on any HTTP/curl failure. ERR runs rollback.
get_200 origin-home http://127.0.0.1:18130/
get_200 origin-tag http://127.0.0.1:18130/tag/%E6%9F%AF%E6%96%87%E5%93%B2/
get_200 origin-relations http://127.0.0.1:18130/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations
get_200 public-home https://tag.observe.tw/
get_200 public-tag https://tag.observe.tw/tag/%E6%9F%AF%E6%96%87%E5%93%B2/
get_200 public-relations https://tag.observe.tw/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations
systemctl --user show tag-analysis.service tag-f1-web-d1lv.service tag-f1-api-d1lv.service tag-worker.service \
  -p Id -p MainPID -p WorkingDirectory -p ActiveState > "$backup/deployed-units.txt"
# Record the final copy's bytes after old static assets were added; do not reuse
# the cache-free source hash as the deployed directory hash.
nice -n 19 ionice -c3 /home/deck/.local/bin/node --input-type=module - "$release" "$backup" <<'JS'
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {inventory} from '/home/deck/Projects/tag-sm-f1-release/tools/mint-f1-artifact.js';
const rows=inventory(process.argv[2]),canonical=JSON.stringify(rows);
fs.writeFileSync(process.argv[3]+'/deployed-inventory.json',canonical+'\n',{flag:'wx',mode:0o600});
fs.writeFileSync(process.argv[3]+'/deployed-inventory.sha256',createHash('sha256').update(canonical).digest('hex')+'\n',{flag:'wx',mode:0o600});
JS
cutover=0
trap - ERR
printf 'Gateway switched; old web retained. Await babysit production UI acceptance.\n'
