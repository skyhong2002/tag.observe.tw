# Offline SQL-result instrumentation hook

This module is import-only, pure injected instrumentation. It opens no gateway, DB, HTTP, lock, service or timer. It does not change the existing CANDIDATE pin, readonly gateway, product APP, Next cache key or fetch headers. Mock success is **adapter/mock-only**, never an actual B0, DB commit, privacy or deployment gate.

`createSqlResultHook({record, deadlineMs, now, maxRows, maxResultBytes, maxRecordBytes})` creates one AsyncLocalStorage context and at most one lifetime latch. Before booting any separately approved isolated gateway, an adapter can wrap its injected mysql `query`/`execute` object with `hook.wrap(pool)`. `hook.run('A'|'B', fn)` supplies explicit context; absent context delegates without capture. `sqlFingerprints(sql, params)` hashes exact SQL bytes and ordered primitive parameter JSON. SQL strings, parameter values, rows, canaries and errors are never emitted in evidence. Unsupported signatures/parameter types must be reviewed rather than silently coerced.

`hook.arm({signature, containsCanary, signal})` returns `entered`, `release`, and `close`. Only an exact A signature whose already-obtained rows contain the synchronous fixture canary can enter. The callback or Promise result is held before application delivery. Callback mysql Query return objects are returned verbatim without reading `.then`/`.catch`; only `types.isPromise` results are chained on the Promise path. B never waits on A's latch. A can be released once; abort/close reject the pending delivery and detach the caller signal, without starting a cleanup window. The owning adapter must abort underlying SQL/HTTP work itself; this hook cannot certify driver cancellation or destroyed sockets. Deadline checks occur at operations/results; there is no autonomous timer, and the adapter must retain its existing absolute-deadline watchdog.

After the adapter actually observes its own mutation completion, `hook.reportCommit()` records a monotonically sequenced **adapter-reported** event. It is not DB truth. B's issue sequence must be later than that event, and both SQL and parameter fingerprints must match A, before `B.fresh-marker` can be emitted. This marker proves instrumentation order only, not that the returned rows reflect the mutation; the boot/transport adapter still must validate B's expected absence/unaffected canaries and real transaction provenance.

Missing signature, early contextual A, second arm, second/late A, missing canary, wrong B order, mismatched SQL/params, unknown context, driver failure, oversized rows/results, evidence cap, false/async sink or expired operations fail closed. The sink must synchronously preserve bounded private evidence and return neither false nor a thenable. Callback delivery after close receives an error, never success rows. Repeated close is idempotent.

Pending actual integration: fixture ownership/mutation authorization; same-artifact isolated boot; wrapping all relevant real pool/result paths before app creation; readonly initialization behavior; true transaction commit evidence; SSR/HTML/RSC-to-gateway A/B correlation without cache-key tricks; actual raw transport and cache behavior; deadline cancellation; all B0 product assertions. No active SQL-result hook or deployment permission is created by this source packet.

Offline verification: `node --test tools/f1-privacy/sql-result-hook.test.mjs` (16 meaningful mocks). No SQL, candidate, browser, probe, build or service is executed. Root owns independent review and any later commit/admission. Source preparation is not deployed.

Independent existing GPT-6.1 Sol instance reviewed all three v2 files, matched
the frozen/current bytes, and personally passed 16 pure mocks and one syntax
check. Review JSON is
`/home/deck/tag-analysis-private/f1-release/f1-sql-result-hook-independent-v2-20261014.json`
(SHA-256 `760010b9edd4b0cb016e643eb8481b244cfbd61ee0280ea8013e39c1922f9158`);
the same-name `.txt` transcript SHA-256 is
`72fd7789d6b9b367acd331912a614ff40a41d9aaa7c46ef2b03786699d3156df`.
The v1 parameter-overload ISSUES evidence is retained. This is source/mock
review only; live boot, actual transaction, cancellation, SSR and B0 assertions
remain pending. Root's combined pure regression includes the existing barrier
and adapter tests; it does not open resources.

Reviewed contextual overloads are string SQL with optional array values and optional final callback, or plain options containing only sql and optional array values (or an explicit second array). Two simultaneous values sources, scalar/object/Date/named values, extra options and unsupported arity are rejected. Without explicit A/B context, original arguments, receiver, callback and return object pass through untouched, including Buffer/Date/Query contracts. SQL and serialized primitive parameters are bounded to64KiB; rows are checked as an array and counted before JSON encoding. The result budget is a serialized-evidence limit, not a hard cap on driver allocation, arbitrary individual row allocation or JSON serialization memory. Real-driver result ownership and overall memory guards remain adapter obligations.
