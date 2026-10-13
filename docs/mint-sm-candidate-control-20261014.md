# Candidate control source review, 2026-10-14

This is an offline control-source batch, not candidate/UI acceptance or a deployment.
The source base is `35bb394a3d2a992378d885979db94d92f61d1e6a`;
`git fetch origin` confirmed remote main at
`a89908a650c42a1224d657e6c908d5fd3c7be5a0` before this handoff.
The existing artifact is intentionally unchanged: APP
`677a0c793eeda0c4d850c81ac574c95508d08e0a`, artifact OPS
`c70425b007bdac9fdbef62b935811ee0d7f30d18`, BUILD_ID
`PmjYScQDDoJKBr43SLkhd`.

## Changes

- Preserve raw SM probe output and status before parsing or rejecting a gate.
- Stop and confirm owned children before checkpointing. Record each cleanup
  failure while continuing cleanup of other children; never signal a reused PID.
- Verify the actual clean Git HEAD and committed blobs for the executing control
  source. An artifact's OPS is not permission to execute different control bytes.
- Bind private owner-stop requests to the input, session, control SHA and a
  120-second local-clock freshness window. The normal heartbeat checks the
  request before and after checkpointing; this does not promise immediate
  interruption of a synchronous checkpoint.
- Route anonymous GET/HEAD `/api/status/` to the Next HTML page while preserving
  `/api/status` as isolated API JSON. Unknown API paths and mutations stay denied.

## Independent evidence

The nonauthor GPT-6.1 Sol reviewer independently checked the five files in
`tools/mint-sm-candidate/` and the frontdoor module/test. The final review was
recorded at UTC `2026-10-13T17:42:08.969233+00:00`:

`/home/deck/tag-analysis-private/f1-release/mint-sm-candidate-source-independent-review-final-20261014.json`

SHA256: `1ed4ee4cb668711d9b7d9fd515bc7f67b7a39741a8e3080b0d037d874bce90c9`.
All seven current file hashes match that receipt. Tests: **29/29** (17 candidate,
12 frontdoor), plus syntax checks. Tests use injected mocks and a small isolated
Git repository; they do not start a listener, database, browser or remote job.

```sh
node --test tools/mint-sm-candidate/candidate-source.test.mjs tools/mint-fixture-frontdoor.test.js
```

Mint capture modules, route catalogue and screenshot review are outside this
PASS. Each actual candidate/capture step still requires exact commands, a fresh
probe and babysit admission. No service or production deployment occurred in
this batch; all existing runtime and failure directories remain intact.
