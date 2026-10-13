# Mint native-r2 independent static audit — 2026-10-13

The existing nonauthor reviewer `/root/mint_candidate_portability` executed the
admitted guard command on Mint. Worker recalculation completed at UTC
12:07:33.359Z; parent final acceptance at UTC 12:07:38.264Z. These are actual
readonly inventory/readelf results, not UI review or native loader receipt.

APP: `677a0c793eeda0c4d850c81ac574c95508d08e0a`; execution OPS:
`51c2db60f0f58ec3a25c66bb28cfe93e9a1f4920`; remote base:
`a89908a650c42a1224d657e6c908d5fd3c7be5a0`; BUILD_ID:
`PmjYScQDDoJKBr43SLkhd`.

Recomputed new runtime inventory:
`5bfc700a09b63d8144f77df8aa6e65f36f783c9d2296b0643de6979b5eb9c714`.
The older `831dc44f…` inventory does not validate the new bytes. Manifest bytes
remain SHA256 `648eac2ef76f05aa23561379b0ea68bd2d40761a97c30d61c460d6dcadf41f47`.
Runtime: `/var/lib/observe-worker/tag/candidate-677a0c79-home-fix.native-runtime-r2`.

All 15 ELF files / 45 real readelf commands passed; the reviewer independently
reparsed the raw headers, version needs and dynamic paths. Highest GLIBC
requirement is 2.30, below the 2.39 ceiling. Every RPATH/RUNPATH resolves within
the artifact. A file with no GLIBC requirements is not thereby proven loadable.

| ELF path | Max required GLIBC | RPATH / RUNPATH | Availability |
|---|---|---|---|
| `node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.7` | 2.28 | `$ORIGIN/` | static only; loader pending |
| `node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | 2.17 | `$ORIGIN/../../sharp-libvips-linux-x64/lib` | static only; loader pending |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.abi115.glibc.node` | 2.3 | none | non-target alternative; not loaded |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.abi115.musl.node` | none recorded | none | non-target alternative; not loaded |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.napi.glibc.node` | 2.3 | none | static only; loader pending |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.napi.musl.node` | none recorded | none | non-target alternative; not loaded |
| `node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime.so.1` | 2.28 | `$ORIGIN` | static only; loader pending |
| `node_modules/onnxruntime-node/bin/napi-v6/linux/x64/onnxruntime_binding.node` | 2.14 | `$ORIGIN/` | static only; loader pending |
| `web/.next/standalone/web/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.7` | 2.28 | `$ORIGIN/` | static only; loader pending |
| `web/.next/standalone/web/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | 2.17 | `$ORIGIN/../../sharp-libvips-linux-x64/lib` | static only; loader pending |
| `web/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.7` | 2.28 | `$ORIGIN/` | static only; loader pending |
| `web/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.5.node` | 2.17 | `$ORIGIN/../../sharp-libvips-linux-x64/lib` | static only; loader pending |
| `web/node_modules/@next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node` | 2.30 | none | static only; loader pending |
| `web/node_modules/@tailwindcss/oxide-linux-x64-gnu/tailwindcss-oxide.linux-x64-gnu.node` | 2.14 | none | static only; loader pending |
| `web/node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node` | 2.14 | none | static only; loader pending |

The three ABI115/musl msgpackr alternatives are explicitly non-target and have
not been loaded. Installed loader resolve-only on Node24/ABI137/glibc2.39 chose
`node.napi.glibc.node`; resolve-only is not native smoke. An exclusive target
copy may omit these exact alternatives with hash/reason provenance, retain all
originals, and must receive fresh inventory/ELF and actual loader evidence.

Private evidence directory (0700; files 0600):
`/tmp/babysit/mint-queue/tag-independent-audit-reviewer-20261013T1207Z/`.
- result SHA256: `f8e6356f762a8d6a7aa2fa0d637118d12f92f0109f26022f511c0628fa8f7994`.
- acceptance SHA256: `4ac7306a1facbabc60834f00275e85455b39890870819c2d040d0073ab726dfd`.
- raw-readelf.jsonl: 408,004 bytes; SHA256
  `6ebff0e9e49e2a49d4b4751da72e4cb91fd4fb66471185aebeba6c5f01f86861`.

The common lock was released. No artifact was modified, loader/browser started,
production traffic switched or GA event sent. Deployment eligibility remains
false; actual Mint/SM loader and all 65 UI routes remain pending. Each next
execution command requires babysit admission; no new build is required.
