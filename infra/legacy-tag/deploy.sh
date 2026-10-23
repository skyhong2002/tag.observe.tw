#!/usr/bin/env bash
# Install or roll back the search-engine guard on the legacy tag.analysis.tw host.
#   infra/legacy-tag/deploy.sh <observe-tags.txt>   install / refresh (idempotent)
#   infra/legacy-tag/deploy.sh --tags <file>         refresh the tag list only
#   infra/legacy-tag/deploy.sh --rollback            restore the original scripts
# Originals are copied once to ~/legacy-seo-backup/ on the host, outside the docroot.
set -euo pipefail
HOST=${LEGACY_HOST:-tag-analysis}
here=$(cd "$(dirname "$0")" && pwd)

# script:kind — every page script reachable from the Apache rewrites that the guard covers.
ENTRIES="index.php:home tag.php:tag tag_view.php:tag_sub tag_series.php:tag_sub tag_cloud.php:tag_sub
tag_hour.php:tag_sub tag_ai.php:tag_sub tag_fb.php:gone news_fb.php:gone news_media.php:page news.php:page
event.php:page hot_rank.php:page"

push_tags() {
  local list=$1
  [ "$(head -c1 "$list" | od -An -c | tr -d ' ')" = '\n' ] || { echo "tag list must start with a newline" >&2; exit 1; }
  [ "$(grep -c . "$list")" -ge 1000 ] || { echo "tag list too short" >&2; exit 1; }
  ssh "$HOST" 'mkdir -p /var/www/html/tag/include/seo && chmod 755 /var/www/html/tag/include/seo'
  scp -q "$list" "$HOST:/var/www/html/tag/include/seo/.observe-tags.txt.new"
  ssh "$HOST" 'chmod 644 /var/www/html/tag/include/seo/.observe-tags.txt.new && mv /var/www/html/tag/include/seo/.observe-tags.txt.new /var/www/html/tag/include/seo/observe-tags.txt'
  echo "tag list: $(grep -c . "$list") tags"
}

case "${1:-}" in
--rollback)
  ssh "$HOST" 'set -e; cd /var/www/html/tag; b=~/legacy-seo-backup
    for f in $(ls "$b"); do [ -f "$b/$f" ] || continue; cp -p "$b/$f" ".$f.restore" && mv ".$f.restore" "$f" && echo "restored $f"; done
    rm -f include/seo_guard.php'
  exit 0
  ;;
--tags)
  push_tags "$2"
  exit 0
  ;;
"") echo "usage: $0 <observe-tags.txt> | --tags <file> | --rollback" >&2; exit 2 ;;
esac

push_tags "$1"
scp -q "$here/seo_guard.php" "$HOST:/var/www/html/tag/include/.seo_guard.php.new"
ssh "$HOST" "ENTRIES='$ENTRIES' bash -s" <<'REMOTE'
set -euo pipefail
cd /var/www/html/tag
b=~/legacy-seo-backup
mkdir -p "$b" && chmod 700 "$b"
php -l include/.seo_guard.php.new >/dev/null
chmod 644 include/.seo_guard.php.new && mv include/.seo_guard.php.new include/seo_guard.php
marker='// tag.observe.tw infra/legacy-tag'
for e in $ENTRIES; do
  f=${e%%:*} kind=${e##*:}
  [ -f "$f" ] || { echo "skip $f (missing)"; continue; }
  [ -f "$b/$f" ] || cp -p "$f" "$b/$f"
  if grep -qF "$marker" "$f"; then echo "ok   $f"; continue; fi
  [ "$(head -1 "$f" | tr -d '\r')" = '<?php' ] || { echo "first line of $f is not <?php; not patched" >&2; exit 1; }
  { echo '<?php'; echo "include_once '/var/www/html/tag/include/seo_guard.php'; legacy_seo_guard('$kind'); $marker"; tail -n +2 "$f"; } > ".$f.new"
  php -l ".$f.new" >/dev/null
  chmod --reference="$f" ".$f.new" && mv ".$f.new" "$f" && echo "add  $f ($kind)"
done
# The tag pages' tab bar stops linking the retired Facebook view.
f=tag_show.php
[ -f "$b/$f" ] || cp -p "$f" "$b/$f"
if grep -q '^printf("| <a %s href=\\"%s/tag/%s/fb/\\">' "$f"; then
  sed 's#^printf("| <a %s href=\\"%s/tag/%s/fb/\\">#//&#' "$f" > ".$f.new"
  php -l ".$f.new" >/dev/null
  chmod --reference="$f" ".$f.new" && mv ".$f.new" "$f" && echo "edit $f (fb tab)"
else
  echo "ok   $f"
fi
REMOTE
