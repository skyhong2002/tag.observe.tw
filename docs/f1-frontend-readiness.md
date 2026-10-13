# F1 frontend offline readiness

Writer base: `b8d030c747f87c997800371e33e1ab2d168ad257` (HEAD when this pass began). This is an uncommitted writer implementation; no independent source approval or UI pass is claimed.

Scope: TagRelationsPanel, reader/TagRelationSubmission, admin/tags/TagSubmissions, tag/picture/PictureVote; frontend-only mock/state/SSR tests. Existing four UI regression changes remain intact.

Changes:
- Relation proposal retains login return anchor; all three types submit normalized values, reject self relations/control characters/overlong Unicode labels, prevent concurrent duplicate requests, and ignore results after unmount. Tag changes remount the proposal.
- Review mutations require a reason; picture approval additionally requires rights confirmation. A synchronous pending guard blocks repeat mutations, and late row results do not refresh a different/unmounted queue. Private image review continues to use the authenticated API-provided image endpoint.
- Picture board ignores stale success/error responses, exposes initial retry and alert/status messages, blocks concurrent mutations, and remounts on tag changes. Upload prevents concurrent selection, stops after unmount, uses a five-minute wall-clock deadline and AbortController for upload/poll requests and cancellable polling delays, and exposes keyboard focus/pending state.
- Public relations remain restricted to the public API shape; frontend never promotes pending submissions or pictures into public lists.

Validation (nice 19, one Vitest worker, no coverage):
- `vitest run --project unit web/test/f1-frontend-flow.spec.ts web/test/four-issue-ui.spec.ts --maxWorkers=1`: 2 files, 27 tests passed (16 new isolated frontend contracts + 11 existing UI source/SSR regressions).
- `tsc --noEmit -p web/tsconfig.json --incremental false`: passed.
- `tsc --noEmit -p web/tsconfig.tests.json --incremental false`: passed.
- `git diff --check`: passed.
- Biome check/write on the new spec and four changed sources: formatted; no new warnings. Two pre-existing `noImgElement` warnings remain on authenticated review/candidate images.
- A second independent review found aborted JSON bodies could fall back to an empty success response. The API helper now preserves abort and successful-response JSON parse rejection, and checks the signal after body parsing. A headers-resolved/body-pending regression confirms no success message or refresh occurs on timeout. File sizes are checked before `arrayBuffer()` using exact base64 length plus the JSON envelope against the existing 15 MiB backend body limit.
- Review follow-up replaced iteration-count polling with a real deadline/abort and added agreement/unmount, unresponsive upload/poll deadline, and admin duplicate/late callback tests.

The first test run had an incorrect expected nested URL encoding; the expectation was corrected, retaining the working source behavior. No dependency was added.

Outstanding: separate instance source review, then authorized single candidate build after freeze lifts; browser capture/re-capture for actual layout, keyboard focus, screen-reader announcements, admin filter/pagination, pending/errors, private review image access, and approved-only publication boundary. The isolated VM harness seeds hooks once and invokes explicit cleanup callbacks; it does not rerender or implement React dependency scheduling. Mock tests are not complete React lifecycle, browser, or pixel validation. No build, image generation, staging, capture, production probe, account/permission changes, or deployment occurred. Commit/push deferred to root handoff.

Independent source review follow-up: `/root/f1_frontend_independent_sol` (spawn model `gpt-6.1-sol`, a separate instance from the writer) passed the final diff. Its first review found that `response.json().catch(...)` swallowed a body-read AbortError after 2xx headers, falsely reporting submission success. The final implementation preserves cancellation and invalid-success-body failures; a regression covers the headers-received/body-hanging case. A pre-read file-size guard follows the existing 15 MiB JSON limit, including Base64 expansion and the JSON envelope.

Final independent validation: 27/27 tests (16 frontend contracts + 11 four-issue regressions), both noEmit/nonincremental TypeScript projects, and diff check passed. Record with UTC, baseline, exact final diff and six file hashes: `/home/deck/tag-analysis-private/f1-release/frontend-final-independent-review.log`. Root is committing this reviewed source; no build, UI pass, or deployment is implied.
