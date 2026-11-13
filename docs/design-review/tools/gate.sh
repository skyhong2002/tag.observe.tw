#!/usr/bin/env bash
# gate.sh build|capture — wait until the host may take this kind of work, then
# exit 0. It never starts the work itself: run the build or capture as a
# separate step afterwards (docs/unfreeze-gates-20261013.md, the shared rules
# for every site on this host).
#
#   load1 <= GATE_LOAD_OK on two checks 20 s apart (the stop line is
#            GATE_LOAD_STOP). Defaults: sky-server's shared rule 10/12 when
#            the host has 16+ cores, otherwise 0.75 x and 1 x the core count
#            (skyhong-SM, 12 cores: 9/12),
#   no other Next/Docker build running (at most one per host),
#   build: /home has >= 40 GiB free,
#   capture: fewer than two browser parents running (at most two per host,
#            ours included once it starts).
# Every check is logged with UTC time to stderr.
set -u
kind=${1:?build|capture}
cores=$(nproc)
if [ "$cores" -ge 16 ]; then ok_default=10; else ok_default=$(awk -v c="$cores" 'BEGIN{print c*0.75}'); fi
load_ok=${GATE_LOAD_OK:-$ok_default}
# Real build processes only (node running next build, docker build), not shells that mention one.
builds='^[^ ]*(node|docker)[^ ]* ([^ ]*/)?(next|next/dist/bin/next|buildx)? ?build( |$)'
browsers() {
  # Browser parents only: the main process of chrome/chromium/headless_shell, not its --type= children.
  pgrep -af 'chrom(e|ium)|headless_shell' | grep -v -- '--type=' | grep -E '/(chrome|chromium|chrome-headless-shell|headless_shell)( |$)' | grep -vc steam
}
ok=0
while :; do
  load=$(cut -d' ' -f1 /proc/loadavg)
  free=$(df -B1G --output=avail /home | tail -1 | tr -d ' ')
  nb=$(pgrep -fc -- "$builds" || true)
  nbr=$(browsers)
  pass=1
  awk -v l="$load" -v m="$load_ok" 'BEGIN{exit !(l <= m)}' || pass=0
  [ "$nb" -eq 0 ] || pass=0
  if [ "$kind" = build ]; then [ "$free" -ge 40 ] || pass=0; fi
  if [ "$kind" = capture ]; then [ "$nbr" -lt 2 ] || pass=0; fi
  echo "[gate $kind] $(date -u +%FT%TZ) load1=$load/$load_ok builds=$nb browsers=$nbr freeGiB=$free pass=$pass" >&2
  if [ $pass = 1 ]; then ok=$((ok + 1)); else ok=0; fi
  [ $ok -ge 2 ] && exit 0
  sleep 20
done
