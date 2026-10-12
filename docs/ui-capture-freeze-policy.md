# UI capture during the backup retention freeze

The coordinator has **not lifted the freeze**. No new build, image, Docker layer,
data export, release copy or deployment is authorized by this document. Existing
screenshots can continue to receive independent offline review. Screenshot
generation, source inspection and a reviewer's completion message are not a page
review pass: the ledger requires actual image input and its review transcript.

On 2026-10-12 at 21:42:12 UTC, `/home` had 121,071,304,704 available bytes
(112.756 GiB). This is below the conservative capture floor below, so this batch
performed source/mock tests and offline image review only. No new browser was
started. Existing captures, backups, releases and temporary evidence are retained.

## Guard and evidence rules

- `tools/ui-capture-budget.cjs` requires an explicit 1–16 screenshot budget:
  32 MiB for profile/network/logs plus 4 MiB per PNG, at most 96 MiB estimated.
- Before launch, the estimate must fit **above 113 GiB free**, leaving a margin
  above the approximately 111.5 GiB backup deletion threshold. During capture,
  resource checks preserve 8 MiB for final evidence writes above that floor.
  A batch stops at 92 MiB of measured files, load over 12, unreadable resource
  state, screenshot count exhaustion or evidence-write failure. These failures
  are fatal; interaction error handling must not swallow them.
- A screenshot is first captured into memory and rejected before saving if over
  4 MiB. Full-page images above eight million document pixels require viewport
  segments. Files use exclusive creation (`wx`) to preserve prior evidence.
- The two private collectors also require the existing global browser/build and
  blog TTFB/health gate, save pre/post resource probes, and pin the candidate's
  exact UI SHA, running frontend PID/cwd and Next BUILD_ID. At most two browser
  parents are allowed across all sites. During the freeze, use one small batch
  at a time; another thread's activity still counts against global headroom.
- Native DNT stays enabled, webdriver/UA and all application privacy guards stay
  unchanged, and service workers are blocked. GA/GTM and external transports
  are aborted by context routing before the first page navigation. The context
  starts at `about:blank`; this is not a claim that context routing exists before
  Chromium process creation. No candidate capture was launched in this batch.
- Freeze-mode raw request evidence is append-only `network-raw.jsonl`, capped at
  2 MiB including newlines. There is **no HAR** in this mode. A log cap or write
  failure stops capture and marks evidence incomplete; it cannot establish
  complete zero-outgoing evidence. Successful future runs still require actual
  request-log inspection and final on-disk size measurement.

The 100 MiB batch threshold is a **sampled stop guard, not a filesystem quota**.
Chromium cache flags do not cap the entire profile, nor do they prevent another
process from consuming space between checks. Insufficient or uncertain headroom
means offline review only; these checks do not authorize approaching the backup
retention threshold.

## Implementation and independent review

Private adapters, retained outside the repository:

- `/home/deck/tag-analysis-private/ui-review/f1/safe-capture-next-batch.cjs`
- `/home/deck/tag-analysis-private/ui-review/f1/safe-capture-middle.cjs`

Both have preserved before-freeze source copies. The final hashes and resource
sample are recorded in
`/home/deck/tag-analysis-private/ui-review/f1/capture-freeze-final-review-2026-10-12T21-42-12.894322+00-00.json`.
This supplements, rather than replaces, the earlier change manifest and reviews.

Independent reviewer `/root/ui_review_last`, GPT-6.1 Sol, reviewed source and
ran mock filesystem/page tests. Findings included swallowed stop errors and
unbounded screenshot writes; these were fixed and re-reviewed at
2026-10-12T21:41:35.624059+00:00. Transcript:
`/home/deck/tag-analysis-private/ui-review/f1/candidate-f1-review.log`.
See also `docs/ui-review/f1-candidate.md`. This is **n/a-ui** tool review,
not a screenshot or application-page pass.

Validation: `node --test tools/ui-capture-budget.test.cjs` passes all five tests,
covering resource limits, filesystem failure propagation, oversize PNG rejection,
pixel limits, exclusive writes and screenshot count limits. Both private
collectors pass `node --check`. Tests use an in-memory filesystem/page mock;
they do not start a browser, contact an origin or send analytics.

Production remains `0dd38b629621e27ccb40260a27b27cf2d7202519` according to the
prior verified switch. This tooling change is not deployed. Candidate
`dba9325442e7c8afc59b3be3990fb5f2ab9fcb0b` still needs UI re-review; its successful
build does not close the open issues or complete F1.
