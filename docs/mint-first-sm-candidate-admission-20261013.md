# First SM candidate admission — refreshed isolated session

The isolated SM native step completed at UTC14:48 with independent whole
runtime/receipt verification; evidence commit `48d65d010bc79a0ada16af67476afe3a725b2c4e`
is pushed. It does not constitute UI acceptance. APP `677a0c793eeda0c4d850c81ac574c95508d08e0a`,
packaging execution OPS `c70425b007bdac9fdbef62b935811ee0d7f30d18`, BUILD_ID `PmjYScQDDoJKBr43SLkhd` remain fixed.
The remote default branch was fetched again and remains
`a89908a650c42a1224d657e6c908d5fd3c7be5a0`. Use the same f166/761 artifact; no rebuild.

Root (`GPT-6.1 Sol`) independently reviewed the existing two authors' control
programs, with 16/16 pure source/mock tests, six module syntax checks and seven
Python compile-only checks. Review `/tmp/babysit/mint-queue/tag-candidate-source-root-independent-review-20261013-v3.json` SHA `bcd0aa8fb9753628f9d453c3efe2ac0ae86221bc7356fe3bec1f071d34ebee6f`;
raw `/tmp/babysit/mint-queue/tag-candidate-root-source-test-output-v3.txt`.
This is n/a-ui SOURCE_PASS, not runtime/connection/HTTP/browser/UI proof.

Frozen Mint controller SHA `0721a2d04ffc6468eabb50bc8c15adb4775a7003df2d0440e1d82380f42da5c4`; pure contract
`4971b0d2d5e2dc0b7f783c44d84b1b510af2990e0f63fe0312f13f5cae116c8b`. Both are passively staged in the Mint private
folder with mode0600, byte-identical to the SM preparation copies. SM v3
source hashes are `/tmp/babysit/mint-queue/tag-sm-candidate-source-c70425b0/source-pins-v3.json`.
All original native drivers, failed jobs, artifacts, releases and backups remain.


## Authorized refresh and actual startup (UTC16:14–16:16)

Babysit preapproved regeneration of the same reviewed source and anonymous
read-only scope. The old projected plan was retained and never executed.
Actual refresh `/tmp/babysit/mint-queue/tag-candidate-authorized-refresh-1.json`
records config SHA `94344f0ac32cf3f3c4b246276c14a665bff1515b4e20183ced4d67ca78e43b85`,
plan SHA `7d14227471aef965e5953dd926ddf61c6d0e2673aadcf2f9efc3817469eed5ae`,
Mint input SHA `d54ec2fa43fd49bb6472ec5a8e7d94b0eacfba49d550279f1ce1c33126e51936`.
The actual permission expires UTC16:29:30.210 with planned shutdown
UTC16:27:30.210; the duration limit remains 15 minutes and cleanup reserve
120 seconds. No source, APP, OPS, BUILD_ID, artifact bytes or scope changed.

The fresh actual cross-host probe is
`/tmp/babysit/mint-queue/tag-candidate-refresh-probe-20261013T1614Z.json`
SHA `3f6a3b77001f0e6e8f2b714fa6a5977cce08155bf04af5b393d84475541f8399`.
All three HTML requests returned200/curl0; totals tag0.590340/blog4.422628/
YT0.346532 seconds, SM load1.839, free61.06GiB, build0; Mint load0.65,
free143.34GiB, no lock/build/browser. The SM owner separately checked zero
browser roots. The observation-only probe remains executionPermission=false;
permission came from the separately recorded babysit authorization.
The real guard acquired the Mint lock and remeasured before launching.

SM `candidate-started.json` records UTC16:15:58.707, input SHA
`7c42257cec6bf1843b0e6a46891cecbc349a020e67e8822c7a1aeb58cab232e7`.
Independent root /proc PID startTicks and socket-FD observation at UTC16:16:50
is `/tmp/babysit/mint-queue/tag-candidate-owned-listeners-1.json`:

| Child | Actual PID | Exact owned listener |
| --- | --- | --- |
| SSH tunnel | 2532574 | 127.0.0.1:18131 |
| Next standalone | 2532907 | 127.0.0.1:18195 |
| Candidate frontdoor | 2533057 | 100.85.214.25:18196 |

