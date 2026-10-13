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


## Final Node24/glibc target copy — actual independent audit

The same existing nonauthor reviewer personally recalculated the exclusive
`-r2.target-runtime` copy. Worker UTC **12:44:51.496Z**, final acceptance
**12:44:54.418Z**; original/target variant checks UTC **12:45:29.628Z**.
Execution OPS is `c70425b007bdac9fdbef62b935811ee0d7f30d18`; APP and BUILD_ID
remain as above. The target inventory is
`f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`;
manifest SHA256 is
`76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`.
Neither the original `831dc44f…` nor the `-r2` `5bfc700a…` verifies this copy.

**12 ELF files / 8 .node bindings / 36 real readelf calls passed.** The
reviewer independently reparsed all raw outputs; maximum GLIBC requirement
is 2.30 and every RPATH/RUNPATH resolves within this target artifact. The
above 15-row table describes `-r2`; the target has those same entries except
the three explicitly excluded msgpackr variants below.

| Not copied into target | Original SHA256 | Reason |
|---|---|---|
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.abi115.glibc.node` | `c40b24b5dddd16128ff070cf1a0f3b0647622ec039e20419b4cb80e7f11b39b6` | ABI115 differs from Node24 ABI137 |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.abi115.musl.node` | `19ec49a6e7b3b9d61ae81232a05851bffa142ac9d3cb509190579341b82a4a9b` | Wrong ABI and libc |
| `node_modules/@msgpackr-extract/msgpackr-extract-linux-x64/node.napi.musl.node` | `dff6aa6f86cc3e36d7e9bf34abda45a9120a42e66b863b1ae067061ca09471f6` | musl differs from target glibc |

All three original files remain present and hash-identical in `-r2`.
`node.napi.glibc.node` remains in the target, unchanged at
`48bb0acaf5881374699e37ead45dd7aa867ec8b31591d99425eb8b925c9c8deb`.
No artifact was modified during independent audit.

Actual private evidence:
`/tmp/babysit/mint-queue/tag-target-independent-audit-reviewer-20261013T1245Z/`.
- result SHA256: `31d02b011d81d97b4f07a97ba3fed6fdce1c5d8c0e0789f94dbcdd3800e56491`.
- acceptance SHA256: `ae435dd0ffd324e461501442c6d0bbc5a9951a3f42d29c1900f77bcca838be1b`.
- raw-readelf.jsonl: 394,987 bytes; SHA256
  `a401d9adac8ab3dc8389ef901c7163f15cad1ac3b347b1c7e563e512a828a960`.
- `actual-variant-preservation.json`: reviewer personally checked preserved
  originals, omitted target variants and retained NAPI/glibc hash.

The shared lock is released. **Mint and SM native loaders, image processing,
all candidate screenshot/UI review and deployment remain pending.** There
are still 65 main UI routes, 0 complete passes and 65 pending for APP677.
Actual loader commands will be independently source-reviewed and handed to
babysit before execution; no new Next build is planned.
