# Topics API intermittent failures (2026-10-15)

The observed failure was database capacity, not a missing table or bad column. The production journal contains Drizzle/mysql2 errors with the underlying message `Queue limit reached` while the gateway was serving the site. The recorded failing SQL included:

- `select count(*) from media_category_defs` (media-category refresh)
- `select media, category from media_categories order by media_categories.media asc` (media-category refresh)

The same journal entries report `Headers Timeout Error` for the UI origin during the affected periods. No errno or SQLSTATE was supplied by mysql2 for this queue rejection, so the evidence is explicitly classified as a client pool-capacity error rather than a MariaDB server errno/SQLSTATE. No production rows were queried or copied for this diagnosis.

The `/api/v1/topics` handler fans out to source-status checks. Previously every configured outlet started its three-query status sequence at once. That could add a large burst to the shared four-connection pool while crawlers and media-category refreshes were active. The fix bounds source-status outlet work to two concurrent sequences with the existing `p-limit` dependency; each outlet's query order and result shape are unchanged. This is a load-control fix, not proof that every historical 500 had one cause.

Validation:

- `app/src/v1/pages-topics.spec.ts`: 6/6 tests pass.
- TypeScript check for `tsconfig.json` passes.
- Ten read-only DNT=1 production requests at UTC 2026-10-15 02:22:26–02:22:32 returned HTTP 200; the first cold request took 5.998s and subsequent cached responses 0.038–0.096s. This is observation only, not a deployment or root-cause proof.

The change is source-only until a separately gated web/API build and rollout is authorized. No production API was restarted in this diagnosis.
