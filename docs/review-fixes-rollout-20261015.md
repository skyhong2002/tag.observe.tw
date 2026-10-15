# Review fixes rollout (web + API) — 2026-10-15

Source `f3c943ae` on `feat/sm-f1-candidate-capture` (fixes from the 65-route formal review; see
[fix backlog](ui-review/fix-backlog-20261015.md)). Web BUILD_ID **`wnFvUHMO_gj9jQ67KUUw-`**.

## What changed

- Web (280e582a, 3d424653, 3e73f344, f3c943ae): journalist page shows the newest 20 similar groups / 100 articles with
  顯示全部 (`?all=1`; default HTML 7.4 MB → 0.78 MB); byline page drops the contradictory 未署名; media page streams 媒體關係
  behind Suspense (first byte 0.98 s instead of failing after 8 s); dates outside the current year show the year; API docs
  paths wrap at slashes; opt-out button names the action; daily similarity stats time out after 30 s with 重試, chart leaves
  room for the wrapped legend; admin gate says admins only; section tab bars wrap on phones; home topic meta keeps counts whole.
- API (68b8200f, 5b01afdb) overlaid on the e2769539 release: `/observe/` and 讀者關注 name pages from their path when GA only
  has the site name; `/api/v1/similarity/daily` keeps settled days in
  `~/.local/share/tag-analysis/similarity-daily-relations.json` (30 days: 11–53 s → 3.9–4.5 s, identical output).

## Build, release, deploy

- Gated build (three-site probe + no other node build): UTC 11:21:51–11:22:26, nice 19 / ionice 3, 64 static pages, exit 0.
  No latency warnings during the build. (An earlier attempt at 10:30 was stopped 5 s in because the gate had actually failed
  — blog's own build was running; a later queue waited on a too-broad process check. No production effect.)
- Web release `/home/deck/.local/share/tag-analysis/releases/f3c943ae-web-wnFvUHMO_gj9jQ67KUUw--20261015-001`, 3,129 files,
  inventory SHA256 `f4027395ced377b59e54e20c3cafc144b03ef3940a0244cdd43a36cae34fed10`; f62 static chunks kept; no home snapshot.
- API release `/home/deck/.local/share/tag-analysis/releases/f3c943ae-api-observe-daily-20261015-001` = e2769539 release +
  `site-observation.ts` (`624952f3…`) and `similarity.ts` (`07dc8f60…`).
- Loopback candidate (18338) before the switch: 13 pages 200 with the new BUILD_ID; stopped.
- Switch UTC: web 11:27:03 (old f62 process took 48 s to exit on SIGTERM, new one first 200 at 11:28:00 — **about 57 s
  during which 18332 could not serve pages**), API 11:28:03 (2.5 s), gateway 11:28:05 (2.2 s). Worker untouched.
- Verification: 14 GETs (local 18130 + public) for `/`, `/tag/柯文哲/`, relations, journalist, `/media/cnews/`, media-stats,
  `/observe/` all 200; public home carries the new BUILD_ID; 0 error log lines since the switch; `/observe/` has no generic
  titles left; daily stats 4.5 s. Post probe tag/blog/YT 0.24/2.31/0.19 s, load 5.9.

Receipts: `/home/deck/tag-analysis-private/f1-release/web-fixes-f3c943ae-20261015/` (`artifact.json`, `deployment-result.json`,
`web-inventory.json`, probes, `unit-backup/`, scripts).

Rollback (web → f62abfb5 / 08ItzUxu99m4XSoNcfGsu, API + gateway → e2769539):

```sh
bash /home/deck/tag-analysis-private/f1-release/web-fixes-f3c943ae-20261015/rollback.sh
```

## Known

- `/api/v1/similarity?hours=168` is now 2.4 MB, over Next's 2 MB data-cache limit, so each media page refetches it
  (several seconds, now streamed). A per-outlet relations endpoint would remove that.
- Next waits for in-flight requests on SIGTERM; a quieter moment or a shorter stop timeout would shorten the web gap.
