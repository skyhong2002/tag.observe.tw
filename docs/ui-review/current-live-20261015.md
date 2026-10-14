# Current production UI review batches — 2026-10-15 Taipei

Authoritative ledger: `docs/ui-review-ledger.md` in `/home/deck/Projects/tag-sm-f1-release`. Current public web `7dc59c3c17f6d6420354c3d4df733549071f2bb4`, API `dc7b814e220606202a408d21e73b1d6e7c61fe16`, BUILD_ID `4nl3B-BcT4mA9uh47rm0Z`; metadata cross-checked against unchanged SM service WorkingDirectories/PIDs before and after. Remote-main base `d23e6b2b3b5d502fffe2187adac11e3559f61d7c`. No production build or deployment in this documentation/capture batch.

## Honest completion counts

65 main routes＋notes implementation (notes do not add routes).4 observed routes actually reviewed at current version:001 partial loading/recovery;002/004/005 issues.61 routes have no current-version actual review yet. **Complete route/state PASS0, whole-scope pending65.** Auth/admin, dynamic multi/few/empty/error/permission states are not inferred from public normal captures. Old677/225fa screenshots stay historical.

## Batch001 actual public HTTPS screenshots

Owner tool: `tools/ui-review/capture-public.mjs` (control5604781f; source SHA `5604781f09079f8ed54675d8cff00923050d6c2a` is source-control commit, not app version). Before Chromium launches a private proxy admits only TLS CONNECT tag.observe.tw:443; other HTTP/CONNECT transports denied, implicit loopback bypass disabled. Before page/navigation context routing allows only same-origin GET/HEAD; native DNT1 profile, automation guards unchanged, GPCnull. HAR840/request840 allDNT1, observed GA/GTM requests0 and proxy foreign-host admission0. These are HAR/request/host-level transport evidence, not TLS packet inspection or GA receipt. No account, fixture, SQL, service or synthetic GA.

Capture manifest `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/manifest.json`, SHA256 `1c10362fc86d999d26653e71594fda95db2f0028f0363007cdac7daec3453dd8`. Raw files `network-1280.har`, `network-390.har`, `requests.json`, `transport.json` under that private directory. Production surface, `candidate:false`; earlier candidate reviews remain in their original separate records. Capture PID1578254 ended, proxy closed; no candidate listener was created.

Existing non-author GPT-6.1 Sol reviewer personally viewed all32 original PNG＋15 offline crops, hash-checked originals and sampled real pixels: `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001-independent-ui-review.json` and `.txt`, SHA256 `beb9549a093336220e0db4734d0a554d5383abb13acb072ae766f805097b8f60`, UTC `2026-10-14T19:32:21.138837+00:00`. Detail crops retain source image hash/bounds. No new reviewer or browser spawned by reviewer.

| Route | Actual review result | Remaining state coverage |
| --- | --- | --- |
| 001 `https://tag.observe.tw/` | PARTIAL observed loading/unavailable states; normal-state PASS blocked | fullyloadedallpanel normal; hotrank/event/topic recovery finalsettled; media-directoryexpand/search/nav interactions; allerror/empty/consentstates |
| 002 `https://tag.observe.tw/tag/%E6%9F%AF%E6%96%87%E5%93%B2/` | ISSUES — secondary darkcontrast; loadedsections partialvisual acceptable | relationloadeddesktop/fullis-a/related/alias cases; 1/7dayandcharttooltip/historypaging; submit/image/privateactor/loginflows; empty/errorhistory/allarticlemorestates; darksecondarylabelsfixandreshoot |
| 004 `https://tag.observe.tw/ranking/` | ISSUES — darkcontrast and desktop unavailable | desktoppopulatednormal; alltablecolumns horizontalscroll/header sort/filterclick; early/broad/category/growth/data0/error; darkcontrastfix |
| 005 `https://tag.observe.tw/event/` | ISSUES — normal57event layout acceptable, darksecondarytimestamp contrast insufficient | date/hour/filter/indexexpand click; empty/error/fetchretry; eventdetail/openexternal/crossmedia comparisonstates; darktimestampsfix |

### Screenshot paths/hashes

