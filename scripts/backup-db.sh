#!/usr/bin/env bash
# Daily logical backup of the new site's MariaDB (issue #13). Keeps 14 days.
set -euo pipefail
umask 077
project=/home/deck/Projects/tag.analysis.tw
dest=/home/deck/tag-analysis-private/backups
mkdir -p "$dest"
set -a; . "$project/infra/.env"; set +a
stamp=$(date +%Y%m%d-%H%M%S)
file="$dest/tag_observe-$stamp.sql.zst"
/home/deck/.local/bin/docker exec tag-db mariadb-dump -utag_observe -p"$TAG_DB_PASSWORD" --single-transaction --quick --routines --events tag_observe | zstd -T0 -q -o "$file"
size=$(stat -c %s "$file")
[[ "$size" -gt 100000 ]] || { echo "backup too small: $size bytes" >&2; exit 1; }
# Restore drill: load into a throwaway container and count tables.
/home/deck/.local/bin/docker run --rm -i --name tag-db-restore-check -e MARIADB_ROOT_PASSWORD=x -e MARIADB_DATABASE=check mariadb:11.4 bash -c 'docker-entrypoint.sh mariadbd >/dev/null 2>&1 & for i in $(seq 1 60); do mariadb -uroot -px -e "select 1" >/dev/null 2>&1 && break; sleep 1; done; zstd -d -c - | mariadb -uroot -px check && mariadb -uroot -px -N -e "select count(*) from information_schema.tables where table_schema=\"check\""' < "$file" > "$dest/last-restore-check.txt" 2>&1 || true
find "$dest" -name 'tag_observe-*.sql.zst' -mtime +14 -delete
echo "backup $file ($size bytes); restore-check: $(tail -n 1 "$dest/last-restore-check.txt")"
