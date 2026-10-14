# d1LV cold/warm diagnosis and warm-only deployment revision

Status: **diagnostic/source/mock evidence only; formal release remains 0dd38b6**. APP `aff5c0289c4863fedb37368b4942884ccc068d77`, BUILD_ID `d1LVsC3sk6p04uOyWUx5T`; no rebuild, migration, current-pointer change, worker/gateway/legacy-web restart, Cloudflare/WAF, backup timer action or cleanup.

## Private measurements (UTC 2026-10-14)

All requests were anonymous DNT:1 GETs, downloading the full body; no browser, JavaScript execution or synthetic GA. The new API used its existing production environment and nearline/vocabulary drop-ins on18230. Standalone web used the preserved release on18232. A private GET-only loopback tracing proxy on18231 recorded API path/status/duration; it did not change artifact files. Timing includes this small proxy overhead. Formal service PIDs114409 /325597 /114174 stayed unchanged. Private listeners were stopped afterward.

| Page / endpoint | First GET time_total (s) | Second GET time_total (s) |
| --- | ---: | ---: |
| Homepage | 7.533072 | 0.005964 |
| `/tag/柯文哲/` | 4.015546 | 4.007633 |
| Relations (direct GET, **already touched by tag SSR**) | 0.003468 | 0.003733 |
| Ranking all/score/limit50 (first key in this process) | 0.044229 | 0.035060 |
| Tag status (direct GET, **already touched by tag SSR**) | 0.032463 | 0.741368 |

Page-triggered API trace: first journalist48h/limit6 took7.102104s, similarity24h4.029922s, ranking all/growth/5002.431707s, ranking all/score/5002.468573s, tag status2.426693s, relations0.077349s. The journalist response was the last completed homepage API before the7.53s full-page response. This identifies the observed critical path, **not a proven exact cause of the earlier20s timeout**, which was not reproduced.

The same fan-out round also recorded **nine internal HTTP500 responses** (events/threads, news/blue/green rankings including retries, media-stats, topics). Three later media-stats requests had no completion recorded before shutdown. Thus HTML200 alone did not establish healthy APIs. No error-body/SQL reason was captured for those failures; queue pressure is an inference, not a diagnosed DB error. Do not mislabel these as schema or permission failures, or as a successful deployment warmup.

A subsequent **API-only serial diagnostic used a separate cold API process**, without web fan-out. First means the first request to that key in this process; later keys share process/database buffers primed by preceding requests. It is not a database restart or a guarantee of worst-case latency.

| Public API key | First (s) | Second (s) | Results |
| --- | ---: | ---: | --- |
| media-stats | 14.060643 | 0.004762 | 200/curl0 both |
| topics limit120/kind topic | 4.508239 | 0.942929 | 200/curl0 both |
| journalists hours48/threshold.65/limit6 | 4.865359 | 0.001073 | 200/curl0 both |
| similarity hours24/threshold.65 | 0.387646 | 0.060075 | 200/curl0 both |
| ranking all/score/limit50 | 0.043459 | 0.025158 | 200/curl0 both |
| 柯文哲 status | 0.140224 | 0.031405 | 200/curl0 both |
| 柯文哲 relations | 0.004425 | 0.002377 | 200/curl0 both |

**Cold gateway boundary:**18130 runs its own API process and will lose process-local caches at restart. Warming18230 does not warm18130. No measured successful endpoint exceeded20s in these samples; media-stats14.06s is relatively close and the concurrent round did have500s. This is limited evidence, not a guarantee. Public six acceptance GETs retain20s and rollback on any failure. No formal18130 restart was used to obtain this diagnosis. A private warm200 gate does not excuse any later public failure.

## Script delta

Only the warm section of `docs/deploy/d1LV/deploy.sh` changes. The original `get_200`, public six checks, worker/cutover/rollback, units and drop-ins are untouched.

- Serially GET16 exact homepage API keys on18230 (media, media-stats, events24/30, threads, topics, journalists, similarity, three camp rankings, two word-cloud rankings, avatars, visuals, site-observation). Every key must be200/curl0.
- Private-only warm helper permits only18230/18232, with max-time120s. Warm homepage/tag/relations after those APIs.
- Repeat full homepage with max-time2s and verify a finite reported time_total<=2; abort before worker/gateway changes otherwise.
- Preserve UTC/status/exit/header/body evidence and separate `warm-timings.tsv`. No retries for bad HTTP, timeout or failed hot-home check.
- These checks observe the16 explicit API requests and full-page timing. They do not trace every later SSR subrequest (including dynamic event coverage), so a future hot HTML200/<=2s does not prove fan-out zero500 or comprehensive API readiness.

**Execution boundary:**the earlier failed attempt already created release `...-simple-001`, backup and the two disabled unit files. They are retained. The full deploy script still intentionally refuses existing paths. **Do not run the old admission command or blindly rerun deploy.sh.** This handoff is the warm-only source revision; a prepared-release continuation command must be separately admitted before any deployment retry. The prior packet8ea5bd3a authorized the old warm section and does not authorize this revised cutover.

## Evidence locations

- Initial instrumentation attempt (no API listen): `/home/deck/tag-analysis-private/f1-release/warm-diagnostic-d1LV-20261014T1244/`. Adding a Fastify hook after buildApp.ready was rejected; its web was stopped, originals retained. This is excluded from successful timing evidence.
- Actual two-page rounds and proxy trace: `/home/deck/tag-analysis-private/f1-release/warm-diagnostic-d1LV-20261014T1247/` (`api-requests.jsonl`, per-GET metrics/header/body/UTC/exit, summary.json, started/stopped units/listeners, raw probes, private journal, source mock test log).
- Serial API rounds: `/home/deck/tag-analysis-private/f1-release/warm-api-serial-d1LV-20261014T1250/` (per-GET raw evidence and stopped-state receipts).
- No successful page-triggered baseline is inferred from direct requests that were already primed by SSR. No screenshot, UI pass or GA receipt claim is made by these curl diagnostics. Full65-route ledger scope remains pending.

Independent review and final hashes are recorded in the new warm-revision packet outside the repo. Tests use mocks only and cannot prove production readiness.


Post-diagnostic retained-release comparison: canonical inventory `65d4d28fbaa6fdfe48cb0ba5962ee6352c419799a210bc470732586f020ab7f0`. All cache-free source **file bytes** match;45 extra entries match retained old immutable static assets. Three existing static directory modes match the old static tree because the original admitted merge used rsync --archive. Source inventory59468 is not reused as the release inventory. This is a comparison after diagnostics, not an invented before/after pair. Detailed comparison and assessment are retained privately.

Independent non-author GPT-6.1 Sol source/mock review: `warm-deploy-independent-20261014.{json,txt}`, UTC12:55:37, both SHA256 `40c04b55ea6c3ff45d9f568c4f63c1652c6f49a8b8d9faa4fd6eb5c7ca9b93b7`; reviewer personally ran19/19 mocks and Bash syntax. Script/test bytes were reviewed; the subsequent documentation additions here record its stated limits and the post-diagnostic artifact comparison. These are not new UI or deployment passes.
