# Media first-crawl API rollout — 2026-10-15

## Problem

`/api/v1/media-stats` (and `/api/v1/media-traffic-comparison`) ran `MIN(crawled_at) … WHERE source='own' GROUP BY media`.
`crawled_at` is in no index, so every one of ~302k own rows was read from the ~20 GB `articles` table: 50–60 s cold, and
repeated every 2 min (media-stats cache) / 5 min (traffic comparison) while `/media/` was being viewed. Until now the
gateway and API only avoided it by forwarding media-stats to the retained `tag-f1-api-d1lv` (:18230), which still ran the scan.

## What was tried first

A covering index `(source, media, crawled_at)` was the obvious fix, but building it online on this shared host (MariaDB
buffer pool 1 GB) saturated the disk: IO pressure 86 %, tag home 13 s, blog home 22 s. The `CREATE INDEX` was killed after
~12 min (UTC ≈09:45); InnoDB dropped the partial index, `__drizzle_migrations` stayed at 39 rows, the migration was never
committed. Do not retry this on SM during the day.

## Fix (commits `e2769539`, `52282ea5`)

- Totals: `COUNT(*) … GROUP BY media` only — answered from the existing `(source, media, published_at)` index (0.25 s).
- First-crawl dates: `app/src/v1/media-first-crawl.ts` keeps them in `~/.local/share/tag-analysis/media-first-crawl.json`
  (override `TAG_MEDIA_FIRST_CRAWL_FILE`); only outlets missing from the file are looked up. Shared by media-stats and the
  traffic comparison. Delete the file after a repair that moves older rows to another outlet; it is rebuilt on demand.
- The file was seeded from the retained 18230 service's own `collectingSince` (295 publishers, exact same `MIN(crawled_at)`;
  spot-checked against direct SQL). New code then filled one unlisted outlet itself.
- media-stats warms at startup and serves the last snapshot while refreshing (stale-while-revalidate), so the remaining
  7-day stage (4–20 s depending on disk load) never blocks a reader after start-up.
- Old vs new output for all 297 outlets: identical `collectingSince` and `totalCollected`.
- Tests: `app/src/v1` 22 files / 128 tests pass; biome and tsc clean for the touched files.

## Release and deployment

Release `/home/deck/.local/share/tag-analysis/releases/e2769539-media-firstcrawl-20261015-001` = copy of the running
`cb4ef914…-topics-concurrency` release with only `app/src/v1/{media-first-crawl,media-stats,media-traffic-comparison}.ts`
overlaid from `52282ea5`. No npm install, no migration, no web rebuild.

| Unit | Port | Before | After | Switched (UTC) |
|---|---|---|---|---|
| `tag-ranking-pool-api` | 18330 | cb4ef914, media-stats forwarded to 18230 | e2769539, computes locally | 2026-10-15T10:07:12Z |
| `tag-analysis` (gateway) | 18130 | dc7b814e, media-stats forwarded to 18230 | e2769539, computes locally | 2026-10-15T10:07:55Z, first 200 after 5.36 s |

Drop-ins: `~/.config/systemd/user/{tag-ranking-pool-api,tag-analysis}.service.d/zz-zz-media-firstcrawl.conf`.
Web `f62abfb5` / `08ItzUxu99m4XSoNcfGsu`, worker and 18230/18232 untouched. Backups and receipts:
`/home/deck/tag-analysis-private/f1-release/media-firstcrawl-api-20261015/`.

Rollback (API → cb4ef914, gateway → dc7b814e with 18230 forwarding):

```sh
bash /home/deck/tag-analysis-private/f1-release/media-firstcrawl-api-20261015/rollback.sh
```

## Verification

- Cold start, isolated candidate: first media-stats 5.5 s with `historicalArticles` 211 ms (was 50–60 s); after warm-up 0.007 s.
- After deploy: gateway log `historicalArticles` 127 ms, `recentArticles` 4.4 s (background warm-up).
- Local 18130 and public HTTPS: `/`, `/tag/柯文哲/`, relations, media-stats, `/media/`, traffic comparison all 200; public home
  carries BUILD_ID `08ItzUxu99m4XSoNcfGsu`. 0 error/fatal log lines since the switch. Receipt `postdeploy-gets.txt`.
- Host probe after: tag/blog/YT medians 0.45/2.09/0.11 s, load1 3.8, MemAvailable 4.2 GiB.

## Still open

- `media-traffic-comparison` cold load is still 13–19 s: its monthly `COUNT(*)` excludes undated rows, which needs
  `fetched_at`/`crawled_at` per row. Cached 5 min, so it hits only the first reader after expiry.
- 18230/18232 (`tag-f1-api-d1lv`, `tag-f1-web-d1lv`) no longer serve production traffic; kept as the rollback target.
