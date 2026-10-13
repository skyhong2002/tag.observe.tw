# Anonymous candidate and Mint capture admission preparation

Status: **source preparation; no execution permission, browser or UI PASS**.
The existing runtime remains APP `677a0c793eeda0c4d850c81ac574c95508d08e0a`,
artifact OPS `c70425b007bdac9fdbef62b935811ee0d7f30d18`, BUILD_ID
`PmjYScQDDoJKBr43SLkhd`, inventory
`f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`
and manifest `76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`.
The new executing control OPS must be separately committed, independently
reviewed and pinned. This batch does not rebuild or copy the runtime.

## Scope and capacity

The authority is `docs/ui-review-ledger.md`, counting only its 65 primary rows.
The checked catalogue is `docs/ui-review/mint-anonymous-capture-plan.json`:
53 anonymous routes, 12 deferred admin/member routes, 212 planned full-page PNGs
(1280×800 and 390×844, light and dark), split into 14 batches of at most four
routes. Each batch needs its own exclusive namespace and fresh admission.

Route 003 is only the anonymous login-required image-page notice; authenticated
upload/vote/review is pending. Dynamic examples may be absent in the isolated
database. Preserve requested/final URL, HTTP status and data-state gaps: a 404,
empty page or redirect does not establish a many/sparse template PASS. Important
states and authenticated workflows remain required after this anonymous batch.

Typical PNG estimate: 106 MiB, plus approximately 100–400 MiB of network/profile
evidence. Each batch has a **96 MiB hard ceiling**, including its capture profile
and network evidence: 14×96 MiB = 1.3125 GiB for capture directories. Reserve at
least **0.25 GiB per complete batch** for the controller's separate raw receipts
and bounded overhead (14 retained batches: 3.5 GiB planning allowance). This is
an admission estimate, not an enforced aggregate ceiling or observed usage.
Immutable source
checkout estimate is approximately 27 MiB per host; no npm install, Next build,
artifact copy or new restore is included. Estimates are not observed usage.

## Required admission packet

Before each actual execution, place the following in the private owner queue and
send babysit the exact paths and SHA256 values:

1. Full control OPS/APP/artifact OPS, unchanged BUILD_ID and inventory; independent
   source-review transcript/receipt and tested source hashes.
2. Actual clean, canonical detached control checkout paths on Mint and SM;
   executable Git blob/file pins, exact SM helper pins and a private per-session
   frontdoor config/hash. A prepared path is not an existing checkout.
3. Private execution input and batch plan/hash. Preparation has permissions false
   and null expiry. Only admitted execution has true permission/slot fields and
   freshly generated absolute deadlines; expired inputs are never reused.
4. Exact shell command, PATH, tool paths and outer private stdout/stderr log. Use
   `nice -n 19 ionice -c3`, Mint Node24.15.0, and
   `PLAYWRIGHT_BROWSERS_PATH=/home/sky/observe-worker/browsers`. This operation has
   no Next workers because it does not run a Next build.
5. Fresh actual Mint/API/SM/YouTube gate receipt, with raw transport evidence saved
   before validation. Mint→SM uses the existing pinned SSH channel; SM→YouTube
   uses the existing `skyhong-blog` channel. An observation is not a slot grant.

The operational entry is `tools/mint-capture/entry.mjs --execute`, with four
arguments: private execution JSON, private batch plan JSON, exact plan SHA256,
and a new private diagnostic JSON path. Concrete commands and hashes are emitted
only after the source is frozen/committed and the packet is populated; this
document is not a runnable admission.

## Initial independent review

The existing nonauthor GPT-6.1 Sol reviewer read all 20 frozen capture files,
verified all 20 hashes, independently ran 47/47 combined source/mock tests,
19 syntax checks and two Python compile-only checks. The result is **ISSUES**,
not source PASS: proxy/late-response/HAR evidence failures must prevent complete
acceptance; browser cleanup must retain ownership after the root exits; and the
outer parent must confirm owned remote cleanup before releasing its lock after
a forced worker termination. The author is repairing these as one batch; no
candidate or browser is admitted while these findings remain open.

Initial JSON (retained unchanged):
`/home/deck/tag-analysis-private/f1-release/mint-capture-source-independent-initial-20261014.transcript.json`
SHA256 `68996973f723e6f9adb8e1f7e9db43fde4bfd3d6b42171a41cfc8698a932f013`.
Actual test transcript has the same basename with `.transcript.txt`, SHA256
`b6e1c5fb19f7046dd6e97a78cb38db53e9f44cfd17691d894dbb88e70b90f856`.
These offline evidence counts do not represent actual screenshots or UI PASS.

## Gates and shutdown

- Global limits: one build, two browser roots across Mint, SM and YouTube's host.
  A fresh count must leave room for the single owned Mint browser.
- Load1 maximum12; any curl failure or non-200 home response rejects admission.
  Homepage HTML `time_total` limits: tag2.0s, blog6.17s, YouTube2.0s. These use the
  UTC2026-10-13T05:47Z five-sample medians and include origin, edge and network;
  they are not a precise measurement of origin rendering alone.
- Both actual working volumes must have ≥40 GiB at start; below30 GiB pauses or
  stops only the owned work. Do not touch backup processes or delete old files.
- Acquire the real nonblocking Mint common kernel lock through the guard; exit
  if another owner holds it. Fresh probes recur throughout the batch.
- Candidate admission is at most15 minutes, with planned shutdown120 seconds
  before expiry; capture at most9 minutes and at least60 seconds before planned
  candidate stop. No automatic retry or deadline extension.
- After capture, request the private input/session/control-bound owned stop,
  confirm the original ended receipts and unchanged inventory, then release the
  lock. Preserve failed raw evidence and stop the owned children on errors.
  Exact shutdown timing is recorded, not assumed from the intended deadline.

## Privacy and evidence acceptance

Before Chromium launches, the network proxy permits only the exact candidate
origin's GET/HEAD traffic. GA/GTM and other origins, CONNECT, upgrades and
mutations are refused; context routing is installed before pages are created.
Keep DNT1 and every automation/GPC/opt-out guard; record actual GPC and webdriver
without overriding navigator, browser identity or consent. No real account,
permission, cookie/session import, OAuth action or synthetic GA event is allowed.

Save raw network requests/HAR and proxy allowed/blocked counters with sensitive
header values redacted. Record actual zero Google outgoing traffic, PNG hashes,
viewport/theme, requested/final URL, HTTP status, UTC, APP/control/artifact SHAs,
BUILD_ID, full-page/lazy-image/footer state, gate receipts and stop results.
Candidate5xx ends the batch and retains partial evidence. Evidence remains in
private directories outside the repo; the ledger stores paths and hashes only.

The existing nonauthor reviewer must actually inspect each page's images and
network/manifest, with tag reference images, and retain a model/time/SHA-bound
transcript. Source tests, started/ended receipts and screenshots alone are not
UI PASS. Admin/member workflows remain pending in this anonymous scope. The
current APP has **0 complete route PASS / 65 pending**, and `deployEligible:false`
remains until the required candidate reviews and later deployment admission.

No Cloudflare/WAF, production DB, backup, legacy listener, release or rollback
version is changed by this preparation. There is no deployment in this batch.