The pre-existing loopback18196 listener retained inode215996810 and was
neither adopted nor stopped. These are service ownership observations,
not a browser, screenshot, HTTP rendering, user-machine reachability or UI
acceptance. The existing non-author reviewer has begun raw evidence review.
Final stop and whole inventory verification completed as recorded below.
No browser or capture started.


## Actual completion and evidence limits

The same command exited0 without another attempt. SM owner end UTC16:28:35.467,
Mint result UTC16:28:39.253 and acceptance UTC16:28:41.383 all precede the hard
UTC16:29:30.210 permission expiry. Retained exact originals and verified small
copies are `/tmp/babysit/mint-queue/tag-candidate-actual-1/{mint,sm}/`;
`copy-and-stop-observation.json` records 3,945,274 copied bytes and every SHA.
Mint result SHA `acb4f83ece616aef597de18a61cd22e23645d9cad45e11e2cb6de434a6276c8e`,
acceptance SHA `7a06a0e98f19bf8ae66277bc90f4ce91612f4916d74f010982e3ef7b19a1c27b`;
SM owner-end SHA `caf0ea4a346ceac64ef135ef35be8b18e8b0ba0231bc6ffb6897f7cdeebe9f56`.
Both controllers verified the whole unchanged f166 inventory /761 manifest.

Exact listener close milliseconds were not logged. The nominal stop was
UTC16:27:30.210; the synchronous planned-stop checkpoint completed
UTC16:27:39.936 (9.726 seconds later). The owner observed all three owned sockets
absent at UTC16:27:56.209; Next/frontdoor were already exited zombies, awaiting
parent reaping. Therefore the verified owned-listener window from the shared
startup receipt to the absence observation is at most11m57.502s; this is an
observation bound, not an exact bind/close lifetime. The tunnel started earlier
during setup. Do not describe cleanup as exactly120 seconds early.
Post-stop whole hash and checkpoint completed with stopped receipt
UTC16:28:19.722. At UTC16:29:15.309 all three recorded child PIDs were absent,
only the old loopback18196 inode215996810 remained, and the owner observed no
Mint kernel-lock holders. The non-author reviewer independently observed
SM PID/socket absence at UTC16:28:38. No existing listener was changed.

One SM gate rejection produced SIGSTOP UTC16:20:16.479, followed by a fresh
successful sample and SIGCONT UTC16:20:19.427 (2.948 seconds). Independent
source/raw inspection proves the failure came from the homepage-sample
validation branch, but the rejected sample stdout was not saved before
validation. The specific site, HTTP/curl status or total is **unrecorded**;
it cannot be reconstructed from successful surrounding probes. No claim
that every health sample passed, or that this was a specific performance
regression, is supported. All original evidence remains. The next source
batch must preserve raw probe output before validation and record exact
shutdown times; no hot edits or rerun were made to this admitted session.

The existing non-author GPT-6.1 Sol reviewer completed actual evidence
review, including all26 copied raw hashes, bound source/input/end receipts,
SM PID/startTicks/socket ownership and shutdown, and a direct independent
Mint `/proc/locks`/dev30/inode18/holder PID observation. Final review
`/home/deck/tag-analysis-private/f1-release/candidate-job-1-independent-execution-review-20261013.json`
SHA `bb20283cd94908c7950509e50777b7631f33d57e904bbb7545ccdad69e85b12d`;
transcript `.transcript.txt` SHA
`39219bada1260a9230d17ceb95deccaf3906bb37c36e272e75196ca7b9030368`.
The verdict is **owned-session completion verified with documented evidence
limitations**, not all-health PASS. SM157 recorded guard probes comprise156run
and1pause; Mint82run. The reviewer independently rehashed the manifest;
whole runtime verification was executed by the controllers and bound raw
receipt chain, not a second independent whole-tree rehash in this review.
Final owner handoff `/tmp/babysit/mint-queue/tag-candidate-reviewed-completion-1.json`.
 Anonymous listener supervision is n/a-ui; HTTP rendering, images,
browser navigation, 65-route reviews and deployment remain unverified.
No screenshot, browser, synthetic GA event or production DB operation ran.

## Original preparation history (retained)

### Proposed first scope

Anonymous, read-only SM candidate only: the existing SM f166 runtime's Next
standalone server on loopback18195; exact existing-alias SSH loopback18131
forwarding to Mint's real isolated API18131; the C704 candidate frontdoor on
SM Tailscale100.85.214.25:18196. Do not stop or adopt the older loopback18196
listener. At startup, bind/exclusive checks and own PID/startTicks/socket-FD
proof must pass; failure exits and retains evidence. The physical standalone
path is used without editing the Mint-origin artifact manifest.

