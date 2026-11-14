#!/usr/bin/env bash
# web.sh build WEB_DIR | start WEB_DIR | stop
# Build or start one checkout's web/ against the snapshot API on :18560 with
# the snapshot clock. Run `gate.sh build` / `gate.sh capture` first, as its
# own step; this script does not wait for the host.
#   SNAPSHOT_T0   the snapshot's time (ISO); the server starts at T0, a build
#                 30 minutes earlier so its prerendered pages count as stale
#   NEXT_PORT     default 18562
#   TAG_HC_ROOT   work folder (default ~/.cache/tag-hc; /tmp is a RAM tmpfs on
#                 skyhong-SM), server logs under logs/
set -eu
cmd=$1
port=${NEXT_PORT:-18562}
tools=$(cd "$(dirname "$0")" && pwd)
t0=${SNAPSHOT_T0:?SNAPSHOT_T0}
own_pids() { ss -ltnpH "sport = :$port" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u; }
stop() {
  for pid in $(own_pids); do kill "$pid"; done
  while ss -ltnH "sport = :$port" | grep -q .; do sleep 0.3; done
}
case $cmd in
  build)
    dir=$2
    build_now=$(date -u -d "$t0 - 30 minutes" +%FT%TZ)
    cd "$dir"
    rm -rf .next
    TAG_API_ORIGIN=http://127.0.0.1:18560 NEXT_TELEMETRY_DISABLED=1 FAKE_NOW=$build_now \
      NODE_OPTIONS="--require $tools/fake-now.cjs" nice -n 19 ionice -c3 node_modules/.bin/next build
    ;;
  start)
    dir=$2
    stop
    rm -rf "$dir/.next/cache/fetch-cache"
    cd "$dir"
    mkdir -p "${TAG_HC_ROOT:-$HOME/.cache/tag-hc}/logs"
    (TAG_API_ORIGIN=http://127.0.0.1:18560 NEXT_TELEMETRY_DISABLED=1 FAKE_NOW=$t0 \
      NODE_OPTIONS="--require $tools/fake-now.cjs" setsid nohup nice -n 10 node_modules/.bin/next start -H 127.0.0.1 -p "$port" \
      >> "${WEB_LOG:-${TAG_HC_ROOT:-$HOME/.cache/tag-hc}/logs/next-$port.log}" 2>&1 &)
    until curl -s -o /dev/null "http://127.0.0.1:$port/icon.svg"; do sleep 0.3; done
    ;;
  stop) stop ;;
esac