| Route | Width/theme/kind | Private file | SHA256 |
| --- | --- | --- | --- |
| 001 | 1280/light/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/001-1280-light-viewport.png` | `2537461406fe63970c9d530ff091b336e962d38aec9ee992b61b09f0e84b9cb3` |
| 001 | 1280/light/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/001-1280-light-full.png` | `324b63159b8787cd35eadafd87a449aa8a564d4ec0177b931527f38a949a4bdb` |
| 001 | 1280/dark/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/001-1280-dark-viewport.png` | `3c6d6c0288227ef9b2f2345c6c2c5eabe4d2f042cedaa972ce31a4da6b2ea5f9` |
| 001 | 1280/dark/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/001-1280-dark-full.png` | `79fde4bf531e0f27b3ee8256c66f185f46b5db9b6099930a6ef3d803f99d2508` |
| 002 | 1280/light/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/002-1280-light-viewport.png` | `e547f8bf7a21a498a937b958668570ad25a576cbcbe2221ac2c9fccf2bac609a` |
| 002 | 1280/light/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/002-1280-light-full.png` | `7b5e97bb32e756fb85d66ba7534443ad8f13e1e3066f1f92b5d34c681c63de46` |
| 002 | 1280/dark/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/002-1280-dark-viewport.png` | `b2bffdf46cca7fe740869c8a31dfe4f31e8f5daa330e06209821ea1282d40b70` |
| 002 | 1280/dark/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/002-1280-dark-full.png` | `55b436b414a1fde57f63d79b98938c89542bca224eb8e9190c45cfdadc73bfec` |
| 004 | 1280/light/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/004-1280-light-viewport.png` | `950959b2ed011f00f794d0f500010dc459e3ed874614b0d3a6bed74f6994e30d` |
| 004 | 1280/light/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/004-1280-light-full.png` | `a6e0fdfab159fe523ad5472cda3780d1ec9aae05ce06cf39bfd687b07c6e73f7` |
| 004 | 1280/dark/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/004-1280-dark-viewport.png` | `c60add5e7b596c490b54a8a79dd21b7aa346262bc15034695f3d492d8cf46360` |
| 004 | 1280/dark/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/004-1280-dark-full.png` | `54d00916b2ad5e9867b7fb17b63a8fe011d95806f07a4896c47429b00a476097` |
| 005 | 1280/light/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/005-1280-light-viewport.png` | `34b91fc6de788f7c8f35d9bbd154e63fa2d91353f49b543f0eb37f4cdc98cfa7` |
| 005 | 1280/light/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/005-1280-light-full.png` | `7eb8644712253d19275ade3c268da79d713d530dd67a125f6f2e335f4aaae8b9` |
| 005 | 1280/dark/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/005-1280-dark-viewport.png` | `eee66a76eb6ca3217945adf420804797697183c72f01b98d5d5d3f5b74a04bf1` |
| 005 | 1280/dark/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/005-1280-dark-full.png` | `07ee8f54e864056ed4689459394edf1851b6184fab5e2c0e2e6ff5d2530df62a` |
| 001 | 390/light/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/001-390-light-viewport.png` | `0ba42b5c328085b6b3b59bc69e665783fbe5ca0ccf5e4bb859b22fcf4fd7da83` |
| 001 | 390/light/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/001-390-light-full.png` | `24c2342a0cc8fbbc65ea9b6a64e2d00064265d3ad10b53875cdbee3f8c18f01e` |
| 001 | 390/dark/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/001-390-dark-viewport.png` | `0db21d1d3e25cb9baaef87222525cbb60353a9d34adf276ffc122a60be163cb2` |
| 001 | 390/dark/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/001-390-dark-full.png` | `ef5d7be490f74d5afdb98ca9a041b96cd4e9a8053f4bff095cad9d1e1be2ea7c` |
| 002 | 390/light/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/002-390-light-viewport.png` | `3638139ebb514e11e380708d9296ebb24cccaa47e503a79c860cd1b8ceace03d` |
| 002 | 390/light/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/002-390-light-full.png` | `66eb022bbaabba5e045fcac849bef5b3d8ab6f3ee4ccdf3a527ab1f1a4644f1e` |
| 002 | 390/dark/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/002-390-dark-viewport.png` | `26366f7405e7e131816a544649a142ae5843dfaa02ce492769d3ac8c482d117b` |
| 002 | 390/dark/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/002-390-dark-full.png` | `1c83e412694b1529ee15f9c14abfdd3a53655a298ec6f59c58511c1f8b464c5d` |
| 004 | 390/light/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/004-390-light-viewport.png` | `bc200b6764031c02fed35914a2bb32ac2621accd94ef966cfe12181b97cf72b2` |
| 004 | 390/light/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/004-390-light-full.png` | `dfce6a450120aea8829166250e0047b06b8866de1ea3ba318cae188199b35e3a` |
| 004 | 390/dark/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/004-390-dark-viewport.png` | `b32a07a36a80d8a19092409b0fae11e93e90db13dbb3080c7edbc4a814efb605` |
| 004 | 390/dark/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/004-390-dark-full.png` | `4699602d63a80323d6d59d148a257d513b3996c4d79f11dc72ca00ee003a29d9` |
| 005 | 390/light/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/005-390-light-viewport.png` | `408ce10fd7883d352011c1e066bd68b46c8ec9d22ee60dc795ee03b1160bf17f` |
| 005 | 390/light/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/005-390-light-full.png` | `bb0a8d5ee74303c5e06b3a124f304283ff30fc8b3434ac4c38cd8ea8b863580c` |
| 005 | 390/dark/viewport | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/005-390-dark-viewport.png` | `05a9954bcd5c11734e9fca09869c6e76a11edd270b4d6121197d86a36e39031c` |
| 005 | 390/dark/full | `/home/deck/tag-analysis-private/ui-review/current-live-7dc-20261015/batch001/005-390-dark-full.png` | `346db1f352c11d50b4c082b0bab939d3c16845ddc007a019e896fc20254a34d7` |

### Findings and source repair

Ranking small dark metadata/count/header RGB82,82,92 against10,10,10 measured2.565:1. Tag date heading and event age RGB113,113,123 against24,24,27 measured3.670:1, below4.5:1 for small text. Source58cdab2d adds dark:text-zinc-400 to these existing labels and adjacent same-component numeric labels;15 existing tests plus frontend typecheck passed. This source is pushed but **not built/deployed**: pixel remediation cannot be called fixed until same-artifact candidate and formal rechecks.

Desktop ranking captured unavailable while phone showed500 qualifying entries/50 rows; home several optional areas captured loading/recovery. These are current saved states, not legal empty or confirmed normal. No unique DB, timeout, CSS or permanent-regression cause inferred. Notes were collapsed summaries, not screenshot cropping; expanded state still pending.

### Resources and continuation

- `batch001-before-probe.json` UTC `2026-10-14T19:22:31.983803+00:00`: tag/blog/YT medians 0.052/5.510/0.041s; load 8.59, /home 58.79GiB, MemAvailable 4.00GiB. Nine trials200, curl0. Raw start/end/bytes/cache status retained.
- `batch001-during-probe.json` UTC `2026-10-14T19:24:17.124822+00:00`: tag/blog/YT medians 0.052/5.066/0.053s; load 11.58, /home 58.35GiB, MemAvailable 2.96GiB. Nine trials200, curl0. Raw start/end/bytes/cache status retained.
- `batch001-after-probe.json` UTC `2026-10-14T19:26:04.974648+00:00`: tag/blog/YT medians 0.050/3.120/0.046s; load 9.73, /home 57.83GiB, MemAvailable 3.47GiB. Nine trials200, curl0. Raw start/end/bytes/cache status retained.

Batch002 prepared for011/article/,008/latest article example,010/media/,012/topic/. It was **not started**: UTC19:34:37–19:34:44 blog homepage returned500 in all three probes (tag/YT200). Median time alone did not override bad HTTP. `batch002-before-probe.json` retained. No capture/barrier wrapper, service restart or cross-repo repair was added. Further small batches await a passing fresh gate while source/doc work continues.

T-ref already exists and is updated with current production SHAs, canonical URLs, directly reusable component/dependency paths and homepage CSS tokens in `docs/cross-site-consistency.md`; all mentioned source paths checked present. The document describes alignment, not cross-site UI acceptance.

The old `/home/deck/Projects/tag-f1-release/docs/ui-review-ledger.md` now begins with a current-version pointer and honest counts. Only that doc was edited in the detached, mixed-work worktree; its existing source changes/HEAD/index were left unchanged. That pointer is not committed there because moving the shared detached HEAD or mixing its source is unsafe; the authoritative ledger/completion file is committed in the owner worktree.
