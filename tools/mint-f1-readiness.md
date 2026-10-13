# Mint isolated bridge readiness hook

`createMintReadinessHandler` is a constructor only. It starts no server and
registers nothing in production. The Mint owner may attach the returned handler
to the existing **loopback-only isolated fixture bridge**, handling the request
only when its return value is true. Mint Linux/Node24/npm readiness, fixture
provisioning and the host-wide build slot/lock remain separate prerequisites.

The private owner-only receipt (`mint-f1-readiness-v1`) must be independently
reviewed, current, and identify Mint/SM, fixed APP_SHA, loopback API origin,
`sourceReceiptId`, `isolationReceiptId`, source root and loaded `appModulePath`.
`expectedSourceFiles` must come from `sourceReceiptFromGit` for the fixed APP,
not from the candidate tree. The two APP lock hashes are independently pinned.
Also pin the reviewed fixture-only bridge code's path and SHA256. The bridge
must remove the old production GET relay and use in-process public-data fixtures.
The only permitted fixture actors are the existing 701/702/703; this hook creates
or queries no actors, accounts or roles, and never reads `.env`.

`getRuntime()` must read the running bridge's actual configuration and return:

- `serverAddress: server.address()` and the actual imported APP module URL plus
  the bridge module's own URL (`loadedSourceModuleUrl`, `loadedBridgeModuleUrl`).
- The matching isolation receipt ID, `productionRelayDisabled: true`,
  `publicDataSource: 'in-process-fixture'` and an empty `upstreamOrigins` list.
- For a real fixture DB, `mode: 'isolated-database'`,
  `databaseConnectionPresent: true`, `getConnectionMetadata()` returning only
  the existing connection's host/port/database/socketPath (never credentials),
  `identityConnectionScope: 'dedicated-readonly'`, and
  `queryDatabaseIdentity(sql, { signal })` returning the rows from the same
  reserved readonly identity connection. `cancelReadonlyIdentity({ signal })`
  must cancel/destroy **only that reserved connection**, never a shared business
  connection or pool, and resolve `true` only after cleanup is confirmed.
  The sole SQL is `SELECT DATABASE() AS databaseName, @@port AS serverPort`.
  The receipt's DB host must be explicit loopback, database must be
  `tag_f1_semantic_test`, and connection port and server port must match the
  independently checked recipe. A forwarded port and DB server port may differ.
  The query must honor AbortSignal and settle when its SQL operation has ended.
  Timeout aborts the signal and calls the cancellation adapter. While either the
  query or confirmed cancellation is outstanding, this handler refuses new
  identity queries. A failed or unconfirmed cancellation keeps it fail-closed.
  A late query result cannot change the completed 503 into a success. These
  callbacks must be real reviewed implementations in the pinned bridge code;
  setting a scope flag alone does not implement cancellation.

The database success payload exactly matches the execution consumer's identity,
APP, isolation receipt, scope and database-scope fields. This establishes only
readiness and database identity; it does not establish DB feature integration,
model/image validation or candidate UI approval. Failures return a fixed 503 body
without raw errors, credentials or user data. No SQL runs during construction.

Mock mode explicitly returns `scope: 'mint-f1-isolated-mock'` and
`databaseScope: 'mock-fixture'`, requires a separately reviewed mock receipt and
no database connection, and executes no SQL. The current execution consumer
**rejects that mock scope**. Any future mock-build acceptance needs a separate
review of its contract; this hook does not weaken the consumer.

Tests inject filesystem, machine identity, HTTP objects and database callbacks:
`node --test tools/mint-f1-readiness.test.js`. They start no service and execute
no SQL, network probes or builds.