New Mint guard owns the nonblocking global kernel lock. If YT holds it, exit.
Use actual fresh API source/isolation receipts and both hosts' real probes;
40→30GiB, load12, homepage totals2/6.17/2s remain. Nice19/ionice3 and
Next native helper UV2/VIPS1 are fixed; no Next build, npm, restore, inference,
new SQL data/account/permission, production action or deletion. Credential
stripping, private/no-store and candidate-only same-origin CSP remain.
Whole runtime before/after must equal f166, manifest761; bound previous actual
Mint/SM native and independent-review receipts are required. New config,
admission and job paths are exclusive; the old native admission is not reused.

This first controller admits **no browser/capture**. Candidate connections/HTML,
CSS/assets and user-machine reachability remain untested. No preview link is
claimed live. Capture requires its separate reviewed command/permission,
DNT1, pre-launch proxy and context GA/GTM denial, zero-outgoing raw artifacts,
SHA/BUILD_ID/DNT/GPC/viewport receipts and independent actual-image review.
Many/sparse article data and the disabled image queue remain uncovered; no
UI/full-pipeline pass is inherited from fixtures or source tests.

## Observations and conditional command

Readonly probe `/tmp/babysit/mint-queue/tag-sm-candidate-admission-probe-20261013T155103Z.json`
SHA `e812632468d091d0dc3eafc93eee247df92a86058844db09fe672310f9fae0c2` at UTC15:51:03.174: all sites200/curl0,
HTML end-to-end totals tag0.350117/blog3.434520/YT0.253905s; SMload2.681,
61.17GiB free and build0; Mintload0.71,143.34GiB free, no holder/build/browser.
Actual isolated API200, clean C704 source. executionPermission remains false.
Gate baseline uses five DNT1 homepage HTML time_total medians at UTC05:47:
tag0.256/blog3.085/YT0.289. These include rendering, edge and network;
they are not exact origin-rendering durations. Runtime guard measures again.

SM's offline `ssh -G` returned status0 at UTC15:52:48.141, exactly one
`[127.0.0.1]:18131 [127.0.0.1]:18131` local forward, hostname100.108.108.109,
usersky/port22; no inherited remote/dynamic forwards or multiplex/proxy command
were accepted. No connection was opened by -G. Original output:
`/tmp/babysit/mint-queue/tag-candidate-effective-ssh-readonly-20261013.raw`
SHA `5e8b8379d4a3926fc479416576ee0bd55c7c226c9290f890a6850fce89c4b465`.
The launch worker must verify effective configuration and actual API again.

Machine packet `/tmp/babysit/mint-queue/tag-sm-candidate-admission-packet-1.json`
has full pins, pending-false input/config/plan and projected expiry
`2026-10-13T16:14:08.917000+00:00`. It is a preparation window, not permission.
The candidate scope is at most15min, with planned healthy stop120s before
hard expiry to finish own cleanup/hash/fresh gates. If the projected plan
no longer has >180s at startup, do not run it: regenerate a fresh <=15min
time/config/plan hash and hand off the actual command. No TTL/gate/scope
or program bytes may be loosened.

After babysit admits this separate scope, the exact projected command is:

```sh
ssh -o BatchMode=yes Mint-MBP 'PATH=/home/sky/observe-worker/toolchain/node-v24.15.0-linux-x64/bin:/usr/bin:/bin PLAYWRIGHT_BROWSERS_PATH=/home/sky/observe-worker/browsers NEXT_TELEMETRY_DISABLED=1 nice -n 19 ionice -c3 node /var/lib/observe-worker/tag/private/tag-mint-sm-candidate-controller-c70425b0-prototype.mjs --execute 4c9a5009a864c5954596b995dd181bfa52114e5daa9d429c7ff2c416e23d0e0a'
```

Before admission, executable configuration, true plan, execution input,
specific kernel-PID admission and listeners are **not created**. Pending
JSON reviewed/globalBuildSlot/executionReviewed remain false; PID null.
Readiness/capability files do not grant a slot. Source/control preparation
does not publish a runtime manifest or a deployment eligibility flag.

Deployment: not deployed. APP677 UI ledger:65 primary routes /0 complete pass
/65 pending. Candidate service and screenshot commands are separate steps.
