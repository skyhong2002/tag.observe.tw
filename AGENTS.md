# User preferences

- The user always browses from another machine over Tailscale, never from the development host itself. Do not provide `localhost`, `127.0.0.1`, or `0.0.0.0` as user-facing preview links.
- For previews, use the development host's current Tailscale IP or MagicDNS hostname (`tailscale ip -4` / `tailscale status`). Ensure the preview listens on a reachable interface and that browser API requests and dev assets work through the same entry point. Check reachability before sharing the URL; distinguish host-side checks from validation on the user's machine.
- This preference is persistent project guidance, not confirmation that any particular preview port is running. Recheck the current server and port each session.

- Every task completion report must explicitly state commit status (hash and whether pushed, or not committed) and deployment status (deployed version and verification, or not deployed / failed / blocked). Never imply that a local edit is live. This reporting preference persists across sessions.

- Several agent sessions (Claude Code and Codex) share the checkout at `/home/deck/Projects/tag.analysis.tw`, and its local `main` often lags behind `origin/main`. Before building demos, previews, worktrees, or comparisons against what is live, run `git fetch origin` and base the work on `origin/main` (e.g. `git worktree add --detach ~/.cache/<name> origin/main`), never on local `main`. Do not pull or reset the shared checkout yourself; other sessions keep uncommitted files there. State the base commit in reports.
