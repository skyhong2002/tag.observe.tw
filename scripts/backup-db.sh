#!/usr/bin/env bash
# Logical backup, full isolated restore, then checksum-verified NAS publication.
set -euo pipefail
umask 077
project=/home/deck/Projects/tag.analysis.tw
set -a
. "$project/infra/.env"
set +a
exec python3 "$project/tools/nearline/backup-site.py"
