# User preferences

- The user always browses from another machine over Tailscale, never from the development host itself. Do not provide `localhost`, `127.0.0.1`, or `0.0.0.0` as user-facing preview links.
- For previews, use the development host's current Tailscale IP or MagicDNS hostname (`tailscale ip -4` / `tailscale status`). Ensure the preview listens on a reachable interface and that browser API requests and dev assets work through the same entry point. Check reachability before sharing the URL; distinguish host-side checks from validation on the user's machine.
- This preference is persistent project guidance, not confirmation that any particular preview port is running. Recheck the current server and port each session.

- Every task completion report must explicitly state commit status (hash and whether pushed, or not committed) and deployment status (deployed version and verification, or not deployed / failed / blocked). Never imply that a local edit is live. This reporting preference persists across sessions.
