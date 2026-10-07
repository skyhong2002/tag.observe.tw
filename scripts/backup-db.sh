#!/usr/bin/env bash
# Logical backup, full isolated restore, then checksum-verified NAS publication.
set -euo pipefail
umask 077
project=/home/deck/Projects/tag.analysis.tw
tool_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
set -a
. "$project/infra/.env"
set +a
exec python3 "$tool_root/tools/nearline/backup-site.py" --trim-docker-data --reclaim-verified-on-pressure
