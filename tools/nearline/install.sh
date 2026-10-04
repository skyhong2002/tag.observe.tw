#!/usr/bin/env bash
# Install a stable copy independent of worktree edits, then enable continuous batches.
set -euo pipefail
umask 077
project=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
code=/home/deck/.local/share/tag-legacy-nearline
config=/home/deck/.config/tag-legacy-nearline
units=/home/deck/.config/systemd/user
mkdir -p "$code" "$config" "$units"
# Stop an existing deployment cleanly before replacing its executable files.
systemctl --user stop tag-legacy-nearline.timer tag-legacy-nearline.service 2>/dev/null || true
install -m 600 "$project/tools/nearline/pipeline.py" "$project/tools/nearline/source.py" "$code/"
if [[ ! -e "$config/config.json" ]]; then
  install -m 600 "$project/tools/nearline/config.example.json" "$config/config.json"
fi
install -m 644 "$project/runtime/tag-legacy-nearline.service" "$project/runtime/tag-legacy-nearline.timer" "$units/"
systemctl --user daemon-reload
systemctl --user enable --now tag-legacy-nearline.timer
systemctl --user start --no-block tag-legacy-nearline.service
