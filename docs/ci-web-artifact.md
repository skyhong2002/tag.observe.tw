# Web CI candidate artifact

The `web` job keeps the normal `npm ci`, TypeScript check, and `next build` with
an unreachable API. It then packages and verifies that exact checkout. PR merge
refs exercise the same checks but upload nothing. Only `push` to `main` uploads
`tag-web-<commit>-<run-id>-<attempt>` for 14 days. The test job remains independent;
a successful upload alone does **not** mean the whole CI run passed.

`web-standalone.tar.gz` contains:

- `runtime/`: the entire standalone root (including root and web dependencies),
  with public/static contents merged at `web/public` and `web/.next/static`, the
  share font, NFT inputs, and the conservative tracked external import closure
  under `app/data` and `app/src`. The latter includes type imports for source
  evidence; it does not claim each source file is loaded at runtime.
- `evidence/`: every build NFT and manifest outside cache/static/standalone,
  required-server-files, source configuration/locks, explicit NFT-to-runtime byte
  mappings, and external input hashes.

`manifest.json` is a sidecar with actual checkout commit/tree, PR head/base when
applicable, workflow/run/attempt, build ID, lock/config hashes in the inventory,
actual Next/React versions, Node binary hash/versions/ABI/N-API, runner image,
OS/glibc, native file paths, every archived path/type/mode/hash/link, and archive
hash/size. Packaging checks reject undeclared runtime source, unsafe/private
paths, cache, special files, dangling/escaping/absolute links, byte conflicts,
and unsafe tar members. The archive is extracted into a fresh directory and
rehashed before upload. The packager and tests use only Python's standard library.

## Select and download

Select a completed **successful entire** `ci.yml` push run in the trusted
`skyhong2002/tag.observe.tw` repository whose `headSha` is the exact accepted main
commit. Check event, branch, workflow, run ID, attempt, and artifact ID/name with
the GitHub API; do not select a mutable “latest” artifact or a PR merge ref.
For example (replace the run ID and exact artifact name after inspecting them):

```sh
gh run view RUN_ID --repo skyhong2002/tag.observe.tw --json headSha,event,conclusion,jobs,url
gh api repos/skyhong2002/tag.observe.tw/actions/runs/RUN_ID/artifacts
gh run download RUN_ID --repo skyhong2002/tag.observe.tw --name EXACT_ARTIFACT_NAME --dir DOWNLOAD_DIR
```

Ordinary repository Actions read/download permission suffices. These files are
server code and publicly built prerenders; CI has no production environment or
API data. No deployment credentials, host operations, or automatic deployment
are added. Hashes in the same artifact are integrity checks, not independent
provenance: verify the trusted GitHub run as well.

## Host acceptance stays separate

This is the `tag-web-ci-candidate/v1` producer, not a replacement receipt for any
legacy frozen fa3/Build R4 packet. Those contracts and receipts remain unchanged.
The profile is Ubuntu 24.04 Linux x64, Node 24.15.0; the runner image revision and
native hashes are recorded, not assumed compatible with the host. Stage with a
reviewed importer, verify the archive and source identity, then independently
check Node/native loading (including sharp/libvips), assets/font/OG routes,
readonly-release/cache behavior, and recovery of API-down build fallback pages
through real ISR. `runtime/web/server.js` expects `runtime/web` as cwd. Successful
packaging, HTTP 200, or matching BUILD_ID does not prove those acceptance checks.
API and workers are outside this web artifact's deployment scope.
