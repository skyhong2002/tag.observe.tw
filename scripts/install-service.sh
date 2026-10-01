#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
node_binary=$(command -v node)
if [[ "$project_dir" != /home/deck/Projects/tag.analysis.tw || "$node_binary" != /home/deck/.local/bin/node ]]; then
  echo 'This service unit targets skyhong-SM. Adjust the runtime paths for another host.' >&2
  exit 1
fi
cd "$project_dir"
if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
  echo 'Commit and verify tracked changes before deployment; the running release will not be changed.' >&2
  exit 1
fi
commit_id=$(git rev-parse HEAD)
if [[ "$commit_id" != "$(git rev-parse origin/main)" ]]; then
  echo 'Push the scanned checkpoint to origin/main before deployment.' >&2
  exit 1
fi
release_root=/home/deck/.local/share/tag-analysis
release_dir="$release_root/releases/$commit_id"
mkdir -p "$release_root/releases" "$HOME/.config/systemd/user"
exec 9>"$release_root/deploy.lock"
flock -n 9 || { echo 'Another preview deployment is running.' >&2; exit 1; }
if [[ ! -d "$release_dir" ]]; then
  staging_dir=$(mktemp -d "$release_root/releases/.staging-$commit_id-XXXXXX")
  trap 'if [[ -n ${staging_dir:-} && -d "$staging_dir" ]]; then chmod -R u+w "$staging_dir"; rm -rf -- "$staging_dir"; fi' EXIT
  git archive "$commit_id" app/src app/data package.json package-lock.json web | tar -x -C "$staging_dir"
  npm ci --prefix "$staging_dir" --omit=dev --ignore-scripts --no-audit --no-fund
  # SSR frontend: build once per release, then run the standalone server.
  npm ci --prefix "$staging_dir/web" --ignore-scripts --no-audit --no-fund
  (cd "$staging_dir/web" && NEXT_TELEMETRY_DISABLED=1 npx next build >/dev/null)
  cp -r "$staging_dir/web/.next/static" "$staging_dir/web/.next/standalone/web/.next/static"
  cp -r "$staging_dir/web/public" "$staging_dir/web/.next/standalone/web/public"
  # The release is made read-only below; Next's runtime cache (optimized
  # images) lives outside it, shared across releases.
  mkdir -p "$release_root/next-cache"
  rm -rf "$staging_dir/web/.next/standalone/web/.next/cache"
  ln -s "$release_root/next-cache" "$staging_dir/web/.next/standalone/web/.next/cache"
  rm -rf "$staging_dir/web/node_modules" "$staging_dir/web/.next/cache"
  printf '%s\n' "$commit_id" > "$staging_dir/COMMIT"
  node "$project_dir/tools/release-smoke.js" "$staging_dir"
  chmod -R a-w "$staging_dir"
  mv -- "$staging_dir" "$release_dir"
  staging_dir=''
else
  [[ $(cat "$release_dir/COMMIT") == "$commit_id" ]] || { echo 'Release identity mismatch.' >&2; exit 1; }
  node "$project_dir/tools/release-smoke.js" "$release_dir"
fi

unit_path="$HOME/.config/systemd/user/tag-analysis.service"
previous_target=''
if [[ -L "$release_root/current" ]]; then previous_target=$(readlink "$release_root/current"); fi
if [[ -e "$release_root/current" && ! -L "$release_root/current" ]]; then
  echo 'Refusing to replace a non-symlink current release.' >&2
  exit 1
fi
unit_backup=$(mktemp "$release_root/.previous-unit-XXXXXX")
had_unit=0
if [[ -f "$unit_path" ]]; then cp -- "$unit_path" "$unit_backup"; had_unit=1; fi
switched=0
rollback() {
  status=$?
  trap - EXIT
  if [[ "$status" -ne 0 && "$switched" -eq 1 ]]; then
    echo 'Preview deployment failed; restoring the previous unit and release.' >&2
    if [[ -n "$previous_target" ]]; then
      ln -s -- "$previous_target" "$release_root/.current-rollback-$$"
      mv -Tf -- "$release_root/.current-rollback-$$" "$release_root/current"
    else
      rm -f -- "$release_root/current"
    fi
    if [[ "$had_unit" -eq 1 ]]; then
      install -m 644 "$unit_backup" "$unit_path"
      systemctl --user daemon-reload
      systemctl --user restart tag-analysis.service
    else
      systemctl --user stop tag-analysis.service || true
      rm -f -- "$unit_path"
      systemctl --user daemon-reload
    fi
  fi
  rm -f -- "$unit_backup"
  exit "$status"
}
trap rollback EXIT
ln -s -- "$release_dir" "$release_root/.current-next-$$"
mv -Tf -- "$release_root/.current-next-$$" "$release_root/current"
switched=1
install -m 644 "$project_dir/runtime/tag-analysis.service" "$unit_path"
install -m 644 "$project_dir/runtime/tag-worker.service" "$HOME/.config/systemd/user/tag-worker.service"
install -m 644 "$project_dir/runtime/tag-web.service" "$HOME/.config/systemd/user/tag-web.service"
install -m 644 "$project_dir/runtime/tag-backup.service" "$project_dir/runtime/tag-backup.timer" "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable tag-analysis.service tag-worker.service tag-web.service tag-backup.timer
systemctl --user restart tag-web.service tag-worker.service
systemctl --user restart tag-analysis.service
node "$project_dir/tools/wait-preview-ready.js" "$release_dir"
printf 'Running verified release %s\n' "$commit_id"
systemctl --user status tag-analysis.service --no-pager
