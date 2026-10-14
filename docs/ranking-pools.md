# Windowed ranked pools (YT handoff)

`GET /api/v1/ranking-pools?category=news&since=<UTC>&until=<UTC>&gate=early&order=score` returns an immutable manifest. `GET /api/v1/ranking-pools/{snapshotId}?limit=500&cursor=<nextCursor>` returns pages bound to that manifest. Only `score` is supported; burst/growth/ignored `days` and unknown parameters are rejected, never substituted with24h snapshots.

Use strict ISO UTC `Z` timestamps. Bounds are exactly half-open publication-field `[since,until)`, at most7days, until<=server now. For today, since is Asia/Taipei midnight (previous UTC16:00); seven days starts six local midnights earlier, using **the same until cutoff**. Source is the same fixed category roster and stored own article-tag JSON as the existing ranking job, not the saved500-candidate charts. Like that job, `published_at` is the stored timestamp; this is not an independent audit of publisher metadata or exhaustive internet coverage. All raw/editor/rule-maintained tags on those articles participate.

Per article, repeated identical labels count once. IDs also deduplicate across input rows. Whole Unicode labels are preserved byte-for-byte (no case folding, NFC conversion, substring eligibility or guessed alias). Existing isTagNoise and own-media exclusions apply. Existing cross-media qualification applies **before sorting/pagination**:

- all: no cross-media threshold;
- early: at least two media each with at least two distinct articles;
- broad: at least three media, two each with at least two articles, and one with at least three.

Score reuses `mediaRankingScore`: sum of `2*(1-0.5**articleCountForMedia)`; fixed roster is echoed, ties use UTF8 lexical labels. `tagId` is SHA256 of the original label UTF8, as in F1. Map `tag` to YT's existing vocabulary keys; do not assume numeric/internal YT IDs equal tagId. `upstreamVocabularyId=null` because the pool reads article tags directly. Policy includes implementation fingerprint; noiseFilterVersion fingerprints the existing rules. Country/platform/no-equal/generic-word YT overlays remain downstream whole-term rules, not a new tag dictionary.

Manifest includes window, asOf (DB UTC clock in a read-only repeatable-read consistent snapshot), computedAt,24h expiresAt, basis ID/roster/collection bounds, source article/min/max publication counts, candidateTotal, eligibleTotal, default500 page count, complete checksum and qualification. Corpus completeness means completion of this consistent stored-data scan, **not** proof that all publishers' stories have been collected. A requested start before cohort collection bounds is unavailable.

Snapshot pages are privately persisted directly as gzip arrays, max5000 entries per API response; `totalPages` on a page reflects that request's limit. Keep following nextCursor until null and verify total and checksum. Success has available=true/truncated=false, including legitimate empty pools. Source/runtime/candidate/store caps give503 with available=false/incompleteReason/null eligibleTotal/checksum; no partial snapshot is published. Producer concurrency/budget gives429/Retry-After. Unknown snapshot404, bad cursor400, cross-snapshot/expired409. There is no silent fallback.

Checksum `canonical-entry-jsonl-v1` is UTF8 SHA256 over each entry in rank order. Canonical line is ECMAScript `JSON.stringify` of property order `tag,tagId,rank,score,articleCount,mediaCount,media` plus ASCII LF, including after the last entry. `media` keys sort by UTF8 byte order; no pretty printing/Unicode normalization. Use exported `entryLine` in app/src/ranking-pools/core.ts as the reference. Empty hashes empty bytes. Separate pageChecksums cover the server's500-entry gzip files. Readers verify both manifest identity and gzip file integrity, reject symlinks/non-regular files and bound manifest (1MiB), gzip block (16MiB) and expanded block (64MiB) reads; corrupted files are unavailable, not exposed as arbitrary public JSON.

Resource policy: one compute per process, two new pools/minute, same exact query reused10min; one readonly DB connection, indexed per-publisher publication/id keyset pages2000,20ms yield, server statement2s, acquisition/client statement2.5s, and total30s covering connection acquisition, transaction setup and commit. A failed readonly connection is destroyed rather than waiting indefinitely for rollback. Safety limits are300k source articles,250k candidates,750k media associations,32MiB labels/128MiB source tag JSON. Hitting a cap is unavailable, never a complete smaller pool. Persistent private `~/tag-analysis-private/ranking-pools` (optional TAG_RANKING_POOL_DIR) has an initial512MiB capacity ceiling;24h expiry rejects reads but **does not delete old files automatically**, respecting current retention instructions. At capacity new pools return explicit503 until an operator authorizes maintenance; disk must be monitored. No production env change/migration/new DB grant is required.

Anonymous GETs use public caching; Cookie/Authorization/X-Service-Token/X-Api-Key presence stays private,no-store through existing app hooks. Errors no-store. No article titles/bodies/URLs/IDs, accounts, visitor IDs, secrets or contributor-private records are exported. No GA events are emitted.

## Read-only formal preview (not the final live snapshot)

Common cutoff UTC2026-10-14T14:30Z, news fixed roster43, collection start2026-09-29T17:00Z:

| Window | Tagged source articles | Candidates | early | N>=4/M>=2 | N>=10/M>=3 | N>=20/M>=5 | Compute |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Today since2026-10-13T16:00Z |8381|16893|792|2028|568|206|0.303s|
| Seven days since2026-10-07T16:00Z |50835|62703|4994|10150|3887|1741|2.052s|

These differ from a500-entry sample and can change on a later asOf (backfills/edits). Example retained distinct counts today/week: 賴清德139/1165, 川普212/1323, AI184/830, 投資29/170. 柯文哲 did not pass today's early threshold at this cutoff, but week count106. Do not raise thresholds solely to suppress 投資; YT's reviewed generic overlay is separate. Preview top40 files preserve all-gate original ranks; final early API reassigns dense ranks after filtering and is the authoritative comparison.

Evidence `/home/deck/tag-analysis-private/f1-release/ranking-pool-verification-20261014/`: formal1/7day aggregates/top40, EXPLAIN range using articles_source_media_published, and existing isolated18306 reader test. No production article write or user export occurred. Drizzle0.45 incorrectly joins READ ONLY and WITH CONSISTENT SNAPSHOT without a comma, so this reader uses explicit native transaction syntax on the existing pool connection; it does not patch packages or drop read-only isolation.

media-stats remains semantically unchanged in this batch. Its five query stages now record durations through the existing private Prometheus metrics and server log, to identify the54s risk using actual evidence rather than assuming a cause. Profile after the backend is running; do not present timing instrumentation as a performance fix.
